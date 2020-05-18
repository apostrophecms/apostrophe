const _ = require('lodash');
const qs = require('qs');
const fetch = require('node-fetch');
const tough = require('tough-cookie');

module.exports = {
  options: {
    alias: 'http'
  },
  init(self, options) {
    // Map friendly errors created via `apos.error` to status codes.
    //
    // Everything else comes through as a 500, you don't have to register that one, and
    // shouldn't because clients should never be given sensitive details about 500 errors
    self.errors = {
      'invalid': 400,
      'forbidden': 403,
      'notfound': 404,
      'required': 422,
      'conflict': 409,
      'locked': 409,
      'unprocessable': 422,
      'unimplemented': 501
    };
    _.merge(self.errors, self.options.addErrors);
  },
  methods(self, options) {
    return {
      // Add another friendly error name to http status code mapping so you
      // can throw `apos.error('name')` and get the status code `code`
      addError(name, code) {
        self.errors[name] = code;
      },

      // Fetch the given URL and return the response body. Accepts the following options:
      //
      // `qs` (builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.jar())
      // `parse` (can be 'json` to always parse the response body as JSON, otherwise the response body is
      // parsed as JSON only if the content-type is application/json)
      // `headers` (an object containing header names and values)
      // `fullResponse` (if true, return an object with `status`, `headers` and `body`
      // properties, rather than returning the body directly; the individual `headers` are canonicalized
      // to lowercase names. If a header appears multiple times an array is returned for it)
      //
      // If the status code is >= 400 an error is thrown. The error object will be
      // similar to a `fullResponse` object, with a `status` property.
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

      // Send a POST request to the given URL and return the response body. Accepts the following options:
      //
      // `qs` (pass object; builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.jar())
      // `send` (can be 'json' to always send `options.body` JSON encoded, or 'form' to send it URL-encoded)
      // `body` (request body; if an object or array, sent as JSON, otherwise sent as-is, unless
      // the `send` option is set)
      // `parse` (can be 'json` to always parse the response body as JSON, otherwise the response body is
      // parsed as JSON only if the content-type is application/json)
      // `headers` (an object containing header names and values)
      // `csrf` (if true, which is the default, and the `jar` contains the CSRF cookie for this Apostrophe site
      // due to a previous GET request, send it as the X-XSRF-TOKEN header; if a string, send the current value of the cookie of that name
      // in the `jar` as the X-XSRF-TOKEN header; if false, disable this feature)
      // `fullResponse` (if true, return an object with `status`, `headers` and `body`
      // properties, rather than returning the body directly; the individual `headers` are canonicalized
      // to lowercase names. If a header appears multiple times an array is returned for it)
      //
      // If the status code is >= 400 an error is thrown. The error object will be
      // similar to a `fullResponse` object, with a `status` property.
      //
      // If the URL is site-relative (starts with /) it will be requested from
      // the apostrophe site itself.

      async post(url, options) {
        return self.remote('POST', url, options);
      },

      // Send a DELETE request to the given URL and return the response body. Accepts the following options:
      //
      // `qs` (pass object; builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.jar())
      // `send` (can be 'json' to always send `options.body` JSON encoded, or 'form' to send it URL-encoded)
      // `body` (request body; if an object or array, sent as JSON, otherwise sent as-is, unless
      // the `send` option is set)
      // `parse` (can be 'json` to always parse the response body as JSON, otherwise the response body is
      // parsed as JSON only if the content-type is application/json)
      // `headers` (an object containing header names and values)
      // `csrf` (if true, which is the default, and the `jar` contains the CSRF cookie for this Apostrophe site
      // due to a previous GET request, send it as the X-XSRF-TOKEN header; if a string, send the current value of the cookie of that name
      // in the `jar` as the X-XSRF-TOKEN header; if false, disable this feature)
      // `fullResponse` (if true, return an object with `status`, `headers` and `body`
      // properties, rather than returning the body directly; the individual `headers` are canonicalized
      // to lowercase names. If a header appears multiple times an array is returned for it)
      //
      // If the status code is >= 400 an error is thrown. The error object will be
      // similar to a `fullResponse` object, with a `status` property.
      //
      // If the URL is site-relative (starts with /) it will be requested from
      // the apostrophe site itself.

      async delete(url, options) {
        return self.remote('DELETE', url, options);
      },

      // Send a PUT request to the given URL and return the response body. Accepts the following options:
      //
      // `qs` (pass object; builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.jar())
      // `send` (can be 'json' to always send `options.body` JSON encoded, or 'form' to send it URL-encoded)
      // `body` (request body; if an object or array, sent as JSON, otherwise sent as-is, unless
      // the `send` option is set)
      // `parse` (can be 'json` to always parse the response body as JSON, otherwise the response body is
      // parsed as JSON only if the content-type is application/json)
      // `headers` (an object containing header names and values)
      // `csrf` (if true, which is the default, and the `jar` contains the CSRF cookie for this Apostrophe site
      // due to a previous GET request, send it as the X-XSRF-TOKEN header; if a string, send the current value of the cookie of that name
      // in the `jar` as the X-XSRF-TOKEN header; if false, disable this feature)
      // `fullResponse` (if true, return an object with `status`, `headers` and `body`
      // properties, rather than returning the body directly; the individual `headers` are canonicalized
      // to lowercase names. If a header appears multiple times an array is returned for it)
      //
      // If the status code is >= 400 an error is thrown. The error object will be
      // similar to a `fullResponse` object, with a `status` property.
      //
      // If the URL is site-relative (starts with /) it will be requested from
      // the apostrophe site itself.

      async put(url, options) {
        return self.remote('PUT', url, options);
      },

      // Send a PATCH request to the given URL and return the response body. Accepts the following options:
      //
      // `qs` (pass object; builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.jar())
      // `send` (can be 'json' to always send `options.body` JSON encoded, or 'form' to send it URL-encoded)
      // `body` (request body; if an object or array, sent as JSON, otherwise sent as-is, unless
      // the `send` option is set)
      // `parse` (can be 'json` to always parse the response body as JSON, otherwise the response body is
      // parsed as JSON only if the content-type is application/json)
      // `headers` (an object containing header names and values)
      // `csrf` (if true, which is the default, and the `jar` contains the CSRF cookie for this Apostrophe site
      // due to a previous GET request, send it as the X-XSRF-TOKEN header; if a string, send the current value of the cookie of that name
      // in the `jar` as the X-XSRF-TOKEN header; if false, disable this feature)
      // `fullResponse` (if true, return an object with `status`, `headers` and `body`
      // properties, rather than returning the body directly; the individual `headers` are canonicalized
      // to lowercase names. If a header appears multiple times an array is returned for it)
      //
      // If the status code is >= 400 an error is thrown. The error object will be
      // similar to a `fullResponse` object, with a `status` property.
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
        if (((options.body != null) && ((typeof options.body) === 'object')) || (options.send === 'json')) {
          options.body = JSON.stringify(options.body);
          options.headers = options.headers || {};
          options.headers['Content-Type'] = 'application/json';
        } else if ((options.body !== null) && (options.send === 'form')) {
          options.body = qs.stringify(options.body);
          options.headers = options.headers || {};
          options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        if ((options.csrf !== false) && options.jar) {
          options.headers = options.headers || {};
          const cookieName = ((typeof options.csrf) === 'string') ? options.csrf : self.apos.csrfCookieName;
          const cookieValue = self.getCookie(options.jar, url, cookieName);
          if (cookieValue != null) {
            options.headers['x-xsrf-token'] = cookieValue;
          }
        }
        const res = await fetch(url, options);
        let body;
        if (options.jar) {
          // This is node-fetch specific, browsers limit what JS can see about this header
          (res.headers.raw()['set-cookie'] || []).forEach(cookie => {
            options.jar.setCookieSync(cookie, url);
          });
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
            if (!_.has(headers, name)) {
              headers[name] = value;
            } else if (Array.isArray(headers[name])) {
              headers[name].push(value);
            } else {
              headers[name] = value;
            }
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

      // Given a cookie jar received from `apos.http.jar()` and a context URL, return the current value for
      // the given cookie name, or undefined if there is none set

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
        return `http://${server.address().address}:${server.address().port}`;
      }

    };
  }
};
