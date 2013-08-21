var joinr = require('joinr');

/**
 * joinr
 * @augments Augments the apos object with convenience methods for invoking joinr
 * in the ways most common in Apostrophe projects. This is not the joinr module itself.
 */

module.exports = function(self) {
  // Conveniently invoke joinr to fetch on a single id property. See the
  // joinr module for more information.
  //
  // Apostrophe-specific features:
  //
  // If options.get is not set, apos.get is used; otherwise
  // it is usually the get method of a snippet subclass.
  // Looks for the returned documents in results.snippets,
  // then results.pages, then results itself. Additional
  // criteria for the getter can be passed via
  // options.getCriteria, and options to the getter can be
  // passed via options.getOptions (often used to prevent
  // infinite recursion when joining).

  self.joinByOne = function(req, items, idField, objectField, options, callback) {
    return self.join(joinr.byOne, false, req, items, idField, objectField, options, callback);
  };

  // Conveniently invoke joinr to fetch many related objects on a single id property of the
  // objects being joined with. See the joinr module for more information.
  //
  // Apostrophe-specific features:
  //
  // If options.get is not set, apos.get is used; otherwise
  // it is usually the get method of a snippet subclass.
  // Looks for the returned documents in results.snippets,
  // then results.pages, then results itself. Additional
  // criteria for the getter can be passed via
  // options.getCriteria, and options to the getter can be
  // passed via options.getOptions (often used to prevent
  // infinite recursion when joining).

  self.joinByOneReverse = function(req, items, idField, objectField, options, callback) {
    return self.join(joinr.byOneReverse, true, req, items, idField, objectField, options, callback);
  };

  // Conveniently invoke joinr to fetch many joined objects per
  // object in `items` via an array property of each (idsField). See the
  // joinr module for more information.
  //
  // Apostrophe-specific features:
  //
  // If options.get is not set, apos.get is used; otherwise
  // it is usually the get method of a snippet subclass.
  // Looks for the returned documents in results.snippets,
  // then results.pages, then results itself. Additional
  // criteria for the getter can be passed via
  // options.getCriteria, and options to the getter can be
  // passed via options.getOptions (often used to prevent
  // infinite recursion when joining).

  self.joinByArray = function(req, items, idsField, objectsField, options, callback) {
    return self.join(joinr.byArray, false, req, items, idsField, objectsField, options, callback);
  };

  // Conveniently invoke joinr to fetch many joined objects per
  // object in `items` via an array property of the objects being
  // joined with (idsField). See the joinr module for more information.
  //
  // Apostrophe-specific features:
  //
  // If options.get is not set, apos.get is used; otherwise
  // it is usually the get method of a snippet subclass.
  // Looks for the returned documents in results.snippets,
  // then results.pages, then results itself. Additional
  // criteria for the getter can be passed via
  // options.getCriteria, and options to the getter can be
  // passed via options.getOptions (often used to prevent
  // infinite recursion when joining).

  self.joinByArrayReverse = function(req, items, idsField, objectsField, options, callback) {
    return self.join(joinr.byArrayReverse, true, req, items, idsField, objectsField, options, callback);
  };

  // Driver for the above joinr convenience methods. Normally not called directly.
  self.join = function(method, reverse, req, items, idField, objectField, options, callback) {
    if (!callback) {
      callback = options;
      options = {};
    }
    var getter = options.get || self.get;
    var getOptions = options.getOptions || {};
    var getCriteria = options.getCriteria || {};
    return method(items, idField, objectField, function(ids, callback) {
      var idsCriteria = {};
      if (reverse) {
        idsCriteria[idField] = { $in: ids };
      } else {
        idsCriteria._id = { $in: ids };
      }
      var criteria = { $and: [ getCriteria, idsCriteria ] };
      return getter(req, criteria, getOptions, function(err, results) {
        if (err) {
          return callback(err);
        }
        return callback(null, results.snippets || results.pages || results);
      });
    }, callback);
  };
};
