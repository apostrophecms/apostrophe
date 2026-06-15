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
// the first request and cached with a TTL, so a newly declared route appears
// without a frontend restart.
import { defineMiddleware } from 'astro:middleware';
import config from 'virtual:apostrophe-config';
import aposResponse from './aposResponse.js';

// Cache the compiled manifest for this long before refetching.
// TODO: expose as a config option.
const TTL_MS = 5 * 60 * 1000;
// Shorter retry window when a fetch fails, so a briefly-unavailable backend
// is not hammered on every request.
const ERROR_TTL_MS = 15 * 1000;

const EXTERNAL_FRONT_KEY = process.env.APOS_EXTERNAL_FRONT_KEY;

let cache = null; // { matchers, expires }
let inflight = null;

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
  if (!res.ok) {
    throw new Error(`literal-routes manifest fetch failed (${res.status})`);
  }
  const { patterns } = await res.json();
  return (patterns || []).map(toRegExp);
}

function getMatchers() {
  if (cache && cache.expires > Date.now()) {
    return Promise.resolve(cache.matchers);
  }
  if (!inflight) {
    inflight = fetchManifest()
      .then((matchers) => {
        cache = { matchers, expires: Date.now() + TTL_MS };
        return matchers;
      })
      .catch((err) => {
        // Fail open: no interception until the next retry window. Literal
        // routes 500 in this state, but normal pages are unaffected.
        console.error('[apostrophe-astro] literal-content middleware:', err.message);
        cache = { matchers: [], expires: Date.now() + ERROR_TTL_MS };
        return cache.matchers;
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
