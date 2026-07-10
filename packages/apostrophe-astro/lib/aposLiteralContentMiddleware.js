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
// the first request and kept for the lifetime of the process — the route list
// is static once the backend is up. A failed fetch is not cached, so it is
// retried on the next request; this gracefully handles any boot racing conditions.
import { defineMiddleware } from 'astro:middleware';
import config from 'apostrophe-astro-config/config';
import aposResponse from './aposResponse.js';

const EXTERNAL_FRONT_KEY = process.env.APOS_EXTERNAL_FRONT_KEY;

// After this many consecutive 404s the endpoint is assumed absent (an
// Apostrophe version without literal-content support) and the feature is
// disabled for the lifetime of the process rather than probed on every request.
const MAX_NOT_FOUND = 5;

// Compiled matchers, fetched once and kept for the lifetime of the process.
// Stays null until the first successful fetch, so a failed fetch is retried
// on the next request.
let cached = null;
let inflight = null;
let notFoundCount = 0;

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

async function fetchManifest() {
  const url = new URL(
    (config.aposPrefix || '') + '/api/v1/@apostrophecms/url/literal-routes',
    config.aposHost
  );
  const res = await fetch(url, {
    headers: {
      'x-requested-with': 'AposExternalFront',
      'apos-external-front-key': EXTERNAL_FRONT_KEY
    }
  });
  if (res.status === 404) {
    const err = new Error('literal-routes endpoint not found (404)');
    err.notFound = true;
    throw err;
  }
  if (!res.ok) {
    throw new Error(`literal-routes manifest fetch failed (${res.status})`);
  }
  const { patterns } = await res.json();
  return (patterns || []).map(toRegExp);
}

function getMatchers() {
  if (cached) {
    return Promise.resolve(cached);
  }
  if (!inflight) {
    inflight = fetchManifest()
      .then((matchers) => {
        cached = matchers;
        notFoundCount = 0;
        return matchers;
      })
      .catch((err) => {
        if (err.notFound) {
          // Disable permanently (until restart).
          if (++notFoundCount >= MAX_NOT_FOUND) {
            cached = [];
            console.error(
              '[apostrophe-astro] literal-content: endpoint not found after ' +
              `${notFoundCount} attempts; disabling. Please upgrade your Apostrophe version.`
            );
            return cached;
          }
        } else {
          notFoundCount = 0;
          console.error('[apostrophe-astro] literal-content middleware:', err.message);
        }
        return [];
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const matchers = await getMatchers();
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
