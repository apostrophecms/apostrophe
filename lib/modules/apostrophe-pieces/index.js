var _ = require('lodash');

module.exports = {

  afterConstruct: function(self) {
    // inherit some useful methods from the default manager for our doc type,
    // if we never bothered to override them
    self.manager = self.apos.docs.getManager(self.options.name);
    _.defaults(self, self.manager);
    // now make ourselves the manager
    self.apos.docs.setManager(self.options.name, self);
    self.pushAssets();
    self.pushCreateSingleton();
    self.createRoutes();
  },

  construct: function(self, options) {
    if (!options.name) {
      throw new Error('apostrophe-pieces require name option');
    }
    if (!options.label) {
      throw new Error('apostrophe-pieces require label option');
    }
    options.pluralLabel = options.pluralLabel || options.label + 's';

    self.name = options.name;
    self.label = options.label;
    self.pluralLabel = options.pluralLabel;

    options.addFields = [
      {
        name: 'title',
        label: 'Title',
        type: 'string'
      },
      {
        name: 'slug',
        label: 'Slug',
        type: 'slug'
      },
      {
        name: 'published',
        label: 'Published',
        def: true,
        type: 'boolean'
      }
    ].concat(options.addFields || []);

    options.browser = options.browser || {};

    self.schema = self.apos.schemas.compose(options);

    _.defaults(options.browser, _.pick(options, 'name', 'label', 'pluralLabel'));

    options.browser.action = options.browser.action || self.action;

    options.browser.schema = self.schema;

    require('./lib/routes.js')(self, options);
    require('./lib/api.js')(self, options);
    require('./lib/browser.js')(self, options);
    require('./lib/helpers.js')(self, options);
  }

};
