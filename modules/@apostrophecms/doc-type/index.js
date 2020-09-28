const _ = require('lodash');

module.exports = {
  cascades: [ 'fields' ],
  fields(self, options) {
    return {
      add: {
        title: {
          type: 'string',
          label: 'Title',
          required: true,
          // Generate a titleSort property which can be sorted
          // in a human-friendly way (case insensitive, ignores the
          // same stuff slugs ignore)
          sortify: true
        },
        slug: {
          type: 'slug',
          label: 'Slug',
          following: 'title',
          required: true
        },
        published: {
          type: 'boolean',
          label: 'Published',
          def: true
        },
        trash: {
          type: 'boolean',
          label: 'Trash',
          contextual: true,
          def: false
        },
        ...(options.permissionsFields ? {
          loginRequired: {
            type: 'select',
            label: 'Who can view this?',
            def: '',
            choices: [
              {
                value: '',
                label: 'Public'
              },
              {
                value: 'loginRequired',
                label: 'Login Required'
              },
              {
                value: 'certainUsers',
                label: 'Certain People',
                showFields: [
                  '_viewGroups',
                  '_viewUsers'
                ]
              }
            ]
          },
          _viewUsers: {
            type: 'relationship',
            withType: '@apostrophecms/user',
            label: 'These Users can View',
            idsStorage: 'viewUsersIds'
          },
          _viewGroups: {
            type: 'relationship',
            withType: '@apostrophecms/group',
            label: 'These Groups can View',
            idsStorage: 'viewGroupsIds'
          },
          _editUsers: {
            type: 'relationship',
            withType: '@apostrophecms/user',
            label: 'These Users can Edit',
            idsStorage: 'editUsersIds',
            // Gets patched after full initialization
            permission: 'admin'
          },
          _editGroups: {
            type: 'relationship',
            withType: '@apostrophecms/group',
            label: 'These Groups can Edit',
            idsStorage: 'editGroupsIds',
            // Gets patched after full initialization
            permission: 'admin'
          }
        } : {})
      },
      group: {
        basics: {
          label: 'Basics',
          fields: [
            'title'
          ]
        },
        utility: {
          label: 'Utilities',
          fields: [
            'published',
            'slug'
          ]
        },
        permissions: {
          label: 'Permissions',
          fields: [
            'loginRequired',
            '_viewUsers',
            '_viewGroups',
            '_editUsers',
            '_editGroups'
          ],
          last: true
        }
      }
    };
  },
  init(self, options) {
    if (!self.options.name) {
      self.options.name = self.__meta.name;
    }
    self.name = options.name;
    // Each doc-type has an array of fields which will be updated
    // if the document is moved to the trash. In most cases 'slug'
    // might suffice. For users, for instance, the email field should
    // be prefixed (de-duplicated) so that the email address is available.
    // A trash prefix should always be used for fields that have no bearing
    // on page tree relationships. A suffix should always be used for fields
    // that do (`slug` and `path`).
    //
    // For suffixes, @apostrophecms/page will take care of adding and removing
    // them from earlier components in the path or slug as required.
    self.trashPrefixFields = [ 'slug' ];
    self.trashSuffixFields = [];
    self.patchAdminPermissionInSchema();
    self.composeSchema();
    self.apos.doc.setManager(self.name, self);
    self.enableBrowserData();
  },
  handlers(self, options) {
    return {
      beforeSave: {
        prepareRelationshipsForStorage(req, doc) {
          self.apos.schema.prepareRelationshipsForStorage(req, doc);
        },
        slugPrefix(req, doc) {
          if (self.options.slugPrefix) {
            if (!doc.slug) {
              doc.slug = 'none';
            }
            if (!doc.slug.startsWith(self.options.slugPrefix)) {
              doc.slug = `${self.options.slugPrefix}${doc.slug}`;
            }
          }
        }
      },
      afterSave: {
        async emitAfterTrashOrAfterRescue(req, doc) {
          if (doc.trash && (!doc.aposWasTrash)) {
            await self.apos.doc.db.updateOne({
              _id: doc._id
            }, {
              $set: {
                aposWasTrash: true
              }
            });
            return self.emit('afterTrash', req, doc);
          } else if ((!doc.trash) && (doc.aposWasTrash)) {
            await self.apos.doc.db.updateOne({
              _id: doc._id
            }, {
              $set: {
                aposWasTrash: false
              }
            });
            return self.emit('afterRescue', req, doc);
          }
        }
      },
      afterTrash: {
        deduplicateTrash(req, doc) {
          const deduplicateKey = doc._id;
          if (doc.parkedId === 'trash') {
            // The primary trashcan itself should not deduplicate
            return;
          }
          const prefix = 'deduplicate-' + deduplicateKey + '-';
          const suffix = '-deduplicate-' + deduplicateKey;
          const $set = {};
          _.each(self.trashPrefixFields, function (name) {
            if (typeof doc[name] !== 'string') {
              // Presumably a sparse index
              return;
            }
            if (doc[name].substr(0, prefix.length) !== prefix) {
              $set[name] = prefix + doc[name];
            }
            // So methods called later, or extending this method, see the change in piece
            doc[name] = $set[name];
          });
          _.each(self.trashSuffixFields, function (name) {
            if (typeof doc[name] !== 'string') {
              // Presumably a sparse index
              return;
            }
            if (doc[name].substr(doc[name].length - suffix.length) !== suffix) {
              $set[name] = doc[name] + suffix;
            }
            // So methods called later, or extending this method, see the change in piece
            doc[name] = $set[name];
          });
          if (_.isEmpty($set)) {
            return;
          }
          return self.apos.doc.db.updateOne({ _id: doc._id }, { $set: $set });
        }
      },
      afterRescue: {
        async deduplicateRescue(req, doc) {
          if (doc.parkedId === 'trash') {
            // The primary trashcan itself should not deduplicate
            return;
          }
          const deduplicateKey = doc._id;
          const prefix = 'deduplicate-' + deduplicateKey + '-';
          const suffix = '-deduplicate-' + deduplicateKey;
          const $set = {};
          _.each(self.trashPrefixFields, function (name) {
            if (typeof doc[name] !== 'string') {
              // Presumably a sparse index
              return;
            }
            $set[name] = doc[name].replace(prefix, '');
          });
          _.each(self.trashSuffixFields, function (name) {
            if (typeof doc[name] !== 'string') {
              // Presumably a sparse index
              return;
            }
            $set[name] = doc[name].replace(suffix, '');
          });
          for (const field of self.trashPrefixFields.concat(self.trashSuffixFields)) {
            await checkOne(field);
          }
          await update();
          async function checkOne(name) {
            const query = {
              type: self.name,
              _id: { $ne: doc._id }
            };
            if (doc.workflowLocale) {
              query.workflowLocale = doc.workflowLocale;
            }
            query[name] = $set[name];
            if ($set[name] === '') {
              // Assume sparse index if empty strings are seen; don't
              // generate lots of weird prefix-only email addresses
              return;
            }
            const found = await self.apos.doc.db.findOne(query, { _id: 1 });
            if (found) {
              delete $set[name];
            }
          }
          async function update() {
            const action = { $set: $set };
            // So methods called later, or extending this method, see the change in docs
            _.assign(doc, $set);
            if (_.isEmpty($set)) {
              // Nothing to do
              return;
            }
            return self.apos.doc.db.updateOne({ _id: doc._id }, action);
          }
        }
      },
      '@apostrophecms/search:index': {
        // When a doc is indexed for search, this method adds
        // additional search texts to the `texts` array (modify it in place by
        // pushing new objects to it). These texts influence search results.
        // The default behavior is quite useful, so you won't often need to
        // override this.
        //
        // Each "text" is an *object* and must have at least `weight` and `text` properties.
        // If `weight` is >= 10, the text will be included in autocomplete searches and
        // given higher priority in full-text searches. Otherwise it will be included
        // only in full-text searches.
        //
        // If `silent` is `true`, the `searchSummary` property will not contain
        // the text.
        //
        // By default this method invokes `schemas.indexFields`, which will push
        // texts for all of the schema fields that support this unless they are
        // explicitly set `searchable: false`.
        //
        // In any case, the text of rich text widgets is always included as
        // lower-priority search text.
        async searchIndexBySchema(doc, texts) {
          if (doc.type !== self.name) {
            return;
          }
          await self.apos.schema.indexFields(self.schema, doc, texts);
        }
      }

    };
  },

  methods(self, options) {
    return {
      sanitizeFieldList(choices) {
        if ((typeof choices) === 'string') {
          return choices.split(/\s*,\s*/);
        } else {
          return self.apos.launder.strings(choices);
        }
      },
      addTrashPrefixFields(fields) {
        self.trashPrefixFields = self.trashPrefixFields.concat(fields);
      },
      removeTrashPrefixFields(fields) {
        self.trashPrefixFields = _.difference(self.trashPrefixFields, fields);
      },
      addTrashSuffixFields(fields) {
        self.trashSuffixFields = self.trashSuffixFields.concat(fields);
      },
      removeTrashSuffixFields(fields) {
        self.trashSuffixFields = _.difference(self.trashSuffixFields, fields);
      },
      // Returns the minimum permission name that should be checked for
      // to determine if this user has some edit privileges for
      // this doc type (not necessarily every instance of it),
      // for example the ability to create one. Determines
      // admin bar menu item visibility
      getEditPermissionName() {
        return self.isAdminOnly() ? 'admin' : 'edit-' + self.name;
      },
      // Returns the minimum permission name that should be checked for
      // to determine if this user has full admin privileges for
      // this doc type
      getAdminPermissionName() {
        return self.isAdminOnly() ? 'admin' : 'admin-' + self.name;
      },
      // Returns a query that will only yield docs of the appropriate type
      // as determined by the `name` option of the module.
      // `criteria` is the MongoDB criteria object, and any properties of
      // `options` are invoked as query builder methods on the query with
      // their values.
      find(req, criteria, options) {
        const query = {
          state: {},
          methods: {},
          builders: {},
          afters: {}
        };
        for (const name of self.__meta.chain.map(entry => entry.name)) {
          const fn = self.queries[name];
          if (fn) {
            const result = fn(self, query);
            if (result.builders) {
              Object.assign(query.builders, result.builders);
            }
            if (result.methods) {
              Object.assign(query.methods, result.methods);
            }
          }
          if (self.extendQueries[name]) {
            wrap(query.builders, self.extendQueries[name].builders || {});
            wrap(query.methods, self.extendQueries[name].methods || {});
          }
        }
        Object.assign(query, query.methods);
        for (const [ name, definition ] of Object.entries(query.builders)) {
          query.addBuilder(name, definition);
        }
        // Add query builders for each field in the schema that doesn't
        // yet have one based on its schema field type
        self.apos.schema.addQueryBuilders(self.schema, query);
        query.handleFindArguments({
          req,
          criteria,
          options
        });
        query.type(self.options.name);
        return query;
      },
      // Returns a new instance of the doc type, with the appropriate default
      // values for each schema field.
      newInstance() {
        const doc = self.apos.schema.newInstance(self.schema);
        doc.type = self.name;
        return doc;
      },
      // Returns a MongoDB projection object to be used when querying
      // for this type if all that is needed is a title for display
      // in an autocomplete menu. Default behavior is to
      // return only the `title`, `_id` and `slug` properties.
      // Removing any of these three is not recommended.
      //
      // `query.field` will contain the schema field definition for
      // the relationship the user is attempting to match titles from.
      getAutocompleteProjection(query) {
        return {
          title: 1,
          _id: 1,
          slug: 1
        };
      },
      // Returns a string to represent the given `doc` in an
      // autocomplete menu. `doc` will contain only the fields returned
      // by `getAutocompleteProjection`. `query.field` will contain
      // the schema field definition for the relationship the user is attempting
      // to match titles from. The default behavior is to return
      // the `title` property. This is sometimes extended to include
      // event start dates and similar information that helps the
      // user distinguish between docs.
      getAutocompleteTitle(doc, query) {
        return doc.title;
      },
      // Used by `@apostrophecms/version` to label changes that
      // are made to relationships by ID. Set `change.text` to the
      // desired text.
      decorateChange(doc, change) {
        change.text = doc.title;
      },
      // Returns true if only admins are allowed to edit this type.
      isAdminOnly() {
        return self.options.adminOnly;
      },
      // Return a new schema containing only fields for which the
      // current user has the permission specified by the `permission`
      // property of the schema field, or there is no `permission` property for the field.
      allowedSchema(req) {
        let disabled;
        let type;
        const schema = _.filter(self.schema, function (field) {
          return !field.permission || self.apos.permission.can(req, field.permission);
        });
        const typeIndex = _.findIndex(schema, { name: 'type' });
        if (typeIndex !== -1) {
          // This option exists so that the
          // @apostrophecms/option-overrides and @apostrophecms/workflow modules,
          // if present, can be used together to disable various types based
          // on locale settings
          disabled = self.apos.page.getOption(req, 'disabledTypes');
          if (disabled) {
            // Take care to clone so we don't wind up modifying
            // the original schema, the allowed schema is only
            // a shallow clone of the array so far
            type = _.cloneDeep(schema[typeIndex]);
            type.choices = _.filter(type.choices, function (choice) {
              return !_.includes(disabled, choice.value);
            });
            // Make sure the allowed schema refers to the clone,
            // not the original
            schema[typeIndex] = type;
          }
        }
        return schema;
      },
      composeSchema() {
        self.schema = self.apos.schema.compose({
          addFields: self.apos.schema.fieldsToArray(`Module ${self.__meta.name}`, self.fields),
          arrangeFields: self.apos.schema.groupsToArray(self.fieldsGroups)
        });
        if (self.options.slugPrefix) {
          const slug = self.schema.find(field => field.name === 'slug');
          if (slug) {
            slug.prefix = self.options.slugPrefix;
          }
        }
        // Extend `composeSchema` to flag the use of field names
        // that are forbidden or nonfunctional in all doc types, i.e.
        // properties that will be overwritten by non-schema-driven
        // logic, such as `_id` or `docPermissions`
        const forbiddenFields = [
          '_id',
          'docPermissions',
          'titleSortified',
          'highSearchText',
          'highSearchWords',
          'lowSearchText',
          'searchSummary'
        ];
        _.each(self.schema, function (field) {
          if (_.includes(forbiddenFields, field.name)) {
            throw new Error('Doc type ' + self.name + ': the field name ' + field.name + ' is forbidden');
          }
        });
        self.patchAdminPermissionInSchema();
      },
      // In the schema, `_editUsers` and `_editGroups` are
      // initially locked down to sitewide admins. Now that
      // we've constructed the module completely, take advantage
      // of `getAdminPermissionName` to specify a more nuanced permission,
      // such as the admin permission for this piece type, or for pages
      patchAdminPermissionInSchema() {
        const fieldNames = [
          '_editUsers',
          '_editGroups'
        ];
        _.each(fieldNames, function (fieldName) {
          const field = _.find(self.schema, { name: fieldName });
          if (field) {
            field.permission = self.getAdminPermissionName();
          }
        });
      },
      // This method provides the back end of /autocomplete routes.
      // For the implementation of the autocomplete() query builder see autocomplete.js.
      //
      // "query" must contain a "field" property which is the schema relationship field
      // that describes the relationship we're adding items to.
      //
      // "query" must also contain a "term" property, which is a partial
      // string to be autocompleted; otherwise an empty array is returned.
      //
      // We don't launder the input here, see the 'autocomplete' route.
      async autocomplete(req, query) {
        const _query = query.find(req, {}).sort('search');
        if (query.extendAutocompleteQuery) {
          query.extendAutocompleteQuery(_query);
        }
        _query.project(self.getAutocompleteProjection(), query);
        // Try harder not to call autocomplete with something that doesn't
        // result in a search
        if (query.term && query.term.toString && query.term.toString().length) {
          const term = self.apos.launder.string(query.term);
          _query.autocomplete(term);
        } else {
          return [];
        }
        if (!(query.builders && query.builders.limit)) {
          _query.limit(10);
        }
        _query.applyBuildersSafely(query.field.builders || {});
        // Format it as value & label properties for compatibility with
        // our usual assumptions on the front end
        let docs = await _query.toArray();
        // Put the snippets in id order
        if (query.values) {
          docs = self.apos.util.orderById(query.values, docs);
        }
        const results = _.map(docs, doc => {
          const response = {
            label: self.getAutocompleteTitle(doc, query),
            value: doc._id
          };
          _.defaults(response, _.omit(doc, 'title', '_id'));
          return response;
        });
        return results;
      },
      // Fields required to compute the `_url` property.
      // Used to implement a "projection" for `_url` if
      // requested by the developer
      getUrlFields() {
        return [
          'type',
          'slug'
        ];
      },
      // Most of the time, this is called for you. Any schema field
      // with `sortify: true` will automatically get a migration to
      // ensure that, if the field is named `lastName`, then
      // `lastNameSortified` exists.
      //
      // Adds a migration that takes the given field, such as `lastName`, and
      // creates a parallel `lastNameSortified` field, formatted with
      // `apos.util.sortify` so that it sorts and compares in a more
      // intuitive, case-insensitive way.
      //
      // After adding such a migration, you can add `sortify: true` to the
      // schema field declaration for `field`, and any calls to
      // the `sort()` query builder for `lastName` will automatically
      // use `lastNameSortified`. You can also do that explicitly of course.
      //
      // Note that you want to do both things (add the migration, and
      // add `sortify: true`) because `sortify: true` guarantees that
      // `lastNameSortified` gets updated on all saves of a doc of this type.
      // The migration is a one-time fix for existing data.
      addSortifyMigration(field) {
        if (!self.name) {
          return;
        }
        return self.apos.migration.addSortify(self.__meta.name, { type: self.name }, field);
      },
      getBrowserData(req) {
        const data = _.pick(options, 'name', 'label', 'pluralLabel');
        data.action = self.action;
        data.schema = self.allowedSchema(req);
        return data;
      },

      // Convert the untrusted data supplied in `input` via the schema and
      // update the doc object accordingly.
      //
      // If `options.presentFieldsOnly` is true, only fields that exist in
      // `input` are affected. Otherwise any absent fields get their default values.
      //
      // To intentionally erase a field's contents when this option
      // is present, use `null` for that input field or another representation appropriate
      // to the type, i.e. an empty string for a string.
      //
      // If `options.copyingId` is present, the doc with the given id is
      // fetched and used as defaults for any schema fields not defined
      // in `input`. This overrides `presentFieldsOnly` as long as the fields
      // in question exist in the doc being copied.

      async convert(req, input, doc, options = {
        presentFieldsOnly: false,
        copyingId: false
      }) {
        let schema = self.apos.doc.getManager(options.type || self.name).allowedSchema(req);
        let copyOf;
        if (options.presentFieldsOnly) {
          schema = self.apos.schema.subset(schema, self.fieldsPresent(input));
        }
        if (options.copyingId) {
          copyOf = await self.findOneForCopying(req, { _id: options.copyingId });
          if (!copyOf) {
            throw self.apos.error('notfound');
          }
          input = {
            ...copyOf,
            ...input
          };
        }
        await self.apos.schema.convert(req, schema, input, doc);
        if (copyOf) {
          await self.emit('copyExtras', req, copyOf, input, doc);
        }
      },

      // Return the names of all schema fields present in the `input` object,
      // taking into account issues like relationship fields keeping their data in
      // a separate ids property, etc.
      fieldsPresent(input) {
        const schema = self.schema;
        const output = [];
        for (const field of schema) {
          if (field.type.name.substring(0, 5) === '_relationship') {
            if (_.has(input, field.idsStorage)) {
              output.push(field.name);
            }
          } else {
            output.push(field.name);
          }
        }
      },
      // Returns a cursor that finds docs the current user can edit. Unlike
      // find(), this cursor defaults to including unpublished docs. Subclasses
      // of @apostrophecms/piece-type often extend this to remove more default filters
      findForEditing(req, criteria, projection) {
        const cursor = self.find(req, criteria).permission('edit').published(null).trash(null);
        if (projection) {
          cursor.project(projection);
        }
        return cursor;
      },
      // Returns one editable doc matching the criteria, null if none match.
      // if annotate: true is present, annotate all image URLs for a REST response.
      async findOneForEditing(req, criteria, options = { annotate: false }) {
        const doc = await self.findForEditing(req, criteria).toObject();
        if (options.annotate) {
          self.apos.attachment.all(doc, { annotate: true });
        }
        return doc;
      },
      async findOneForCopying(req, criteria) {
        return self.findOneForEditing(req, criteria);
      }
    };
  },
  queries(self, query) {
    return {
      builders: {
        // `.criteria({...})` Sets the MongoDB criteria, discarding
        // criteria previously added using this
        // method or the `and` method. For this reason,
        // `and` is a more common choice. You can also
        // pass a criteria object as the second argument
        // to any `find` method.

        criteria: {
          def: {}
        },

        // If `.log(true)` is invoked, the query
        // criteria are logged to the console.
        log: {
          def: false
        },

        // `.addLateCriteria({...})` provides an object to be merged directly into the final
        // criteria object that will go to MongoDB. This is to be used only
        // in cases where MongoDB forbids the use of an operator inside
        // `$and`, such as the `$near` operator.
        addLateCriteria: {
          set(c) {
            let lateCriteria = query.get('lateCriteria');
            if (!lateCriteria) {
              lateCriteria = { ...c };
            } else {
              Object.assign(lateCriteria, c);
            }
            query.set('lateCriteria', lateCriteria);
          }
        },

        // `.and({ price: { $gte: 0 } })` requires the query to match only documents
        // with a price greater than 0, in addition to all other criteria for the
        // query.

        and: {
          set(c) {
            if (!c) {
              // So we don't crash on our default value
              return;
            }
            const criteria = query.get('criteria');
            if (!criteria) {
              query.criteria(c);
            } else {
              query.criteria({
                $and: [ criteria, c ]
              });
            }
          }
        },

        // `.project({...})` sets the MongoDB projection. You can also
        // set the projection as the third argument to any
        // `find` method. The name was changed in 3.x to match
        // MongoDB's name for this chainable method of their
        // cursors.

        project: {
          finalize() {
            let projection = query.get('project') || {};
            // Keys beginning with `_` are computed values
            // (exception: `_id`). They do not make sense
            // in MongoDB projections. However Apostrophe
            // projections take advantage of this opportunity
            // to look up the properties the developer
            // really needs to compute them, and add them
            // to the projection instead.
            const add = [];
            const remove = [];
            for (const [ key, val ] of Object.entries(projection)) {
              if (!val) {
                // For a negative projection this is just
                // not a good idea. We don't want to surprise
                // the developer by not fetching `slug` just
                // because they don't want `_url`.
                continue;
              }
              if (key.toString().substr(0, 1) === '_') {
                if (key === '_id') {
                  continue;
                }
                if (!query.projectComputedField(key, add)) {
                  self.apos.util.warn(self.__meta.name + ': a projection cannot find a computed field (' + key + ') unless it is _url\nor the name of a forward relationship in the schema for the type being found.\nThis does not mean the field will not work, but it is on you to know\nwhat fields power it, or if they are even coming from the doc itself.');
                } else {
                  // We don't get the _ property itself
                  // (for one thing, Apostrophe is removing it on every save)
                  remove.push(key);
                }
              }
            }
            projection = { ...projection };
            for (const property of add) {
              projection[property] = 1;
            }
            for (const property of remove) {
              delete projection[property];
            }
            if (query.get('search')) {
              // MongoDB mandates this if we want to sort on search result quality
              projection.textScore = { $meta: 'textScore' };
            }
            query.set('project', projection);
          }
        },

        // `.distinctCounts(true)` makes it possible to obtain
        // counts for each distinct value after a call to
        // `toCount()` is resolved by calling `query.get('distinctCounts')`.
        // These are returned as an object in which the keys are
        // the distinct values of the field, and the values
        // are the number of occurrences for each value.
        //
        // This has a performance impact.

        distinctCounts: {
          def: false
        },

        // `.defaultSort({ title: 1 })` changes the default value for the `sort` query builder.
        // The argument is the same as for the `sort` query builder: an
        // object like `{ title: 1 }`. `false` can be passed to clear
        // a default.
        //
        // This query builder is called by @apostrophecms/piece-type based on its
        // `sort` configuration option.
        //
        // It is distinct from the `sort` feature so that we can
        // distinguish between cases where a default sort should be ignored
        // (for instance, the `search` query builder is present) and cases
        // where a sort is explicitly demanded by the user.

        defaultSort: {
          // Actual implementation is in the sort feature
        },

        // `.sort({ title: 1 }` determines the sort order, similar to how
        // MongoDB does it, with some extra features.
        //
        // If `false` is explicitly passed, there is
        // *no sort at all* (helpful with `$near`).
        //
        // If this method is never called or the argument is
        // undefined, a case-insensitive sort on the title
        // is the default, unless `search()` has been
        // called, in which case a sort by search result
        // quality is the default.
        //
        // If you sort on a field that is defined in the
        // schema for the specific doc type you are finding,
        // and that field has the `sortify: true` option in
        // its schema field definition, then this query builder will
        // automatically substitute a "sortified" version of
        // the field that is case-insensitive, ignores
        // extra whitespace and punctuation, etc. for a
        // more natural sort than MongoDB normally provides.
        //
        // For instance, `title` has `sortify: true` for all
        // doc types, so you always get the more natural sort.

        sort: {
          launder(s) {
            if (s === 'search') {
              return s;
            }
            if ((typeof s) !== 'object') {
              return undefined;
            }
            const sort = {};
            for (let [ key, val ] of Object.entries(s)) {
              if (typeof (key) !== 'string') {
                return;
              }
              if (val === '-1') {
                val = -1;
              } else if (val === '1') {
                val = 1;
              }
              if ((val !== -1) && (val !== 1)) {
                return;
              }
              sort[key] = val;
            }
            return sort;
          },

          finalize: function() {
            query.finalizeSort();
          }
        },

        // `.skip(10)` skips the first 10 matching documents. Affects
        // `toArray` and `toObject`. Does not affect
        // `toDistinct` or `toMongo`.

        skip: {
          launder(s) {
            return self.apos.launder.integer(s, 0, 0);
          }
        },

        // `.limit(10)` limits the result to the first 10 matching
        // documents, after skip is taken into account. Affects `toArray` only.

        limit: {
          launder(s) {
            return self.apos.launder.integer(s, 0, 0);
          }
        },

        // `.perPage(10)` allows you to paginate docs rather than using
        // skip and limit directly.
        //
        // Sets the number of docs per page and enables the
        // use of the `page` query builder to indicate the current page number.
        //
        // Used by `@apostrophecms/piece-type` and `@apostrophecms/piece-page-type`.

        perPage: {
          def: undefined,
          launder(i) {
            return self.apos.launder.integer(i, 1, 1);
          }
        },

        // `.page(5)` sets the current page number to the 5th page
        // overall (there is no page 0). You must also
        // use `perPage`.
        //
        // Used by `@apostrophecms/piece-type` and `@apostrophecms/piece-page-type`.

        page: {
          def: 1,
          launder(i) {
            return self.apos.launder.integer(i, 1, 1);
          },
          finalize() {
            if (query.get('perPage')) {
              query.skip((query.get('page') - 1) * query.get('perPage'));
              query.limit(query.get('perPage'));
            }
          }
        },

        // `.permission('admin')` would limit the returned docs to those for which the
        // user associated with the query's `req` has the named permission.
        // By default, `view-doc` is checked for. You might want to specify
        // `edit-doc`, or `admin` if you are interested in the global admin permission.
        //
        // USE WITH CARE: If you pass `false`, permissions checks are disabled
        // for this particular query.
        //
        // If this method is never called, or you pass
        // `undefined` or `null`, `view-doc` is still checked for.
        //
        // The permission name is suffixed for you
        // with a specific doc type name if the type query builder
        // has been called, however for database queries
        // this normally makes no difference unless the permissions
        // module has been extended.
        //
        // In all cases, all of the returned docs are marked
        // with `_edit: true` properties
        // if the user associated with the request is allowed to
        // do that. This is useful if you are fetching
        // docs for viewing but also want to know which ones
        // can be edited.

        permission: {
          finalize() {
            const typeSuffix = '-' + (query.get('type') || 'doc');
            let permission = query.get('permission');
            if (permission !== false) {
              if (permission && (!permission.match(/-/))) {
                permission = permission + typeSuffix;
              }
              query.and(self.apos.permission.criteria(query.req, permission || ('view-' + typeSuffix)));
            }
          },
          after: function(results) {
            // In all cases we mark the docs with ._edit if
            // the req is permitted to do that
            self.apos.permission.annotate(query.req, 'edit-doc', results);
          }
        },

        // `.autocomplete('sta')` limits results to docs which are a good match for
        // a partial string beginning with `sta`, for instance `station`. Appropriate words
        // must exist in the title or other text schema fields of
        // the doc (autocomplete is not full text body search). Those words
        // are then fed back into the `search` query builder to prioritize the results.

        autocomplete: require('./lib/autocomplete.js')(self, query),

        // `.search('tree')` limits results to those matching that text search.
        // Search is implemented using MongoDB's `$text` operator and a full
        // text index.
        //
        // If this query builder is set, the `sort` query builder will default to sorting
        // by search quality. This is important because the worst of the
        // full-text search matches will be of very poor quality.

        search: {
          finalize() {
            // Other finalizers also address other
            // aspects of this, like adjusting
            // projection and sort
            const search = query.get('search');
            if (search) {
              if (query.get('regexSearch')) {
                // TODO: is this necessary in MongoDB 3.4+?
                // A query builder like the `geo` query builder of @apostrophecms/places
                // has warned us that `$near` or another operator incompatible
                // with `$text` is present. We must dumb down to regex search
                query.and({
                  highSearchText: self.apos.util.searchify(search)
                });
              } else {
                // Set up MongoDB text index search
                query.and({
                  $text: { $search: search }
                });
              }
            }
          },
          launder(s) {
            return self.apos.launder.string(s);
          }
        },

        // `.trash(flag)`. If flag is `false`, `undefined` or this method is
        // never called, the query returns only docs not in the trash. This is
        // the default behavior.
        //
        // if flag is `true`, returns only docs in the trash. Note permissions
        // would still prevent a typical site visitor from obtaining any results,
        // but an editor might.
        //
        // if flag is `null` (not undefined), return
        // docs regardless of trash status.

        trash: {
          finalize() {
            const trash = query.get('trash');
            if (trash === null) {
              // We are interested regardless of trash state
              return;
            }
            if (!trash) {
              // allow trash to work as a normal boolean; also treat
              // docs inserted with no trash property at all as not
              // being trash. Yes it is safe to use $ne with
              // an index: https://github.com/apostrophecms/apostrophe/issues/1601
              query.and({
                trash: {
                  $ne: true
                }
              });
              return;
            }
            query.and({
              trash: true
            });
          },
          launder(s) {
            return self.apos.launder.booleanOrNull(s);
          },
          choices() {
            // For the trash query builder, it is generally a mistake not to offer "No" as a choice,
            // even if everything is in the trash, as "No" is often the default.
            return [
              {
                value: '0',
                label: 'No'
              },
              {
                value: '1',
                label: 'Yes'
              }
            ];
          }
        },

        // `.published(flag)`. If flag is `undefined`, `true` or this
        // method is never called, return only published docs.
        //
        // If flag is `false`, return only unpublished docs.
        //
        // If flag is `null`, return docs without regard
        // to published status.
        //
        // Regardless of this query builder the user's permissions are
        // always taken into account. For instance, a logged-out user will never
        // see unpublished documents unless `permissions(false)` is called.

        published: {
          def: true,
          finalize() {
            const published = query.get('published');
            if (published === null) {
              return;
            }
            if (published) {
              query.and({
                published: true
              });
              return;
            }
            query.and({
              published: { $ne: true }
            });
          },
          launder(s) {
            return self.apos.launder.booleanOrNull(s);
          },
          choices() {
            // For the published query builder, it is generally a mistake not to offer "Yes" as a choice,
            // even if everything is unpublished, as "Yes" is often the default.
            return [
              {
                value: '0',
                label: 'No'
              },
              {
                value: '1',
                label: 'Yes'
              }
            ];
          }
        },

        // `.explicitOrder([ id1, id2... ])` causes the query to return values
        // in that order, assuming the documents with the specified ids exist.
        // If a doc is not mentioned in the array it will
        // be discarded from the result. Docs that
        // exist in the array but not in the database are
        // also absent from the result.
        //
        // As a second argument you may optionally specify a property name
        // other than `_id` to order on.

        explicitOrder: {
          set(values, property) {
            property = property || '_id';
            query.set('explicitOrder', values);
            query.set('explicitOrderProperty', property);
          },
          finalize() {
            if (!query.get('explicitOrder')) {
              return;
            }
            const criteria = {};
            const values = query.get('explicitOrder');
            const property = query.get('explicitOrderProperty');
            if (!values.length) {
              // MongoDB gets mad if you have an empty $in
              criteria[property] = { _id: '__iNeverMatch' };
              query.and(criteria);
              return;
            }
            criteria[property] = { $in: values };
            query.and(criteria);
            query.set('explicitOrderSkip', query.get('skip'));
            query.set('explicitOrderLimit', query.get('limit'));
            query.set('skip', undefined);
            query.set('limit', undefined);
          },
          after(results) {
            const values = query.get('explicitOrder');
            if (!values) {
              return;
            }
            const property = query.get('explicitOrderProperty');
            const temp = self.apos.util.orderById(values, results, property);
            let i;
            // Must modify array in place
            for (i = 0; (i < temp.length); i++) {
              results[i] = temp[i];
            }
            const skip = query.get('explicitOrderSkip');
            const limit = query.get('explicitOrderLimit');
            if ((typeof (skip) !== 'number') && (typeof (limit) !== 'number')) {
              return;
            }
            // Put them in the correct order as specified first
            // We must modify the array object in place, as there is no provision
            // for returning a new one
            results.splice(0, skip);
            results.splice(limit, results.length - limit);
          }
        },

        // `.type('product')` causes the query to only retrieve documents of the
        // specified type. Filters out everything else.
        //
        // Generally you don't want to call this method directly.
        // Call the `find()` method of the doc type manager
        // for the type you are interested in. This will also
        // give you a query of the right subclass.

        type: {
          finalize() {
            const type = query.get('type');
            if (type) {
              query.and({ type: type });
            }
          }
        },

        // `.relationships(true)`. Fetches relationships by default, for all types retrieved,
        // based on the schema for each type. If `relationships(false)` is
        // explicitly called no relationships are fetched. If
        // `relationships([ ... ])` is invoked with an array of relationship names
        // only those relationships and those intermediate to them
        // are fetched (dot notation). See `@apostrophecms/schema`
        // for more information.

        relationships: {
          def: true,
          async after(results) {
            if (!query.get('relationships')) {
              return;
            }
            const resultsByType = _.groupBy(results, 'type');
            for (const type of _.keys(resultsByType)) {
              const manager = self.apos.doc.getManager(type);
              // Careful, there will be no manager if type was not part of the projection
              if (manager && manager.schema) {
                await self.apos.schema.relate(query.req, manager.schema, resultsByType[type], query.get('relationships'));
              }
            }
          }
        },

        // `.addUrls(true)`. Invokes the `addUrls` method of all doc type managers
        // with relevant docs among the results, if they have one.
        //
        // The `addUrls` method receives `(req, docs)`. All of the docs will be of
        // the appropriate type for that manager.
        //
        // The `addUrls` method should add the `._url` property to each doc,
        // if possible.
        //
        // If it is not possible (there is no corresponding pieces-page)
        // it may be left unset.
        //
        // Defaults to `true`. If set to false, `addUrls` methods are
        // not invoked.

        addUrls: {
          def: true,
          async after(results) {
            const req = query.req;
            const val = query.get('addUrls');
            if (!val) {
              return;
            }
            const byType = {};
            for (const doc of results) {
              byType[doc.type] = byType[doc.type] || [];
              byType[doc.type].push(doc);
            }
            const interesting = Object.keys(byType).filter(type => {
              // Don't freak out if the projection was really conservative
              // and the type is unknown, etc.
              const manager = self.apos.doc.getManager(type);
              return manager && manager.addUrls;
            });
            for (const type of interesting) {
              await self.apos.doc.getManager(type).addUrls(req, byType[type]);
            }
          }
        },

        // `.previous({ doc object goes here })`. If set to a doc object, this query builder will limit
        // results to the docs that precede it in the current sort order.
        //
        // In addition to the current sort, the `_id` is used as a tiebreaker sort to avoid loops.

        previous: {
          def: false,
          finalize() {
            query.nextOrPrevious('previous');
          }
        },

        // `.next({ doc object goes here })`. If set to a doc object, this query builder will limit
        // results to the docs that follow it in the current sort order.
        //
        // In addition to the current sort, the `_id` is used as a tiebreaker sort to avoid loops.

        next: {
          def: false,
          finalize() {
            query.nextOrPrevious('next');
          }
        },

        // All docs that are part of the page tree (they have a slug
        // beginning with a `/`) receive a `._url` property, which takes the
        // sitewide prefix into account if necessary. Always use this property.
        // Never use the slug as a URL.
        //
        // This feature is turned on by default, but you may chain
        // `.pageUrl(false)` to disable it for a particular query.
        //
        // Note that many type-specific queries, such as those for `pieces`,
        // also add a `._url` property appropriate to their type if a suitable
        // pieces page is available.

        pageUrl: {
          def: true,
          after(results) {
            for (const result of results) {
              if (result.slug && self.apos.page.isPage(result)) {
                const url = self.apos.page.getBaseUrl(query.req);
                result._url = url + self.apos.prefix + result.slug;
              }
            }
          }
        },

        // The areas query builder calls the `load` methods of the
        // widget type managers for widgets in areas. By default
        // this does occur. With `.areas(false)` you can
        // shut it off for a particular query. With
        // .areas([ 'thumbnail' ]) you can load just that
        // one area for all pages matching the query.

        areas: {
          def: true,
          async after(results) {
            const setting = query.get('areas');
            if (!setting) {
              return;
            }
            const req = query.req;
            req.areasLoadedFor = req.areasLoadedFor || {};

            const widgetsByType = {};

            for (const doc of results) {
              const areasInfo = [];
              self.apos.area.walk(doc, function(area, dotPath) {
                areasInfo.push({
                  area: area,
                  dotPath: dotPath
                });
              });
              if (areasInfo.length) {
                // Simple guard against infinite recursion:
                // we won't load areas for the same doc more than five times
                // per page request.
                //
                // We run this guard only if areas actually exist so we're
                // not unfairly triggered by docs loaded with a restricted
                // projection.
                if (!_.has(req.areasLoadedFor, doc._id)) {
                  req.areasLoadedFor[doc._id] = 0;
                }
                if (req.areasLoadedFor[doc._id] >= 5) {
                  self.apos.util.warn('WARNING: reached maximum area loader recursion level. Doc _id is ' + doc._id + '. Are you using projections for all relationships?');
                  return;
                }
                req.areasLoadedFor[doc._id]++;
                for (const info of areasInfo) {
                  const area = info.area;
                  const dotPath = info.dotPath;
                  if (setting && Array.isArray(setting)) {
                    if (!_.includes(setting, dotPath)) {
                      return;
                    }
                  }
                  if (doc._edit) {
                    area._edit = true;
                  }

                  area._docId = doc._id;
                  for (const item of area.items) {
                    if (area._edit) {
                      // Keep propagating ._edit so a widget can be passed
                      // like a doc to aposArea if it contains nested areas. -Tom
                      item._edit = true;
                    }
                    item._docId = doc._id;
                    if (!widgetsByType[item.type]) {
                      widgetsByType[item.type] = [];
                    }
                    widgetsByType[item.type].push(item);
                  }
                }
              }
            }

            if (req.deferWidgetLoading && (!req.loadingDeferredWidgets)) {
              const types = Object.keys(widgetsByType);
              for (const type of types) {
                const manager = self.apos.area.getWidgetManager(type);
                if (!manager) {
                  self.apos.area.warnMissingWidgetType(type);
                } else if (manager.options.defer) {
                  req.deferredWidgets = req.deferredWidgets || {};
                  req.deferredWidgets[type] = (req.deferredWidgets[type] || []).concat(widgetsByType[type]);
                  delete widgetsByType[type];
                }
              }
            }

            for (const type of _.keys(widgetsByType)) {
              const manager = self.apos.area.getWidgetManager(type);
              if (!manager) {
                self.apos.area.warnMissingWidgetType(type);
              }
              if (!(manager && manager.load)) {
                continue;
              }
              await manager.load(req, widgetsByType[type]);
            }
          }
        },

        choices: {
          def: false,
          launder(choices) {
            return self.sanitizeFieldList(choices);
          },
          async after(results) {
            const filters = query.get('choices');
            if (!filters) {
              return;
            }
            const choices = {};
            for (const filter of filters) {
              // The choices for each filter should reflect the effect of all filters
              // except this one (filtering by topic pares down the list of categories and
              // vice versa)
              const _cursor = query.clone();
              _cursor[filter](undefined);
              choices[filter] = await _cursor.toChoices(filter, { counts: query.get('counts') });
            }
            if (query.get('counts')) {
              query.set('countsResults', choices);
            } else {
              query.set('choicesResults', choices);
            }
          }
        },

        // Alternative to `choices` that also returns a count property for each choice,
        // has a higher impact on the db
        counts: {
          def: false,
          launder(counts) {
            return self.sanitizeFieldList(counts);
          },
          set(choices) {
            query.choices(choices);
            query.set('counts', true);
          }
        }

      },

      methods: {

        // Add a query builder to the query. Used to implement
        // the builder section of the module specification, and
        // also called on the fly by the schemas module which
        // automatically adds query builders for the common
        // schema field types.

        addBuilder(name, definition) {
          const set = definition.set || (value => {
            query.set(name, value);
          });
          query[name] = function() {
            if (query._finalized) {
              throw new Error(`The query has already been finalized, refusing to invoke the ${name} query builder. You may want to clone the query: query.clone()`);
            }
            set.apply(query, arguments);
            return query;
          };
          query.builders[name] = definition;
        },

        // Returns an array of all distinct values
        // for the given `property`. Not chainable. Wraps
        // MongoDB's `distinct` and does not understand
        // relationship fields directly. However, see also
        // `toChoices`, which is built upon it.
        //
        // The `options` argument may be omitted entirely.
        //
        // If `distinctCounts(true)` has been called on this query,
        // you can obtain counts for each unique value via
        // `query.get('distinctCounts')` after this method returns.
        // These are returned as an object whose properties are
        // the distinct values and whose values are the counts.
        // This has a performance impact. Not chainable.

        async toDistinct(property) {
          await query.finalize();

          if (!query.get('distinctCounts')) {
            return self.apos.doc.db.distinct(property, query.get('criteria'));
          } else {
            return distinctCounts();
          }

          async function distinctCounts() {
            const pipeline = [
              {
                $match: query.get('criteria')
              },
              {
                $unwind: '$' + property
              },
              {
                $group: {
                  _id: '$' + property,
                  count: {
                    $sum: 1
                  }
                }
              }
            ];
            const results = await self.apos.doc.db.aggregate(pipeline).toArray();
            const counts = {};

            _.each(results, function(doc) {
              counts[doc._id] = doc.count;
            });
            query.set('distinctCounts', counts);
            return results.map(result => result._id);
          }
        },

        // Returns an array of objects with
        // `label` and `value` properties suitable for
        // display as a `select` menu or use as an
        // autocomplete API response. Most field types
        // support this well, including `relationship`.
        //
        // If `options.counts` is truthy, then each result
        // in the array will also have a `count` property,
        // wherever this is supported.
        //
        // the `options` object can be omitted completely.
        //
        // It is best to add your properties to your schema, using
        // a schema field type that features a `choices` property (most do), so
        // there is no ambiguity about what this method should do
        //
        // However, if there is no choices function or no query builder at all,
        // the distinct database values for the property are presented as the options.
        //
        // In this scenario the explicit values `true` or `false` receive the labels
        // `Yes` and `No`.
        //
        // Not chainable.

        async toChoices(property, options) {
          options = options || {};
          if (options.counts) {
            query.distinctCounts(true);
          }
          let choicesFn;
          const builder = query.builders[property];
          if (builder) {
            if (builder.choices) {
              choicesFn = builder.choices;
            }
          }
          if (!choicesFn) {
            choicesFn = async () => query.toDistinct(property, options);
          }
          let results = await choicesFn(options);
          if (!results.length) {
            return results;
          }
          if (typeof (results[0]) !== 'object') {
            // Some choices methods just deliver an array of values
            results = results.map(result => {
              if (result === true) {
                return {
                  label: 'Yes',
                  value: true
                };
              } else if (result === false) {
                return {
                  label: 'No',
                  value: false
                };
              } else {
                return {
                  label: result,
                  value: result
                };
              }
            });
          }
          const counts = query.get('distinctCounts');
          if (counts && ((typeof counts) === 'object')) {
            for (const result of results) {
              result.count = counts[result.value];
            }
          }
          return results;
        },

        // Returns the first document matching the query.
        // Not chainable.

        async toObject() {
          const limit = query.get('limit');
          query.set('limit', 1);
          const result = (await query.toArray())[0];
          query.set('limit', limit);
          return result;
        },

        // Returns the number of documents matching
        // the query, ignoring the `page`, `skip` and `limit` query builders.
        //
        // If the `perPage` query builder is set, `totalPages` is
        // made available via `query.get('totalPages')`.
        //
        // Not chainable.

        async toCount() {
          const subquery = query.clone();
          subquery.skip(undefined);
          subquery.limit(undefined);
          subquery.page(undefined);
          subquery.perPage(undefined);
          const mongo = await subquery.toMongo();
          const count = await mongo.count();
          if (query.get('perPage')) {
            const perPage = query.get('perPage');
            let totalPages = Math.floor(count / perPage);
            if (count % perPage) {
              totalPages++;
            }
            query.set('totalPages', totalPages);
          }
          return count;
        },

        // Returns an array of documents matching
        // the query. Not chainable.

        async toArray() {
          const mongo = await query.toMongo();
          const docs = await query.mongoToArray(mongo);
          await query.after(docs);
          return docs;
        },

        // Returns a MongoDB query. You can use this
        // to access MongoDB's `nextObject` method, etc.
        // If you use it, you should also invoke `after`
        // for each result (see below). Generally you should
        // use `toObject`, `toArray`, etc. but for some
        // low-level operations this may be desirable. Not chainable.

        async toMongo() {
          await query.finalize();
          const criteria = query.get('criteria');
          const lateCriteria = query.get('lateCriteria');
          if (lateCriteria) {
            _.assign(criteria, lateCriteria);
          }
          if (query.get('log') || process.env.APOS_LOG_ALL_QUERIES) {
            self.apos.util.log(require('util').inspect(criteria, { depth: 20 }));
          }
          return query.lowLevelMongoCursor(query.req, query.get('criteria'), query.get('project'), {
            skip: query.get('skip'),
            limit: query.get('limit'),
            sort: query.get('sortMongo')
          });
        },

        // Given the name of a computed field (a field other than _id that
        // begins with `_`), pushes the names of the necessary physical fields
        // to compute it onto `add` and returns `true` if able to do so.
        // Otherwise `false` is returned. The default implementation can
        // handle `_url` and `relationship` fields (not reverse).
        //
        // This method is a good candidate to be extended via `extendQueryMethods`.
        //
        // Not chainable.

        projectComputedField(key, add) {
          if (key === '_url') {
            return query.projectUrlField(add);
          } else {
            return query.projectRelationshipField(key, add);
          }
        },

        // Pushes the names of the fields necessary to populate
        // `_url` onto the `add` array. Not chainable.

        projectUrlField(add) {
          const type = query.get('type');
          const manager = type && self.apos.doc.getManager(type);
          let fields;
          if (manager) {
            fields = manager.getUrlFields();
          } else {
            fields = self.apos.doc.getDefaultUrlFields();
          }
          _.each(fields, function(field) {
            add.push(field);
          });
          return true;
        },

        // Pushes the names of the fields necessary to populate
        // the relationship field named `key` onto the `add` array
        // and returns `true`.
        //
        // If there is no such `relationship`
        // field this method returns `false and does nothing.
        //
        // Note that this mechanism will not work for a
        // generic query obtained from `apos.doc.find`
        // without calling the `type` query builder.
        //
        // It will work for a query for a specific doc type.
        //
        // Not chainable.

        projectRelationshipField(key, add) {
          const schema = self.schema;
          const field = _.find(schema, { name: key });
          if (field) {
            add.push('type', field.idsStorage);
            return true;
          }
          return false;
        },

        // Create a mongo query directly from the given parameters. You don't want this API.
        // It is a low level implementation detail overridden by `@apostrophecms/optimizer` as needed.
        // Seemingly we don't need req at all here, but overrides like @apostrophecms/optimizer need it,
        // so it must be provided

        lowLevelMongoCursor(req, criteria, projection, options) {
          const mongo = self.apos.doc.db.find(criteria).project(projection);
          if (_.isNumber(options.skip)) {
            mongo.skip(options.skip);
          }
          if (_.isNumber(options.limit)) {
            mongo.limit(options.limit);
          }
          mongo.sort(options.sort);
          return mongo;
        },

        // Clones a query, creating an independent
        // clone that can be modified without modifying
        // the original query. This should be called when
        // querying based on the same criteria multiple
        // times. Returns the new query.

        clone() {
          const subquery = self.find(query.req);
          subquery.state = _.cloneDeep(query.state);
          return subquery;
        },

        // Invoked by find() to handle its arguments

        handleFindArguments({
          req, criteria, options
        }) {
          if (!req || !req.res) {
            throw new Error('I think you forgot to pass req as the first argument to find()!');
          }
          if (req) {
            query.req = req;
          }
          if (criteria) {
            query.set('criteria', criteria);
          }
          if (options) {
            query.applyBuilders(options);
          }
        },

        // Query builders and methods should
        // store their state with this method rather than
        // by directly modifying `query` or `query.state`. The
        // default implementation of the `set` function for
        // each query just calls this with the query's name
        // and first argument.

        set(key, value) {
          query.state[key] = value;
          return query;
        },

        // Query builders and methods you add to queries should fetch their
        // state with this method rather than by directly
        // modifying `query` or `query.state`. By default the
        // first argument to the query builder is stored under
        // the query builder's name.

        get(key) {
          return query.state[key];
        },

        // Invoke builders whose names are present in a `params` object (often this is `req.query`),
        // skipping all builders without a `launder` method. Never trust a browser.

        applyBuildersSafely(params) {
          for (let [ name, value ] of Object.entries(params)) {
            if (!_.has(query.builders, name)) {
              continue;
            }
            if (!query.builders[name].launder) {
              continue;
            }
            value = query.builders[name].launder(value);
            query[name](value);
          }
          return query;
        },

        // Invoke the query builders whose names are present in the given object, passing the
        // corresponding value for each, WITHOUT checking for safety or
        // laundering the data in any way. ALWAYS use `applyBuildersSafely` instead for anything
        // coming directly from the user. If `obj` is not an object this call does nothing.

        applyBuilders(obj) {
          for (const [ name, val ] of Object.entries(obj || {})) {
            query[name](val);
          }
          // Chainable method
          return query;
        },

        // Applies all defaults and transformations prior
        // to handing off the query to MongoDB. This is where
        // most builders add criteria, and it is where tricky builders
        // like `autocomplete` make database queries.
        //
        // If the query has already been finalized, nothing happens.
        //
        // First, defaults are applied. Then,
        // the `refinalize` function of each query builder
        // that has one is awaited. Next, the `finalize`
        // function of each query builder that has one is awaited.

        async finalize() {
          // We don't need to finalize twice because we disallow new
          // calls to query builder methods after initial finalization.
          if (query._finalized) {
            return;
          }
          const names = Object.keys(query.builders);
          for (const name of names) {
            if (query.get(name) === undefined) {
              const builder = query.builders[name];
              query.set(name, builder.def);
            }
          }
          for (const name of names) {
            const builder = query.builders[name];
            if (builder.prefinalize) {
              await builder.prefinalize();
            }
          }
          for (const name of names) {
            const builder = query.builders[name];
            if (builder.finalize) {
              await builder.finalize();
            }
          }
          query._finalized = true;
        },

        // An implementation detail of `toArray`, subject to
        // change. You probably wanted toMongo.

        async mongoToArray(mongo) {
          return mongo.toArray();
        },

        // Invokes "after" methods of all builders
        // that have them. Invoked for you by `toArray`.
        // Occasionally called directly when you have
        // obtained the data by other means. Returns
        // the `results`, often after adding properties
        // to them via further queries, etc.

        async after(results) {
          // Since "afters," in some cases, invoke query builders, we have to
          // set query._finalized to false so these invocations don't
          // throw an exception.
          const originalFinalized = query._finalized;
          query._finalized = false;
          for (const name of _.keys(query.builders)) {
            const builder = query.builders[name];
            if (builder.after) {
              await builder.after(results);
            }
          }
          query._finalized = originalFinalized;
          return results;
        },

        // Implementation detail of the `previous` and `next` query builders
        nextOrPrevious(verb) {
          const doc = query.get(verb);
          if (!doc) {
            return;
          }
          // Finalize the sort if it hasn't been already,
          // we need to know what it is so we can build
          // $gte/$lte queries around it
          if (!query.get('sortMongo')) {
            query.finalizeSort();
          }
          const sort = query.get('sortMongo');
          const direction = (verb === 'next') ? 1 : -1;
          if (!sort) {
            return;
          }
          const clauses = [];
          const criteria = {
            $or: clauses
          };
          const leftHand = {};
          // If sort is { lastName: 1, firstName: 1 } then
          // we are interested in cases where
          // { lastName: { $lte: doc.lastName } } OR
          // { lastName: doc.lastName, firstName: { $lte: doc.firstName } },
          // and so on and so forth
          _.each(sort, function(val, key) {
            let clause;
            if (val === 1) {
              clause = _.clone(leftHand);
              if (direction === 1) {
                clause[key] = { $gt: doc[key] };
              } else {
                clause[key] = { $lt: doc[key] };
              }
              leftHand[key] = doc[key];
              clauses.push(clause);
            } else if (val === -1) {
              clause = _.clone(leftHand);
              if (direction === 1) {
                clause[key] = { $lt: doc[key] };
              } else {
                clause[key] = { $gt: doc[key] };
              }
              leftHand[key] = doc[key];
              clauses.push(clause);
            } else {
              // We don't understand this sort, ignore it.
              // For instance, it's not clear what we
              // want is even possible with a geo
              // or text index sort
            }
          });

          // What if there are three docs with the same
          // values for all the sort fields? Make sure we
          // always compare on the id in a deterministic way
          // as a guarantee we don't get stuck in a loop
          if (!sort._id) {
            if (direction === 1) {
              clauses.push(
                _.assign(
                  leftHand,
                  {
                    _id: {
                      $gt: doc._id
                    }
                  }
                )
              );
            } else {
              clauses.push(
                _.assign(
                  leftHand,
                  {
                    _id: {
                      $lt: doc._id
                    }
                  }
                )
              );
            }
          };
          if (direction === -1) {
            // Flip the sort, we need to look backwards
            for (const [ key, val ] of sort) {
              if (typeof (val) === 'number') {
                sort[key] = -val;
              }
            }
          }
          if (!sort._id) {
            // So we don't get stuck bouncing back and forth
            // between four items that have the same value
            // for the primary sort
            sort._id = direction;
          }
          query.and(criteria);
        },

        finalizeSort() {

          // adjust the sort option taking the search
          // option into account, and supplying a default
          // sort unless expressly declined. Exception: if the
          // autocomplete query builder is in play don't do this, as it
          // will wind up forcing a default sort and ruining the quality
          // of the results

          if (query.get('autocomplete')) {
            return;
          }

          let sort = query.get('sort');

          if ((!query.get('search')) && (sort === 'search')) {
            // A search is not present, and yet { sort: 'search' }
            // was specified. That doesn't make sense, so let the
            // default sort shine through
            sort = undefined;
          }

          if (sort === false) {
            // OK, you really truly don't want a sort
            // (for instance, you are relying on the
            // implicit sort of $near)
          } else if (query.get('search')) {
            // Text search is in the picture. If they don't
            // specify a sort or specify "sort: 'search'",
            // sort by search result quality. Offer void if
            // we are using regex search
            if (!query.get('regexSearch')) {
              if ((!sort) || (sort === 'search')) {
                sort = { textScore: { $meta: 'textScore' } };
              }
            }
          } else if (!sort) {
            sort = query.finalizeDefaultSort();
          }

          // So interested parties can see how the sort
          // ultimately worked out
          query.set('sort', sort);

          // Below here we're making it more mongo-tastic. Don't modify
          // the A2-tastic version, preserve it for inspection
          if (sort) {
            sort = _.cloneDeep(sort);
          }

          if (sort) {

            // SORTIFY BEHAVIOR
            //
            // If a field has "sortify: true" in the schema, automatically
            // fix sort({ title: 1 }) to be sort({ titleSortify: 1 })

            // If the type query builder was not used, we're limited to sortified fields that exist
            // for all pages, but that's still useful (title).
            //
            // There's an @apostrophecms/page "type" that is never really in the database but
            // has a manager thanks to @apostrophecms/any-page-type. Use that as a default
            // so that we always get a manager object

            const manager = self.apos.doc.getManager(query.get('type') || '@apostrophecms/page');
            if (!(manager && manager.schema)) {
              return;
            }

            const sortify = {};
            for (const field of manager.schema) {
              if (field.sortify) {
                sortify[field.name] = true;
              }
            }
            for (const key of Object.keys(sort)) {
              // automatically switch to sort-friendly versions of properties
              if (_.has(sortify, key)) {
                sort[key + 'Sortified'] = sort[key];
                delete sort[key];
              }
            }

          }

          query.set('sortMongo', sort);
        },

        // Invoked when the default sort will be used. Figure out what that is,
        // starting with the `defaultSort` query builder's value and falling back
        // to `title` (which the sortify behavior will turn into
        // `titleSortify` later). Makes sure the default sort is
        // not `search` as in the absence of an actual search
        // a mongodb error would occur.
        //
        // A good override point for changing the default sort
        // behavior in additional ways.
        //
        // Returns a sort object, for instance `{ title: 1 }`.

        finalizeDefaultSort() {
          let sort = query.get('defaultSort') || { title: 1 };
          if ((!query.get('search')) && (sort === 'search')) {
            // A search is not present, and yet `{ sort: 'search' }`
            // was specified as the default. That doesn't make sense
            // (and will crash if it bleeds through to the mongo layer),
            // so revert to title sort.
            sort = { title: 1 };
          }
          return sort;
        }
      }
    };
  }
};

function wrap(context, extensions) {
  for (const [ name, fn ] of extensions) {
    if ((typeof fn) !== 'function') {
      // Nested structure is allowed
      context[name] = context[name] || {};
      return wrap(context[name], fn);
    }
    const superMethod = context[name];
    context[name] = function(...args) {
      return fn(superMethod, ...args);
    };
  }
}
