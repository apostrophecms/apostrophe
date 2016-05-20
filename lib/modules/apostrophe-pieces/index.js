var _ = require('lodash');

module.exports = {

  manageViews: [ 'list' ],
  perPage: 10,

  afterConstruct: function(self) {
    self.composeSchema();
    self.composeFilters();
    self.composeColumns();
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

    require('./lib/routes.js')(self, options);
    require('./lib/api.js')(self, options);
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
