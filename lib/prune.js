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
  self.pruneTemporaryProperties = function(page) {
    var remove = [];
    _.each(page, function(val, key) {
      if ((key.substr(0, 1) === '_') && (key !== '_id')) {
        remove.push(key);
      } else {
        if ((typeof(val) === 'object') && (!Array.isArray(val))) {
          self.pruneTemporaryProperties(val);
        }
      }
    });
    _.each(remove, function(key) {
      delete page[key];
    });
  };
};

