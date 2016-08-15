var async = require('async');
var _ = require('lodash');

module.exports = {

  alias: 'docs',

  afterConstruct: function(self, callback) {
    return async.series([ self.enableCollection, self.ensureIndexes ], callback);
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
    self.schema = self.apos.schemas.compose(options);

    self.apos.define('apostrophe-cursor', require('./lib/cursor.js'));

    require('./lib/api.js')(self, options);
    require('./lib/routes.js')(self, options);
    require('./lib/browser.js')(self, options);

    self.pushAssets();
    self.pushCreateSingleton();

  }
};
