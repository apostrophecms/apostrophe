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
      // `jar` (pass in a cookie jar obtained from apos.http.getCookieJar())
      // `json` (if true, return parsed JSON data rather than raw response body)
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
      // `qs` (builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.getCookieJar())
      // `json` (send this object as a JSON request body; also parse the response as JSON)
      // `headers` (an object containing header names and values)
      // `form` (send this object as a form body, stringified by qs, i.e. old school form submission)
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
      // `qs` (builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.getCookieJar())
      // `json` (send this object as a JSON request body; also parse the response as JSON)
      // `headers` (an object containing header names and values)
      // `form` (send this object as a form body, stringified by qs, i.e. old school form submission)
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
      // `qs` (builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.getCookieJar())
      // `json` (send this object as a JSON request body; also parse the response as JSON)
      // `headers` (an object containing header names and values)
      // `form` (send this object as a form body, stringified by qs, i.e. old school form submission)
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
      // `qs` (builds a query string with qs)
      // `jar` (pass in a cookie jar obtained from apos.http.getCookieJar())
      // `json` (send this object as a JSON request body; also parse the response as JSON)
      // `headers` (an object containing header names and values)
      // `form` (send this object as a form body, stringified by qs, i.e. old school form submission)
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
      // This is an implementation method for adding support for more

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
        if (options.json) {
          if (method !== 'GET') {
            options.body = JSON.stringify(options.json);
            options.headers = options.headers || {};
            options.headers['Content-Type'] = 'application/json';
          }
        }
        if (options.form) {
          options.body = JSON.stringify(options.form);
          options.headers = options.headers || {};
          options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
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
          if (options.json) {
            return res.json();
          } else {
            return res.text();
          }
        }        
      },

      // Returns a simple tough-cookie jar compatible
      // with the `jar` option to `get`, `post`, etc. and
      // the `getCookie` method. The use of other cookie
      // stores is not recommended.
      getCookieJar() {
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
