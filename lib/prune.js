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

  // We send the current page's metadata as inline JSON that winds up in
  // apos.data.aposPages.page in the browser. It's very helpful for building
  // page manipulation UI. But we shouldn't redundantly send the areas, as we are already
  // rendering the ones we care about. And we shouldn't send our relatives
  // as we're already rendering those as navigation if we want them. Also
  // prune out the search text which can contain characters that are valid
  // JSON but not valid JS (the existence of this is a nightmare):
  // https://code.google.com/p/v8/issues/detail?id=1907
  //
  // This method was originally in the pages module but must reside here
  // so that renderPage can reside here. TODO: we should probably use an event
  // to allow other modules to contribute to the pruning process, including the
  // pages module, so that ancestors, children, peers are not mentioned here.

  self.prunePage = function(page) {
    var copy = {};
    // Make a deep copy so that our recursive prune of areas doesn't damage
    // the original object
    extend(true, copy, page);
    copy = _.omit(copy, 'tabs', 'ancestors', 'children', 'peers', 'lowSearchText', 'highSearchText', 'searchSummary');
    self.pruneDeep(copy, function(o, k, v) {
      return (v && (v.type === 'area'));
    });
    return copy;
  };

};

