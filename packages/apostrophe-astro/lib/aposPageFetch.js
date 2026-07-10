import config from 'apostrophe-astro-config/config';
import aposResponse from './aposResponse.js';
import aposRequest, { isAstroPrerenderedRequest } from './aposRequest.js';

/**
 * Fetch a full Apostrophe page data object for the given Astro request.
 *
 * @internal
 * This is for internal use by the starter kit's `[...slug].astro` entrypoint
 * only. It is not part of the public helper API. For fetching arbitrary
 * Apostrophe data in your own components, use `aposFetch` from
 * `@apostrophecms/apostrophe-astro/helpers/server` instead.
 *
 * It wraps `aposRequest` and `aposResponse` to forward the incoming
 * request to the Apostrophe backend and return the parsed JSON page data,
 * including automatic handling of trailing-slash redirects.
 *
 * @param {Request} req - The incoming Astro request (`Astro.request`).
 * @returns {Promise<object>} The Apostrophe page data object. On error,
 *   returns an object with `errorFetchingPage` set to the caught error
 *   and `page.type` set to `'apos-fetch-error'`.
 */
export async function aposPageFetch(req) {
  let aposData = {};
  try {
    // Pass only the URL (as a plain string) when the request is Astro's
    // prerendered request. Astro v6 installs a warning getter on
    // Astro.request.headers for prerendered pages; we detect this via
    // isAstroPrerenderedRequest() which inspects the property descriptor
    // without triggering the getter. Fall back to env-var / config checks
    // for any edge cases where the request was already unwrapped.
    const isStaticBuild = isAstroPrerenderedRequest(req)
      || process.env.APOS_ASTRO_STATIC_BUILD === '1'
      || Boolean(config.staticBuild);
    const input = (isStaticBuild && req && typeof req !== 'string') ? req.url : req;
    let request = aposRequest(input);
    if (request.method === 'HEAD') {
      request = new Request(request, {
        method: 'GET'
      });
    }
    const response = await aposResponse(request);
    let headers = response.headers;
    aposData = await response.json();

    // Apostrophe's external-front middleware returns redirects as JSON
    // (e.g. { redirect: true, url: '/fr/', status: 302 }). When the
    // redirect only adds or removes a trailing slash we should follow
    // it internally rather than bouncing the browser — otherwise locale
    // home pages like /fr/ cause an infinite redirect loop.
    // Skip the site root "/" — it never needs this treatment.
    //
    // When a prefix is configured, Apostrophe returns redirect URLs
    // without the prefix (it's a routing concern, not stored in page
    // data).  Strip the prefix from `from` so both sides compare on
    // the same terms, then re-add it when constructing the retry URL.
    if (aposData.redirect && aposData.url !== '/') {
      const prefix = config.aposPrefix || '';
      const requestUrl = new URL(request.url);
      let from = requestUrl.pathname.replace(/\/+$/, '');
      if (prefix && from.startsWith(prefix + '/')) {
        from = from.slice(prefix.length);
      } else if (prefix && from === prefix) {
        from = '/';
      }
      // Parse the redirect target so the trailing-slash comparison
      // sees only the path, even if the URL carries a query string.
      // Absolute redirects to other hosts never qualify for an
      // internal retry — they must reach the browser.
      const target = new URL(aposData.url || '', requestUrl);
      const to = target.pathname.replace(/\/+$/, '');
      if (target.origin === requestUrl.origin && from === to) {
        // Preserve the query string across the internal retry: the
        // target's own if present, otherwise the original request's.
        // Apostrophe's trailing-slash redirect drops the query string
        // (e.g. /articles/?page=2 redirects to /articles), so without
        // this the retry would render page 1.
        const search = target.search || requestUrl.search;
        const retryUrl = prefix + target.pathname + search;
        const retry = new Request(new URL(retryUrl, request.url), request);
        const retryResponse = await aposResponse(retry);
        headers = retryResponse.headers;
        const retryData = await retryResponse.json();
        // Safety check: if the retry itself redirects to the same
        // URL we just tried, we've hit an infinite redirect loop.
        // Return an error instead of bouncing forever.
        if (retryData.redirect && retryData.url === aposData.url) {
          throw new Error(
            `Infinite redirect detected: ${aposData.url} redirects back to itself`
          );
        }
        aposData = retryData;
      }
    }

    aposData.aposResponseHeaders = headers;
    if (aposData.template === '@apostrophecms/page:notFound') {
      aposData.notFound = true;
    }
  } catch (e) {
    console.error('error:', e);
    aposData.errorFetchingPage = e;
    aposData.page = {
      type: 'apos-fetch-error'
    };
  }
  return aposData;
}

export default aposPageFetch;
