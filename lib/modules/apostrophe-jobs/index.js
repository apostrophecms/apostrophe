// The `apostrophe-jobs` module runs long-running jobs in response
// to user actions. Batch operations on pieces are a good example.
//
// The `apostrophe-jobs` module makes it simple to implement
// progress display, avoid server timeouts during long operations,
// and implement a "stop" button.
//
// See the `run` method for the easiest way to use this module.
// The `run` method allows you to implement routes that are designed
// to be paired with the `progress` method of this module on
// the browser side. All you need to do is make sure the
// ids are posted to your route and then write a function that
// can carry out the operation on one id.
//
// If you just want to add a new batch operation for pieces,
// see the examples already in `apostrophe-pieces` and those added
// by the `apostrophe-workflow` module. You don't need to go
// directly to this module for that case.
//
// If your operation doesn't break down neatly into repeated operations
// on single documents, look into calling the `start` method and friends
// directly from your code.
//
// The `apostrophe-jobs` module DOES NOT have anything to do with
// cron jobs or command line tasks.

module.exports = {

  collectionName: 'aposJobs',

  afterConstruct: function(self, callback) {
    self.addRoutes();
    self.pushAssets();
    self.pushCreateSingleton();
    return self.ensureCollection(callback);
  },

  construct: function(self, options) {

    require('./lib/routes.js')(self, options);
    require('./lib/api.js')(self, options);
    require('./lib/implementation.js')(self, options);
    require('./lib/browser.js')(self, options);

  }
};
