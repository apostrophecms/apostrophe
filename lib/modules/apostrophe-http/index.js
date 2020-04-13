const _ = require('lodash');
const qs = require('qs');
const fetch = require('node-fetch');
const tough = require('tough-cookie');

module.exports = {
  options: {
    alias: 'http'
  },
  init(self, options) {
    self.errors = {
      'invalid': 400,
      'forbidden': 403,
      'notfound': 404,
      'required': 422,
      'conflict': 409,
      'locked': 409,
      'unprocessable': 422
    };
    _.merge(self.errors, self.options.addErrors);
  },
  methods(self, options) {
    return {
      // Add another error name to http status code mapping so you
      // can throw `name` and get the status code `code`
      addError(name, code) {
        self.errors[name] = code;
      },
      // Returns an object you can `throw` to respond with the http
      // status code associated with `name`, and the JSON-friendly
      // object `data` as a response body
      error(name, data) {
        if (!data) {
          return name;
        }
        return {
          type: 'apostrophe-http-error',
          name: name,
          data: data
        };
      },

      // Fetch the given URL and return the response body. Accepts the following options:
      //
      // `qs` (builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.jar())
      // `parse` (can be 'json` to parse the response as JSON)
      // `headers` (an object containing header names and values)
      // `fullResponse` (if true, return an object with `status`, `headers` and `body`
      // properties, rather than returning the body directly; body is still a parsed
      // object if `json: true` was provided. The individual `headers` are canonicalized
      // to lowercase names. If a header appears multiple times an array is returned for it)
      //
      // If the status code is >= 400 an error is thrown. The error object will be
      // similar to a `fullResponse` object, with a `status` property.

      async get(url, options) {
        return self.remote('GET', url, options);
      },

      // Send a POST request to the given URL and return the response body. Accepts the following options:
      //
      // `qs` (pass object; builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.jar())
      // `send` (can be 'json' to send the `body` option JSON encoded, or 'form' to send it URL-encoded)
      // `body` (request body; sent raw unless `send` is set to 'json' or 'form')
      // `parse` (can be 'json` to parse the response body as JSON)
      // `headers` (an object containing header names and values)
      // `data` (the request body, sent raw unless `send` is set to 'json' or 'form')
      // `form` (send this object as a form body, stringified by qs, i.e. old school form submission)
      // `csrf` (submit Apostrophe's X-XSRF-TOKEN header based on the value of the appropriate cookie;
      //   requires a `jar` shared with a previous `get` request)
      // `fullResponse` (if true, return an object with `status`, `headers` and `body`
      // properties, rather than returning the body directly; body is still a parsed
      // object if `json` was truthy; the individual `headers` are canonicalized
      // to lowercase names. If a header appears multiple times an array is returned for it)
      //
      // If the status code is >= 400 an error is thrown. The error object will be
      // similar to a `fullResponse` object, with a `status` property.

      async post(url, options) {
        return self.remote('POST', url, options);
      },

      // Send a DELETE request to the given URL and return the response body. Accepts the following options:
      //
      // `qs` (pass object; builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.jar())
      // `send` (can be 'json' to send the `body` option JSON encoded, or 'form' to send it URL-encoded)
      // `body` (request body; sent raw unless `send` is set to 'json' or 'form')
      // `parse` (can be 'json` to parse the response body as JSON)
      // `headers` (an object containing header names and values)
      // `form` (send this object as a form body, stringified by qs, i.e. old school form submission)
      // `csrf` (submit Apostrophe's X-XSRF-TOKEN header based on the value of the appropriate cookie;
      //   requires a `jar` shared with a previous `get` request)
      // `fullResponse` (if true, return an object with `status`, `headers` and `body`
      // properties, rather than returning the body directly; body is still a parsed
      // object if `json` was truthy; the individual `headers` are canonicalized
      // to lowercase names. If a header appears multiple times an array is returned for it)
      //
      // If the status code is >= 400 an error is thrown. The error object will be
      // similar to a `fullResponse` object, with a `status` property.

      async delete(url, options) {
        return self.remote('DELETE', url, options);
      },

      // Send a PUT request to the given URL and return the response body. Accepts the following options:
      //
      // `qs` (pass object; builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.jar())
      // `send` (can be 'json' to send the `body` option JSON encoded, or 'form' to send it URL-encoded)
      // `body` (request body; sent raw unless `send` is set to 'json' or 'form')
      // `parse` (can be 'json` to parse the response body as JSON)
      // `headers` (an object containing header names and values)
      // `form` (send this object as a form body, stringified by qs, i.e. old school form submission)
      // `csrf` (submit Apostrophe's X-XSRF-TOKEN header based on the value of the appropriate cookie;
      // requires a `jar` shared with a previous `get` request)
      // `fullResponse` (if true, return an object with `status`, `headers` and `body`
      // properties, rather than returning the body directly; body is still a parsed
      // object if `json` was truthy; the individual `headers` are canonicalized
      // to lowercase names. If a header appears multiple times an array is returned for it)
      //
      // If the status code is >= 400 an error is thrown. The error object will be
      // similar to a `fullResponse` object, with a `status` property.

      async put(url, options) {
        return self.remote('PUT', url, options);
      },

      // Send a PATCH request to the given URL and return the response body. Accepts the following options:
      //
      // `qs` (pass object; builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.jar())
      // `send` (can be 'json' to send the `data` option JSON encoded, or 'form' to send it form URL-encoded)
      // `body` (request body; sent raw unless `send` is set to 'json' or 'form')
      // `parse` (can be 'json` to parse the response as JSON)
      // `headers` (an object containing header names and values)
      // `form` (send this object as a form body, stringified by qs, i.e. old school form submission)
      // `csrf` (submit Apostrophe's X-XSRF-TOKEN header based on the value of the appropriate cookie;
      // requires a `jar` shared with a previous `get` request)
      // `fullResponse` (if true, return an object with `status`, `headers` and `body`
      // properties, rather than returning the body directly; body is still a parsed
      // object if `json` was truthy; the individual `headers` are canonicalized
      // to lowercase names. If a header appears multiple times an array is returned for it)
      //
      // If the status code is >= 400 an error is thrown. The error object will be
      // similar to a `fullResponse` object, with a `status` property.

      async patch(url, options) {
        return self.remote('PATCH', url, options);
      },

      // Invoke a remote HTTP API with the named method. Use .get, .post, etc.
      // This is an implementation method invoked by these

      async remote(method, url, options) {
        let awaitedBody = false;
        if (!options) {
          options = {};
        }
        options = {
          ...options,
          method
        };
        if (options.qs) {
          url += `?${qs.stringify(options.qs)}`;
        }
        if (options.jar) {
          let cookies = options.jar.getCookiesSync(url);
          cookies = cookies || [];
          options.headers = options.headers || {};
          options.headers.cookie = cookies.join('; ');
        }
        if (options.send === 'json') {
          if (method !== 'GET') {
            options.body = JSON.stringify(options.body);
            options.headers = options.headers || {};
            options.headers['Content-Type'] = 'application/json';
          }
        } else if (options.send === 'form') {
          options.body = qs.stringify(options.body);
          options.headers = options.headers || {};
          options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        if (options.csrf) {
          options.headers = options.headers || {};
          options.headers['x-xsrf-token'] = self.getCookie(options.jar, url, self.apos.csrfCookieName);
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
        try {
          body = await getBody();
        } catch (e) {
          console.log('>>', method, res);
          throw e;
        }
        if (res.status >= 400) {
          if (!awaitedBody) {
            body = await getBody();
          }
          const error = new Error(`HTTP error ${res.status}`);
          Object.assign(error, fullResponse());
          throw fullResponse();
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
          if (options.parse === 'json') {
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

      // Given a tough-cookie jar and a context URL, return the current value for the
      // given cookie name, or undefined if there is none set

      getCookie(jar, url, name) {
        const cookies = jar.getCookiesSync(url);
        for (const cookie of cookies) {
          if (cookie.key === name) {
            return cookie.value;
          }
        }
      }

    };
  }
};  
