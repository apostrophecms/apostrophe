var async = require('async');
var _ = require('lodash');

module.exports = function(self, options) {

  self.widgetDefinitions = {};

  self.docsAfterLoad = function(req, docs, callback) {

    // Load all the widgets in all the areas on all
    // of the documents. For efficiency, invoke
    // widgetsLoad once per type of widget found.
    // Prevent infinite loops caused by loading
    // widgets for the same document twice.

    req.areasLoadedFor = req.areasLoadedFor || {};

    var widgetsByType = {};

    return async.eachSeries(docs, function(doc, callback) {
      // Simple guard against infinite recursion:
      // we won't load areas for the same doc twice
      if (_.has(req.areasLoadedFor, doc._id)) {
        return setImmediate(callback);
      }
      req.areasLoadedFor[doc._id] = true;
      self.walkAreas(doc, function(area, dotPath) {
        if (doc._edit) {
          area._edit = true;
        }
        area._docId = doc._id;
        area._dotPath = dotPath;
        _.each(area.items, function(item) {
          if (!widgetsByType[item.type]) {
            widgetsByType[item.type] = [];
          }
          widgetsByType[item.type].push(item);
        });
      });
      return setImmediate(callback);
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return async.eachSeries(_.keys(widgetsByType), function(type, callback) {
        return self.widgetDefinitions[type].load(req, widgetsByType[type], callback);
      }, callback);
    });
  };
};
