var _ = require('lodash');

module.exports = {

  afterConstruct: function(self) {
    self.composeSchema();
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
      // all docs have this already, but we want it in the schema
      // here so it can be in the list view in manage. -Tom
      {
        type: 'updatedAt',
        name: 'updatedAt',
        label: 'Updated',
        // appears in list view as a sortable column
        list: {
          sort: {
            def: true,
            order: -1
          },
          partial: function(value) {
            return self.partial('listUpdatedAt.html', { value: value });
          }
        },
        // not edited in a form
        contextual: true
      }
    ].concat(options.addFields || []);

    require('./lib/routes.js')(self, options);
    require('./lib/api.js')(self, options);
    require('./lib/browser.js')(self, options);
    require('./lib/helpers.js')(self, options);
  }

};
