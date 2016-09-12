var path = require('path');
var extend = require('extend');
var _ = require('lodash');
var sanitize = require('validator').sanitize;
var async = require('async');
var fs = require('fs');
// JS minifier and optimizer
var uglifyJs = require('uglify-js');
// CSS minifier https://github.com/GoalSmashers/clean-css
var cleanCss = require('clean-css');
// LESS CSS compiler
var less = require('less');
var moment = require('moment');
var glob = require('glob');

/**
 * assets
 * @augments Augments the apos object with methods, routes and
 * properties supporting the serving of specific assets (CSS, templates and
 * browser-side JavaScript) required by Apostrophe.
 * @see static
 */

module.exports = {
  /**
   * Augment apos object with resources necessary prior to init() call
   * @param  {Object} self  The apos object
   */
  construct: function(self) {
    // Default stylesheet requirements
    // TODO: lots of override options
    var stylesheets = [
      // Has a subdirectory of relative image paths so give it a folder
      { name: "_site", when: 'always' },
      { name: "_user", when: 'user' },
      // Load this *after* the "content" stylesheet which can contain fonts.
      // Font imports must come first. It's a pain.
      { name: "jquery-ui-darkness/jquery-ui-darkness", when: 'always' }
    ];

    // Default browser side script requirements
    // TODO: lots of override options
    var scripts = [
      // VENDOR DEPENDENCIES

      // polyfill setImmediate, much faster than setTimeout(fn, 0)
      { name: 'vendor/setImmediate', when: 'always' },
      // For elegant, cross-browser functional-style programming
      { name: 'vendor/lodash.compat', when: 'always' },
      // For async code without tears
      { name: 'vendor/async', when: 'always' },
      // For everything DOM-related
      { name: 'vendor/jquery', when: 'always' },
      // For parsing query parameters browser-side
      { name: 'vendor/jquery-url-parser', when: 'always' },
      // For blueimp uploader, drag and drop reordering of anything, datepicker
      // & autocomplete
      { name: 'vendor/jquery-ui', when: 'always' },
      // For the RTE
      { name: 'vendor/jquery-hotkeys', when: 'user' },
      // Graceful fallback for older browsers for jquery fileupload
      { name: 'vendor/jquery.iframe-transport', when: 'user' },
      // Spiffy multiple file upload
      { name: 'vendor/jquery.fileupload', when: 'user' },
      // imaging cropping plugin
      { name: 'vendor/jquery.Jcrop.min', when: 'user' },
      // textchange event, detects actual typing activity, not just focus change
      { name: 'vendor/jquery-textchange', when: 'always' },
      // Ability to set text selection with setSelection(). This was missing for a while after we removed rangy,
      // and it turns out some of our widgets do use it
      { name: 'vendor/jquery-rangy-inputs', when: 'user' },
      // select element enhancement plugin
      { name: 'vendor/selectize', when: 'always' },
      // Set, get and delete cookies in browser-side JavaScript
      { name: 'vendor/jquery.cookie', when: 'always' },
      { name: 'vendor/jquery.findSafe', when: 'user' },
      { name: 'vendor/sluggo', when: 'user' },
      // i18n helper
      { name: 'vendor/polyglot', when: 'always' },
      // Scroll things into view, even if they are in a scrolling
      // container which itself needs to be scrolled into view or
      // whatever, it's pretty great:
      //
      // http://erraticdev.blogspot.com/2011/02/jquery-scroll-into-view-plugin-with.html
      //
      // (Note recent comments, it's actively maintained). -Tom
      { name: 'vendor/jquery.scrollintoview', when: 'user' },

      // PUNKAVE-MAINTAINED, GENERAL PURPOSE JQUERY PLUGINS

      { name: 'vendor/jquery.get-outer-html', when: 'always' },
      { name: 'vendor/jquery.find-by-name', when: 'always' },
      { name: 'vendor/jquery.projector', when: 'always' },
      { name: 'vendor/jquery.bottomless', when: 'always' },
      { name: 'vendor/jquery.selective', when: 'always' },
      { name: 'vendor/jquery.images-ready', when: 'always' },
      { name: 'vendor/jquery.radio', when: 'always' },
      { name: 'vendor/jquery.json-call', when: 'always' },
      //N.B. This is version 0.5 of Joel's lister.js
      { name: 'vendor/jquery.lister', when: 'always' },

      // APOSTROPHE CORE JS

      // Viewers for standard content types
      { name: 'content', when: 'always' },
      // Editing functionality
      { name: 'user', when: 'user' },
      { name: 'permissions', when: 'user' },
      { name: 'widgets/editors/buttons', when: 'user' },
      { name: 'widgets/editors/code', when: 'user' },
      { name: 'widgets/editors/files', when: 'user' },
      { name: 'widgets/editors/html', when: 'user' },
      { name: 'widgets/editors/marquee', when: 'user' },
      { name: 'widgets/editors/pullquote', when: 'user' },
      { name: 'widgets/editors/slideshow', when: 'user' },
      { name: 'widgets/editors/video', when: 'user' },
      { name: 'widgets/editors/embed', when: 'user' },
      { name: 'widgets/editors/widget', when: 'user' },

      { name: 'annotator', when: 'user' },
      { name: 'mediaLibrary', when: 'user' },
      { name: 'tagEditor', when: 'user' }
    ];

    // Templates pulled into the page by the aposTemplates() Express local
    // These are typically hidden at first by CSS and cloned as needed by jQuery

    var templates = [
      { name: 'slideshowEditor', when: 'user' },
      { name: 'buttonsEditor', when: 'user' },
      { name: 'marqueeEditor', when: 'user' },
      { name: 'filesEditor', when: 'user' },
      { name: 'pullquoteEditor', when: 'user' },
      { name: 'videoEditor', when: 'user' },
      { name: 'embedEditor', when: 'user' },
      { name: 'codeEditor', when: 'user' },
      { name: 'htmlEditor', when: 'user' },
      { name: 'cropEditor', when: 'user' },
      { name: 'tableEditor', when: 'user' },
      { name: 'linkEditor', when: 'user' },
      { name: 'fileAnnotator', when: 'user' },
      { name: 'tagEditor', when: 'user' },
      { name: 'loginWindow', when: 'always' },
      { name: 'logoutWindow', when: 'user' },
      { name: 'notification', when: 'user' },
      { name: 'notificationsContainer', when: 'user' }
    ];

    // Full paths to assets as computed by pushAsset
    self._assets = { stylesheets: [], scripts: [], templates: [] };

    // Maps web paths of asset modules to filesystem paths, used by
    // endAssets
    self._assetPaths = {
      // The apostrophe module itself doesn't call the asset mixin that populates
      // the rest of this object, but does need a symlink for its assets
      '/modules/apos': path.dirname(__dirname)
    };

    self._assetTypes = {
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

    // `self.pushAsset('stylesheet', 'foo', { dir: __dirname, web: '/apos-mymodule', when: 'always' })` will preload
    // `/apos-mymodule/css/foo.css` at all times.
    //
    // `self.pushAsset('script', 'foo', { dir: __dirname, web: '/apos-mymodule', when: 'user' })` will preload
    // `/apos-mymodule/js/foo.js` only when a user is logged in.
    //
    // `self.pushAsset('template', 'foo', { dir: __dirname })` will render
    // the partial `{__dirname}/views/foo.html` at the bottom of the body
    // (`self.partial` will take care of adding the extension). Note
    // that 'web' is not used for templates.
    //
    // If you wish you may pass `options` as the second argument as long
    // as you include a `name` property in `options`.
    //
    // You may also write:
    // `self.pushAsset('template', function() { foo })`
    //
    // Which allows you to render the template in your own context and is typically
    // the easier way when pushing a template from a module like apostrophe-snippets.
    //
    // You may pass data to the template via the `data` option.
    //
    // The fs and web options default to `__dirname` and `/apos` for easy use in
    // the apostrophe module itself.
    //
    // Other modules typically have a wrapper method that passes them correctly
    // for their needs.
    //
    // You must pass BOTH fs and web for a stylesheet or script. This allows
    // minification, LESS compilation that is aware of relative base paths, etc.
    // fs should be the PARENT of the public folder, not the public folder itself.
    //
    // It is acceptable to push an asset more than once. Only one copy is sent, at
    // the earliest point requested.
    //
    // Returns true if an acceptable source file or function for the asset
    // exists, otherwise false.

    self.pushAsset = function(type, name, options) {
      var _fs, web, when;
      // Support just 2 arguments with the name as a property
      if (typeof(name) === 'object') {
        options = name;
        name = name.name;
      }
      if (typeof(options) === 'string') {
        // Support old order of parameters
        _fs = options;
        options = undefined;
        web = arguments[3];
      }
      if (options) {
        _fs = options.fs;
        web = options.web;
        when = options.when || 'always';
      } else {
        // bc
        when = 'always';
        options = {};
      }
      // Careful with the defaults on this, '' is not false for this purpose
      if (typeof(_fs) !== 'string') {
        _fs = __dirname + '/..';
      }
      if (typeof(web) !== 'string') {
        web = '/modules/apos';
      }

      var data = options ? options.data : undefined;

      if (typeof(name) === 'function') {
        self._assets[self._assetTypes[type].key].push({ call: name, data: data, when: when });
        return true;
      }

      var fileDir = _fs + '/' + self._assetTypes[type].fs;
      var webDir = web + '/' + self._assetTypes[type].web;

      var filePath = fileDir + '/' + name;
      if (self._assetTypes[type].ext) {
        filePath += '.' + self._assetTypes[type].ext;
      }
      var webPath = webDir + '/' + name;
      if (self._assetTypes[type].ext) {
        webPath += '.' + self._assetTypes[type].ext;
      }

      var exists = fs.existsSync(filePath);

      if (self._assetTypes[type].alternate && fs.existsSync(filePath.replace(/\.\w+$/, '.' + self._assetTypes[type].alternate))) {
        exists = true;
      } else if (fs.existsSync(filePath)) {
        exists = true;
      }
      if (exists) {
        self._assets[self._assetTypes[type].key].push({ file: filePath, web: webPath, data: data, preshrunk: options.preshrunk, when: when, minify: options.minify });
      }
      return exists;
    };

    self._endAssetsCalled = false;

    self._purgeExcept = function(pattern, exceptSubstring) {
      var old = glob.sync(self.options.rootDir + '/public/' + pattern);
      // Purge leftover masters from old asset generations. Do
      // not remove the current generation if it already exists.
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

    // You must call `apos.endAssets` when you are through pushing
    // assets. This is necessary because the LESS
    // compiler is no longer asynchronous, so we can't
    // wait for aposStylesheet calls in Nunjucks to
    // do the compilation.
    //
    // You may change the list of available scenes from just
    // `anon` and `user` via the `scenes` option when initializing
    // Apostrophe. Our official modules are only concerned with those two cases.
    // Assets pushed with `when` set to 'always' are
    // deployed in both scenes.
    //
    // Typically `apostrophe-site` calls this for you.

    self.endAssets = function(callback) {
      if (arguments.length === 2) {
        // bc with the two-argument version, which is deprecated
        callback = arguments[1];
      }
      // Emit an event so that any module that is waiting
      // for other modules to initialize knows this is the last
      // possible chance to push an asset
      self.emit('beforeEndAssets');
      self._endAssetsCalled = true;

      // Create symbolic links in /modules so that our web paths can be
      // served by a static server like nginx

      if (!self.options.rootDir) {
        return callback('You must set the rootDir option when configuring apostrophe (hint: stop calling apos.init yourself and just use apostrophe-site)');
      }

      // Name of both folder and extension in
      // public/ for this type of asset
      var typeMap = {
        scripts: 'js',
        stylesheets: 'css'
      };

      return async.series({
        linkModules: function(callback) {
          if (!fs.existsSync(self.options.rootDir + '/public/modules')) {
            fs.mkdirSync(self.options.rootDir + '/public/modules');
          }
          _.each(self._assetPaths, function(fsPath, web) {
            var from = self.options.rootDir + '/public' + web;
            var to = fsPath + '/public';
            if (fs.existsSync(to)) {
              self.relinkAssetFolder(from, to);
            }
          });
          return callback(null);
        },
        buildLessMasters: function(callback) {
          self._lessMasters = {};
          // Compile all LESS files as one. This is awesome because it allows
          // mixins to be shared between modules for better code reuse. It also
          // allows you to redefine mixins in a later module; if you do so, they
          // are retroactive to the very first use of the mixin. So apostrophe-ui-2
          // can alter decisions made in the apostrophe module, for instance.
          return self.forAllAssetScenesAndUpgrades(function(scene, callback) {
            var base = '/css/master-' + scene + '-';
            self._purgeExcept(base + '*', '-' + self._generation);
            var masterWeb = base + self._generation + '.less';
            var masterFile = self.options.rootDir + '/public' + masterWeb;
            var stylesheets = self.filterAssets(self._assets.stylesheets, scene, true);
            // Avoid race conditions, if apostrophe:generation created
            // the file already leave it alone
            if (!fs.existsSync(masterFile)) {
              fs.writeFileSync(masterFile, _.map(stylesheets, function(stylesheet) {
                // Cope with the way we push .css but actually write .less
                // because of the middleware. TODO: think about killing that
                var importName = stylesheet.web.replace('.css', '.less');
                if (!fs.existsSync(self.options.rootDir + '/public' + importName)) {
                  importName = stylesheet.web;
                }
                // For import what we need is a relative path which will work on
                // the filesystem too thanks to the symbolic links for modules
                var relPath = path.relative(path.dirname(masterWeb), importName);
                return '@import \'' + relPath + '\';';
              }).join("\n"));
            }
            self._lessMasters[scene] = {
              // The nature of the LESS middleware is that it expects you to
              // request a CSS file and uses LESS to render it if available
              file: masterFile.replace('.less', '.css'),
              web: masterWeb.replace('.less', '.css')
            };
            return callback(null);
          }, callback);
        },
        minify: function(callback) {
          self._minified = {};
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
          return self.forAllAssetScenesAndUpgrades(function(scene, callback) {
            return async.eachSeries([ 'stylesheets', 'scripts' ], function(type, callback) {
              // "Transition" scenes like anon.user cannot be
              // computed safely for stylesheets because LESS
              // mixins defined in files already sent would not
              // be visible to the new files. So don't try to
              // calculate those, and in /apos/upgrade-scene
              // we won't try to use them either. -Tom
              if ((type === 'stylesheets') && scene.match(/\./)) {
                return callback(null);
              }
              self._purgeExcept('/apos-minified/' + scene + '-*.' + typeMap[type], '-' + self._generation);
              var file = self.options.rootDir + '/public/apos-minified/' + scene + '-' + self._generation + '.' + typeMap[type];
              if (fs.existsSync(file)) {
                // Someone has already compiled it for the
                // current deployment's asset generation!
                // No startup delay! Booyeah!
                self._minified[scene] = self._minified[scene] || {};
                self._minified[scene][type] = fs.readFileSync(file, 'utf8');
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
        },
        minifiedStatic: function(callback) {
          _.each(self._minified, function(byType, scene) {
            _.each(byType, function(content, type) {
              if (!typeMap[type]) {
                return;
              }
              var dir = self.options.rootDir + '/public/apos-minified';
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
              }
              var filename = dir + '/' + scene + '-' + self._generation + '.' + typeMap[type];
              // Avoid race conditions - don't try to write the
              // same file again if apostrophe:generation already
              // created it for us
              if (fs.existsSync(filename)) {
                return;
              }
              if ((type === 'stylesheets') && self.options.bless) {
                var bless = require('bless');
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
              } else {
                fs.writeFileSync(filename, content);
              }
            });
          });
          return setImmediate(callback);
        }
      }, callback);
    };

    // Make a symbolic link so that "from" points
    // to the same content as "to". Remove any
    // existing link at "from" first. On Windows, this
    // method actually syncs the files to a new folder,
    // which is necessary to avoid the need for
    // administrative rights.

    self.relinkAssetFolder = function(from, to) {

      var os = require('os');

      if (os.platform().match(/^win/i)) {
        windows();
      } else {
        unix();
      }

      function windows() {
        var wrench = require('wrench');

        // First remove any legacy symbolic link
        // to avoid problems with wrench

        try {
          // If symbolic link exists, remove it
          // so we can replace it with
          // a valid one
          fs.unlinkSync(from);
        } catch (e) {
          // Old symbolic link does not exist or
          // there is already a folder, that's fine
        }

        // To fake a symbolic link, you need
        // to copy TO where the symbolic link
        // would be, and FROM the real stuff.
        // So to and from are reversed here. -Tom

        wrench.copyDirSyncRecursive(to, from, {
          forceDelete: true
        });
      }

      function unix() {
        // Always recreate the links so we're not befuddled by links
        // deployed from a dev environment
        try {
          // If symbolic link exists, remove it
          // so we can replace it with
          // a valid one
          fs.unlinkSync(from);
        } catch (e) {
          // Old symbolic link does not exist, that's fine
        }
        fs.symlinkSync(to, from, 'dir');
      }
    };

    // Iterate over all asset scenes and possible upgrades between them. Right
    // now it's just anon, user, and anon.user, but I'm coding for the future
    self.forAllAssetScenesAndUpgrades = function(each, callback) {
      if (!self.options.scenes) {
        self.options.scenes = [ 'anon', 'user' ];
      }
      var scenesAndUpgrades = [];
      var scenes = self.options.scenes;
      _.each(scenes, function(scene) {
        scenesAndUpgrades.push(scene);
      });
      // Express all the possible upgrades between scenes in dot notation
      var i, j;
      for (i = 0; (i < (scenes.length - 1)); i++) {
        for (j = i + 1; (j < scenes.length); j++) {
          scenesAndUpgrades.push(scenes[i] + '.' + scenes[j]);
        }
      }
      return async.eachSeries(scenesAndUpgrades, each, callback);
    };

    // Minify assets required for a particular scene and populate
    // self._minified appropriately. Supports dot notation in "scene"
    // for scene upgrades. Implements md5-based caching for the really
    // expensive javascript minification step.

    self.minifySceneAssetType = function(scene, type, minifier, callback) {
      var assets;
      // For stylesheets we should have a master LESS file at this point which
      // imports all the rest, so treat that as our sole stylesheet
      if ((type === 'stylesheets') && self._lessMasters && self._lessMasters[scene]) {
        assets = [ self._lessMasters[scene] ];
      } else {
        assets = self.filterAssets(self._assets[type], scene, true);
      }
      var key;
      var found = false;
      if (!self._minified) {
        self._minified = {};
      }
      if (!self._minified[scene]) {
        self._minified[scene] = {};
      }
      var cache = self.getCache('minify');
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
            return self.md5File(asset.file, callback);
          }, function(err, md5s) {
            if (err) {
              return callback(err);
            }
            // So the key's components are in a consistent order
            md5s.sort();
            key = type + ':' + scene + ':' + md5s.join(':');
            // So the key is never too long for mongodb
            key = self.md5(key);
            return cache.get(key, function(err, item) {
              if (err) {
                return callback(err);
              }
              if (item !== undefined) {
                self._minified[scene][type] = item;
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
            self._minified[scene][type] = code;
            return cache.set(key, code, callback);
          });
        }
      }, callback);
    };

    self.minifyStylesheet = function(stylesheet, callback) {
      return self.compileStylesheet(stylesheet, function(err, code) {
        if (err) {
          return callback(err);
        }
        return callback(null, cleanCss.process(code));
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
      var code = uglifyJs.minify(script.file).code;
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
      return less.render(fs.readFileSync(src, 'utf8'),
      {
        filename: src,
        rootpath: path.dirname(stylesheet.web) + '/',
        // Without this relative import paths are in trouble
        paths: [ path.dirname(src) ],
        // syncImport doesn't seem to work anymore in 1.4, thus
        // we were pushed to write endAssets, although it makes
        // sense anyway
      }, function(err, css) {
        if (self.prefix) {
          // Call a method provided by appy to be
          // compatible with what the frontend
          // middleware does
          css = self.options.prefixCssUrls(css);
        }
        return callback(err, css);
      });
    };

    // Part of the implementation of apos.endAssets, this method
    // returns only the assets that are suitable for the specified
    // scene (`user` or `anon`). Duplicates are suppressed automatically
    // for anything rendered from a file (we can't do that for things
    // rendered by a function).
    //
    // If minifiable is true you get back the assets that can be minified;
    // if set false you get those that cannot; if it is not specified
    // you get both.
    //
    // If "when" specifies two scenes separated by a dot:
    //
    // anon.user
    //
    // Then the returned assets are those necessary to upgrade from the
    // first to the second. (Note that for stylesheets this is not safe
    // because you will be missing LESS mixins set in the files the
    // user already has. So in that case we just push all the styles
    // for the larger scene rather than calling this method with
    // a transitional scene name.)

    self.filterAssets = function(assets, when, minifiable) {
      // Support older layouts
      if (!when) {
        throw new Error('You must specify the "when" argument (usually either anon or user)');
      }

      // Handle upgrades
      var matches = when.match(/^(.*?)\.(.*)$/);
      if (matches) {
        var from = matches[1];
        var to = matches[2];
        var alreadyHave = {};
        var need = {};
        _.each(self.filterAssets(assets, from), function(asset) {
          alreadyHave[self.assetKey(asset)] = asset;
        });
        _.each(self.filterAssets(assets, to), function(asset) {
          need[self.assetKey(asset)] = asset;
        });
        var result = [];
        _.each(need, function(asset, assetKey) {
          if (!alreadyHave[assetKey]) {
            result.push(asset);
          }
        });
        return result;
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

    // Given the name of an asset module, like blog or my-blog or snippets,
    // this gives you access to an array of asset modules in order to resolve
    // overrides beginning at that point. That is, if you look up "blog", you get
    // an array like this:
    //
    // [
    //   { name: 'blog', web: '/apos-blog', dir: '.../node_modules/apostrophe-blog' },
    //   { name: 'snippets', web: '/apos-snippets', dir: '.../node_modules/apostrophe-snippets' }
    // ]
    //
    // If you look up "my-blog" in a project that contains the blog module and
    // overrides in lib/modules/apostrophe-blog, you get this:
    //
    // [
    //   { name: 'my-blog', web: '/apos-my-blog', dir: '.../lib/modules/apostrophe-blog' },
    //   { name: 'blog', web: '/apos-blog', dir: '.../node_modules/apostrophe-blog' },
    //   { name: 'snippets', web: '/apos-snippets', dir: '.../node_modules/apostrophe-snippets' }
    // ]

    self._assetChains = {};

    // This mixin adds methods to the specified module object. Should be called only
    // in base classes, like `apostrophe-snippets` itself, never a subclass like
    // `apostrophe-blog`.
    //
    // IF YOU ARE WRITING A SUBCLASS
    //
    // when subclassing you do NOT need to invoke this mixin as the methods
    // are already present on the base class object. Instead, just make sure you
    // add your module name and directory to the `modules` option before invoking
    // the constructor of your superclass:
    //
    // `options.modules = (options.modules || []).concat([ { dir: __dirname, name: 'blog' } ]);`
    //
    // Then you may call `self.pushAsset` as described below and your assets will be
    // part of the result.
    //
    // HOW TO PUSH ASSETS
    //
    // If you are creating a new module from scratch that does not subclass another,
    // invoke the mixin this way in your constructor:
    //
    // `self._apos.mixinModuleAssets(self, 'apostrophe-snippets', __dirname, options);`
    //
    // Then you may invoke:
    //
    // self.pushAsset('script', 'editor', { when: 'user' })
    //
    // This pushes `public/js/editor.js` to the browser, exactly like
    // `apos.pushAsset` would, but also pushes any `public/js/editor.js` files
    // provided a subclass, starting with the base class version.
    //
    // Stylesheets work the same way:
    //
    // `self.pushAsset('stylesheet', 'editor', { when: 'user' })`
    //
    // That pushes `editor.less`, for the base class and its subclasses as appropriate.
    //
    // DOM templates can also be pushed:
    //
    // `self.pushAsset('template', 'invitation', { when: 'always' })`
    //
    // If this is called by the `blog` module and it subclasses the `snippets` module,
    // then only the blog module's `views/invitation.html` will be added to the DOM.
    //
    // See `apos.pushAsset` for details on pushing assets in general.
    //
    // HOW TO SERVE ASSETS
    //
    // It just works! Your assets folder will be symlinked into public/modules.
    // (TODO: for the poor fellows trapped in Windows, copy the folders recursively.)
    //
    // URLS FOR ASSETS
    //
    // Most assets are pushed, which makes it Apostrophe's job to deliver them with
    // valid URLs that load them. But if you want to access an asset directly, for
    // instance an image in a `public/images` subdirectory of your module, you can
    // do so.
    //
    // If the `name` argument to `self._apos.mixinModuleAssets` is `cats`, then
    // the `public` directory of the module will be visible to the browser as
    // `/modules/cats`.
    //
    // If you are creating a subclass called `tabby` and adjusting the `modules`
    // option correctly as discussed above, then your `public` directory will
    // be accessible as `/modules/tabby`.
    //
    // URLS FOR API ROUTES
    //
    // It is easiest to add your own API routes if you do not use the same
    // "folder" used to serve static assets. We suggest using `/apos-tabby-api`
    // as a prefix so that static asset URLs like `/apos-tabby/...` do not
    // block your API routes.
    //
    // OTHER METHODS PROVIDED BY THE MIXIN
    //
    // `self.render(name, data)` renders a template found in this module or the most
    // immediate ancestor that offers it. It is used to implement
    // `self.pushAsset('template', 'templatename')` and may also be used directly.
    //
    // `self.renderer(name)` returns a function which, given the named template and
    // a data object, will render that template with the given data according to the
    // same rules as `self.render`. It is used to implement deferred rendering.
    //
    // `self.renderPage(req, name, data)` renders a complete web page, with the content
    // rendered by the specified template, decorated by the outerLayout. BC BREAK:
    // new parameters in 0.5. This method is now fully capable of pushing assets,
    // pushing javascript, etc. just like a page served by the pages module.

    self.mixinModuleAssets = function(module, name, dirname, options) {
      module._modules = (options.modules || []).concat([ { name: name, dir: dirname } ]);
      var i;
      // Make all the asset modules in the chain findable via
      // apos._assetChains, supplying the remainder of the chain for
      // each one. Allows nunjucksLoader.js to implement cross-module includes
      // with support for overrides
      for (i = 0; (i < module._modules.length); i++) {
        self._assetChains[self.cssName(module._modules[i].name)] = module._modules.slice(i);
      }
      module._rendererGlobals = options.rendererGlobals || {};
      // Compute the web directory name for use in asset paths
      _.each(module._modules, function(module) {
        module.web = '/modules/' + self.cssName(module.name);
        // Also record the filesystem path of each web path so that we can
        // create symlinks making them equivalent
        self._assetPaths[module.web] = module.dir;
      });

      // The same list in reverse order, for use in pushing assets (all versions of the
      // asset file are pushed to the browser, starting with the snippets class, because
      // CSS and JS are cumulative and CSS is very order dependent)
      //
      // Use slice(0) to make sure we get a copy and don't alter the original
      module._reverseModules = module._modules.slice(0).reverse();

      // Render a partial, looking for overrides in our preferred places.
      module.render = function(name, data, req) {
        return module.renderer(name, req)(data);
      };

      // Render a template in a string (not from a file), looking for includes, etc. in our
      // preferred places
      module.renderString = function(s, data) {
        return module.rendererString(s)(data);
      };

      // Return a function that will render a particular partial looking for overrides in our
      // preferred places. Also merge in any properties of self._rendererGlobals, which can
      // be set via the rendererGlobals option when the module is configured

      module.renderer = function(name, req) {
        return function(data, reqAnonymous) {
          req = reqAnonymous || req;
          if (!data) {
            data = {};
          }
          _.defaults(data, module._rendererGlobals);
          return self.partial(req, name, data, _.map(module._modules, function(module) { return module.dir + '/views'; }));
        };
      };

      // Return a function that will render a particular template in a string,
      // looking includes etc. preferred places. Also merge in any properties of
      // self._rendererGlobals, which can be set via the rendererGlobals option
      // when the module is configured

      module.rendererString = function(s) {
        return function(data) {
          if (!data) {
            data = {};
          }
          _.defaults(data, module._rendererGlobals);
          return self.partialString(s, data, _.map(module._modules, function(module) { return module.dir + '/views'; }));
        };
      };

      module.pushAsset = function(type, name, optionsArg) {
        var options = {};
        if (optionsArg) {
          extend(true, options, optionsArg);
        }
        if (type === 'template') {
          // Render templates in our own nunjucks context
          self.pushAsset('template', module.renderer(name), options);
        } else {

          // We're interested in ALL versions of main.js or main.less,
          // starting with the base one (snippets module version, if this module is descended from snippets). CSS and JS are additive.

          var exists = false;
          _.each(module._reverseModules, function(module) {
            var path;
            options.fs = module.dir;
            options.web = module.web;
            if (self.pushAsset(type, name, options)) {
              exists = true;
            }
          });
          if (!exists) {
            console.error('WARNING: no versions of the ' + type + ' ' + name + ' exist, but you are pushing that asset in the ' + module.name + ' module.');
          }
        }
      };

      // Generate a complete HTML page for transmission to the browser.
      //
      // Renders the specified template in the context of the current module,
      // then decorates it with the outer layout. Pushes javascript calls and
      // javascript data to the browser and always passes the following to the
      // template:
      //
      // user (req.user)
      // query (req.query)
      // permissions (req.user.permissions)
      //
      // Under the following conditions, the outer layout is skipped and
      // the template's result is returned directly:
      //
      // req.xhr is true (always set on AJAX requests by jQuery)
      // req.query.xhr is set to simulate an AJAX request
      // req.decorate is false
      //
      // This is helpful when the same logic is used to power regular
      // pages, RSS views and partial refreshes like infinite scroll "pages".
      //
      // The ready event is always triggered on the body, whether
      // performing an AJAX update or a fully decorated page rendering.
      //
      // If template is a function it is passed a data object and also
      // the request object (ignored in most cases). Otherwise it is rendered
      // as a nunjucks template relative to this module's views folder.
      //
      // If `when` is set to 'user' or 'anon' it overrides the normal determination
      // of whether the page requires full CSS and JS for a logged-in user via
      // req.user.

      module.renderPage = function(req, template, data, when) {
        var workflow = self.options.workflow && {
          mode: req.session.workflowMode || 'public'
        };

        req.pushData({
          permissions: (req.user && req.user.permissions) || {},
          workflow: workflow
        });

        when = when || (req.user ? 'user' : 'anon');
        if (req.scene === 'user') {
          // Upgrade the scene for page loaders
          // that request it. Much less awkward
          // than working with requireScene
          when = 'user';
        }
        var calls = self.getGlobalCallsWhen('always');
        if (when === 'user') {
          calls = calls + self.getGlobalCallsWhen('user');
        }
        calls = calls + self.getCalls(req);
        // Always the last call; signifies we're done initializing the
        // page as far as the core is concerned; a lovely time for other
        // modules and project-level javascript to do their own
        // enhancements. The content area refresh mechanism also
        // triggers this event. Use afterYield to give other things
        // a chance to finish initializing
        calls += '\napos.afterYield(function() { apos.emit("ready"); });\n';

        // JavaScript may want to know who the user is. Prune away
        // big stuff like their profile areas
        if (req.user) {
          // This should be gone already but let's be doubly sure!
          delete req.user.password;
          req.traceIn('prune user');
          req.pushData({ user: self.prunePage(req.user) });
          req.traceOut();
        }

        var args = {
          // Make sure we pass the slug of the page, not the
          // complete URL. Frontend devs are expecting to be able
          // to use this slug to attach URLs to a page
          user: req.user,
          permissions: (req.user && req.user.permissions) || {},
          when: when,
          calls: calls,
          data: self.getGlobalData() + self.getData(req),
          refreshing: !!req.query.apos_refresh,
          // Make the query available to templates for easy access to
          // filter settings etc.
          query: req.query,
          safeMode: (req.query.safe_mode !== undefined)
        };

        req.extras = req.extras || {};
        _.extend(req.extras, data);

        if (workflow && (workflow.mode === 'public')) {
          self.workflowPreventEditInPublicMode(req.extras);
        }
        _.extend(args, req.extras);

        var content;
        try {
          if (typeof(template) === 'string') {
            content = module.render(template, args, req);
          } else {
            content = template(args, req);
          }
        } catch (e) {
          // We're medium-screwed: the page template
          // threw an exception. Log where it
          // occurred for easier debugging
          return error(e, 'template');
        }
        if (req.xhr || req.query.xhr || (req.decorate === false)) {
          return content;
        } else {
          args.content = content;
          try {
            return self.decoratePageContent(args, req);
          } catch (e) {
            // We're extra-screwed: the outer layout
            // template threw an exception.
            // Log where it occurred for
            // easier debugging
            return error(e, 'outer layout');
          }
        }

        function error(e, type) {
          var now = Date.now();
          now = moment(now).format("YYYY-MM-DDTHH:mm:ssZZ");
          console.error(':: ' + now + ': ' + type + ' error at ' + req.url);
          console.error('Current user: ' + (req.user ? req.user.username : 'none'));
          console.error(e);
          req.statusCode = 500;
          return module.render('templateError', {}, req);
        }
      };

      module.serveAssets = function() {
        console.error('DEPRECATED: you do not have to call serveAssets anymore.');
      };
    };

    // Fetch an asset chain by name. By default, if
    // "blog" is requested, "my-blog" will automatically be
    // tried first, to allow project-level overrides to
    // be seen. You can pass false as the second argument
    // to insist on the original version of the content.

    self.getAssetChain = function(name, withOverrides) {
      if (withOverrides !== undefined) {
        var result = self.getAssetModule('my-' + name, false);
        if (result) {
          return result;
        }
      }
      if (self._assetChains[name]) {
        return self._assetChains[name];
      }
    };

    var i;
    for (i in stylesheets) {
      self.pushAsset('stylesheet', stylesheets[i]);
    }
    for (i in scripts) {
      self.pushAsset('script', scripts[i]);
    }
    for (i in templates) {
      self.pushAsset('template', templates[i]);
    }
  },
  /**
   * Initialization requiring resources not available until init()
   * @param  {Object} self  The apos object
   */
  init: function(self) {
    self._minified = {};

    // Deprecated, shouldn't happen
    self.app.get('/apos/stylesheets.css', function(req, res) {
      console.error('ERROR: /apos/stylesheets.css should never be accessed anymore if you are using aposStylesheets properly in base.html');
      res.statusCode = 404;
      return res.send('Deprecated');
    });

    // Deprecated, shouldn't happen
    self.app.get('/apos/scripts.js', function(req, res) {
      console.error('ERROR: /apos/scripts.js should never be accessed anymore if you are using aposScripts properly in base.html');
      res.statusCode = 404;
      return res.send('Deprecated');
    });

    // This route allows us to upgrade the CSS, JS and DOM templates in the
    // browser to include those required for a more complex "scene." i.e., we
    // can go from "anon" to "user", in order to let an anonymous person
    // participate in submitting moderated content.
    //
    // IMPLEMENTATION NOTE
    //
    // Loading JS and CSS and HTML and firing a callback after all the JS
    // and HTML is really ready is kinda hard! Apostrophe mostly
    // avoids it, because the big kids are still fighting about requirejs
    // versus browserify, but when we upgrade the scene to let an anon user
    // play with schema-driven forms, we need to load a bunch of JS and CSS
    // and HTML in the right order! What will we do?
    //
    // We'll let the server send us a brick of CSS, a brick of JS, and a
    // brick of HTML, and we'll smack the CSS and HTML into the DOM,
    // wait for DOMready, and run the JS with eval.
    //
    // This way the server does most of the work, calculating which CSS, JS
    // and HTML template files aren't yet in browserland, and the order of
    // loading within JS-land is reallllly clear.
    //
    // Plenty of opportunity to add caching in production, but the idea
    // is that a user only needs to switch scenes once during their session.

    self.app.post('/apos/upgrade-scene', function(req, res) {
      var from = self.sanitizeString(req.body.from);
      var to = self.sanitizeString(req.body.to);
      var result = {
        css: '',
        js: '',
        html: ''
      };

      // For stylesheets it is not safe to compute a difference, compiling
      // only the "user" stylesheets when upgrading from "anon" to
      // "user", because we would be missing LESS mixins defined in the
      // "anon" scene. Unfortunately we no alternative
      // but to push the entire set of styles for the new scene.
      // Hypothetically we could diff the actual CSS output in some way
      // to compute the set of new styles that have to be sent.
      // Practically speaking that would be a nightmare. -Tom

      var cacheKey = to;

      var stylesheets;
      if (self._minified[cacheKey] && self._minified[cacheKey]['stylesheets']) {
        // Use cached CSS if it was calculated at startup
        result.css = self._minified[cacheKey]['stylesheets'];
      } else if (self._lessMasters && self._lessMasters[cacheKey]) {
        // Use a master LESS file if it was created at startup
        stylesheets = [ self._lessMasters[cacheKey] ];
      } else {
        stylesheets = self.filterAssets(self._assets['stylesheets'], cacheKey);
      }

      // For javascript and DOM templates we can compute
      // the difference safely

      cacheKey = from + '.' + to;

      var scripts;
      // Use cached upgrade if it was calculated at startup
      if (self._minified[cacheKey] && self._minified[cacheKey]['scripts']) {
        result.js = self._minified[cacheKey]['scripts'];
      } else {
        scripts = self.filterAssets(self._assets['scripts'], cacheKey);
      }

      var templates;
      // Use cached upgrade if it was calculated at startup
      // (we don't minify templates right now, but we might...)
      if (self._minified[cacheKey] && self._minified[cacheKey]['templates']) {
        result.html = self._minified[cacheKey]['templates'];
      } else {
        templates = self.filterAssets(self._assets['templates'], cacheKey);
        result.html = _.map(templates, function(template) {
          return self.renderTemplateAsset(template) + "\n";
        });
      }

      async.series({
        compileScripts: function(callback) {
          if (!scripts) {
            // Minified and cached at startup
            return callback(null);
          }
          _.each(scripts, function(script) {
            if (fs.existsSync(script.file)) {
              result.js += fs.readFileSync(script.file) + "\n";
            }
          });
          return callback(null);
        },
        appendCalls: function(callback) {
          result.js += self.getGlobalCallsWhen(to);
          // Set the scene and trigger an event when everything is ready
          result.js +=
            "apos.scene = " + JSON.stringify(to) + ";\n" +
            "$('body').trigger('aposSceneChange', " + JSON.stringify(to) + ");\n";
          return callback(null);
        },
        compileStylesheets: function(callback) {
          if (!stylesheets) {
            // Minified and cached at startup
            return callback(null);
          }
          return async.each(stylesheets, function(stylesheet, callback) {
            return self.compileStylesheet(stylesheet, function(err, css) {
              if (err) {
                return callback(err);
              }
              result.css += css + "\n";
              return callback(null);
            });
          }, callback);
        }
      }, function(err) {
        if (err) {
          return res.send({ status: 'error' });
        }
        result.status = 'ok';
        // TODO: think about remembering the scene in the session so that page
        // transitions don't downgrade us again, requiring another expensive upgrade
        // if the user decides to do another fancy thing that requires it. Right now
        // I'd rather see this get a little exercise.
        //
        // TODO: think about a simplified encoding with a divider between
        // the CSS, JS and HTML as an alternative to JSON which is going to waste
        // a lot of space; think about gzip transfer encoding for this
        return res.send(result);
      });
    });

    self.renderTemplateAsset = function(asset) {
      if (asset.call) {
        return asset.call(asset.data);
      } else {
        // Make sure the configured views/global folder
        // is consulted first so it's possible to override
        // the templates of the apostrophe module.
        // TODO: figure out how to get the apostrophe module
        // to follow the same implementation as other modules
        // that rely on the assets mixin
        return self.partial(path.basename(asset.file), asset.data, (self.options.partialPaths || []).concat(path.dirname(asset.file)));
      }
    };

    var mediaOptions = self.options.mediaLibrary || {};
    if (mediaOptions.browseByType) {
      mediaOptions.browseByType = _.filter(mediaOptions.browseByType, function(byType) {
        return byType.value = byType.extensions.join(',');
      });
    }
    self.pushAsset('template', { name: 'mediaLibrary', when: 'user', data: mediaOptions });

    // Return a string that uniquely identifies this asset for purposes of
    // determining whether two scenes both contain it. Not guaranteed to
    // be a short string.
    self.assetKey = function(asset) {
      if (asset.call) {
        // It's a template.
        // The rendered result is the easiest way to be sure
        return asset.call(asset.data);
      } else if (asset.data) {
        // It's a template.
        // The combination of .file and .data is unique, but .data could
        // easily be bigger than the output, so use the output
        if (!fs.existsSync(asset.file)) {
          // Due to the override mechanism we may have
          // an npm module's version of editor.js, an override's
          // version of editor.js, etc. The absence of any of these
          // should not throw an error
          return 'no-such-file';
        }
        return self.partial(asset.file, asset.data, [ path.dirname(asset.file) ]);
      } else {
        // It's a stylesheet or script
        return asset.file;
      }
    };
  }
};

