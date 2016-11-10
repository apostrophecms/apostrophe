// `apostrophe-pieces` provides a "base class" you can extend to create new content
// types for your project. Just use the `addFields` option to create a schema and
// you'll get a user interface for managing your content for free. Add in the
// `apostrophe-pieces-pages` module to display an index page and permalink pages
// for your pieces, and use `apostrophe-pieces-widgets` to allow them to be sprinkled
// into pages all over the site. To learn more, see:
//
// [Reusable content with pieces](http://unstable.apostrophenow.org/tutorials/getting-started/reusable-content-with-pieces.html)

var _ = require('lodash');

module.exports = {

  extend: 'apostrophe-doc-type-manager',
  manageViews: [ 'list' ],
  perPage: 10,

  afterConstruct: function(self) {
    self.composeFilters();
    self.composeColumns();
    self.pushAssets();
    self.pushDefineSingleton();
    self.createRoutes();
    self.addPermissions();
    self.addToAdminBar();
  },

  beforeConstruct: function(self, options) {
    self.contextual = options.contextual;

    if (self.contextual) {
      // If the piece is edited contextually, default the published state to false
      options.addFields = [
        {
          type: 'boolean',
          name: 'published',
          label: 'Published',
          def: false
        }
      ].concat(options.addFields || []);
    }

    options.defaultColumns = options.defaultColumns || [
      {
        name: 'title',
        label: 'Title'
      },
      {
        name: 'updatedAt',
        label: 'Last Updated',
        partial: function(value) {
          if (!value) {
            // Don't crash if updatedAt is missing, for instance due to a dodgy import process
            return '';
          }
          return self.partial('manageUpdatedAt.html', { value: value });
        }
      },
      {
        name: 'published',
        label: 'Published',
        partial: function(value) {
          return self.partial('managePublished', { value: value });
        }
      }
    ];

    if (self.contextual) {
      options.defaultColumns.push({
        name: '_url',
        label: 'Link',
        partial: function(value) {
          return self.partial('manageLink', { value: value });
        }
      })
    }

    options.addColumns = options.defaultColumns.concat(options.addColumns || []);

    options.addFilters = [
      {
        name: 'published',
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
        allowedInChooser: false,
        def: true
      },
      {
        name: 'trash',
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
        allowedInChooser: false,
        def: false
      }
    ].concat(options.addFilters || []);
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
    self.manageViews = options.manageViews;

    require('./lib/api.js')(self, options);
    require('./lib/routes.js')(self, options);
    require('./lib/browser.js')(self, options);
    require('./lib/helpers.js')(self, options);

    // As a doc manager, we can provide default templates for use when
    // choosing docs of our type. With this code in place, subclasses of
    // pieces can just provide custom chooserChoice.html and chooserChoices.html
    // templates with no additional plumbing. -Tom

    self.choiceTemplate = self.__meta.name + ':chooserChoice.html';
    self.choicesTemplate = self.__meta.name + ':chooserChoices.html';
    self.relationshipTemplate = self.__meta.name + ':relationshipEditor.html';
  }

};
