import config from 'apostrophe-astro-config/config';

// Astro v6 instruments Astro.request on prerendered pages by replacing the
// `headers` property with an own getter via Object.defineProperty. Calling
// that getter logs a warning. We detect this by inspecting the descriptor
// rather than reading the value, so no warning is triggered.
function isAstroPrerenderedRequest(req) {
  if (!req || typeof req === 'string') return false;
  const desc = Object.getOwnPropertyDescriptor(req, 'headers');
  return desc != null && typeof desc.get === 'function';
}

export { isAstroPrerenderedRequest };

export default function(req) {
  const key = process.env.APOS_EXTERNAL_FRONT_KEY;
  if (!key) {
    throw new Error('APOS_EXTERNAL_FRONT_KEY environment variable must be set,\nhere and in the Apostrophe app');
  }

  // Primary detection: inspect the request object directly. Astro v6 installs
  // an own getter on Astro.request.headers for prerendered pages; a plain
  // Request has headers on the prototype only. This is more reliable than
  // env-var or config detection which can fail across Vite environments.
  const isStaticBuild = isAstroPrerenderedRequest(req)
    || process.env.APOS_ASTRO_STATIC_BUILD === '1'
    || Boolean(config.staticBuild);

  let request;
  if (isStaticBuild) {
    // Static build: only use the URL — user headers are irrelevant for
    // build-time server-to-server fetches and accessing req.headers on
    // Astro.request during prerendering triggers a warning in Astro v6.
    const url = typeof req === 'string' ? req : req.url;
    request = new Request(url, {
      headers: {
        'x-requested-with': 'AposExternalFront',
        'apos-external-front-key': key,
        'x-apos-static-base-url': '1'
      }
    });
  } else {
    // SSR: clone the incoming request so user headers (cookies, locale, etc.)
    // are forwarded to the Apostrophe backend.
    request = new Request(req);
    request.headers.set('x-requested-with', 'AposExternalFront');
    request.headers.set('apos-external-front-key', key);
  }

  return request;
}
