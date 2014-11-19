var _ = require('lodash');
var extend = require('extend');

/**
 * prune
 * @augments Augments the apos object with methods relating to the
 * pruning of temporary or oversized properties of page objects.
 * @see static
 */

module.exports = function(self) {
  // Except for `._id`, no property beginning with `_` should be
  // loaded from or stored to the database. These are reserved for dynamically
  // determined properties like permissions and joins. This method
  // purges all such temporary properties from a page object, or any
  // object that obeys this rule. It is called by `apos.putPage` before
  // saving a page and is also used in files.js.
  //
  // This method is recursive and will prune both object properties
  // and array properties recursively. (Arrays do not themselves contain
  // any keys starting with _ but their values might.)
  self.pruneTemporaryProperties = function(page) {
    return self.pruneDeep(page, function(o, key, value, dotPath) {
      // Don't crash on numbers
      key = key.toString();
      if ((key.substr(0, 1) === '_') && (key !== '_id')) {
        return true;
      }
    });
  };

  // perform a recursive prune operation on a page. The second argument must be
  // a function that takes an object, a key a value and a "dot path" and returns true if
  // that key should be discarded. Remember, keys can be numeric.
  //
  // If the original object looks like:
  //
  // { a: { b: 5 } }
  //
  // Then when the pruner is invoked for b, the key will be 'b' and the
  // dotPath will be the string 'a.b'.
  //
  // You do not need to pass a _dotPath argument to pruneDeep itself, it is used for
  // recursive invocation.

  self.pruneDeep = function(page, pruner, _dotPath) {
    // We do not use underscore here because of performance issues.
    // Pruning big nested objects is not something we can afford
    // to do slowly. -Tom
    var key;
    var val;
    var __dotPath;
    if (_dotPath !== undefined) {
      _dotPath += '.';
    } else {
      _dotPath = '';
    }
    if (Array.isArray(page)) {
      for (key in page) {
        var item = page[key];
        if (typeof(item) === 'object') {
          __dotPath = _dotPath + key.toString();
          self.pruneDeep(item, pruner, __dotPath);
        }
      }
      return;
    }
    var remove = [];
    for (key in page) {
      __dotPath = _dotPath + key.toString();
      if (pruner(page, key, page[key], __dotPath)) {
        remove.push(key);
      } else {
        val = page[key];
        if (typeof(val) === 'object') {
          self.pruneDeep(val, pruner, __dotPath);
        }
      }
    }
    _.each(remove, function(key) {
      delete page[key];
    });
  };

  // perform a recursive clone operation on a page. The second argument must
  // be a function that takes an object, a key a value and a "dot path" and
  // returns true if that key should be discarded rather than copied.
  // Remember, keys can be numeric.
  //
  // If the original object looks like:
  //
  // { a: { b: 5 } }
  //
  // Then when the pruner is invoked for b, the key will be 'b' and the
  // dotPath will be the string 'a.b'.
  //
  // You do not need to pass a _dotPath argument to pruneDeep itself, it
  // is used for recursive invocation.
  //
  // The original object is not modified.

  self.cloneDeep = function(page, pruner, _dotPath) {
    var key;
    var val;
    var __dotPath;
    var _page;
    if (_dotPath !== undefined) {
      _dotPath += '.';
    } else {
      _dotPath = '';
    }
    if (Array.isArray(page)) {
      _page = [];
      for (key in page) {
        var item = page[key];
        if (typeof(item) === 'object') {
          __dotPath = _dotPath + key.toString();
          item = self.cloneDeep(item, pruner, __dotPath);
        }
        _page[key] = item;
      }
      return _page;
    }
    _page = {};
    for (key in page) {
      __dotPath = _dotPath + key.toString();
      if (pruner(page, key, page[key], __dotPath)) {
        // Skip
      } else {
        val = page[key];
        if (typeof(val) === 'object') {
          val = self.cloneDeep(val, pruner, __dotPath);
        }
        _page[key] = val;
      }
    }
    return _page;
  };

  // This method makes a deep copy of an object retaining only
  // properties that are considered worth sending to the browser
  // as JSON on every page request. A great deal of voluminous
  // information is removed to avoid extremely slow page
  // renders. Note that the existing object is not modified,
  // which differs from the behavior of pruneDeep and pruneTemporaryProperties.

  self.prunePage = function(page) {
    page = _.omit(page, 'tabs', 'children', 'peers', 'lowSearchText', 'highSearchText', 'searchSummary', 'preMigrationAreas', 'legacyPermissions');

    // Limit information about ancestors to avoid
    // excessive amounts of data in the page
    page.ancestors = _.map(page.ancestors, function(ancestor) {
      return _.pick(ancestor, [ 'title', 'slug', '_id', 'type', 'published' ]);
    });

    return self.cloneDeep(page, function(o, k, v) {
      // Drop joins, but watch out for ._id, ._edit and ._publish
      // which we actually do want in some cases
      if ((k !== '_id') && (k !== '_edit') && (k !== '_publish') && (k.toString().match(/^_/))) {
        // No joins encoded in JSON please
        return true;
      }
      return (v && (v.type === 'area'));
    });
  };

};

