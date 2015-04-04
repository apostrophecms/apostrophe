(function() {
  var async, _;

  if (typeof module !== 'undefined') {
    // For npm
    async = require('async');
    _ = require('lodash');
  } else {
    // Works in browser if async and _ are already global
    async = window.async;
    _ = window._;
  }

  function afterYield(fn) {
    if (typeof setImmediate !== 'undefined') {
      return setImmediate(fn);
    } else {
      return setTimeout(fn, 0);
    }
  };

  function moog(options) {

    options = options || {};

    var self = {};

    self.options = options;

    self.definitions = {};

    self.ordinal = 0;

    // The "extending" argument is of interest to subclasses like
    // moog-require that need to know about relative paths. Must
    // return the new definition for the convenience of moog-require too

    self.define = function(type, definition, extending) {
      // Define many in a single call
      if (typeof(type) === 'object') {
        // Apply any definitions passed directly to the factory function
        _.each(type || {}, function(definition, name) {
          self.define(name, definition);
        });
        return;
      }

      if (!definition) {
        // This can happen because we use self.define as an autoloader
        // when resolving "extend". The moog-require module overloads
        // self.define to handle this case
        throw new Error(new Error('The type ' + type + ' is not defined.'));
      }
      definition.__meta = definition.__meta || {};
      definition.__meta.name = type;
      definition.__meta.ordinal = self.ordinal++;

      if (!extending) {
        definition.__meta.explicit = true;
      }

      var exists = _.has(self.definitions, type);
      if (definition.extendIfFirst && (!exists)) {
        definition.extend = definition.extendIfFirst;
      }

      if ((!definition.extend) && (definition.extend !== false)) {
        if (exists) {
          // Double definitions result in implicit subclassing of
          // the original definition by the new one; anything else
          // trying to access this type name will see
          // the resulting subclass via self.definitions. However
          // we reset the __name property for the benefit of
          // implementations that need to distinguish assets that
          // come from each subclass in the inheritance chain.
          definition.extend = self.definitions[type];
          definition.__meta.name = 'my-' + definition.__meta.name;
        } else {
          // Extend the default base class by default, if any, unless
          // we're it
          if (self.options.defaultBaseClass && type !== self.options.defaultBaseClass) {
            definition.extend = self.options.defaultBaseClass;
          }
        }
      }
      self.definitions[type] = definition;
      return definition;
    };

    self.redefine = function(type, definition) {
      delete self.definitions[type];
      return self.define(type, definition);
    };

    self.isDefined = function(type) {
      if (_.has(self.definitions, type)) {
        return true;
      }
      try {
        // Can we autoload it?
        self.define(type);
        // Yes, but we don't really want it yet
        delete self.definitions[type];
        return true;
      } catch (e) {
        return false;
      }
    };

    // Create an instance
    self.create = function(type, options, callback) {

      // Careful, allow skipping the options argument and also
      // invoking synchronously with no callback in any combination
      if (arguments.length === 1) {
        options = {};
      } else if (arguments.length === 2) {
        if (typeof(arguments[1]) === 'function') {
          callback = arguments[1];
          options = {};
        }
      }
      options = options || {};

      var definition;

      var that = {};
      var steps = [];
      var seen = {};
      var next = self.definitions[type];
      if (!next) {
        if (!callback) {
          throw 'The type ' + type + ' is not defined.';
        } else {
          return callback(new Error('The type ' + type + ' is not defined.'));
        }
      }
      while (next) {
        var current = next;
        if (_.has(seen, current.__meta.ordinal)) {
          var error = new Error('The type ' + type + ' encounters an infinite loop, "extend" probably points back to itself or its subclass.');
          if (callback) {
            return callback(error);
          }
          throw error;
        }
        seen[current.__meta.ordinal] = true;
        steps.push(current);
        next = current.extend;
        // In most cases it'll be a string we need to look up
        // in self.definitions. In a few cases it is already
        // a pointer to another definition (see double defines, above)
        if (typeof(next) === 'string') {
          var nextName = next;
          next = self.definitions[nextName];
          if (!next) {
            try {
              // Try to use define as an autoloader. This will fail in
              // the default implementation
              next = self.define(nextName, undefined, current);
            } catch (e) {
              return callback(e);
            }
          }
        }
      }

      if (!callback) {
        return createSync();
      } else {
        return createAsync();
      }

      function createSync() {
        _.each(steps, function(step) {
          applyOptions(step);
          if (step.beforeConstruct) {
            if (step.beforeConstruct.length === 3) {
              throw new Error('moog.create was called synchronously for the type ' + type + ', but the ' + step.__name + ' class has an asynchronous beforeConstruct method. You must provide a callback to create.');
            }
            step.beforeConstruct(that, options);
          }
        });

        // Now we want to start from the base class and go down
        steps.reverse();

        // Also attach metadata about the modules in the
        // inheritance chain, base class first
        that.__meta = { chain: [], name: type };

        _.each(steps, function(step) {
          that.__meta.chain.push(step.__meta);
        });

        _.each(steps, function(step) {
          if (step.construct) {
            if (step.construct.length === 3) {
              throw new Error('moog.create was called synchronously for the type ' + type + ', but the ' + step.__name + ' class has an asynchronous construct method. You must provide a callback to create.');
            }
            step.construct(that, options);
          }
        });

        _.each(steps, function(step) {
          if (step.afterConstruct) {
            if (step.afterConstruct.length === 3) {
              throw new Error('moog.create was called synchronously for the type ' + type + ', but the ' + step.__name + ' class has an asynchronous afterConstruct method. You must provide a callback to create.');
            }
            step.afterConstruct(that);
          }
        });

        return that;
      }

      function createAsync() {
        return async.series({
          beforeConstruct: function(callback) {
            return async.eachSeries(steps, function(step, callback) {

              applyOptions(step);

              // Invoke beforeConstruct, defaulting to an empty one
              var beforeConstruct = step.beforeConstruct || function(self, options, callback) { return afterYield(callback); };
              // Turn sync into async
              if (beforeConstruct.length === 2) {
                var syncBeforeConstruct = beforeConstruct;
                beforeConstruct = function(self, options, callback) {
                  try {
                    syncBeforeConstruct(self, options);
                  } catch (e) {
                    return afterYield(_.partial(callback, e));
                  }
                  return afterYield(callback);
                };
              }
              if (beforeConstruct.length < 3) {
                return callback(new Error('beforeConstruct must take the following arguments: "self", "options", and (if it is async) "callback"'));
              }

              return beforeConstruct(that, options, callback);
            }, callback);
          },
          construct: function(callback) {
            // Now we want to start from the base class and go down
            steps.reverse();

            // Also attach metadata about the modules in the
            // inheritance chain, base class first
            that.__meta = { chain: [], name: type };

            _.each(steps, function(step) {
              that.__meta.chain.push(step.__meta);
            });

            return async.eachSeries(steps, function(step, callback) {
              // Invoke construct, defaulting to an empty one
              var construct = step.construct || function(self, options, callback) { return afterYield(callback); };

              // Turn sync into async
              if (construct.length === 2) {
                var syncConstruct = construct;
                construct = function(self, options, callback) {
                  try {
                    syncConstruct(self, options);
                  } catch (e) {
                    return afterYield(_.partial(callback, e));
                  }
                  return afterYield(callback);
                };
              }
              if (construct.length < 3) {
                return callback(new Error('construct must take the following arguments: "self", "options", and (if it is async) "callback"'));
              }
              return construct(that, options, callback);
            }, callback);
          },
          afterConstruct: function(callback) {

            return async.eachSeries(steps, function(step, callback) {
              // Invoke afterConstruct, defaulting to an empty one
              var afterConstruct = step.afterConstruct || function(self, callback) { return afterYield(callback); };

              // Turn sync into async
              if (afterConstruct.length === 1) {
                var syncAfterConstruct = afterConstruct;
                afterConstruct = function(self, callback) {
                  try {
                    syncAfterConstruct(self);
                  } catch (e) {
                    return afterYield(_.partial(callback, e));
                  }
                  return afterYield(callback);
                };
              }
              if (afterConstruct.length < 2) {
                return callback(new Error('afterConstruct must take the following arguments: "self", and (if it is async) "callback"'));
              }
              return afterConstruct(that, callback);
            }, callback);
          }
        }, function(err) {
          if (err) {
            return callback(err);
          }
          return callback(null, that);
        });
      }

      function applyOptions(step) {
        // Apply the simple option defaults
        _.each(step, function(val, key) {
          if ((key === 'construct') || (key === 'extend') || (key === 'beforeConstruct')) {
            return;
          }
          if (key.substr(0, 2) === '__') {
            return;
          }
          if (_.has(options, key)) {
            return;
          }
          options[key] = val;
        });
      }

    };

    self.createAll = function(globalOptions, specificOptions, callback) {
      var result = {};
      var defined = _.keys(self.definitions);
      var explicit = _.filter(defined, function(type) {
        return self.definitions[type].__meta.explicit = true;
      });

      if (callback) {
        return createAllAsync();
      } else {
        return createAllSync();
      }

      function createAllAsync() {
        return async.eachSeries(
          explicit,
          function(name, callback) {
            var options = applyOptions(name);
            return self.create(name, options, function(err, obj) {
              if (err) {
                return callback(err);
              }
              result[name] = obj;
              return callback(null);
            });
          },
          function(err) {
            if (err) {
              return callback(err);
            }
            return callback(null, result);
          }
        );
      }

      function createAllSync() {
        var result = {};
        _.each(explicit, function(name) {
          var options = applyOptions(name);
          result[name] = self.create(name, options);
        });
        return result;
      }

      function applyOptions(name) {
        var options = {};
        _.extend(options, globalOptions);
        if (_.has(specificOptions, name)) {
          _.extend(options, specificOptions[name]);
        }
        return options;
      }
    };

    self.bridge = function(modules) {
      return _.each(modules, function(module) {
        if (module.setBridge) {
          module.setBridge(modules);
        }
      });
    }

    return self;

  };

  if (typeof module !== 'undefined') {
    module.exports = moog;
  } else {
    window.moog = moog;
  }
})();

