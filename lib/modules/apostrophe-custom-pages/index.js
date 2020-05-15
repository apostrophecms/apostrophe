// A base class for modules that enhance the functionality of a page type.
// Extra fields can be added to the page settings modal in the usual way via
// the `addFields` option, and Express-style routes can be added to handle
// URLs that extend beyond the slug of the page using the `dispatch` method.
//
// The [apostrophe-pieces-pages](/reference/modules/apostrophe-pieces-pages) module
// is a good example of a subclass of this module.
//
// ## Options
//
// ### `name`
//
// The name, typically singular, of the page type. If it is not set,
// and the name of the module ends in `-pages`, `name` is set to the name
// of the module with `-pages` changed to `-page`. If the name of the module
// does not end in `-pages`, the name of the page type is identical to the
// name of the module.
//
// ### `scene`
//
// Normally, anonymous site visitors receive only the stylesheets and scripts
// included in the `anon` asset scene (those that are pushed with
// `{ when: 'always' }`). If your page will use assets, such as
// Apostrophe's schemas and modals, that are normally reserved for logged-in users
// then you will want to set `scene` to `user` in order to load them every time
// when this type of page is visited.

var _ = require('@sailshq/lodash');

module.exports = {

  extend: 'apostrophe-doc-type-manager',

  beforeConstruct: function(self, options) {

    options.name = options.name || self.__meta.name.replace(/-pages$/, '-page');

    if (options.permissionsFields === undefined) {
      // By default, pages have nuanced permissions
      options.permissionsFields = true;
    }

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
    self.removeTrashPrefixFields([ 'slug' ]);
    self.addTrashSuffixFields([ 'path', 'slug' ]);

    require('./lib/dispatch.js')(self, options);
    require('./lib/api.js')(self, options);
  }
};
