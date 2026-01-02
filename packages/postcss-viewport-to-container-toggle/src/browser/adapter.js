const {
  Rule, AtRule, Decl
} = require('./ast');

const processed = Symbol('processed');

const createBrowserAdapter = () => {
  return {
    // Node creation
    createRule: (props) => new Rule(props),
    createAtRule: (props) => new AtRule(props),
    createDecl: (props) => new Decl(props),

    // Node manipulation
    clone: (node, props) => node.clone(props),
    append: (parent, child) => parent.append(child),
    prepend: (parent, child) => parent.prepend(child),
    before: (node, newNode) => node.before(newNode),
    after: (node, newNode) => node.after(newNode),
    remove: (node) => node.remove(),
    replaceWith: (node, newNode) => node.replaceWith(newNode),

    // Traversal
    walkRules: (node, callback) => node.walkRules(callback),
    walkDecls: (node, propOrCallback, callback) =>
      node.walkDecls(propOrCallback, callback),
    walkAtRules: (node, nameOrCallback, callback) =>
      node.walkAtRules(nameOrCallback, callback),
    each: (node, callback) => node.each(callback),

    // Accessors
    getParent: (node) => node.parent,
    getPrev: (node) => node.prev(),
    getFirst: (node) => node.first,
    getType: (node) => node.type,
    getName: (node) => node.name,
    getParams: (node) => node.params,
    getSelector: (node) => node.selector,
    setSelector: (node, selector) => {
      node.selector = selector;
    },
    getProp: (node) => node.prop,
    getValue: (node) => node.value,
    setValue: (node, value) => {
      node.value = value;
    },
    getSource: (node) => ({ start: { line: 0 } }), // Mock source
    getSourceStartLine: (node) => 0, // Mock source line
    getFrom: (node) => undefined,

    // State
    markProcessed: (node) => {
      node[processed] = true;
    },
    isProcessed: (node) => !!node[processed]
  };
};

module.exports = createBrowserAdapter;
