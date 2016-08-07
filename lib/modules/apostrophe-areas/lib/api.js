var _ = require('lodash');
var async = require('async');
var deep = require('deep-get-set');

module.exports = function(self, options) {

  // These properties have special meaning in Apostrophe docs and are not
  // acceptable for use as top-level area names

  self.forbiddenAreas = [ '_id', 'title', 'slug', 'titleSort', 'docPermissions', 'tags', 'type', 'path', 'rank', 'level' ];

  self.widgetManagers = {};

  // Set the manager object for the given widget type name. The manager is
  // expected to provide `sanitize`, `output` and `load` methods. Normally
  // this method is called for you when you extend the `apostrophe-widgets`
  // module, which is recommended.

  self.setWidgetManager = function(name, manager) {
    self.widgetManagers[name] = manager;
  };

  // Get the manager object for the given widget type name.

  self.getWidgetManager = function(name) {
    return self.widgetManagers[name];
  }

  // Render the given `area` object via `area.html`, passing the
  // specified `options` to the template. Called for you by the
  // `apos.area` and `apos.singleton` template helpers.

  self.renderArea = function(area, options) {
    return self.partial('area', {
      area: area,
      options: options,
      widgetManagers: self.widgetManagers
    });
  };

  // Sanitize an array of items intended to become
  // the `items` property of an area. Invokes the
  // sanitize method for each widget's manager. Widgets
  // with no manager are discarded. Invoked for you by
  // the routes that save areas and by the implementation
  // of the `area` schema field type.

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

  // Renders markup for a widget of the given `type`. The actual
  // content of the widget is passed in `data`. The callback is
  // invoked with `(null, html)` on success. Invoked by the
  // `render-widget` route, which is used to update a widget on the
  // page after it is saved.

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

  // Update or create an area at the specified
  // dot path in the document with the specified
  // id, if we have permission to do so. The change is
  // saved in the database before the callback is invoked. The
  // `items` array is NOT sanitized here; you should call
  // `sanitizeItems` first. Called for you by the
  // `save-area` route.

  self.saveArea = function(req, docId, dotPath, items, callback) {
    return async.series({
      find: function(callback) {
        return self.apos.docs.find(req, { _id: docId })
          .permission('edit-doc')
          .published(null)
          .toObject(function(err, _doc) {
            if (err) {
              return callback(err);
            }
            if (!_doc) {
              return callback(new Error('notfound'));
            }
            doc = _doc;
            return callback(null);
          }
        );
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

  // Walk the areas in a doc. Your iterator function is invoked once
  // for each area found, and receives the
  // area object and the dot-notation path to that object.
  // note that areas can be deeply nested in docs via
  // array schemas.
  //
  // If the iterator explicitly returns `false`, the area
  // is *removed* from the page object, otherwise no
  // modifications are made. This happens in memory only;
  // the database is not modified.

  self.walk = function(doc, iterator) {
    return self.apos.docs.walk(doc, function(o, k, v, dotPath) {
      if (v && (v.type === 'area')) {
        return iterator(v, dotPath);
      }
    });
  };

  // If the schema corresponding to the given doc's
  // `type` property has an `options` property for the
  // given field `name`, return that property. This is used
  // to conveniently default to the `options` already configured
  // for a particular area in the schema when working with
  // `apostrophe-pieces` in a page template.

  self.getSchemaOptions = function(doc, name) {
    var schema = self.apos.docs.getManager(doc.type).schema;
    var field = _.find(schema, 'name', name);
    if (!(field && field.options)) {
      return {};
    }
    return field.options;
  };

  // merge new methods with all apostrophe-cursors
  self.apos.define('apostrophe-cursor', require('./cursor.js'));
};
