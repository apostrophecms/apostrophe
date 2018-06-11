// Provides the `build` method, a flexible and powerful way to build
// URLs with query parameters and more. This method is made available
// as the `build` filter in Nunjucks. This is also the logical place
// to add new utility methods relating to URLs.

var _ = require('@sailshq/lodash');
var qs = require('qs');

module.exports = {

  alias: 'urls',

  construct: function(self, options) {

    // Build filter URLs. `data` is an object whose properties
    // become new query parameters. These parameters override any
    // existing parameters of the same name in the URL. If you
    // pass a property with a value of `undefined`, `null` or an
    // empty string, that parameter is removed from the
    // URL if already present (note that the number `0` does not
    // do this). This is very useful for maintaining filter
    // parameters in a query string without redundant code.
    //
    // Pretty URLs
    //
    // If the optional `path` argument is present, it must be an
    // array. (You may skip this argument if you are just
    // adding query parameters.)
    //
    // Any properties of `data` whose names appear in `path`
    // are concatenated to the URL directly, separated by slashes,
    // in the order they appear in that array.
    //
    // The first missing or empty value for a property in `path`
    // stops this process to prevent an ambiguous URL.
    //
    // Note that there is no automatic detection that this has
    // already happened in an existing URL, so you can't override
    // existing components of the path.
    //
    // If a property's value is not equal to the slugification of
    // itself as determined by apos.utils.slugify, then a query
    // parameter is set instead.
    //
    // If you don't want to handle a property as a query parameter,
    // make sure it is always slug-safe.
    //
    // Overrides: multiple data objects
    //
    // You may pass additional data objects. The last one wins, so
    // you can pass your existing parameters first and pass new
    // parameters you are changing as a second data object.
    //
    // Working with Arrays
    //
    // Normally, a new value for a property replaces any old one,
    // and `undefined`, `null` or `''` removes the old one. If you
    // wish to build up an array property instead you'll need
    // to use the MongoDB-style $addToSet and $pull operators to add and
    // remove values from an array field in the URL:
    //
    // Add tags[]=blue to the query string, if not already present
    //
    // `{ tags: { $addToSet: 'blue' } }`
    //
    // Remove tags[]=blue from the query string, if present
    //
    // `{ tags: { $pull: 'blue' } }`
    //
    // All values passed to $addToSet or $pull must be strings or
    // convertible to strings via `toString()` (e.g. numbers, booleans)
    //
    // (The actual query string syntax includes array indices and
    // is fully URI escaped, so it's slightly different but has
    // the same impact. PHP does the same thing.)

    self.build = function(url, path, data) {

      var hash;
      // Preserve hash separately
      var matches = url.match(/^(.*)?#(.*)$/);
      if (matches) {
        url = matches[1];
        hash = matches[2];
        if (url === undefined) {
          // Why, JavaScript? Why? -Tom
          url = '';
        }
      }

      // Sometimes necessary with nunjucks, we may otherwise be
      // exposed to a SafeString object and throw an exception
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

      // Process data objects in reverse order so the last
      // override wins
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
            if (typeof (value) === 'object') {
              stop = true;
              break;
            }
            var s = dataObject[key].toString();
            if (s === self.apos.utils.slugify(s)) {
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

      // For non-path parameters we process starting with the original
      // object so cumulative operations like $addToSet and $pull can work

      for (i = dataObjects.length - 1; (i >= 0); i--) {
        dataObject = dataObjects[i];
        for (key in dataObject) {
          if (done[key]) {
            continue;
          }
          value = dataObject[key];
          if (value && (value.$pull !== undefined)) {
            value = _.difference(query[key] || [], [ value.$pull.toString() ]);
            if (!value.length) {
              value = undefined;
            }
          } else if (value && (value.$addToSet !== undefined)) {
            value = _.union(query[key] || [], [ value.$addToSet.toString() ]);
            if (!value.length) {
              value = undefined;
            }
          }
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

  }
};
