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

module.exports = {

  beforeConstruct: function(self, options) {
    // So that our own base class can add us to it in its constructor
    self.chains = {};
    // So that our own base class can find us in its constructor
    options.apos.assets = self;
  },

  construct: function(self, options) {

    self.minified = {};

    self.generating = (self.apos.argv._[0] === 'apostrophe:generation');

    var generation;

    if (self.generating) {
      // Create a new generation identifier. The assets module
      // will use this to create asset files that are distinctly
      // named on a new deployment.
      generation = self.apos.utils.generateId();
      fs.writeFileSync(self.apos.rootDir + '/data/generation', generation);
    }

    if (fs.existsSync(self.apos.rootDir + '/data/generation')) {
      generation = fs.readFileSync(self.apos.rootDir + '/data/generation', 'utf8');
      generation = generation.replace(/[^\d]/g, '');
    }

    if (!generation) {
      // In a dev environment, we can just use the pid
      generation = self.apos.pid;
    }

    self.generation = generation;

    // Default stylesheet requirements
    // TODO: lots of override options
    var stylesheets = [
      // Has a subdirectory of relative image paths so give it a folder
      { name: "_site", when: 'always' },
      { name: "_user", when: 'user' },
      { name: "apos-ui-2", when: "always" },
      // Load this *after* the "content" stylesheet which can contain fonts.
      // Font imports must come first. It's a pain.
      { name: "jquery-ui-darkness/jquery-ui-darkness", when: 'always' }
    ];

    // Default browser side script requirements
    // TODO: lots of override options
    var scripts = [
      // VENDOR DEPENDENCIES

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
      // select element enhancement plugin
      { name: 'vendor/selectize', when: 'always' },
      { name: 'vendor/jquery.selectize', when: 'always' },
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

      // TODO move these into modules for the widgets
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

      // TODO move these into the files module
      { name: 'annotator', when: 'user' },
      { name: 'mediaLibrary', when: 'user' },

      // TODO move this into the tag-editor module
      { name: 'tagEditor', when: 'user' },

      { name: 'ui-2', when: 'always' }
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
    self.pushed = { stylesheets: [], scripts: [], templates: [] };

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
      var webDir = self.apos.prefix + '/modules/' + context.name + '/' + self.assetTypes[type].web;

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

    self.tooLateToPushAssets = false;

    // Purge files from public folder matching the glob pattern
    // `pattern`, excepting those with names containing
    // `exceptSubstring`.

    self.purgeExcept = function(pattern, exceptSubstring) {
      var old = glob.sync(self.apos.rootDir + '/public/' + pattern);
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

      self.tooLateToPushAssets = true;

      // Create symbolic links in /modules so that our web paths can be
      // served by a static server like nginx

      // Name of both folder and extension in
      // public/ for this type of asset
      var typeMap = {
        scripts: 'js',
        stylesheets: 'css'
      };

      return async.series({
        linkModules: function(callback) {
          if (!fs.existsSync(self.apos.rootDir + '/public/modules')) {
            fs.mkdirSync(self.apos.rootDir + '/public/modules');
          }
          _.each(self.chains, function(chain, name) {
            var last = chain[chain.length - 1];
            var from = self.apos.rootDir + '/public/modules/' + name;
            var to = last.dirname + '/public';
            if (fs.existsSync(to)) {
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
            }
          });
          return callback(null);
        },
        buildLessMasters: function(callback) {
          self.lessMasters = {};
          // Compile all LESS files as one. This is awesome because it allows
          // mixins to be shared between modules for better code reuse. It also
          // allows you to redefine mixins in a later module; if you do so, they
          // are retroactive to the very first use of the mixin. So apostrophe-ui-2
          // can alter decisions made in the apostrophe module, for instance.
          return self.forAllAssetScenesAndUpgrades(function(scene, callback) {
            var base = '/css/master-' + scene + '-';
            self.purgeExcept(base + '*', '-' + self.generation);
            var masterWeb = base + self.generation + '.less';
            var masterFile = self.apos.rootDir + '/public' + masterWeb;
            var stylesheets = self.filterAssets(self.pushed.stylesheets, scene, true);
            // Avoid race conditions, if apostrophe:generation created
            // the file already leave it alone
            if (!fs.existsSync(masterFile)) {
              fs.writeFileSync(masterFile, _.map(stylesheets, function(stylesheet) {
                // Cope with the way we push .css but actually write .less
                // because of the middleware. TODO: think about killing that
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
        },
        minify: function(callback) {
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
              self.purgeExcept('/apos-minified/' + scene + '-*.' + typeMap[type], '-' + self.generation);
              var file = self.apos.rootDir + '/public/apos-minified/' + scene + '-' + self.generation + '.' + typeMap[type];
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
        },
        minifiedStatic: function(callback) {
          _.each(self.minified, function(byType, scene) {
            _.each(byType, function(content, type) {
              if (!typeMap[type]) {
                return;
              }
              var dir = self.apos.rootDir + '/public/apos-minified';
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
              }
              var filename = dir + '/' + scene + '-' + self.generation + '.' + typeMap[type];
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
      }, function(err) {
        if (err) {
          return callback(err);
        }
        if (self.generating) {
          // Asset generation is all we wanted on this invocation
          process.exit(0);
        }
        return callback(null);
      });
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
      var cache = self.apos.cache.get('minify');
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
      }, callback);
    };

    self.minifyStylesheet = function(stylesheet, callback) {
      return self.compileStylesheet(stylesheet, function(err, code) {
        if (err) {
          return callback(err);
        }
        if (!self.cleanCss) {
          // CSS minifier https://github.com/GoalSmashers/clean-css
          var CleanCss = require('clean-css');
          self.cleanCss = new CleanCss({});
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
        if (err) {
          console.error('LESS CSS ERROR:');
          console.error(err);
        }
        css = css.css;
        if (self.prefix) {
          // Call a method provided by appy to be
          // compatible with what the frontend
          // middleware does
          css = self.options.prefixCssUrls(css);
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

    // Fetch an asset chain by name. Note that the
    // name of the chain for a project-level override
    // of the "foo" module is "my-foo". Otherwise it
    // is the name of the module.

    self.getChain = function(name) {
      return self.chains[name];
    };

    var i;
    for (i in stylesheets) {
      self.pushAsset('stylesheet', stylesheets[i].name, stylesheets[i]);
    }
    for (i in scripts) {
      self.pushAsset('script', scripts[i].name, scripts[i]);
    }
    for (i in templates) {
      self.pushAsset('template', templates[i].name, templates[i]);
    }

    // This route allows us to upgrade the CSS, JS and DOM templates in the
    // browser to include those required for a more complex "scene." i.e., we
    // can go from "anon" to "user", in order to let an anonymous person
    // participate in submitting moderated content. The current
    // scene is specified by `from` and the new scene by `to`. The
    // response is a JSON object with css, js, and html properties
    // which the front end code applies to the DOM.

    self.route('post', 'upgrade-scene', function(req, res) {

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

      var from = self.apos.sanitize.string(req.body.from);
      var to = self.apos.sanitize.string(req.body.to);
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
      if (self.minified[cacheKey] && self.minified[cacheKey]['stylesheets']) {
        // Use cached CSS if it was calculated at startup
        result.css = self.minified[cacheKey]['stylesheets'];
      } else if (self.lessMasters && self.lessMasters[cacheKey]) {
        // Use a master LESS file if it was created at startup
        stylesheets = [ self.lessMasters[cacheKey] ];
      } else {
        stylesheets = self.filterAssets(self.pushed['stylesheets'], cacheKey);
      }

      // For javascript and DOM templates we can compute
      // the difference safely

      cacheKey = from + '.' + to;

      var scripts;
      // Use cached upgrade if it was calculated at startup
      if (self.minified[cacheKey] && self.minified[cacheKey]['scripts']) {
        result.js = self.minified[cacheKey]['scripts'];
      } else {
        scripts = self.filterAssets(self.pushed['scripts'], cacheKey);
      }

      var templates;

      // We don't currently try to minify templates. One challenge
      // is that they have to be rendered for the correct locale

      templates = self.filterAssets(self.pushed['templates'], cacheKey);
      result.html = _.map(templates, function(template) {
        return self.renderTemplateAsset(req, template) + "\n";
      });

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

    // Render a template asset (a DOM template), taking the
    // locale into account correctly for i18n

    self.renderTemplateAsset = function(req, asset) {
      if (asset.call) {
        return asset.call(asset.data);
      } else {
        return self.apos.templates.render(path.basename(asset.file), asset.data, [ { dirname: path.dirname(asset.file) } ]);
      }
    };

    // For generating unique keys cheaply
    var ordinal = 0;

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
        return ordinal++;
      }
      // It's a stylesheet or script. The full path to the file
      // is an acceptable key.
      return asset.file;
    };
  }
};
