// This module is responsible for managing all of the documents (apostrophe "docs")
// in the `aposDocs` mongodb collection.
//
// The `getManager` method should be used to obtain a reference to the module
// that manages a particular doc type, so that you can benefit from behavior
// specific to that module. One method of this module that you may sometimes use directly
// is `apos.docs.find()`, which returns a [cursor](/reference/modules/apostrophe-docs/server-apostrophe-cursor.md) for
// fetching documents of all types. This is useful when implementing something
// like the [apostrophe-search](/reference/modules/apostrophe-search) module.
//
// ## Options
//
// **`trashInSchema`: if set to `true`, a "trash" checkbox appears in the
// schema for each doc type, and pieces in the trash can be edited. Pages
// in the trash are visually displayed beneath a trashcan for every "folder"
// (parent page), which is another way of expressing that trash is just a flag.
//
// This allows pages to be restored to their exact previous position and decouples
// moving pages from trashing pages, which is useful for the `apostrophe-workflow`
// module. In addition, it becomes possible to edit the page settings of a page
// that is in the trash. Similar benefits apply to pieces and are needed for the
// workflow module. On the minus side, a trashcan at each level is less intuitive
// to users raised on the traditional shared trashcan.
//
// **`conflictResolution`: by default, Apostrophe will attempt to resolve
// conflicts between users trying to edit the same document by presenting
// the option to take control or leave the other user in control. This
// mechanism can be disabled by explicitly setting `conflictResolution`
// to false. Doing so is *not recommended* for normal operation but has
// valid applications in automated testing.
//
// **`deconflictSlugs`: by default, Apostrophe will suggest nonconflicting
// slugs based on the title as the user types the title of a page or piece.
// If you do not want this feature and would prefer that the user encouter
// a clear error message every time their slug is in conflict, forcing
// them to make a manual choice, explicitly set this option to `false`.
//
// ** `advisoryLockTimeout`: Apostrophe locks documents while they are
// being edited so that another user, or another tab for the same user,
// does not inadvertently interfere. These locks are refreshed frequently
// by the browser while they are held. By default, if the browser
// is not heard from for 30 seconds, the lock expires. Note that
// the browser refreshes the lock every 5 seconds. This timeout should
// be quite short as there is no longer any reliable way to force a browser
// to unlock the document when leaving the page.

module.exports = {

  advisoryLockTimeout: 30,

  alias: 'docs',

  afterConstruct: function(self, callback) {
    return self.enableCollection(function(err) {
      if (err) {
        return callback(err);
      }
      self.on('apostrophe:migrate', 'ensureIndexesPromisified', function() {
        return require('bluebird').promisify(self.ensureIndexes)();
      });
      return callback(null);
    });
  },

  construct: function(self, options) {

    self.trashInSchema = options.trashInSchema;
    self.apos.define('apostrophe-cursor', require('./lib/cursor.js'));

    require('./lib/api.js')(self, options);
    require('./lib/browser.js')(self, options);
    require('./lib/routes.js')(self, options);

    self.pushAssets();
    self.pushCreateSingleton();

  }
};
