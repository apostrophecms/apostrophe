const _ = require('lodash');
const qs = require('qs');
const tough = require('tough-cookie');
const escapeHost = require('../../../lib/escape-host.js');
const util = require('util');
const { PassThrough } = require('node:stream');

module.exports = {
  options: {
    alias: 'http',
    // 2 hour limit to process a "big upload,"
    // which could be something like an entire site
    // with its attachments
    bigUploadMaxSeconds: 2 * 60 * 60
  },
  init(self) {
    // Map friendly errors created via `apos.error` to status codes.
    //
    // Everything else comes through as a 500, you don't have to register that
    // one, and shouldn't because clients should never be given sensitive
    // details about 500 errors
    self.errors = {
      min: 400,
      max: 400,
      invalid: 400,
      forbidden: 403,
      notfound: 404,
      required: 422,
      conflict: 409,
      locked: 409,
      unprocessable: 422,
      unimplemented: 501
    };
    _.merge(self.errors, self.options.addErrors);
  },
  handlers(self) {
    // Wait for the db module to be ready
    return {
      'apostrophe:modulesRegistered': {
        setCollection() {
          self.bigUploads = self.apos.db.collection('aposBigUploads');
        }
      }
    };
  },
  methods(self) {
    return {
      // Add another friendly error name to http status code mapping so you
      // can throw `apos.error('name')` and get the status code `code`.
      // Not used in core at the time of writing, but available as part of the
      // API.
      addError(name, code) {
        self.errors[name] = code;
      },

      /**
       * Options accepted by the `apos.http.*` request methods. Any additional
       * properties are passed through to the built-in `fetch` as-is (e.g.
       * `redirect`, `signal`).
       *
       * @typedef {object} AposHttpOptions
       * @property {object} [qs] Query-string parameters, serialized with `qs`
       *   and appended to the URL.
       * @property {object} [jar] A cookie jar from `apos.http.jar()`. Its
       *   cookies are sent with the request, and any `Set-Cookie` in the
       *   response is stored back into the jar.
       * @property {'json'|'form'} [send] Force body encoding: `'json'` sends
       *   `body` JSON-encoded, `'form'` sends it URL-encoded.
       * @property {*} [body] Request body. A plain object or array is sent as
       *   JSON; a `FormData` (the global or a `form-data` instance) is sent as
       *   multipart; otherwise sent as-is. See `send` to force encoding.
       * @property {'json'} [parse] Always parse the response body as JSON.
       *   Without it, the body is parsed as JSON only when the response
       *   content-type is `application/json`.
       * @property {Object<string, string>} [headers] Request header names and
       *   values. Per the fetch standard a `Host` header cannot be set.
       * @property {boolean} [fullResponse] Resolve with `{ status, headers,
       *   body }` instead of the body alone. Header names are lowercased; a
       *   header seen multiple times is comma-joined.
       * @property {boolean} [originalResponse] Resolve with the raw built-in
       *   fetch `Response`. Its `body` is a WHATWG `ReadableStream` (use
       *   `Readable.fromWeb()` to consume it as a Node stream).
       * @property {number} [timeout] Per-request timeout in milliseconds,
       *   applied via `AbortSignal.timeout`. A falsy value means no timeout.
       * @property {AbortSignal} [signal] Abort signal; combined with `timeout`
       *   when both are given.
       * @property {object} [dispatcher] An undici `Dispatcher` (e.g. a proxy or
       *   custom-TLS agent). Replaces the former node-fetch `agent` option.
       */

      /**
       * Make a GET request and resolve with the response body.
       *
       * If the URL is site-relative (starts with `/`) it is requested from the
       * apostrophe site itself. Throws if the status code is >= 400; the error
       * resembles a `fullResponse` object with a `status` property.
       *
       * @param {string} url
       * @param {AposHttpOptions} [options]
       * @returns {Promise<*>} The response body, or a `fullResponse` /
       *   `originalResponse` object when those options are set.
       */
      async get(url, options) {
        return self.remote('GET', url, options);
      },

      /**
       * Make a HEAD request. Resolves with the (empty) response body; pass
       * `fullResponse: true` to read the `status` and `headers`.
       *
       * If the URL is site-relative (starts with `/`) it is requested from the
       * apostrophe site itself. Throws if the status code is >= 400.
       *
       * @param {string} url
       * @param {AposHttpOptions} [options]
       * @returns {Promise<*>}
       */
      async head(url, options) {
        return self.remote('HEAD', url, options);
      },

      /**
       * Send a POST request and resolve with the response body.
       *
       * If the URL is site-relative (starts with `/`) it is requested from the
       * apostrophe site itself. Throws if the status code is >= 400; the error
       * resembles a `fullResponse` object with a `status` property.
       *
       * @param {string} url
       * @param {AposHttpOptions} [options]
       * @returns {Promise<*>} The response body, or a `fullResponse` /
       *   `originalResponse` object when those options are set.
       */
      async post(url, options) {
        return self.remote('POST', url, options);
      },

      /**
       * Send a DELETE request and resolve with the response body.
       *
       * If the URL is site-relative (starts with `/`) it is requested from the
       * apostrophe site itself. Throws if the status code is >= 400; the error
       * resembles a `fullResponse` object with a `status` property.
       *
       * @param {string} url
       * @param {AposHttpOptions} [options]
       * @returns {Promise<*>} The response body, or a `fullResponse` /
       *   `originalResponse` object when those options are set.
       */
      async delete(url, options) {
        return self.remote('DELETE', url, options);
      },

      /**
       * Send a PUT request and resolve with the response body.
       *
       * If the URL is site-relative (starts with `/`) it is requested from the
       * apostrophe site itself. Throws if the status code is >= 400; the error
       * resembles a `fullResponse` object with a `status` property.
       *
       * @param {string} url
       * @param {AposHttpOptions} [options]
       * @returns {Promise<*>} The response body, or a `fullResponse` /
       *   `originalResponse` object when those options are set.
       */
      async put(url, options) {
        return self.remote('PUT', url, options);
      },

      /**
       * Send a PATCH request and resolve with the response body.
       *
       * If the URL is site-relative (starts with `/`) it is requested from the
       * apostrophe site itself. Throws if the status code is >= 400; the error
       * resembles a `fullResponse` object with a `status` property.
       *
       * @param {string} url
       * @param {AposHttpOptions} [options]
       * @returns {Promise<*>} The response body, or a `fullResponse` /
       *   `originalResponse` object when those options are set.
       */
      async patch(url, options) {
        return self.remote('PATCH', url, options);
      },

      /**
       * Invoke a remote HTTP API with the given method. The implementation
       * behind `get`, `post`, `put`, `patch`, `delete` and `head` — prefer
       * those.
       *
       * If the URL is site-relative (starts with `/`) it is requested from the
       * apostrophe site itself. Throws if the status code is >= 400; the error
       * resembles a `fullResponse` object with a `status` property.
       *
       * @param {string} method HTTP method, e.g. `'GET'`.
       * @param {string} url
       * @param {AposHttpOptions} [options]
       * @returns {Promise<*>} The response body, or a `fullResponse` /
       *   `originalResponse` object when those options are set.
       */
      async remote(method, url, options) {
        let awaitedBody = false;
        if (!options) {
          options = {};
        }
        options = {
          ...options,
          method
        };
        // `agent` was a node-fetch option with no equivalent in the built-in
        // fetch: an http.Agent is not an undici Dispatcher. Fail loudly rather
        // than silently ignore a proxy/TLS/keep-alive intention. Power users
        // can pass an undici `dispatcher` instead, which fetch accepts as-is.
        if (options.agent) {
          throw new Error('apos.http no longer supports the `agent` option (the built-in fetch has no equivalent). Pass an undici `dispatcher` instead.');
        }
        // `timeout` was a node-fetch option; the built-in fetch uses an
        // AbortSignal. Translate it to preserve the behavior, combining it with
        // any caller-supplied signal. As with node-fetch, a falsy timeout (0,
        // undefined) means "no timeout".
        if (options.timeout) {
          const timeoutSignal = AbortSignal.timeout(options.timeout);
          options.signal = options.signal
            ? AbortSignal.any([ options.signal, timeoutSignal ])
            : timeoutSignal;
          delete options.timeout;
        }
        if (url.match(/^\//)) {
          url = `${self.getBase()}${url}`;
        }
        if (options.qs) {
          url += `?${qs.stringify(options.qs)}`;
        }
        if (options.jar) {
          let cookies = options.jar.getCookiesSync(url);
          cookies = cookies || [];
          options.headers = options.headers || {};
          options.headers.cookie = cookies.join('; ');
        }
        if (
          options.body &&
          (typeof options.body.getHeaders === 'function') &&
          (typeof options.body.pipe === 'function')
        ) {
          // A `form-data` package instance. The built-in fetch does not
          // recognize it (passed directly it is coerced to a useless string
          // body), so we adapt it ourselves: take its multipart Content-Type
          // (with boundary) from getHeaders(), set Content-Length so multiparty
          // can parse it, and stream it through a PassThrough, which the
          // built-in fetch does accept as a request body.
          const form = options.body;
          const contentLength = await util.promisify((callback) => {
            return form.getLength(callback);
          })();
          options.headers = {
            ...form.getHeaders(),
            ...options.headers,
            'Content-Length': contentLength
          };
          const pass = new PassThrough();
          form.pipe(pass);
          options.body = pass;
          // Required by the built-in fetch when the body is a stream.
          options.duplex = 'half';
        } else if (options.body instanceof FormData) {
          // A native (WHATWG) FormData: the built-in fetch sets the multipart
          // Content-Type (with boundary) and streams it. Nothing to do here,
          // and we must not fall through to the JSON branch below.
        } else if (((options.body != null) && ((typeof options.body) === 'object')) || (options.send === 'json')) {
          options.body = JSON.stringify(options.body);
          options.headers = options.headers || {};
          options.headers['Content-Type'] = 'application/json';
        } else if ((options.body !== null) && (options.send === 'form')) {
          options.body = qs.stringify(options.body);
          options.headers = options.headers || {};
          options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        const res = await fetch(url, options);
        let body;
        if (options.jar) {
          // getSetCookie() returns each Set-Cookie value separately; browsers
          // limit what JS can see about this header
          res.headers.getSetCookie().forEach(cookie => {
            options.jar.setCookieSync(cookie, url);
          });
        }
        if (options.originalResponse) {
          return res;
        }
        awaitedBody = true;
        body = await getBody();
        if (res.status >= 400) {
          if (!awaitedBody) {
            body = await getBody();
          }
          const error = new Error(`HTTP error ${res.status}`);
          Object.assign(error, fullResponse());
          throw error;
        }
        if (options.fullResponse) {
          return fullResponse();
        }
        return body;
        function fullResponse() {
          const headers = {};
          res.headers.forEach((value, name) => {
            // Optional support for fetching arrays of headers with the same
            // name could be added at a later time if anyone really cares.
            // Usually just a source of bugs
            headers[name] = value;
          });
          // node-fetch resolved a redirect's Location to an absolute URL; the
          // built-in fetch returns it as sent (often relative). Resolve it
          // against the request URL to preserve the absolute form callers expect.
          if ((res.status >= 300) && (res.status < 400) && headers.location) {
            headers.location = new URL(headers.location, url).href;
          }
          return {
            status: res.status,
            headers,
            body
          };
        }
        async function getBody() {
          let result = await res.text();
          const contentType = (res.headers.get('content-type') || '').replace(/;.*$/, '');
          if ((contentType === 'application/json') || (options.parse === 'json')) {
            result = JSON.parse(result);
          }
          return result;
        }
      },

      // Returns a cookie jar compatible
      // with the `jar` option to `get`, `post`, etc. and
      // the `getCookie` method (below). The use of other cookie
      // stores is not recommended.

      jar() {
        return new tough.CookieJar();
      },

      // Given a cookie jar received from `apos.http.jar()` and a context URL,
      // return the current value for the given cookie name, or undefined if
      // there is none set

      getCookie(jar, url, name) {
        if (url.match(/^\//)) {
          url = `${self.getBase()}${url}`;
        }
        const cookies = jar.getCookiesSync(url);
        for (const cookie of cookies) {
          if (cookie.key === name) {
            return cookie.value;
          }
        }
      },

      getBase() {
        const server = self.apos.modules['@apostrophecms/express'].server;
        return `http://${escapeHost(server.address().address)}:${server.address().port}`;
      },

      ...require('./lib/big-upload-middleware.js')(self)
    };
  }
};
