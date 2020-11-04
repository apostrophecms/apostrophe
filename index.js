const path = require('path');
const _ = require('lodash');
const argv = require('yargs').argv;
const fs = require('fs');
const npmResolve = require('resolve');
let defaults = require('./defaults.js');

// **Awaiting the Apostrophe function is optional**
//
// The apos function is async, but in typical cases you do not
// need to await it. If you simply call it, Apostrophe will
// start up and listen for connections forever, or run a
// task and exit, as appropriate. On failure, the error is
// printed to stderr and the process exits.
//
// If you do `await` the function, then your code will continue
// after apostrophe successfully begins listening for
// connections. However note it will still exit on errors.
//
// To avoid exiting on errors, pass the `exit: false` option.
// This can option also can be used to allow awaiting a command line
// task, as they also normally exit on completion.

module.exports = async function(options) {

  // The core is not a true moog object but it must look enough like one
  // to participate as an async event emitter
  const self = {
    __meta: {
      name: 'apostrophe'
    }
  };

  try {
    const matches = process.version.match(/^v(\d+)/);
    const version = parseInt(matches[1]);
    if (version < 12) {
      throw new Error('Apostrophe 3.x requires at least Node.js 12.x.');
    }
    // The core must have a reference to itself in order to use the
    // promise event emitter code
    self.apos = self;

    Object.assign(self, require('./modules/@apostrophecms/module/lib/events.js')(self, options));

    // Determine root module and root directory
    self.root = options.root || getRoot();
    self.rootDir = options.rootDir || path.dirname(self.root.filename);
    self.npmRootDir = options.npmRootDir || self.rootDir;

    testModule();

    self.options = mergeConfiguration(options, defaults);
    autodetectBundles();
    acceptGlobalOptions();

    // Module-based async events (self.on and self.emit of each module,
    // handlers are usually registered via `handlers` in the module
    // definition rather than `self.on`)
    self.eventHandlers = {};

    // Destroys the Apostrophe object, freeing resources such as
    // HTTP server ports and database connections. Does **not**
    // delete any data; the persistent database and media files
    // remain available for the next startup. Emits the
    // `apostrophe:destroy` async event; use this mechanism to free your own
    // server-side resources that could prevent garbage
    // collection by the JavaScript engine, such as timers
    // and intervals.
    self.destroy = async function() {
      await self.emit('destroy');
    };

    // Returns true if Apostrophe is running as a command line task
    // rather than as a server
    self.isTask = function() {
      return !!self.argv._.length;
    };

    // Returns an array of modules that are instances of the given
    // module name, i.e. they are of that type or they extend it.
    // For instance, `apos.instancesOf('@apostrophecms/piece-type')` returns
    // an array of active modules in your project that extend
    // pieces, such as `@apostrophecms/user` and
    // your own piece types

    self.instancesOf = function(name) {
      return _.filter(self.modules, function(module) {
        return self.synth.instanceOf(module, name);
      });
    };

    // Returns true if the object is an instance of the given
    // moog class name or a subclass thereof. A convenience wrapper
    // for `apos.synth.instanceOf`

    self.instanceOf = function(object, name) {
      return self.synth.instanceOf(object, name);
    };

    defineModules();

    await instantiateModules();
    lintOrphanModules();
    await self.emit('modulesReady');
    await self.emit('afterInit');
    await self.emit('run', self.isTask());

    return self;
  } catch (e) {
    if (options.exit !== false) {
      /* eslint-disable-next-line no-console */
      console.error(e);
      process.exit(1);
    }
  }

  // SUPPORTING FUNCTIONS BEGIN HERE

  // Merge configuration from defaults, data/local.js and app.js
  function mergeConfiguration(options, defaults) {
    let config = {};
    let local = {};
    const localPath = options.__localPath || '/data/local.js';
    const reallyLocalPath = self.rootDir + localPath;

    if (fs.existsSync(reallyLocalPath)) {
      local = require(reallyLocalPath);
    }

    // Otherwise making a second apos instance
    // uses the same modified defaults object

    config = _.cloneDeep(options.__testDefaults || defaults);

    _.merge(config, options);

    if (typeof (local) === 'function') {
      if (local.length === 1) {
        _.merge(config, local(self));
      } else if (local.length === 2) {
        local(self, config);
      } else {
        throw new Error('data/local.js may export an object, a function that takes apos as an argument and returns an object, OR a function that takes apos and config as objects and directly modifies config');
      }
    } else {
      _.merge(config, local || {});
    }

    return config;
  }

  function getRoot() {
    let _module = module;
    let m = _module;
    while (m.parent) {
      // The test file is the root as far as we are concerned,
      // not mocha itself
      if (m.parent.filename.match(/\/node_modules\/mocha\//)) {
        return m;
      }
      m = m.parent;
      _module = m;
    }
    return _module;
  }

  function autodetectBundles() {
    const modules = _.keys(self.options.modules);
    _.each(modules, function(name) {
      const path = getNpmPath(name);
      if (!path) {
        return;
      }
      const module = require(path);
      if (module.moogBundle) {
        self.options.bundles = (self.options.bundles || []).concat(name);
        _.each(module.moogBundle.modules, function(name) {
          if (!_.has(self.options.modules, name)) {
            const bundledModule = require(require('path').dirname(path) + '/' + module.moogBundle.directory + '/' + name);
            if (bundledModule.improve) {
              self.options.modules[name] = {};
            }
          }
        });
      }
    });
  }

  function getNpmPath(name) {
    const parentPath = path.resolve(self.npmRootDir);
    try {
      return npmResolve.sync(name, { basedir: parentPath });
    } catch (e) {
      // Not found via npm. This does not mean it doesn't
      // exist as a project-level thing
      return null;
    }
  }

  function acceptGlobalOptions() {
    // Truly global options not specific to a module
    if (options.testModule) {
      // Test command lines have arguments not
      // intended as command line task arguments
      self.argv = {
        _: []
      };
      self.options.shortName = self.options.shortName || 'test';
    } else if (options.argv) {
      // Allow injection of any set of command line arguments.
      // Useful with multiple instances
      self.argv = options.argv;
    } else {
      self.argv = argv;
    }

    self.shortName = self.options.shortName;
    if (!self.shortName) {
      throw 'Specify the `shortName` option and set it to the name of your project\'s repository or folder';
    }
    self.title = self.options.title;
    self.baseUrl = self.options.baseUrl;
    self.prefix = self.options.prefix || '';
  }

  // Tweak the Apostrophe environment suitably for
  // unit testing a separate npm module that extends
  // Apostrophe, like @apostrophecms/workflow. For instance,
  // a node_modules subdirectory with a symlink to the
  // module itself is created so that the module can
  // be found by Apostrophe during testing. Invoked
  // when options.testModule is true. There must be a
  // test/ or tests/ subdir of the module containing
  // a test.js file that runs under mocha via devDependencies.

  function testModule() {
    if (!options.testModule) {
      return;
    }
    if (!options.shortName) {
      options.shortName = 'test';
    }
    defaults = _.cloneDeep(defaults);
    _.defaults(defaults, {
      '@apostrophecms/express': {}
    });
    _.defaults(defaults['@apostrophecms/express'], {
      port: 7900,
      secret: 'irrelevant'
    });
    const m = findTestModule();
    // Allow tests to be in test/ or in tests/
    const testDir = require('path').dirname(m.filename);
    const moduleDir = testDir.replace(/\/tests?$/, '');
    if (testDir === moduleDir) {
      throw new Error('Test file must be in test/ or tests/ subdirectory of module');
    }
    if (!fs.existsSync(testDir + '/node_modules')) {
      fs.mkdirSync(testDir + '/node_modules');
      fs.symlinkSync(moduleDir, testDir + '/node_modules/' + require('path').basename(moduleDir), 'dir');
    }

    // Not quite superfluous: it'll return self.root, but
    // it also makes sure we encounter mocha along the way
    // and throws an exception if we don't
    function findTestModule() {
      let m = module;
      while (m) {
        if (m.parent && m.parent.filename.match(/node_modules\/mocha/)) {
          return m;
        }
        m = m.parent;
        if (!m) {
          throw new Error('mocha does not seem to be running, is this really a test?');
        }
      }
    }
  }

  function defineModules() {
    // Set moog-require up to create our module manager objects

    self.localModules = self.options.modulesSubdir || self.options.__testLocalModules || (self.rootDir + '/modules');
    const synth = require('./lib/moog-require')({
      root: self.root,
      bundles: [ 'apostrophe' ].concat(self.options.bundles || []),
      localModules: self.localModules,
      defaultBaseClass: '@apostrophecms/module',
      sections: [ 'helpers', 'handlers', 'routes', 'apiRoutes', 'restApiRoutes', 'renderRoutes', 'middleware', 'customTags', 'components' ],
      unparsedSections: [ 'queries', 'extendQueries' ]
    });

    self.synth = synth;

    // Just like on the browser side, we can
    // call apos.define rather than apos.synth.define
    self.define = self.synth.define;
    self.redefine = self.synth.redefine;
    self.create = self.synth.create;

    _.each(self.options.modules, function(options, name) {
      synth.define(name, options);
    });

    return synth;
  }

  async function instantiateModules() {
    self.modules = {};
    for (const item of _.keys(self.options.modules)) {
      const improvement = self.synth.isImprovement(item);
      if (self.options.modules[item] && (improvement || self.options.modules[item].instantiate === false)) {
        // We don't want an actual instance of this module, we are using it
        // as an abstract base class in this particular project (but still
        // configuring it, to easily carry those options to subclasses, which
        // is how we got here)
        continue;
      }
      // module registers itself in self.modules
      await self.synth.create(item, { apos: self });
    }
  }

  function lintOrphanModules() {
    const validSteps = [];
    for (const module of Object.values(self.modules)) {
      for (const step of module.__meta.chain) {
        validSteps.push(step.name);
      }
    }
    const dirs = fs.readdirSync(self.localModules);
    for (const dir of dirs) {
      if (dir.match(/^@/)) {
        const nsDirs = fs.readdirSync(`${self.localModules}/${dir}`);
        for (let nsDir of nsDirs) {
          nsDir = `${dir}/${nsDir}`;
          test(nsDir);
        }
      } else {
        test(dir);
      }
    }
    function test(name) {
      if (!validSteps.includes(name)) {
        if (name.match(/^apostrophe-/)) {
          warn('namespace-apostrophe-modules', `You have a ${self.localModules}/${name} folder. You are probably trying to configure an official Apostrophe module, but those are namespaced now. Your directory should be renamed ${self.localModules}/${name.replace(/^apostrophe-/, '@apostrophecms/')}\n\nIf you get this warning for your own, original module, do not use the apostrophe- prefix. It is reserved.`);
        } else {
          warn('orphan-modules', `You have a ${self.localModules}/${name} folder, but that module is not activated in app.js and it is not a base class of any other active module. Right now that code doesn't do anything.`);
        }
      }
      function warn(name, message) {
        if (self.utils) {
          self.utils.warnDevOnce(name, message);
        } else {
          // apos.util not in play, this can be the case in our bootstrap tests
          if (self.argv[`ignore-${name}`]) {
            return;
          }
          /* eslint-disable-next-line no-console */
          console.warn(message);
        }
      }
    }
  }

};

const abstractClasses = [ '@apostrophecms/module', '@apostrophecms/widget-type', '@apostrophecms/page-type', '@apostrophecms/piece-type', '@apostrophecms/piece-page-type', '@apostrophecms/doc-type' ];

module.exports.moogBundle = {
  modules: abstractClasses.concat(_.keys(defaults.modules)),
  directory: 'modules'
};
