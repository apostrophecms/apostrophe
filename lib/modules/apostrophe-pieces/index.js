// `apostrophe-pieces` provides a "base class" you can extend to create new content
// types for your project. Just use the `addFields` option to create a schema and
// you'll get a user interface for managing your content for free. Add in the
// `apostrophe-pieces-pages` module to display an index page and permalink pages
// for your pieces, and use `apostrophe-pieces-widgets` to allow them to be sprinkled
// into pages all over the site. To learn more, see:
//
// [Reusable content with pieces](/core-concepts/reusable-content-pieces/)
//
// ## Options
//
// ### `slugPrefix`
//
// If set this string, which typically should end with `-`, will be prepended
// to the slugs of all pieces of this type in order to prevent needless
// conflicts with the slugs of other piece types.
//
// ### `addToListProjection`
//
// A MongoDB-style projection object indicating which additional properties of a piece will be returned
// by the query that populates the list view in the "Manage Pieces" dialog box. This was added
// for security reasons. Note that if you are simply using addColumns then this should happen automatically
// for you. You would mainly need this option if you are overriding the list view template
// altogether and displaying information in a custom way. Negative projections (exclusions) are
// not supported.
//
// ## More Options
//
// See [reusable content with pieces](/core-concepts/reusable-content-pieces/)
// for many additional options.

var _ = require('@sailshq/lodash');

module.exports = {

  extend: 'apostrophe-doc-type-manager',
  manageViews: [ 'list' ],
  perPage: 10,
  listProjection: {
    _url: 1,
    title: 1,
    published: 1,
    trash: 1,
    updatedAt: 1,
    createdAt: 1
  },
  addToListProjection: {},

  afterConstruct: function(self) {
    self.composeFilters();
    self.composeColumns();
    self.pushAssets();
    self.pushDefineSingleton();
    self.createRoutes();
    self.addPermissions();
    self.addToAdminBar();
    self.finalizeControls();
    self.addTasks();
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
        label: 'Title',
        sort: {
          title: 1
        }
      },
      {
        name: 'updatedAt',
        label: 'Last Updated',
        sort: {
          updatedAt: 1
        },
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
      });
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
        def: true,
        style: 'pill'
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
        def: false,
        style: 'pill'
      }
    ].concat(options.addFilters || []);

    options.batchOperations = [
      {
        name: 'trash',
        label: 'Trash',
        unlessFilter: {
          trash: true
        }
      },
      {
        name: 'rescue',
        label: 'Rescue',
        unlessFilter: {
          trash: false
        }
      },
      {
        name: 'publish',
        label: 'Publish',
        unlessFilter: {
          published: true
        },
        requiredField: 'published'
      },
      {
        name: 'unpublish',
        label: 'Unpublish',
        unlessFilter: {
          published: false
        },
        requiredField: 'published'
      },
      {
        name: 'tag',
        label: 'Add Tag to',
        buttonLabel: 'Add Tag',
        // The schema *of this piece type* must have a field called tags.
        // This has nothing to do with the schema for the batch form. -Tom
        requiredField: 'tags',
        schema: [
          {
            type: 'tags',
            name: 'tags',
            label: 'Tag',
            required: true
          }
        ]
      },
      {
        name: 'untag',
        label: 'Remove Tag from',
        buttonLabel: 'Remove Tag',
        // The schema *of this piece type* must have a field called tags.
        // This has nothing to do with the schema for the batch form. -Tom
        requiredField: 'tags',
        schema: [
          {
            type: 'tags',
            name: 'tags',
            label: 'Tag',
            required: true
          }
        ]
      },
      {
        // Batch permissions, but only if permissions fields are present
        name: 'permissions',
        label: 'Set Permissions for',
        buttonLabel: 'Permissions',
        requiredField: 'loginRequired'
      }
    ].concat(options.addBatchOperations || []);
    if (options.removeBatchOperations) {
      options.batchOperations = _.filter(options.batchOperations, function(batchOperation) {
        return (!_.contains(options.removeBatchOperations, batchOperation.name));
      });
    }
  },

  construct: function(self, options) {
    if (!options.name) {
      throw new Error('apostrophe-pieces require name option');
    }
    if (!options.label) {
      // Englishify it
      options.label = _.startCase(options.name);
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
    require('./lib/tasks.js')(self, options);

    // As a doc manager, we can provide default templates for use when
    // choosing docs of our type. With this code in place, subclasses of
    // pieces can just provide custom chooserChoice.html and chooserChoices.html
    // templates with no additional plumbing. -Tom

    self.choiceTemplate = self.__meta.name + ':chooserChoice.html';
    self.choicesTemplate = self.__meta.name + ':chooserChoices.html';
    self.relationshipTemplate = self.__meta.name + ':relationshipEditor.html';

    if (self.options.piecesFilters) {
      self.apos.utils.warnDev('⚠️ The piecesFilters option was passed to ' + self.__meta.name + ', which\nextends apostrophe-pieces. This option should be passed to the corresponding\nmodule that extends apostrophe-pieces-pages.');
    }
  }

};
