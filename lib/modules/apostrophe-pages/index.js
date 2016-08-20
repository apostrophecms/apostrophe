var _ = require('lodash');
var async = require('async');

module.exports = {

  alias: 'pages',

  types: [
    {
      // So that the minimum parked pages don't result in an error when home has no manager. -Tom
      name: 'home',
      label: 'Home'
    },
    {
      // So that unit tests have an easy page type to insert and A2 is less weird out of the box.
      name: 'default',
      label: 'Default'
    }
  ],

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
    self.pushAssets();
    return async.series([
      self.registerTrashPageType,
      self.ensureIndexes
    ], callback);
  },

  construct: function(self, options) {

    self.typeChoices = options.types || [];

    require('./lib/helpers.js')(self, options);
    require('./lib/browser.js')(self, options);
    require('./lib/routes.js')(self, options);
    require('./lib/api.js')(self, options);

    // merge new methods with all apostrophe-cursors
    self.apos.define('apostrophe-cursor', require('./lib/anyCursor.js'));

    // Add methods to cursors used specifically to fetch pages only
    self.apos.define('apostrophe-pages-cursor', require('./lib/pagesCursor.js'));

    // When all modules are ready, invoke `registerGenericPageTypes` to register a manager
    // for any page type that doesn't already have one via `apostrophe-custom-pages`,
    // `apostrophe-pieces-pages`, etc.

    self.modulesReady = function(callback) {
      return async.series([
        self.registerGenericPageTypes,
        self.manageOrphans
      ], callback);
    };

    // Wait until the last possible moment to add
    // the wildcard route for serving pages, so that
    // other routes are not blocked

    self.afterInit = function(callback) {
      self.apos.app.get('*', self.serve);
      return async.series([
        self.implementParkAll
      ], callback);
    };

  },

};
