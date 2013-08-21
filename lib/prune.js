var _ = require('underscore');

/**
 * prune
 * @augments Augments the apos object with methods relating to the
 * pruning of temporary or oversized properties of page objects.
 * @see static
 */

module.exports = function(self) {
  // Except for ._id, no property beginning with a _ should be
  // loaded from or stored to the database. These are reserved for dynamically
  // determined properties like permissions and joins
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

