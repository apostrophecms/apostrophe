var _ = require('underscore');

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
  // purges all such temporary properties from a page object. It is
  // called by `apos.putPage` before saving a page.
  //
  // This method is recursive and will prune both object properties
  // and array properties recursively. (Arrays do not themselves contain
  // any keys starting with _ but their values might.)
  self.pruneTemporaryProperties = function(page) {
    // We do not use underscore here because of performance issues.
    // Pruning big nested objects is not something we can afford
    // to do slowly. -Tom
    var key;
    var val;
    if (Array.isArray(page)) {
      for (key in page) {
        var item = page[key];
        if (typeof(item) === 'object') {
          self.pruneTemporaryProperties(item);
        }
      }
      return;
    }
    var remove = [];
    for (key in page) {
      // Don't crash on numbers
      key = key.toString();
      if ((key.substr(0, 1) === '_') && (key !== '_id')) {
        remove.push(key);
      } else {
        val = page[key];
        if (typeof(val) === 'object') {
          self.pruneTemporaryProperties(val);
        }
      }
    }
    _.each(remove, function(key) {
      delete page[key];
    });
  };
};

