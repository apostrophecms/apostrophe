class Node {
  constructor(props) {
    Object.assign(this, props);
    if (!this.nodes) {
      this.nodes = [];
    }
    this.parent = null;
    // Initialize raws if not present, to mimic PostCSS
    if (!this.raws) {
      this.raws = {};
    }
  }

  append(node) {
    node.parent = this;
    this.nodes.push(node);
    return this;
  }

  prepend(node) {
    node.parent = this;
    this.nodes.unshift(node);
    return this;
  }

  before(node) {
    if (!this.parent) {
      return this;
    }
    const index = this.parent.nodes.indexOf(this);
    node.parent = this.parent;
    this.parent.nodes.splice(index, 0, node);
    return this;
  }

  after(node) {
    if (!this.parent) {
      return this;
    }
    const index = this.parent.nodes.indexOf(this);
    node.parent = this.parent;
    this.parent.nodes.splice(index + 1, 0, node);
    return this;
  }

  remove() {
    if (this.parent) {
      const index = this.parent.nodes.indexOf(this);
      if (index !== -1) {
        this.parent.nodes.splice(index, 1);
      }
      this.parent = undefined;
    }
    return this;
  }

  replaceWith(node) {
    this.before(node);
    this.remove();
    return this;
  }

  clone(overrides = {}) {
    const clone = new this.constructor({
      ...this,
      ...overrides,
      parent: null
    });
    // Deep clone nodes
    if (this.nodes) {
      clone.nodes = this.nodes.map(n => n.clone());
      clone.nodes.forEach(n => {
        n.parent = clone;
      });
    }
    return clone;
  }

  walk(callback) {
    if (!this.nodes) {
      return;
    }
    // Create a copy of nodes to iterate safely if structure changes
    [ ...this.nodes ].forEach(node => {
      if (callback(node) !== false) {
        if (node.walk) {
          node.walk(callback);
        }
      }
    });
  }

  walkDecls(propOrFn, fn) {
    let prop;
    if (typeof propOrFn === 'string') {
      prop = propOrFn;
    } else {
      fn = propOrFn;
    }
    this.walk(node => {
      if (node.type === 'decl') {
        if (prop && node.prop !== prop) {
          return;
        }
        fn(node);
      }
    });
  }

  walkRules(fn) {
    this.walk(node => {
      if (node.type === 'rule') {
        fn(node);
      }
    });
  }

  walkAtRules(nameOrFn, fn) {
    let name;
    if (typeof nameOrFn === 'string') {
      name = nameOrFn;
    } else {
      fn = nameOrFn;
    }
    this.walk(node => {
      if (node.type === 'atrule') {
        if (name && node.name !== name) {
          return;
        }
        fn(node);
      }
    });
  }

  each(fn) {
    if (!this.nodes) {
      return;
    }
    [ ...this.nodes ].forEach(fn);
  }

  prev() {
    if (!this.parent) {
      return undefined;
    }
    const index = this.parent.nodes.indexOf(this);
    return index > 0 ? this.parent.nodes[index - 1] : undefined;
  }

  get first() {
    return this.nodes ? this.nodes[0] : undefined;
  }

  insertBefore(child, newChild) {
    const index = this.nodes.indexOf(child);
    if (index !== -1) {
      if (!(newChild instanceof Node)) {
        if (newChild.prop) {
          newChild = new Decl(newChild);
        } else if (newChild.selector) {
          newChild = new Rule(newChild);
        } else if (newChild.name) {
          newChild = new AtRule(newChild);
        }
      }
      newChild.parent = this;
      this.nodes.splice(index, 0, newChild);
    }
    return this;
  }
}

class Root extends Node {
  constructor(props) {
    super(props);
    this.type = 'root';
  }
}

class Rule extends Node {
  constructor(props) {
    super(props);
    this.type = 'rule';
  }
}

class AtRule extends Node {
  constructor(props) {
    super(props);
    this.type = 'atrule';
  }
}

class Decl extends Node {
  constructor(props) {
    super(props);
    this.type = 'decl';
    delete this.nodes; // Decls don't have children
  }
}

module.exports = {
  Root,
  Rule,
  AtRule,
  Decl
};
