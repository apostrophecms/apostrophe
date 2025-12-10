import config from 'virtual:apostrophe-config';
import { request } from 'undici';
import zlib from 'zlib';
import { promisify } from 'util';

// Promisify zlib functions
const gunzipAsync = promisify(zlib.gunzip);
const inflateAsync = promisify(zlib.inflate);
const brotliDecompressAsync = promisify(zlib.brotliDecompress);

const excludedHeadersLower = new Set(config.excludeRequestHeaders?.map(h => h.toLowerCase()) || []);

function looksLikeChunkedEncoding(buffer) {
  const str = buffer.toString('utf8');

  // chunked responses start with a hex line followed by \r\n
  // and end with "0\r\n\r\n"
  const startsWithHex = /^[0-9a-fA-F]+\r\n/.test(str);
  const endsWithTerminator = /0\r\n\r\n$/.test(str);

  return startsWithHex && endsWithTerminator;
}

export default async function aposResponse(req) {
  try {
    // Host header should not contain the protocol or a path
    if (req.headers.get('host').includes('/')) {
      return new Response('Invalid Host header', {
        status: 400,
        statusText: 'Bad Request'
      });
    }

    // Prepare URL for the backend request
    const url = new URL(req.url);

    const aposHost = process.env.APOS_HOST || config.aposHost;
    const aposUrl = new URL(url.pathname, aposHost);
    aposUrl.search = url.search;
 
    // Prepare headers, excluding any specified in config
    const requestHeaders = {};
    for (const [name, value] of req.headers) {
      if (!excludedHeadersLower.has(name.toLowerCase())) {
        requestHeaders[name] = value;
      }
    }

    // Make the request to the backend
    const res = await request(aposUrl.href, {
      headers: requestHeaders,
      method: req.method,
      body: req.body
    });

    // Prepare response headers
    const responseHeaders = new Headers();
    Object.entries(res.headers).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => responseHeaders.append(key, v));
      } else {
        responseHeaders.set(key, value);
      }
    });

    const { headers, statusCode, ...rest } = res;

    // Handle empty responses (status codes that should not have bodies)
    if ([204, 304].includes(statusCode)) {
      return new Response(null, { ...rest, status: statusCode, headers: responseHeaders });
    }

    // Check for content-encoding header
    const contentEncoding = res.headers['content-encoding'] || '';

    // If no compression or HEAD/CONNECT request, return as-is
    if (!contentEncoding || req.method === 'HEAD' || req.method === 'CONNECT') {
      return new Response(res.body, { ...rest, status: statusCode, headers: responseHeaders });
    }

    // Parse and process content encodings
    const codings = contentEncoding.toLowerCase().split(',').map(x => x.trim());

    try {
      // Get the body as an ArrayBuffer
      const bodyArrayBuffer = await res.body.arrayBuffer();

      // Convert to Buffer for Node.js zlib functions
      let buffer = Buffer.from(bodyArrayBuffer);

      // Apply decoders in order
      for (const coding of codings) {
        try {
          if (coding === 'gzip' || coding === 'x-gzip') {
            buffer = await gunzipAsync(buffer);
          } else if (coding === 'deflate') {
            buffer = await inflateAsync(buffer);
          } else if (coding === 'br') {
            buffer = await brotliDecompressAsync(buffer);
          }
          // Skip unknown encodings silently
        } catch (decompressError) {
          // If decompression fails, return original response
          return new Response(new Uint8Array(bodyArrayBuffer), {
            ...rest,
            status: statusCode,
            headers: responseHeaders
          });
        }
      }

      if (looksLikeChunkedEncoding(buffer)) {
        console.warn('⚠️ Warning: response appears to be chunked-encoded. undici may not have decoded it.');
      }

      // Create response with decoded data and remove content-encoding header
      responseHeaders.delete('content-encoding');

      return new Response(buffer, {
        ...rest,
        status: statusCode,
        headers: responseHeaders
      });
    } catch (bodyError) {
      // If we can't process the body, fall back to the original response
      return new Response(res.body, { ...rest, status: statusCode, headers: responseHeaders });
    }
  } catch (error) {
    // Handle any unexpected errors
    return new Response(`Server error: ${error.message}`, { status: 500 });
  }
}
