var path = require('path');
var extend = require('extend');
var _ = require('underscore');
var sanitize = require('validator').sanitize;
var async = require('async');
var fs = require('fs');
// JS minifier and optimizer
var uglifyJs = require('uglify-js');
// CSS minifier https://github.com/GoalSmashers/clean-css
var cleanCss = require('clean-css');
// LESS CSS compiler
var less = require('less');

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
      { name: "jquery-ui-darkness/jquery-ui-darkness", when: 'always' },
      { name: "content", when: 'always' },
      { name: "user", when: 'user' }
    ];

    // Default browser side script requirements
    // TODO: lots of override options
    var scripts = [
      // VENDOR DEPENDENCIES

      // Makes broken browsers usable
      { name: 'vendor/underscore-min', when: 'always' },
      // For everything
      { name: 'vendor/jquery', when: 'always' },
      // For parsing query parameters browser-side
      { name: 'vendor/jquery-url-parser', when: 'always' },
      // For blueimp uploader, drag and drop reordering of anything, datepicker
      // & autocomplete
      { name: 'vendor/jquery-ui', when: 'always' },
      // For the RTE
      { name: 'vendor/jquery-hotkeys', when: 'user' },
      // For selections in the RTE
      // DR uses modals for interaction with logged out users, modals need this
      { name: 'vendor/rangy-core', when: 'always' },
      { name: 'vendor/rangy-selectionsaverestore', when: 'always' },
      // For selections in ordinary textareas and inputs (part of Rangy)
      { name: 'vendor/jquery-textinputs', when: 'user' },
      // Graceful fallback for older browsers
      { name: 'vendor/blueimp-iframe-transport', when: 'user' },
      // Spiffy multiple file upload
      { name: 'vendor/blueimp-fileupload', when: 'user' },
      // imaging cropping plugin
      { name: 'vendor/jquery.Jcrop.min', when: 'user' },
      // textchange event, detects actual typing activity, not just focus change
      { name: 'vendor/jquery-textchange', when: 'always' },

      // PUNKAVE-MAINTAINED, GENERAL PURPOSE JQUERY PLUGINS

      { name: 'vendor/jquery.get-outer-html', when: 'always' },
      { name: 'vendor/jquery.find-by-name', when: 'always' },
      { name: 'vendor/jquery.projector', when: 'always' },
      { name: 'vendor/jquery.bottomless', when: 'always' },
      { name: 'vendor/jquery.selective', when: 'always' },
      { name: 'vendor/jquery.images-ready', when: 'always' },
      { name: 'vendor/jquery.radio', when: 'always' },
      { name: 'vendor/jquery.json-call', when: 'always' },

      // APOSTROPHE CORE JS

      // Viewers for standard content types
      { name: 'content', when: 'always' },
      // Editing functionality
      { name: 'user', when: 'user' },
      { name: 'editor', when: 'user' },
      { name: 'widgets/editors/buttons', when: 'user' },
      { name: 'widgets/editors/code', when: 'user' },
      { name: 'widgets/editors/files', when: 'user' },
      { name: 'widgets/editors/html', when: 'user' },
      { name: 'widgets/editors/marquee', when: 'user' },
      { name: 'widgets/editors/pullquote', when: 'user' },
      { name: 'widgets/editors/slideshow', when: 'user' },
      { name: 'widgets/editors/video', when: 'user' },
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
      { name: 'codeEditor', when: 'user' },
      { name: 'htmlEditor', when: 'user' },
      { name: 'cropEditor', when: 'user' },
      { name: 'tableEditor', when: 'user' },
      { name: 'linkEditor', when: 'user' },
      { name: 'fileAnnotator', when: 'user' },
      { name: 'mediaLibrary', when: 'user' },
      { name: 'tagEditor', when: 'user' }
    ];

    // Full paths to assets as computed by pushAsset
    self._assets = { stylesheets: [], scripts: [], templates: [] };

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

    self.pushAsset = function(type, name, options) {
      var fs, web, when;
      // Support just 2 arguments with the name as a property
      if (typeof(name) === 'object') {
        options = name;
        name = name.name;
      }
      if (typeof(options) === 'string') {
        // Support old order of parameters
        fs = options;
        options = undefined;
        web = arguments[3];
      }
      if (options) {
        fs = options.fs;
        web = options.web;
        when = options.when || 'always';
      } else {
        // bc
        when = 'always';
        options = {};
      }
      // Careful with the defaults on this, '' is not false for this purpose
      if (typeof(fs) !== 'string') {
        fs = __dirname + '/..';
      }
      if (typeof(web) !== 'string') {
        web = '/apos';
      }
      var types = {
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
          serve: 'fs'
        }
      };

      var data = options ? options.data : undefined;

      if (typeof(name) === 'function') {
        return self._assets[types[type].key].push({ call: name, data: data, when: when });
      }

      var fileDir = fs + '/' + types[type].fs;
      var webDir = web + '/' + types[type].web;

      var filePath = fileDir + '/' + name;
      if (types[type].ext) {
        filePath += '.' + types[type].ext;
      }
      var webPath = webDir + '/' + name;
      if (types[type].ext) {
        webPath += '.' + types[type].ext;
      }
      self._assets[types[type].key].push({ file: filePath, web: webPath, data: data, when: when, minify: options.minify });
    };

    self._endAssetsCalled = false;

    // You must call `apos.endAssets` when you are through pushing
    // assets. This is necessary because the LESS
    // compiler is no longer asynchronous, so we can't
    // wait for aposStylesheet calls in Nunjucks to
    // do the compilation.
    //
    // The options argument is not required. If you do
    // provide one you may specify additional scenes,
    // and should always specify 'anon' and 'user'. Our official
    // modules are only concerned with those two cases.
    // Assets pushed with `when` set to 'always' are
    // deployed in both scenes.
    //
    // Typically `apostrophe-site` calls this for you.

    self.endAssets = function(options, callback) {
      self._endAssetsCalled = true;
      if (typeof(options) === 'function') {
        callback = options;
        options = {};
      }
      if (!options.scenes) {
        options.scenes = [ 'anon', 'user' ];
      }
      if (!self.options.minify) {
        // Just use the LESS middleware and direct access to JS
        // for dev
        return callback(null);
      }
      self._minified = {};
      console.log('MINIFYING, this may take a minute...');
      var minifiers = {
        stylesheets: self.minifyStylesheet,
        scripts: self.minifyScript
      };
      return async.eachSeries(options.scenes, function(scene, callback) {
        return async.eachSeries([ 'stylesheets', 'scripts' ], function(type, callback) {
          return self.minifySceneAssetType(scene, type, minifiers[type], callback);
        }, callback);
      }, function(err) {
        if (err) {
          return callback(err);
        }
        console.log('Minification complete.');
        return callback(null);
      });
    };

    self.minifySceneAssetType = function(scene, type, minifier, callback) {
      var assets = self.filterAssets(self._assets[type], scene, true);
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
        return callback(err, css);
      });
    };

    // Part of the implementation of apos.endAssets, this method
    // returns only the assets that are suitable for the specified
    // scenario (`user` or `anon`). Duplicates are suppressed automatically
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
    // In a base class, you MUST invoke:
    //
    // `self.serveAssets();`
    //
    // AFTER adding any custom routes so that your custom routes are not blocked by the
    // route that serves static assets. Do NOT call this in a subclass.
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
    // `/apos-cats`.
    //
    // If you are creating a subclass called `tabby` and adjusting the `modules`
    // option correctly as discussed above, then your `public` directory will
    // be accessible as `/apos-tabby`.
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
    // `self.renderPage(name, data, when)` renders a complete web page, with the content
    // rendered by the specified template, decorated by the outerLayout. This should be
    // reserved for unusual situations where the content is not anchored to an
    // Apostrophe page in any way, such as the password reset "page" implemented by
    // the apostrophe-epeople module. This method may only be used if the module has
    // access to the "pages" module via a ._pages property. You must specify either
    // "anon" or "user" for the third argument, indicating whether to load CSS and
    // js required for logged-in experiences or not.

    self.mixinModuleAssets = function(module, name, dirname, options) {
      module._modules = (options.modules || []).concat([ { name: name, dir: dirname } ]);
      module._rendererGlobals = options.rendererGlobals || {};
      // Compute the web directory name for use in asset paths
      _.each(module._modules, function(module) {
        module.web = '/apos-' + self.cssName(module.name);
      });

      // The same list in reverse order, for use in pushing assets (all versions of the
      // asset file are pushed to the browser, starting with the snippets class, because
      // CSS and JS are cumulative and CSS is very order dependent)
      //
      // Use slice(0) to make sure we get a copy and don't alter the original
      module._reverseModules = module._modules.slice(0).reverse();

      // Render a partial, looking for overrides in our preferred places
      module.render = function(name, data) {
        return module.renderer(name)(data);
      };

      module.renderPage = function(name, data, when) {
        return module._pages.decoratePageContent({ content: module.render(name, data), when: when });
      };

      // Return a function that will render a particular partial looking for overrides in our
      // preferred places. Also merge in any properties of self._rendererGlobals, which can
      // be set via the rendererGlobals option when the module is configured

      module.renderer = function(name) {
        return function(data) {
          if (!data) {
            data = {};
          }
          _.defaults(data, module._rendererGlobals);
          return module._apos.partial(name, data, _.map(module._modules, function(module) { return module.dir + '/views'; }));
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
          // We're interested in ALL versions of main.js or main.css, starting
          // with the base one (snippets module version, if this module is
          // descended from snippets). CSS and JS are additive

          _.each(module._reverseModules, function(module) {
            options.fs = module.dir;
            options.web = module.web;
            return self.pushAsset(type, name, options);
          });
        }
      };

      module.serveAssets = function() {
        _.each(module._modules, function(m) {
          self.app.get(m.web + '/*', self.static(m.dir + '/public'));
        });
      };
    };

      // Thoughts toward support for writing web APIs more easily
      //   module._apis = [];
      //   module.api = function() {
      //     // We don't support regular expressions because it is impossible to
      //     // append a prefix to an existing javascript RegExp object
      //     if (typeof(arguments[1]) !== 'string') {
      //       throw 'URL pattern must be a string when invoking module.api.';
      //     }
      //     // Defer until serve is called at which point we'll know what
      //     // our prefix should be
      //     module._apis.push(Array.prototype.slice.call(arguments));
      //   };

      //   module.serve = function() {
      //     // At this late stage the final name of the module is known
      //     var name = module._modules.slice(-1)[0].name;
      //     module._action = '/apos-' + name + '-api';
      //     // Make the browser aware of our prefix:
      //     // apos.data.modules.snippets.api = '/apos-snippets-api'
      //     var push = { modules: {} };
      //     push.modules[name] = {
      //       api: name
      //     };
      //     self.pushGlobalData(push);
      //     _.each(module._apis, function(api) {
      //       // Call get, post, etc. as appropriate based on api[0]. Mess
      //       // with the pattern but not with anything else.
      //       //
      //       // This way we are agnostic about the arguments that don't belong
      //       // to us, including middleware.
      //       var method = api[0];
      //       // Prepend the prefix for this module
      //       api[1] = module._action + api[1];
      //       self.app[method].apply(api.slice(1));
      //     });
      //     _.each(module._modules, function(m) {
      //       self.app.get(m.web + '/*', self.static(m.dir + '/public'));
      //     });
      //   };

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

    // Serve minified CSS. (If we're not minifying, aposStylesheets won't
    // point here at all.)
    self.app.get('/apos/stylesheets.css', function(req, res) {
      if ((!self._minified[req.query.when]) || (!self._minified[req.query.when].stylesheets)) {
        console.error('CODE CHANGE REQUIRED: you must call apos.endAssets after initializing all modules that might call apos.pushAsset. Be aware it takes a callback.');
        res.statusCode = 500;
        return res.send('apos.endAssets not called');
      }
      res.type('text/css');
      res.send(self._minified[req.query.when].stylesheets);
    });

    // Serve minified js. (If we're not minifying, aposScripts won't
    // point here at all.)
    self.app.get('/apos/scripts.js', function(req, res) {
      if ((!self._minified[req.query.when]) || (!self._minified[req.query.when].scripts)) {
        console.error('CODE CHANGE REQUIRED: you must call apos.endAssets after initializing all modules that might call apos.pushAsset. Be aware it takes a callback.');
      }
      res.contentType = 'text/javascript';
      res.send(self._minified[req.query.when].scripts);
    });
  }
};
