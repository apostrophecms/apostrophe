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
      label: 'Reorganize',
      // Until we port the provisions for non-admins to reorganize
      // over from 0.5
      permission: 'admin'
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
      }
    ].concat(options.addFields || []);

    options.arrangeFields = [
      {
        name: 'basics',
        label: 'Basics',
        fields: [ 'title', 'slug', 'type', 'published', 'tags', 'orphan' ]
      }
    ].concat(options.arrangeFields || []);

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
