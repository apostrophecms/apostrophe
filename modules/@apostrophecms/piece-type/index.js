const _ = require('lodash');

module.exports = {
  extend: '@apostrophecms/doc-type',
  cascades: [ 'filters', 'columns', 'batchOperations' ],
  options: {
    manageViews: [ 'list' ],
    perPage: 10
    // By default there is no public REST API, but you can configure a
    // projection to enable one:
    // publicApiProjection: {
    //   title: 1,
    //   _url: 1,
    // }
  },
  fields: {
    add: {
      slug: {
        type: 'slug',
        label: 'Slug',
        required: true,
        following: 'title'
      }
    }
  },
  columns(self, options) {
    return {
      add: {
        title: {
          label: 'Title'
        },
        updatedAt: {
          label: 'Edited on'
        },
        published: {
          label: 'Published'
        },
        ...(self.options.contextual ? {
          _url: {
            label: 'Link'
          }
        } : {})
      }
    };
  },
  filters: {
    add: {
      published: {
        label: 'Published',
        inputType: 'radio',
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
            value: 'any',
            label: 'Both'
          }
        ],
        allowedInChooser: false,
        def: true
      },
      trash: {
        label: 'Trash',
        inputType: 'radio',
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
        def: false
      }
    }
  },
  batchOperations: {
    add: {
      trash: {
        name: 'trash',
        label: 'Trash',
        inputType: 'radio',
        unlessFilter: {
          trash: true
        }
      },
      rescue: {
        name: 'rescue',
        label: 'Rescue',
        unlessFilter: {
          trash: false
        }
      },
      publish: {
        name: 'publish',
        label: 'Publish',
        unlessFilter: {
          published: true
        },
        requiredField: 'published'
      },
      unpublish: {
        name: 'unpublish',
        label: 'Unpublish',
        unlessFilter: {
          published: false
        },
        requiredField: 'published'
      }
    }
  },
  init(self, options) {
    self.contextual = options.contextual;
    if (self.contextual) {
      // If the piece is edited contextually, default the published state to false
      const published = self.schema.find(field => field.name === 'published');
      if (published) {
        published.def = false;
      }
    }

    if (!options.name) {
      throw new Error('@apostrophecms/pieces require name option');
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
      self.publicApiCheck(req);
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
      self.publicApiCheck(req);
      const doc = await self.getRestQuery(req).and({ _id }).toObject();
      if (!doc) {
        throw self.apos.error('notfound');
      }
      return doc;
    },
    async post(req) {
      self.publicApiCheck(req);
      if (req.body._newInstance) {
        return self.newInstance();
      }

      try {
        return await self.convertInsertAndRefresh(req, req.body);
      } catch (e) {
        if (Array.isArray(e)) {
          // TODO: Turn errors that should be 500 errors into uninformative,
          // opaque errors. (the ones that don't have `aposError === true`).
          throw self.apos.error('invalid', {
            errors: e
          });
        } else {
          throw e;
        }
      }
    },
    async put(req, _id) {
      self.publicApiCheck(req);
      return self.convertUpdateAndRefresh(req, req.body, _id);
    },
    // Unimplemented; throws a 501 status code. This would truly and permanently remove the thing, per the REST spec.
    // In a CMS that usually leads to unhappy customers. To manipulate apostrophe's trash status for something, use
    // a `PATCH` call to modify the `trash` property and set it to `true` or `false`.
    async delete(req, _id) {
      self.publicApiCheck(req);
      throw self.apos.error('unimplemented');
    },
    patch(req, _id) {
      self.publicApiCheck(req);
      return self.patch(req, _id);
    }
  }),
  handlers(self, options) {
    return {
      beforeInsert: {
        ensureTypeAndCreatorPermissions(req, piece, options) {
          piece.type = self.name;
          if (options.permissions !== false && !self.apos.permission.can(req, 'admin-' + self.name)) {
            // If we are not an admin for this type and we just created something,
            // make sure we wind up on the list of people who can edit it. Note that
            // permissions will still keep us from actually inserting it, and thus
            // making this change, if we're not cool enough to create one. However if
            // we are ignoring permissions via `permissions: false` do not do this
            // (leave it up to the developer to decide if anybody gets permission to
            // edit later).
            if (req.user) {
              piece.editUsersIds = (piece.editUsersIds || []).concat([ req.user._id ]);
              piece.docPermissions = (piece.docPermissions || []).concat([ 'edit-' + req.user._id ]);
            }
          }
        }
      },
      afterInsert: {
        insertNotif(req, doc) {
          self.apos.notify(req, `New ${self.label.toLowerCase()} added: %s`, doc.title, {
            dismiss: true,
            type: 'success'
          });
        }
      },
      afterUpdate: {
        updateNotif(req, doc) {
          self.apos.notify(req, `${self.label} %s updated`, doc.title, {
            dismiss: true,
            type: 'success'
          });
        }
      },
      'apostrophe:modulesReady': {
        composeBatchOperations() {
          self.batchOperations = Object.keys(self.batchOperations).map(key => ({
            name: key,
            ...self.batchOperations[key]
          })).filter(batchOperation => {
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
      // Returns one editable piece matching the criteria, throws `notfound`
      // if none match
      requireOneForEditing(req, criteria) {
        const piece = self.findForEditing(req, criteria).toObject();
        if (!piece) {
          throw self.apos.error('notfound');
        }
        return piece;
      },
      // Insert a piece. Convenience wrapper for `apos.doc.insert`.
      // Returns the piece. `beforeInsert`, `beforeSave`, `afterInsert`
      // and `afterSave` async events are emitted by this module.
      async insert(req, piece, options) {
        piece.type = self.name;
        return self.apos.doc.insert(req, piece, options);
      },
      //
      // Update a piece. Convenience wrapper for `apos.doc.insert`.
      // Returns the piece. `beforeInsert`, `beforeSave`, `afterInsert`
      // and `afterSave` async events are emitted by this module.
      async update(req, piece, options) {
        return self.apos.doc.update(req, piece, options);
      },
      composeFilters() {
        self.filters = Object.keys(self.filters).map(key => ({
          name: key,
          ...self.filters[key]
        }));
        // Add a null choice if not already added or set to `required`
        self.filters.forEach(filter => {
          if (
            !filter.required &&
            filter.choices &&
            !filter.choices.find(choice => choice.value === 'any')
          ) {
            filter.def = 'any';
            filter.choices.push({
              value: 'any',
              label: 'None'
            });
          }
        });
      },
      composeColumns() {
        self.columns = Object.keys(self.columns).map(key => ({
          name: key,
          ...self.columns[key]
        }));
      },
      // Enable inclusion of this type in sitewide search results
      searchDetermineTypes(types) {
        if (self.options.searchable !== false) {
          types.push(self.name);
        }
      },
      addPermissions() {
        if (!self.isAdminOnly()) {
          self.apos.permission.add({
            value: 'admin-' + self.name,
            label: 'Admin: ' + self.label
          });
          self.apos.permission.add({
            value: 'edit-' + self.name,
            label: 'Edit: ' + self.label
          });
          self.apos.permission.add({
            value: 'submit-' + self.name,
            label: 'Submit: ' + self.label
          });
        }
      },
      addToAdminBar() {
        self.apos.adminBar.add(self.__meta.name, self.pluralLabel, self.getEditPermissionName());
      },
      addManagerModal() {
        self.apos.modal.add(
          self.__meta.name,
          self.getComponentName('managerModal', 'AposPiecesManager'),
          { moduleName: self.__meta.name }
        );
      },
      // Add `._url` properties to the given pieces, if possible.
      // The default implementation does nothing, however
      // [@apostrophecms/piece-page-type](../@apostrophecms/piece-page-type/index.html) will
      // call `setAddUrls` to point to [its own `addUrlsToPieces` method](../@apostrophecms/piece-page-type/index.html#addUrlsToPieces).
      async addUrls(req, pieces) {
      },
      // Called by [@apostrophecms/piece-page-type](../@apostrophecms/piece-page-type/index.html) to
      // replace the default `addUrls` async method with one that assigns `._url`
      // properties to pieces based on the most suitable pages of that type.
      // See [the `addUrlsToPieces` method of `@apostrophecms/piece-page-type`](../@apostrophecms/piece-page-type/index.html#addUrlsToPieces).
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
        const batchOperation = _.find(self.batchOperations, { name: name });
        const schema = batchOperation.schema || [];
        const data = self.apos.schema.newInstance(schema);
        await self.apos.schema.convert(req, schema, req.body, data);
        await self.apos.modules['@apostrophecms/job'].run(req, one, { labels: { title: batchOperation.progressLabel || batchOperation.buttonLabel || batchOperation.label } });
        async function one(req, id) {
          const piece = self.findForEditing(req, { _id: id }).toObject();
          if (!piece) {
            throw self.apos.error('notfound');
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
      // relationships, and returns the result (note it is an async function).
      //
      // If `input._copyingId` is present, fetches that
      // piece and, if we have permission to view it, copies any schema properties
      // not defined in `input`. Also emits `copyExtras` with (req, copyOf, input, piece).
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
        await self.convert(req, input, piece, {
          onlyPresentFields: true,
          copyingId
        });
        await self.emit('afterConvert', req, input, piece);
        await self.insert(req, piece);
        return self.findOneForEditing(req, { _id: piece._id }, { annotate: true });
      },

      // Similar to `convertInsertAndRefresh`. Update the piece with the given _id, based on the
      // `input` object (which may be untrusted input such as req.body). Fetch the updated piece to
      // populate all relationships and return it.
      //
      // Any fields not present in `input` are regarded as empty, if permitted (REST PUT semantics).
      // For partial updates use convertPatchAndRefresh. Employs a lock to avoid overwriting the work of
      // concurrent PUT and PATCH calls or getting into race conditions with their side effects.

      async convertUpdateAndRefresh(req, input, _id) {
        return self.apos.lock.withLock(`@apostrophecms/${_id}`, async () => {
          const piece = await self.findOneForEditing(req, { _id });
          if (!piece) {
            throw self.apos.error('notfound');
          }
          if (!piece._edit) {
            throw self.apos.error('forbidden');
          }
          await self.convert(req, input, piece);
          await self.emit('afterConvert', req, input, piece);
          await self.update(req, piece);
          return self.findOneForEditing(req, { _id }, { annotate: true });
        });
      },

      // Implementation of the PATCH route. Factored as a method to allow
      // it to also be called by the universal @apostrophecms/doc
      // PATCH route.
      patch(req, _id) {
        return self.convertPatchAndRefresh(req, req.body, _id);
      },

      // Similar to `convertUpdateAndRefresh`. Patch the piece with the given _id, based on the
      // `input` object (which may be untrusted input such as req.body). Fetch the updated piece to
      // populate all relationships and return it. Employs a lock to avoid overwriting the work of
      // concurrent PUT and PATCH calls or getting into race conditions with their side effects.

      async convertPatchAndRefresh(req, input, _id) {
        return self.apos.lock.withLock(`@apostrophecms/${_id}`, async () => {
          const piece = await self.findOneForEditing(req, { _id });
          if (!piece) {
            throw self.apos.error('notfound');
          }
          self.apos.schema.implementPatchOperators(input, piece);
          const schema = self.apos.schema.subsetSchemaForPatch(self.allowedSchema(req), input);
          await self.apos.schema.convert(req, schema, input, piece);
          await self.emit('afterConvert', req, input, piece);
          await self.update(req, piece);
          return self.findOneForEditing(req, { _id }, { annotate: true });
        });
      },

      getCreateControls(req) {
        const controls = _.cloneDeep(self.createControls);
        return controls;
      },
      getEditControls(req) {
        const controls = _.cloneDeep(self.editControls);
        return controls;
      },
      // TODO: Remove this if deprecated. - ab
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
      // TODO: Remove this if deprecated. - ab
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
        const piece = self.newInstance();
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
        self.apos.task.add(self.__meta.name, 'generate', 'Invoke this task to generate sample docs of this type. Use\n' + 'the --total option to control how many are added to the database.\n' + 'You can remove them all later with the --remove option.', async function (apos, argv) {
          if (argv.remove) {
            return remove();
          } else {
            return generate();
          }
          async function generate() {
            const total = argv.total || 10;
            const req = self.apos.task.getReq();
            for (let i = 0; i < total; i++) {
              const piece = self.generate(i);
              piece.aposSampleData = true;
              await self.insert(req, piece);
            }
          }
          async function remove() {
            return self.apos.doc.db.deleteMany({
              type: self.name,
              aposSampleData: true
            });
          }
        });
      },
      getRestQuery(req) {
        const query = self.find(req);
        query.applyBuildersSafely(req.query);
        if (!self.apos.permission.can(req, 'edit-' + self.name)) {
          if (!self.options.publicApiProjection) {
            // Shouldn't be needed thanks to publicApiCheck, but be sure
            query.and({
              _id: '__iNeverMatch'
            });
          } else {
            query.project(self.options.publicApiProjection);
          }
        }
        return query;
      },
      // Throws a `notfound` exception if a public API projection is
      // not specified and the user does not have editing permissions. Otherwise does
      // nothing. Simplifies implementation of `getAll` and `getOne`.
      publicApiCheck(req) {
        if (!self.options.publicApiProjection) {
          if (!self.apos.permission.can(req, 'edit-' + self.name)) {
            throw self.apos.error('notfound');
          }
        }
      }
    };
  },
  extendMethods(self, options) {
    return {
      getBrowserData(_super, req) {
        const browserOptions = _super(req);
        // Options specific to pieces and their manage modal
        browserOptions.filters = self.filters;
        browserOptions.columns = self.columns;
        browserOptions.contextual = self.contextual;
        browserOptions.batchOperations = self.batchOperations;
        browserOptions.insertViaUpload = self.options.insertViaUpload;
        _.defaults(browserOptions, {
          components: {}
        });
        _.defaults(browserOptions.components, {
          filters: 'ApostrophePiecesFilters',
          list: 'ApostrophePiecesList',
          pager: 'ApostrophePager',
          insertModal: 'AposDocEditor',
          managerModal: 'AposPiecesManager'
        });
        return browserOptions;
      },
      find(_super, req, criteria, projection) {
        return _super(req, criteria, projection).defaultSort(self.options.sort || { updatedAt: -1 });
      }
    };
  }
};
