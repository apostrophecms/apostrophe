var _ = require('lodash');

module.exports = {

  extend: 'apostrophe-doc-type-manager',

  beforeConstruct: function(self, options) {

    options.name = options.name || self.__meta.name.replace(/\-pages$/, '-page');

    options.addFields = [
      {
        type: 'slug',
        name: 'slug',
        label: 'Slug',
        required: true,
        // with this flag, a leading / is enforced, and slashes
        // elsewhere are allowed etc.
        page: true
      },
      {
        type: 'select',
        name: 'type',
        label: 'Type',
        required: true,
        choices: _.map(options.apos.pages.typeChoices, function(type) {
          return {
            value: type.name,
            label: type.label
          };
        })
      },
      {
        type: 'boolean',
        name: 'orphan',
        label: 'Hide in Navigation'
      }
    ].concat(options.addFields || []);

    options.arrangeFields = [
      {
        name: 'basics',
        label: 'Basics',
        fields: [ 'title', 'slug', 'type', 'published', 'tags', 'orphan' ]
      }
    ].concat(options.arrangeFields || []);

  },

  construct: function(self, options) {

    require('./lib/dispatch.js')(self, options);

    // Return a cursor for finding pages of this type only. The cursor is an
    // `apostrophe-pages-cursor`, so it has access to filters like
    // `ancestors` and `children`. Subclasses will often override this
    // to create a cursor of a more specific type that adds more filters

    self.find = function(req, criteria, projection) {
      return self.apos.create('apostrophe-pages-cursor', {
        apos: self.apos,
        req: req,
        criteria: criteria,
        projection: projection
      }).type(self.name);
    };

  }
};
