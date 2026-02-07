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
