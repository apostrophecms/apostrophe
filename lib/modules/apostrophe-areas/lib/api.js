var _ = require('@sailshq/lodash');
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
  };

  // Print warning message about a missing widget type — only once per run per type.
  self.warnMissingWidgetType = function(name) {
    if (!self.missingWidgetTypes) {
      self.missingWidgetTypes = {};
    }
    if (!self.missingWidgetTypes[name]) {
      self.apos.utils.error('WARNING: widget type ' + name + ' exists in content but is not configured');
      self.missingWidgetTypes[name] = true;
    }
  };

  // Render the given `area` object via `area.html`, passing the
  // specified `options` to the template. Called for you by the
  // `apos.area` and `apos.singleton` template helpers.

  self.renderArea = function(area, options) {
    if (!(area && ((typeof area) === 'object'))) {
      throw new Error('renderArea must be called with (area, options).');
    }
    options = options || {};
    // Ability to disable editing for a specific request
    if (self.apos.templates.contextReq.disableEditing) {
      if (area._edit && (options.edit !== false)) {
        area._disabledEditing = true;
      }
      area._edit = false;
    }
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
  //
  // If the sanitize method of a widget manager reports
  // a string error, this method will report a string error
  // like "5.required", where `5` is the index of the
  // widget in the area and `required` is the string error
  // from the widget.

  self.sanitizeItems = function(req, items, callback) {
    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument to sanitizeItems(). Must be called with (req, items, callback).'));
    }
    if (!Array.isArray(items)) {
      return callback(new Error('You did not pass an array of items as the second argument to sanitizeItems(). Must be called with (req, items, callback).'));
    }
    items = items || [];
    var result = [];
    var i = 0;
    return async.eachSeries(items, function(item, callback) {
      if ((typeof (item) !== 'object') || (typeof (item.type) !== 'string')) {
        return setImmediate(callback);
      }
      var manager = self.getWidgetManager(item.type);
      if (!manager) {
        self.warnMissingWidgetType(item.type);
        return setImmediate(callback);
      }
      return manager.sanitize(req, item, function(err, item) {
        if (err) {
          if ((typeof err) === 'string') {
            return callback(i + '.' + err);
          }
          return callback(err);
        }
        i++;
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
    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument. renderWidget expects (req, type, data, options, callback)'));
    }
    if (!(type && ((typeof type) === 'string'))) {
      return callback(new Error('You did not pass a type string as the second argument. renderWidget expects (req, type, data, options, callback)'));
    }
    if (!(data && ((typeof data) === 'object'))) {
      return callback(new Error('You did not pass a data object as the third argument. renderWidget expects (req, type, data, options, callback)'));
    }
    if (!(options && ((typeof options) === 'object'))) {
      return callback(new Error('You did not pass an options object as the fourth argument. renderWidget expects (req, type, data, options, callback)'));
    }
    var manager = self.getWidgetManager(type);
    if (!manager) {
      // No manager available - possibly a stale widget in the database
      // of a type no longer in the project
      self.warnMissingWidgetType(type);
      return callback(null, '');
    }
    data.type = type;

    var render;
    if (!manager.options.wrapperTemplate) {
      render = _.partial(self.render, req, 'widget');
    } else {
      render = _.partial(manager.render, req, manager.options.wrapperTemplate);
    }

    try {
      return callback(null, render({
        widget: data,
        dataFiltered: manager.filterForDataAttribute(data),
        options: options,
        manager: manager,
        output: function() {
          return manager.output(data, options);
        }
      }));
    } catch (e) {
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
    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument to saveArea, which expects (req, docId, dotPath, items, callback)'));
    }
    if (!(docId && ((typeof docId) === 'string') && docId.length)) {
      return callback(new Error('You forgot to pass a non-empty string docId as the second argument to saveArea, which expects (req, docId, dotPath, items, callback)'));
    }
    if (!(dotPath && ((typeof dotPath) === 'string') && dotPath.length)) {
      return callback(new Error('You forgot to pass a non-empty string dotPath as the third argument to saveArea, which expects (req, docId, dotPath, items, callback)'));
    }
    if (!(items && Array.isArray(items))) {
      return callback(new Error('You forgot to pass an array of items as the fourth argument to saveArea, which expects (req, docId, dotPath, items, callback)'));
    }
    var doc;
    return async.series({
      find: function(callback) {
        return self.apos.docs.find(req, { _id: docId })
          .permission('edit-doc')
          .published(null)
          .toObject(function(err, _doc) {
            if (err) {
              self.apos.utils.error(err);
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
        var manager = self.apos.docs.getManager(doc.type);
        if (manager && manager.update) {
          return manager.update(req, doc, callback);
        } else {
          return self.apos.docs.update(req, doc, callback);
        }
      }
    }, function(err) {
      return callback(err);
    });
  };

  // Lock, sanitize and save the area described by `areaInfo` on behalf
  // of `req`.
  //
  // `areaInfo` must have `items`, `docId` and `dotPath`
  // parameters. For bc, if `req.htmlPageId` is not present
  // then advisory locking is not performed.
  //
  // Note that the area is not unlocked. This method is designed
  // for autosave operations, which continue until the page
  // is unloaded, at which time the `save-areas-and-unlock`
  // route will be accessed.
  //
  //
  // This method performs sanitization of all properties of
  // `areaInfo` before trusting it, so passing `req.body`
  // is a safe thing to do.

  self.lockSanitizeAndSaveArea = function(req, areaInfo, callback) {
    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument to lockSanitizeAndSaveArea, which expects (req, areaInfo, callback)'));
    }
    if ((!areaInfo) || ((typeof areaInfo) !== 'object')) {
      return callback(new Error('You forgot to pass areaInfo as the second argument to lockSanitizeAndSaveArea, which expects (req, areaInfo, callback)'));
    }
    var items = Array.isArray(areaInfo.items) ? areaInfo.items : [];
    var docId = self.apos.launder.id(areaInfo.docId);
    var dotPath = self.apos.launder.string(areaInfo.dotPath);
    var hardLocked = false;
    if (!(items && options && docId && dotPath)) {
      return callback(new Error('Area is missing one or more required parameters for saving'));
    }
    if (!dotPath.match(/^[\w.]+$/)) {
      return callback(new Error('Invalid dotpath: ' + dotPath + '. Make sure your area or singleton name uses only alphanumeric characters.'));
    }
    return async.series([
      hardLock,
      advisoryLock,
      sanitizeItems,
      saveArea
    ], function(err) {
      if (hardLocked) {
        return self.apos.locks.unlock('save-area-' + docId, function(_err) {
          return callback(err || _err);
        });
      }
      return callback(err);
    });
    // Also grab a hard lock on this document, just for the duration
    // of the actual "load, sanitize stuff, and update" operation,
    // to avoid a race condition if saving two areas around the
    // same time, as can happen during drag and drop between areas
    function hardLock(callback) {
      return self.apos.locks.lock('save-area-' + docId, { waitForSelf: true }, function(err) {
        if (err) {
          return callback(err);
        }
        hardLocked = true;
        return callback(null);
      });
    }
    // Grab an advisory lock, letting other users and tabs know
    // who is editing this right now
    function advisoryLock(callback) {
      if (!(req.htmlPageId && req.user)) {
        // Some consumers of this API might not participate
        // in advisory locking. Also, make sure we have a
        // valid user to minimize the risk of a DOS attack
        // via nuisance locking
        return callback(null);
      }
      return self.apos.docs.lock(req, docId, req.htmlPageId, callback);
    }
    function sanitizeItems(callback) {
      return self.sanitizeItems(req, items, function(err, _items) {
        items = _items;
        return callback(err);
      });
    }
    function saveArea(callback) {
      return self.saveArea(req, docId, dotPath, items, callback);
    }
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
    if (!(doc && doc.type)) {
      // Probably an area or singleton helper call without a
      // doc object, we cannot find a schema, but nor should
      // we crash
      return {};
    }
    if ((!name) || ((typeof name) !== 'string')) {
      // Probably an area or singleton helper call without a
      // doc object, we cannot find a schema, but nor should
      // we crash
      return {};
    }
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
      if ((!attachment) || (typeof (attachment) !== 'object')) {
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
  // Takes an option `el` if you wish to specify a wrapper element. Ex: `fromPlaintext(text, { el: 'p' })`.

  self.fromPlaintext = function(plaintext, options) {
    const area = { type: 'area', items: [] };
    let content = '';
    if (plaintext && ((typeof plaintext) === 'string') && plaintext.length) {
      plaintext = plaintext.toString();
      if (options && options.el) {
        content = `<${options.el}>${self.apos.utils.escapeHtml(plaintext, true)}</${options.el}>`;
      } else {
        content = self.apos.utils.escapeHtml(plaintext, true);
      }
      area.items.push({
        _id: self.apos.utils.generateId(),
        type: 'apostrophe-rich-text',
        content
      });
    }
    return area;
  };

  // Convert HTML to an area with one 'apostrophe-rich-text' widget, otherwise
  // an empty area. null and undefined are tolerated and converted to empty areas.

  self.fromRichText = function (html) {
    var area = { type: 'area', items: [] };
    if (html && ((typeof html) === 'string') && html.length) {
      html = html.toString();
      area.items.push({
        _id: self.apos.utils.generateId(),
        type: 'apostrophe-rich-text',
        content: html
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
    if (!(req && req.res)) {
      return callback(new Error('You forgot to pass req as the first argument to loadDeferredWidgets, which expects (req, callback). This method is normally called for you just before the page is rendered. You should not need to call it yourself.'));
    }
    if (!req.deferWidgetLoading) {
      return callback(null);
    }
    req.loadingDeferredWidgets = true;
    return async.eachSeries(_.keys(req.deferredWidgets), function(type, callback) {
      var manager = self.getWidgetManager(type);
      if (!manager) {
        self.warnMissingWidgetType(type);
        return setImmediate(callback);
      }
      return manager.load(req, req.deferredWidgets[type], callback);
    }, callback);
  };

  // This method is called when rendering widgets in an area,
  // to add top-level controls to them, such as the movement arrows
  // and the edit pencil. It can be extended to add more controls in
  // a context-sensitive way, or configured via the addWidgetControlGroups
  // option (see the source, TODO: document the format in detail)

  self.widgetControlGroups = function(req, widget, options) {
    if (!(req && req.res)) {
      throw new Error('You forgot to pass req as the first argument to widgetControlGroups, which expects (req, widget, options).');
    }
    if (!widget) {
      throw new Error('You forgot to pass a widget as the second argument to widgetControlGroups, which expects (req, widget, options).');
    }
    options = options || {};
    var controlGroups = ([
      {
        classes: '',
        controls: [
          {
            icon: 'arrows',
            action: 'drag-item',
            tooltip: 'Drag'
          },
          {
            icon: 'arrow-up',
            action: 'move-item',
            value: 'up',
            tooltip: 'Move Up'
          },
          {
            icon: 'arrow-down',
            action: 'move-item',
            value: 'down',
            tooltip: 'Move Down'
          },
          {
            icon: 'clone',
            action: 'clone-item',
            tooltip: 'Clone Widget'
          }
        ]
      },
      {
        classes: 'apos-button-group--data',
        controls: [
          {
            label: '$editLabel',
            action: 'edit-item'
          }
        ]
      },
      {
        classes: '',
        controls: [
          {
            icon: 'trash',
            action: 'trash-item',
            tooltip: 'Trash'
          }
        ]
      }
    ] || self.options.widgetControlGroups).concat(self.options.addWidgetControlGroups || []);
    controlGroups = _.cloneDeep(controlGroups);
    controlGroups = _.filter(controlGroups, function(controlGroup) {
      controlGroup.controls = _.filter(controlGroup.controls || [], function(control) {
        var action;
        if (options.controls && (options.controls.movable === false)) {
          action = control.action;
          if ((action === 'move-item') || (action === 'drag-item')) {
            return false;
          }
        }
        if ((options.controls && options.controls.removable === false)) {
          action = control.action;
          if (action === 'trash-item') {
            return false;
          }
        }
        if ((options.controls && options.controls.cloneable === false)) {
          action = control.action;
          if (action === 'clone-item') {
            return false;
          }
        }
        var manager = widget && self.getWidgetManager(widget.type);
        if (manager && manager.options.contextualOnly) {
          action = control.action;
          if (action === 'edit-item') {
            return false;
          }
        }
        return true;
      });
      return controlGroup.controls.length > 0;
    });
    // Don't crash on bad data
    if (widget.type) {
      controlGroups = self.addSchemaWidgetControls(req, widget, controlGroups);
    }
    return controlGroups;
  };

  // Adds any schema fields of the widget marked with widgetControls: true
  // as dropdowns amongst the widget's in-context inline controls. Currently
  // only supported for "select" and "checkboxes" fields. Here a "checkboxes" field
  // is visually represented in a more compact way using a multiple-select dropdown.

  self.addSchemaWidgetControls = function(req, widget, controlGroups) {
    var manager = self.getWidgetManager(widget.type);
    var schema = manager.allowedSchema(req);
    schema = _.filter(schema, {
      widgetControls: true
    });
    if (!schema.length) {
      return controlGroups;
    }
    return controlGroups.concat([{
      classes: 'apos-widget-schema-controls',
      controls: schema
    }]);
  };

  // Returns true if the named area in the given `doc` is empty.
  //
  // Alternate syntax: `{ area: doc.areaname, ... more options }`
  //
  // An area is empty if it has no widgets in it, or when
  // all of the widgets in it return true when their
  // `isEmpty()` methods are interrogated. For instance,
  // if an area only contains a rich text widget and that
  // widget. A widget with no `isEmpty()` method is never empty.

  self.isEmpty = function(doc, name) {
    var area;
    if (arguments.length === 2) {
      if (!(doc && ((typeof doc) === 'object'))) {
        throw new Error('You did not pass doc as the first argument to isEmpty, which expects (doc, name).');
      }
      if (!(name && ((typeof name) === 'string'))) {
        throw new Error('You did not pass a name as the first argument to isEmpty, which expects (doc, name).');
      }
      area = doc[name];
    } else {
      // "doc" is an options object
      if (!doc) {
        throw new Error('When invoking isEmpty with only one argument, that argument must be an object with an area property');
      }
      area = doc.area;
    }
    if (!area) {
      return true;
    }
    return !_.some(area.items || [], function(item) {
      var manager = self.getWidgetManager(item.type);
      if (manager && manager.isEmpty) {
        return !manager.isEmpty(item);
      } else {
        return true;
      }
    });

  };

  // merge new methods with all apostrophe-cursors
  self.apos.define('apostrophe-cursor', require('./cursor.js'));
};
