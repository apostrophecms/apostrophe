
var _ = require('underscore');
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
    for (var i = arguments.length - 1; (i >= dataStart); i--) {
      dataObjects.push(arguments[i]);
    }
    if (original) {
      dataObjects.push(original);
    }
    var done = {};
    var stop = false;
    _.every(pathKeys, function(key) {
      return _.some(dataObjects, function(dataObject) {
        if (stop) {
          return false;
        }
        if (dataObject.hasOwnProperty(key)) {
          var value = dataObject[key];
          // If we hit an empty value we need to stop all path processing to avoid
          // ambiguous URLs
          if ((value === undefined) || (value === null) || (value === '')) {
            done[key] = true;
            stop = true;
            return true;
          }
          // If the value is an object it can't be stored in the path,
          // so stop path processing, but don't mark this key 'done'
          // because we can still store it as a query parameter
          if (typeof(value) === 'object') {
            stop = true;
            return true;
          }
          var s = dataObject[key].toString();
          if (s === self.slugify(s)) {
            // Don't append double /
            if (base !== '/') {
              base += '/';
            }
            base += s;
            done[key] = true;
            return true;
          }
        }
        return false;
      });
    });
    _.each(dataObjects, function(data) {
      _.each(data, function(value, key) {
        if (done[key]) {
          return;
        }
        done[key] = true;
        if ((value === undefined) || (value === null) || (value === '')) {
          delete query[key];
        } else {
          query[key] = value;
        }
      });
    });
    if (_.size(query)) {
      return base + '?' + qs.stringify(query);
    } else {
      return base;
    }
  };
};

