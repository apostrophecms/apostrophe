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
    if (Array.isArray(page)) {
      _.each(page, function(item) {
        if (typeof(item) === 'object') {
          self.pruneTemporaryProperties(item);
        }
      });
      return;
    }
    var remove = [];
    _.each(page, function(val, key) {
      if ((key.substr(0, 1) === '_') && (key !== '_id')) {
        remove.push(key);
      } else {
        if (typeof(val) === 'object') {
          self.pruneTemporaryProperties(val);
        }
      }
    });
    _.each(remove, function(key) {
      delete page[key];
    });
  };
};

