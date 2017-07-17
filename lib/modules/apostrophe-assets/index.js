// This module provides minification and delivery of browser-side assets
// such as stylesheets and javascript.
//
// **You'll want to call the
// `pushAsset` method of *your own* module**, which takes advantage
// of the services provided by this module thanks to
// the [apostrophe-module](../apostrophe-module/index.html) base class.
//
// Apostrophe implements two "asset scenes," `anon` and `user`. When
// you call `self.pushAsset('script', 'myfile', { scene: 'user' })`, that
// script is normally pushed only to logged-in users. When you call
// `self.pushAsset('script', 'myfile', { scene: 'always' })`, that script is
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
// If set to true, both stylesheets and scripts are combined into a single file
// and unnecessary whitespace removed to speed delivery. It is strongly recommended
// that you enable this option in production, and also in staging so you can see
// any unexpected effects. If this option is undefined, the APOS_MINIFY
// environment variable is consulted.

var path = require('path');
var fs = require('fs');

var _ = require('lodash');
var async = require('async');
// JS minifier and optimizer
var uglifyJs = require('uglify-js');
// LESS CSS compiler
var less = require('less');
var moment = require('moment');
var glob = require('glob');
var bless = require('bless');
var lessMiddleware = require('less-middleware');
var rimraf = require('rimraf');

module.exports = {

  alias: 'assets',

  afterConstruct: function(self) {
    self.apos.tasks.add('apostrophe', 'generation',
      'Run this task to generate new minified assets and perform other pre-startup\n' +
      'tasks, then exit. This happens on a normal startup too, but if you are running\n' +
      'multiple processes or servers you should avoid race conditions by running\n' +
      'this task before starting them all.\n\n' +
      'To create a bundle folder for later use on a production server, use the\n' +
      '--create-bundle=NAME option. Later, on production, start the site normally\n' +
      'with the APOS_BUNDLE environment variable set to the same NAME.',
      function(apos, argv, callback) {
        return self.generationTask(callback);
      }
    );

    self.enableBundles();
    self.setAssetTypes();
    self.setTypeMap();
    self.enableCsrf();
    self.enablePrefix();
    self.determineGeneration();
    self.enableLessMiddleware();
    self.servePublicAssets();
    self.pushDefaults();

  },

  beforeConstruct: function(self, options) {
    if (options.minify === undefined) {
      options.minify = options.apos.launder.boolean(process.env.APOS_MINIFY);
    }
  },

  construct: function(self, options) {

    self.minified = {};
    // Templates pulled into the page by the aposTemplates() Express local
    // These are typically hidden at first by CSS and cloned as needed by jQuery
    self.templates = [];

    // Full paths to assets as computed by pushAsset
    self.pushed = { stylesheets: [], scripts: [], templates: [] };

    self.tooLateToPushAssets = false;

    // For generating unique keys cheaply
    self.ordinal = 0;

    self.setDefaultStylesheets = function() {
      // Default stylesheet requirements
      self.stylesheets = [
        // Must have a jQuery UI theme or acceptable substitute for
        // autocomplete and datepickers to be usable. -Tom
        { name: 'vendor/jquery-ui', when: 'always' },
        { name: 'vendor/pikaday', when: 'always' },
        // { name: 'vendor/jquery.Jcrop', when: 'user' }
        { name: 'vendor/cropper', when: 'user' }
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
        { name: 'vendor/jquery', when: 'always' },
        // For parsing query parameters browser-side
        { name: 'vendor/jquery-url-parser', when: 'always' },
        // For blueimp uploader, drag and drop reordering of anything
        // & autocomplete
        { name: 'vendor/jquery-ui', when: 'always' },
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
        },
        template: {
          fs: 'views',
          key: 'templates',
          serve: 'fs',
          ext: 'html'
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

    self.determineGeneration = function() {

      self.isGenerationTask = (self.apos.argv._[0] === 'apostrophe:generation');

      var generation;

      if (self.isGenerationTask) {

        if (self.apos.argv['create-bundle']) {
          self.toBundleName = self.apos.argv['create-bundle'];
          self.toBundle = self.apos.rootDir + '/' + self.toBundleName;
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
              fs.mkdirSync(folder);
            }
          });
        }

        // Create a new generation identifier. The assets module
        // will use this to create asset files that are distinctly
        // named on a new deployment.
        generation = self.apos.utils.generateId();
        fs.writeFileSync(self.getAssetRoot() + '/data/generation', generation);
      }

      if (fs.existsSync(self.getAssetRoot() + '/data/generation')) {
        generation = fs.readFileSync(self.getAssetRoot() + '/data/generation', 'utf8');
        generation = generation.replace(/[^\d]/g, '');
      }

      if (!generation) {
        // In a dev environment, we can just use the pid
        generation = self.apos.pid;
      }

      self.generation = generation;
    };

    // Initialize services required for asset bundles. Obtains the
    // self.generations mongodb collection, extracts a bundle if appropriate,
    // and initializes cleanup of old bundles in uploadfs if appropriate.

    self.enableBundles = function() {
      self.generations = self.apos.db.collection('apostropheGenerations');
      self.extractBundleIfAppropriate();
      self.uploadfsBundleCleanup();
    };

    // Extract an asset bundle if appropriate. The default implementation
    // looks for an APOS_BUNDLE=XYZ environment variable and, if present, extracts
    // a bundle with the name XYZ

    self.extractBundleIfAppropriate = function() {
      if (process.env.APOS_BUNDLE) {
        self.extractBundle(process.env.APOS_BUNDLE);
        self.fromBundle = true;
      }
    };
    
    // Clean up old asset bundles in uploadfs, if any, after a
    // suitably safe interval allowing services such as Heroku to
    // shut down old instances that might be using them

    self.uploadfsBundleCleanup = function() {

      if (!process.env.APOS_BUNDLE_IN_UPLOADFS) {
        return;
      }

      var locked = false;

      setTimeout(cleanup, 5 * 1000 * 60);

      function cleanup() {
        return async.series([
          lock,
          find,
          remove
        ], function(err) {
          if (locked) {
            return self.apos.locks.unlock(self.__meta.name, function(_err) {
              if (err || _err) {
                // Failure to remove old asset bundles is a nonfatal error,
                // the next deployment will get them
                console.error(err || _err);
              }
            });
          } else {
            if (err) {
              // Failure to remove old asset bundles is a nonfatal error,
              // the next deployment will get them
              console.error(err);
            }
          }
        });

        function lock(callback) {
          return self.apos.locks.lock(self.__meta.name, function(err) {
            locked = !err;
            return callback(null);
          });
        }

        function find(callback) {
          return self.generations.find().sort({ when: 1 }).toArray(function(err, _generations) {
            generations = _generations;
            return callback(err);
          });
        }
        
        function remove(callback) {
          var current = _.find(generations, { _id: self.generation });
          return async.eachSeries(generations, function(generation, callback) {
            if (generation.when >= current.when) {
              return setImmediate(callback);
            }
            return removeGeneration(generation, callback);
          });
        }
        
        function removeGeneration(generation, callback) {
          return async.series([
            removeFiles,
            removeIt
          ], callback);
          
          function removeFiles(callback) {
            return async.eachLimit(generation.copies, 5, function(copy, callback) {
              return self.apos.attachments.uploadfs.remove(copy.to, function(err) {
                // Failure to remove a stale asset is nonfatal
                if (err) {
                  console.error(err);
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
    // self.pushAsset('template', 'foo', {
    //   when: 'always'
    // },
    // {
    //   dirname: '/path/to/module',
    //   name: 'apostrophe-modulename',
    //   data: { passed to template }
    // })
    //
    // Or:
    //
    // self.pushAsset('template', function(req, data) {}, {
    //   when: 'always',
    //   data: { passed to function }
    // })

    // Other types: 'stylesheet', 'script'. Unlike 'template' these
    // may not be generated by a function.

    // Templates not generated by a function are loaded from
    // the module's views/ folder.

    // Stylesheets are loaded from the module's public/css folder.

    // Scripts are loaded from the module's public/js folder.

    // Do not supply the file extension.

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

      if (typeof(name) === 'function') {
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
        self.pushed[self.assetTypes[type].key].push({ type: type, file: filePath, web: webPath, data: data, preshrunk: options.preshrunk, when: when, minify: options.minify });
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
        return setImmediate(callback);
      }

      self.tooLateToPushAssets = true;

      if (self.fromBundle) {
        // We extracted an asset bundle that already contains everything
        return setImmediate(callback);
      }

      self.ensureFolder();

      // Create symbolic links in /modules so that our web paths can be
      // served by a static server like nginx

      return async.series([
          self.symlinkModules,
          self.buildLessMasters,
          self.minify,
          self.outputAndBless
        ], function(err) {
        if (err) {
          return callback(err);
        }
        return callback(null);
      });
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
      if (process.platform.match(/^win/)) {
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
        var stat = fs.lstatSync(from);
        // Symbolic link exists, remove it so we can replace it with
        // a valid one
        fs.unlinkSync(from);
      } catch (e) {
        // Old symbolic link does not exist, that's fine
      }
      // Pass type option for Windows compatibility, hopefully
      fs.symlinkSync(to, from, 'dir');
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
        var stat = fs.lstatSync(to);
        if (stat.isSymbolicLink()) {
          try {
            fs.unlinkSync(to);
          } catch (e) {
            console.error('WARNING: old style symbolic link exists at ' + to + ' and I do not have the privileges to remove it. You probably ran this site as Administrator before. Remove that symbolic link and the others in that folder as Administrator and try again as this non-Administrator user.');
            process.exit(1);
          }
        } else {
          rimraf.sync(to);
        }
      }
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
        var buffer = new Buffer(chunkSize);
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
      var oldCopies = [];

      enumerateDir(from, to);

      return async.series([
        performCopies,
        storeGeneration
      ], callback);

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
                        
      function performCopies(callback) {
        return async.eachLimit(copies, 5, function(copy, callback) {
          return self.apos.attachments.uploadfs.copyIn(copy.from, copy.to, callback);
        }, callback);
      }

      function storeGeneration(callback) {
        return self.generations.insert({ _id: self.generation, copies: copies, when: new Date() }, callback);
      }

    };

    self.buildLessMasters = function(callback) {
      self.lessMasters = {};
      // Compile all LESS files as one. This is awesome because it allows
      // mixins to be shared between modules for better code reuse. It also
      // allows you to redefine mixins in a later module; if you do so, they
      // are retroactive to the very first use of the mixin. So apostrophe-ui-2
      // can alter decisions made in the apostrophe module, for instance.
      return self.forAllAssetScenes(function(scene, callback) {
        var base = '/css/master-' + scene + '-';
        self.purgeExcept(base + '*', '-' + self.generation);
        var masterWeb = base + self.generation + '.less';
        var masterFile = self.getAssetRoot() + '/public' + masterWeb;
        var stylesheets = self.filterAssets(self.pushed.stylesheets, scene, true);
        // Avoid race conditions, if apostrophe:generation created
        // the file already leave it alone
        if (!fs.existsSync(masterFile)) {
          fs.writeFileSync(masterFile, _.map(stylesheets, function(stylesheet) {
            // Cope with the way we push .css but actually write .less
            // because of the middleware.
            var importName = stylesheet.web.replace('.css', '.less');
            if (!fs.existsSync(self.apos.rootDir + '/public' + importName)) {
              importName = stylesheet.web;
            }
            // For import what we need is a relative path which will work on
            // the filesystem too thanks to the symbolic links for modules
            var relPath = path.relative(path.dirname(masterWeb), importName);
            return '@import \'' + relPath + '\';';
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
          self.purgeExcept('/apos-minified/' + scene + '-*.' + self.typeMap[type], '-' + self.generation);
          var file = self.getAssetRoot() + '/public/apos-minified/' + scene + '-' + self.generation + '.' + self.typeMap[type];
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
            console.log('MINIFYING, this may take a minute...');
          }
          return self.minifySceneAssetType(scene, type, minifiers[type], callback);
        }, callback);
      }, function(err) {
        if (err) {
          return callback(err);
        }
        if (needed) {
          console.log('Minification complete.');
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
          var filename = dir + '/' + scene + '-' + self.generation + '.' + self.typeMap[type];
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
            return cache.set(key, code, callback);
          });
        }
      }, function(err) {
        return callback(err);
      });
    };

    self.minifyStylesheet = function(stylesheet, callback) {
      return self.compileStylesheet(stylesheet, function(err, code) {
        if (err) {
          return callback(err);
        }
        if (!self.cleanCss) {
          // CSS minifier https://github.com/GoalSmashers/clean-css
          var CleanCss = require('clean-css');
          self.cleanCss = new CleanCss({
            root: self.apos.rootDir + '/public/apos-minified'
          });
        }
        var minified = self.cleanCss.minify(code);
        if (minified.warnings.length) {
          console.error(minified.warnings.length);
        }
        if (minified.errors.length) {
          return callback(minified.errors);
        }
        minified = minified.styles;
        return callback(null, minified);
      });
    };

    // Minify a single JavaScript file (via the script.file property)
    self.minifyScript = function(script, callback) {
      // For now we don't actually need async for scripts, but now
      // we have the option of going there
      var exists = fs.existsSync(script.file);
      if (!exists) {
        console.log("Warning: " + script.file + " does not exist");
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
          console.error(message);
          throw e;
        }
      }
      return callback(null, code);
    };

    self.compileStylesheet = function(stylesheet, callback) {
      var result;
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
        console.log('WARNING: stylesheet ' + stylesheet.file + ' does not exist');
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
          console.error('LESS CSS ERROR:');
          console.error(err);
        }
        css = css.css;
        if (self.apos.argv['sync-to-uploadfs']) {
          css = self.prefixCssUrlsWith(css, self.apos.attachments.uploadfs.getUrl() + '/assets/' + self.generation);
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
        var relevant = (asset.when === 'always') || (when === 'all') || (asset.when === when);
        if (!relevant) {
          return false;
        }
        if (asset.call) {
          // We can't stomp duplicates for templates rendered by functions
          return true;
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

    // Fetch an asset chain by name. Note that the
    // name of the chain for a project-level override
    // of the "foo" module is "my-foo". Otherwise it
    // is the name of the module.

    self.getChain = function(name) {
      return self.chains[name];
    };

    self.pushDefaults = function() {
      var i;
      _.each(self.stylesheets || [], function(item) {
        self.pushAsset('stylesheet', item.name, item);
      });
      _.each(self.scripts || [], function(item) {
        self.pushAsset('script', item.name, item);
      });
      _.each(self.templates || [], function(item) {
        self.pushAsset('template', item.name, item);
      });
    };

    self.modulesReady = function() {
      // Push project-level configured assets last, to make it easier to
      // override Apostrophe-level styles
      self.pushConfigured();
    };

    self.pushConfigured = function() {
      var i;
      _.each(self.options.stylesheets || [], function(item) {
        self.pushAsset('stylesheet', item.name, item);
      });
      _.each(self.options.scripts || [], function(item) {
        self.pushAsset('script', item.name, item);
      });
      _.each(self.options.templates || [], function(item) {
        self.pushAsset('template', item.name, item);
      });
    };

    // Render a template asset (a DOM template), taking the
    // locale into account correctly for i18n

    self.renderTemplateAsset = function(req, asset) {
      if (asset.call) {
        return asset.call(asset.data);
      } else {
        return self.apos.templates.render(path.basename(asset.file), asset.data, [ { dirname: path.dirname(asset.file) } ]);
      }
    };

    // Return a string that uniquely identifies this asset for purposes of
    // determining whether two scenes both contain it. Not guaranteed to
    // be a particularly short string. Not currently implemented
    // for DOM templates

    self.assetKey = function(asset) {
      if (asset.type === 'template') {
        // Right now we don't try to diff these because of the
        // complexity of taking locales into account and the need
        // to render them as part of computing the key. Extra DOM
        // templates don't cost much. So for now, always return a unique key.
        // This way we wind up sending everything 'user' needs
        // if we are asked for 'anon.user'.
        //
        // To change this we would have to add locales to this picture
        // in a comprehensive way.
        return self.ordinal++;
      }
      // It's a stylesheet or script. The full path to the file
      // is an acceptable key.
      return asset.file;
    };

    self.splitWithBless = function(filename, content) {
      var output = path.dirname(filename);
      new (bless.Parser)({
        output: output,
        options: {}
      }).parse(content.toString(), function (err, files) {
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
      
      self.apos.app.use(lessMiddleware(self.apos.rootDir + '/public', lessMiddlewareOptions,
        {
          // parser options
        },
        {
          compress: false
        }
      ));
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
      css = css.replace(/url\(\"(.+?)\"\)/g, function(s, url) {
        if (url.match(/^\//)) {
          url = prefix + url;
        }
        return 'url("' + url + '")';
      });
      css = css.replace(/url\(\'(.+?)\'\)/g, function(s, url) {
        if (url.match(/^\//)) {
          url = prefix + url;
        }
        return 'url(\'' + url + '\')';
      });
      return css;
    };

    self.servePublicAssets = function() {
      self.apos.app.use(self.apos.express.static(self.apos.rootDir + '/public'));
    };

    // Given the site-relative URL an asset would have when hosting assets locally,
    // return the asset URL to be used in script or link tags. Often the same, but
    // when APOS_S3_BUNDLE is in effect it can point elsewhere

    self.assetUrl = function(web) {
      if (process.env.APOS_BUNDLE_IN_UPLOADFS) {
        return self.apos.attachments.uploadfs.getUrl() + '/assets/' + self.generation + web;
      }
      return self.apos.prefix + web;
    };
    
    // This task is primarily implemented by the logic in afterInit, however
    // if we are sending a bundle to uploadfs this is a fine time to do
    // that part.

    self.generationTask = function(callback) {
      if (self.apos.argv['sync-to-uploadfs']) {
        return self.syncToUploadfs(self.apos.rootDir + '/' + self.toBundleName + '/public',
          '/assets/' + self.generation, callback);
      }
      return callback(null);
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
      // `{{ apos.assets.stylesheets(data.when) }}`
      //
      // See `outerLayout.html` in the templates module.

      stylesheets: function(when) {
        if (self.options.minify) {
          return self.apos.templates.safe('<link href="' + self.assetUrl('/apos-minified/' + when + '-' + self.generation + '.css') + '" rel="stylesheet" />');
        } else {
          if (self.lessMasters && self.lessMasters[when]) {
            return self.apos.templates.safe('<link href="' + self.assetUrl(self.lessMasters[when].web) + '" rel="stylesheet" />');
          }
          return self.apos.templates.safe(_.map(self.filterAssets(self.pushed['stylesheets'], when), function(stylesheet) {
            return '<link href="' + self.assetUrl(stylesheet.web) + '" rel="stylesheet" />';
          }).join("\n"));
        }
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
      // `{{ apos.assets.scripts(data.when) }}`
      //
      // See `outerLayout.html` in the templates module.
      //
      // apos.assets.scripts also creates the apos object,
      // with its prefix property, so that beforeCkeditor.js
      // and other third party loaders can see the prefix
      // even before our own javascript is loaded.

      scripts: function(when) {
        var result = '<script>\n' +
          'window.apos = ' + JSON.stringify(_.pick(self.apos, 'prefix', 'csrfCookieName')) +
            '\n' +
          '</script>\n';
        if (self.options.minify) {
          var unminifiable = self.filterAssets(self.pushed['scripts'], when, false);
          result += scriptTags(unminifiable);
          result += '<script src="' + self.assetUrl('/apos-minified/' + when + '-' + self.generation + '.js') + '"></script>\n';
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
      },

      // apos.assets.templates renders templates that are needed
      // on all pages. Examples: slideshowEditor.html,
      // codeEditor.html, etc. These lie dormant in the page
      // until they are needed as prototypes to be cloned by
      // jQuery. `when` can be set to either `user` or `anon`
      // and signifies whether a user is logged in or not; when
      // users are logged in editing-related templates are sent,
      // otherwise not. The `when` parameter is made available to
      // your page templates, so typically you just write this
      // in outerLayout.html at the end of the body:
      //
      // `{{ apos.assets.templates(when) }}`

      templates: function(when) {
        if (!when) {
          when = 'all';
        }
        var templates = self.pushed['templates'];
        templates = self.filterAssets(templates, when);
        return self.apos.templates.safe(_.map(templates, function(template) {
          return self.renderTemplateAsset(template).trim();
        }).join(''));
      }
    });

    // This totally stinks, but it would be a bc break to
    // delay this to afterConstruct now because people have
    // already started appending to the arrays at project level
    // in construct. -Tom
    self.setDefaultStylesheets();
    self.setDefaultScripts();

  }
};
