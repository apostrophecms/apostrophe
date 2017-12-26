var async = require('async');
var _ = require('lodash');

module.exports = function(self, options) {

  self.widgetManagers = {};

  // When a page is served to a logged-in user, make sure the session
  // contains a blessing for every join configured in schemas for widgets
  
  self.pageServe = function(req) {
    if (req.user) {
      var managers = self.widgetManagers;
      _.each(managers, function(manager, name) {
        var schema = manager.schema;
        if (schema) {
          self.apos.schemas.bless(req, schema);
        }
      });
    }
  };

};
