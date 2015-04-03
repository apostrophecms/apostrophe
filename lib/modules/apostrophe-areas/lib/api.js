var _ = require('lodash');
var async = require('async');
var deep = require('deep-get-set');

module.exports = function(self, options) {

  self.widgetDefinitions = {};

  self.defineWidget = function(name, definition) {
    self.widgetDefinitions[name] = definition;
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
        if (_.inArray(forbiddenAreas, components[0])) {
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

        deep(doc, dotPath, data);
        return self.apos.docs.update(req, doc, callback);
      }
    }, function(err) {
      if (err) {
        return callback(err);
      }
      var definition = self.widgetDefinitions[widget.type];
      return self.render(req, 'widget', {
        widget: widget,
        options: options,
        definition: definition,
        output: function() {
          return definition.output(widget, options);
        }
      });
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

};
