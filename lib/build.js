var _ = require('lodash');
var qs = require('qs');

 /**
 * build
 * @augments Adds a method providing a convenient means of building URLs with
 * query string parameters as well as attractive URLs with path components
 */

module.exports = function(self) {

  // Add and modify query parameters of a url. data is an object whose properties
  // become new query parameters. These parameters override any existing
  // parameters of the same name in the URL. If you pass a property with
  // a value of undefined, null or an empty string, that parameter is removed from the
  // URL if already present (note that the number 0 does not do this). This is very
  // useful for maintaining filter parameters in a query string without redundant code.
  //
  // PRETTY URLS
  //
  // If the optional `path` argument is present, it must be an array. (You
  // may skip this argument if you are just adding query parameters.) Any
  // properties of `data` whose names appear in `path` are concatenated
  // to the URL directly, separated by slashes, in the order they appear in that
  // array. The first missing or empty value for a property in `path` stops
  // this process to prevent an ambiguous URL.
  //
  // Note that there is no automatic detection that this has
  // already happened in an existing URL, so you can't override existing
  // components of the path. Typically this is used with a snippet index page,
  // on which the URL of the page is available as a starting point for
  // building the next URL.
  //
  // If a property's value is not equal to the slugification of itself
  // (apos.slugify), then a query parameter is set instead. This ensures your
  // URLs are not rejected by the browser. If you don't want to handle a
  // property as a query parameter, make sure it is always slug-safe.
  //
  // OVERRIDES: MULTIPLE DATA OBJECTS
  //
  // You may pass additional data objects. The last one wins, so you can
  // pass your existing parameters first and pass new parameters you are changing
  // as a second data object.

  self.build = function(url, path, data) {
    var hash;
    // Preserve hash separately
    var matches = url.match(/^(.*)?\#(.*)$/);
    if (matches) {
      url = matches[1];
      hash = matches[2];
      if (url === undefined) {
        // Why, JavaScript? Why? -Tom
        url = '';
      }
    }
    // Sometimes necessary with nunjucks, we may otherwise be
    // exposed to a SafeString object and throw an exception. Not
    // able to boil this down to a simple test case for jlongster so far
    url = url.toString();
    var qat = url.indexOf('?');
    var base = url;
    var dataObjects = [];
    var pathKeys;
    var original;
    var query = {};
    var i, j;
    var key;

    if (qat !== -1) {
      original = qs.parse(url.substr(qat + 1));
      base = url.substr(0, qat);
    }
    var dataStart = 1;
    if (path && Array.isArray(path)) {
      pathKeys = path;
      dataStart = 2;
    } else {
      pathKeys = [];
    }
    // Process data objects in reverse order so the last override wins
    for (i = arguments.length - 1; (i >= dataStart); i--) {
      dataObjects.push(arguments[i]);
    }
    if (original) {
      dataObjects.push(original);
    }
    var done = {};
    var stop = false;
    var dataObject;
    var value;

    for (i = 0; (i < pathKeys.length); i++) {
      if (stop) {
        break;
      }
      key = pathKeys[i];
      for (j = 0; (j < dataObjects.length); j++) {
        dataObject = dataObjects[j];
        if (dataObject[key] !== undefined) {
          value = dataObject[key];
          // If we hit an empty value we need to stop all path processing to avoid
          // ambiguous URLs
          if ((value === undefined) || (value === null) || (value === '')) {
            done[key] = true;
            stop = true;
            break;
          }
          // If the value is an object it can't be stored in the path,
          // so stop path processing, but don't mark this key 'done'
          // because we can still store it as a query parameter
          if (typeof(value) === 'object') {
            stop = true;
            break;
          }
          var s = dataObject[key].toString();
          if (s === self.slugify(s)) {
            // Don't append double /
            if (base !== '/') {
              base += '/' + s;
            } else {
              base += s;
            }
            done[key] = true;
            break;
          } else {
            // A value that cannot be slugified also forces an end to
            // path processing
            stop = true;
            break;
          }
        }
      }
    }

    for (i = 0; (i < dataObjects.length); i++) {
      dataObject = dataObjects[i];
      for (key in dataObject) {
        value = dataObject[key];
        if (done[key]) {
          continue;
        }
        done[key] = true;
        if ((value === undefined) || (value === null) || (value === '')) {
          delete query[key];
        } else {
          query[key] = value;
        }
      }
    }

    function restoreHash(url) {
      if (hash !== undefined) {
        return url + '#' + hash;
      } else {
        return url;
      }
    }

    if (_.size(query)) {
      return restoreHash(base + '?' + qs.stringify(query));
    } else {
      return restoreHash(base);
    }
  };
};

