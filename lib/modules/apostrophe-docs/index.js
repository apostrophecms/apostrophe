var async = require('async');
var _ = require('lodash');

module.exports = {

  alias: 'docs',

  afterConstruct: function(self, callback) {
    return async.series([ self.enableCollection, self.ensureIndexes ], callback);
  },

  construct: function(self, options) {

    options.addFields = [
      {
        type: 'string',
        name: 'title',
        label: 'Title',
        required: true,
        // Generate a titleSort property which can be sorted
        // in a human-friendly way (case insensitive, ignores the
        // same stuff slugs ignore)
        sortify: true
      },
      {
        type: 'slug',
        name: 'slug',
        label: 'Slug',
        required: true
      },
      {
        type: 'tags',
        name: 'tags',
        label: 'Tags'
      },
      {
        type: 'boolean',
        name: 'published',
        label: 'Published',
        def: true
      },
      {
        type: 'boolean',
        name: 'trash',
        label: 'Trash',
        // not edited via a form
        contextual: true,
        def: false
      }
    ].concat(options.addFields || []);

    self.schema = self.apos.schemas.compose(options);

    self.apos.define('apostrophe-cursor', require('./lib/cursor.js'));

    require('./lib/api.js')(self, options);
    require('./lib/routes.js')(self, options);
    require('./lib/browser.js')(self, options);

    self.pushAssets();
    self.pushCreateSingleton();

  }
};
