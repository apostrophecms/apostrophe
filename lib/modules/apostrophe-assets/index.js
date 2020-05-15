// This module provides minification and delivery of browser-side assets
// such as stylesheets and javascript.
//
// **You'll want to call the
// `pushAsset` method of *your own* module**, which takes advantage
// of the services provided by this module thanks to
// the [apostrophe-module](../apostrophe-module/README.md) base class.
//
// Apostrophe implements two "asset scenes," `anon` and `user`. When
// you call `self.pushAsset('script', 'myfile', { when: 'user' })`, that
// script is normally pushed only to logged-in users. When you call
// `self.pushAsset('script', 'myfile', { when: 'always' })`, that script is
// pushed to everyone, logged in or not.
//
// If you want assets that are normally available only to logged-in users
// for a particular page, set `req.scene = "user;"` and that particular
// page will render with the full set of assets. This is useful if you wish
// to use apostrophe schema-based forms on a page for anonymous site visitors.
//
// This module also pushes most of Apostrophe's standard front-end assets,
// notably `jQuery`, `lodash`, `async`, `moment`, `moog` and a polyfill for `setImmediate`.
// You may assume all of these are available in the browser at all times.
//
// Other assets are pushed by individual core modules that require them.
//
// ## Options:
//
// ### `minify`
//
// Set for you automatically if `APOS_BUNDLE=1` or `APOS_MINIFY=1` in the environment.
//
// If set to true, both stylesheets and scripts are combined into a single file
// and unnecessary whitespace removed to speed delivery. It is strongly recommended
// that you enable this option in production, and also in staging so you can see
// any unexpected effects.
//
// It never makes sense to run with no minified assets in production.
//
// ### `lean`
//
// If this option is set to `true`, Apostrophe will *not* push any assets to an anonymous, logged-out site visitor, except for those pushed with `{ when: 'lean' }`. By default this includes only a tiny subset of the `apos.utils` library with necessary services to make widget players possible, with no library dependencies.
//
// Note that this means assets pushed with `{ when: 'always' }` will *not* be received, except by logged-in users.
//
// There are also no widget players, except for modules that allow you to opt in to a lean widget player by passing the `player: true` option when configuring those modules. This is currently supported by `apostrophe-video-widgets`.
//
// ### `static`
//
// Pass options to the [express.static](https://expressjs.com/en/4x/api.html#express.static)
// middleware, such as `Cache-Control` and more. If no options are defined,
// the default options from the middleware will be used. Please note you might want
// to define different options depending on your environment. You could for example
// set `max-age` only for production to ensure fresh files during development.
// Example:
//
// ```js
// {
//   static: {
//     maxAge: '1y',
//     etag: false
//   }
// }
// ```
//
// ### `uploadfsBundleCleanup`
//
// If explicitly set to `false`, the mechanism that otherwise removes stale
// uploadfs static asset bundles five minutes after launch is disabled.
// See [Deploying Apostrophe in the Cloud with Heroku](/devops/deployment/deploying-apostrophe-in-the-cloud-with-heroku.md)
// for more information.
//
// ## Additional Environment Variables
//
// ### `APOS_BUNDLE`
//
// Set APOS_BUNDLE=1 for a simple way to handle copying static assets to the cloud in production.
//
// First run this task in a production environment:
//
// `APOS_BUNDLE=1 node app apostrophe:generation`
//
// Then make sure the variable is also set when running actual production instances of the site:
//
// `APOS_BUNDLE=1 node app`
//
// If in your environment the bundle has already been extracted and the
// root directory is now read-only, you can use this additional environment
// variable to avoid an error from `tar`:
//
// `APOS_BUNDLE=1 APOS_EXTRACT_BUNDLE=0 node app`
//
// Alternatively, if you specified an explicit bundle name to `--create-bundle` when using `apostrophe:generation`,
// stored it to git and deployed it, you can specify that bundle name as the value of APOS_BUNDLE. But this is
// more work; we recommend the easy way.
//
// ### `APOS_BUNDLE_IN_UPLOADFS`
//
// Legacy. For use when `APOS_BUNDLE` is set to an explicit bundle name but you still wish static asset URLs to be
// generated to reference those files via uploadfs. But this is the hard way; just run `apostrophe:generation` with
// APOS_BUNDLE=1, and also set `APOS_BUNDLE=1` in the environment when launching Apostrophe. That's really all you
// have to do.
// See [Deploying Apostrophe in the Cloud with Heroku](/devops/deployment/deploying-apostrophe-in-the-cloud-with-heroku.md) for more information.
//
// ### `APOS_BUNDLE_CLEANUP_DELAY`
//
// If set to a number of milliseconds, Apostrophe delays that long before
// cleaning up obsolete static asset bundles in uploadfs. The default
// is 5 minutes. The assumption is that all production servers have received
// the new deployment and finished serving any straggler HTTP requests 5 minutes after
// a new version is first launched.
// See [Deploying Apostrophe in the Cloud with Heroku](/devops/deployment/deploying-apostrophe-in-the-cloud-with-heroku.md)
// for more information.

var path = require('path');
var fs = require('fs');

var _ = require('@sailshq/lodash');
var async = require('async');
// JS minifier and optimizer
var uglifyJs = require('uglify-js');
// LESS CSS compiler
var less = require('less');
var glob = require('glob');
var bless = require('bless');
var lessMiddleware = require('less-middleware');
var rimraf = require('rimraf');
var Promise = require('bluebird');
var mkdirp = require('mkdirp');
var Binary = require('emulate-mongo-2-driver').Binary;

module.exports = {

  alias: 'assets',

  singletonWarningIfNot: 'apostrophe-assets',

  afterConstruct: function(self) {
    self.apos.tasks.add('apostrophe', 'generation',
      'Run this task to generate new minified assets and perform other pre-startup\n' +
      'tasks, then exit. This happens on a normal startup too, but if you are running\n' +
      'multiple processes or servers you should avoid race conditions by running\n' +
      'this task before starting them all.\n\n' +
      'To create an asset bundle zipfile in uploadfs as a predeployment task on production,\n' +
      'run:\n\n' +
      'APOS_BUNDLE=1 node app apostrophe:generation\n\n' +
      'After that, on production, start the site normally with APOS_BUNDLE=1 every time and the\n' +
      'bundle will be extracted if needed.\n\n' +
      'You can also specify a bundle name in both cases in which case\n' +
      'it is written to the project root as a folder by that name and will be extracted from\n' +
      'there as well. That approach is used only if you prefer to run this task in dev and\n' +
      'commit the results.',
      function(apos, argv, callback) {
        return self.generationTask(callback);
      }
    );

    self.enableBundles();
    self.setAssetTypes();
    self.setTypeMap();
    self.enableCsrf();
    self.enableHtmlPageId();
    self.enablePrefix();
    self.enableLessMiddleware();
    self.servePublicAssets();
    self.pushDefaults();
    self.isGenerationTask = (self.apos.argv._[0] === 'apostrophe:generation');
    self.pushCreateSingleton();
  },

  beforeConstruct: function(self, options) {
    if (options.minify === undefined) {
      options.minify = options.apos.launder.boolean(process.env.APOS_MINIFY);
    }
    // Support the inevitable typo
    options.jQuery = options.jQuery || options.jquery;
  },

  construct: function(self, options) {

    if ((process.env.APOS_BUNDLE === '1') || (options.apos.argv['create-bundle'] === true)) {
      self.simpleBundle = true;
      self.options.minify = true;
    }

    self.minified = {};

    // Full paths to assets as computed by pushAsset
    self.pushed = { stylesheets: [], scripts: [] };

    self.tooLateToPushAssets = false;

    // For generating unique keys cheaply
    self.ordinal = 0;

    if (self.options.jQuery !== 3) {
      self.apos.utils.warnDev('\n\n⚠️  Apostrophe is not configured to use jQuery v3.⚠️\nThis creates a security vulnerability. Please update apostrophe-assets configuration. For more information: https://apos.dev/jquery-3\n\n');
    }

    self.setDefaultStylesheets = function() {
      // Default stylesheet requirements
      self.stylesheets = [
        // Must have a jQuery UI theme or acceptable substitute for
        // autocomplete and datepickers to be usable. -Tom
        { name: (self.options.jQuery === 3) ? 'vendor/jquery-ui-3' : 'vendor/jquery-ui', when: 'always' },
        { name: 'vendor/pikaday', when: 'always' },
        // { name: 'vendor/jquery.Jcrop', when: 'user' }
        { name: 'vendor/cropper', when: 'user' },
        { name: 'vendor/spectrum', when: 'user' }
      ];
    };

    self.setDefaultScripts = function() {
      // Default browser side script requirements
      // TODO: lots of override options
      self.scripts = [
        // VENDOR DEPENDENCIES

        // Call setImmediate safely on browser side; much faster
        // than setTimeout(fn, 0)
        { name: 'vendor/setImmediate', when: 'always' },
        // For elegant, cross-browser functional-style programming.
        // Yes, we are standardized on lodash 3 due to our own development
        // cycle.
        { name: 'vendor/lodash', when: 'always' },
        // For async code without tears
        { name: 'vendor/async', when: 'always' },
        // For manipulating dates and times
        { name: 'vendor/moment', when: 'always' },
        // For everything DOM-related
        { name: (self.options.jQuery === 3) ? 'vendor/jquery-3' : 'vendor/jquery', when: 'always' },
        // For parsing query parameters browser-side
        { name: 'vendor/jquery-url-parser', when: 'always' },
        // For blueimp uploader, drag and drop reordering of anything
        // & autocomplete
        { name: (self.options.jQuery === 3) ? 'vendor/jquery-ui-3' : 'vendor/jquery-ui', when: 'always' },
        // For the RTE
        { name: 'vendor/jquery-hotkeys', when: 'user' },
        // Graceful fallback for older browsers for jquery fileupload
        { name: 'vendor/jquery.iframe-transport', when: 'user' },
        // Spiffy multiple file upload
        { name: 'vendor/jquery.fileupload', when: 'user' },
        // imaging cropping plugin
        // { name: 'vendor/jquery.Jcrop.min', when: 'user' },
        { name: 'vendor/cropper', when: 'user' },
        // textchange event, detects actual typing activity, not just focus change
        { name: 'vendor/jquery-textchange', when: 'always' },
        // preferred datepicker plugin
        { name: 'vendor/pikaday', when: 'always' },
        // Set, get and delete cookies in browser-side JavaScript
        { name: 'vendor/jquery.cookie', when: 'always' },
        { name: 'vendor/jquery.findSafe', when: 'user' },
        { name: 'vendor/jquery.onSafe', when: 'user' },
        { name: 'vendor/jquery.alter-class', when: 'user' },
        { name: 'vendor/sluggo', when: 'user' },

        // Spectrum is a colorpicker
        { name: 'vendor/spectrum', when: 'user' },

        // Scroll things into view, even if they are in a scrolling
        // container which itself needs to be scrolled into view or
        // whatever, it's pretty great:
        //
        // http://erraticdev.blogspot.com/2011/02/jquery-scroll-into-view-plugin-with.html
        //
        // (Note recent comments, it's actively maintained). -Tom
        { name: 'vendor/jquery.scrollintoview', when: 'always' },

        // PUNKAVE-MAINTAINED, GENERAL PURPOSE JQUERY PLUGINS

        { name: 'vendor/jquery.get-outer-html', when: 'always' },
        { name: 'vendor/jquery.find-by-name', when: 'always' },
        { name: 'vendor/jquery.projector', when: 'always' },
        { name: 'vendor/jquery.bottomless', when: 'always' },
        { name: 'vendor/jquery.selective', when: 'always' },
        { name: 'vendor/jquery.images-ready', when: 'always' },
        { name: 'vendor/jquery.radio', when: 'always' },
        { name: 'vendor/jquery.json-call', when: 'always' },

        // PUNKAVE-MAINTAINED POLYFILLS

        { name: 'vendor/setImmediate', when: 'always' },

        // PUNKAVE-MAINTAINED OOP SYSTEM
        { name: 'vendor/moog', when: 'always' },

        // APOSTROPHE CORE JS

        // Core functionality of the browser-side `apos` object
        { name: 'always', when: 'always' },
        { name: 'user', when: 'user' }
      ];
    };

    self.setAssetTypes = function() {
      self.assetTypes = {
        script: {
          ext: 'js',
          fs: 'public/js',
          web: 'js',
          key: 'scripts',
          serve: 'web'
        },
        stylesheet: {
          ext: 'css',
          fs: 'public/css',
          web: 'css',
          alternate: 'less',
          key: 'stylesheets',
          serve: 'web'
        }
      };
    };

    self.setTypeMap = function() {
      // Name of both folder and extension in
      // public/ for this type of asset
      self.typeMap = {
        scripts: 'js',
        stylesheets: 'css'
      };
    };

    // If self.simpleBundle is true, determine the current asset generation via the database and
    // set `self.generation` accordingly. If we are running the generation task in that situation,
    // set the generation id in the database. In all other cases, determine the generation via legacy methods.

    self.determineGenerationFromDb = function() {
      if (self.isGenerationTask && self.simpleBundle) {
        self.determineGeneration();
        return self.generationCollection.update({
          _id: self.getThemed('current')
        }, {
          generation: self.generation
        }, {
          upsert: true
        });
      }
      if (!self.simpleBundle) {
        return self.determineGeneration();
      }
      return Promise.try(function() {
        return self.generationCollection.findOne({ _id: self.getThemed('current') });
      }).then(function(c) {
        if (!c) {
          throw new Error('You must first run the apostrophe:generation task, with APOS_BUNDLE=1 set in the environment');
        }
        self.generation = c.generation;
      });
    };

    // Determine the current asset generation identifier (self.generation) and prep the
    // bundle folder, if any is needed.

    self.determineGeneration = function() {

      var generation;

      if (self.isGenerationTask) {
        // Create a new generation identifier. The assets module
        // will use this to create asset files that are distinctly
        // named on a new deployment.
        generation = self.apos.utils.generateId();

        var bundle = self.apos.argv['create-bundle'] || self.simpleBundle;
        if (bundle) {
          if (bundle === true) {
            self.toBundleName = 'assets-' + self.getThemed(generation);
            self.toBundle = self.apos.rootDir + '/data/temp/' + self.toBundleName;
          } else {
            self.toBundleName = bundle;
            self.toBundle = self.apos.rootDir + '/' + self.toBundleName;
          }
          rimraf.sync(self.toBundle);
          var ensure = [
            self.toBundle,
            self.toBundle + '/data',
            self.toBundle + '/public',
            self.toBundle + '/public/css',
            self.toBundle + '/public/js'
          ];
          _.each(ensure, function(folder) {
            if (!fs.existsSync(folder)) {
              self.mkdirp(folder);
            }
          });
        }

        if (self.apos.argv['create-bundle'] !== true) {
          fs.writeFileSync(self.getAssetRoot() + '/data/generation', generation);
        }

      }

      if (self.apos.argv['create-bundle'] !== true) {
        if (fs.existsSync(self.getAssetRoot() + '/data/generation')) {
          generation = fs.readFileSync(self.getAssetRoot() + '/data/generation', 'utf8');
          generation = generation.replace(/\s/g, '');
        }
      }

      if (!generation) {
        // In a dev environment, we can just use the pid
        generation = self.determineDevGeneration();
      }

      self.generation = generation;
    };

    // Return an asset generation identifier for dev use only.
    // By default the pid (which is constant just for the lifetime
    // of this process) is used.
    self.determineDevGeneration = function() {
      return self.apos.pid;
    };

    self.mkdirp = function(path) {
      try {
        mkdirp.sync(path);
      } catch (e) {
        if (fs.existsSync(path)) {
          // race condition in mkdirp but all is well
        } else {
          throw e;
        }
      }
    };

    // Initialize services required for asset bundles. Obtains the
    // self.generations mongodb collection and extracts a bundle if
    // appropriate.

    self.enableBundles = function() {
      // Used for cleanup purposes. Inconsistent name is legacy
      self.generations = self.apos.db.collection('apostropheGenerations');
      // Used to identify the current generation, based on a fixed _id, separate in purpose
      // from self.generations
      self.generationCollection = self.apos.db.collection('aposGeneration');
      // Handles the synchronous filesystem bundle case, See also extractBundleFromGenerationCollection
      self.extractBundleIfAppropriate();
    };

    // Extracts the appropriate asset bundle from uploadfs if we are using simple bundles
    // and this is not a command line task.
    //
    // Returns a promise. Called on the modulesReady event.
    //
    // If the APOS_EXTRACT_BUNDLE environment variable is set to the string "0" this
    // does not take place. That is useful when the bundle has already been extracted
    // by other means and the filesystem is no longer writable (for instance, platform.sh).

    self.extractBundleFromGenerationCollection = function() {
      if (self.apos.isTask()) {
        return;
      }
      if (!self.simpleBundle) {
        return;
      }
      if (process.env.APOS_EXTRACT_BUNDLE === '0') {
        // We still need to know the assets came from the bundle and minification has already been done
        self.fromBundle = true;
        return;
      }
      return Promise.try(function() {
        return self.generationCollection.findOne({ _id: self.getThemed('current') });
      }).then(function(generation) {
        if (!(generation && generation.tarball)) {
          throw new Error('Asset bundle is not in generationCollection');
        }
        return fs.writeFileSync(self.getUploadfsBundleTempName(), generation.tarball.buffer);
      }).then(function() {
        // We don't use the tar module because we have experienced hangs on extraction with it.
        // Also native tar is fast. (TODO: use the tar module when on Windows)
        return spawn('tar', [ '-zxf', self.getUploadfsBundleTempName(), '-C', self.apos.rootDir ]);
      }).then(function() {
        self.extractedTarFiles = [];
        return spawn('tar', [ '-ztf', self.getUploadfsBundleTempName() ]);
      }).then(function(output) {
        output = output.split('\n');
        _.each(output, function(line) {
          if (line.match(/\/$/)) {
            return;
          }
          self.extractedTarFiles.push(line);
        });
        return Promise.promisify(function(callback) {
          return fs.remove(self.getUploadfsBundleTempName(), callback);
        });
      }).then(function() {
        self.fromBundle = true;
      });
    };

    self.on('apostrophe:modulesReady', 'determineGenerationAndExtract', function() {
      return Promise.try(function() {
        return self.determineGenerationFromDb();
      }).then(function() {
        return self.extractBundleFromGenerationCollection();
      });
    });

    // This method supports the less common case where an explicit bundle name
    // is in APOS_BUNDLE and it should be extracted from the filesystem. The
    // more common case, APOS_BUNDLE=1, is implemented elsewhere. The name of
    // this method is kept for bc reasons.

    self.extractBundleIfAppropriate = function() {
      if (process.env.APOS_BUNDLE && (process.env.APOS_BUNDLE !== '1')) {
        self.extractBundle(process.env.APOS_BUNDLE);
        self.fromBundle = true;
      }
    };

    // Clean up old asset bundles in uploadfs, if any, after a
    // suitably safe interval allowing services such as Heroku to
    // shut down old instances that might be using them

    self.uploadfsBundleCleanup = function() {
      var locked = false;
      var generations;

      // By default, allow old assets to exist for a full five hours after
      // a new deployment. They aren't hurting anything and it could
      // take quite a while to completely transition a big deployment
      setTimeout(cleanup, process.env.APOS_BUNDLE_CLEANUP_DELAY ? parseInt(process.env.APOS_BUNDLE_CLEANUP_DELAY) : 5 * 60 * 60 * 1000);

      function cleanup() {
        return async.series([
          lock,
          find,
          insert,
          remove
        ], function(err) {
          if (locked) {
            return self.apos.locks.unlock(self.__meta.name, function(_err) {
              if (err || _err) {
                // Failure to remove old asset bundles is a nonfatal error,
                // the next deployment will get them
                self.apos.utils.error(err || _err);
              }
            });
          } else {
            if (err) {
              // Failure to remove old asset bundles is a nonfatal error,
              // the next deployment will get them
              self.apos.utils.error(err);
            }
          }
        });

        function lock(callback) {
          return self.apos.locks.lock(self.__meta.name, function(err) {
            locked = !err;
            return callback(err);
          });
        }

        function find(callback) {
          return self.generations.find().sort({ when: 1 }).toArray(function(err, _generations) {
            generations = _generations;
            return callback(err);
          });
        }

        function insert(callback) {
          if (_.find(generations, { _id: self.generation })) {
            return callback(null);
          }
          // Enumerate the copies the same way they were enumerated when
          // this bundle was copied into uploadfs. Note that the bundle
          // exists both locally and in uploadfs so we can do that here too
          var current = {
            _id: self.generation,
            copies: self.enumerateCopies(self.extractedTarFiles ? { files: self.extractedTarFiles, prefix: './public' } : (self.apos.rootDir + '/' + self.toBundleName + '/public'), self.getGenerationPath()),
            when: new Date()
          };
          generations.push(current);
          return self.generations.insert(current, callback);
        }

        function remove(callback) {
          var current = _.find(generations, { _id: self.generation });
          return async.eachSeries(generations, function(generation, callback) {
            if (generation.when >= current.when) {
              return setImmediate(callback);
            }
            return removeGeneration(generation, callback);
          }, callback);
        }

        function removeGeneration(generation, callback) {
          return async.series([
            removeFiles,
            removeIt
          ], callback);

          function removeFiles(callback) {
            return async.eachLimit(generation.copies, 5, function(copy, callback) {
              return self.uploadfs().remove(copy.to, function(err) {
                // Failure to remove a stale asset is nonfatal
                if (err) {
                  self.apos.utils.error(err);
                }
                return callback(null);
              });
            }, callback);
          }

          function removeIt(callback) {
            return self.generations.remove({ _id: generation._id }, callback);
          }
        }
      }

    };

    // Extract the named asset bundle, as created by the
    // apostrophe:generation task with the --create-bundle=NAME
    // option. An asset bundle is just a folder from which files are
    // recursively copied into the project root folder in a production
    // environment after deployment, allowing minified assets to be
    // provided to a server via a separate folder in git rather than
    // cluttering the dev environment with them

    self.extractBundle = function(name) {
      self.recursiveCopy(self.apos.rootDir + '/' + name, self.apos.rootDir);
    };

    // This method pushes assets to be delivered to the browser
    // on every page load.
    //
    // You should be calling the pushAsset method of your module,
    // not this one. It is part of the implementation of the
    // pushAsset method of apostrophe-module, the base class
    // of all modules.
    //
    // But if you really wanted to, you'd have to do this...
    //
    // self.pushAsset('stylesheet', 'foo', {
    //   when: 'always'
    // },
    // {
    //   dirname: '/path/to/module',
    //   name: 'apostrophe-modulename',
    // })
    //
    //
    // Stylesheets are loaded from the module's public/css folder.
    //
    // Scripts are loaded from the module's public/js folder.
    //
    // Do not supply the file extension.
    //
    // It is acceptable to push an asset more than once. Only one copy
    // is sent, at the earliest point requested.
    //
    // Returns true if an acceptable source file or function for the asset
    // exists, otherwise false.

    self.push = function(type, name, options, context) {

      options = options || {};

      if (self.tooLateToPushAssets) {
        throw 'It is too late to push assets. Hint: push assets in your module\'s constructor, or in your module\'s modulesReady method. afterInit is too late.';
      }

      var data = options ? options.data : undefined;

      var when = (options ? options.when : undefined) || 'always';

      if (typeof (name) === 'function') {
        self.pushed[self.assetTypes[type].key].push({ call: name, data: data, when: when });
        return true;
      }

      var fileDir = context.dirname + '/' + self.assetTypes[type].fs;

      // Do not add the prefix yet, that happens later when script tags are output.
      // Do not call assetUrl yet, uploadfs is not available yet
      var webDir = '/modules/' + context.name + '/' + self.assetTypes[type].web;

      var filePath = fileDir + '/' + name;
      if (self.assetTypes[type].ext) {
        filePath += '.' + self.assetTypes[type].ext;
      }
      var webPath = webDir + '/' + name;
      if (self.assetTypes[type].ext) {
        webPath += '.' + self.assetTypes[type].ext;
      }

      var exists = fs.existsSync(filePath);

      if (self.assetTypes[type].alternate && fs.existsSync(filePath.replace(/\.\w+$/, '.' + self.assetTypes[type].alternate))) {
        exists = true;
      } else if (fs.existsSync(filePath)) {
        exists = true;
      }

      if (exists) {
        var push = {
          type: type,
          file: filePath,
          web: webPath,
          data: data,
          preshrunk: options.preshrunk,
          when: when,
          minify: options.minify
        };
        if (type === 'stylesheet') {
          push.import = options.import;
        }
        self.pushed[self.assetTypes[type].key].push(push);
      }
      return exists;
    };

    // Purge files from public folder matching the glob pattern
    // `pattern`, excepting those with names containing
    // `exceptSubstring`.

    self.purgeExcept = function(pattern, exceptSubstring) {
      var old = glob.sync(self.getAssetRoot() + '/public/' + pattern);
      _.each(old, function(file) {
        if (file.indexOf(exceptSubstring) === -1) {
          try {
            fs.unlinkSync(file);
          } catch (e) {
            // This is nonfatal, probably just a race with
            // another process to remove the same file.
          }
        }
      });
    };

    // Wait until the last possible moment - after all modules
    // have been initialized, *and* notified of each other's
    // initialization - to symlink public/modules subdirectories,
    // build master LESS files, and minify (if desired). This
    // allows other modules to wait until they can talk to
    // each other (modulesReady) before pushing assets.

    self.afterInit = function(callback) {
      if (self.apos.isTask() && !self.isGenerationTask) {
        // Tasks other than apostrophe:generation should not waste time and create conflicts by
        // attempting to generate assets
        return setImmediate(callback);
      }

      self.tooLateToPushAssets = true;

      if (self.fromBundle && (!self.isGenerationTask)) {
        if (process.env.APOS_BUNDLE_IN_UPLOADFS || self.simpleBundle) {
          if (self.options.uploadfsBundleCleanup !== false) {
            self.uploadfsBundleCleanup();
          }
        }
        // We extracted an asset bundle that already contains everything
        return setImmediate(callback);
      }

      self.ensureFolder();

      return self.apos.locks.withLock(self.__meta.name + ':devAssetBuild', function(callback) {
        return async.series([
          self.symlinkModules,
          self.buildLessMasters,
          self.minify,
          self.outputAndBless
        ], callback);
      }, callback);
    };

    // Ensure that the standard asset folders exist at project level,
    // notably `public` (the web-accessible folder) and `public/modules`
    // (where symbolic links to the `public` subdirectories of Apostrophe modules are automatically
    // created by `symlinkModules`). If `root` is not set, the root
    // of the project is assumed.

    self.ensureFolder = function(root) {
      if (!root) {
        root = self.apos.rootDir;
      }
      var staticDir = root + '/public';

      ensure(staticDir);
      ensure(staticDir + '/modules');
      ensure(staticDir + '/css');
      ensure(staticDir + '/js');

      function ensure(dir) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir);
        }
      }

    };

    // Ensure that `public/modules/modulename` points to exactly the
    // same content as `lib/modules/modulename/public`. On platforms that
    // support symbolic links for non-administrators, use them. On platforms
    // that don't, make a recursive copy. (This poses no significant
    // performance problem for Apostrophe's assets, which are modest
    // in size. If you were hoping to push huge files as permanent
    // static assets this way, well... complain to Microsoft.)

    self.symlinkModules = function(callback) {
      if (!fs.existsSync(self.getAssetRoot() + '/public/modules')) {
        fs.mkdirSync(self.getAssetRoot() + '/public/modules');
      }
      if (!self.chains) {
        self.chains = {};
      }
      _.each(self.chains, function(chain, name) {
        var last = chain[chain.length - 1];
        var from = self.getAssetRoot() + '/public/modules/' + name;
        var to = last.dirname + '/public';
        self.linkAssetFolder(from, to);
      });
      return callback(null);
    };

    // Get the effective project root folder. This will be the actual
    // project root folder except when creating an asset bundle to be
    // unpacked later

    self.getAssetRoot = function() {
      if (self.toBundle) {
        return self.toBundle;
      } else {
        return self.apos.rootDir;
      }
    };

    // Create or refresh a symbolic link from
    // the path "from" to the existing, actual folder
    // "to". If symbolic linking is unavailable on this
    // platform (Windows), recursively copy instead.
    //
    // Note that "to" is the EXISTING, REAL thing, so
    // the recursive copy actually duplicates "to"
    // in "from". Counterintuitive, but that's because
    // we're thinking in terms of a symbolic link.

    self.linkAssetFolder = function(from, to) {
      if (!fs.existsSync(to)) {
        return;
      }
      // Check if running in windows or in a
      // containerized environment indicated by a
      // process.env.APOS_ALWAYS_COPY_ASSETS variable
      // that is truthy.
      if (process.platform.match(/^win/) || process.env.APOS_ALWAYS_COPY_ASSETS) {
        self.linkAssetFolderOnWindows(from, to);
      } else {
        self.linkAssetFolderOnUnix(from, to);
      }
    };

    // Create or refresh a symbolic link from
    // the path "from" to the existing, actual folder
    // "to" on Unix-derived platforms (not Windows).
    //
    // If we are creating an asset bundle to deploy
    // to production, we'll copy everything instead.

    self.linkAssetFolderOnUnix = function(from, to) {
      if (self.toBundle) {
        // If we're creating a bundle to push up to production, we want to copy
        // things rather than making symlinks. YES, it IS CORRECT to reverse
        // the order of the arguments like this. Think about how people talk
        // about symbolic links vs. how they talk about copying things. -Tom

        return self.removeThenRecursiveCopy(to, from);
      }
      // Always recreate the links so we're not befuddled by links
      // deployed from a dev environment
      try {
        // Check whether there is an existing symbolic link
        // (must use lstat so it doesn't resolve the target instead)
        // and if so, remove it
        fs.lstatSync(from);
        // No exception = symbolic link exists, remove it so we can replace it with
        // a valid one
        fs.unlinkSync(from);
      } catch (e) {
        // Old symbolic link does not exist, that's fine
      }
      self.ensureNamespace(from);
      // Pass type option for Windows compatibility, hopefully
      fs.symlinkSync(to, from, 'dir');
    };

    // Namespaced npm package names look like @foo/bar,
    // so we might need to create @foo before we can create bar.
    // This method's job is to abstract this detail away from the
    // symlink and recursive copy methods.

    self.ensureNamespace = function(folder) {
      var parent = require('path').dirname(folder);
      if (!fs.existsSync(parent)) {
        var parentBasename = require('path').basename(parent);
        if (parentBasename.match(/^@/)) {
          fs.mkdirSync(parent);
        }
      }
    };

    self.linkAssetFolderOnWindows = function(from, to) {
      // On Windows, always simulate a symbolic link from "from" to "to"
      // by recursively copying the contents of "to" to "from".
      //
      // (Confused? Well, yes: it's odd when you word it this way,
      // but it makes sense when you think about symbolic links.)
      return self.removeThenRecursiveCopy(to, from);
    };

    // Remove the existing folder or symlink `to` and then recursively copy
    // the contents of `from` to it, creating a new folder at `to`.
    self.removeThenRecursiveCopy = function(from, to) {
      var stat;
      if (fs.existsSync(to)) {
        stat = fs.lstatSync(to);
        if (stat.isSymbolicLink()) {
          try {
            fs.unlinkSync(to);
          } catch (e) {
            self.apos.utils.error('WARNING: old style symbolic link exists at ' + to + ' and I do not have the privileges to remove it. You probably ran this site as Administrator before. Remove that symbolic link and the others in that folder as Administrator and try again as this non-Administrator user.');
            process.exit(1);
          }
        } else {
          rimraf.sync(to);
        }
      }
      self.ensureNamespace(to);
      self.recursiveCopy(from, to);
    };

    // Copy the existing folder at `from` to the new folder `to`.
    // If `to` already exists files are added or overwritten as appropriate
    // and files not present in `from` are left intact.
    self.recursiveCopy = function(from, to) {

      // It is absurd to reimplement recursive copy, but we're not ready to give up node 0.10 compatibility, and the
      // well-supported sync solutions are soon cutting that off. -Tom
      //

      copyDir(from, to);

      function copyDir(from, to) {
        if (!fs.existsSync(to)) {
          fs.mkdirSync(to);
        }
        var files = fs.readdirSync(from);
        _.each(files, function(file) {
          var fromFile = from + '/' + file;
          var toFile = to + '/' + file;
          var stat = fs.statSync(fromFile);
          if (stat.isDirectory()) {
            copyDir(fromFile, toFile);
          } else {
            copyFile(fromFile, toFile);
          }
        });
      }
      function copyFile(fromFile, toFile) {
        var fromHandle = fs.openSync(fromFile, 'r');
        var toHandle = fs.openSync(toFile, 'w');
        var chunkSize = 1024 * 1024;
        // eslint-disable-next-line node/no-deprecated-api
        var buffer = Buffer.alloc ? Buffer.alloc(chunkSize) : new Buffer(chunkSize);
        while (true) {
          var read = fs.readSync(fromHandle, buffer, 0, chunkSize);
          if (!read) {
            break;
          }
          fs.writeSync(toHandle, buffer, 0, read);
        }
        fs.closeSync(fromHandle);
        fs.closeSync(toHandle);
      }
    };

    // Copy the existing local folder at `from` to the uploadfs folder `to`.
    // (uploadfs doesn't really have folders per se, so this just means
    // prefixing the filenames with "to" plus a slash.)
    //
    // WARNING: if `to` already exists, any contents that don't also appear in `from`
    // are removed.

    self.syncToUploadfs = function(from, to, callback) {

      var copies = [];

      copies = self.enumerateCopies(from, to);
      return performCopies(callback);

      function performCopies(callback) {
        return async.eachLimit(copies, 5, function(copy, callback) {
          return self.uploadfs().copyIn(copy.from, copy.to, callback);
        }, callback);
      }

    };

    // Given a local folder (the public/ subdir of an asset bundle)
    // and an uploadfs path (where it will later be web-accessible),
    // return an array of copies that must be performed, with `from`
    // and `to` properties

    self.enumerateCopies = function(from, to) {

      if (from.files && from.prefix) {
        var result = _.filter(from.files, function(file) {
          if (file.substring(0, from.prefix.length) !== from.prefix) {
            return false;
          }
          return true;
        });
        result = result.map(function(file) {
          file = file.substring(from.prefix.length);
          return {
            from: file,
            to: to + file
          };
        });
        return result;
      }

      var copies = [];
      enumerateDir(from, to);
      return copies;

      function enumerateDir(from, to) {
        var files = fs.readdirSync(from);
        _.each(files, function(file) {
          var fromFile = from + '/' + file;
          var toFile = to + '/' + file;
          var stat = fs.statSync(fromFile);
          if (stat.isDirectory()) {
            enumerateDir(fromFile, toFile);
          } else {
            enumerateFile(fromFile, toFile);
          }
        });
      }

      function enumerateFile(fromFile, toFile) {
        copies.push({
          from: fromFile,
          to: toFile
        });
      }
    };

    self.lessCssWatches = [];

    self.buildLessMasters = function(callback) {
      self.lessMasters = {};
      // Compile all LESS files as one. This is awesome because it allows
      // mixins to be shared between modules for better code reuse. It also
      // allows you to redefine mixins in a later module; if you do so, they
      // are retroactive to the very first use of the mixin. So apostrophe-ui-2
      // can alter decisions made in the apostrophe module, for instance.
      return self.forAllAssetScenes(function(scene, callback) {
        var base = self.getStylesheetsMasterBase() + '-' + scene + '-';
        self.purgeExcept(base + '*', '-' + self.generation);
        var masterWeb = base + self.getThemedGeneration() + '.less';
        var masterFile = self.getAssetRoot() + '/public' + masterWeb;
        var stylesheets = self.filterAssets(self.pushed.stylesheets, scene, true);
        // Avoid race conditions, if apostrophe:generation created
        // the file already leave it alone
        if (!fs.existsSync(masterFile)) {
          fs.writeFileSync(masterFile, _.map(stylesheets, function(stylesheet) {
            // Cope with the way we push .css but actually write .less
            // because of the middleware.
            var importName = stylesheet.web.replace('.css', '.less');
            if (!fs.existsSync(self.getAssetRoot() + '/public' + importName)) {
              importName = stylesheet.web;
            }
            // For import what we need is a relative path which will work on
            // the filesystem too thanks to the symbolic links for modules
            var relPath = path.relative(path.dirname(masterWeb), importName);
            var keywords = [];
            if (stylesheet.import) {
              _.each(stylesheet.import, function(val, key) {
                if (val) {
                  keywords.push(key);
                }
              });
            } else if (/\.css$/.test(importName)) {
              // Always inline CSS to get the same URL rewrite
              // behavior we had with clean-css, bc.
              keywords.push('inline');
            }
            if (keywords.indexOf('inline') !== -1) {
              // less does not give less-middleware enough information to
              // watch for changes in inlined files, so we have to do it
              var absolutePath = path.resolve(path.dirname(masterFile), relPath);
              self.lessCssWatches.push(fs.watch(absolutePath, {
                persistent: false
              }, function() {
                // Convince the less-middleware that something has changed
                if (fs.existsSync(masterFile)) {
                  var now = new Date();
                  try {
                    fs.utimesSync(masterFile, now, now);
                  } catch (e) {
                    // In case of flaky platform
                    self.apos.utils.warn('Unable to touch master CSS file, you might have to restart yourself to see new changes:', e);
                  }
                }
              }));
            }
            if (keywords.length) {
              keywords = '(' + keywords.join(',') + ') ';
            } else {
              keywords = '';
            }
            return '@import ' + keywords + '\'' + relPath + '\';';
          }).join("\n"));
        }
        self.lessMasters[scene] = {
          // The nature of the LESS middleware is that it expects you to
          // request a CSS file and uses LESS to render it if available
          file: masterFile.replace('.less', '.css'),
          web: masterWeb.replace('.less', '.css')
        };
        return callback(null);
      }, callback);
    };

    self.getStylesheetsMasterBase = function() {
      return '/css/' + self.getThemed('master');
    };

    self.minify = function(callback) {
      self.minified = {};
      if (!self.options.minify) {
        // Just use the LESS middleware and direct access to JS
        // for dev
        return callback(null);
      }
      var minifiers = {
        stylesheets: self.minifyStylesheet,
        scripts: self.minifyScript
      };
      var needed = false;
      return self.forAllAssetScenes(function(scene, callback) {
        return async.eachSeries([ 'stylesheets', 'scripts' ], function(type, callback) {
          self.purgeExcept('/apos-minified/' + scene + '-' + self.getThemedGeneration().replace(self.generation, '*') + '.' + self.typeMap[type], '-' + self.generation);
          var file = self.getAssetRoot() + '/public/apos-minified/' + scene + '-' + self.getThemedGeneration() + '.' + self.typeMap[type];
          if (fs.existsSync(file)) {
            // Someone has already compiled it for the
            // current deployment's asset generation!
            // No startup delay! Booyeah!
            self.minified[scene] = self.minified[scene] || {};
            self.minified[scene][type] = fs.readFileSync(file, 'utf8');
            return setImmediate(callback);
          }
          if (!needed) {
            needed = true;
            self.apos.utils.log('MINIFYING, this may take a minute...');
          }
          return self.minifySceneAssetType(scene, type, minifiers[type], callback);
        }, callback);
      }, function(err) {
        if (err) {
          return callback(err);
        }
        if (needed) {
          self.apos.utils.log('Minification complete.');
        }
        return callback(null);
      });
    };

    self.outputAndBless = function(callback) {
      _.each(self.minified, function(byType, scene) {
        _.each(byType, function(content, type) {
          if (!self.typeMap[type]) {
            return;
          }
          var dir = self.getAssetRoot() + '/public/apos-minified';
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
          }
          var filename = dir + '/' + scene + '-' + self.getThemedGeneration() + '.' + self.typeMap[type];
          // Avoid race conditions - don't try to write the
          // same file again if apostrophe:generation already
          // created it for us
          if (fs.existsSync(filename)) {
            return;
          }
          if ((type === 'stylesheets') && self.options.bless) {
            self.splitWithBless(filename, content);
          } else {
            fs.writeFileSync(filename, content);
          }
        });
      });
      return setImmediate(callback);
    };

    // Iterate over all asset scenes. Right now just anon, user
    self.forAllAssetScenes = function(each, callback) {
      if (!self.options.scenes) {
        self.options.scenes = [ 'anon', 'user' ];
      }
      return async.eachSeries(self.options.scenes, each, callback);
    };

    // Minify assets required for a particular scene and populate
    // self.minified appropriately. Supports dot notation in "scene"
    // for scene upgrades. Implements md5-based caching for the really
    // expensive javascript minification step.

    self.minifySceneAssetType = function(scene, type, minifier, callback) {
      var assets;
      // For stylesheets we should have a master LESS file at this point which
      // imports all the rest, so treat that as our sole stylesheet
      if ((type === 'stylesheets') && self.lessMasters && self.lessMasters[scene]) {
        assets = [ self.lessMasters[scene] ];
      } else {
        assets = self.filterAssets(self.pushed[type], scene, true);
      }
      var key;
      var found = false;
      if (!self.minified) {
        self.minified = {};
      }
      if (!self.minified[scene]) {
        self.minified[scene] = {};
      }
      var cache = self.apos.caches.get('minify');
      return async.series({
        checkCache: function (callback) {
          if (type === 'stylesheets') {
            // For now we must ignore the cache for stylesheets because
            // LESS files may include other files which may have been
            // modified, and we have not accounted for that
            return callback(null);
          }
          return async.map(assets, function(asset, callback) {
            if (!fs.existsSync(asset.file)) {
              // It is not uncommon to push assets that a developer doesn't
              // bother to create in, say, a snippet subclass
              return callback(null, 'empty');
            }
            return self.apos.utils.md5File(asset.file, callback);
          }, function(err, md5s) {
            if (err) {
              return callback(err);
            }
            // So the key's components are in a consistent order
            md5s.sort();
            key = type + ':' + scene + ':' + md5s.join(':');
            // So the key is never too long for mongodb
            key = self.apos.utils.md5(key);
            return cache.get(key, function(err, item) {
              if (err) {
                return callback(err);
              }
              if (item !== undefined) {
                self.minified[scene][type] = item;
                found = true;
              }
              return callback(null);
            });
          });
        },
        compileIfNeeded: function(callback) {
          if (found) {
            return callback(null);
          }
          return async.mapSeries(assets, minifier, function(err, codes) {
            if (err) {
              return callback(err);
            }
            var code = codes.join("\n");
            self.minified[scene][type] = code;
            if (type === 'stylesheets') {
              // For now we must ignore the cache for stylesheets because
              // LESS files may include other files which may have been
              // modified, and we have not accounted for that
              return callback(null);
            }
            return cache.set(key, code, callback);
          });
        }
      }, function(err) {
        return callback(err);
      });
    };

    self.minifyStylesheet = function(stylesheet, callback) {
      // Now just a wrapper, as cleanCss added nothing much over the compress
      // feature of less and introduced npm audit issues
      return self.compileStylesheet(stylesheet, callback);
    };

    // Minify a single JavaScript file (via the script.file property)
    self.minifyScript = function(script, callback) {
      // For now we don't actually need async for scripts, but now
      // we have the option of going there
      var exists = fs.existsSync(script.file);
      if (!exists) {
        self.apos.utils.warn("Warning: " + script.file + " does not exist");
        return callback(null);
      }
      if (script.preshrunk) {
        return callback(null, fs.readFileSync(script.file, 'utf8'));
      }
      try {
        var code = uglifyJs.minify(script.file).code;
      } catch (e) {
        var message =
          'uglify threw an exception while compiling:\n\n' + script.file + '\n\n' +
          'most likely there is invalid javascript in that file:\n\n';
        if (e.message && e.filename && e.line && e.col) {
          message += e.message + '\n' + 'Line ' + e.line + ' col ' + e.col + '\n\n';
          throw new Error(message);
        } else {
          self.apos.utils.error(message);
          throw e;
        }
      }
      return callback(null, code);
    };

    self.compileStylesheet = function(stylesheet, callback) {
      var src = stylesheet.file;

      // Make sure we look first for a LESS source file so we're not
      // just using a (possibly stale) previously compiled version
      var lessPath = src.replace(/\.css$/, '.less');
      var exists = false;
      if (fs.existsSync(lessPath)) {
        src = lessPath;
        exists = true;
      } else if (fs.existsSync(src)) {
        exists = true;
      }

      if (!exists) {
        self.apos.utils.warn('WARNING: stylesheet ' + stylesheet.file + ' does not exist');
        return callback(null, '');
      }
      // We run ALL CSS through the LESS compiler, because
      // it fixes relative paths for us so that a combined file
      // will still have valid paths to background images etc.

      var lessOptions = {
        filename: src,
        paths: [],
        compress: true
        // syncImport doesn't seem to work anymore in 1.4, thus
        // we were pushed to write endAssets, although it makes
        // sense anyway
      };
      _.merge(lessOptions, self.options.less || {});

      return less.render(fs.readFileSync(src, 'utf8'), lessOptions, function(err, css) {
        if (err) {
          self.apos.utils.error('LESS CSS ERROR:');
          self.apos.utils.error(err);
        }
        css = css.css;
        if ((self.isGenerationTask && self.simpleBundle) || self.apos.argv['sync-to-uploadfs']) {
          css = self.prefixCssUrlsWith(css, self.uploadfs().getUrl() + self.getGenerationPath());
        } else if (self.apos.prefix) {
          css = self.prefixCssUrls(css);
        }
        return callback(err, css);
      });
    };

    // Part of the implementation of self.afterInit, this method
    // returns only the assets that are suitable for the specified
    // scene (`user` or `anon`). Duplicates are suppressed automatically
    // for anything rendered from a file (we can't do that for things
    // rendered by a function).
    //
    // If minifiable is true you get back the assets that can be minified;
    // if set false you get those that cannot; if it is not specified
    // you get both.
    //
    // If `options: lean` is true, "always" is treated as "user".
    // This maintains bc in the logged-in experience without pushing anything
    // unnecessary to the lean logged-out experience.
    //
    // Regardless of the `lean` module-level option, anything pushed as
    // "lean" is delivered to both the "anon" and "user" scenes. This
    // provides an upgrade path for gradual migration to `lean: true`.

    self.filterAssets = function(assets, when, minifiable) {
      // Support older layouts
      if (!when) {
        throw new Error('You must specify the "when" argument (usually either anon or user)');
      }

      // Always stomp duplicates so that devs don't have to worry about whether
      // someone else pushed the same asset.
      var once = {};
      var results = _.filter(assets, function(asset) {
        if (minifiable !== undefined) {
          if (minifiable === true) {
            if (asset.minify === false) {
              return false;
            }
          }
          if (minifiable === false) {
            if (asset.minify !== false) {
              return false;
            }
          }
        }
        var relevant;
        if (asset.when === 'lean') {
          relevant = true;
        } else if ((!self.options.lean) || (asset.type !== 'script' && asset.type !== 'stylesheet')) {
          // Traditional logic
          relevant = (asset.when === 'always') || (when === 'all') || (asset.when === when);
        } else {
          // Override
          relevant = ((when === 'user') && (asset.when === 'always')) ||
            (asset.when === 'lean') ||
            // Has this ever been used?
            (when === 'all') ||
            (asset.when === when);
        }

        if (!relevant) {
          return false;
        }
        var key = asset.name + ':' + asset.fs + ':' + asset.web;
        if (once[key]) {
          return false;
        }
        once[key] = true;
        return true;
      });
      return results;
    };

    // Override pushConfigured so that self configured assets are always served,
    // unless specified otherwise

    self.pushConfigured = function() {
      _.each(self.options.stylesheets || [], function(item) {
        self.pushAsset('stylesheet', item.name, self.options.lean ? self.setWhenIfNotConfigured(item, 'lean') : item);
      });
      _.each(self.options.scripts || [], function(item) {
        self.pushAsset('script', item.name, self.options.lean ? self.setWhenIfNotConfigured(item, 'lean') : item);
      });
    };

    // If "when" is not specified, specify a default

    self.setWhenIfNotConfigured = function(item, defaultWhen) {
      if (!('when' in item)) {
        item['when'] = defaultWhen;
      }
      return item;
    };

    // Fetch an asset chain by name. Note that the
    // name of the chain for a project-level override
    // of the "foo" module is "my-foo". If namespaced
    // and a project level override, it is "@namespace/my-foo".
    // Otherwise it is the name of the module.

    self.getChain = function(name) {
      return self.chains[name];
    };

    self.pushDefaults = function() {
      _.each(self.stylesheets || [], function(item) {
        self.pushAsset('stylesheet', item.name, item);
      });
      _.each(self.scripts || [], function(item) {
        self.pushAsset('script', item.name, item);
      });
    };

    self.modulesReady = function() {
      // Push project-level configured assets last, to make it easier to
      // override Apostrophe-level styles
      self.pushConfigured();
    };

    self.splitWithBless = function(filename, content) {
      var output = path.dirname(filename);
      new (bless.Parser)({
        output: output,
        options: {}
      }).parse(content.toString(), function (err, files) {
        if (err) {
          throw err;
        }
        if (files.length === 1) {
          // No splitting needed, small enough for <= IE9 already
          if (!fs.existsSync(filename)) {
            fs.writeFileSync(filename, content);
          }
          return;
        }
        var master = '';
        var n = 1;
        _.each(files, function(file) {
          var filePath = addN(filename);
          var basename = path.basename(filename);
          var webPath = addN(basename);
          fs.writeFileSync(filePath, file.content);
          master += '@import url("' + webPath + '");\n';
          n++;
        });
        function addN(filename) {
          return filename.replace(/\.css$/, '-' + n + '.css');
        }
        fs.writeFileSync(filename, master);
      });
    };

    self.enableCsrf = function() {
      // turn on CSRF protection
      self.apos.push.browserCall('always', 'apos.csrf()');
    };

    self.enableHtmlPageId = function() {
      // turn on unique identifier header for all requests
      // generated by the same instance of an HTML page in the browser
      self.apos.push.browserCall('user', 'apos.enableHtmlPageId()');
    };

    self.enablePrefix = function() {
      // ensure that all $.ajax and related jquery calls
      // respect Apostrophe's prefix automatically
      self.apos.push.browserCall('always', 'apos.prefixAjax()');
    };

    self.enableLessMiddleware = function() {
      var lessMiddlewareOptions = {
        // Source map support in the middleware. This is cool, however:
        // https://github.com/less/less.js/issues/2033
        // Limits the usefulness until Chrome and Firefox get clued up
        render: {
          sourceMap: {
            sourceMapFileInline: true,
            sourceMapBasepath: self.apos.rootDir + '/public',
            // otherwise paths wind up prefixed with an extra /css and browsers
            // cannot find them
            sourceMapRootpath: '..'
          }
        },
        postprocess: {
          css: function(css, req) {
            if (!self.apos.prefix) {
              return css;
            }
            css = self.prefixCssUrls(css);
            return css;
          },
          sourcemap: function(sourcemap, req) {
            return sourcemap;
          }
        },

        // If requested, use BLESS to split CSS into multiple files
        // for <=IE9, but only if there's enough to make it necessary
        storeCss: function(pathname, css, req, next) {
          if (!self.options.bless) {
            fs.writeFileSync(pathname, css);
            return next();
          }
          self.splitWithBless(pathname, css);
          return next();
        }
      };
      _.merge(lessMiddlewareOptions.render, self.options.less || {});
      self.lessMiddleware = lessMiddleware(self.apos.rootDir + '/public', lessMiddlewareOptions,
        {
          // parser options
        },
        {
          compress: false
        }
      );
    };

    // Prefix all URLs in CSS with the global site prefix
    self.prefixCssUrls = function(css) {
      return self.prefixCssUrlsWith(css, self.apos.prefix);
    };

    // Prefix all URLs in CSS with a particular string
    self.prefixCssUrlsWith = function(css, prefix) {
      css = css.replace(/url\(([^'"].*?)\)/g, function(s, url) {
        if (url.match(/^\//)) {
          url = prefix + url;
        }
        return 'url(' + url + ')';
      });
      css = css.replace(/url\("(.+?)"\)/g, function(s, url) {
        if (url.match(/^\//)) {
          url = prefix + url;
        }
        return 'url("' + url + '")';
      });
      css = css.replace(/url\('(.+?)'\)/g, function(s, url) {
        if (url.match(/^\//)) {
          url = prefix + url;
        }
        return 'url(\'' + url + '\')';
      });
      return css;
    };

    self.servePublicAssets = function() {
      var middleware = [];
      if (self.lessMiddleware) {
        // bc: only if the new implementation of enableLessMiddleware is in place.
        // If it's an old override, it'll already be added to Express and
        // this property won't be set
        middleware.push(self.lessMiddleware);
      }
      middleware.push(self.apos.express.static(
        self.apos.rootDir + '/public',
        self.options.static || {}
      ));
      self.expressMiddleware = {
        // Run really early, before all of the stuff apostrophe-express normally
        // puts in, for performance reasons. Preempts expensive
        // queries related to `apostrophe-global` on every static file
        when: 'beforeRequired',
        middleware: middleware
      };
    };

    // Given the site-relative URL an asset would have when hosting assets locally,
    // return the asset URL to be used in script or link tags. Often the same, but
    // when APOS_BUNDLE is in effect it can point elsewhere

    self.assetUrl = function(web) {
      if (process.env.APOS_BUNDLE_IN_UPLOADFS || self.simpleBundle) {
        return self.uploadfs().getUrl() + self.getGenerationPath() + web;
      }
      return self.apos.prefix + web;
    };

    self.getCoreAposProperties = function(when) {
      var req = self.apos.templates.contextReq;
      var expressModule = self.apos.modules['apostrophe-express'];
      var properties = _.assign(
        _.pick(self.apos, 'prefix', 'csrfCookieName'),
        (when === 'user')
          ? {
          // A unique identifier for the lifetime of this
          // HTML page in the browser
            htmlPageId: self.apos.utils.generateId()
          } : {},
        {
          uploadsUrl: self.apos.attachments.uploadfs.getUrl()
        }
      );
      if (!req.user && (expressModule.options.csrf && expressModule.options.csrf.disableAnonSession)) {
        properties.csrfCookieName = false;
      }
      return properties;
    };

    // This task is primarily implemented by the logic in afterInit, however
    // if we are sending a bundle to uploadfs this is a fine time to do
    // that part.

    self.generationTask = function(callback) {
      return async.series([
        copyFilesToUploadfs,
        copyTarballToGenerationCollection
      ], function(err) {
        return callback(err);
      });

      function copyFilesToUploadfs(callback) {
        if (!(self.apos.argv['sync-to-uploadfs'] || (self.isGenerationTask && self.simpleBundle))) {
          return callback(null);
        }
        return self.syncToUploadfs(self.toBundle + '/public',
          self.getGenerationPath(), callback);
      }

      function copyTarballToGenerationCollection(callback) {
        if (!self.simpleBundle) {
          return callback(null);
        }
        // `true`, rather than an explicit bundle name, means we should copy it to a tarfile in
        // uploadfs with a name based on the bundle id and record the bundle id in the
        // database so we can find it later at startup time
        var temp = self.getUploadfsBundleTempName();
        return spawn('tar', [ '-zcf', temp, '-C', self.toBundle, '.' ]).then(function() {
          return self.generationCollection.update({
            _id: self.getThemed('current')
          }, {
            $set: {
              tarball: Binary(fs.readFileSync(temp))
            }
          });
        }).then(function() {
          return callback(null);
        }).catch(callback);
      }
    };

    self.getUploadfsBundleTempName = function() {
      const temp = self.apos.rootDir + '/data/temp';
      if (!self.__tempMkdir) {
        self.mkdirp(temp);
        self.__tempMkdir = true;
      }
      return temp + '/assets-' + self.getThemedGeneration() + '.tar.gz';
    };

    self.getUploadfsBundlePath = function() {
      return '/asset-tarballs/assets-' + self.getThemedGeneration() + '.tar.gz';
    };

    // Implementation of stylesheeets helper, as a method for
    // easier use of super pattern to extend it. See the
    // documentation for the stylesheets helper. Name is
    // suffixed to avoid a conflict with a property.

    self.stylesheetsHelper = function(when) {
      if (self.options.minify) {
        return self.apos.templates.safe('<link href="' + self.assetUrl('/apos-minified/' + when + '-' + self.getThemedGeneration() + '.css') + '" rel="stylesheet" />');
      } else {
        if (self.lessMasters && self.lessMasters[when]) {
          return self.apos.templates.safe('<link href="' + self.assetUrl(self.lessMasters[when].web) + '" rel="stylesheet" />');
        }
        return self.apos.templates.safe(_.map(self.filterAssets(self.pushed['stylesheets'], when), function(stylesheet) {
          return '<link href="' + self.assetUrl(stylesheet.web) + '" rel="stylesheet" />';
        }).join("\n"));
      }
    };

    // Implementation of scripts helper, as a method for
    // easier use of super pattern to extend it. See the
    // documentation for the scripts helper. Name is
    // suffixed to avoid a conflict with a property.

    self.scriptsHelper = function(when) {
      var result = '<script>\n' +
        'window.apos = ' + JSON.stringify(
        self.getCoreAposProperties(when)
      ) + '\n' +
        '</script>\n'
      ;
      if (self.options.minify) {
        var unminifiable = self.filterAssets(self.pushed['scripts'], when, false);
        result += scriptTags(unminifiable);
        result += '<script src="' + self.assetUrl('/apos-minified/' + when + '-' + self.getThemedGeneration() + '.js') + '"></script>\n';
        return self.apos.templates.safe(result);
      } else {
        var scriptsWhen = self.filterAssets(self.pushed['scripts'], when);
        result += scriptTags(scriptsWhen);
        return self.apos.templates.safe(result);
      }

      function scriptTags(scripts) {
        return _.map(scripts, function(script) {
          return '<script src="' + self.assetUrl(script.web) + '"></script>';
        }).join("\n");
      }
    };

    // Override point to use a separate uploadfs instance, for
    // instance in a multisite project with shared assets
    self.uploadfs = function() {
      return self.apos.attachments.uploadfs;
    };

    self.addHelpers({
      // apos.assets.stylesheets renders markup to load CSS that
      // is needed on any page that will use Apostrophe.
      //
      // `when` can be set to either `user` or `anon` and signifies
      // whether a user is logged in or not; when users are
      // logged in editing-related stylesheets are sent,
      // otherwise not.
      //
      // The `when` parameter is made available to your page templates, so typically you
      // just write this in your base layout template in the head element:
      //
      // ```markup
      // {{ apos.assets.stylesheets(data.when) }}
      // ```
      //
      // See `outerLayout.html` in the templates module.

      stylesheets: function(when) {
        return self.stylesheetsHelper(when);
      },

      // apos.assets.scripts renders markup to load JS that
      // is needed on any page that will use Apostrophe.
      //
      // `when` can be set to either `user` or `anon` and signifies
      // whether a user is logged in or not; when users are
      // logged in editing-related scripts are sent,
      // otherwise not.
      //
      // The `when` parameter is made available to your page
      // templates, so typically you just write this in
      // outerLayout.html:
      //
      // ```markup
      // {{ apos.assets.scripts(data.when) }}
      // ```
      //
      // See `outerLayout.html` in the templates module.
      //
      // apos.assets.scripts also creates the apos object,
      // with its prefix property, so that beforeCkeditor.js
      // and other third party loaders can see the prefix
      // even before our own javascript is loaded.

      scripts: function(when) {
        return self.scriptsHelper(when);
      },

      // Removed in 2.x, however a nonfunctional version
      // did appear at first in 2.x, so we provide
      // an empty function for bc in case someone calls it.

      templates: function(when) {
        return '';
      }
    });

    // This totally stinks, but it would be a bc break to
    // delay this to afterConstruct now because people have
    // already started appending to the arrays at project level
    // in construct. -Tom
    self.setDefaultStylesheets();
    self.setDefaultScripts();

    self.on('apostrophe:destroy', 'closeWatches', function() {
      self.lessCssWatches.forEach(function(watch) {
        watch.close();
      });
    });

    self.pushCreateSingleton = function() {
      // There is no shortcut to "always" push a singleton,
      // so implement that here
      self.apos.push.browserCall('always',
        'apos.create("apostrophe-assets", ?)',
        {
          lean: self.options.lean
        }
      );
    };

    self.getGenerationPath = function() {
      return '/assets/' + self.getThemedGeneration();
    };

    self.getThemedGeneration = function() {
      return self.getThemed(self.generation);
    };

    self.getThemed = function(s) {
      var theme = self.getThemeName();
      if (theme) {
        return theme + '-' + s;
      }
      return s;
    };

    // Can be overridden by modules like apostrophe-multisite
    // to namespace minified asset bundles and LESS masters.
    // Env var option is for unit testing only
    self.getThemeName = function() {
      return process.env.APOS_DEBUG_THEME || '';
    };
  }
};

// Run cmd with the specified command args. Returns a promise. Resolves
// with the output written to standard output by the command on success.
// On error, rejects with the nonzero status code of the command.

function spawn(cmd, args) {
  return Promise.promisify(spawnCb)(cmd, args);
}

function spawnCb(cmd, args, callback) {
  let output = '';
  const p = require('child_process').spawn(cmd, args);
  p.on('close', function(code) {
    if (!code) {
      return callback(null, output);
    }
    return callback(code);
  });
  p.stdout.on('data', function(data) {
    output += data;
  });
}
