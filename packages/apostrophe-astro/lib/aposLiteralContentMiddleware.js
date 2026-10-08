// Astro SSR middleware that routes module-declared "literal content" URLs
// (robots.txt, sitemap.xml, llms.txt, …) straight to Apostrophe via the raw
// proxy, bypassing the catch-all page renderer - which would `JSON.parse` the
// non-HTML body and 500.
//
// This is the SSR counterpart to the static build's literal-content handling.
// It is additive: the config-time `proxyRoutes` option is unaffected and keeps
// working alongside this. Because the decision is made per request, the route
// list can come from the running backend (unknown at config/startup time).
//
// The pattern list is the manifest served by the backend at
// `/api/v1/@apostrophecms/url/literal-routes` (the
// `@apostrophecms/url:getLiteralContentRoutes` event). It is fetched lazily on
// the first request and kept for the lifetime of the process. The request's
// Host is forwarded. A backend that routes by Host (multisite) declares
// `scope: 'host'` and the matchers are cached per host; otherwise one set
// serves every host. A failed fetch is not cached, so it is retried on the
// next request; this gracefully handles any boot racing conditions. A host the
// backend does not serve (a non-JSON answer, e.g. a multisite orphan) is
// remembered briefly instead.
import { request } from 'undici';
import { logError } from './log.js';

import { defineMiddleware } from 'astro:middleware';
import config from 'apostrophe-astro-config/config';
import aposResponse from './aposResponse.js';

const EXTERNAL_FRONT_KEY = process.env.APOS_EXTERNAL_FRONT_KEY;

// After this many consecutive 404s the endpoint is assumed absent (an
// Apostrophe version without literal-content support) and the feature is
// disabled for the lifetime of the process rather than probed on every request.
const MAX_NOT_FOUND = 5;

// Only hosts the backend serves are cached per host, so this is a safety net.
// The least recently used host is evicted past this size.
const MAX_HOSTS = 500;

// How long a host without a manifest is skipped before asking again.
const UNKNOWN_HOST_TTL = 30 * 1000;

const forwardsHost = !(config.excludeRequestHeaders || [])
  .some((name) => name.toLowerCase() === 'host');

// Compiled matchers for every host, once the backend declares a global scope.
let globalMatchers = null;
// Compiled matchers, in-flight fetches and unknown host expiry times,
// keyed by host.
const cache = new Map();
const inflight = new Map();
const unknown = new Map();
let notFoundCount = 0;
let disabled = false;

// Compile a prefix-free path pattern to a RegExp.
// `*` matches within a path segment; `**` matches across segments.
// A trailing slash is tolerated.
function toRegExp(pattern) {
  const source = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // escape regex metachars
    .replace(/\*\*/g, ' ') // placeholder for **
    .replace(/\*/g, '[^/]*') // * stays within a segment
    .replace(/ /g, '.*'); // ** spans segments
  return new RegExp(`^${source}/?$`);
}

async function fetchManifest(host) {
  const url = new URL(
    (config.aposPrefix || '') + '/api/v1/@apostrophecms/url/literal-routes',
    config.aposHost
  );
  const headers = {
    'x-requested-with': 'AposExternalFront',
    'apos-external-front-key': EXTERNAL_FRONT_KEY
  };
  if (host) {
    headers.host = host;
  }
  // `fetch` never sends a custom Host; undici's `request` does.
  const res = await request(url.href, { headers });
  const ok = res.statusCode >= 200 && res.statusCode < 300;
  const isJson = (res.headers['content-type'] || '').includes('json');
  if (!ok || !isJson) {
    await res.body.dump().catch(() => {});
  }
  // Only Apostrophe's own 404 is JSON. Any other 404 (e.g. a multisite orphan
  // for an unknown host) must not count towards disabling the feature.
  if (res.statusCode === 404 && isJson) {
    const err = new Error('literal-routes endpoint not found (404)');
    err.notFound = true;
    throw err;
  }
  if (!isJson) {
    const err = new Error(
      `literal-routes manifest not served for host ${host || '(none)'} (${res.statusCode})`
    );
    err.unknownHost = true;
    throw err;
  }
  if (!ok) {
    throw new Error(`literal-routes manifest fetch failed (${res.statusCode})`);
  }
  const { patterns, scope } = await res.body.json();
  return {
    matchers: (patterns || []).map(toRegExp),
    scope
  };
}

function isUnknownHost(host) {
  const now = Date.now();
  // Same TTL for all, so insertion order is expiry order.
  for (const [ key, expires ] of unknown) {
    if (expires > now) {
      break;
    }
    unknown.delete(key);
  }
  return unknown.has(host);
}

function addUnknownHost(host) {
  if (unknown.size >= MAX_HOSTS) {
    unknown.delete(unknown.keys().next().value);
  }
  unknown.delete(host);
  unknown.set(host, Date.now() + UNKNOWN_HOST_TTL);
}

function getMatchers(req) {
  if (disabled) {
    return Promise.resolve([]);
  }
  if (globalMatchers) {
    return Promise.resolve(globalMatchers);
  }
  const host = forwardsHost ? (req.headers.get('host') || '').toLowerCase() : '';
  // Host header should not contain the protocol or a path. `aposResponse`
  // answers 400 for it; never send it to the backend.
  if (host.includes('/')) {
    return Promise.resolve([]);
  }
  if (cache.has(host)) {
    const matchers = cache.get(host);
    cache.delete(host);
    cache.set(host, matchers);
    return Promise.resolve(matchers);
  }
  if (isUnknownHost(host)) {
    return Promise.resolve([]);
  }
  if (!inflight.has(host)) {
    inflight.set(host, fetchManifest(host)
      .then(({ matchers, scope }) => {
        notFoundCount = 0;
        // Anything but `host` (including older backends) is global.
        if (scope !== 'host') {
          globalMatchers = matchers;
          cache.clear();
          unknown.clear();
          return matchers;
        }
        if (cache.size >= MAX_HOSTS) {
          cache.delete(cache.keys().next().value);
        }
        cache.set(host, matchers);
        return matchers;
      })
      .catch((err) => {
        if (err.notFound) {
          if (++notFoundCount >= MAX_NOT_FOUND) {
            disabled = true;
            cache.clear();
            logError(
              'literal-content: endpoint not found after ' +
              `${notFoundCount} attempts; disabling. Please upgrade your Apostrophe version.`
            );
          }
        } else {
          notFoundCount = 0;
          if (err.unknownHost) {
            addUnknownHost(host);
          }
          logError('literal-content middleware:', err.message);
        }
        return [];
      })
      .finally(() => {
        inflight.delete(host);
      }));
  }
  return inflight.get(host);
}

export const onRequest = defineMiddleware(async (context, next) => {
  const matchers = await getMatchers(context.request);
  if (matchers.length) {
    // Patterns are prefix-free; strip Astro `base` / aposPrefix before matching.
    const prefix = config.aposPrefix || '';
    let pathname = context.url.pathname;
    if (prefix && pathname.startsWith(prefix)) {
      pathname = pathname.slice(prefix.length) || '/';
    }
    if (matchers.some((re) => re.test(pathname))) {
      return aposResponse(context.request);
    }
  }
  return next();
});
