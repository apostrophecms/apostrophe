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
      { name: "editor", when: 'user' }
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
      { name: 'editor', when: 'user' },
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

    var alreadyPushed = {};

    // `self.pushAsset('stylesheet', 'foo', { dir: __dirname, web: '/apos-mymodule', when: 'always' })` will preload
    // `/apos-mymodule/css/foo.css` at all times.
    //
    // `self.pushAsset('script', 'foo', { dir: __dirname, web: '/apos-mymodule', when: 'user' })` will preload
    // `/apos-mymodule/js/foo.js` only when a user is logged in.
    //
    // `self.pushAsset('template', 'foo', { dir: __dirname })` will render
    // the partial `{__dirname}/views/foo.html` at the bottom of the body
    // (s`elf.partial` will take care of adding the extension). Note
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
    // The fs and web options default to `__dirname` and `/apos` for easy use in the apostrophe module itself.
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
      }
      var key = type + ':' + name + ':' + fs + ':' + web;
      if (type !== 'template') {
        if (alreadyPushed[key]) {
          return;
        }
        alreadyPushed[key] = true;
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

      if (typeof(name) === 'function') {
        return self._assets[types[type].key].push({ call: name, when: when });
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
      self._assets[types[type].key].push({ file: filePath, web: webPath, when: when });
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

      console.log('MINIFYING, this will take a minute...');
      async.series([
        function(callback) {
          return async.forEachSeries(options.scenes, compileSceneStylesheets, callback);
        },
        function(callback) {
          return async.forEachSeries(options.scenes, compileSceneScripts, callback);
        }
      ], function(err) {
        console.log('Minification complete.');
        return callback(err);
      });

      function compileSceneStylesheets(scene, callback) {
        return async.mapSeries(self.filterAssets(self._assets['stylesheets'], scene), compileStylesheet, function(err, stylesheets) {
          if (err) {
            return callback(err);
          }
          self._minifiedCss[scene] = cleanCss.process(stylesheets.join("\n"));
          return callback(null);
        });
      }

      function compileStylesheet(stylesheet, callback) {
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
      }

      // For now we don't actually need async for scripts, but now
      // we have the option of going there
      function compileSceneScripts(scene, callback) {
        var scripts = _.filter(self.filterAssets(self._assets['scripts'], scene), function(script) {
          var exists = fs.existsSync(script.file);
          if (!exists) {
            console.log("Warning: " + script.file + " does not exist");
          }
          return exists;
        });
        self._minifiedJs[scene] = uglifyJs.minify(_.map(scripts, function(script) { return script.file; })).code;
        return callback(null);
      }
    };

    // Part of the implementation of apos.endAssets, this method
    // returns only the assets that are suitable for the specified
    // scenario (`user` or `anon`).

    self.filterAssets = function(assets, when) {
      // Support older layouts
      if (!when) {
        throw new Error('You must specify the "when" argument (usually either anon or user)');
      }
      return _.filter(assets, function(asset) {
        return (asset.when === 'always') || (when === 'all') || (asset.when === when);
      });
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
    self._minifiedCss = {};

    // Serve minified CSS. (If we're not minifying, aposStylesheets won't
    // point here at all.)
    self.app.get('/apos/stylesheets.css', function(req, res) {
      if (self._minifiedCss[req.query.when] === undefined) {
        console.error('CODE CHANGE REQUIRED: you must call apos.endAssets after initializing all modules that might call apos.pushAsset. Be aware it takes a callback.');
        res.statusCode = 500;
        return res.send('apos.endAssets not called');
      }
      res.type('text/css');
      res.send(self._minifiedCss[req.query.when]);
    });

    self._minifiedJs = {};

    // Serve minified js. (If we're not minifying, aposScripts won't
    // point here at all.)
    self.app.get('/apos/scripts.js', function(req, res) {
      if (!self._minifiedJs[req.query.when]) {
        console.error('CODE CHANGE REQUIRED: you must call apos.endAssets after initializing all modules that might call apos.pushAsset. Be aware it takes a callback.');
      }
      res.contentType = 'text/javascript';
      res.send(self._minifiedJs[req.query.when]);
    });
  }
};
