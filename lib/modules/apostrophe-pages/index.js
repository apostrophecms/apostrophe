// This module manages the page tree and contains the wildcard
// Express route that actually serves pages. That route is installed
// at the very end of the process, in an `afterInit` callback,
// which is late enough to allow all other modules to add routes first.
//
// Also implements parked pages, "plain old page types" (those that aren't
// powered by a module), the context menu (big gear menu) and the publish menu.
//
// ## Options
//
// **`types`: specifies the page types that can be chosen for a page.** This list must
// include all page types that will be present in the tree (not piece types).
//
// The default setting is:
//
//```
//  types: [
//    {
//      name: 'home',
//      label: 'Home'
//    },
//    {
//      name: 'default',
//      label: 'Default'
//    }
//  ]
//```
//
// The `home` page type is required.
//
// **`contextMenu`: specifies the default offerings on the context menu.** These
// can also be overridden for any request by setting `req.contextMenu` to an array
// in the same format.
//
// The default setting is:
//
//```
// contextMenu: [
//   {
//     action: 'insert-page',
//     label: 'New Page'
//   },
//   {
//     action: 'update-page',
//     label: 'Page Settings'
//   },
//   {
//     action: 'versions-page',
//     label: 'Page Versions'
//   },
//   {
//     action: 'trash-page',
//     label: 'Move to Trash'
//   },
//   {
//     action: 'reorganize-page',
//     label: 'Reorganize',
//     // Until we port the provisions for non-admins to reorganize
//     // over from 0.5
//     permission: 'admin'
//   }
// ]
//```
//
// The `action` becomes a `data-apos-ACTIONGOESHERE` attribute on the
// menu item. If `permission` is set, the item is only shown to users
// with that permission (this is NOT sufficient protection for the
// backend routes it may access, they must also be secured).
//
// **`publishMenu`: configures the publication menu,** which appears
// only if the current page is unpublished or `data.pieces` is present
// and is unpublished. Syntax is identical to `contextMenu`. The default
// setting is:
//
//```
// publishMenu: [
//   {
//     action: 'publish-page',
//     label: 'Publish Page'
//   }
// ]
//```
//
// Again, you can override it by setting `req.publishMenu`.
//
// If you are looking for the schema fields common to all pages in the tree,
// check out the [apostrophe-custom-pages](../apostrophe-custom-pages/index.html)
// module, which all page types extend, including "ordinary" pages.

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
      action: 'insert-page',
      label: 'New Page'
    },
    {
      action: 'update-page',
      label: 'Page Settings'
    },
    {
      action: 'versions-page',
      label: 'Page Versions'
    },
    {
      action: 'trash-page',
      label: 'Move to Trash'
    },
    {
      action: 'reorganize-page',
      label: 'Reorganize',
      // Until we port the provisions for non-admins to reorganize
      // over from 0.5
      permission: 'admin'
    }
  ],

  publishMenu: [
    {
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
      self.registerGenericPageTypes(callback);
    };

    // Wait until the last possible moment to add
    // the wildcard route for serving pages, so that
    // other routes are not blocked

    self.afterInit = function(callback) {
      self.apos.app.get('*', self.serve);
      return async.series([
        self.manageOrphans,
        self.implementParkAll
      ], callback);
    };

  },

};
