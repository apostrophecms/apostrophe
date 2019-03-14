var _ = require('lodash');
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
    // Ability to disable editing for a specific request
    if (self.apos.templates.contextReq.disableEditing) {
      if (area._edit && (options.edit !== false)) {
        area._disabledEditing = true;
      }
      area._edit = false;
    }
    const choices = [];
    _.each(options.widgets, function(options, name) {
      choices.push({
        name: name,
        label: options.addLabel || (self.widgetManagers[name] && self.widgetManagers[name].label) || '*ERROR*'
      });
    });
    // Guarantee that `items` at least exists
    area.items = area.items || [];
    return self.partial('area', {
      // TODO filter area to exclude big joined objects, but
      // not so sloppy this time please
      area: area,
      options: options,
      choices: choices
    });
  };

  // Sanitize an input array of items intended to become
  // the `items` property of an area. Invokes the
  // sanitize method for each widget's manager. Widgets
  // with no manager are discarded. Invoked for you by
  // the routes that save areas and by the implementation
  // of the `area` schema field type.
  //
  // The `options` parameter contains the area-level
  // options to sanitize against. Thus h5 can be legal
  // in one rich text widget and not in another.
  //
  // If any errors occur sanitizing the individual widgets,
  // an array of errors with `path` and `error` properties
  // is thrown.
  // 
  // Returns a new array of sanitized items.

  self.sanitizeItems = async function(req, options, items) {
    const result = [];
    const errors = [];
    const i = 0;
    const widgetsOptions = options.widgets || {};
    for (const item of items) {
      if (((typeof item) !== 'object') || ((typeof item.type) !== 'string')) {
        continue;
      }
      const manager = self.getWidgetManager(item.type);
      if (!manager) {
        self.warnMissingWidgetType(item.type);
        continue;
      }
      const widgetOptions = widgetsOptions[item.type] || {};
      if (!self.apos.utils.isBlessed(req, widgetOptions, 'widget', item.type)) {
        errors.push({
          path: i,
          error: 'unblessed'
        });
        continue;
      }
      try {
        const item = await manager.sanitize(req, item, widgetOptions);
      } catch (e) {
        if (Array.isArray(e)) {
          for (const error of e) {
            errors.push({
              path: i + '.' + error.path,
              error: error.error
            });
          }
        } else {
          errors.push({
            path: i,
            error: e
          });
        }
      }
      i++;
      result.push(item);
    }
    if (errors.length) {
      throw errors;
    } else {
      return result;
    }
  };

  // Renders markup for a widget of the given `type`. The actual
  // content of the widget is passed in `data`. Returns html on
  // success. Invoked by the `render-widget` route, which is used
  // to update a widget on the page after it is saved, or for
  // preview when editing.

  self.renderWidget = function(req, type, data, options) {
    const manager = self.getWidgetManager(type);
    if (!manager) {
      // No manager available - possibly a stale widget in the database
      // of a type no longer in the project
      self.warnMissingWidgetType(type);
      return '';
    }
    data.type = type;

    var render;
    if (!manager.options.wrapperTemplate) {
      render = _.partial(self.render, req, 'widget');
    } else {
      render = _.partial(manager.render, req, manager.options.wrapperTemplate);
    }

    return render({
      widget: data,
      dataFiltered: manager.filterForDataAttribute(data),
      options: options,
      manager: manager,
      output: function() {
        return manager.output(data, options);
      }
    });
  };

  // Update or create an area at the specified
  // dot path in the document with the specified
  // id, if we have permission to do so. The change is
  // saved in the database. The
  // `items` array is NOT sanitized here; you should call
  // `sanitizeItems` first. Called for you by the
  // `save-area` route.

  self.saveArea = async function(req, docId, dotPath, items) {

    const doc = await find();
    return await update(doc);

    async function find() {
      const doc = await self.apos.docs.find(req, { _id: docId })
        .permission('edit-doc')
        .published(null)
        .toObject();
      if (!doc) {
        throw 'notfound';
      }
      return doc;
    }

    async function update() {
      const components = dotPath.split(/\./);

      if (_.includes(self.forbiddenAreas, components[0])) {
        throw 'forbidden';
      }

      // If it's not a top level property, it's
      // always okay - unless it already exists
      // and is not an area.

      if (components.length > 1) {
        const existing = deep(doc, dotPath);
        if (existing && (existing.type !== 'area')) {
          throw 'forbidden';
        }
      }

      const existingArea = deep(doc, dotPath);
      const existingItems = (existingArea && existingArea.items) || [];
      if (_.isEqual(self.apos.utils.clonePermanent(items), self.apos.utils.clonePermanent(existingItems))) {
        // No real change — don't waste a version and clutter the database.
        // Sometimes only the server-side sanitizers can tell accurately that
        // nothing has changed. -Tom
        return;
      }

      deep(doc, dotPath, {
        type: 'area',
        items: items
      });
      return await self.apos.docs.update(req, doc);
    }

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
  // This method performs sanitization of all properties of
  // `areaInfo` before trusting it, so passing `req.body`
  // is a safe thing to do.

  self.lockSanitizeAndSaveArea = async function(req, areaInfo) {
    if (typeof (areaInfo) !== 'object') {
      throw new Error('areaInfo is not an object');
    }
    let items = Array.isArray(areaInfo.items) ? areaInfo.items : [];
    const docId = self.apos.launder.id(areaInfo.docId);
    const dotPath = self.apos.launder.string(areaInfo.dotPath);
    const options = areaInfo.options;
    if (!(items && options && options.widgets && docId && dotPath)) {
      throw new Error('Area is missing one or more required parameters for saving');
    }
    if (!dotPath.match(/^[\w.]+$/)) {
      throw new Error('Invalid dotpath: ' + dotPath + '. Make sure your area or singleton name uses only alphanumeric characters.');
    }

    await lock();
    items = await sanitizeItems();
    await saveArea();

    async function lock() {
      if (!(req.htmlPageId && req.user)) {
        // Some consumers of this API might not participate
        // in advisory locking. Also, make sure we have a
        // valid user to minimize the risk of a DOS attack
        // via nuisance locking
        return;
      }
      return await self.apos.docs.lock(req, docId, req.htmlPageId);
    }

    async function sanitizeItems() {
      return await self.sanitizeItems(req, items);
    }
    async function saveArea() {
      await self.saveArea(req, docId, dotPath, items);
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
      if (!_.includes(self.richTextWidgetTypes, attachment.type)) {
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
    return _.map(winners, 'content').join(delimiter);
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
        _id: self.apos.utils.generateId(),
        type: 'apostrophe-rich-text',
        content: self.apos.utils.escapeHtml(plaintext, true)
      });
    }
    return area;
  };

  // Convert HTML to an area with one 'apostrophe-rich-text' widget, otherwise
  // an empty area. null and undefined are tolerated and converted to empty areas.

  self.fromRichText = function (html) {
    var area = { type: 'area', items: [] };
    if (html && html.length) {
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

  self.on('apostrophe:modulesReady', 'getRichTextWidgetTypes', function() {
    _.each(self.widgetManagers, function(manager, name) {
      if (manager.getRichText) {
        self.richTextWidgetTypes.push(name);
      }
    });
  });

  // Load widgets which were deferred until as late as possible. Only
  // comes into play if `req.deferWidgetLoading` was set to true for
  // the request. Invoked after the last `pageBeforeSend` handler, and
  // also at the end of the `apostrophe-global` middleware.

  self.loadDeferredWidgets = async function(req) {
    if (!req.deferWidgetLoading) {
      return;
    }
    req.loadingDeferredWidgets = true;
    for (let type of _.keys(req.deferredWidgets)) {
      const manager = self.getWidgetManager(type);
      if (!manager) {
        self.warnMissingWidgetType(type);
        continue;
      }
      await manager.load(req, req.deferredWidgets[type]);
    }
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
      area = doc[name];
    } else {
      // "doc" is an options object
      area = doc.area;
    }
    if (!area) {
      return true;
    }
    return !_.some(area.items, function(item) {
      var manager = self.getWidgetManager(item.type);
      if (manager && manager.isEmpty) {
        return !manager.isEmpty(item);
      } else {
        return true;
      }
    });

  }; 

  self.blessedError = function() {
    return new Error('The widget options are not blessed. Usually this means you are\n' +
      'editing the same widget both contextually and in a dialog box, and\n' +
      'you are not passing the same widget options in index.js and in the\n' +
      'template, or you are not passing the widget options in index.js\n' +
      'at all. Either set the area to contextual: true, which keeps it\n' +
      'out of the dialog box, or set the "widgets" option to match the\n' +
      'last argument to "apos.area" in your template.\n\n' +
      'unblessed: ' + item.type + ', ' + JSON.stringify(widgetOptions, null, '  '));
  };

  // merge new methods with all apostrophe-cursors
  self.apos.define('apostrophe-cursor', require('./cursor.js'));
};
