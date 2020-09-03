// Adds the apos.http client, which has the same API
// as the server-side apos.http client, although it may
// not have exactly the same features available.
// This is a lean, IE11-friendly implementation.

(function() {
  var busyActive = {};
  var apos = window.apos;
  apos.http = {};

  // Send a POST request. Note that POST body data should be in
  // `options.body`. See `apos.http.remote` for details.
  // You do NOT have to pass a callback unless you must support IE11
  // and do not want to include a promise polyfill in your build.
  apos.http.post = function(url, options, callback) {
    return apos.http.remote('POST', url, options, callback);
  };

  // Send a GET request. Note that query string data may be in
  // `options.qs`. See `apos.http.remote` for details.
  // You do NOT have to pass a callback unless you must support IE11
  // and do not want to include a promise polyfill in your build.
  apos.http.get = function(url, options, callback) {
    return apos.http.remote('GET', url, options, callback);
  };

  // Send a PATCH request. Note that PATCH body data should be in
  // `options.body`. See `apos.http.remote` for details.
  // You do NOT have to pass a callback unless you must support IE11
  // and do not want to include a promise polyfill in your build.
  apos.http.patch = function(url, options, callback) {
    return apos.http.remote('PATCH', url, options, callback);
  };

  // Send a PUT request. Note that PUT body data should be in
  // `options.body`. See `apos.http.remote` for details.
  // You do NOT have to pass a callback unless you must support IE11
  // and do not want to include a promise polyfill in your build.
  apos.http.put = function(url, options, callback) {
    return apos.http.remote('PUT', url, options, callback);
  };

  // Send a DELETE request. See `apos.http.remote` for details.
  // You do NOT have to pass a callback unless you must support IE11
  // and do not want to include a promise polyfill in your build.
  apos.http.delete = function(url, options, callback) {
    return apos.http.remote('DELETE', url, options, callback);
  };

  // Send an HTTP request with the given method to the given URL and return the response body.
  //
  // The callback is optional as long as Promise support is present in the browser, directly or as
  // a polyfill. If a callback is used it will receive `(err, result)` where `result` is the
  // return value described below.
  //
  // Accepts the following options:
  //
  // `qs` (pass object; builds a query string, does not support recursion)
  // `send`: by default, `options.body` is sent as JSON if it is an object and it is not a
  // `FormData` object. If `send` is set to `json`, it is always sent as JSON.
  // `body` (request body, not for GET; if an object or array, sent as JSON, otherwise sent as-is, unless
  // the `send` option is set)
  // `parse` (can be 'json` to always parse the response body as JSON, otherwise the response body is
  // parsed as JSON only if the content-type is application/json)
  // `headers` (an object containing header names and values)
  // `csrf` (unless explicitly set to `false`, send the X-XSRF-TOKEN header when talking to the same site)
  // `fullResponse` (if true, return an object with `status`, `headers` and `body`
  // properties, rather than returning the body directly; the individual `headers` are canonicalized
  // to lowercase names. If there are duplicate headers after canonicalization only the
  // last value is returned.
  //
  // `If a header appears multiple times an array is returned for it)
  //
  // If the status code is >= 400 an error is thrown. The error object will be
  // similar to a `fullResponse` object, with a `status` property.
  //
  // If the URL is site-relative (starts with /) it will be requested from
  // the apostrophe site itself.

  // Just before the XMLHTTPRequest is sent this method emits an
  // `apos-before-post` event on `document.body` (where `post` changes
  // to match the method, in lower case). The event object
  // has `uri`, `data` and `request` properties. `request` is the
  // XMLHTTPRequest object. You can use this to set custom headers
  // on all lean requests, etc.

  apos.http.remote = function(method, url, options, callback) {
    if (!callback) {
      if (!window.Promise) {
        throw new Error('If you wish to receive a promise from apos.http methods in older browsers you must have a Promise polyfill. If you do not want to provide one, pass a callback instead.');
      }
      return new window.Promise(function(resolve, reject) {
        return apos.http.remote(method, url, options, function(err, result) {
          if (err) {
            return reject(err);
          }
          return resolve(result);
        });
      });
    }
    if (apos.prefix) {
      if (apos.util.sameSite(url)) {
        url = apos.prefix + url;
      }
    }

    var busyName = options.busy === true ? 'busy' : options.busy;
    var xmlhttp = new XMLHttpRequest();
    var csrfToken = apos.csrfCookieName ? apos.util.getCookie(apos.csrfCookieName) : 'csrf-fallback';
    var data = options.body;
    var keys;
    var i;
    if (options.qs) {
      url = apos.http.addQueryToUrl(url, options.qs);
    }

    xmlhttp.open(method, url);
    var formData = window.FormData && (data instanceof window.FormData);
    var sendJson = (options.send === 'json') || (options.body && ((typeof options.body) === 'object') && !formData);
    if (sendJson) {
      xmlhttp.setRequestHeader('Content-Type', 'application/json');
    }
    if (csrfToken && (options.csrf !== false)) {
      if (apos.util.sameSite(url)) {
        xmlhttp.setRequestHeader('X-XSRF-TOKEN', csrfToken);
      }
    }
    if (options.headers) {
      keys = Object.keys(options.headers);
      for (i = 0; (i < keys.length); i++) {
        xmlhttp.setRequestHeader(keys[i], options.headers[keys[i]]);
      }
    }
    apos.util.emit(document.body, 'apos-before-' + method.toLowerCase(), {
      uri: url,
      data: options.body,
      request: xmlhttp
    });
    if (sendJson) {
      data = JSON.stringify(options.body);
    } else {
      data = options.body;
    }
    xmlhttp.send(data);
    xmlhttp.addEventListener('load', function() {
      if (options.busy) {
        if (!busyActive[busyName]) {
          busyActive[busyName] = 0;
          apos.bus.$emit('apos-busy', {
            active: true,
            name: busyName
          });
        }
        // keep track of nested calls
        busyActive[busyName]++;
      }

      var responseHeader = this.getResponseHeader('Content-Type');
      if (!responseHeader) {
        // Can happen when the response body is null
        return callback(error(), null);
      }
      var data;
      if ((options.parse === 'json') || (responseHeader.match(/^application\/json/))) {
        try {
          data = JSON.parse(this.responseText);
        } catch (e) {
          return reply(e, this.responseText);
        }
      } else {
        data = this.responseText;
      }

      return reply(error(), data);

      function error() {
        // xmlhttprequest does not consider a 404, 500, etc. to be
        // an "error" in the sense that would trigger the error
        // event handler function (below), but we do.
        if (xmlhttp.status < 400) {
          return null;
        }
        return xmlhttp;
      }
      function reply(error, data) {
        if (error || options.fullResponse) {
          return callback(error, {
            body: data,
            status: xmlhttp.status,
            headers: getHeaders()
          });
        } else {
          return callback(null, data);
        }
      }
    });
    xmlhttp.addEventListener('abort', function(evt) {
      return callback(evt);
    });
    xmlhttp.addEventListener('error', function(evt) {
      return callback(evt);
    });
    xmlhttp.addEventListener('loadend', function () {
      if (options.busy) {
        busyActive[busyName]--;
        if (!busyActive[busyName]) {
          // if no nested calls, disable the "busy" state
          apos.bus.$emit('apos-busy', {
            active: false,
            name: busyName
          });
        }
      }
    });

    function getHeaders() {
      var headers = xmlhttp.getAllResponseHeaders();
      if (!headers) {
        return {};
      }
      // Per MDN
      var arr = headers.trim().split(/[\r\n]+/);
      // Create a map of header names to values
      var headerMap = {};
      arr.forEach(function (line) {
        var parts = line.split(': ');
        var header = parts.shift();
        if (!header) {
          return;
        }
        var value = parts.shift();
        // Optional support for fetching arrays of headers with the same name
        // could be added at a later time if anyone really cares. Usually
        // just a source of bugs
        headerMap[header.toLowerCase()] = value;
      });
      return headerMap;
    }
  };

  // Adds query string data to url. Supports nested structures with objects
  // and arrays, in a way compatible with qs and most other parsers including
  // those baked into PHP frameworks etc.
  apos.http.addQueryToUrl = function(url, data) {
    var i;
    var flat;
    if ((data != null) && ((typeof data) === 'object')) {
      flat = flatten('', data);
      for (i = 0; (i < flat.length); i++) {
        var key = flat[i][0];
        var val = flat[i][1];
        if (i > 0) {
          url += '&';
        } else {
          url += '?';
        }
        url += encodeURIComponent(key) + '=' + encodeURIComponent(val);
      }
    }
    return url;
    function flatten(path, data) {
      var flat = [];
      var keys;
      var i;
      if (Array.isArray(data)) {
        for (i = 0; (i < data.length); i++) {
          insert('', data[i]);
        }
      } else {
        keys = Object.keys(data);
        for (i = 0; (i < keys.length); i++) {
          insert(keys[i], data[keys[i]]);
        }
      }
      return flat;
      function insert(key, datum) {
        if ((datum != null) && ((typeof datum) === 'object')) {
          flat = flat.concat(flatten(path.length ? path + '[' + key + ']' : key, datum));
        } else {
          flat.push([ path.length ? path + '[' + key + ']' : key, datum ]);
        }
      }
    }
  };
})();
