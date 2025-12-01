const { stripIndent } = require('common-tags');
const util = require('./util');

module.exports = function (moduleName, options = {}) {
  const label = util.titleCase(moduleName.replace(/-/g, ' '));

  return {
    current: {
      'add-module': {
        moduleConfig: stripIndent`
          module.exports = {
            extend: '@apostrophecms/module',
            init(self) {

            }
          };
        `
      },
      'add-piece': {
        pieceConfig: stripIndent`
          module.exports = {
            extend: '@apostrophecms/piece-type',
            options: {
              label: '${label}',
              // Additionally add a \`pluralLabel\` option if needed.
            },
            fields: {
              add: {},
              group: {}
            }
          };
        `,
        pagesConfig: stripIndent`
          module.exports = {
            extend: '@apostrophecms/piece-page-type',
            options: {
              label: '${label} Page',
              pluralLabel: '${label} Pages',
            },
            fields: {
              add: {},
              group: {}
            }
          };
        `
      },
      'add-widget': {
        widgetsConfig: stripIndent`
          module.exports = {
            extend: '@apostrophecms/widget-type',
            options: {
              label: '${label} Widget',
            },
            fields: {
              add: {}
            }
          };
        `,
        widgetsView: stripIndent`
          <section data-${moduleName}-widget>
          </section>
        `,
        jsConfig: stripIndent`
          export default () => {
            apos.util.widgetPlayers['${moduleName}'] = {
              selector: '[data-${moduleName}-widget]',
              player: function(el) {
                // Add player code
              }
            };
          };
        `
      }
    }
  };
};
