export default () => {
  // Adds the apos.http client, which has the same API
  // as the server-side apos.http client, although it may
  // not have exactly the same features available.
  // This is a lean, IE11-friendly implementation.

  const busyActive = {};
  const apos = window.apos;
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
  // `draft` (if true, always add aposMode=draft to the query string, creating one if needed)
  // `fullResponse` (if true, return an object with `status`, `headers` and `body`
  // properties, rather than returning the body directly; the individual `headers` are canonicalized
  // to lowercase names. If there are duplicate headers after canonicalization only the
  // last value is returned. If a header appears multiple times an array is returned for it)
  // `downloadProgress` (may be a function accepting `received` and `total` parameters. May never be called. If
  // called, `received` will be the bytes sent so far, and `total` will be the total bytes to be
  // received. If the total is unknown, it will be `null`)
  // `uploadProgress` (may be a function accepting `sent` and `total` parameters. May never be called. If
  // called, `sent` will be the bytes sent so far, and `total` will be the total bytes to be
  // sent. If the total is unknown, it will be `null`)
  // `prefix`: If explicitly set to `false`, do not automatically prefix the URL,
  // even if the site has a site-wide prefix or locale prefix.
  // It can become handy when the given url is already prefixed,
  // which is the case when using the document's computed `_url` field for instance.
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

    if (apos.prefix && options.prefix !== false) {
      // Prepend the prefix if the URL is absolute:
      if (url.substring(0, 1) === '/') {
        url = apos.prefix + url;
      }
    }

    let query;
    let qat;

    // Intentional true / falsey check for determining
    // what set of docs the request is interested in
    if (options.draft != null) {
      if (options.qs) {
        // Already assumes no query parameters baked into URL, so OK to
        // just extend qs
        options.qs = options.draft
          ? apos.util.assign({ aposMode: 'draft' }, options.qs)
          : apos.util.assign({ aposMode: 'published' }, options.qs);
      } else {
        // Careful, there could be existing query parameters baked into url
        qat = url.indexOf('?');
        if (qat !== -1) {
          query = apos.http.parseQuery(url.substring(qat));
        } else {
          query = {};
        }
        query.aposMode = options.draft ? 'draft' : 'published';
        url = apos.http.addQueryToUrl(url, query);
      }
    }

    const busyName = options.busy === true ? 'busy' : options.busy;
    const xmlhttp = new XMLHttpRequest();
    let data = options.body;
    let keys;
    let i;

    if (options.qs) {
      url = apos.http.addQueryToUrl(url, options.qs);
    }
    if (options.busy) {
      if (!busyActive[busyName]) {
        busyActive[busyName] = 0;
        if (apos.bus) {
          apos.bus.$emit('busy', {
            active: true,
            name: busyName
          });
        }
      }
      // keep track of nested calls
      busyActive[busyName]++;
    }
    xmlhttp.open(method, url);
    const formData = window.FormData && (data instanceof window.FormData);
    const sendJson = (options.send === 'json') || (options.body && ((typeof options.body) === 'object') && !formData);
    if (sendJson) {
      xmlhttp.setRequestHeader('Content-Type', 'application/json');
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
    xmlhttp.addEventListener('load', function() {
      let data = null;
      const responseHeader = this.getResponseHeader('Content-Type');
      if (responseHeader || (options.parse === 'json')) {
        if ((options.parse === 'json') || (responseHeader.match(/^application\/json/))) {
          try {
            data = JSON.parse(this.responseText);
          } catch (e) {
            return callback(e);
          }
        } else {
          data = this.responseText;
        }
      }

      if (xmlhttp.status < 400) {
        if (options.fullResponse) {
          return callback(null, {
            body: data,
            status: xmlhttp.status,
            headers: getHeaders()
          });
        } else {
          return callback(null, data);
        }
      } else {
        const error = new Error((data && data.message) || (data && data.name) || 'Error');
        error.status = xmlhttp.status;
        error.name = (data && data.name);
        error.body = data;
        error.headers = getHeaders();
        return callback(error);
      }
    });
    xmlhttp.addEventListener('abort', function(evt) {
      return callback(evt);
    });
    xmlhttp.addEventListener('error', function(evt) {
      return callback(evt);
    });
    if (options.downloadProgress) {
      xmlhttp.addEventListener('progress', function(evt) {
        options.downloadProgress(evt.loaded, evt.lengthComputable ? evt.total : null);
      });
    }
    if (xmlhttp.upload && options.uploadProgress) {
      xmlhttp.upload.addEventListener('progress', function(evt) {
        options.uploadProgress(evt.loaded, evt.lengthComputable ? evt.total : null);
      });
    }
    xmlhttp.addEventListener('loadend', function (evt) {
      if (options.busy) {
        busyActive[busyName]--;
        if (!busyActive[busyName]) {
          // if no nested calls, disable the "busy" state
          if (apos.bus) {
            apos.bus.$emit('busy', {
              active: false,
              name: busyName
            });
          }
        }
      }
    });
    xmlhttp.send(data);

    function getHeaders() {
      const headers = xmlhttp.getAllResponseHeaders();
      if (!headers) {
        return {};
      }
      // Per MDN
      const arr = headers.trim().split(/[\r\n]+/);
      // Create a map of header names to values
      const headerMap = {};
      arr.forEach(function (line) {
        const parts = line.split(': ');
        const header = parts.shift();
        if (!header) {
          return;
        }
        const value = parts.shift();
        // Optional support for fetching arrays of headers with the same name
        // could be added at a later time if anyone really cares. Usually
        // just a source of bugs
        headerMap[header.toLowerCase()] = value;
      });
      return headerMap;
    }
  };

  // Parse a query string. You can pass with or without the
  // leading ?. Don't pass the entire URL. Supports objects,
  // arrays and nesting with the classic PHP/Java bracket syntax.
  // If a key is set with no = it is considered null, per
  // the java convention. Good for use with window.location.search.

  apos.http.parseQuery = function(query) {
    query = query.replace(/^\?/, '');
    const data = {};
    const pairs = query.split('&');
    pairs.forEach(function(pair) {
      let parts;
      if (pair.indexOf('=') === -1) {
        patch(pair, null);
      } else {
        parts = pair.split('=');
        if (parts) {
          patch(parts[0], parts[1]);
        }
      }
    });
    return data.root || {};
    function patch(key, value) {
      let match;
      let parentKey = 'root';
      let context = data;
      key = decodeURIComponent(key);
      const path = key.split('[');
      path.forEach(function(subKey) {
        if (subKey === ']') {
          if (!Array.isArray(context[parentKey])) {
            context[parentKey] = [];
          }
          context = context[parentKey];
          parentKey = context.length;
        } else if (subKey.match(/^\d+]/)) {
          match = subKey.match(/^\d+/);
          if (!Array.isArray(context[parentKey])) {
            context[parentKey] = [];
          }
          context = context[parentKey];
          parentKey = parseInt(match);
        } else {
          match = subKey.replace(']', '');
          if (!context[parentKey]) {
            context[parentKey] = {};
          }
          context = context[parentKey];
          parentKey = match;
        }
      });
      value = (value === null) ? value : decodeURIComponent(value);
      if (Array.isArray(context[parentKey])) {
        context[parentKey].push(value);
      } else if (context[parentKey] !== undefined) {
        context[parentKey] = [ context[parentKey], value ];
      } else {
        context[parentKey] = value;
      }
    }
  };

  // Adds query string data to url. Supports nested structures with objects
  // and arrays, in a way compatible with qs and most other parsers including
  // those baked into PHP frameworks etc. If the URL already contains a query
  // it is discarded and replaced with the new one. All non-query parts of the
  // URL remain unchanged.

  apos.http.addQueryToUrl = function(url, data) {
    let hash = '';
    const hashAt = url.indexOf('#');
    if (hashAt !== -1) {
      hash = url.substring(hashAt);
      url = url.substring(0, hashAt);
    }
    url = url.replace(/\?.*$/, '');
    let i;
    let flat;
    if ((data != null) && ((typeof data) === 'object')) {
      flat = flatten('', data);
      for (i = 0; (i < flat.length); i++) {
        const key = flat[i][0];
        const val = flat[i][1];
        if (i > 0) {
          url += '&';
        } else {
          url += '?';
        }
        if (val == null) {
          // Java-style distinction between null and empty string
          url += encodeURIComponent(key);
        } else {
          url += encodeURIComponent(key) + '=' + encodeURIComponent(val);
        }
      }
    }
    return url + hash;
    function flatten(path, data) {
      let flat = [];
      let keys;
      let i;
      if (Array.isArray(data)) {
        for (i = 0; (i < data.length); i++) {
          insert(i, data[i]);
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
};
