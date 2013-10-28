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
    return self.join(joinr.byOne, false, req, items, idField, undefined, objectField, options, callback);
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
    return self.join(joinr.byOneReverse, true, req, items, idField, undefined, objectField, options, callback);
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
  //
  // relationshipsField may be skipped.

  self.joinByArray = function(req, items, idsField, relationshipsField, objectsField, options, callback) {
    return self.join(joinr.byArray, false, req, items, idsField, relationshipsField, objectsField, options, callback);
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
  //
  // relationshipsField may be skipped.

  self.joinByArrayReverse = function(req, items, idsField, relationshipsField, objectsField, options, callback) {
    return self.join(joinr.byArrayReverse, true, req, items, idsField, relationshipsField, objectsField, options, callback);
  };

  // Driver for the above joinr convenience methods. Normally not called directly.
  // All arguments must be present, however relationshipsField may be undefined to
  // indicate none is needed.
  self.join = function(method, reverse, req, items, idField, relationshipsField, objectField, options, callback) {
    if (!options) {
      options = {};
    }
    var getter = options.get || self.get;
    var getOptions = options.getOptions || {};
    var getCriteria = options.getCriteria || {};
    // Some joinr methods don't take relationshipsField
    if (method.length === 5) {
      var realMethod = method;
      method = function(items, idField, relationshipsField, objectField, getter, callback) {
        return realMethod(items, idField, objectField, getter, callback);
      };
    }
    return method(items, idField, relationshipsField, objectField, function(ids, callback) {
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
        var items = results.snippets || results.pages || results;
        return callback(null, results.snippets || results.pages || results);
      });
    }, callback);
  };
};
