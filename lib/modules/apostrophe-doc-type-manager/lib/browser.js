var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  self.getBrowserData = function(req) {
    if (!req.user) {
      return;
    }
    const data = _.pick(options, 'name', 'label', 'pluralLabel');
    data.action = self.action;
    data.schema = self.allowedSchema(req);
    return data;
  };

};
