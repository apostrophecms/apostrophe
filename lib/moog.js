// moog implements the pattern we use to initialize modules. It supports
// inheritance via `extend`, the `init`, `beforeSuperClass`,
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
      if (extending) {
        throw new Error(`The module ${className} is not defined. Referenced in ${extending.__meta.name}.`);
      } else {
        throw new Error(`The module ${className} is not defined.`);
      }
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

    const {
      that,
      steps
    } = createPrep(className);

    const options = {};

    // Everything in Apostrophe appreciates self.options being
    // a thing already after create is complete
    that.options = options;

    // Now we want to start from the base class and go down
    steps.reverse();

    // Actually just the apos object merging in, app.js merging was handled elsewhere
    Object.assign(options, _options || {});

    self.options.sections = self.options.sections || [];
    self.options.unparsedSections = self.options.unparsedSections || [];

    const validKeys = [ '__meta', 'options', 'cascades', 'beforeSuperClass', 'init', 'afterAllSections', 'extend', 'improve', 'methods', 'extendMethods' ]
      .concat(self.options.sections)
      .concat(self.options.sections.map(getExtendKey))
      .concat(self.options.unparsedSections)
      .concat(self.options.unparsedSections.map(getExtendKey));

    const upgradeHints = {
      construct: 'in Apostrophe 3.x, "construct" has been replaced with "methods", "routes", "apiRoutes", etc.',
      beforeConstruct: 'in Apostrophe 3.x, "beforeConstruct" has been replaced with "beforeSuperClass". It takes (self, options) and should be solely concerned with modifying the options before the base class sees them. It must be synchronous. Check out the new fields section, you might not need beforeSuperClass.',
      afterConstruct: 'in Apostrophe 3.x, "afterConstruct" has been replaced with "init". It takes (self, options) and may be an async function.'
    };

    for (const step of steps) {
      Object.assign(options, step.options || {});
    }

    let cascades = [];
    for (const step of steps) {
      if (step.cascades) {
        cascades = cascades.concat(step.cascades);
      }
      for (const key of Object.keys(step)) {
        if (!(validKeys.includes(key) || cascades.includes(key))) {
          const message = upgradeHints[key] || `${key} is not a valid top level property for an Apostrophe 3.x module. Make sure you nest regular module options in the new "options" property.`;
          throw `${clarifyModuleName(step.__meta.name)}: ${message}`;
        }
      }

      for (const cascade of cascades) {
        if (!that[cascade]) {
          that[cascade] = {};
        }
        if (!that[`${cascade}Groups`]) {
          that[`${cascade}Groups`] = {};
        }
        // You can have access to options within a function, if you choose to provide one
        const properties = ((typeof step[cascade]) === 'function') ? step[cascade](that, options) : step[cascade];
        if (properties) {
          const valid = [ 'add', 'remove', 'group' ];
          if (properties.add) {
            that[cascade] = {
              ...that[cascade],
              ...properties.add
            };
          }
          if (properties.remove) {
            for (const field of properties.remove) {
              delete that[cascade][field];
            }
          }
          if (properties.group) {
            that[`${cascade}Groups`] = {
              ...that[`${cascade}Groups`],
              ...properties.group
            };
          }
          for (const key of Object.keys(properties)) {
            if (!valid.includes(key)) {
              throw `${clarifyModuleName(step.__meta.name)}: ${key} is not valid inside "${cascade}".\nPossibly you forgot to nest a field in "add".`;
            }
          }
        }
      }
    }

    // This needs to be after the options and cascades are compiled so it can manipulate
    // the result, yet we've already reordered the steps with the superclass first,
    // so walk them backwards to implement beforeSuperClass
    for (let i = (steps.length - 1); (i >= 0); i--) {
      const step = steps[i];
      if (step.beforeSuperClass) {
        step.beforeSuperClass(that, options);
      }
    }

    // Always build methods first so they can be referenced safely
    // in other sections
    build(null, 'methods');

    // Unparsed sections, like `queries` and `extendQueries`. These are just captured
    // in an object with the props from each level so the module can do something with
    // them at runtime, useful for instantiating cursors. Do it before init so that init
    // can carry out queries with cursors
    (self.options.unparsedSections || []).forEach(section => capture(section));

    // init is called BEFORE routes etc. are called so that the section functions
    // for those things can benefit from methods, properties, etc. set by init
    // when deciding what to return
    for (const step of steps) {
      if (step.init) {
        await step.init(that, options);
      }
    }

    // helpers, eventHandlers, apiRoutes, renderRoutes, whatever comes up
    (self.options.sections || []).forEach(section => build(section, section));

    // afterAllSections is called last and has access to self.routes, etc.
    // For project-level developers this is usually not important, but
    // the core does call certain methods in the @apostrophecms/modules base class
    // implementation of afterAllSections to actually add the routes and handlers
    // to the system
    for (const step of steps) {
      if (step.afterAllSections) {
        await step.afterAllSections(that, options);
      }
    }

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
          if (Array.isArray(step[keyword])) {
            // If an array of method names is passed rather than an object,
            // add helper functions that invoke the methods of the same name.
            // Helpers in particular are often also needed as methods and it
            // is tedious to wrap them all by hand. Doing it this way ensures
            // that extendHelpers will behave sensibly
            const methods = step[keyword];
            step[keyword] = function(self, options) {
              const wrapped = {};
              methods.forEach(method => {
                wrapped[method] = function(...rest) {
                  return self[method](...rest);
                };
              });
              return wrapped;
            };
          }
          if ((typeof step[keyword]) !== 'function') {
            throw stepError(step, `${keyword} must be a function that takes (self, options) and returns an object`);
          }
          _.merge(context, step[keyword](that, options));
        }
        const extend = getExtendKey(keyword);
        if (step[extend]) {
          if ((typeof step[extend]) !== 'function') {
            throw stepError(step, `${extend} must be a function that takes (self, options) and returns an object`);
          }
          const extensions = step[extend](that, options);
          wrap(context, extensions);
        }
      }
    }

    return that;

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
          superMethod = context[name][context[name].length - 1];
          context[name][context[name].length - 1] = function() {
            return fn.apply(that, [ superMethod, ...arguments ]);
          };
        } else {
          superMethod = context[name];
          context[name] = function() {
            return fn.apply(that, [ superMethod, ...arguments ]);
          };
        }
      });
    }

    function capture(section) {
      that[section] = {};
      for (const step of steps) {
        that[section][step.__meta.name] = step[section];
      }
    }

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

  function createPrep(className) {

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
    that.__meta = {
      chain: [],
      name: className
    };
    let i = steps.length - 1;
    while (i >= 0) {
      that.__meta.chain.push(steps[i].__meta);
      i--;
    }

    return {
      that,
      steps
    };
  }

};

function getExtendKey(keyword) {
  return 'extend' + keyword.charAt(0).toUpperCase() + keyword.slice(1);
}

function clarifyModuleName(original) {
  const name = original.replace(/^my-/, '').replace(/^(@[^/]+\/)my-(.*)$/, '$1$2');
  if (name !== original) {
    return `${name} (project level)`;
  }
  return name;
}

function stepError(step, message) {
  throw new Error(`${clarifyModuleName(step.__meta.name)}: ${message}`);
}
