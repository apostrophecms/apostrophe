import aposResponse from './aposResponse.js';
import aposRequest from './aposRequest.js';
import config from 'virtual:apostrophe-config';

export default async function aposPageFetch(req) {
  let aposData = {};
  try {
    let request = aposRequest(req);
    if (request.method === 'HEAD') {
      request = new Request(request, {
        method: 'GET'
      });
    }
    const response = await aposResponse(request);
    let headers =response.headers;
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
      let from = new URL(request.url).pathname.replace(/\/+$/, '');
      if (prefix && from.startsWith(prefix + '/')) {
        from = from.slice(prefix.length);
      } else if (prefix && from === prefix) {
        from = '/';
      }
      const to = (aposData.url || '').replace(/\/+$/, '');
      if (from === to) {
        const retryUrl = prefix + aposData.url;
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
