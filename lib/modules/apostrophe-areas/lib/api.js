var _ = require('lodash');
var async = require('async');
var deep = require('deep-get-set');

module.exports = function(self, options) {

  self.forbiddenAreas = [ '_id', 'title', 'slug', 'titleSort', 'docPermissions', 'tags', 'type' ];

  self.widgetManagers = {};

  self.setWidgetManager = function(name, manager) {
    self.widgetManagers[name] = manager;
  };

  self.getWidgetManager = function(name) {
    return self.widgetManagers[name];
  }

  self.findSingletonWidget = function(area, type) {
    return _.find((area && area.items) || [], function(widget) {
      return widget.type === type;
    });
  };

  self.renderArea = function(area, options) {
    return self.partial('area', {
      area: area,
      options: options,
      widgetManagers: self.widgetManagers
    });
  };

  // Sanitize an array of items intended to become
  // the items property of an area. Invokes the
  // sanitize method for each widget's manager. Widgets
  // with no manager are discarded.

  self.sanitizeItems = function(req, items, callback) {
    var result = [];
    return async.eachSeries(items, function(item, callback) {
      if ((typeof(item) !== 'object') || (typeof(item.type) !== 'string')) {
        return setImmediate(callback);
      }
      var manager = self.getWidgetManager(item.type);
      if (!manager) {
        return setImmediate(callback);
      }
      return manager.sanitize(req, item, function(err, item) {
        if (err) {
          return callback(err);
        }
        result.push(item);
        return callback(null);
      });
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return callback(null, result);
    });
  };

  self.renderWidget = function(req, type, data, options, callback) {
    var manager = self.getWidgetManager(type);
    if (!manager) {
      // No manager available - possibly a stale widget in the database
      // of a type no longer in the project
      return callback(null, '');
    }
    data.type = type;
    try {
      return callback(null, self.render(req, 'widget', {
        widget: data,
        dataFiltered: manager.filterForDataAttribute(data),
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
  };

  // Update or create a singleton at the specified
  // dot path in the document with the specified
  // id, if we have permission to do so. The
  // widget in the singleton will be saved with the
  // specified JSON-compatible data.

  self.saveArea = function(req, docId, dotPath, items, callback) {
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

        if (_.contains(self.forbiddenAreas, components[0])) {
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

        deep(doc, dotPath, {
          type: 'area',
          items: items
        });
        return self.apos.docs.update(req, doc, callback);
      }
    }, callback);
  };

  // Walk the areas in a doc. The callback receives the
  // area object and the dot-notation path to that object.
  //
  // If the callback explicitly returns `false`, the area
  // is *removed* from the page object, otherwise no
  // modifications are made.

  self.walk = function(doc, callback) {
    return self.apos.docs.walk(doc, function(o, k, v, dotPath) {
      if (v && (v.type === 'area')) {
        return callback(v, dotPath);
      }
    });
  };

  // merge new methods with all apostrophe-cursors
  self.apos.define('apostrophe-cursor', require('./cursor.js'));
};
