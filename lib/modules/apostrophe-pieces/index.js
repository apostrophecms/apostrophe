let _ = require('lodash');

module.exports = {
  extend: 'apostrophe-doc-type-manager',
  options: {
    manageViews: ['list'],
    perPage: 10
  },
  beforeSuperClass(self, options) {
    self.contextual = options.contextual;
    
    options.addFields = [{
        type: 'slug',
        name: 'slug',
        label: 'Slug',
        required: true,
        slugifies: 'title'
      }].concat(options.addFields || []);
    
    if (self.contextual) {
      // If the piece is edited contextually, default the published state to false
      options.addFields = [{
          type: 'boolean',
          name: 'published',
          label: 'Published',
          def: false
        }].concat(options.addFields || []);
    }
    
    options.defaultColumns = options.defaultColumns || [
      {
        name: 'title',
        label: 'Title'
      },
      {
        name: 'updatedAt',
        label: 'Last Updated',
        partial: function (value) {
          if (!value) {
            // Don't crash if updatedAt is missing, for instance due to a dodgy import process
            return '';
          }
          return self.partial('manageUpdatedAt.html', { value: value });
        }
      },
      {
        name: 'published',
        label: 'Published',
        partial: function (value) {
          return self.partial('managePublished', { value: value });
        }
      }
    ];
    
    if (self.contextual) {
      options.defaultColumns.push({
        name: '_url',
        label: 'Link',
        partial: function (value) {
          return self.partial('manageLink', { value: value });
        }
      });
    }
    
    options.addColumns = options.defaultColumns.concat(options.addColumns || []);
    
    options.addFilters = [
      {
        name: 'published',
        choices: [
          {
            value: true,
            label: 'Published'
          },
          {
            value: false,
            label: 'Draft'
          },
          {
            value: null,
            label: 'Both'
          }
        ],
        allowedInChooser: false,
        def: true,
        style: 'pill'
      },
      {
        name: 'trash',
        choices: [
          {
            value: false,
            label: 'Live'
          },
          {
            value: true,
            label: 'Trash'
          }
        ],
        allowedInChooser: false,
        def: false,
        style: 'pill'
      }
    ].concat(options.addFilters || []);
    
    options.batchOperations = [
      {
        name: 'trash',
        label: 'Trash',
        unlessFilter: { trash: true }
      },
      {
        name: 'rescue',
        label: 'Rescue',
        unlessFilter: { trash: false }
      },
      {
        name: 'publish',
        label: 'Publish',
        unlessFilter: { published: true },
        requiredField: 'published'
      },
      {
        name: 'unpublish',
        label: 'Unpublish',
        unlessFilter: { published: false },
        requiredField: 'published'
      },
      {
        name: 'tag',
        label: 'Add Tag to',
        buttonLabel: 'Add Tag',
        // The schema *of this piece type* must have a field called tags.
        // This has nothing to do with the schema for the batch form. -Tom
        requiredField: 'tags',
        schema: [{
            type: 'tags',
            name: 'tags',
            label: 'Tag',
            required: true
          }]
      },
      {
        name: 'untag',
        label: 'Remove Tag from',
        buttonLabel: 'Remove Tag',
        // The schema *of this piece type* must have a field called tags.
        // This has nothing to do with the schema for the batch form. -Tom
        requiredField: 'tags',
        schema: [{
            type: 'tags',
            name: 'tags',
            label: 'Tag',
            required: true
          }]
      }
    ].concat(options.addBatchOperations || []);
    if (options.removeBatchOperations) {
      options.batchOperations = _.filter(options.batchOperations, function (batchOperation) {
        return !_.includes(options.removeBatchOperations, batchOperation.name);
      });
    }
  },
  init(self, options) {
    if (!options.name) {
      throw new Error('apostrophe-pieces require name option');
    }
    if (!options.label) {
      // Englishify it
      options.label = _.startCase(options.name);
    }
    options.pluralLabel = options.pluralLabel || options.label + 's';
    
    self.name = options.name;
    self.label = options.label;
    self.pluralLabel = options.pluralLabel;
    self.manageViews = options.manageViews;
    function stringifyValue(value) {
      if (value === undefined || value === null) {
        return 'any';
      } else if (value) {
        return '1';
      } else {
        return '0';
      }
    }
    function filterValueToChoiceValue(state, choice) {
      switch (state) {
      case true:
        return '1';
      case false:
        return '0';
      case null:
        return 'any';
      }
    }
    
    // As a doc manager, we can provide default templates for use when
    // choosing docs of our type. With this code in place, subclasses of
    // pieces can just provide custom chooserChoice.html and chooserChoices.html
    // templates with no additional plumbing. -Tom
    
    self.choiceTemplate = self.__meta.name + ':chooserChoice.html';
    self.choicesTemplate = self.__meta.name + ':chooserChoices.html';
    self.relationshipTemplate = self.__meta.name + ':relationshipEditor.html';
    self.composeFilters();
    self.composeColumns();
    self.addPermissions();
    self.addToAdminBar();
    self.addManagerModal();
    self.finalizeControls();
    self.addTasks();
  },
  restApiRoutes: (self, options) => ({
    async getAll(req) {
      const query = self.getRestQuery(req);
      if (!query.get('perPage')) {
        query.perPage(
          self.options.perPage
        );
      }
      const result = {};
      // populates totalPages when perPage is present
      await query.toCount();
      result.pages = query.get('totalPages');
      result.currentPage = query.get('page') || 1;
      result.results = await query.toArray();
      if (query.get('choicesResults')) {
        result.choices = query.get('choicesResults');
      }
      if (query.get('countsResults')) {
        result.counts = query.get('countsResults');
      }
      return result;
    },
    async getOne(req, _id) {
      const doc = await self.getRestQuery(req).and({ _id }).toObject();
      if (!doc) {
        throw 'notfound';
      }
      return doc;
    },
    async post(req) {
      return self.convertInsertAndRefresh(req, req.body);
    },
    async put(req, _id) {
      return self.convertUpdateAndRefresh(req, req.body, _id);
    },
    async delete(req, _id) {
      return self.trash(req, _id);
    },
    async patch(req, _id) {
      return self.convertPatchAndRefresh(req, req.body, _id);
    }
  }),
  handlers(self, options) {
    return {
      'beforeInsert': {
        ensureTypeAndCreatorPermissions(req, piece, options) {
          piece.type = self.name;
          if (options.permissions !== false && !self.apos.permissions.can(req, 'admin-' + self.name)) {
            // If we are not an admin for this type and we just created something,
            // make sure we wind up on the list of people who can edit it. Note that
            // permissions will still keep us from actually inserting it, and thus
            // making this change, if we're not cool enough to create one. However if
            // we are ignoring permissions via `permissions: false` do not do this
            // (leave it up to the developer to decide if anybody gets permission to
            // edit later).
            if (req.user) {
              piece.editUsersIds = (piece.editUsersIds || []).concat([req.user._id]);
              piece.docPermissions = (piece.docPermissions || []).concat(['edit-' + req.user._id]);
            }
          }
        }
      },
      'apostrophe:modulesReady': {
        composeBatchOperations() {
          // We took care of addBatchOperations and removeBatchOperations in beforeConstruct
          self.options.batchOperations = _.filter(self.options.batchOperations, function (batchOperation) {
            if (batchOperation.requiredField && !_.find(self.schema, { name: batchOperation.requiredField })) {
              return false;
            }
            if (batchOperation.onlyIf) {
              if (!batchOperation.onlyIf(self.name)) {
                return false;
              }
            }
            return true;
          });
        }
      }
    };
  },
  methods(self, options) {
    return {
      finalizeControls() {
        self.createControls = self.options.createControls || [
          {
            type: 'dropdown',
            label: 'More',
            items: [
              {
                label: 'Copy',
                action: 'copy'
              },
              {
                label: 'Trash',
                action: 'trash'
              }
            ],
            dropdownOptions: { direction: 'down' }
          },
          {
            type: 'minor',
            action: 'cancel',
            label: 'Cancel'
          },
          {
            type: 'major',
            action: 'save',
            label: 'Save ' + self.label
          }
        ];
        self.editControls = self.options.editControls || [
          {
            type: 'dropdown',
            label: 'More',
            // For reliable test automation
            name: 'more',
            items: [
              {
                label: 'Versions',
                action: 'versions'
              },
              {
                label: 'Copy',
                action: 'copy'
              },
              {
                label: 'Trash',
                action: 'trash'
              }
            ],
            dropdownOptions: { direction: 'down' }
          },
          {
            type: 'minor',
            action: 'cancel',
            label: 'Cancel'
          },
          {
            type: 'major',
            action: 'save',
            label: 'Save ' + self.label
          }
        ];
      },
      // Returns a cursor that finds docs the current user can edit. Unlike
      // find(), this cursor defaults to including unpublished docs. Subclasses
      // of apostrophe-pieces often extend this to remove more default filters
      findForEditing(req, criteria, projection) {
        let cursor = self.find(req, criteria).permission('edit').published(null);
        if (projection) {
          cursor.projection(projection);
        }
        if (self.options.canEditTrash) {
          cursor.trash(null);
        }
        return cursor;
      },
      // Returns one editable piece matching the criteria, null if none match
      findOneForEditing(req, criteria) {
        return self.findForEditing(req, criteria).toObject();
      },
      // Returns one editable piece matching the criteria, throws `notfound`
      // if none match
      requireOneForEditing(req, criteria) {
        const piece = self.findForEditing(req, criteria).toObject();
        if (!piece) {
          throw 'notfound';
        }
        return piece;
      },
      // Insert a piece. Convenience wrapper for `apos.docs.insert`.
      // Returns the piece. `beforeInsert`, `beforeSave`, `afterInsert`
      // and `afterSave` async events are emitted by this module.
      async insert(req, piece, options) {
        piece.type = self.name;
        return self.apos.docs.insert(req, piece, options);
      },
      //
      // Update a piece. Convenience wrapper for `apos.docs.insert`.
      // Returns the piece. `beforeInsert`, `beforeSave`, `afterInsert`
      // and `afterSave` async events are emitted by this module.
      async update(req, piece, options) {
        return self.apos.docs.update(req, piece, options);
      },
      // Move a piece to the trash by id.
      async trash(req, id) {
        return self.apos.docs.trash(req, id);
      },
      // Rescue a piece from the trash by id.
      async rescue(req, id) {
        return self.apos.docs.rescue(req, id);
      },
      // Convert the untrusted data supplied in `input` via the schema and
      // update the piece object accordingly.
      //
      // If `options.presentFieldsOnly` is true, Only fields that are not undefined in
      // `input` are affected. To intentionally erase a field's contents when this option
      // is present, use `null` for that input field or another representation appropriate
      // to the type, i.e. an empty string for a string.
      async convert(req, input, piece, options = {
        presentFieldsOnly: false
      }) {
        let schema = self.allowedSchema(req);
        if (options.presentFieldsOnly) {
          schema = self.apos.schemas.subset(schema, self.fieldsPresent(input));
        }
        await self.apos.schemas.convert(req, schema, input, piece);
      },
      // Return the names of all schema fields present in the `input` object,
      // taking into account issues like join fields keeping their data in
      // a separate ids property, etc.
      fieldsPresent(input) {
        const schema = self.schema;
        const output = [];
        for (const field of schema) {
          if (field.type.name.substring(0, 5) === '_join') {
            if (_.has(input, field.idField || field.idsField)) {
              output.push(field.name);
            }
          } else {
            output.push(field.name);
          }
        }
      },
      composeFilters() {
        self.filters = options.filters || [];
        if (options.addFilters) {
          _.each(options.addFilters, function (newFilter) {
            // remove it from the filters if we've already added it, last one wins
            self.filters = _.filter(self.filters, function (filter) {
              return filter.name !== newFilter.name;
            });
            // add the new field to the filters
            self.filters.push(newFilter);
          });
        }
        if (options.removeFilters) {
          self.filters = _.filter(self.filters, function (filter) {
            return !_.includes(options.removeFilters, filter.name);
          });
        }
      },
      composeColumns() {
        self.columns = options.columns || [];
        if (options.addColumns) {
          _.each(options.addColumns, function (newColumn) {
            // remove it from the columns if we've already added it, last one wins
            self.columns = _.filter(self.columns, function (column) {
              return column.name !== newColumn.name;
            });
            // add the new field to the columns
            self.columns.push(newColumn);
          });
        }
        if (options.removeColumns) {
          self.columns = _.filter(self.columns, function (column) {
            return !_.includes(options.removeColumns, column.name);
          });
        }
      },
      // Enable inclusion of this type in sitewide search results
      searchDetermineTypes(types) {
        if (self.options.searchable !== false) {
          types.push(self.name);
        }
      },
      isAdminOnly() {
        return self.options.adminOnly;
      },
      addPermissions() {
        if (!self.isAdminOnly()) {
          self.apos.permissions.add({
            value: 'admin-' + self.name,
            label: 'Admin: ' + self.label
          });
          self.apos.permissions.add({
            value: 'edit-' + self.name,
            label: 'Edit: ' + self.label
          });
          self.apos.permissions.add({
            value: 'submit-' + self.name,
            label: 'Submit: ' + self.label
          });
        }
      },
      addToAdminBar() {
        self.apos.adminBar.add(self.__meta.name, self.pluralLabel, self.getEditPermissionName());
      },
      addManagerModal() {
        self.apos.modals.add(self.__meta.name, self.getComponentName('manager'), { moduleName: self.__meta.name });
      },
      // Add `._url` properties to the given pieces, if possible.
      // The default implementation does nothing, however
      // [apostrophe-pieces-pages](../apostrophe-pieces-pages/index.html) will
      // call `setAddUrls` to point to [its own `addUrlsToPieces` method](../apostrophe-pieces-pages/index.html#addUrlsToPieces).
      async addUrls(req, pieces) {
      },
      // Called by [apostrophe-pieces-pages](../apostrophe-pieces-pages/index.html) to
      // replace the default `addUrls` async method with one that assigns `._url`
      // properties to pieces based on the most suitable pages of that type.
      // See [the `addUrlsToPieces` method of `apostrophe-pieces-pages`](../apostrophe-pieces-pages/index.html#addUrlsToPieces).
      setAddUrls(fn) {
        self.addUrls = fn;
      },
      // Implements a simple batch operation like publish or unpublish.
      // Pass `req`, the `name` of a configured batch operation, and
      // and a function that accepts (req, piece, data),
      // and returns a promise to perform the modification on that
      // one piece (including calling`update` if appropriate).
      //
      // `data` is an object containing any schema fields specified
      // for the batch operation. If there is no schema it will be
      // an empty object.
      //
      // Replies immediately to the request with `{ jobId: 'cxxxx' }`.
      // This can then be passed to appropriate browser-side APIs
      // to monitor progress.
      //
      // To avoid RAM issues with very large selections while ensuring
      // that all lifecycle events are fired correctly, the current
      // implementation processes the pieces in series.
      async batchSimpleRoute(req, name, change) {
        let batchOperation = _.find(self.options.batchOperations, { name: name });
        let schema = batchOperation.schema || [];
        let data = self.apos.schemas.newInstance(schema);
        await self.apos.schemas.convert(req, schema, req.body, data);
        await self.apos.modules['apostrophe-jobs'].run(req, one, { labels: { title: batchOperation.progressLabel || batchOperation.buttonLabel || batchOperation.label } });
        async function one(req, id) {
          const piece = self.findForEditing(req, { _id: id }).toObject();
          if (!piece) {
            throw 'notfound';
          }
          await change(req, piece, data);
        }
      },

      // Accept a piece as untrusted input potentially
      // found in `input` (hint: you can pass `req.body`
      // if your route accepts the piece via POST), using
      // schema-based convert mechanisms.
      //
      // In addition to fields defined in the schema, additional
      // `area` properties are accepted at the root level.
      //
      // Inserts it into the database, fetches it again to get all
      // joins, and returns the result (note it is an async function).
      //
      // If `input._copyingId` is present, fetches that
      // piece and, if we have permission to view it, copies its
      // non-schema-based top level areas into the new piece.
      // This accounts for copying areas the schema doesn't know about.
      // Also emits `copyExtras` to provide an opportunity to copy other
      // non-schema things.
      //
      // Only fields that are not undefined in `input` are
      // considered. The rest respect their defaults. To intentionally
      // erase a field's contents use `null` for that input field or another
      // representation appropriate to the type, i.e. an empty string for a string.
      //
      // The module emits the `afterConvert` async event with `(req, input, piece)`
      // before inserting the piece.
      //
      // If copying, the module also emits `copyExtras` with `(req, copyOf, input, piece)`.

      async convertInsertAndRefresh(req, input, options) {
        const piece = self.newInstance();
        const copyingId = self.apos.launder.id(input._copyingId);
        await self.convert(req, input, piece, { onlyPresentFields: true });
        await self.emit('afterConvert', req, input, piece);
        await copy();
        await self.insert(req, piece);
        return self.findForEditing(req, { _id: piece._id }).toObject();
        async function copy() {
          let copyOf;
          if (!copyingId) {
            return;
          }
          copyOf = await self.findForEditing(req, { _id: copyingId }).toObject();
          await self.emit('copyExtras', req, copyOf, input, piece);
        }
      },

      // Similar to `convertInsertAndRefresh`. Update the piece with the given _id, based on the
      // `input` object (which may be untrusted input such as req.body). Fetch the updated piece to
      // populate all joins and return it.
      //
      // Any fields not present in `input` are regarded as empty, if permitted (REST PUT semantics).
      // For partial updates use convertPatchAndRefresh.

      async convertUpdateAndRefresh(req, input, _id) {
        const piece = await self.find(req, { _id }).toObject();
        if (!piece) {
          throw 'notfound';
        }
        if (!piece._edit) {
          throw 'forbidden';
        }
        await self.convert(req, input, piece);
        await self.emit('afterConvert', req, input, piece);
        await self.update(req, piece);
        return self.findForEditing(req, { _id }).toObject();
      },

      // Similar to `convertUpdateAndUpdate`. Patch the piece with the given _id, based on the
      // `input` object (which may be untrusted input such as req.body). Fetch the updated piece to
      // populate all joins and return it. Employs a lock to avoid overwriting the work of
      // concurrent PATCH calls.

      async convertPatchAndRefresh(req, input, _id) {
        return self.apos.locks.withLock(`apostrophe-${_id}`, async () => {
          const piece = await self.findForEditing(req, { _id }).toObject();
          if (!piece) {
            throw 'notfound';
          }
          self.implementPatchOperators(input, piece);
          const schema = self.subsetSchemaForPatch(self.allowedSchema(req), input);
          await self.apos.schemas.convert(req, schema, input, piece);
          await self.emit('afterConvert', req, input, piece);
          await self.update(req, piece);
          return self.findForEditing(req, { _id }).toObject();
        });
      },

      // Implementation detail, called for you by the PATCH route.
      // Applies changes in patch operators found in `patch` to set ordinary
      // properties of `patch`, referring to the doc `existing` to fill in
      // information like existing elements of arrays, etc. Then you call
      // convert normally with `patch ` as input and the schema indicated by
      // subsetSchemaForPatch.
      //
      // Includes support for the `$push`, `$pullAll`, and `$pullAllById` operators.

      implementPatchOperators(patch, existing) {
        if (patch.$push) {
          append(patch.$push);
        } else if (patch.$pullAll) {
          _.each(patch.$pullAll, function(val, key) {
            _.set(patch, key, _.differenceWith(_.get(existing, key) || [], _.get(patch.$pullAll, key) || [], function(a, b) {
              return _.isEqual(a, b);
            }));
          });
        } else if (patch.$pullAllById) {
          _.each(patch.$pullAllById, function(val, key) {
            _.set(patch, key, _.get(existing, key) || []);
            if (!Array.isArray(val)) {
              val = [ val ];
            }
            _.set(patch, key, _.differenceWith(_.get(existing, key) || [], _.get(patch.$pullAllById, key), function(a, b) {
              return (a._id || a.id) === b;
            }));
          });
        }
        function append(data) {
          _.each(data, function(val, key) {
            _.set(patch, key, _.get(existing, key) || []);
            if (val && val.$each) {
              _.set(patch, key, (_.get(patch, key) || []).concat(val.$each));
            } else {
              var existing = _.get(patch, key) || [];
              existing.push(val);
              _.set(patch, key, existing);
            }
          });
        }
      },

      // Given a `doc` containing patch operators like `$push`, return a subset
      // of `schema` containing the root fields that would ultimately be updated by
      // those operations.
      subsetSchemaForPatch(schema, doc) {
        const idFields = {};
        schema.forEach(function(field) {
          if ((field.type === 'joinByOne') || (field.type === 'joinByArray')) {
            idFields[field.idField || field.idsField] = field.name;
          }
        });
        return self.apos.schemas.subset(schema, _.map(_.keys(doc).concat(operatorKeys()), idFieldToSchemaField));
        function operatorKeys() {
          return _.uniq(_.flatten(
            _.map([ '$push', '$pullAll', '$pullAllById' ], function(o) {
              return _.map(_.keys(doc[o] || {}), function(key) {
                return key.toString().split(/\./)[0];
              });
            })
          ));
        }
        function idFieldToSchemaField(name) {
          return idFields[name] || name;
        }
      },
      getCreateControls(req) {
        let controls = _.cloneDeep(self.createControls);
        return controls;
      },
      getEditControls(req) {
        let controls = _.cloneDeep(self.editControls);
        return controls;
      },
      getChooserControls(req) {
        return [
          {
            type: 'minor',
            label: 'Cancel',
            action: 'cancel'
          },
          {
            type: 'major',
            label: 'New ' + self.options.label,
            action: self.options.insertViaUpload ? 'upload-' + self.options.name : 'create-' + self.options.name,
            uploadable: self.options.insertViaUpload
          },
          {
            type: 'major',
            label: 'Save Choices',
            action: 'save'
          }
        ];
      },
      getManagerControls(req) {
        return [
          {
            type: 'minor',
            label: 'Finished',
            action: 'cancel'
          },
          {
            type: 'major',
            label: 'Add ' + self.options.label,
            action: self.options.insertViaUpload ? 'upload-' + self.options.name : 'create-' + self.options.name,
            uploadable: self.options.insertViaUpload
          }
        ];
      },
      // Generate a sample piece of this type. The `i` counter
      // is used to distinguish it from other samples. Useful
      // for things like testing pagination, see the
      // `your-piece-type:generate` task.
      generate(i) {
        let piece = self.newInstance();
        piece.title = 'Generated #' + (i + 1);
        piece.published = true;
        return piece;
      },
      addTasks() {
        self.addGenerateTask();
      },
      addGenerateTask() {
        if (self.isAdminOnly()) {
          // Generating users and groups is not a good idea
          return;
        }
        self.apos.tasks.add(self.__meta.name, 'generate', 'Invoke this task to generate sample docs of this type. Use\n' + 'the --total option to control how many are added to the database.\n' + 'You can remove them all later with the --remove option.', async function (apos, argv) {
          if (argv.remove) {
            return remove();
          } else {
            return generate();
          }
          async function generate() {
            const total = argv.total || 10;
            const req = self.apos.tasks.getReq();
            for (let i = 0; i < total; i++) {
              const piece = self.generate(i);
              piece.aposSampleData = true;
              await self.insert(req, piece);
            }
          }
          async function remove() {
            return self.apos.docs.db.deleteMany({
              type: self.name,
              aposSampleData: true
            });
          }
        });
      },
      getRestQuery(req) {
        let result;
        if (self.apos.launder.boolean(req.query._edit)) {
          result = self.findForEditing(req).applySafeBuilders(req.query, 'manage');
        } else {
          result = self.find(req).applySafeBuilders(req.query, 'public');
        }
        return result;
      }
    };
  },
  extendMethods(self, options) {
    return {
      getBrowserData(_super, req) {
        if (!req.user) {
          return;
        }
        const browserOptions = _super(req);
        // Options specific to pieces and their manage modal
        browserOptions.filters = self.filters;
        browserOptions.columns = self.columns;
        browserOptions.contextual = self.contextual;
        browserOptions.batchOperations = self.options.batchOperations;
        browserOptions.insertViaUpload = self.options.insertViaUpload;
        browserOptions.canEditTrash = self.options.canEditTrash;
        browserOptions.components = {
          filters: 'ApostrophePiecesFilters',
          list: 'ApostrophePiecesList',
          pager: 'ApostrophePager',
          insertModal: 'ApostrophePiecesInsertModal'
        };
        return browserOptions;
      },
      find(_super, req, criteria, projection) {
        return _super(req, criteria, projection).defaultSort(self.options.sort || { updatedAt: -1 });
      }
    };
  }
};
