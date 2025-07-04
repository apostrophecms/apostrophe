const _ = require('lodash');
const { stripIndent } = require('common-tags');

// An area is a series of zero or more widgets, in which users can add
// and remove widgets and drag them to reorder them. This module implements
// areas, with the help of a query builder in the doc module. This module also
// provides browser-side support for invoking the players of widgets in an area
// and for editing areas.

module.exports = {
  options: { alias: 'area' },
  commands(self) {
    return {
      add: {
        [`${self.__meta.name}:cut-widget`]: {
          type: 'item',
          label: 'apostrophe:commandMenuWidgetCut',
          action: {
            type: 'command-menu-area-cut-widget'
          },
          shortcut: 'Ctrl+X Meta+X'
        },
        [`${self.__meta.name}:copy-widget`]: {
          type: 'item',
          label: 'apostrophe:commandMenuWidgetCopy',
          action: {
            type: 'command-menu-area-copy-widget'
          },
          shortcut: 'Ctrl+C Meta+C'
        },
        [`${self.__meta.name}:paste-widget`]: {
          type: 'item',
          label: 'apostrophe:commandMenuWidgetPaste',
          action: {
            type: 'command-menu-area-paste-widget'
          },
          shortcut: 'Ctrl+V Meta+V'
        },
        [`${self.__meta.name}:duplicate-widget`]: {
          type: 'item',
          label: 'apostrophe:commandMenuWidgetDuplicate',
          action: {
            type: 'command-menu-area-duplicate-widget'
          },
          shortcut: 'Ctrl+Shift+D Meta+Shift+D'
        },
        [`${self.__meta.name}:remove-widget`]: {
          type: 'item',
          label: 'apostrophe:commandMenuWidgetRemove',
          action: {
            type: 'command-menu-area-remove-widget'
          },
          shortcut: 'Backspace'
        }
      },
      modal: {
        default: {
          '@apostrophecms/command-menu:content': {
            label: 'apostrophe:commandMenuContent',
            commands: [
              `${self.__meta.name}:cut-widget`,
              `${self.__meta.name}:copy-widget`,
              `${self.__meta.name}:paste-widget`,
              `${self.__meta.name}:duplicate-widget`,
              `${self.__meta.name}:remove-widget`
            ]
          }
        }
      }
    };
  },
  init(self) {
    // These properties have special meaning in Apostrophe docs and are not
    // acceptable for use as top-level area names
    self.forbiddenAreas = [
      '_id',
      'title',
      'slug',
      'titleSort',
      'docPermissions',
      'type',
      'path',
      'rank',
      'level'
    ];
    self.richTextWidgetTypes = [];
    self.widgetManagers = {};

    self.enableBrowserData();
    self.addDeduplicateWidgetIdsMigration();
  },
  apiRoutes(self) {
    return {
      post: {
        async renderWidget(req) {
          const _docId = self.apos.launder.id(req.body._docId);
          const livePreview = self.apos.launder.boolean(req.body.livePreview);
          const {
            manager, widget, field, type, options
          } = await self.validateWidgetRequest(req, livePreview);

          // The sanitization failed, but we are in live preview mode,
          // so we need to return a special error code.
          if (!widget && livePreview) {
            return 'aposLivePreviewSchemaNotYetValid';
          }

          widget._edit = true;
          widget._docId = _docId;
          // So that carrying out relationship loading again can yield results
          // (the idsStorage must be populated as if we were saving)
          self.apos.schema.prepareForStorage(req, widget);
          await load();
          return render();
          async function load() {
            // Hint to call nested widget loaders as if it were a doc
            widget._virtual = true;
            return manager.loadIfSuitable(req, [ widget ]);
          }
          async function render() {
            if (req.aposExternalFront) {
              // Simulate an area and annotate it so that the
              // widget's sub-areas wind up with the right metadata
              const area = {
                metaType: 'area',
                items: [ widget ],
                _docId
              };
              self.apos.template.annotateAreaForExternalFront(field, area);
              // Annotate sub-areas. It's like annotating a doc, but not quite,
              // so this logic is reproduced partially
              self.apos.doc.walk(area, (o, k, v) => {
                if (v && v.metaType === 'area') {
                  const manager = self.apos.util.getManagerOf(o);
                  if (!manager) {
                    self.apos.util.warnDevOnce(
                      'noManagerForDocInExternalFront',
                      `No manager for: ${o.metaType} ${o.type || ''}`
                    );
                    return;
                  }
                  const field = manager.schema.find(f => f.name === k);
                  v._docId = _docId;
                  self.apos.template.annotateAreaForExternalFront(field, v);
                }
              });
              const result = {
                ...req.data,
                options,
                widget
              };
              return result;
            }
            return self.renderWidget(req, type, widget, options);
          }
        },
        async validateWidget(req) {
          const { widget } = await self.validateWidgetRequest(req);
          return {
            widget
          };
        }
      }
    };
  },
  handlers(self) {
    return {
      'apostrophe:modulesRegistered': {
        getRichTextWidgetTypes() {
          _.each(self.widgetManagers, function (manager, name) {
            if (manager.getRichText) {
              self.richTextWidgetTypes.push(name);
            }
          });
        }
      }
    };
  },
  methods(self) {
    return {
      // Set the manager object for the given widget type name. The manager is
      // expected to provide `sanitize`, `output` and `load` methods. Normally
      // this method is called for you when you extend the
      // `@apostrophecms/widget-type` module, which is recommended.
      setWidgetManager(name, manager) {
        self.widgetManagers[name] = manager;
      },
      // Given the options passed to the area field, return the options passed
      // to each widget type, indexed by widget name. This provides a consistent
      // interface regardless of whether `options.widgets` or `options.groups`
      // was used.
      getWidgets(options) {
        let widgets = options.widgets || {};

        if (options.groups) {
          for (const group of Object.keys(options.groups)) {
            widgets = {
              ...widgets,
              ...options.groups[group].widgets
            };
          }
        }

        return widgets;
      },
      // Get the manager object for the given widget type name.
      getWidgetManager(name) {
        return self.widgetManagers[name];
      },
      // Validate a widget request. The `req.body` object is expected to contain
      // - `widget` - the widget object to be validated
      // - `areaFieldId` - the field id of the area field
      // - `type` - the type of the widget
      // Returns an object with the following properties:
      // - `manager` - the widget manager object
      // - `widget` - the sanitized widget object
      // - `field` - the area field object
      // - `type` - the type of the widget
      // - `options` - the options for the widget type
      // If `forLivePreview` is true and the widget is not valid, the method
      // returns the same response but with `widget` set to null. Otherwise,
      // failing to validate the widget results in an `invalid` error
      // being thrown.
      async validateWidgetRequest(req, forLivePreview = false) {
        let widget = typeof req.body.widget === 'object' ? req.body.widget : {};
        const areaFieldId = self.apos.launder.string(req.body.areaFieldId);
        const type = self.apos.launder.string(req.body.type);
        const field = self.apos.schema.getFieldById(areaFieldId);
        if (!field) {
          throw self.apos.error('invalid', 'Missing area field ID');
        }

        const widgets = self.getWidgets(field.options);

        const options = widgets[type] || {};

        const manager = self.getWidgetManager(type);
        if (!manager) {
          self.warnMissingWidgetType(type);
          throw self.apos.error('invalid', 'Missing widget type');
        }
        try {
          widget = await manager.sanitize(req, widget, options);
        } catch (e) {
          if (forLivePreview) {
            return {
              manager,
              widget: null,
              field,
              type,
              options
            };
          }
          throw e;
        }
        return {
          manager,
          widget,
          field,
          type,
          options
        };
      },
      // Print warning message about a missing widget type — only once per run
      // per type.
      warnMissingWidgetType(name) {
        if (!self.missingWidgetTypes) {
          self.missingWidgetTypes = {};
        }
        if (!self.missingWidgetTypes[name]) {
          self.apos.util.error('WARNING: widget type ' + name + ' exists in content but is not configured');
          self.missingWidgetTypes[name] = true;
        }
      },
      prepForRender(area, context, fieldName) {
        const manager = self.apos.util.getManagerOf(context);
        const field = manager.schema.find(field => field.name === fieldName);
        if (!field) {
          throw new Error(`The requested ${context.metaType} has no field named ${fieldName}. In Apostrophe 3.x, areas must be part of the schema for each page or piece type.`);
        }
        area._fieldId = field._id;
        area._docId = context._docId || ((context.metaType === 'doc') ? context._id : null);
        area._edit = context._edit;
        return area;
      },
      // Render the given `area` object via `area.html`, with the given
      // `context` which may be omitted. Called for you by the `{% area %}
      // custom tag.
      //
      // If `inline` is true then the rendering of each widget is attached
      // to the widget as a `_rendered` property, bypassing normal full-area
      // HTML responses, and the return value of this method is `null`.
      async renderArea(req, area, _with, { inline = false } = {}) {
        if (!area._id) {
          throw new Error('All areas must have an _id property in A3.x. Area details:\n\n' + JSON.stringify(area));
        }
        const choices = [];

        const field = self.apos.schema.getFieldById(area._fieldId);

        const options = field.options;
        if (!options) {
          throw new Error(stripIndent`
            The area field ${field.name} has no options property.

            You probably forgot to nest the widgets property
            in an options property.
          `);
        }

        const widgets = self.getWidgets(options);

        options.widgets = widgets;

        _.each(widgets, function (options, name) {
          const manager = self.widgetManagers[name];
          if (manager) {
            choices.push({
              name,
              icon: manager.options.icon,
              label: options.addLabel || manager.label || `No label for ${name}`
            });
          }
        });
        // Guarantee that `items` at least exists
        area.items = area.items || [];
        if (area._docId) {
          for (const item of area.items) {
            item._docId = area._docId;
          }
        }
        const canEdit = area._edit && (options.edit !== false) && req.query.aposEdit;
        if (canEdit) {
          // Ease of access to image URLs. When not editing we
          // just use the helpers
          self.apos.attachment.all(area, { annotate: true });
        }
        if (inline) {
          for (const item of area.items) {
            item._rendered = await self.renderWidget(
              req,
              item.type,
              item,
              widgets[item.type]
            );
          }
          return null;
        }
        return self.render(req, 'area', {
          // TODO filter area to exclude big relationship objects, but
          // not so sloppy this time please
          area,
          field,
          options,
          choices,
          _with,
          canEdit
        });
      },
      // Replace documents' area objects with rendered HTML for each area.
      // This is used by GET requests including the `render-areas` query
      // parameter. `within` is an array of Apostrophe documents.
      //
      // If `inline` is true a rendering of each individual widget is
      // added as an extra `_rendered` property of that widget, alongside
      // its normal properties. Otherwise a rendering of the entire area
      // is supplied as the `_rendered` property of that area and the
      // `items` array is suppressed from the response.
      async renderDocsAreas(req, within, { inline = false } = {}) {
        within = Array.isArray(within) ? within : [];
        let index = 0;
        // Loop over the docs in the array passed in.
        for (const doc of within) {
          const rendered = [];

          const areasToRender = {};
          // Walk the document's areas and stash the areas for rendering later.
          self.walk(doc, async function (area, dotPath) {
            // If this area is the child of another area, then we only want
            // to render the parent area.
            if (rendered.findIndex(path => dotPath.startsWith(`${path}.`)) > -1) {
              return;
            }
            // We're only rendering areas on the document, not ancestor or
            // child page documents.
            const regex = /^_(ancestors|children)|\._(ancestors|children)/;
            if (dotPath.match(regex)) {
              return;
            }

            const parent = findParent(doc, dotPath);
            // Only render areas whose parent has a metaType, which is required
            // to find the area options.
            if (parent && parent.metaType) {
              rendered.push(dotPath);
              areasToRender[dotPath] = area;
            }
          });
          // Now go over the stashed areas and render their areas into HTML.
          for (const path of Object.keys(areasToRender)) {
            const parent = findParent(doc, path);

            await render(areasToRender[path], path, parent);
          }

          within[index] = doc;
          index++;
        }

        async function render(area, path, context, opts) {
          const preppedArea = self.prepForRender(area, context, path);

          const areaRendered = await self.apos.area.renderArea(
            req,
            preppedArea,
            context,
            { inline }
          );
          if (inline) {
            return;
          }
          _.set(context, [ path, '_rendered' ], areaRendered);
          _.set(context, [ path, '_fieldId' ], undefined);
          _.set(context, [ path, 'items' ], undefined);
        }

        function findParent(doc, dotPath) {
          const pathSplit = dotPath.split('.');
          const parentDotPath = pathSplit.slice(0, pathSplit.length - 1).join('.');
          return _.get(doc, parentDotPath, doc);
        }
      },
      // Sanitize an input array of items intended to become
      // the `items` property of an area. Invokes the
      // sanitize method for each widget manager. Widgets
      // with no manager are discarded. Invoked for you by
      // the routes that save areas and by the implementation
      // of the `area` schema field type.
      //
      // The `options` parameter contains the area-level
      // options to sanitize against. Thus h5 can be legal
      // in one rich text widget and not in another.
      //
      // The `convertOptions` parameter allows to pass options
      // to the convert method to alter them.
      //
      // If any errors occur sanitizing the individual widgets,
      // an array of errors with `path` and `error` properties
      // is thrown.
      //
      // Returns a new array of sanitized items.
      async sanitizeItems(req, items, options, convertOptions = {}) {
        options = options || {};
        const result = [];
        const errors = [];
        const widgetsOptions = self.getWidgets(options);

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if ((item == null) || typeof item !== 'object' || typeof item.type !== 'string') {
            continue;
          }
          const manager = self.getWidgetManager(item.type);
          if (!manager) {
            self.warnMissingWidgetType(item.type);
            continue;
          }
          const widgetOptions = widgetsOptions[item.type];
          if (!widgetOptions) {
            // This widget is not specified for this area at all
            continue;
          }
          let newItem;
          try {
            newItem = await manager.sanitize(req, item, widgetOptions, convertOptions);
            newItem._id = self.apos.launder.id(item._id) || self.apos.util.generateId();
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
          result.push(newItem);
        }
        if (errors.length) {
          throw errors;
        } else {
          return result;
        }
      },
      // Renders markup for a widget of the given `type`. The actual
      // content of the widget is passed in `data`. Returns html on
      // success. Invoked by the `render-widget` route, which is used
      // to update a widget on the page after it is saved, or for
      // preview when editing.
      async renderWidget(req, type, data, options) {
        try {
          const manager = self.getWidgetManager(type);
          if (!manager) {
            // No manager available - possibly a stale widget in the database
            // of a type no longer in the project
            self.warnMissingWidgetType(type);
            return '';
          }
          data.type = type;
          return manager.output(req, data, options);
        } catch (e) {
          console.error(e);
          throw e;
        }
      },
      // Update or create an area at the specified
      // dot path in the document with the specified
      // id, if we have permission to do so. The change is
      // saved in the database. The
      // `items` array is NOT sanitized here; you should call
      // `sanitizeItems` first. Called for you by the
      // `save-area` route.
      async saveArea(req, docId, dotPath, items) {
        const doc = await find();
        return update(doc);
        async function find() {
          const doc = await self.apos.doc.find(req, { _id: docId }).permission('edit').toObject();
          if (!doc) {
            throw self.apos.error('notfound');
          }
          return doc;
        }
        async function update(doc) {
          const components = dotPath.split(/\./);
          if (_.includes(self.forbiddenAreas, components[0])) {
            throw self.apos.error('forbidden');
          }
          // If it's not a top level property, it's
          // always okay - unless it already exists
          // and is not an area.
          if (components.length > 1) {
            const existing = _.get(doc, dotPath);
            if (existing && existing.metaType !== 'area') {
              throw self.apos.error('forbidden');
            }
          }
          const existingArea = _.get(doc, dotPath);
          const existingItems = existingArea && (existingArea.items || []);
          const isEqual = _.isEqual(
            self.apos.util.clonePermanent(items),
            self.apos.util.clonePermanent(existingItems)
          );
          if (isEqual) {
            // No real change — don't waste a version and clutter the database.
            // Sometimes only the server-side sanitizers can tell accurately
            // that nothing has changed. -Tom
            return;
          }
          _.set(doc, dotPath, {
            metaType: 'area',
            items
          });
          return self.apos.doc.update(req, doc);
        }
      },
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
      walk(doc, iterator) {
        // o = object/doc, k = key, v = value
        return self.apos.doc.walk(doc, function (o, k, v, dotPath) {
          if (v && v.metaType === 'area') {
            return iterator(v, dotPath);
          }
        });
      },
      // If the schema corresponding to the given doc's
      // `type` property has an `options` property for the
      // given field `name`, return that property. This is used
      // to conveniently default to the `options` already configured
      // for a particular area in the schema when working with
      // `@apostrophecms/piece-type` in a page template.
      getSchemaOptions(doc, name) {
        const manager = self.apos.doc.getManager(doc.type);
        if (!manager) {
          // This happens if we try to find the schema options for an area in
          // a widget or something else that isn't a top level doc type, or
          // the projection did not include type.
          //
          // TODO: a better solution to the entire option-forwarding problem?
          // -Tom
          return {};
        }
        const schema = manager.schema;
        const field = schema?.find(field => field.name === name);
        if (!(field && field.options)) {
          return {};
        }
        return field.options;
      },
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
      // Also available as a helper via `apos.area.richText(area, options)` in
      // templates.
      //
      // Content will be retrieved from any widget type that supplies a
      // `getRichText` method.
      richText(within, options) {
        options = options || {};
        function test(attachment) {
          if (!attachment || typeof attachment !== 'object') {
            return false;
          }
          if (!_.includes(self.richTextWidgetTypes, attachment.type)) {
            return false;
          }
          return true;
        }
        const winners = [];
        if (!within) {
          return '';
        }
        self.apos.doc.walk(within, function (o, key, value, dotPath, ancestors) {
          if (test(value)) {
            winners.push(value);
          }
        });
        if (options.wrapper) {
          return _.map(winners, function (winner) {
            return '<' + options.wrapper + '>' + winner.content + '</' + options.wrapper + '>';
          }).join('');
        }
        const delimiter = options.delimiter !== undefined ? options.delimiter : '\n';
        return _.map(winners, 'content').join(delimiter);
      },
      // Returns the plaintext contents  of all rich text widgets
      // within the provided doc or area, concatenated as a single string.
      //
      // By default the rich text contents of the various widgets are joined
      // with a newline between. You may pass your own `options.delimiter`
      // string if you wish a different delimiter or the empty string.
      //
      // Whitespace is trimmed off the leading and trailing edges of the
      // string, and consecutive newlines are condensed to one, to better match
      // reasonable expectations. re: text that began as HTML.
      //
      // Pass `options.limit` to limit the number of characters. This method
      // will return fewer characters in order to avoid cutting off in mid-word.
      //
      // By default, three periods (`...`) follow a truncated string. If you
      // prefer, set `options.ellipsis` to a different suffix, which may be the
      // empty string if you wish.
      //
      // Also available as a helper via `apos.area.plaintext(area, options)` in
      // templates.
      //
      // Content will be retrieved from any widget type that supplies a
      // `getRichText` method.
      plaintext(within, options) {
        options = options || {};
        const richText = self.richText(within, options);
        let plaintext = self.apos.util.htmlToPlaintext(richText).trim();
        plaintext = plaintext.replace(/\n+/g, '\n');
        if (!options.limit) {
          return plaintext;
        }
        let ellipsis = '...';
        if (options.ellipsis !== undefined) {
          ellipsis = options.ellipsis;
        }
        return self.apos.util.truncatePlaintext(plaintext, options.limit, ellipsis);
      },
      // Very handy for imports of all kinds: convert plaintext to an area with
      // one `@apostrophecms/rich-text` widget if it is not blank, otherwise an
      // empty area. null and undefined are tolerated and converted to empty
      // areas.
      fromPlaintext(plaintext) {
        return self.fromRichText(self.apos.util.escapeHtml(plaintext, true));
      },
      // Convert HTML to an area with one '@apostrophecms/rich-text' widget,
      // otherwise an empty area. null and undefined are tolerated and converted
      // to empty areas.
      fromRichText(html) {
        const area = {
          metaType: 'area',
          items: [],
          _id: self.apos.util.generateId()
        };
        if (html && html.length) {
          html = html.toString();
          area.items.push({
            _id: self.apos.util.generateId(),
            type: '@apostrophecms/rich-text',
            content: html
          });
        }
        return area;
      },
      // Load widgets which were deferred until as late as possible. Only
      // comes into play if `req.deferWidgetLoading` was set to true for
      // the request. Invoked after the last `pageBeforeSend` handler, and
      // also at the end of the `@apostrophecms/global` middleware.
      async loadDeferredWidgets(req) {
        if (!req.deferWidgetLoading) {
          return;
        }
        req.loadingDeferredWidgets = true;
        for (const type of _.keys(req.deferredWidgets)) {
          const manager = self.getWidgetManager(type);
          if (!manager) {
            self.warnMissingWidgetType(type);
            continue;
          }
          await manager.loadIfSuitable(req, req.deferredWidgets[type]);
        }
      },
      // Returns true if the named area in the given `doc` is empty.
      //
      // Alternate syntax: `{ area: doc.areaname, ... more options }`
      //
      // An area is empty if it has no widgets in it, or when
      // all of the widgets in it return true when their
      // `isEmpty()` methods are interrogated. For instance,
      // if an area only contains a rich text widget and that
      // widget. A widget with no `isEmpty()` method is never empty.
      isEmpty(doc, name) {
        let area;
        if (arguments.length === 2) {
          area = doc[name];
        } else {
          // "doc" is an options object
          area = doc.area;
        }
        if (!area) {
          return true;
        }
        return !_.some(area.items, function (item) {
          const manager = self.getWidgetManager(item.type);
          if (manager && manager.isEmpty) {
            return !manager.isEmpty(item);
          } else {
            return true;
          }
        });
      },
      getBrowserData(req) {
        const widgets = {};
        const widgetEditors = {};
        const widgetManagers = {};
        const widgetIsContextual = {};
        const widgetPreview = {};
        const widgetHasPlaceholder = {};
        const widgetHasInitialModal = {};
        const contextualWidgetDefaultData = {};

        _.each(self.widgetManagers, function (manager, name) {
          const browserData = manager.getBrowserData(req);

          widgets[name] = (browserData && browserData.components && browserData.components.widget) || 'AposWidget';
          widgetEditors[name] = (browserData && browserData.components && browserData.components.widgetEditor) || 'AposWidgetEditor';
          widgetManagers[name] = manager.__meta.name;
          widgetIsContextual[name] = manager.options.contextual;
          widgetPreview[name] = manager.options.preview;
          widgetHasPlaceholder[name] = manager.options.placeholder;
          widgetHasInitialModal[name] = !manager.options.placeholder &&
            manager.options.initialModal !== false;
          contextualWidgetDefaultData[name] = manager.options.defaultData || {};
        });

        return {
          components: {
            editor: 'AposAreaEditor',
            widgets,
            widgetEditors
          },
          widgetIsContextual,
          widgetHasPlaceholder,
          widgetHasInitialModal,
          widgetPreview,
          contextualWidgetDefaultData,
          widgetManagers,
          action: self.action
        };
      },
      async addDeduplicateWidgetIdsMigration() {
        self.apos.migration.add('deduplicate-widget-ids', () => {
          // Make them globally unique because that is easiest to
          // definitely get correct for this one-time migration, although
          // there is no guarantee that widget ids are unique between
          // separate documents going forward. The guarantee is that they
          // will be unique within documents
          const seen = new Set();
          return self.apos.migration.eachWidget({}, async (doc, widget, dotPath) => {
            if ((!widget._id) || seen.has(widget._id)) {
              const _id = self.apos.util.generateId();
              return self.apos.doc.db.updateOne({
                _id: doc._id
              }, {
                $set: {
                  [`${dotPath}._id`]: _id
                }
              });
            } else {
              seen.add(widget._id);
            }
          });
        });
      }
    };
  },
  helpers(self) {
    return {
      // Returns the rich text markup of all `@apostrophecms/rich-text` widgets
      // within the provided doc or area, concatenated as a single string. In
      // future this method may improve to return the content of other widgets
      // that consider themselves primarily providers of rich text, such as
      // subclasses of `@apostrophecms/rich-text`, which will **not** be
      // regarded as a bc break. However it will never return images, videos,
      // etc.
      //
      // By default the rich text contents of the widgets are joined with
      // a newline between. You may pass your own `options.delimiter` string if
      // you wish a different delimiter or the empty string. You may also pass
      // an HTML element name like `div` via `options.wrapper` to wrap each
      // one in a `<div>...</div>` block. Of course, there may already be a div
      // in the rich txt (but then again there may not).
      //
      // Content will be retrieved from any widget type that supplies a
      // `getRichText` method.
      richText: function (within, options) {
        // Use the safe filter so that the markup doesn't get double-escaped by
        // nunjucks
        return self.apos.template.safe(self.richText(within, options));
      },
      // Returns the plaintext contents  of all rich text widgets
      // within the provided doc or area, concatenated as a single string.
      //
      // By default the rich text contents of the various widgets are joined
      // with a newline between. You may pass your own `options.delimiter`
      // string if you wish a different delimiter or the empty string.
      //
      // Pass `options.limit` to limit the number of characters. This method
      // will return fewer characters in order to avoid cutting off in mid-word.
      //
      // By default, three periods (`...`) follow a truncated string. If you
      // prefer, set `options.ellipsis` to a different suffix, which may be the
      // empty string if you wish.
      //
      // Content will be retrieved from any widget type that supplies a
      // `getRichText` method.
      plaintext: function (within, options) {
        return self.plaintext(within, options);
      },
      // Returns true if the named area in the given `doc` is empty.
      //
      // Alternate syntax: `{ area: doc.areaname, ... more options }`
      //
      // An area is empty if it has no widgets in it, or when
      // all of the widgets in it return true when their
      // `isEmpty()` methods are interrogated. For instance,
      // if an area only contains a rich text widget and that
      // widget. A widget with no `isEmpty()` method is never empty.
      isEmpty: function (doc, name) {
        let area;
        if (!name) {
          area = doc.area;
        } else {
          area = doc[name];
        }
        return self.isEmpty({ area });
      }
    };
  },
  customTags(self) {
    return {
      area: require('./lib/custom-tags/area.js')(self),
      widget: require('./lib/custom-tags/widget.js')(self)
    };
  }
};
