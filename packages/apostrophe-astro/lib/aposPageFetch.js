import aposResponse from './aposResponse.js';
import aposRequest from './aposRequest.js';

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
    aposData = await response.json();

    // Apostrophe's external-front middleware returns redirects as JSON
    // (e.g. { redirect: true, url: '/fr/', status: 302 }). When the
    // redirect only adds or removes a trailing slash we should follow
    // it internally rather than bouncing the browser — otherwise locale
    // home pages like /fr/ cause an infinite redirect loop.
    // Skip the site root "/" — it never needs this treatment.
    if (aposData.redirect && aposData.url !== '/') {
      const from = new URL(request.url).pathname.replace(/\/+$/, '');
      const to = (aposData.url || '').replace(/\/+$/, '');
      if (from === to) {
        const retry = new Request(new URL(aposData.url, request.url), request);
        const retryResponse = await aposResponse(retry);
        aposData = await retryResponse.json();
      }
    }

    aposData.aposResponseHeaders = response.headers;
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
