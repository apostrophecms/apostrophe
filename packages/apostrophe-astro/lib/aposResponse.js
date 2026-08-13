import config from 'apostrophe-astro-config/config';
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
    const host = req.headers.get('host');
    if (host?.includes('/')) {
      return new Response('Invalid Host header', {
        status: 400,
        statusText: 'Bad Request'
      });
    }

    // Prepare URL for the backend request
    const url = new URL(req.url);

    const aposHost = config.aposHost;
    let pathname = url.pathname;

    // Apostrophe redirects prefix-only paths (e.g. `/my-prefix`) to
    // the trailing-slash form (`/my-prefix/`) with a 301.  During
    // static builds Astro may request the base path without the slash,
    // causing aposPageFetch to receive HTML instead of JSON.
    // Ensure a trailing slash when the pathname is exactly the prefix.
    if (config.aposPrefix && pathname === config.aposPrefix) {
      pathname += '/';
    }

    const aposUrl = new URL(aposHost + pathname);
    aposUrl.search = url.search;

    // Headers that undici rejects unconditionally — strip them before
    // forwarding to the backend regardless of user configuration.
    // `Connection: Upgrade` and a bare `Upgrade` header both trigger
    // UND_ERR_INVALID_ARG in undici when passed through a proxy.
    const undiciRejectedHeaders = new Set([ 'connection', 'upgrade' ]);

    // Prepare headers, excluding any specified in config
    const requestHeaders = {};
    for (const [name, value] of req.headers) {
      const lower = name.toLowerCase();
      if (!excludedHeadersLower.has(lower) && !undiciRejectedHeaders.has(lower)) {
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

    // Statuses we forward with no body: 204/304 carry none, and for
    // redirects (301/302/307/308) Location + Set-Cookie are all the client
    // needs. Dump the undici body so its socket returns to the pool, and
    // strip the entity headers that described it - a stale Content-Length
    // would make the client wait for bytes that never arrive.
    if ([204, 304, 301, 302, 307, 308].includes(statusCode)) {
      await res.body.dump().catch(() => {});
      responseHeaders.delete('content-length');
      responseHeaders.delete('content-encoding');
      responseHeaders.delete('transfer-encoding');
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
          console.error(decompressError);
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
      console.error(bodyError);
      // If we can't process the body, fall back to the original response
      return new Response(res.body, { ...rest, status: statusCode, headers: responseHeaders });
    }
  } catch (error) {
    console.error(error);
    // Handle any unexpected errors
    return new Response(`Server error: ${error.message}`, { status: 500 });
  }
}
