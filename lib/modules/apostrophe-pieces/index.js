module.exports = {

  afterConstruct: function(self) {
    self.manager = self.apos.docs.getManager(self.options.instanceName);
    self.manager.find = self.find;
    self.apos.docs.setManager(self.options.instanceName, self.manager);
  },

  construct: function(self, options) {
    options.addFields = [
    ].concat(options.addFields || []);

    options.browser = options.browser || {};

    self.schema = self.apos.schemas.compose(options);

    _.defaults(options.browser, _.pick(options, 'name', 'label', 'pluralLabel', 'action'));

    options.browser.schema = self.schema;

    require('./lib/routes.js')(self, options);
    require('./lib/api.js')(self, options);
    require('./lib/browser.js')(self, options);
  }

};
