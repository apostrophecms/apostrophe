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
//```javascript
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
//```javascript
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
//```javascript
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
//
// **`park`: configures certain pages to be automatically created and refreshed
// whenever the site starts up.** The parked pages you get are actually the
// concatenation of the `minimumPark` and `park` options.
//
// `minimumPark` has a default, which you will typically leave unchanged:
//
//```javascript
// [
//   {
//     slug: '/',
//     published: true,
//     _defaults: {
//       title: 'Home',
//       type: 'home'
//     },
//     _children: [
//       {
//         slug: '/trash',
//         type: 'trash',
//         trash: true,
//         published: false,
//         orphan: true,
//         _defaults: {
//           title: 'Trash'
//         },
//       }
//     ]
//   },
// ]
//```
//
// * The `park` and `minimumPark` options are arrays. Each array is a
// page to be created or recreated on startup.
//
// * If a page has a `parent` property, it is created as a child
// of the page whose `slug` property equals `parent`. If a page has no
// `parent` property and it is not the home page itself, it is created as a
// child of the home page.
//
// * Any other properties that do not begin with a `_` are automatically
// refreshed on the page object in the database at startup time.
//
// * If a page has a `_children` array property, these are additional parked pages,
// created as children of the page.
//
// * The properties of the `_default` option are applied to the page object *only
// at creation time*, meaning that changes users make to them later will stick.
//
// * `orphan: true` prevents a page from appearing in standard navigation links based
// on parent-child relationships
// (as opposed to hand-built navigation widgets powered by joins and the like).
//
// * The "page settings" UI is evolving toward not allowing users to
// modify properties that are explicitly set via `park` (rather than being set once
// via `_defaults`). In any case such properties are reset by restarts.
//
// **`filters`: Apostrophe cursor filters applied when fetching the current page.**
// The default settings ensure that `req.data.page` has a `_children` property
// and an `_ancestors` property:
//
//```javascript
// {
//   // Get the kids of the ancestors too so we can do tabs and accordion nav
//   ancestors: { children: true },
//   // Get our own kids
//   children: true
// };
//```
//
// See the [apostrophe-pages-cursor](server-apostrophe-pages-cursor.html) type for additional
// cursor filters and options you might wish to configure, such as adding
// a `depth` option to `children`.
//
// ** `home`: Apostrophe populates the home page from `req.page._ancestors[0]` if possible.
// If not, Apostrophe fetches the home page separately, using the same filters configured for
// ancestors. You can shut this extra query off:
//
//```javascript
// {
//   home: false
// }
//```
//
// In addition, if ancestors are not configured, Apostrophe assumes you want the children
// of the home page. You can shut that off, and still get the home page:
//
//```javascript
// {
//   home: {
//     children: false
//   }
// }
//```
//
// **`deleteFromTrash`: if set to `true`, Apostrophe offers a button in the
// "reorganize" view to permanently delete pages that are already in the trash.**
// This option defaults to `false` because, in our experience, customers usually
// ask for a way to "un-empty the trash," and of course there isn't one. We don't
// recommend enabling the feature on a permanent basis but it can be useful during
// the early stages of site population.

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
      action: 'copy-page',
      label: 'Copy Page'
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
      label: 'Reorganize'
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
    self.validateTypeChoices();
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
