// moog implements the pattern we use to initialize modules. It supports
// inheritance via `extend`/`extends`, the `init`, `beforeSuperClass`,
// `methods`, and `extendMethods` features, etc.

const _ = require('lodash');

module.exports = function(options) {

  options = options || {};

  const self = {};

  self.options = options;

  self.definitions = {};

  self.ordinal = 0;

  // The "extending" argument is of interest to subclasses like
  // moog-require that need to know about relative paths. Must
  // return the new definition for the convenience of moog-require too

  self.define = function(className, definition, extending) {

    if (!definition) {
      // This can happen because we use self.define as an autoloader
      // when resolving "extend". The moog-require module overloads
      // self.define to handle this case
      throw new Error(new Error('The className ' + className + ' is not defined.'));
    }

    // Make a shallow clone to avoid numerous problems with multiple
    // intentionally separate instances of moog; otherwise they wind
    // up sharing `__meta` depending on whether they were loaded with
    // `require`, and so on. We must clone `__meta` itself for the
    // same reason, and also `__meta.chain` because it is an array
    // object. All other properties of `__meta` are simple values.

    definition = _.clone(definition);
    if (definition.__meta !== undefined) {
      definition.__meta = _.clone(definition.__meta);
      if (definition.__meta.chain) {
        definition.__meta.chain = _.clone(definition.__meta.chain);
      }
    }
    definition.__meta = definition.__meta || {};
    definition.__meta.name = className;
    definition.__meta.ordinal = self.ordinal++;

    if (!extending) {
      definition.__meta.explicit = true;
    }

    const exists = _.has(self.definitions, className);
    if (definition.extendIfFirst && (!exists)) {
      definition.extend = definition.extendIfFirst;
    }

    if ((!definition.extend) && (definition.extend !== false)) {
      if (exists) {
        // Double definitions result in implicit subclassing of
        // the original definition by the new one; anything else
        // trying to access this className name will see
        // the resulting subclass via self.definitions. However
        // we reset the __name property for the benefit of
        // implementations that need to distinguish assets that
        // come from each subclass in the inheritance chain.
        definition.extend = self.definitions[className];
        definition.__meta.name = self.originalToMy(definition.__meta.name);
      } else {
        // Extend the default base class by default, if any, unless
        // we're it
        if (self.options.defaultBaseClass && className !== self.options.defaultBaseClass) {
          definition.extend = self.options.defaultBaseClass;
        }
      }
    }
    self.definitions[className] = definition;
    return definition;
  };

  self.redefine = function(className, definition) {
    delete self.definitions[className];
    return self.define(className, definition);
  };

  self.isDefined = function(className, options) {
    options = options || {};
    if (_.has(self.definitions, className)) {
      return true;
    }
    if (options.autoload === false) {
      return false;
    }
    try {
      // Can we autoload it?
      self.define(className);
      // Yes, but we don't really want it yet
      delete self.definitions[className];
      return true;
    } catch (e) {
      return false;
    }
  };

  // Create an instance of the given class name, awaiting the
  // init functions of each class in the inheritance tree,
  // if present

  self.create = async function(className, _options) {

    const options = {};

    const { that, steps } = self.createWithoutInit(className, options);

    for (let step of steps) {
      if (step.init) {
        await step.init(that, options);
      }
    }

    Object.assign(options, _options || {});
    return that;

  };

  // Create an instance synchronously. Same as `create`, except
  // that `init` functions are invoked but not awaited. If any
  // `init` function returns a promise (is an async function),
  // an exception is thrown.

  self.createSync = function(className, _options) {

    const options = {};

    const { that, steps } = self.createWithoutInit(className, options);

    for (let step of steps) {
      if (step.init) {
        const result = step.init(that, options);
        if (result && result.then) {
          throw new Error('Since you are calling createSync, you must not use init functions that are async functions or return promises for this class and its ancestors.');
        }
      }
    }

    Object.assign(options, _options || {});

    return that;

  };

  // Creates an instance of the named class but does not run any
  // init functions. An implementation detail of both `create` and
  // `createSync`, which runs init functions with and without `await`.

  self.createWithoutInit = function(className, options) {

    const {
      that,
      steps
    } = createPrep(className, options);

    for (const step of steps) {
      if (step.beforeSuperClass) {
        step.beforeSuperClass(that, options);
      }
    }

    // Everything in Apostrophe appreciates self.options being
    // a thing already after create is complete
    that.options = options;

    // Now we want to start from the base class and go down
    steps.reverse();

    for (const step of steps) {
      Object.assign(options, step.options || {});
      if (step.fields) {
        if (step.fields.add) {
          options.addFields = (options.addFields || []).concat(Object.keys(step.fields.add).map(name => ({
            name,
            ...step.fields.add[name]
          })));
        }
        if (step.fields.remove) {
          options.removeFields = (options.removeFields || []).concat(step.fields.remove);
        }
        if (step.fields.arrange) {
          options.arrangeFields = (options.arrangeFields || []).concat(Object.keys(step.fields.arrange).map(name => ({
            name,
            ...step.fields.arrange[name]
          })));
        }
      }
    }

    // This needs to be after the options and fields sections, yet we've already
    // reordered the steps with the superclass first, so walk it backwards to
    // implement beforeSuperClass
    for (let i = (steps.length - 1); (i >= 0); i--) {
      const step = steps[i];
      if (step.beforeSuperClass) {
        step.beforeSuperClass(that, options);
      }
    }

    // upgrade lint
    for (const step of steps) {
      if (step.construct) {
        throw new Error(step.__meta.name + ': in Apostrophe 3.x, "construct" has been replaced with "methods", "routes", "apiRoutes", etc.');
      }
      if (step.beforeConstruct) {
        throw new Error(step.__meta.name + ': in Apostrophe 3.x, "beforeConstruct" has been replaced with "beforeSuperClass". It takes (self, options) and should be solely concerned with modifying the options before the base class sees them. It must be synchronous.');
      }
      if (step.afterConstruct) {
        throw new Error(step.__meta.name + ': in Apostrophe 3.x, "afterConstruct" has been replaced with "init". It takes (self, options) and in the case of modules it will be awaited.');
      }
    }

    // Always build methods first so they can be referenced safely
    // in other sections
    build(null, 'methods');

    // helpers, eventHandlers, apiRoutes, renderRoutes, whatever comes up
    (self.options.sections || []).forEach(section => build(section, section));

    function build(section, keyword) {
      for (const step of steps) {
        let context;
        if (section) {
          // non-methods attach to a named section object
          that[section] = that[section] || {};
          context = that[section];
        } else {
          // methods attach directly to self
          context = that;
        }
        if (step[keyword]) {
          if ((typeof step[keyword]) !== 'function') {
            throw new Error(keyword + ' must be a function, like ' + keyword + '(self, options)');
          }
          _.merge(context, step[keyword](that, options));
        }
        const extend = 'extend' + keyword.charAt(0).toUpperCase() + keyword.slice(1);
        if (step[extend]) {
          const extensions = step[extend](that, options);
          wrap(context, extensions);

          function wrap(context, extensions) {
            _.each(extensions, (fn, name) => {
              if ((typeof fn) !== 'function') {
                // Nested structure is allowed, for instance to implement
                // the eventHandlers syntax, with event names
                // and the actual named handlers grouped within them
                context[name] = context[name] || {};
                return wrap(context[name], fn);
              }
              let superMethod;
              if (Array.isArray(context[name])) {
                // Middleware chain - actual route fn will be last fn
                superMethod = context[name][context[name].length - 1 ];
                context[name][context[name].length - 1] = function() {
                  return fn.apply(that, [ superMethod, ...arguments ]);
                }
              } else {
                superMethod = context[name];
                context[name] = function() {
                  return fn.apply(that, [ superMethod, ...arguments ]);
                }
              }
            });
          }
        }
      }
    }

    return {
      that,
      steps
    };

  };

  // Returns true if the given object is of the given moog class.
  // If the object is not a moog object, `false` is returned.

  self.instanceOf = function(object, name) {
    if (!object.__meta) {
      return false;
    }
    if (!object.__meta.chain) {
      return false;
    }
    return !!_.find(object.__meta.chain, { name: name });
  };

  // Given a moog class name like `my-foo` or `@namespace/my-foo`,
  // this method will return `foo` or `@namespace/my-foo`. Any other
  // name is returned as-is.

  self.myToOriginal = function(name) {
    if (name.match(/^my-/)) {
      return name.replace(/^my-/, '');
    }
    return name.replace(/^@([^/]+)\/my-(.*)$/, '@$1/$2');
  };

  // Given a moog class name like `foo` or `@namespace/foo`, this method
  // will return `my-foo` or `@namespace/my-foo` as appropriate. The behavior
  // of this method when given a name that already has a my- prefix is
  // undefined and should not be relied upon (see isMy).

  self.originalToMy = function(name) {
    if (name.match(/^@/)) {
      return name.replace(/^@([^/]+)\/(.*)$/, '@$1/my-$2');
    } else {
      return 'my-' + name;
    }
  };

  // Given a moog class name like `my-foo` or `@namespace/my-foo`, this
  // method will return true. Otherwise it will return false.

  self.isMy = function(name) {
    if (name.match(/^my-/)) {
      return true;
    }
    if (name.match(/^@([^/]+)\/my-(.*)$/)) {
      return true;
    }
    return false;
  };

  return self;

  function createPrep(className, options) {

    const that = {};
    const steps = [];
    const seen = {};
    let next = self.definitions[className];
    if (!next) {
      throw new Error('The className ' + className + ' is not defined.');
    }
    while (next) {
      const current = next;
      if (_.has(seen, current.__meta.ordinal)) {
        throw new Error('The className ' + className + ' encounters an infinite loop, "extend" probably points back to itself or its subclass.');
      }
      seen[current.__meta.ordinal] = true;
      steps.push(current);
      next = current.extend;
      // In most cases it'll be a string we need to look up
      // in self.definitions. In a few cases it is already
      // a pointer to another definition (see double defines, above)
      if (typeof (next) === 'string') {
        const nextName = next;
        next = self.definitions[nextName];
        if (!next) {
          // Try to use define as an autoloader. This will fail in
          // the default implementation
          next = self.define(nextName, undefined, current);
        }
      }
    }

    // Attach metadata about the modules in the
    // inheritance chain, base class first
    that.__meta = { chain: [], name: className };
    let i = steps.length - 1;
    while (i >= 0) {
      that.__meta.chain.push(steps[i].__meta);
      i--;
    }

    return { that, steps };
  }

};
