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
// ### `types`
//
// Specifies the page types that can be chosen for a page.** This list must
// include all page types that will be present in the tree (not piece types).
//
// The default setting is:
//
// ```javascript
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
// ```
//
// The `home` page type is required.
//
// ### `allowedHomepageTypes`
//
// An array of page type names that are permitted for
// the homepage. This should be a subset of the types that appear in the
// `types` option. Example:
//
// ```javascript
// allowedHomepageTypes: [ 'home' ]
// ```
//
// If this option is not specified, the homepage may be switched to any type
// present in `types`.
//
// ### `allowedSubpageTypes`
//
// An array of page type names that are allowed
// **when adding a subpage of a page of each type.** If this array is empty,
// you **cannot** add a subpage to a page of that type. Example:
//
// ```javascript
// allowedSubpageTypes: {
//   home: [ 'default', 'blog-page' ],
//   default: [ 'grandchild' ],
//   grandchild: []
// }
// ```
//
// If subpages are not specified for a type, then it may have subpages
// of **any type** present in `types`.
//
// ### `contextMenu`
//
// Specifies the default offerings on the context menu.** These
// can also be overridden for any request by setting `req.contextMenu` to an array
// in the same format.
//
// The default setting is:
//
// ```javascript
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
// ```
//
// The `action` becomes a `data-apos-ACTIONGOESHERE` attribute on the
// menu item. If `permission` is set, the item is only shown to users
// with that permission (this is NOT sufficient protection for the
// backend routes it may access, they must also be secured).
//
// ### `publishMenu`
//
// Configures the publication menu,** which appears
// only if the current page is unpublished or `data.pieces` is present
// and is unpublished. Syntax is identical to `contextMenu`. The default
// setting is:
//
// ```javascript
// publishMenu: [
//   {
//     action: 'publish-page',
//     label: 'Publish Page'
//   }
// ]
// ```
//
// Again, you can override it by setting `req.publishMenu`.
//
// If you are looking for the schema fields common to all pages in the tree,
// check out the [apostrophe-custom-pages](/reference/modules/apostrophe-custom-pages/)
// module, which all page types extend, including "ordinary" pages.
//
// ### `park`
//
// Configures certain pages to be automatically created and refreshed
// whenever the site starts up.** The parked pages you get are actually the
// concatenation of the `minimumPark` and `park` options.
//
// `minimumPark` has a default, which you will typically leave unchanged:
//
// ```javascript
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
// ```
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
// * RECOMMENDED: give every parked page a `parkedId` property which
// is unique among your parked pages. If you do this, you will be
// able to change the slug property later. If you don't, changing
// the slug property will result in two pages, because it is being
// used to identify the existing parked page. You MAY add this property
// later, but you MUST DO IT BEFORE you change `slug` (not at
// the same time).
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
// ### `filters`
//
// Apostrophe cursor filters applied when fetching the current page.**
// The default settings ensure that `req.data.page` has a `_children` property
// and an `_ancestors` property:
//
// ```javascript
// {
//   // Get the kids of the ancestors too so we can do tabs and accordion nav
//   ancestors: { children: true },
//   // Get our own kids
//   children: true
// };
// ```
//
// See the [apostrophe-pages-cursor](/reference/modules/apostrophe-pages/server-apostrophe-pages-cursor.md) type for additional
// cursor filters and options you might wish to configure, such as adding
// a `depth` option to `children`.
//
// ### `home`
//
// Apostrophe populates the home page from `req.page._ancestors[0]` if possible.
// If not, Apostrophe fetches the home page separately, using the same filters configured for
// ancestors. You can shut this extra query off:
//
// ```javascript
// {
//   home: false
// }
// ```
//
// In addition, if ancestors are not configured, Apostrophe assumes you want the children
// of the home page. You can shut that off, and still get the home page:
//
// ```javascript
// {
//   home: {
//     children: false
//   }
// }
// ```
//
// ### `deleteFromTrash`
//
// If set to `true`, Apostrophe offers a button in the
// "reorganize" view to permanently delete pages that are already in the trash.**
// This option defaults to `false` because, in our experience, customers usually
// ask for a way to "un-empty the trash," and of course there isn't one. We don't
// recommend enabling the feature on a permanent basis but it can be useful during
// the early stages of site population.
//
// ### `infoProjection`
//
// A MongoDB-style projection object indicating which properties of a page will be returned
// by the `info` web API used to refresh information about a page after an editing operation
// in the reorganize view. This was added for security reasons. You probably will not need
// to expand this unless you are overriding the reorganize view code heavily.

var async = require('async');
var _ = require('@sailshq/lodash');
var Promise = require('bluebird');

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

  // Projection for the `info` route, which is used by the reorganize view to get information about a page,
  // for instance after an editing action that could change its status. You can expand this if your overrides
  // require it. Added for security reasons

  infoProjection: {
    _url: 1,
    title: 1,
    trash: 1,
    published: 1,
    type: 1,
    slug: 1,
    createdAt: 1,
    updatedAt: 1
  },

  beforeConstruct: function(self, options) {

    options.batchOperations = [
      {
        name: 'trash',
        label: 'Trash'
      }
    ].concat(options.apos.docs.trashInSchema ? [
      {
        name: 'rescue',
        label: 'Rescue'
      }
    ] : []).concat([
      {
        name: 'publish',
        label: 'Publish'
      },
      {
        name: 'unpublish',
        label: 'Unpublish'
      },
      {
        name: 'tag',
        label: 'Add Tag to',
        buttonLabel: 'Add Tag',
        schema: [
          {
            type: 'tags',
            name: 'tags',
            label: 'Tag',
            required: true
          }
        ]
      },
      {
        name: 'untag',
        label: 'Remove Tag from',
        buttonLabel: 'Remove Tag',
        schema: [
          {
            type: 'tags',
            name: 'tags',
            label: 'Tag',
            required: true
          }
        ]
      }
    ]).concat(options.addBatchOperations || []);
    if (options.removeBatchOperations) {
      options.batchOperations = _.filter(options.batchOperations, function(batchOperation) {
        return (!_.contains(options.removeBatchOperations, batchOperation.name));
      });
    }
  },

  afterConstruct: function(self, callback) {
    self.createRoutes();
    self.pushAssets();
    self.validateTypeChoices();
    self.finalizeControls();
    self.addPermissions();
    self.addToAdminBar();
    self.on('apostrophe:migrate', 'ensureIndexesPromisified', function() {
      return require('bluebird').promisify(self.ensureIndexes)();
    });
    return async.series([
      self.registerTrashPageType
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

    self.on('apostrophe:migrate', 'parkAllPromisified', function() {
      return Promise.try(function() {
        return self.emit('beforeParkAll');
      }).then(function() {
        return Promise.promisify(self.implementParkAll)();
      });
    });

    // Wait until the last possible moment to add
    // the wildcard route for serving pages, so that
    // other routes are not blocked

    self.afterInit = function(callback) {
      self.apos.app.get('*', self.serve);
      // In case someone used the super pattern let's continue to behave
      // as a callback-driven method even though we don't migrate here anymore
      return callback(null);
    };

  }

};
