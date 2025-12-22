const processed = Symbol('processed');

const createPostcssAdapter = (helpers) => {
  return {
    // Node creation
    createRule: (props) => {
      if (helpers.Rule) {
        return new helpers.Rule({
          ...props,
          from: helpers.result.opts.from
        });
      }
      return {
        type: 'rule',
        ...props,
        from: helpers.result.opts.from
      };
    },
    createAtRule: (props) => {
      if (helpers.AtRule) {
        return new helpers.AtRule({
          ...props,
          from: helpers.result.opts.from
        });
      }
      return {
        type: 'atrule',
        ...props,
        from: helpers.result.opts.from
      };
    },
    createDecl: (props) => {
      if (helpers.Decl) {
        return new helpers.Decl({
          ...props,
          from: helpers.result.opts.from
        });
      }
      return {
        type: 'decl',
        ...props,
        from: helpers.result.opts.from
      };
    },

    // Node manipulation
    clone: (node, props) => node.clone({
      ...props,
      from: helpers.result.opts.from
    }),
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
    getSource: (node) => node.source,
    getSourceStartLine: (node) => node.source?.start?.line,
    getFrom: (node) => helpers.result.opts.from,

    // State
    markProcessed: (node) => {
      node[processed] = true;
    },
    isProcessed: (node) => !!node[processed]
  };
};

module.exports = createPostcssAdapter;
