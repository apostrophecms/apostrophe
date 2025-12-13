const methods = require('./lib/methods');
const extendMethods = require('./lib/extendMethods');
const handlers = require('./lib/handlers');
const apiRoutes = require('./lib/apiRoutes');

module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    alias: 'styles',
    label: 'apostrophe:stylesLabel',
    pluralLabel: 'apostrophe:stylesPluralLabel',
    autopublish: true,
    versions: true,
    searchable: false,
    quickCreate: false,
    // Do not allow contributors to mess with the site-wide styles
    editRole: 'editor',
    publishRole: 'editor',
    singletonAuto: {
      slug: 'styles'
    },
    // If true, always render CSS server side during editing, which slows
    // down the UI slightly but allows the use of a custom render function
    serverRendered: false,
    defaultStyles: {
      borderColor: 'black',
      shadowColor: 'gray'
    }
  },
  cascades: [ 'styles' ],
  commands(self) {
    return {
      add: {
        [`${self.__meta.name}:taskbar-manager`]: {
          type: 'item',
          label: self.options.label,
          action: {
            type: 'admin-menu-click',
            payload: '@apostrophecms/styles'
          },
          permission: {
            action: 'edit',
            type: self.__meta.name
          },
          shortcut: 'T,P'
        }
      },
      remove: [
        `${self.__meta.name}:manager`
      ],
      modal: {
        default: {
          '@apostrophecms/command-menu:taskbar': {
            label: 'apostrophe:commandMenuTaskbar',
            commands: [
              `${self.__meta.name}:taskbar-manager`
            ]
          }
        }
      }
    };
  },
  async init(self, options) {
    const { renderGlobalStyles, renderScopedStyles } =
      await import('./ui/universal/render.mjs');
    const { default: checkIfConditions } =
      await import('../../../lib/universal/check-if-conditions.mjs');
    self.stylesheetGlobalRender = renderGlobalStyles;
    self.stylesheetScopedRender = renderScopedStyles;
    self.styleCheckIfConditions = checkIfConditions;

    self.apos.doc.addContextOperation({
      action: 'reset-styles-position',
      label: 'apostrophe:stylesResetPosition',
      context: 'update',
      type: 'event',
      if: {
        type: self.__meta.name
      }
    });
    self.slug = options.slug || 'apostrophecms-styles';
    self.enableBrowserData();
    self.prependNodes('body', 'stylesheet');
    self.prependNodes('body', 'ui');
    self.addMigrations();

    // Removes some automatically added top level groups and
    // provides a default group if none are provided.
    const nonFields = [ 'archived' ];
    const groups = self.fieldsGroups;

    const fields = self.schema
      .map(f => f.name)
      .filter(f => !nonFields.includes(f));

    for (const key in groups) {
      if (
        groups[key].fields &&
        groups[key].fields.length &&
        !groups[key].fields.filter(f => fields.includes(f)).length
      ) {
        delete groups[key];
      }
    }
    if (!Object.keys(groups).length) {
      groups.settings = {
        label: 'apostrophe:stylesSettings',
        fields
      };
    }
    self.groups = groups;
  },
  methods,
  extendMethods,
  handlers,
  apiRoutes
};
