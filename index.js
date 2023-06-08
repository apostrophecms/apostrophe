// this should be loaded first
const opentelemetry = require('./lib/opentelemetry');
const path = require('path');
const _ = require('lodash');
const argv = require('boring')({ end: true });
const fs = require('fs');
const { stripIndent } = require('common-tags');
const cluster = require('cluster');
const { cpus } = require('os');
const process = require('process');
const npmResolve = require('resolve');
const glob = require('glob');

let defaults = require('./defaults.js');

// ## Top-level options
//
// `cluster`
//
// If set to `true`, Apostrophe will spawn as many processes as
// there are CPU cores on the server, or a minimum of 2, and balance
// incoming connections among them. This ensures availability while one
// process is restarting due to a crash and also increases scalability if
// the server has multiple CPU cores.
//
// If set to an object with a `processes` property, that many
// processes are started. If `processes` is 0 or a negative number,
// it is added to the number of CPU cores reported by the server.
// Notably, `-1` can be a good way to reserve one CPU core for MongoDB
// in a single-server deployment.
//
// However when in cluster mode no fewer than 2 processes will be
// started as there is no availability benefit without at least 2.
//
// If a child process exits with a failure status code it will be
// restarted. However, if it exits in less than 20 seconds after
// startup there will be a 20 second delay to avoid flooding logs
// and pinning the CPU.
//
// Alternatively the `APOS_CLUSTER_PROCESSES` environment variable
// can be set to a number, which will effectively set the cluster
// option to `cluster: { processes: n }`.
//
// `openTelemetryProvider`
//
// If set, Apostrophe will register it as a global OpenTelemetry tracer provider.
// The expected value is an object, an instance of TracerProvider.
// If the Node SDK is used in the application instead of manual configuration,
// the provider instance is only available as a
// private property: `sdkInstance._tracerProvider`. An issue can be opened
// to discuss the exposure of a public getter with the OpenTelemetry developers.
//
// `beforeExit`
//
// If set, Apostrophe will invoke it (await) before invoking process.exit.
// `beforeExit` may be an async function, will be awaited, and takes no arguments.
//
// `pnpm`
// A boolean to force on or off the pnpm related build routines. If not set,
// an automated check will be performed to determine if pnpm is in use. We offer
// an option, because automated check is not 100% reliable. Monorepo tools are
// often hiding package management specifics (lock files, node_module structure, etc.)
// in a centralized store.
//
// ## Awaiting the Apostrophe function
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
//
// If `options.cluster` is truthy, the function quickly resolves to
// `null` in the primary process. In the child process it resolves as
// documented above.

// The actual entry point, a wrapper that enables the telemetry and starts the
// root span
module.exports = async function(options) {
  const telemetry = opentelemetry(options);
  let spanName = 'apostrophe:boot';
  const guardTime = 20000;

  // Detect cluster options
  if (process.env.APOS_CLUSTER_PROCESSES) {
    options.cluster = {
      processes: parseInt(process.env.APOS_CLUSTER_PROCESSES)
    };
  }
  if (options.cluster && (process.env.NODE_ENV !== 'production')) {
    console.log('NODE_ENV is not set to production, disabling cluster mode');
    options.cluster = false;
  }

  // Execute if cluster enabled
  if (options.cluster && !argv._.length) {
    // For bc with node 14 and below we need to check both
    if (cluster.isPrimary || cluster.isMaster) {
      // Activate and return the callback return value
      return telemetry.startActiveSpan(`${spanName}:primary`, async (span) => {
        let processes = options.cluster.processes || cpus().length;
        if (processes <= 0) {
          processes = cpus().length + processes;
        }
        let capped = '';
        if (processes > cpus().length) {
          processes = cpus().length;
          capped = ' (capped to number of CPU cores)';
        }
        if (processes < 2) {
          processes = 2;
          if (capped) {
            capped = ' (less than 2 cores, capped to minimum of 2)';
          } else {
            capped = ' (using minimum of 2)';
          }
        }
        console.log(`Starting ${processes} cluster child processes${capped}`);
        for (let i = 0; i < processes; i++) {
          clusterFork();
        }
        cluster.on('exit', (worker, code, signal) => {
          if (code !== 0) {
            if ((Date.now() - worker.bornAt) < guardTime) {
              console.error(`Worker process ${worker.process.pid} failed in ${seconds(Date.now() - worker.bornAt)}, waiting ${seconds(guardTime)} before restart`);
              setTimeout(() => {
                respawn(worker);
              }, guardTime);
            } else {
              respawn(worker);
            }
          }
        });
        span.end();
        if (typeof options.beforeExit === 'function') {
          await options.beforeExit();
        }
        return null;
      });
    } else {
      // continue as a worker operation, the pid should be recorded by the auto instrumentation
      spanName += ':worker';
      console.log(`Cluster worker ${process.pid} started`);
    }
  }

  // Create and activate the root span for the boot tracer
  const self = await telemetry.startActiveSpan(spanName, async (span) => {
    const res = await apostrophe(options, telemetry, span);
    span.setStatus(telemetry.api.SpanStatusCode.OK);
    span.end();
    return res;
  });

  return self;
};

// The actual apostrophe bootstrap
async function apostrophe(options, telemetry, rootSpan) {
  // The core is not a true moog object but it must look enough like one
  // to participate as an async event emitter
  const self = {
    __meta: {
      name: 'apostrophe'
    }
  };

  // Terminates the process. Emits the `apostrophe:beforeExit` async event;
  // use this mechanism to invoke any pre-exit application level tasks. Any
  // `beforeExit` handler errors will be ignored.
  // Invokes and awaits `options.beforeExit` function if available,
  // passing as arguments the exit code and message (if any).
  self._exit = async function(code = 0, message) {
    try {
      if (self.emit) {
        await self.emit('beforeExit');
      }
    } catch (e) {
      // we are at the point where errors are ignored,
      // if emitter is already registered, all handler errors
      // are already recorded by the event module instrumentation
      console.error('beforeExit emit error', e);
    }

    if (code !== 0) {
      telemetry.handleError(rootSpan, message);
    } else {
      rootSpan.setStatus({
        code: telemetry.api.SpanStatusCode.OK,
        message
      });
    }
    rootSpan.end();

    if (typeof options.beforeExit === 'function') {
      try {
        await options.beforeExit(code, message);
      } catch (e) {
        console.error('beforeExit handler error', e);
      }
    }
    process.exit(code);
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

    // Register the telemetry API as a pseudo module
    self.apos.telemetry = telemetry;

    Object.assign(self, require('./modules/@apostrophecms/module/lib/events.js')(self));

    // Determine root module and root directory
    self.root = options.root || getRoot();
    self.rootDir = options.rootDir || path.dirname(self.root.filename);
    self.npmRootDir = options.npmRootDir || self.rootDir;
    self.selfDir = __dirname;
    // Signals to various (build related) places that we are running a pnpm installation.
    // The relevant option, if set, has a higher precedence over the automated check.
    self.isPnpm = options.pnpm ??
      fs.existsSync(path.join(self.npmRootDir, 'pnpm-lock.yaml'));

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

    // So the asset module can figure out what other modules
    // are out there and what icons they need without
    // actually instantiating them
    self.modulesToBeInstantiated = modulesToBeInstantiated;
    self.eventAliases = {};
    self.aliasEvent('modulesReady', 'modulesRegistered');
    self.aliasEvent('afterInit', 'ready');

    defineModules();

    await instantiateModules();
    lintModules();
    await self.emit('modulesRegistered'); // formerly modulesReady
    self.apos.schema.validateAllSchemas();
    self.apos.schema.registerAllSchemas();
    await self.apos.lock.withLock('@apostrophecms/migration:migrate', async () => {
      await self.apos.migration.migrate(); // emits before and after events, inside the lock
      // Inserts the global doc in the default locale if it does not exist; same for other
      // singleton piece types registered by other modules
      for (const module of Object.values(self.modules)) {
        if (self.instanceOf(module, '@apostrophecms/piece-type') && module.options.singletonAuto) {
          await module.insertIfMissing();
        }
      }
      await self.apos.page.implementParkAllInDefaultLocale();
      await self.apos.doc.replicate(); // emits beforeReplicate and afterReplicate events
      // Replicate will have created the parked pages across locales if needed, but we may
      // still need to reset parked properties
      await self.apos.page.implementParkAllInOtherLocales();
    });
    await self.emit('ready'); // formerly afterInit

    if (self.taskRan) {
      await self._exit();
    } else {
      const after = { exit: null };
      await self.emit('run', self.isTask(), after);
      if (after.exit !== null) {
        await self._exit(after.exit);
      }
    }

    return self;
  } catch (e) {
    if (options.exit !== false) {
      console.error(e);
      await self._exit(1, e);
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
    while (m.parent && m.parent.filename) {
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

  function nestedModuleSubdirs() {
    if (!options.nestedModuleSubdirs) {
      return;
    }
    const configs = glob.sync(self.localModules + '/**/modules.js', { follow: true });
    _.each(configs, function(config) {
      try {
        _.merge(self.options.modules, require(config));
      } catch (e) {
        console.error(stripIndent`
          When nestedModuleSubdirs is active, any modules.js file beneath:

          ${self.localModules}

          must export an object containing configuration for Apostrophe modules.

          The file:

          ${config}

          did not parse.
        `);
        throw e;
      }
    });
  }

  function autodetectBundles() {
    const modules = _.keys(self.options.modules);
    _.each(modules, function(name) {
      const path = getNpmPath(name);
      if (!path) {
        return;
      }
      const module = require(path);
      if (module.bundle) {
        self.options.bundles = (self.options.bundles || []).concat(name);
        _.each(module.bundle.modules, function(name) {
          if (!_.has(self.options.modules, name)) {
            const bundledModule = require(require('path').dirname(path) + '/' + module.bundle.directory + '/' + name);
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
    // Environment variable override
    self.options.baseUrl = process.env.APOS_BASE_URL || self.options.baseUrl;
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
  // If `options.testModule` is a string it will be used as a
  // namespace for the test module.

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

    const pkgName = require(`${moduleDir}/package.json`).name;
    let pkgNamespace = '';
    if (pkgName.includes('/')) {
      const parts = pkgName.split('/');
      pkgNamespace = '/' + parts.slice(0, parts.length - 1).join('/');
    }

    if (!fs.existsSync(testDir + '/node_modules')) {
      fs.mkdirSync(testDir + '/node_modules' + pkgNamespace, { recursive: true });
      fs.symlinkSync(moduleDir, testDir + '/node_modules/' + pkgName, 'dir');
    }

    // Not quite superfluous: it'll return self.root, but
    // it also makes sure we encounter mocha along the way
    // and throws an exception if we don't
    function findTestModule() {
      let m = module;
      const nodeModuleRegex = new RegExp(`node_modules${path.sep}mocha`);
      if (!require.main.filename.match(nodeModuleRegex)) {
        throw new Error('mocha does not seem to be running, is this really a test?');
      }
      while (m) {
        if (m.parent && m.parent.filename.match(nodeModuleRegex)) {
          return m;
        } else if (!m.parent) {
          // Mocha v10 doesn't inject mocha paths inside `module`, therefore, we only detect the parent until the last parent. But we can get Mocha running using `require.main` - Amin
          return m;
        }
        m = m.parent;
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
      sections: [ 'helpers', 'handlers', 'routes', 'apiRoutes', 'restApiRoutes', 'renderRoutes', 'middleware', 'customTags', 'components', 'tasks' ],
      nestedModuleSubdirs: self.options.nestedModuleSubdirs,
      unparsedSections: [
        'queries',
        'extendQueries',
        'icons',
        'i18n',
        'webpack',
        'commands'
      ]
    });

    self.synth = synth;

    // Just like on the browser side, we can
    // call apos.define rather than apos.synth.define
    self.define = self.synth.define;
    self.redefine = self.synth.redefine;
    self.create = self.synth.create;

    nestedModuleSubdirs();

    _.each(self.options.modules, function(options, name) {
      synth.define(name, options);
    });

    // Apostrophe prefers that any improvements to @apostrophecms/global
    // be applied before any project level version of @apostrophecms/global
    synth.applyImprovementsBeforeProjectLevel();

    return synth;
  }

  async function instantiateModules() {
    self.modules = {};
    for (const item of modulesToBeInstantiated()) {
      // module registers itself in self.modules
      const module = await self.synth.create(item, { apos: self });
      await module.emit('moduleReady');
    }
  }

  function modulesToBeInstantiated() {
    return Object.keys(self.options.modules).filter(name => {
      const improvement = self.synth.isImprovement(name);
      return !(self.options.modules[name] && (improvement || self.options.modules[name].instantiate === false));
    });
  }

  function lintModules() {
    const validSteps = [];
    for (const module of Object.values(self.modules)) {
      for (const step of module.__meta.chain) {
        validSteps.push(step.name);
      }
    }

    if (!fs.existsSync(self.localModules)) {
      return;
    }

    const dirs = fs.readdirSync(self.localModules);
    for (const dir of dirs) {
      if (dir.match(/^@/)) {
        const nsDirs = fs.readdirSync(`${self.localModules}/${dir}`);
        for (let nsDir of nsDirs) {
          nsDir = `${dir}/${nsDir}`;
          testDir(nsDir);
        }
      } else {
        testDir(dir);
      }
    }
    function testDir(name) {
      // Projects that have different theme modules activated at different times
      // are a frequent source of false positives for this warning, so ignore
      // seemingly unused modules with "theme" in the name
      if (!validSteps.includes(name)) {
        try {
          const submodule = require(require('path').resolve(`${self.localModules}/${name}`));
          if (submodule && submodule.options && submodule.options.ignoreUnusedFolderWarning) {
            return;
          }
        } catch (e) {
          // index.js might not exist, that's fine for our purposes
        }
        if (name.match(/^apostrophe-/)) {
          warn(
            'namespace-apostrophe-modules',
            stripIndent`
              You have a ${self.localModules}/${name} folder.
              You are probably trying to configure an official Apostrophe module, but those
              are namespaced now. Your directory should be renamed
              ${self.localModules}/${name.replace(/^apostrophe-/, '@apostrophecms/')}

              If you get this warning for your own, original module, do not use the
              "apostrophe-" prefix. It is reserved.
            `
          );
        } else {
          warn('orphan-modules', `You have a ${self.localModules}/${name} folder, but that module is not activated in app.js\nand it is not a base class of any other active module. Right now that code doesn't do anything.`);
        }
      }
      function warn(name, message) {
        if (self.util) {
          self.util.warnDevOnce(name, message);
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

    for (const [ name, module ] of Object.entries(self.modules)) {
      if (name.match(/^apostrophe-/)) {
        self.util.warnDevOnce(
          'namespace-apostrophe-modules',
          stripIndent`
            You have configured an ${name} module.
            You are probably trying to configure an official Apostrophe module, but those
            are namespaced now. Your module should be renamed ${name.replace(/^apostrophe-/, '@apostrophecms/')}

            If you get this warning for your own original module, do not use the
            "apostrophe-" prefix. It is reserved.
          `
        );
      }
      const moduleNameRegex = /\./;
      if (name.match(moduleNameRegex)) {
        self.util.warnDevOnce(
          'module-name-periods',
          stripIndent`
            You have configured a module named ${name}.
            Modules names may not include periods. Please change this to avoid bugs.
          `
        );
      }

      if (module.options.extends && ((typeof module.options.extends) === 'string')) {
        lint(`The module ${name} contains an "extends" option. This is probably a\nmistake. In Apostrophe "extend" is used to extend other modules.`);
      }
      if (module.options.singletonWarningIfNot && (name !== module.options.singletonWarningIfNot)) {
        lint(`The module ${name} extends ${module.options.singletonWarningIfNot}, which is normally\na singleton (Apostrophe creates only one instance of it). Two competing\ninstances will lead to problems. If you are adding project-level code to it,\njust use modules/${module.options.singletonWarningIfNot}/index.js and do not use "extend".\nIf you are improving it via an npm module, use "improve" rather than "extend".\nIf neither situation applies you should probably just make a new module that does\nnot extend anything.\n\nIf you are sure you know what you are doing, you can set the\nsingletonWarningIfNot: false option for this module.`);
      }
      if (name.match(/-widget$/) && (!extending(module)) && (!module.options.ignoreNoExtendWarning)) {
        lint(`The module ${name} does not extend anything.\n\nA -widget module usually extends @apostrophecms/widget-type or another widget type.\nOr possibly you forgot to npm install something.\n\nIf you are sure you are doing the right thing, set the\nignoreNoExtendWarning option to true for this module.`);
      } else if (name.match(/-page$/) && (name !== '@apostrophecms/page') && (!extending(module)) && (!module.options.ignoreNoExtendWarning)) {
        lint(`The module ${name} does not extend anything.\n\nA -page module usually extends @apostrophecms/page-type or\n@apostrophecms/piece-page-type or another page type.\nOr possibly you forgot to npm install something.\n\nIf you are sure you are doing the right thing, set the\nignoreNoExtendWarning option to true for this module.`);
      } else if ((!extending(module)) && (!hasCode(name)) && (!isBundle(name)) && (!module.options.ignoreNoCodeWarning)) {
        lint(`The module ${name} does not extend anything and does not have any code.\n\nThis usually means that you:\n\n1. Forgot to "extend" another module\n2. Configured a module that comes from npm without npm installing it\n3. Simply haven't written your "index.js" yet\n\nIf you really want a module with no code, set the ignoreNoCodeWarning option\nto true for this module.`);
      }
    }
    function hasCode(name) {
      let d = self.synth.definitions[name];
      if (doesWork(d)) {
        return true;
      }
      if (self.synth.isMy(d.__meta.name)) {
        // None at project level, but maybe at npm level, look there
        d = d.extend;
      }
      // If we got to the base class of all modules, the module
      // has no construct of its own
      if (self.synth.myToOriginal(d.__meta.name) === '@apostrophecms/module') {
        return false;
      }
      return doesWork(d);
    }
    function doesWork(d) {
      const countsAsWork = [ 'routes', 'apiRoutes', 'renderRoutes', 'renderRoutes', 'init', 'methods', 'beforeSuperClass', 'handlers', 'helpers', 'restApiRoutes', 'middleware', 'customTags', 'components', 'tasks' ];
      const code = countsAsWork.find(property => d[property]);
      if (code) {
        return true;
      }
      if (d.__meta.dirname && (fs.existsSync(`${d.__meta.dirname}/ui/apos`) || fs.existsSync(`${d.__meta.dirname}/ui/src`) || fs.existsSync(`${d.__meta.dirname}/ui/public`))) {
        // Assets that will be bundled, instead of server code
        return true;
      }
      return false;
    }
    function isBundle(name) {
      const d = self.synth.definitions[name];
      return d.bundle || (d.extend && d.extend.bundle);
    }
    function extending(module) {
      // If the module extends no other module, then it will
      // have up to four entries in its inheritance chain:
      // project level self, npm level self, `apostrophe-modules`
      // project-level and `apostrophe-modules` npm level.
      return module.__meta.chain.length > 4;
    }

    function lint(s) {
      self.util.warnDev(stripIndent`
        It looks like you may have made a mistake in your code:\n${s}
      `);
    }
  }

};

const abstractClasses = [ '@apostrophecms/module', '@apostrophecms/widget-type', '@apostrophecms/page-type', '@apostrophecms/piece-type', '@apostrophecms/piece-page-type', '@apostrophecms/doc-type' ];

module.exports.bundle = {
  modules: abstractClasses.concat(_.keys(defaults.modules)),
  directory: 'modules'
};

function seconds(msec) {
  return (Math.round(msec / 100) / 10) + ' seconds';
}

function clusterFork() {
  const worker = cluster.fork();
  worker.bornAt = Date.now();
}

function respawn(worker) {
  console.error(`Respawning worker process ${worker.process.pid}`);
  clusterFork();
}
