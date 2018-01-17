// This module is responsible for managing all of the documents (apostrophe "docs")
// in the `aposDocs` mongodb collection.
//
// The `getManager` method should be used to obtain a reference to the module
// that manages a particular doc type, so that you can benefit from behavior
// specific to that module. One method of this module that you may sometimes use directly
// is `apos.docs.find()`, which returns a [cursor](server-apostrophe-cursor.html) for
// fetching documents of all types. This is useful when implementing something
// like the [apostrophe-search](../apostrophe-search/index.html) module.
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

var async = require('async');

module.exports = {

  alias: 'docs',

  afterConstruct: function(self, callback) {
    return async.series([ self.enableCollection, self.ensureIndexes ], callback);
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
