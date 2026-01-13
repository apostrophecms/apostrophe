const parse = require('./parser');
const serialize = require('./serializer');
const createStandaloneAdapter = require('./adapter');
const createCoreProcessor = require('../core/processor');

/**
 * Process CSS string to convert viewport units to container units based
 * on a toggle attribute.
 *
 * @param {string} css - The CSS string to process.
 * @param {Object} [options={}] - Configuration options.
 * @param {Object.<string, string>} [options.units] - Map of viewport units to container
 * units. Defaults to standard mappings (vh->cqh, vw->cqw, etc).
 * @param {string} [options.containerEl='body'] - The selector for the container element.
 * @param {string} [options.modifierAttr='data-breakpoint-preview-mode'] - The attribute
 * used to toggle the container query mode.
 * @param {boolean} [options.debug=false] - Enable debug logging.
 * @param {function(string): string} [options.transform] - Custom function to transform
 * media query parameters.
 * @param {string} [options.debugFilter] - Filter debug logs by file path (not relevant
 * for browser usage usually).
 * @returns {string} The processed CSS string.
 */
const process = (css, options = {}) => {
  const root = parse(css);
  const adapter = createStandaloneAdapter();
  const processor = createCoreProcessor(options);

  processor.processRoot(root, adapter);

  // Walk the tree and process rules and at-rules
  // We use a custom walk that iterates over a snapshot of nodes,
  // so newly added nodes are not visited in the same pass.
  // This is desired because the processor handles the new nodes fully.
  root.walk(node => {
    if (node.type === 'rule') {
      processor.processRule(node, adapter);
    } else if (node.type === 'atrule') {
      processor.processAtRule(node, adapter);
    }
  });

  processor.printSummary();

  return serialize(root);
};

module.exports = process;
