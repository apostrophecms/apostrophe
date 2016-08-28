// A base class for modules that enhance the functionality of a page type.
// Extra fields can be added to the page settings modal in the usual way via
// the `addFields` option, and Express-style routes can be added to handle
// URLs that extend beyond the slug of the page using the `dispatch` method.
//
// The [apostrophe-pieces-pages](../apostrophe-pieces-pages/index.html) module
// is a good example of a subclass of this module.

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
    // `ancestors` and `children`.
    //
    // Because pages are normally displayed by Apostrophe's page loading mechanism,
    // which uses an `apostrophe-pages-cursor`, it doesn't really make sense to return
    // a custom cursor subclass here. It would not be used when actually viewing the
    // page anyway. If you must have extra filters for specific page types, implicitly
    // subclass apostrophe-pages-cursor and add filters that are mindful of the
    // type of each page.

    self.find = function(req, criteria, projection) {
      return self.apos.pages.find(req, criteria, projection).type(self.name);
    };

  }
};
