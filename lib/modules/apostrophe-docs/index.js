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
        // appears in list view as a sortable column
        list: {
          sort: {
            order: 1
          }
        },
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
        type: 'boolean',
        name: 'published',
        label: 'Published',
        filter: {
          choices: [
            {
              value: true,
              label: 'Published'
            },
            {
              value: false,
              label: 'Draft'
            },
            {
              value: null,
              label: 'Both'
            }
          ],
          def: true
        },
        def: true
      },
      {
        type: 'boolean',
        name: 'trash',
        label: 'Trash',
        // not edited via a form
        contextual: true,
        filter: {
          choices: [
            {
              value: false,
              label: 'Live'
            },
            {
              value: true,
              label: 'Trash'
            }
          ],
          def: false
        },
        def: false
      }
    ].concat(options.addFields || []);

    self.schema = self.apos.schemas.compose(options);

    self.apos.define('apostrophe-cursor', require('./lib/cursor.js'));

    require('./lib/api.js')(self, options);
    require('./lib/routes.js')(self, options);
  }
};
