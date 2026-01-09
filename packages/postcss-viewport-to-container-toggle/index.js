/**
 * PostCSS plugin to toggle viewport units into container query units.
 *
 * This plugin processes CSS rules and media queries to add container query versions
 * alongside the existing viewport versions. It includes support for:
 * - Converting `position: fixed` to `position: sticky` in container contexts.
 * - Handling nested media queries.
 * - Adding container query contexts when required.
 *
 * @param {Object} opts - Plugin options.
 * @param {Object} [opts.units] - A mapping of viewport units to container query units.
 * @param {string} [opts.containerEl='body'] - The container element selector.
 * @param {string} [opts.modifierAttr='data-breakpoint-preview-mode']
 * - The attribute for container queries.
 * @param {Function} [opts.transform] - A custom function to transform
 * media queries when creating container queries.
 * @param {boolean} [opts.debug=false] - Enables debug logging.
 * @param {string} [opts.debugFilter] - A filter string for limiting debug
 * logs to specific files.
 * @returns {Object} The PostCSS plugin.
 */
const createCoreProcessor = require('./src/core/processor');
const createPostcssAdapter = require('./src/core/postcssAdapter');

const plugin = (opts = {}) => {
  const coreProcessor = createCoreProcessor(opts);

  return {
    postcssPlugin: 'postcss-viewport-to-container-toggle',

    Once(root, helpers) {
      const adapter = createPostcssAdapter(helpers);
      coreProcessor.processRoot(root, adapter);
    },

    Rule(rule, helpers) {
      const adapter = createPostcssAdapter(helpers);
      coreProcessor.processRule(rule, adapter);
    },

    AtRule: {
      media(atRule, helpers) {
        const adapter = createPostcssAdapter(helpers);
        coreProcessor.processAtRule(atRule, adapter);
      }
    },

    OnceExit() {
      coreProcessor.printSummary();
    }
  };
};

plugin.postcss = true;

module.exports = plugin;
