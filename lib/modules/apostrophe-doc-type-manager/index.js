// This module is the base class of `apostrophe-custom-pages`, `apostrophe-pieces`,
// `apostrophe-global` and any other module that serves as the manager for a
// doc type. You can introduce new fields to the schema of *all* docs by
// extending this module at project level and modifying `addFields` in
// `beforeConstruct`.
//
// The `name` option must be set to the doc type name, as found in the `type`
// property of each individual doc. Thus it is usually singular.
//
// ## Options
//
// ### `permissionsFields`
//
// By default, fields for setting detailed permissions for users and groups
// to view and edit a particular doc are not displayed. If you turn on this flag,
// they are added to the schema.
//
// (Note that when a user who is not an admin for your doc type creates a new one,
// they are automatically given permission to edit it as an individual so they can
// continue to manage it.)
//
// ### Schema options
// The standard schema options, including `addFields`, `removeFields` and `arrangeFields`.
// See the [schema guide](/advanced-topics/schema-guide.md).

var _ = require('@sailshq/lodash');

module.exports = {

  afterConstruct: function(self) {
    self.patchAdminPermissionInSchema();
    self.defineCursor();
    self.composeSchema();
    self.apos.docs.setManager(self.name, self);
    self.pushAssets();
    self.pushDefineSingleton();
    self.addSearchIndexListener();
    self.addSlugPrefixMigration();
  },

  beforeConstruct: function(self, options) {

    var permissionsFields = options.permissionsFields ? [
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
            showFields: [ '_viewGroups', '_viewUsers' ]
          }
        ]
      },
      {
        name: '_viewUsers',
        type: 'joinByArray',
        withType: 'apostrophe-user',
        label: 'These Users can View',
        idsField: 'viewUsersIds',
        sortable: false,
        editDocs: false
      },
      {
        name: '_viewGroups',
        type: 'joinByArray',
        withType: 'apostrophe-group',
        label: 'These Groups can View',
        idsField: 'viewGroupsIds',
        sortable: false,
        editDocs: false
      },
      {
        name: '_editUsers',
        type: 'joinByArray',
        withType: 'apostrophe-user',
        label: 'These Users can Edit',
        idsField: 'editUsersIds',
        // Gets patched after full initialization
        permission: 'admin',
        sortable: false,
        editDocs: false
      },
      {
        name: '_editGroups',
        type: 'joinByArray',
        withType: 'apostrophe-group',
        label: 'These Groups can Edit',
        idsField: 'editGroupsIds',
        // Gets patched after full initialization
        permission: 'admin',
        sortable: false,
        editDocs: false
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
        fields: [ 'title', 'slug', 'published', 'tags' ].concat(options.apos.docs.trashInSchema ? [ 'trash' ] : [])
      },
      {
        name: 'permissions',
        label: 'Permissions',
        fields: options.apos.schemas.getPermissionsFieldNames(),
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
      if (!_.find(options.arrangeFields, function(group) {
        return _.find(group.fields, 'trash');
      })) {
        var publishedGroup = _.findLast(options.arrangeFields, function(group) {
          return _.contains(group.fields, 'published');
        });
        if (publishedGroup) {
          var publishedIndex = _.findIndex(publishedGroup.fields, function(field) {
            return field === 'published';
          });
          publishedGroup.fields.splice(publishedIndex + 1, 0, 'trash');
        }
      }
    }
  },

  construct: function(self, options) {
    self.name = self.options.name;

    if (!options.name) {
      throw new Error('apostrophe-doc-type-manager requires name option in module ' + self.__meta.name);
    }

    require('./lib/api.js')(self, options);
    require('./lib/browser.js')(self, options);
    require('./lib/routes.js')(self, options);
  }
};
