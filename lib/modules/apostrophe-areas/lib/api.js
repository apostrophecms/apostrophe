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
        
        var existingArea = deep(doc, dotPath);
        var existingItems = (existingArea && existingArea.items) || [];
        if (_.isEqual(self.apos.utils.clonePermanent(items), self.apos.utils.clonePermanent(existingItems))) {
          // No real change — don't waste a version and clutter the database.
          // Sometimes only the server-side sanitizers can tell accurately that
          // nothing has changed. -Tom
          return setImmediate(callback);
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
    var manager = self.apos.docs.getManager(doc.type);
    if (!manager) {
      // This happens if we try to find the schema options for an area in
      // a widget or something else that isn't a top level doc type, or
      // the projection did not include type.
      //
      // TODO: a better solution to the entire option-forwarding problem? -Tom
      return {};
    }
    var schema = manager.schema;
    var field = _.find(schema, 'name', name);
    if (!(field && field.options)) {
      return {};
    }
    return field.options;
  };

  self.richTextWidgetTypes = [];

  // Returns the rich text markup of all rich text widgets
  // within the provided doc or area, concatenated as a single string.
  //
  // By default the rich text contents of the widgets are joined with
  // a newline between. You may pass your own `options.delimiter` string if
  // you wish a different delimiter or the empty string. You may also pass
  // an HTML element name like `div` via `options.wrapper` to wrap each
  // one in a `<div>...</div>` block. Of course, there may already be a div
  // in the rich txt (but then again there may not).
  //
  // Also available as a helper via `apos.areas.richText(area, options)` in templates.
  //
  // Content will be retrieved from any widget type that supplies a
  // `getRichText` method.

  self.richText = function(within, options) {

    options = options || {};

    function test(attachment) {
      if ((!attachment) || (typeof(attachment) !== 'object')) {
        return false;
      }
      if (!_.contains(self.richTextWidgetTypes, attachment.type)) {
        return false;
      }
      return true;
    }

    var winners = [];
    if (!within) {
      return '';
    }
    self.apos.docs.walk(within, function(o, key, value, dotPath, ancestors) {
      if (test(value)) {
        winners.push(value);
      }
    });
    if (options.wrapper) {
      return _.map(winners, function(winner) {
        return '<' + options.wrapper + '>' + winner.content + '</' + options.wrapper + '>';
      }).join('');
    }
    var delimiter = (options.delimiter !== undefined) ? options.delimiter : '\n';
    return _.pluck(winners, 'content').join(delimiter);
  };

  // Returns the plaintext contents  of all rich text widgets
  // within the provided doc or area, concatenated as a single string.
  //
  // By default the rich text contents of the various widgets are joined with
  // a newline between. You may pass your own `options.delimiter` string if
  // you wish a different delimiter or the empty string.
  //
  // Whitespace is trimmed off the leading and trailing edges of the string, and
  // consecutive newlines are condensed to one, to better match reasonable expectations
  // re: text that began as HTML.
  //
  // Pass `options.limit` to limit the number of characters. This method will
  // return fewer characters in order to avoid cutting off in mid-word.
  //
  // By default, three periods (`...`) follow a truncated string. If you prefer,
  // set `options.ellipsis` to a different suffix, which may be the empty string
  // if you wish.
  //
  // Also available as a helper via `apos.areas.plaintext(area, options)` in templates.
  //
  // Content will be retrieved from any widget type that supplies a
  // `getRichText` method.

  self.plaintext = function(within, options) {
    options = options || {};
    var richText = self.richText(within, options);
    var plaintext = self.apos.utils.htmlToPlaintext(richText).trim();
    plaintext = plaintext.replace(/\n+/g, '\n');
    if (!options.limit) {
      return plaintext;
    }
    var ellipsis = '...';
    if (options.ellipsis !== undefined) {
      ellipsis = options.ellipsis;
    }
    return self.apos.utils.truncatePlaintext(plaintext, options.limit, ellipsis);
  };

  // Very handy for imports of all kinds: convert plaintext to an area with
  // one `apostrophe-rich-text` widget if it is not blank, otherwise an empty area. null and
  // undefined are tolerated and converted to empty areas.

  self.fromPlaintext = function(plaintext) {
    var area = { type: 'area', items: [] };
    if (plaintext && plaintext.length) {
      plaintext = plaintext.toString();
      area.items.push({
        type: 'apostrophe-rich-text',
        content: self.apos.utils.escapeHtml(plaintext, true)
      });
    }
    return area;
  };

  // When all modules are ready and all widget managers therefore should have been
  // added, determine the list of rich text widgets for purposes of the
  // apos.areas.richText() method which returns just the rich text of the area

  self.modulesReady = function() {
    _.each(self.widgetManagers, function(manager, name) {
      if (manager.getRichText) {
        self.richTextWidgetTypes.push(name);
      }
    });
  };
  
  // Load widgets which were deferred until as late as possible. Only
  // comes into play if `req.deferWidgetLoading` was set to true for
  // the request. Invoked after the last `pageBeforeSend` handler, and
  // also at the end of the `apostrophe-global` middleware.

  self.loadDeferredWidgets = function(req, callback) {
    if (!req.deferWidgetLoading) {
      return callback(null);
    }
    req.loadingDeferredWidgets = true;
    return async.eachSeries(_.keys(req.deferredWidgets), function(type, callback) {
      var manager = self.apos.areas.getWidgetManager(type);
      return manager.load(req, req.deferredWidgets[type], callback);
    }, callback);
  };

  // merge new methods with all apostrophe-cursors
  self.apos.define('apostrophe-cursor', require('./cursor.js'));
};
