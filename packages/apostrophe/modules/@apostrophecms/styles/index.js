const methods = require('./lib/methods');
const extendMethods = require('./lib/extendMethods');
const handlers = require('./lib/handlers');
const apiRoutes = require('./lib/apiRoutes');
const helpers = require('./lib/helpers');

// When and how the AI works with Global Styles, once the site has any
const AI_WHEN = 'The site-wide design: colors, fonts, spacing and the like on every page.';
const AI_HOW = 'Change Global Styles in their own window: open it with open_editor on the ' +
  'Global Styles document, then set every value the request needs with ' +
  'edit_open_document, in as few calls as you can; the page restyles as each value ' +
  'lands. Nothing is live until the user presses "Update Global Styles", which makes it ' +
  'live at once, and Cancel throws it away: say so in the reply. The window edits the ' +
  'locale of the page shown. Say what the fields can\'t express (a gradient where a field ' +
  'takes one color, say) rather than settling quietly for something close. The look of ' +
  'one widget is that widget\'s own style fields, changed with update_document, not ' +
  'Global Styles. Write Global Styles with update_document only when the user asks for ' +
  'the change to go live at once or in other locales; that call asks the user itself ' +
  'before it writes, so don\'t ask beforehand.';

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
      await import('./ui/apos/universal/render.mjs');
    const { default: checkIfConditions } =
      await import('../../../lib/universal/check-if-conditions.mjs');
    self.stylesheetGlobalRender = renderGlobalStyles;
    self.stylesheetScopedRender = renderScopedStyles;
    self.styleCheckIfConditions = checkIfConditions;

    if (Object.keys(self.styles).length > 0) {
      self.options.aiWhen ??= AI_WHEN;
      self.options.aiHow ??= AI_HOW;
      self.apos.doc.addContextOperation({
        action: 'reset-styles-position',
        label: 'apostrophe:stylesResetPosition',
        context: 'update',
        type: 'event',
        if: {
          type: self.__meta.name
        }
      });
    }

    self.slug = options.slug || 'apostrophecms-styles';
    self.enableBrowserData();
    self.prependNodes('body', 'stylesheet');
    self.prependNodes('body', 'ui');

    // Detect the layout gap field (carries `layoutGapDefault: true`,
    // see the `layoutGap` preset). If present, layout-widget will use its
    // value as the site-wide layout gap. Only one such field is allowed —
    // the first match wins; subsequent ones are ignored with a warning.
    const layoutGapFieldNames = self.fieldsWithMarker(
      self.schema, 'layoutGapDefault'
    );
    if (layoutGapFieldNames.length > 1) {
      self.apos.util.warn(
        '[@apostrophecms/styles] Multiple fields are marked with ' +
        `\`layoutGapDefault: true\` (${layoutGapFieldNames.join(', ')}). ` +
        'Only the first one will be used.'
      );
    }
    self.layoutGapFieldName = layoutGapFieldNames[0] || null;

    // Detect if any top-level style field uses a background preset
    // (which includes image relationships requiring attachment annotation).
    // A hack until we analyze the relationship/attachment racing
    // problem more thoroughly and implement a more robust solution.
    // This signals the API render route and post save hook to explicitly
    // re-annotate attachments.
    self.hasBackgroundFields = self.schema.some(
      field => field.customType === 'background'
    );

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
  apiRoutes,
  helpers
};
