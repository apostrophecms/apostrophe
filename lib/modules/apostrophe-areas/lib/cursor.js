var async = require('async');
var _ = require('lodash');

module.exports = {
  construct: function(self, options) {

    // The areas filter calls the `load` methods of the
    // widget type managers for widgets in areas. By default
    // this does occur. With `.areas(false)` you can
    // shut it off for a particular cursor. With
    // .areas([ 'thumbnail' ]) you can load just that
    // one area for all pages matching the query.

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

        _.each(results, function(doc) {
          var areasInfo = [];
          self.apos.areas.walk(doc, function(area, dotPath) {
            areasInfo.push({ area: area, dotPath: dotPath });
          });
          if (areasInfo.length) {
            // Simple guard against infinite recursion:
            // we won't load areas for the same doc more than five times
            // per page request.
            //
            // We run this guard only if areas actually exist so we're
            // not unfairly triggered by docs loaded with a restricted
            // projection.
            if (!_.has(req.areasLoadedFor, doc._id)) {
              req.areasLoadedFor[doc._id] = 0;
            }
            if (req.areasLoadedFor[doc._id] >= 5) {
              return;
            }
            req.areasLoadedFor[doc._id]++;
            _.each(areasInfo, function(info) {
              var area = info.area;
              var dotPath = info.dotPath;
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
          }
        });

        if (req.deferWidgetLoading && (!req.loadingDeferredWidgets)) {
          var types = _.keys(widgetsByType);
          _.each(types, function(type) {
            var manager = self.apos.areas.getWidgetManager(type);
            if (manager.options.defer) {
              req.deferredWidgets = req.deferredWidgets || {};
              req.deferredWidgets[type] = (req.deferredWidgets[type] || []).concat(widgetsByType[type]);
              delete widgetsByType[type];
            }
          });
        }

        return async.eachSeries(_.keys(widgetsByType), function(type, callback) {
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
      }
    });
  }
};
