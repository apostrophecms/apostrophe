let _ = require('lodash');

module.exports = {
  adjustOptions(self, options) {
    
    let permissionsFields = options.permissionsFields ? [
      {
        type: 'select',
        name: 'loginRequired',
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
      {
        name: '_viewUsers',
        type: 'joinByArray',
        withType: 'apostrophe-user',
        label: 'These Users can View',
        idsField: 'viewUsersIds'
      },
      {
        name: '_viewGroups',
        type: 'joinByArray',
        withType: 'apostrophe-group',
        label: 'These Groups can View',
        idsField: 'viewGroupsIds'
      },
      {
        name: '_editUsers',
        type: 'joinByArray',
        withType: 'apostrophe-user',
        label: 'These Users can Edit',
        idsField: 'editUsersIds',
        // Gets patched after full initialization
        permission: 'admin'
      },
      {
        name: '_editGroups',
        type: 'joinByArray',
        withType: 'apostrophe-group',
        label: 'These Groups can Edit',
        idsField: 'editGroupsIds',
        // Gets patched after full initialization
        permission: 'admin'
      }
    ] : [];
    
    options.addFields = [
      {
        type: 'string',
        name: 'title',
        label: 'Title',
        required: true,
        // Generate a titleSort property which can be sorted
        // in a human-friendly way (case insensitive, ignores the
        // same stuff slugs ignore)
        sortify: true
      },
      {
        type: 'slug',
        name: 'slug',
        label: 'Slug',
        required: true
      },
      {
        type: 'tags',
        name: 'tags',
        label: 'Tags'
      },
      {
        type: 'boolean',
        name: 'published',
        label: 'Published',
        def: true
      },
      {
        type: 'boolean',
        name: 'trash',
        label: 'Trash',
        // not edited via a form by default
        contextual: !options.apos.docs.trashInSchema,
        def: false
      }
    ].concat(permissionsFields, options.addFields || []);
    options.arrangeFields = [
      {
        name: 'basics',
        label: 'Basics',
        fields: [
          'title',
          'slug',
          'published',
          'tags'
        ]
      },
      {
        name: 'permissions',
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
    ].concat(options.arrangeFields || []);
    
    if (options.apos.docs.trashInSchema) {
      // If the trash field is in the schema, we need to add it to
      // a suitable group without making devs who already built their
      // groups miserable. Solution: if we can find "published" in a group,
      // position trash immediately after it. Use `findLast` so we
      // look at the final group containing `published`, as revised by
      // subclasses.
      if (!_.find(options.arrangeFields, function (group) {
          return _.find(group.fields, 'trash');
        })) {
        let publishedGroup = _.findLast(options.arrangeFields, function (group) {
          return _.includes(group.fields, 'published');
        });
        if (publishedGroup) {
          let publishedIndex = _.findIndex(publishedGroup.fields, function (field) {
            return field === 'published';
          });
          publishedGroup.fields.splice(publishedIndex + 1, 0, 'trash');
        }
      }
    }
  },
  init(self, options) {
    self.name = self.options.name;
    
    if (!options.name) {
      throw new Error('apostrophe-doc-type-manager requires name option in module ' + self.__meta.name);
    }
    // Each doc-type has an array of fields which will be updated
    // if the document is moved to the trash. In most cases 'slug'
    // might suffice. For users, for instance, the email field should
    // be prefixed (de-duplicated) so that the email address is available.
    // A trash prefix should always be used for fields that have no bearing
    // on page tree relationships. A suffix should always be used for fields
    // that do (`slug` and `path`).
    //
    // For suffixes, apostrophe-pages will take care of adding and removing
    // them from earlier components in the path or slug as required.
    self.trashPrefixFields = ['slug'];
    self.trashSuffixFields = [];
    self.patchAdminPermissionInSchema();
    self.defineCursor();
    self.composeSchema();
    self.apos.docs.setManager(self.name, self);
    self.addSearchIndexListener();
    self.enableBrowserData();
  },
  apiRoutes(self, options) {
    return {
      post: {
        async chooser(req) {
          const browse = !!req.body.browse;
          const autocomplete = !!req.body.autocomplete;
          return self.render(req, 'chooser', {
            browse: browse,
            autocomplete: autocomplete
          });
        },
        async chooserChoices(req) {
          const field = req.body.field;
          const removed = {};
          // Make sure we have an array of objects
          const rawChoices = _.map(Array.isArray(req.body.choices) ? req.body.choices : [], function (choice) {
            if (typeof choice !== 'object') {
              return {};
            } else {
              return choice;
            }
          });
          _.each(rawChoices, function (choice) {
            if (choice.__removed) {
              removed[choice.value] = true;
            }
          });
          if (!self.apos.utils.isBlessed(req, _.omit(field, 'hints'), 'join')) {
            throw 'notfound';
          }
          // We received an array of choices in the generic format, we need to map it to the format
          // for the relevant type of join before we can use convert to validate the input
          const input = {};
          if (field.idsField) {
            input[field.idsField] = _.map(rawChoices, 'value');
            if (field.relationshipsField) {
              input[field.relationshipsField] = {};
              _.each(rawChoices, function (choice) {
                input[field.relationshipsField][choice.value] = _.omit(choice, 'value', 'label');
              });
            }
          } else {
            input[field.idField] = rawChoices[0] && rawChoices[0].value;
          }
          const receptacle = {};
          // For purposes of previewing, it's OK to ignore readOnly so we can tell which
          // inputs are plausible
          await self.apos.schemas.convert(req, [_.omit(field, 'readOnly')], 'form', input, receptacle);
          await self.apos.schemas.join(req, [field], receptacle, true);
          const choiceTemplate = field.choiceTemplate || self.choiceTemplate || 'chooserChoice.html';
          const choicesTemplate = field.choicesTemplate || self.choicesTemplate || 'chooserChoices.html';
          let choices = receptacle[field.name];
          if (!Array.isArray(choices)) {
            // by one case
            if (choices) {
              choices = [choices];
            } else {
              choices = [];
            }
          }
          // Add "readOnly" property and bring back the `__removed` property for use in the template
          _.each(choices, function (choice) {
            choice.readOnly = field.readOnly;
            if (_.has(removed, choice._id || choice.item && choice.item._id)) {
              choice.__removed = true;
            }
          });
          const markup = self.render(req, choicesTemplate, {
            choices: choices,
            choiceTemplate: choiceTemplate,
            relationship: field.relationship,
            hints: field.hints
          });
          // Newer version of this API returns the validated choices, so that the chooser doesn't
          // get stuck thinking there's already a choice bringing it up to its limit when the choice
          // is actually in the trash and shouldn't count anymore
          return {
            html: markup,
            choices: format(choices)
          };
          function format(choices) {
            // After the join, the "choices" array is actually an array of docs, or objects with .item and .relationship
            // properties. As part of our validation services for the chooser object in the browser, recreate what the browser
            // side is expecting: objects with a "value" property (the _id) and relationship properties, if any
            return _.map(choices, function (item) {
              const object = item;
              const relationship = item._relationship || {};
              const choice = { value: object._id };
              if (item.__removed) {
                choice.__removed = true;
              }
              _.defaults(choice, relationship);
              return choice;
            });
          }
        },
        async relationshipEditor(req) {
          const field = req.body.field;
          if (!self.apos.utils.isBlessed(req, field, 'join')) {
            throw 'notfound';
          }
          return self.render(req, field.relationshipTemplate || self.relationshipTemplate || 'relationshipEditor', { field: field });
        },
        async autocomplete(req, res) {
          const field = req.body.field;
          if (!self.apos.utils.isBlessed(req, _.omit(field, 'hints'), 'join')) {
            throw 'notfound';
          }
          const term = self.apos.launder.string(req.body.term);
          return self.autocomplete(req, {
            field: field,
            term: term
          });
        }
      }
    };
  },
  handlers(self, options) {
    return {
      'afterTrash': {
        deduplicateTrash(req, doc) {
          const deduplicateKey = doc.workflowGuid || doc._id;
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
          return self.apos.docs.db.updateOne({ _id: doc._id }, { $set: $set });
        }
      },
      'afterRescue': {
        async deduplicateRescue(req, doc) {
          let deduplicateKey = doc.workflowGuid || doc._id;
          let prefix = 'deduplicate-' + deduplicateKey + '-';
          let suffix = '-deduplicate-' + deduplicateKey;
          let $set = {};
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
            const found = await self.apos.docs.db.findOne(query, { _id: 1 });
            if (found) {
              delete $set[name];
            }
          }
          async function update() {
            let action = { $set: $set };
            // So methods called later, or extending this method, see the change in docs
            _.assign(doc, $set);
            if (_.isEmpty($set)) {
              // Nothing to do
              return;
            }
            return self.apos.docs.db.updateOne({ _id: doc._id }, action);
          }
        }
      }
    };
  },
  methods(self, options) {
    return {
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
      // Define the related type "cursor", so that all of our subclasses
      // automatically have a cursor type too, and it is autoloaded from
      // ./lib/cursor.js if that exists, otherwise given an empty
      // definition.
      defineCursor() {
        self.defineRelatedClass('cursor', { stop: 'apostrophe-doc-type-manager' });
      },
      // Returns a cursor that will only yield docs of the appropriate type
      // as determined by the `name` option of the module. Returns a cursor of
      // the appropriate type for the current module, even if it is a subclass.
      // Returns a cursor for use in finding docs. See cursor.js for chainable
      // filters, and also yielders that actually deliver the docs to you.
      find(req, criteria, projection) {
        return self.createRelatedClassSync('cursor', {
          apos: self.apos,
          module: self,
          req: req,
          criteria: criteria,
          projection: projection
        });
      },
      // Returns a new instance of the doc type, with the appropriate default
      // values for each schema field.
      newInstance() {
        const doc = self.apos.schemas.newInstance(self.schema);
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
      // the join the user is attempting to match titles from.
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
      // the schema field definition for the join the user is attempting
      // to match titles from. The default behavior is to return
      // the `title` property. This is sometimes extended to include
      // event start dates and similar information that helps the
      // user distinguish between docs.
      getAutocompleteTitle(doc, query) {
        return doc.title;
      },
      // Used by `apostrophe-versions` to label changes that
      // are made to joins by ID. Set `change.text` to the
      // desired text.
      decorateChange(doc, change) {
        change.text = doc.title;
      },
      // Returns true if only admins are allowed to edit this type.
      // Respected by the pieces module when deciding whether to
      // enumerate more specific permissions as choices for this
      // module.
      isAdminOnly() {
        return false;
      },
      // Return a new schema containing only fields for which the
      // current user has the permission specified by the `permission`
      // property of the schema field, or there is no `permission` property for the field.
      allowedSchema(req) {
        let disabled;
        let type;
        const schema = _.filter(self.schema, function (field) {
          return !field.permission || self.apos.permissions.can(req, field.permission);
        });
        const typeIndex = _.findIndex(schema, { name: 'type' });
        if (typeIndex !== -1) {
          // This option exists so that the
          // apostrophe-option-overrides and apostrophe-workflow modules,
          // if present, can be used together to disable various types based
          // on locale settings
          disabled = self.apos.pages.getOption(req, 'disabledTypes');
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
        // If a type is adminOnly remove the fields relating to permissions editing
        if (self.isAdminOnly()) {
          options.removeFields = (options.removeFields || []).concat([
            'loginRequired',
            '_viewUsers',
            '_viewGroups',
            '_editUsers',
            '_editGroups'
          ]);
        }
        self.schema = self.apos.schemas.compose(self.options);
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
      // For the implementation of the autocomplete() filter see autocomplete.js.
      //
      // "query" must contain a "field" property which is the schema join field
      // that describes the relationship we're adding items to.
      //
      // "query" must also contain a "term" property, which is a partial
      // string to be autocompleted; otherwise an empty array is returned.
      //
      // We don't launder the input here, see the 'autocomplete' route.
      async autocomplete(req, query) {
        const cursor = self.find(req, {}, {}).sort('search');
        if (self.extendAutocompleteCursor) {
          self.extendAutocompleteCursor(cursor);
        }
        cursor.projection(self.getAutocompleteProjection(), query);
        // Try harder not to call autocomplete with something that doesn't
        // result in a search
        if (query.term && query.term.toString && query.term.toString().length) {
          let term = self.apos.launder.string(query.term);
          cursor.autocomplete(term);
        } else {
          return [];
        }
        if (!(query.filters && query.filters.limit)) {
          cursor.limit(10);
        }
        // This is the big payoff of blessing join fields: we can apply their
        // filters in API calls like this one, knowing that the field definition
        // the browser sent us is one the developer created
        cursor.queryToFilters(query.field.filters || {});
        // Format it as value & label properties for compatibility with
        // our usual assumptions on the front end
        let docs = await cursor.toArray();
        // Put the snippets in id order
        if (query.values) {
          docs = self.apos.utils.orderById(query.values, docs);
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
      async addSearchIndexListener() {
        self.on('apostrophe-search:index', 'searchIndexBySchema', async function (doc, texts) {
          if (doc.type !== self.name) {
            return;
          }
          await self.apos.schemas.indexFields(self.schema, doc, texts);
        });
      },
      // Fields required to compute the `_url` property.
      // Used to implement a "projection" for `_url` if
      // requested by the developer
      getUrlFields() {
        return [
          'type',
          'slug',
          'tags'
        ];
      },
      // Most of the time, this is called for you. Any schema field
      // with `sortify: true` will automatically get a migration to
      // ensure that, if the field is named `lastName`, then
      // `lastNameSortified` exists.
      //
      // Adds a migration that takes the given field, such as `lastName`, and
      // creates a parallel `lastNameSortified` field, formatted with
      // `apos.utils.sortify` so that it sorts and compares in a more
      // intuitive, case-insensitive way.
      //
      // After adding such a migration, you can add `sortify: true` to the
      // schema field declaration for `field`, and any calls to
      // the `sort()` cursor filter for `lastName` will automatically
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
        return self.apos.migrations.addSortify(self.__meta.name, { type: self.name }, field);
      },
      getBrowserData(req) {
        if (!req.user) {
          return;
        }
        const data = _.pick(options, 'name', 'label', 'pluralLabel');
        data.action = self.action;
        data.schema = self.allowedSchema(req);
        return data;
      }
    };
  }
};  
