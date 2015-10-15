var async = require('async');
var _ = require('lodash');

module.exports = {
  construct: function(self, options) {

    // areas filter loads widgets in areas. By default
    // this does occur. With .areas(false) you can
    // shut it off for a particular find() call. With
    // .areas([ 'thumbnail' ]) you can load just that
    // one area on all pages matching the query.

    self.addFilter('areas', {
      def: true,
      after: function(results, callback) {
        var setting = self.get('areas');
        if (!setting) {
          return setImmediate(callback);
        }
        var req = self.get('req');
        req.areasLoadedFor = req.areasLoadedFor || {};

        var widgetsByType = {};

        return async.eachSeries(results, function(doc, callback) {
          // Simple guard against infinite recursion:
          // we won't load areas for the same doc twice
          if (_.has(req.areasLoadedFor, doc._id)) {
            return setImmediate(callback);
          }
          req.areasLoadedFor[doc._id] = true;
          self.apos.areas.walk(doc, function(area, dotPath) {
            if (setting && Array.isArray(setting)) {
              if (!_.contains(setting, dotPath)) {
                return;
              }
            }
            if (doc._edit) {
              area._edit = true;
            }
            area._docId = doc._id;
            area._dotPath = dotPath;
            _.each(area.items, function(item) {
              if (area._edit) {
                // Keep propagating ._edit so a widget can be passed
                // like a doc to aposArea if it contains nested areas. -Tom
                item._edit = true;
              }
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
            if (!_.has(self.widgetManagers, type)) {
            }
            var manager = self.apos.areas.getWidgetManager(type);
            if (!manager) {
              console.error('WARNING: widget type ' + type + ' exists in content but is not configured');
              return setImmediate(callback);
            }
            if (!manager.load) {
              return setImmediate(callback);
            }
            return manager.load(req, widgetsByType[type], callback);
          }, callback);
        });
      }
    });
  }
};
