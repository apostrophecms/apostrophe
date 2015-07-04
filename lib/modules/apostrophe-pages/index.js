var _ = require('lodash');

module.exports = {

  alias: 'pages',

  contextMenu: [
    {
      name: 'insert-page',
      label: 'New Page'
    },
    {
      name: 'update-page',
      label: 'Page Settings'
    },
    {
      name: 'versions-page',
      label: 'Page Versions'
    },
    {
      name: 'delete-page',
      label: 'Move to Trash'
    },
    {
      name: 'reorganize-page',
      label: 'Reorganize'
    }
  ],

  afterConstruct: function(self, callback) {
    return self.ensureIndexes(callback);
  },

  construct: function(self, options) {

    self.typeChoices = options.types || [];

    options.addFields = [
      {
        type: 'string',
        name: 'title',
        label: 'Title',
        required: true
      },
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
        name: 'published',
        label: 'Published'
      },
      {
        type: 'boolean',
        name: 'orphan',
        label: 'Hide in Navigation'
      },
    ].concat(options.addFields || []);

    self.schema = self.apos.schemas.compose(options);

    require('./lib/helpers.js')(self, options);
    require('./lib/browser.js')(self, options);
    require('./lib/routes.js')(self, options);
    require('./lib/api.js')(self, options);

    // merge new methods with all apostrophe-cursors
    self.apos.define('apostrophe-cursor', require('./lib/anyCursor.js'));

    // Wait until the last possible moment to add
    // the wildcard route for serving pages, so that
    // other routes are not blocked

    self.afterInit = function(callback) {
      self.apos.app.get('*', self.serve);
      return self.implementParkAll(callback);
    };
  }
};
