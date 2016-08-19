// This module is the base class of `apostrophe-custom-pages`, `apostrophe-pieces`,
// `apostrophe-global` and any other module that serves as the manager for a
// doc type. You can introduce new fields to the schema of *all* docs by
// extending this module at project level and modifying `addFields` in
// `beforeConstruct`.
//
// The `name` option must be set to the doc type name, as found in the `type`
// property of each individual doc. Thus it is usually singular.

var _ = require('lodash');

module.exports = {

  afterConstruct: function(self) {
    self.composeSchema();
    self.apos.docs.setManager(self.name, self);
  },

  beforeConstruct: function(self, options) {
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
        // not edited via a form
        contextual: true,
        def: false
      },
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
        permission: 'admin'
      },
      {
        name: '_editGroups',
        type: 'joinByArray',
        withType: 'apostrophe-group',
        label: 'These Groups can Edit',
        idsField: 'editGroupsIds',
        permission: 'admin'
      }
    ].concat(options.addFields || []);
    options.arrangeFields = [
      {
        name: 'basics',
        label: 'Basics',
        fields: [ 'title', 'slug', 'published', 'tags' ]
      },
      {
        name: 'permissions',
        label: 'Permissions',
        fields: [ 'loginRequired', '_viewUsers', '_viewGroups', '_editUsers', '_editGroups' ]
      }
    ].concat(options.arrangeFields || []);

  },

  construct: function(self, options) {
    self.name = self.options.name;

    if (!options.name) {
      throw new Error('apostrophe-doc-type-manager requires name option');
    }

    // Returns a cursor that will only yield docs of the appropriate type
    // as determined by the `name` option of the module. Subclasses often
    // extend this method to return a cursor of a subclass that adds
    // additional filters.

    self.find = function(req, criteria, projection) {
      return self.apos.docs.find(req, criteria, projection).type(self.name);
    };

    // Returns a new instance of the doc type, with the appropriate default
    // values for each schema field.

    self.newInstance = function() {
      // Careful, we can't refer to `manager` as self because of the way our
      // methods get merged into other objects; so get the actual manager
      var doc = self.apos.schemas.newInstance(self.schema);
      doc.type = self.name;
      return doc;
    };

    // Returns a MongoDB projection object to be used when querying
    // for this type if all that is needed is a title for display
    // in an autocomplete menu. Default behavior is to
    // return only the `title` and `_id` properties.
    //
    // `query.field` will contain the schema field definition for
    // the join the user is attempting to match titles from.

    self.getAutocompleteProjection = function(query) {
      return {
        title: 1,
        _id: 1
      };
    };

    // Returns a string to represent the given `doc` in an
    // autocomplete menu. `doc` will contain only the fields returned
    // by `getAutocompleteProjection`. `query.field` will contain
    // the schema field definition for the join the user is attempting
    // to match titles from. The default behavior is to return
    // the `title` property. This is sometimes extended to include
    // event start dates and similar information that helps the
    // user distinguish between docs.

    self.getAutocompleteTitle = function(doc, query) {
      return doc.title;
    };

    // Used by `apostrophe-versions` to label changes that
    // are made to joins by ID. Set `change.text` to the
    // desired text.

    self.decorateChange = function(doc, change) {
      change.text = doc.title;
    };

    // Returns true if only admins are allowed to edit this type.
    // Respected by the pieces module when deciding whether to
    // enumerate more specific permissions as choices for this
    // module.

    self.isAdminOnly = function() {
      return false;
    };

    // Return a new schema containing only fields for which the
    // current user has the permission specified by the `permission`
    // property of the schema field, or there is no `permission` property for the field.

    self.allowedSchema = function(req) {
      var schema = _.filter(self.schema, function(field) {
        return (!field.permission) || self.apos.permissions.can(req, field.permission);
      });
      return schema;
    };

    self.composeSchema = function() {

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
    };

    // As a doc manager, we can provide default templates for use when
    // choosing docs of our type. With this code in place, all pieces and custom-pages
    // modules can just provide custom chooserChoice.html and chooserChoices.html
    // templates with no additional plumbing. -Tom

    self.choiceTemplate = self.__meta.name + ':chooserChoice.html';
    self.choicesTemplate = self.__meta.name + ':chooserChoices.html';
    self.relationshipTemplate = self.__meta.name + ':relationshipEditor.html';

  }
};
