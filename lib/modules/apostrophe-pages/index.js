var _ = require('lodash');

module.exports = {

  alias: 'pages',

  contextMenu: [
    {
      name: 'insert-page',
      action: 'insert-page',
      label: 'New Page'
    },
    {
      name: 'update-page',
      action: 'update-page',
      label: 'Page Settings'
    },
    {
      name: 'versions-page',
      action: 'versions-page',
      label: 'Page Versions'
    },
    {
      name: 'trash-page',
      action: 'trash-page',
      label: 'Move to Trash'
    },
    {
      name: 'reorganize-page',
      action: 'reorganize-page',
      label: 'Reorganize'
    }
  ],

  publishMenu: [
    {
      name: 'publish-page',
      action: 'publish-page',
      label: 'Publish Page'
    }
  ],

  afterConstruct: function(self, callback) {
    self.setManagerForUnspecifiedPageType();
    self.pushAssets();
    self.pushCreateSingleton();
    return self.ensureIndexes(callback);
  },

  construct: function(self, options) {

    self.typeChoices = options.types || [];

    options.addFields = [
      {
        type: 'slug',
        name: 'slug',
        label: 'Slug',
        required: true,
        // with this flag, a leading / is enforced, and slashes
        // elsewhere are allowed etc.
        page: true
      },
      {
        type: 'select',
        name: 'type',
        label: 'Type',
        required: true,
        choices: _.map(self.typeChoices, function(type) {
          return {
            value: type.name,
            label: type.label
          };
        })
      },
      {
        type: 'boolean',
        name: 'orphan',
        label: 'Hide in Navigation'
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
        type: 'boolean',
        name: 'applyLoginRequiredToSubpages',
        label: 'Apply to Subpages'
      },
      {
        name: '_viewUsers',
        type: 'joinByArray',
        withType: 'apostrophe-user',
        label: 'These Users can View',
        idsField: 'viewUsersIds',
        removedIdsField: 'viewUsersRemovedIds',
        relationship: [
          {
            name: 'applyToSubpages',
            type: 'boolean',
            label: 'Apply to Subpages'
          }
        ],
        relationshipsField: 'viewUsersRelationships'
      },
      {
        name: '_viewGroups',
        type: 'joinByArray',
        withType: 'apostrophe-group',
        label: 'These Groups can View',
        idsField: 'viewGroupsIds',
        removedIdsField: 'viewGroupsRemovedIds',
        relationship: [
          {
            name: 'applyToSubpages',
            type: 'boolean',
            label: 'Apply to Subpages'
          }
        ],
        relationshipsField: 'viewGroupsRelationships'
      },
      {
        name: '_editUsers',
        type: 'joinByArray',
        withType: 'apostrophe-user',
        label: 'These Users can Edit',
        idsField: 'editUsersIds',
        removedIdsField: 'editUsersRemovedIds',
        relationship: [
          {
            name: 'applyToSubpages',
            type: 'boolean',
            label: 'Apply to Subpages'
          }
        ],
        relationshipsField: 'editUsersRelationships'
      },
      {
        name: '_editGroups',
        type: 'joinByArray',
        withType: 'apostrophe-group',
        label: 'These Groups can Edit',
        idsField: 'editGroupsIds',
        removedIdsField: 'editGroupsRemovedIds',
        relationship: [
          {
            name: 'applyToSubpages',
            type: 'boolean',
            label: 'Apply to Subpages'
          }
        ],
        relationshipsField: 'editGroupsRelationships'
      }
    ].concat(options.addFields || []);

    self.schema = self.apos.schemas.refine(self.apos.docs.schema, options);

    require('./lib/helpers.js')(self, options);
    require('./lib/browser.js')(self, options);
    require('./lib/routes.js')(self, options);
    require('./lib/api.js')(self, options);

    // merge new methods with all apostrophe-cursors
    self.apos.define('apostrophe-cursor', require('./lib/anyCursor.js'));

    // Add methods to cursors used specifically to fetch pages only
    self.apos.define('apostrophe-pages-cursor', require('./lib/pagesCursor.js'));

    // Wait until the last possible moment to add
    // the wildcard route for serving pages, so that
    // other routes are not blocked

    self.afterInit = function(callback) {
      self.apos.app.get('*', self.serve);
      return self.implementParkAll(callback);
    };
  }
};
