var _ = require('lodash');
var async = require('async');
var deep = require('deep-get-set');

module.exports = function(self, options) {

  self.widgetManagers = {};

  self.addWidgetManager = function(name, manager) {
    self.widgetManagers[name] = manager;
  };

  self.findSingletonWidget = function(area, type) {
    return _.find((area && area.items) || [], function(widget) {
      return widget.type === type;
    });
  };

  // Update or create a singleton at the specified
  // dot path in the document with the specified
  // id, if we have permission to do so. The
  // widget in the singleton will be saved with the
  // specified JSON-compatible data. The callback will
  // then be invoked with (null, html), where html is an
  // up to date HTML rendering of the widget in
  // the singleton.

  self.saveSingleton = function(req, docId, dotPath, data, options, callback) {
    var rendering;
    return async.series({
      find: function(callback) {
        return self.apos.docs.find(req, { _id: docId }).permission('edit-doc').toObject(function(err, _doc) {
          if (err) {
            return callback(err);
          }
          if (!_doc) {
            return callback(new Error('notfound'));
          }
          doc = _doc;
          return callback(null);
        });
      },
      update: function(callback) {
        var components = dotPath.split(/\./);

        var forbiddenAreas = [ '_id', 'title', 'slug', 'sortTitle', 'docPermissions', 'tags' ];
        if (_.contains(forbiddenAreas, components[0])) {
          return callback(new Error('forbidden'));
        }

        // If it's not a top level property, it's
        // always okay - unless it already exists
        // and is not an area.

        if (components.length > 1) {
          var existing = deep(doc, dotPath);
          if (existing && (existing.type !== 'area')) {
            return callback(new Error('forbidden'));
          }
        }

        data.type = options.type;

        deep(doc, dotPath, {
          type: 'area',
          items: [
            data
          ]
        });
        return self.apos.docs.update(req, doc, callback);
      }
    }, function(err) {
      if (err) {
        return callback(err);
      }
      var manager = self.widgetManagers[options.type];
      try {
        return callback(null, self.render(req, 'widget', {
          widget: data,
          options: options,
          manager: manager,
          output: function() {
            return manager.output(data, options);
          }
        }));
      } catch (e) {
        console.error(e);
        console.error(e.stack);
        console.error('^^^^ LOOK UP HERE FOR THE ERROR IN YOUR WIDGET OUTPUT METHOD');
        return callback(e);
      }
    });
  };

  // Walk the areas in a doc. The callback receives the
  // area object and the dot-notation path to that object.
  //
  // If the callback explicitly returns `false`, the area
  // is *removed* from the page object, otherwise no
  // modifications are made.

  self.walkAreas = function(doc, callback) {
    return self.apos.docs.walk(doc, function(o, k, v, dotPath) {
      if (v && (v.type === 'area')) {
        return callback(v, dotPath);
      }
    });
  };

  // Load all the widgets in all the areas on all
  // of the documents. For efficiency, invoke
  // widgetsLoad once per type of widget found.
  // Prevent infinite loops caused by loading
  // widgets for the same document twice.
  //
  // This method is invoked via callAll by
  // the docs module.

  self.docsAfterLoad = function(req, docs, callback) {

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
        if (!_.has(self.widgetManagers, type)) {
          console.error('WARNING: widget type ' + type + ' exists in content but is not configured');
          return setImmediate(callback);
        }
        return self.widgetManagers[type].load(req, widgetsByType[type], callback);
      }, callback);
    });
  };
};
