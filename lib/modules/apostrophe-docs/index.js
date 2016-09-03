// This module is responsible for managing all of the documents (apostrophe "docs")
// in the `aposDocs` mongodb collection.
//
// The `getManager` method should be used to obtain a reference to the module
// that manages a particular doc type, so that you can benefit from behavior
// specific to that module. One method of this module that you may sometimes use directly
// is `apos.docs.find()`, which returns a [cursor](server-apostrophe-cursor.html) for
// fetching documents of all types. This is useful when implementing something
// like the [apostrophe-search](../apostrophe-search/index.html) module.

var async = require('async');
var _ = require('lodash');

module.exports = {

  alias: 'docs',

  afterConstruct: function(self, callback) {
    return async.series([ self.enableCollection, self.ensureIndexes ], callback);
  },

  construct: function(self, options) {

    self.apos.define('apostrophe-cursor', require('./lib/cursor.js'));

    require('./lib/api.js')(self, options);
    require('./lib/browser.js')(self, options);

    self.pushAssets();
    self.pushCreateSingleton();

  }
};
