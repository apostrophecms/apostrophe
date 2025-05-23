const _ = require('lodash');
const qs = require('qs');
const fetch = require('node-fetch');
const tough = require('tough-cookie');
const escapeHost = require('../../../lib/escape-host');
const util = require('util');

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

      // Fetch the given URL and return the response body. Accepts the
      // following options:
      //
      // `qs` (builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.jar())
      // `parse` (can be 'json` to always parse the response body as JSON,
      // otherwise the response body is parsed as JSON only if the content-type
      // is application/json) `headers` (an object containing header names and
      // values) `fullResponse` (if true, return an object with `status`,
      // `headers` and `body` properties, rather than returning the body
      // directly; the individual `headers` are canonicalized to lowercase
      // names. If a header appears multiple times an array is returned for it)
      //
      // If the status code is >= 400 an error is thrown. The error object will
      // be similar to a `fullResponse` object, with a `status` property.
      //
      // If the URL is site-relative (starts with /) it will be requested from
      // the apostrophe site itself.

      async get(url, options) {
        return self.remote('GET', url, options);
      },

      // Make a HEAD request for the given URL and return the response object,
      // which will include a `status` property as well as `headers`.
      //
      // Options:
      //
      // `qs` (builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.jar())
      // `headers` (an object containing header names and values)
      //
      // If the status code is >= 400 an error is thrown. The error object
      // will have a `status` property.
      //
      // If the URL is site-relative (starts with /) it will be requested from
      // the apostrophe site itself.

      async head(url, options) {
        return self.remote('HEAD', url, options);
      },

      // Send a POST request to the given URL and return the response body.
      // Accepts the following options:
      //
      // `qs` (pass object; builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.jar())
      // `send` (can be 'json' to always send `options.body` JSON encoded, or
      // 'form' to send it URL-encoded) `body` (request body; if an object or
      // array, sent as JSON, otherwise sent as-is, unless the `send` option is
      // set) `parse` (can be 'json` to always parse the response body as JSON,
      // otherwise the response body is parsed as JSON only if the content-type
      // is application/json) `headers` (an object containing header names and
      // values) `fullResponse` (if true, return an object with `status`,
      // `headers` and `body` properties, rather than returning the body
      // directly; the individual `headers` are canonicalized to lowercase
      // names. If a header appears multiple times an array is returned for it)
      //
      // If the status code is >= 400 an error is thrown. The error object will
      // be similar to a `fullResponse` object, with a `status` property.
      //
      // If the URL is site-relative (starts with /) it will be requested from
      // the apostrophe site itself.

      async post(url, options) {
        return self.remote('POST', url, options);
      },

      // Send a DELETE request to the given URL and return the response body.
      // Accepts the following options:
      //
      // `qs` (pass object; builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.jar())
      // `send` (can be 'json' to always send `options.body` JSON encoded, or
      // 'form' to send it URL-encoded) `body` (request body; if an object or
      // array, sent as JSON, otherwise sent as-is, unless the `send` option is
      // set) `parse` (can be 'json` to always parse the response body as JSON,
      // otherwise the response body is parsed as JSON only if the content-type
      // is application/json) `headers` (an object containing header names and
      // values) `fullResponse` (if true, return an object with `status`,
      // `headers` and `body` properties, rather than returning the body
      // directly; the individual `headers` are canonicalized to lowercase
      // names. If a header appears multiple times an array is returned for it)
      //
      // If the status code is >= 400 an error is thrown. The error object will
      // be similar to a `fullResponse` object, with a `status` property.
      //
      // If the URL is site-relative (starts with /) it will be requested from
      // the apostrophe site itself.

      async delete(url, options) {
        return self.remote('DELETE', url, options);
      },

      // Send a PUT request to the given URL and return the response body.
      // Accepts the following options:
      //
      // `qs` (pass object; builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.jar())
      // `send` (can be 'json' to always send `options.body` JSON encoded, or
      // 'form' to send it URL-encoded) `body` (request body; if an object or
      // array, sent as JSON, otherwise sent as-is, unless the `send` option is
      // set) `parse` (can be 'json` to always parse the response body as JSON,
      // otherwise the response body is parsed as JSON only if the content-type
      // is application/json) `headers` (an object containing header names and
      // values) `fullResponse` (if true, return an object with `status`,
      // `headers` and `body` properties, rather than returning the body
      // directly; the individual `headers` are canonicalized to lowercase
      // names. If a header appears multiple times an array is returned for it)
      //
      // If the status code is >= 400 an error is thrown. The error object will
      // be similar to a `fullResponse` object, with a `status` property.
      //
      // If the URL is site-relative (starts with /) it will be requested from
      // the apostrophe site itself.

      async put(url, options) {
        return self.remote('PUT', url, options);
      },

      // Send a PATCH request to the given URL and return the response body.
      // Accepts the following options:
      //
      // `qs` (pass object; builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.jar())
      // `send` (can be 'json' to always send `options.body` JSON encoded, or
      // 'form' to send it URL-encoded) `body` (request body; if an object or
      // array, sent as JSON, otherwise sent as-is, unless the `send` option is
      // set) `parse` (can be 'json` to always parse the response body as JSON,
      // otherwise the response body is parsed as JSON only if the content-type
      // is application/json) `headers` (an object containing header names and
      // values) `fullResponse` (if true, return an object with `status`,
      // `headers` and `body` properties, rather than returning the body
      // directly; the individual `headers` are canonicalized to lowercase
      // names. If a header appears multiple times an array is returned for it)
      // `originalResponse` (if true, return the response object exactly as it
      // is returned by node-fetch)
      //
      // If the status code is >= 400 an error is thrown. The error object will
      // be similar to a `fullResponse` object, with a `status` property.
      //
      // If the URL is site-relative (starts with /) it will be requested from
      // the apostrophe site itself.

      async patch(url, options) {
        return self.remote('PATCH', url, options);
      },

      // Invoke a remote HTTP API with the named method. Use .get, .post, etc.
      // This is an implementation method invoked by these
      //
      // If the URL is site-relative (starts with /) it will be requested from
      // the apostrophe site itself.

      async remote(method, url, options) {
        let awaitedBody = false;
        if (!options) {
          options = {};
        }
        options = {
          ...options,
          method
        };
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
        if (options.body && options.body.constructor && (options.body.constructor.name === 'FormData')) {
          // If we don't do this multiparty will not parse it properly
          const contentLength = await util.promisify((callback) => {
            return options.body.getLength(callback);
          })();
          options.headers = options.headers || {};
          options.headers['Content-Length'] = contentLength;
          // node-fetch will set the Content-Type
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
          // This is node-fetch specific, browsers limit what JS can see about
          // this header
          (res.headers.raw()['set-cookie'] || []).forEach(cookie => {
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
