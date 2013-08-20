/* jshint undef: true */
var oembed = require('oembed');
var request = require('request');
var async = require('async');
var sanitize = require('validator').sanitize;
var fs = require('fs');
var _ = require('underscore');
_.str = require('underscore.string');
var nunjucks = require('nunjucks');
var async = require('async');
var lessMiddleware = require('less-middleware');
var hash_file = require('hash_file');
var path = require('path');
// provides quality date/time formatting which we make available in templates
var moment = require('moment');
// Query string parser/generator
var qs = require('qs');
// LESS CSS compiler
var less = require('less');
// JS minifier and optimizer
var uglifyJs = require('uglify-js');
// CSS minifier https://github.com/GoalSmashers/clean-css
var cleanCss = require('clean-css');
var extend = require('extend');
var jsDiff = require('diff');
var wordwrap = require('wordwrap');
var ent = require('ent');
var argv = require('optimist').argv;
var qs = require('qs');
var joinr = require('joinr');

// Needed for A1.5 bc implementation of authentication, normally
// we go through appy's passwordHash wrapper
var crypto = require('crypto');
var passwordHash = require('password-hash');

// MongoDB prefix queries are painful without this
RegExp.quote = require("regexp-quote");

function Apos() {
  var self = this;

  // Apostrophe is an event emitter/receiver
  require('events').EventEmitter.call(self);

  self.render = function(res, template, info) {
    return res.send(self.partial(template, info));
  };

  self.fail = function(req, res) {
    res.statusCode = 500;
    res.send('500 error, URL was ' + req.url);
  };

  self.forbid = function(res) {
    res.statusCode = 403;
    res.send('Forbidden');
  };

  self.notfound = function(req, res) {
    res.statusCode = 404;
    res.send('404 not found error, URL was ' + req.url);
  };

  self.generateId = function() {
    // TODO use something better, although this is not meant to be
    // ultra cryptographically secure
    return Math.floor(Math.random() * 1000000000) + '' + Math.floor(Math.random() * 1000000000);
  };

  // This is our standard set of controls. If you add a new widget you'll be
  // adding that to self.itemTypes (with widget: true) and to this list of
  // default controls - or not, if you think your widget shouldn't be available
  // unless explicitly specified in a aposArea call. If your project should *not*
  // offer a particular control, ever, you can remove it from this list
  // programmatically

  // Removed the code widget for now in favor of giving 'pre' in the format dropdown a try
  self.defaultControls = [ 'style', 'bold', 'italic', 'createLink', 'unlink', 'insertUnorderedList', 'insertTable', 'slideshow', 'buttons', 'video', 'files', 'pullquote', 'html' ];

  // These are the controls that map directly to standard document.executeCommand
  // rich text editor actions. You can modify these to introduce other simple verbs that
  // are supported across all browsers by document.execCommand, or to add or remove
  // tags from the choices array of apos.controlTypes.style, but if you introduce
  // commands or tags that the browser does not actually support it will not
  // do what you want.
  //
  // This is not the place to define widgets. See apos.itemTypes for that.

  self.controlTypes = {
    style: {
      type: 'menu',
      label: 'Style',
      choices: [
        { value: 'div', label: 'Normal' },
        { value: 'h3', label: 'Heading 3' },
        { value: 'h4', label: 'Heading 4' },
        { value: 'h5', label: 'Heading 5' },
        { value: 'h6', label: 'Heading 6' },
        { value: 'pre', label: 'Preformatted' },
      ]
    },
    bold: {
      type: 'button',
      label: 'Bold',
      icon: 'bold'
    },
    italic: {
      type: 'button',
      label: 'Italic',
      icon: 'italic'
    },
    createLink: {
      type: 'button',
      label: 'Link',
      icon: 'link'
    },
    unlink: {
      type: 'button',
      label: 'Unlink',
      icon: 'unlink'
    },
    insertUnorderedList: {
      type: 'button',
      label: 'List',
      icon: 'ul'
    },
    insertTable: {
      type: 'button',
      label: 'Table',
      icon: 'table'
    }
  };

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
    { name: 'mediaLibrary', when: 'user' }
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
    { name: 'mediaLibrary', when: 'user' }
  ];

  // Full paths to assets as computed by pushAsset
  self._assets = { stylesheets: [], scripts: [], templates: [] };

  var alreadyPushed = {};

  // self.pushAsset('stylesheet', 'foo', { dir: __dirname, web: '/apos-mymodule', when: 'always' }) will preload
  // /apos-mymodule/css/foo.css at all times. Leaving off the last argument
  // has the same effect.

  // self.pushAsset('script', 'foo', { dir: __dirname, web: '/apos-mymodule', when: 'user' }) will preload
  // /apos-mymodule/js/foo.js only when a user is logged in.

  // self.pushAsset('template', 'foo', { dir: __dirname }) will render
  // the partial {__dirname}/views/foo.html at the bottom of the body
  // (self.partial will take care of adding the extension). Note
  // that 'web' is not used for templates.
  //
  // If you wish you may pass `options` as the second argument as long
  // as you include a `name` property in `options`.
  //
  // You may also write:
  // self.pushAsset('template', function() { foo })
  //
  // Which allows you to render the template in your own context and is typically
  // the easier way when pushing a template from a module like apostrophe-snippets.
  //
  // The fs and web options default to __dirname and '/apos' for easy use in the apostroph emodule itself.
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

  // Beginning in 0.4.66 you must call
  // apos.endAssets when you are through pushing
  // assets. This is necessary because the LESS
  // compiler is no longer asynchronous, so we can't
  // wait for aposStylesheet calls in Nunjucks to
  // do the compilation.
  //
  // The options argument is not required. If you do
  // provide one you may specify additional scenes,
  // and should always specify 'anon' and 'user'. Our official
  // modules are only concerned with those two cases.
  // Assets pushed with when set to 'always' are
  // deployed in both scenes.

  self._endAssetsCalled = false;

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

  self.fileGroups = [
    {
      name: 'images',
      label: 'Images',
      extensions: [ 'gif', 'jpg', 'png' ],
      extensionMaps: {
        jpeg: 'jpg'
      },
      // uploadfs should treat this as an image and create scaled versions
      image: true
    },
    {
      name: 'office',
      label: 'Office',
      extensions: [ 'txt', 'rtf', 'pdf', 'xls', 'ppt', 'doc', 'pptx', 'sldx', 'ppsx', 'potx', 'xlsx', 'xltx', 'docx', 'dotx' ],
      extensionMaps: {},
      // uploadfs should just accept this file as-is
      image: false
    },
  ];

  self.init = function(options, callback) {

    self.fileGroups = options.fileGroups || self.fileGroups;

    self.uploadfs = options.uploadfs;
    self.permissions = options.permissions;

    // An id for this particular process that should be unique
    // even in a multiple server environment
    self._pid = self.generateId();

    // Set up standard local functions for Express in self._aposLocals
    require('./aposLocals.js')(self);

    if (options.locals) {
      _.extend(self._aposLocals, options.locals);
    }

    function setupPages(callback) {
      self.db.collection('aposPages', function(err, collection) {
        function indexSlug(callback) {
          self.pages.ensureIndex({ slug: 1 }, { safe: true, unique: true }, callback);
        }
        function indexTags(callback) {
          self.pages.ensureIndex({ tags: 1 }, { safe: true }, callback);
        }
        self.pages = collection;
        async.series([indexSlug, indexTags], callback);
        // ... more index functions
      });
    }

    // Each time a page or area is updated with putArea or putPage, a new version
    // object is also created. Regardless of whether putArea or putPage is called,
    // if the area is in the context of a page it is the entire page that is
    // versioned. A pageId or areaId property is added, which is a non-unique index
    // allowing us to fetch prior versions of any page or independently stored
    // area. Also createdAt and author. Author is a string to avoid issues with
    // references to deleted users.
    //
    // Note that this also provides full versioning for types built upon pages, such as
    // blog posts and snippets.

    function setupVersions(callback) {
      self.db.collection('aposVersions', function(err, collection) {
        function index(callback) {
          self.versions.ensureIndex({ pageId: 1, createdAt: -1 }, { safe: true }, callback);
        }
        self.versions = collection;
        async.series([index], callback);
        // ... more index functions
      });
    }

    function setupFiles(callback) {
      self.db.collection('aposFiles', function(err, collection) {
        self.files = collection;
        return callback(err);
      });
    }

    function setupVideos(callback) {
      self.db.collection('aposVideos', function(err, collection) {
        function searchIndex(callback) {
          self.videos.ensureIndex({ searchText: 1 }, { safe: true }, callback);
        }
        // Index the URLs
        function videoIndex(callback) {
          self.videos.ensureIndex({ video: 1 }, { safe: true }, callback);
        }
        self.videos = collection;
        return async.series([searchIndex, videoIndex], callback);
      });
    }

    function setupRedirects(callback) {
      self.db.collection('aposRedirects', function(err, collection) {
        self.redirects = collection;
        collection.ensureIndex({ from: 1 }, { safe: true, unique: true }, function(err) {
          return callback(err);
        });
      });
    }

    function afterDb(callback) {

      if (options.controls) {
        self.defaultControls = options.controls;
      }

      // The apos.permissions method is used for access control. The permissions method invokes
      // its callback with null if the user may carry out the action, otherwise with a permissions
      // error string. Although this method is async permissions decisions should be made quickly.

      // You can specify an alternate method via the `permissions` option, however the standard
      // approach works well for most purposes and the apos object emits a `permissions` event
      // that provides an easier way to extend permissions. The `permissions` event receives
      // the request object, the action, and a `result` object with a `response` property which is what
      // will be passed to the callback if no changes are made. To alter the result, just
      // change `result.response`. (This currently does require that you make a decision immediately,
      // without async.)

      // The following actions exist so far in the core apostrophe and apostrophe-pages modules:

      // `edit-page`, `add-page`, `delete-page`, `view-page`, `edit-media`, `delete-media`,
      // `add-media`, `reorganize-pages`

      // If there is no third argument, the question is whether this user can *ever*
      // perform the action in question. This is used to decide whether the user sees
      // the pages dropdown menu, has access to the media library, etc.

      // If there is a third argument, this method checks whether the user can
      // carry out the specified action on that particular object.

      // Snippet subclasses add their own permissions:

      // `edit-snippet`, `edit-blog`, `edit-event`, `edit-person`, `edit-group`

      // These do not take a third argument. They are used to determine whether the user
      // should see the relevant dropdown menu at all. Since snippets are just a subclass
      // of pages, the `edit-page` permission is used to determine whether each one is
      // actually editable by this user.

      // If a third argument is present for `edit-media` it will be a file object
      // (see the aposFiles collection), with an `ownerId` property set to the id of
      // req.user at the time the file was last edited.

      // *Responses from apos.permissions must match what would result from
      // self.getPermissionsCriteria and self.addPermissionsToPages.* Those methods are
      // used to fetch many pages/snippets in bulk with the correct permissions.

      if (!self.permissions) {
        self.permissions = function(req, action, object, callback) {
          function filter(response) {
            // Post an event allowing an opportunity to change the result
            var result = { response: response };
            self.emit('permissions', req, action, result);
            return callback(result.response);
          }
          var userPermissions = (req.user && req.user.permissions) || {};
          if (userPermissions.admin) {
            // Admins can do anything
            return filter(null);
          } else if (action.match(/\-page$/) && object) {
            // Separate method for page permissions on specific pages
            return self.pagePermissions(req, action, object, filter);
          } else if (action.match(/\-file$/) && object) {
            // Separate method for file permissions on specific files
            return self.filePermissions(req, action, object, filter);
          } else if (action.match(/^view/)) {
            // We assume everyone can view things in the general case
            return filter(null);
          } else if (action.match(/^edit\-/) && (!object)) {
            // If you have the edit permission as a user, you are a potential editor of things and
            // should be permitted to see various dropdown menus. Note that we don't apply this
            // rule if a specific object was passed, in that case an event listener needs to step
            // up and make a more definitive determination
            if (userPermissions.edit) {
              return filter(null);
            }
          }
          return filter('Forbidden');
        };
      }

      self.areaFindFile = function(options) {
        if (!options) {
          options = {};
        }
        var area = options.area;
        var winningFile;
        if (!(area && area.items)) {
          return false;
        }
        _.some(area.items, function(item) {
          // The slideshow, files and similar widgets use an 'items' array
          // to store files. Let's look there, and also allow for '_items' to
          // support future widgets that pull in files dynamically. However
          // we also must make sure the items are actually files by making
          // sure they have an `extension` property. (TODO: this is a hack,
          // think about having widgets register to participate in this.)
          if (!item._items) {
            return false;
          }
          var file = _.find(item._items, function(file) {
            if (file.extension === undefined) {
              return false;
            }
            if (options.extension) {
              if (file.extension !== options.extension) {
                return false;
              }
            }
            if (options.group) {
              if (file.group !== options.group) {
                return false;
              }
            }
            if (options.extensions) {
              if (!_.contains(options.extensions, file.extension)) {
                return false;
              }
            }
            return true;
          });
          if (file) {
            winningFile = file;
          }
        });
        return winningFile;
      };

      self.getAreaPlaintext = function(options) {
        var area = options.area;
        if (!area) {
          return '';
        }
        var t = '';
        _.each(area.items, function(item) {
          if (self.itemTypes[item.type].getPlaintext) {
            if (t.length) {
              t += "\n";
            }
            t += self.itemTypes[item.type].getPlaintext(item);
          }
        });
        if (options.truncate) {
          t = self.truncatePlaintext(t, options.truncate);
        }
        return t;
      };

      // Truncate a plaintext string at the character count expressed
      // by the limit argument, which defaults to 200. NOT FOR HTML/RICH TEXT!
      // self.truncatePlaintext = function(t, limit) {
      //   limit = limit || 200;
      //   if (t.length <= limit) {
      //     return t;
      //   }
      //   // Leave room for the ellipsis unicode character
      //   // (-2 instead of -1 for the last offset we look at)
      //   var p = limit - 2;
      //   while (p >= 0) {
      //     var c = t.charAt(p);
      //     if ((c === ' ') || (c === "\n")) {
      //       return t.substr(0, p).replace(/,$/, '') + '…';
      //     }
      //     p--;
      //   }
      //   // Saving words failed, do a hard crop
      //   return t.substr(0, limit - 1) + '…';
      // };

      // self.truncatePlaintext = function(t, limit) {
      //   return _.str.prune(t, limit);
      // }

      self.truncatePlaintext = _.str.prune;

      // In addition to making these available in self.app.locals we also
      // make them available in our own partials later.
      _.extend(self.app.locals, self._aposLocals);

      // Make a pushCall method available on the request object,
      // which is called like this:
      //
      // req.pushCall('my.browserSide.method(?, ?)', arg1, arg2, ...)
      //
      // Each ? is replaced by a properly JSON-encoded version of the
      // next argument.
      //
      // If you need to pass the name or part of the name of a function dynamically,
      // you can use @ to pass an argument literally:
      //
      // req.pushCall('new @(?)', 'AposBlog', { options... })
      //
      // These calls can be returned as a single block of browser side
      // js code by invoking:
      //
      // apos.calls(req)
      //
      // The req object is necessary because the context for these calls
      // is a single page request. You will typically invoke this from a
      // route function or from middleware. The pages module automatically
      // passes this ready-to-run JS source code as the 'calls' property of
      // the data object given to the page template.
      //
      // You may also call:
      //
      // apos.pushGlobalCallWhen('user', 'my.browserSide.method(?, ?)', arg1, arg2, ...)
      //
      // Which pushes a call that will be included EVERY TIME
      // apos.globalCallsWhen('user') is invoked. This is NOT specific
      // to a single request and should be used for global client-side
      // configuration needed at all times. The pages module automatically
      // passes this code as the 'globalCalls' property of the data object given
      // to the page template.

      self.app.request.pushCall = function(pattern) {
        var req = this;
        if (!req._aposCalls) {
          req._aposCalls = [];
        }
        // Turn arguments into a real array https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Functions_and_function_scope/arguments
        var args = Array.prototype.slice.call(arguments);
        req._aposCalls.push({
          pattern: pattern,
          arguments: args.slice(1)
        });
      };

      self.getCalls = function(req) {
        return self._getCalls(req._aposCalls || []);
      };

      self._globalCalls = {};

      // Push a browser side JS call that will be invoked 'when'
      // a particular situation applies. Currently 'always' and
      // 'user' (a logged in user is present) are supported. Any
      // @'s and ?'s in 'pattern' are replaced with the remaining arguments
      // after 'when'. @ arguments appear literally (useful for
      // constructor names) while ? arguments are JSON-encoded.
      //
      // Example:
      // apos.pushGlobalCallWhen('user', 'aposPages.addType(?)', typeObject)

      self.pushGlobalCallWhen = function(when, pattern) {
        // Turn arguments into a real array https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Functions_and_function_scope/arguments
        var args = Array.prototype.slice.call(arguments);
        if (!self._globalCalls[when]) {
          self._globalCalls[when] = [];
        }
        self._globalCalls[when].push({ pattern: pattern, arguments: args.slice(2) });
      };

      self.getGlobalCallsWhen = function(when) {
        var s = self._getCalls(self._globalCalls[when] || []);
        return s;
      };

      // Turn any number of call objects like this:
      // [ { pattern: @.func(?), arguments: [ 'myFn', { age: 57 } ] } ]
      //
      // Into javascript source code like this:
      //
      // myFn.func({ age: 57 });
      // ... next call here ...
      //
      // Suitable to be emitted inside a script tag.
      //
      // Note that ? JSON-encodes an argument, while @ inserts it literally.

      self._getCalls = function(calls) {
        return _.map(calls, function(call) {
          var code = '  ';
          var pattern = call.pattern;
          var n = 0;
          var from = 0;
          while (true) {
            var qat = pattern.substr(from).search(/[\?\@]/);
            if (qat !== -1) {
              qat += from;
              code += pattern.substr(from, qat - from);
              if (pattern.charAt(qat) === '?') {
                // ? inserts an argument JSON-encoded
                code += JSON.stringify(call.arguments[n++]);
              } else {
                // @ inserts an argument literally, unquoted
                code += call.arguments[n++];
              }
              from = qat + 1;
            } else {
              code += pattern.substr(from);
              break;
            }
          }
          code += ";";
          return code;
        }).join("\n");
      };

      self.pushGlobalCallWhen('user', 'apos.enableAreas()');
      self.pushGlobalCallWhen('always', 'apos.enablePlayers()');

      // Pass data to JavaScript on the browser side. We extend the self.app.request template
      // so that req.pushData() is a valid call.
      //
      // req.pushData() expects an object. The properties of this object are
      // merged recursively with the browser side apos.data object, using the
      // jQuery extend() method. You can make many calls, merging in more data,
      // and unspool them all
      // as a block of valid browser-ready javascript by invoking apos.getData(req).
      // The pages module automatically does this and makes that code available
      // to the page template as the `data` property.

      self.app.request.pushData = function(datum) {
        var req = this;
        if (!req._aposData) {
          req._aposData = [];
        }
        req._aposData.push(datum);
      };

      self.getData = function(req) {
        return self._getData(req._aposData || []);
      };

      self._globalData = [];

      // Make global settings such as apos.data.uploadsUrl available to the browser. You
      // can push more data by calling apos.pushGlobalData(). $.extend is used
      // to merge consecutive pushes that refer to the same parent elements. This
      // global data is returned as ready-to-run JS code EVERY TIME apos.getGlobalData()
      // is called. For data that is specific to a single request, see
      // req.pushData and apos.getData().
      //
      // The pages module automatically calls apos.getGlobalData() and makes that
      // code available to the page template as the `data` property.

      self.pushGlobalData = function(datum) {
        self._globalData.push(datum);
      };

      self.getGlobalData = function() {
        return self._getData(self._globalData || []);
      };

      self._getData = function(data) {
        var code = '  apos.data = apos.data || {};\n';
        code += _.map(data, function(datum) {
          return '  $.extend(true, apos.data, ' + JSON.stringify(datum) + ');';
        }).join("\n");
        return code;
      };

      // Add more locals for Apostrophe later. Used by extension modules
      // like apostrophe-pages
      self.addLocal = function(name, fn) {
        self._aposLocals[name] = fn;
        self.app.locals[name] = fn;
      };

      // All routes must begin with /apos!

      // Upload files
      self.app.post('/apos/upload-files', function(req, res) {
        var newFiles = req.files.files;
        if (!(newFiles instanceof Array)) {
          newFiles = [ newFiles ];
        }
        var infos = [];
        async.map(newFiles, function(file, callback) {
          var extension = path.extname(file.name);
          if (extension && extension.length) {
            extension = extension.substr(1);
          }
          extension = extension.toLowerCase();
          // Do we accept this file extension?
          var accepted = [];
          var group = _.find(self.fileGroups, function(group) {
            accepted.push(group.extensions);
            var candidate = group.extensionMaps[extension] || extension;
            if (_.contains(group.extensions, candidate)) {
              return true;
            }
          });
          if (!group) {
            return callback("File extension not accepted. Acceptable extensions: " + accepted.join(", "));
          }
          var image = group.image;
          var info = {
            _id: self.generateId(),
            length: file.length,
            group: group.name,
            createdAt: new Date(),
            name: self.slugify(path.basename(file.name, path.extname(file.name))),
            title: self.sortify(path.basename(file.name, path.extname(file.name))),
            extension: extension
          };

          function permissions(callback) {
            self.permissions(req, 'edit-media', null, callback);
          }

          function md5(callback) {
            return self.md5File(file.path, function(err, md5) {
              if (err) {
                return callback(err);
              }
              info.md5 = md5;
              return callback(null);
            });
          }

          // If a duplicate file is uploaded, quietly reuse the old one to
          // avoid filling the hard drive
          //
          // This has been quietly removed for now. It could be an option
          // later, but at the moment on rare occasions people will need
          // two copies in order to have two titles. TODO: address that
          // more gracefully.
          //
          // function reuseOrUpload(callback) {
          //   return files.findOne({ md5: info.md5 }, function(err, existing) {
          //     if (err) {
          //       return callback(err);
          //     }
          //     if (existing) {
          //       infos.push(existing);
          //       return callback(null);
          //     } else {
          //       async.series([upload, db], callback);
          //     }
          //   });
          // }

          function upload(callback) {
            if (image) {
              // For images we correct automatically for common file extension mistakes
              return self.uploadfs.copyImageIn(file.path, '/files/' + info._id + '-' + info.name, function(err, result) {
                if (err) {
                  return callback(err);
                }
                info.extension = result.extension;
                info.width = result.width;
                info.height = result.height;
                info.searchText = fileSearchText(info);
                if (info.width > info.height) {
                  info.landscape = true;
                } else {
                  info.portrait = true;
                }
                return callback(null);
              });
            } else {
              // For non-image files we have to trust the file extension
              // (but we only serve it as that content type, so this should
              // be reasonably safe)
              return self.uploadfs.copyIn(file.path, '/files/' + info._id + '-' + info.name + '.' + info.extension, callback);
            }
          }

          function db(callback) {
            info.ownerId = req.user && req.user._id;
            self.files.insert(info, { safe: true }, function(err, docs) {
              if (!err) {
                infos.push(docs[0]);
              }
              return callback(err);
            });
          }

          async.series([ permissions, md5, upload, db ], callback);

        }, function(err) {
          return res.send({ files: infos, status: 'ok' });
        });
      });

      // Replace one file. TODO: reduce redundancy with
      // /apos/upload-files

      self.app.post('/apos/replace-file', function(req, res) {
        var id = req.query.id;
        return self.files.findOne({ _id: id }, function(err, file) {
          if (err || (!file)) {
            return self.fail(req, res);
          }
          // Permissions: if you're not an admin you must own the file
          if (!req.user.permissions.admin) {
            if (file.ownerId !== req.user._id) {
              return self.fail(req, res);
            }
          }
          var newFiles = req.files.files;
          if (!(newFiles instanceof Array)) {
            newFiles = [ newFiles ];
          }
          if (!newFiles.length) {
            return self.fail(req, res);
          }
          // The last file is the one we're interested in if they
          // somehow send more than one
          var upload = newFiles.pop();
          var extension = path.extname(upload.name);
          if (extension && extension.length) {
            extension = extension.substr(1);
          }
          extension = extension.toLowerCase();
          // Do we accept this file extension?
          var accepted = [];
          var group = _.find(self.fileGroups, function(group) {
            accepted.push(group.extensions);
            var candidate = group.extensionMaps[extension] || extension;
            if (_.contains(group.extensions, candidate)) {
              return true;
            }
          });
          if (!group) {
            res.statusCode = 400;
            return res.send("File extension not accepted. Acceptable extensions: " + accepted.join(", "));
          }
          // Don't mess with previously edited metadata, but do allow
          // the actual filename, extension, etc. to be updated
          var image = group.image;
          extend(file, {
            length: file.length,
            group: group.name,
            createdAt: new Date(),
            name: self.slugify(path.basename(upload.name, path.extname(upload.name))),
            extension: extension
          });

          function permissions(callback) {
            self.permissions(req, 'edit-media', null, callback);
          }

          function md5(callback) {
            return self.md5File(upload.path, function(err, md5) {
              if (err) {
                return callback(err);
              }
              file.md5 = md5;
              return callback(null);
            });
          }

          // If a duplicate file is uploaded, quietly reuse the old one to
          // avoid filling the hard drive
          //
          // Quietly removed for now due to issues with the occasional need
          // for two copies to allow two titles. Now that we have a good
          // media library automatic duplicate prevention is less urgent.
          //
          // function reuseOrUpload(callback) {
          //   return files.findOne({ md5: info.md5 }, function(err, existing) {
          //     if (err) {
          //       return callback(err);
          //     }
          //     if (existing) {
          //       infos.push(existing);
          //       return callback(null);
          //     } else {
          //       async.series([upload, db], callback);
          //     }
          //   });
          // }

          function copyIn(callback) {
            if (image) {
              // For images we correct automatically for common file extension mistakes
              return self.uploadfs.copyImageIn(upload.path, '/files/' + file._id + '-' + file.name, function(err, result) {
                if (err) {
                  return callback(err);
                }
                file.extension = result.extension;
                file.width = result.width;
                file.height = result.height;
                file.searchText = fileSearchText(file);
                if (file.width > file.height) {
                  file.landscape = true;
                } else {
                  file.portrait = true;
                }
                return callback(null);
              });
            } else {
              // For non-image files we have to trust the file extension
              // (but we only serve it as that content type, so this should
              // be reasonably safe)
              return self.uploadfs.copyIn(upload.path, '/files/' + file._id + '-' + file.name + '.' + file.extension, callback);
            }
          }

          function db(callback) {
            self.files.update({ _id: file._id }, file, function(err, count) {
              return callback(err);
            });
          }

          async.series([ permissions, md5, copyIn, db ], function(err) {
            if (err) {
              return self.fail(req, res);
            }
            return res.send({ file: file, status: 'ok' });
          });
        });
      });

      // Crop a previously uploaded image. This uploads a new, cropped version of
      // it to uploadfs, named /files/ID-NAME.top.left.width.height.extension
      self.app.post('/apos/crop', function(req, res) {
        var _id = req.body._id;
        var crop = req.body.crop;
        var file;
        async.series([
          function(callback) {
            return self.permissions(req, 'edit-media', null, callback);
          },
          function(callback) {
            self.files.findOne({ _id: _id }, function(err, fileArg) {
              file = fileArg;
              return callback(err);
            });
          }
        ], function(err) {
          if (!file) {
            console.log(err);
            return self.fail(req, res);
          }
          file.crops = file.crops || [];
          var existing = _.find(file.crops, function(iCrop) {
            if (_.isEqual(crop, iCrop)) {
              return true;
            }
          });
          if (existing) {
            // We're done, this crop is already available
            return res.send('OK');
          }
          // Pull the original out of cloud storage to a temporary folder where
          // it can be cropped and popped back into uploadfs
          var originalFile = '/files/' + file._id + '-' + file.name + '.' + file.extension;
          var tempFile = self.uploadfs.getTempPath() + '/' + self.generateId() + '.' + file.extension;
          var croppedFile = '/files/' + file._id + '-' + file.name + '.' + crop.left + '.' + crop.top + '.' + crop.width + '.' + crop.height + '.' + file.extension;

          async.series([
            function(callback) {
              self.uploadfs.copyOut(originalFile, tempFile, callback);
            },
            function(callback) {
              self.uploadfs.copyImageIn(tempFile, croppedFile, { crop: crop }, callback);
            },
            function(callback) {
              file.crops.push(crop);
              self.files.update({ _id: file._id }, file, callback);
            }
          ], function(err) {
            // We're done with the temp file. We don't care if it was never created.
            fs.unlink(tempFile, function() { });
            if (err) {
              res.statusCode = 404;
              return res.send('Not Found');
            } else {
              return res.send('OK');
            }
          });
        });
      });

      self.app.get('/apos/browse-videos', function(req, res) {
        return self.permissions(req, 'edit-media', null, function(err) {
          if (err) {
            res.statusCode = 404;
            return res.send('not found');
          }
          var criteria = {};
          var limit = 10;
          var skip = 0;
          var q;
          skip = self.sanitizeInteger(req.query.skip, 0, 0);
          limit = self.sanitizeInteger(req.query.limit, 0, 0, 100);
          if (req.query.q) {
            criteria.searchText = self.searchify(req.query.q);
          }
          var result = {};
          async.series([
            function(callback) {
              return self.videos.count(criteria, function(err, count) {
                result.total = count;
                return callback(err);
              });
            },
            function(callback) {
              return self.videos.find(criteria).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(function(err, videos) {
                result.videos = videos;
                return callback(err);
              });
            }
          ], function(err) {
            if (err) {
              res.statusCode = 500;
              return res.send('error');
            }
            return res.send(result);
          });
        });
      });

      self.app.get('/apos/browse-files', function(req, res) {
        return self.permissions(req, 'edit-media', null, function(err) {
          if (err) {
            res.statusCode = 404;
            return res.send('not found');
          }
          return self.getFilesSanitized(req, req.query, function(err, result) {
            if (err) {
              res.statusCode = 500;
              return res.send('error');
            }
            return res.send(result);
          });
        });
      });

      self.getFilesSanitized = function(req, options, callback) {
        var newOptions = {};
        if (options.group) {
          newOptions.group = self.sanitizeString(options.group);
        }
        if (options.extension) {
          newOptions.extension = self.sanitizeString(options.extension);
        }
        if (options.ids) {
          newOptions.ids = [];
          _.each(Array.isArray(options.ids) || [], function(id) {
            newOptions.ids.push(self.sanitizeString(id));
          });
        }
        if (options.q) {
          newOptions.q = self.sanitizeString(options.q);
        }
        if (options.limit) {
          newOptions.limit = self.sanitizeInteger(options.limit, 0, 0);
        }
        if (options.skip) {
          newOptions.skip = self.sanitizeInteger(options.skip, 0, 0);
        }
        if (options.minSize) {
          newOptions.minSize = [
            options.sanitizeInteger(options.minSize[0], 0, 0),
            options.sanitizeInteger(options.minSize[1], 0, 0)
          ];
        }
        // trash is always sanitized in getFiles
        return self.getFiles(req, options, callback);
      };

      // Options are:
      //
      // group, extension, trash, skip, limit, q, minSize, ids
      //
      // The minSize option should be an array: [width, height]
      //
      // req is present to check view permissions (not yet needed, but
      // required for compatibility).
      //
      // Options must be pre-sanitized. See self.getFilesSanitized
      // for a wrapper that sanitizes the options so you can pass req.query.
      // For performance we don't want to sanitize on every page render that
      // just needs to join with previously chosen files.

      self.getFiles = function(req, options, callback) {
        var criteria = {};
        var limit = 10;
        var skip = 0;
        var q;
        if (options.group) {
          criteria.group = options.group;
        }
        if (options.extension) {
          criteria.extension = options.extension;
        }
        if (options.ids) {
          criteria._id = { $in: options.ids };
        }
        self.convertBooleanFilterCriteria('trash', options, criteria, '0');
        if (options.minSize) {
          criteria.width = { $gte: options.minSize[0] };
          criteria.height = { $gte: options.minSize[1] };
        }
        skip = self.sanitizeInteger(options.skip, 0, 0);
        limit = self.sanitizeInteger(options.limit, 0, 0, 100);
        if (options.q) {
          criteria.searchText = self.searchify(options.q);
        }
        var result = {};
        async.series([
          function(callback) {
            return self.files.count(criteria, function(err, count) {
              result.total = count;
              return callback(err);
            });
          },
          function(callback) {
            return self.files.find(criteria).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(function(err, files) {
              result.files = files;
              return callback(err);
            });
          }
        ], function(err) {
          if (err) {
            return callback(err);
          }
          return callback(null, result);
        });
      };

      // Annotate previously uploaded files
      self.app.post('/apos/annotate-files', function(req, res) {
        // make sure we have permission to edit files at all
        return self.permissions(req, 'edit-media', null, function(err) {
          if (err) {
            res.statusCode = 400;
            return res.send('invalid');
          }
          if (!Array.isArray(req.body)) {
            res.statusCode = 400;
            return res.send('invalid');
          }
          var criteria = { _id: { $in: _.pluck(req.body, '_id') } };
          // Verify permission to edit this particular file. TODO: this
          // should not be hardcoded here, but it does need to remain an
          // efficient query. Classic Apostrophe media permissions: if you
          // put it here, you can edit it. If you're an admin, you can edit it.
          if (!req.user.permissions.admin) {
            criteria.ownerId = req.user._id;
          }
          var results = [];
          return self.files.find(criteria).toArray(function(err, files) {
            return async.eachSeries(files, function(file, callback) {
              var annotation = _.find(req.body, function(item) {
                return item._id === file._id;
              });
              if (!annotation) {
                return callback('unexpected');
              }
              file.title = self.sanitizeString(annotation.title);
              file.description = self.sanitizeString(annotation.description);
              file.credit = self.sanitizeString(annotation.credit);
              file.tags = self.sanitizeTags(annotation.tags);
              results.push(file);
              return self.files.update({ _id: file._id }, file, callback);
            }, function(err) {
              if (err) {
                res.statusCode = 500;
                return res.send('error');
              }
              return res.send(results);
            });
          });
        });
      });

      // Delete previously uploaded file
      self.app.post('/apos/delete-file', function(req, res) {
        // make sure we have permission to edit files at all
        return self.permissions(req, 'edit-media', null, function(err) {
          if (err) {
            res.statusCode = 400;
            return res.send('invalid');
          }
          if (typeof(req.body) !== 'object') {
            res.statusCode = 400;
            return res.send('invalid');
          }
          var criteria = { _id: req.body._id };
          // Verify permission to edit this particular file. TODO: this
          // should not be hardcoded here, but it does need to remain an
          // efficient query. Classic Apostrophe media permissions: if you
          // put it here, you can edit it. If you're an admin, you can edit it.
          if (!req.user.permissions.admin) {
            criteria.ownerId = req.user._id;
          }
          var results = [];
          return self.files.update(criteria, { $set: { trash: true } }, function(err, count) {
            if (err || (!count)) {
              res.statusCode = 404;
              return res.send('not found');
            } else {
              return res.send({ 'status': 'deleted' });
            }
          });
        });
      });

      // Undelete previously uploaded file TODO refactor these two methods
      // to use the same implementation
      self.app.post('/apos/rescue-file', function(req, res) {
        // make sure we have permission to edit files at all
        return self.permissions(req, 'edit-media', null, function(err) {
          if (err) {
            res.statusCode = 400;
            return res.send('invalid');
          }
          if (typeof(req.body) !== 'object') {
            res.statusCode = 400;
            return res.send('invalid');
          }
          var criteria = { _id: req.body._id };
          // Verify permission to edit this particular file. TODO: this
          // should not be hardcoded here, but it does need to remain an
          // efficient query. Classic Apostrophe media permissions: if you
          // put it here, you can edit it. If you're an admin, you can edit it.
          if (!req.user.permissions.admin) {
            criteria.ownerId = req.user._id;
          }
          var results = [];
          return self.files.update(criteria, { $unset: { trash: true } }, function(err, count) {
            if (err || (!count)) {
              res.statusCode = 404;
              return res.send('not found');
            } else {
              return res.send({ 'status': 'rescued' });
            }
          });
        });
      });

      // Render an area editor ready to edit the area specified by
      // req.query.slug.

      self.app.get('/apos/edit-area', function(req, res) {
        try {
          var slug = req.query.slug;
          var options = req.query.options ? JSON.parse(req.query.options) : {};
          var area;
          var controls = options.controls || self.defaultControls;
          delete options.controls;
        } catch (e) {
          res.statusCode = 500;
          return res.send('bad arguments');
        }

        function getArea(callback) {
          self.getArea(req, slug, { editable: true }, function(err, areaArg) {
            if (!areaArg) {
              area = {
                slug: slug,
                content: null,
                isNew: true,
              };
            } else {
              area = areaArg;
              area.isNew = false;
            }
            return callback(err);
          });
        }

        function sendArea() {
          // A temporary id for the duration of the editing activity, useful
          // in the DOM. Areas are permanently identified by their slugs, not their IDs.
          area.wid = 'w-' + self.generateId();
          area.controls = controls;
          area.controlTypes = self.controlTypes;
          area.itemTypes = self.itemTypes;
          area.standalone = true;
          area.editView = true;
          area.options = options;
          return self.render(res, 'editArea', area);
        }

        async.series([ getArea ], sendArea);

      });

      // Render an editor for a virtual area with the content
      // specified as a JSON array of items by the req.body.content
      // property, if any. For use when you are supplying your own storage
      // (for instance, the blog module uses this to render
      // an area editor for the content of a post).

      self.app.post('/apos/edit-virtual-area', function(req, res) {
        var content = req.body.content ? JSON.parse(req.body.content) : [];
        var options = req.body.options ? JSON.parse(req.body.options) : {};
        self.sanitizeItems(content);
        var area = {
          items: content
        };
        var controls = req.query.controls ? req.query.controls.split(' ') : [];
        if (!controls.length) {
          controls = self.defaultControls;
        }
        // A temporary id for the duration of the editing activity, useful
        // in the DOM. Regular areas are permanently identified by their slugs,
        // not their IDs. Virtual areas are identified as the implementation sees fit.
        area.wid = 'w-' + self.generateId();
        area.controls = controls;
        area.controlTypes = self.controlTypes;
        area.itemTypes = self.itemTypes;
        area.options = options;
        return self.render(res, 'editArea', area);
      });

      // Render an editor for a virtual area with the content
      // specified as a JSON array of items by the req.body.content
      // property, if any (there will be 0 or 1 elements, any further
      // elements are ignored). For use when you are supplying your own storage
      // (for instance, the blog module uses this to render
      // a singleton thumbnail edit button for a post).

      self.app.post('/apos/edit-virtual-singleton', function(req, res) {
        var options = req.body.options ? JSON.parse(req.body.options) : {};
        var content = req.body.content ? JSON.parse(req.body.content) : [];
        self.sanitizeItems(content);
        var area = {
          items: content
        };
        var type = req.body.type;
        // A temporary id for the duration of the editing activity, useful
        // in the DOM. Regular areas are permanently identified by their slugs,
        // not their IDs. Virtual areas are identified as the implementation sees fit.
        area.wid = 'w-' + self.generateId();
        extend(options, _.omit(req.body, 'content', 'type'), true);
        options.type = type;
        options.area = area;
        options.edit = true;
        return res.send(self._aposLocals.aposSingleton(options));
      });

      self.app.post('/apos/edit-area', function(req, res) {
        var options = req.body.options ? JSON.parse(req.body.options) : {};
        var slug = req.body.slug;
        var content = JSON.parse(req.body.content);
        self.sanitizeItems(content);
        var area = {
          slug: slug,
          items: content
        };
        self.putArea(req, slug, area, updated);
        function updated(err) {
          if (err) {
            console.log(err);
            return self.notfound(req, res);
          }

          return self.callLoadersForArea(req, area, function() {
            return res.send(self._aposLocals.aposAreaContent(area.items, options));
          });
        }
      });

      self.app.post('/apos/edit-singleton', function(req, res) {
        var slug = req.body.slug;
        var content = JSON.parse(req.body.content);
        var options = req.body.options ? JSON.parse(req.body.options) : {};
        // "OMG, what if they cheat and use a type not allowed for this singleton?"
        // When they refresh the page they will discover they can't see their hack.
        // aposSingleton only shows the first item of the specified type, regardless
        // of what is kicking around in the area.
        var type = content.type;
        var itemType = self.itemTypes[type];
        if (!itemType) {
          return self.fail(req, res);
        }
        if (itemType.sanitize) {
          itemType.sanitize(content);
        }
        var area = {
          slug: req.body.slug,
          items: [ content ]
        };

        self.putArea(req, slug, area, function(err, area) {
          if (err) {
            return self.notfound(req, res);
          }

          return self.callLoadersForArea(req, area, function() {
            var areaOptions = {};
            areaOptions[type] = options;
            return res.send(self._aposLocals.aposAreaContent(area.items, areaOptions));
          });
        });
      });

      // Used to render newly created, as yet unsaved widgets to be displayed in
      // the main apos editor. We're not really changing anything in the database
      // here. We're just allowing the browser to leverage the same normal view
      // generator that the server uses for actual page rendering. Renders the
      // body of the widget only since the widget div has already been updated
      // or created in the browser. Options may be passed to the widget
      // via the query string or via the _options POST parameter.

      self.app.post('/apos/render-widget', function(req, res) {
        var item = req.body;
        var options = {};
        extend(options, req.query, true);
        extend(options, req.body._options || {}, true);
        delete item._options;

        var itemType = self.itemTypes[item.type];
        if (!itemType) {
          res.statusCode = 404;
          return res.send('No such item type');
        }

        if (itemType.sanitize) {
          itemType.sanitize(item);
        }

        // Invoke server-side loader middleware like getArea or getPage would,
        // unless explicitly asked not to

        function go() {
          return res.send(self._aposLocals.aposItemNormalView(item, options));
        }

        if ((options.load !== '0') && (itemType.load)) {
          return itemType.load(req, item, go);
        } else {
          return go();
        }
      });

      // Returns all tags used on pages, snippets, etc. Accepts prefix and
      // limit options (neither is required). Sanitizes options.
      // Use options.prefix for autocomplete. options argument is not
      // required.

      self.getTags = function(options, callback) {
        if (!callback) {
          callback = options;
          options = {};
        }
        var prefix = self.sanitizeString(options.prefix);
        var r = new RegExp('^' + RegExp.quote(prefix.toLowerCase()));
        return self.pages.distinct("tags", { tags: r }, function(err, tags) {
          if (err) {
            return callback(err);
          }
          // "Why do we have to apply the regular expression twice?"
          // The query above just limits the documents whose distinct tags are
          // returned. If one of the documents that has at least one tag
          // starting with "m" also has other tags not starting with "m," we
          // still have them at this point. The query is still worthwhile
          // because it cuts back the number of documents examined.
          tags = _.filter(tags, function(tag) {
            return tag.toString().match(r);
          });
          tags.sort();
          if (options.limit) {
            var limit = self.sanitizeInteger(options.limit);
            tags = tags.slice(0, limit);
          }
          return callback(null, tags);
        });
      };

      // Remove a tag from all pages. The optional criteria argument can
      // be used to limit the pages from which it is removed
      // (example: { type: 'person' })
      self.removeTag = function(tag, criteria, callback) {
        if (!callback) {
          callback = criteria;
          criteria = {};
        }
        var mergedCriteria = {};
        extend(true, mergedCriteria, criteria);
        mergedCriteria.tags = { $in: [ tag ] };
        return self.pages.update(mergedCriteria, { $pull: { tags: tag } }, { multi: true }, callback);
      };

      // Fetch all tags. Accepts options supported by apos.getTags
      // as query parameters. Useful for creating tag admin tools.
      self.app.get('/apos/tags', function(req, res) {
        return self.getTags(req.query, function(err, tags) {
          if (err) {
            return self.fail(req, res);
          }
          return res.send(tags);
        });
      });

      // Provides tag autocomplete in the format expected by jquery selective.
      self.app.get('/apos/autocomplete-tag', function(req, res) {
        // Special case: selective is asking for complete objects with
        // label and value properties for existing values. For tags these
        // are one and the same so just do a map call
        if (req.query.values) {
          return res.send(_.map(req.query.values, function(value) {
            return { value: value, label: value };
          }));
        }

        return self.getTags({ prefix: req.query.term, limit: 100 }, function(err, tags) {
          if (err) {
            return self.fail(req, res);
          }
          tags = _.map(tags, function(tag) {
            return { value: tag, label: tag };
          });
          return res.send(tags);
        });
      });

      // A simple oembed proxy to avoid cross-site scripting restrictions.
      // Includes bare-bones caching to avoid hitting rate limits.
      // TODO: expiration for caching.
      // TODO: whitelist to avoid accepting oembed from evil XSS sites.

      var oembedCache = {};

      // Available separately from the REST API

      self.oembed = function(url, callback) {
        if (oembedCache[url]) {
          return callback(null, oembedCache[url]);
        }
        return oembed.fetch(url, {}, function (err, result) {
          if (err) {
            return callback(err);
          } else {
            // Hack: fix YouTube iframes to used wmode=opaque so they don't bleed through
            // dialogs and editors in Windows Chrome. TODO: an elegant way of registering
            // oembed fixer-uppers for various dodgy oembed services
            if (url.match(/youtube/)) {
              result.html = result.html.replace('feature=oembed', 'feature=oembed&wmode=opaque');
            }
            oembedCache[url] = result;
            return callback(null, result);
          }
        });
      };

      // Simple REST API to self.oembed

      self.app.get('/apos/oembed', function(req, res) {
        return self.oembed(self.sanitizeString(req.query.url), function(err, result) {
          if (err) {
            console.log(err);
            res.statusCode = 404;
            return res.send('not found');
          }
          return res.send(result);
        });
      });

      // Store a video object for potential reuse. This is a component
      // of the forthcoming video library feature
      self.app.post('/apos/remember-video', function(req, res) {
        var url = self.sanitizeString(req.body.video);
        return self.oembed(url, function(err, result) {
          if (err) {
            console.log(err);
            res.statusCode = 404;
            return res.send('not found');
          }
          var width = result.width;
          var height = result.height;
          var video = {
            title: req.body.title,
            width: width,
            height: height,
            video: url,
            thumbnail: result.thumbnail_url,
            landscape: width > height,
            portrait: height > width,
            searchText: self.sortify(req.body.title)
          };
          return self.videos.findOne({ video: req.body.video }, function(err, doc) {
            if (err) {
              res.statusCode = 500;
              return res.send('error');
            }
            if (doc) {
              return res.send(doc);
            }
            return self.videos.insert(video, function(err, doc) {
              if (err) {
                res.statusCode = 500;
                return res.send('error');
              }
              return res.send(doc);
            });
          });
        });
      });

      self.app.get('/apos/pager', function(req, res) {
        return res.send(partial('pager', req.query));
      });

      self._minifiedCss = {};

      // Serve minified CSS. (If we're not minifying, aposStylesheets won't
      // point here at all.) REFACTOR: too much code duplication with
      // the /apos/scripts.js route.
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

      console.log(__dirname + '/../public');
      self.app.get('/apos/*', self.static(__dirname + '/../public'));

      // self.app.use('/apos', express.static(__dirname + '/../public'));

      // Middleware
      function validId(req, res, next) {
        var id = req.params.id;
        if (!id.match(/^[\w\-\d]+$/)) {
          return self.fail(req, res);
        }
        next();
      }

      if (self.uploadfs) {
        self.pushGlobalData({
          uploadsUrl: self.uploadfs.getUrl()
        });
      }

      return callback(null);
    }

    self.options = options;

    self.app = options.app;

    self.db = options.db;

    async.series([setupPages, setupVersions, setupFiles, setupVideos, setupRedirects, afterDb], callback);
  };

  // self.static returns a function for use as a route that
  // serves static files from a folder. This is helpful when writing
  // your own modules that extend apos and need to serve their own static
  // assets:
  //
  // self.app.get('/apos-twitter/*', apos.static(__dirname + '/../public'))
  //
  // Because self.static is suitable for use as a route rather
  // than as global middleware, it is easier to set it up for many
  // separate modules.

  var lessMiddlewares = {};

  self.static = function(dir) {
    dir = path.normalize(dir);
    console.log(dir);
    return function(req, res) {
      var path = req.params[0];
      // Don't let them peek at /etc/passwd etc. Browsers
      // pre-resolve these anyway
      path = globalReplace(path, '..', '');
      // Otherwise the middleware looks in the wrong place
      req.url = path;
      if (!lessMiddlewares[dir]) {
        lessMiddlewares[dir] = lessMiddleware({
            src: dir,
            compress: true
        });
      }
      var middleware = lessMiddlewares[dir];
      middleware(req, res, function() {
        return res.sendfile(dir + '/' + path);
      });
    };
  };

  // Similar to fs.exists, except that if a .css file does not exist
  // and a corresponding .less file does exist, that is considered
  // sufficient

  self.fileOrOriginalExists = function(file, callback) {
    function attempt(file, callback) {
      return fs.exists(file, function(exists) {
        if (exists) {
          return callback(true);
        } else if (path.extname(file) === '.css') {
          file = file.substr(0, file.length - '.css'.length) + '.less';
          return attempt(file, callback);
        } else {
          return callback(false);
        }
      });
    }
    return attempt(file, callback);
  };

  // getArea retrieves an area from MongoDB. All areas must be part
  // of a page, thus the slug must look like: my-page-slug:areaname
  //
  // Invokes the callback with an error if any, and if no error,
  // the area object requested if it exists. If the area does not
  // exist, both parameters to the callback are null.
  //
  // A 'req' object is needed to provide a context for permissions.
  // If the user does not have permission to view the page on which
  // the area resides an error is reported. If the `editable` option
  // is true then an error is reported unless the user has permission
  // to edit the page on which the area resides.
  //
  // If it exists, the area object is guaranteed to have `slug` and
  // `content` properties. The `content` property contains rich content
  // markup ready to display in the browser.
  //
  // If 'slug' matches the following pattern:
  //
  // /cats/about:sidebar
  //
  // Then 'sidebar' is assumed to be the name of an area stored
  // within the areas property of the page object with the slug /cats/about. That
  // object is fetched from the pages collection and the relevant area
  // from its areas property, if present, is delivered.
  //
  // This is an efficient way to store related areas
  // that are usually desired at the same time, because the getPage method
  // returns the entire page object, including all of its areas.
  //
  // You may skip the "options" parameter.
  //
  // By default, if an area contains items that have load functions, those
  // load functions are invoked and the callback is not called until they
  // complete. This means that items that require storage outside of
  // the area collection, or data from APIs, can load that data at the time
  // they are fetched. Set the 'load' option to false if you do not want this.

  self.getArea = function(req, slug, options, callback) {
    if (typeof(options) === 'function') {
      callback = options;
      options = {};
    }
    if (options.load === undefined) {
      options.load = true;
    }
    var matches = slug.match(/^(.*?)\:(\w+)$/);
    if (!matches) {
      return callback('All area slugs must now be page-based: page-slug:areaname');
    }
    // This area is part of a page
    var pageSlug = matches[1];
    var areaSlug = matches[2];
    // Retrieve only the desired area
    var projection = {};
    projection['areas.' + areaSlug] = 1;
    self.get(req, { slug: pageSlug }, { editable: options.editable, fields: projection }, function (err, results) {
      if (err) {
        return callback(err);
      }
      var page = results.pages[0];
      if (page && page.areas && page.areas[areaSlug]) {
        // What is stored in the db might be lagging behind the reality
        // if the slug of the page has changed. Always return it in an
        // up to date form
        page.areas[areaSlug].slug = pageSlug + ':' + areaSlug;
        return loadersThenCallback(page.areas[areaSlug]);
      }
      // Nonexistence isn't an error, it's just nonexistence
      return callback(err, null);
    });

    function loadersThenCallback(area) {
      if (!area) {
        // Careful, this is not an error, don't crash
        return callback(null, null);
      }
      function after() {
        return callback(null, area);
      }
      if (options.load) {
        return self.callLoadersForArea(req, area, after);
      } else {
        return after();
      }
    }
  };

  // putArea stores an area in a page.
  //
  // Invokes the callback with an error if any, and if no error,
  // the area object with its slug property set to the slug under
  // which it was stored with putArea.
  //
  // The slug must match the following pattern:
  //
  // /cats/about:sidebar
  //
  // 'sidebar' is assumed to be the name of an area stored
  // within the areas property of the page object with the slug /cats/about.
  // If the page object was previously empty it now looks like:
  //
  // {
  //   slug: '/cats/about',
  //   areas: {
  //     sidebar: {
  //       slug: '/cats/about/:sidebar',
  //       items: 'whatever your area.items property was'
  //     }
  //   }
  // }
  //
  // Page objects are stored in the 'pages' collection.
  //
  // If a page does not exist, the user has permission to create pages,
  // and the slug does not start with /, this method will create it,
  // as a page with no `type` property. If the page has a type property or
  // resides in the page tree you should create it with putPage rather
  // than using this method.
  //
  // This create-on-demand behavior is intended for
  // simple virtual pages used to hold things like a
  // global footer area.
  //
  // A copy of the page is inserted into the versions collection.
  //
  // The req argument is required for permissions checking.

  self.putArea = function(req, slug, area, callback) {
    var pageOrSlug;

    var matches = slug.match(/^(.*?)\:(\w+)$/);
    if (!matches) {
      return callback('Area slugs now must be page-based: page-slug:areaname');
    }
    var pageSlug = matches[1];
    var areaSlug = matches[2];

    // To check the permissions properly we're best off just getting the page
    // as the user, however we can specify that we don't need the properties
    // returned to speed that up
    function permissions(callback) {
      return self.get(req, { slug: pageSlug }, { editable: true, fields: { _id: 1 } }, function(err, results) {
        if (err) {
          return callback(err);
        }
        if (!results.pages.length) {
          // If it REALLY doesn't exist, but we have the edit-page permission,
          // and the slug has no leading /, we are allowed to create it.

          // If it is a tree page it must be created via putPage
          if (pageSlug.substr(0, 1) === '/') {
            return callback('notfound');
          }

          // Otherwise it is OK to create it provided it truly does
          // not exist yet. Check MongoDB to distinguish between not
          // finding it due to permissions and not finding it
          // due to nonexistence
          return self.pages.findOne({ slug: pageSlug }, { _id: 1 }, function(err, page) {
            if (err) {
              return callback(err);
            }
            if (!page) {
              // OK, it's really new
              return callback(null);
            }
            // OK if we have permission to create pages
            return self.permissions(req, 'edit-page', null, callback);
          });
        }
        return callback(null);
      });
    }

    function update(callback) {
      area.slug = slug;
      var set = {};
      set.slug = pageSlug;
      // Use MongoDB's dot notation to update just the area in question
      set['areas.' + areaSlug] = area;
      self.pages.update(
        { slug: pageSlug },
        { $set: set },
        { safe: true },
        function(err, count) {
          if ((!err) && (count === 0)) {
            // The page doesn't exist yet. We'll need to create it. Use
            // an insert without retry, so we fail politely if someone else creates
            // it first or it already existed and mongo just didn't find it somehow.
            // This tactic only makes sense for typeless virtual pages, like the
            // 'global' page often used to hold footers. Other virtual pages should
            // be created before they are used so they have the right type.
            var page = {
              id: self.generateId(),
              slug: pageSlug,
              areas: {}
            };
            page.areas[areaSlug] = area;
            return self.pages.insert(page, { safe: true }, function(err, page) {
              if (err) {
                return callback(err);
              }
              pageOrSlug = page;
              return callback(null);
            });
          }
          if (err) {
            return callback(err);
          }
          pageOrSlug = pageSlug;
          return callback(null);
        }
      );
    }

    // We've updated or inserted a page, now save a copy in the versions collection.
    // We might already have a page object or, if we did an update, we might have
    // to go fetch it
    function versioning(callback) {
      return self.versionPage(req, pageOrSlug, callback);
    }

    function indexing(callback) {
      return self.indexPage(req, pageOrSlug, callback);
    }

    function finish(err) {
      return callback(err, area);
    }

    async.series([permissions, update, versioning, indexing], finish);
  };

  // Insert or update an entire page object at once.
  //
  // slug is the existing slug of the page in the database. If page.slug is
  // different then the slug of the page is changed. If page.slug is not defined
  // it is set to the slug parameter for your convenience. The slug of the page,
  // and the path of the page if it is defined, are both automatically made
  // unique through successive addition of random digits if necessary.
  //
  // You MAY add unrelated properties to page objects between calls to
  // getPage and putPage, or directly manipulate page objects with mongodb.
  //
  // You MUST pass the req object for permissions checking.
  //
  // If the page does not already exist this method will create it.
  //
  // A copy of the page is inserted into the versions collection.
  //
  // Please let this function generate ._id for you on a new page. This is
  // necessary to allow putPage to distinguish new pages from old when
  // automatically fixing unique slug errors.

  self.putPage = function(req, slug, page, callback) {
    var newPage = false;
    if (!page.slug) {
      page.slug = slug;
    }
    if (!page._id) {
      page._id = self.generateId();
      newPage = true;
    }

    // Basic support for mongodb search and sort on the title is always
    // present, regardless of how indexPage may be overridden for more
    // complete searches
    page.sortTitle = self.sortify(page.title);

    // Provide the object rather than the slug since we have it and we can
    // avoid extra queries that way and also do meaningful permissions checks
    // on new pages
    function permissions(callback) {
      self.permissions(req, 'edit-page', page, callback);
    }

    function save(callback) {
      function afterUpdate(err) {
        if (err && self.isUniqueError(err))
        {
          var num = (Math.floor(Math.random() * 10)).toString();
          if (page.slug === undefined) {
            return callback('page.slug is not set');
          }
          page.slug += num;
          // Path index is sparse, not everything is part of a page tree,
          // don't create materialized paths where none are desired
          // (for instance, blog posts)
          if (page.path) {
            page.path += num;
          }
          // Retry on an existing page must use the OLD slug or it will
          // create unwanted clones. For a new page it must NOT use the old slug
          // or it will keep failing
          return save(callback);
        }
        return callback(err);
      }

      var copy = {};
      extend(true, copy, page);
      self.pruneTemporaryProperties(copy);

      if (newPage) {
        self.pages.insert(copy, { safe: true }, afterUpdate);
      } else {
        self.pages.update({ slug: slug }, copy, { safe: true }, afterUpdate);
      }
    }

    function versioning(callback) {
      return self.versionPage(req, page, callback);
    }

    function indexing(callback) {
      return self.indexPage(req, page, callback);
    }

    function finish(err) {
      if (err) {
        return callback(err);
      }
      return callback(null, page);
    }
    async.series([permissions, save, versioning, indexing], finish);
  };

  // Except for ._id, no property beginning with a _ should be
  // loaded from the database. These are reserved for dynamically
  // determined properties like permissions and joins
  self.pruneTemporaryProperties = function(page) {
    var remove = [];
    _.each(page, function(val, key) {
      if ((key.substr(0, 1) === '_') && (key !== '_id')) {
        remove.push(key);
      } else {
        if ((typeof(val) === 'object') && (!Array.isArray(val))) {
          self.pruneTemporaryProperties(val);
        }
      }
    });
    _.each(remove, function(key) {
      delete page[key];
    });
  };

  // Given a request object (for permissions), a page object, and a version
  // object (an old version of the page from the versions collection), roll
  // back the page to the content in the version object. This method does not
  // roll back changes to the slug property, or to the rank or path property of
  // any page with a slug beginning with /, because these are part
  // of the page's relationship to other pages which may not be rolling back and
  // could lead to an unusable page tree and/or conflicting slugs and paths

  self.rollBackPage = function(req, page, version, callback) {
    var slug = page.slug;
    var path = page.path;
    var rank = page.rank;
    delete version.diff;
    delete version.author;
    delete version.createdAt;
    extend(true, page, version);
    page.slug = slug;
    if (slug.chart(0) === '/') {
      page.path = path;
      page.rank = rank;
    }
    return self.putPage(req, page.slug, page, callback);
  };

  // Save a copy of the specified page so that it can be rolled back to
  // at any time. The req object is needed to identify the author of the change.
  // Typically called only from self.putPage and self.putArea

  self.versionPage = function(req, pageOrSlug, callback) {
    var page;
    var prior;

    function findPage(callback) {
      return findByPageOrSlug(pageOrSlug, function(err, pageArg) {
        page = pageArg;
        return callback(err);
      });
    }

    function findPrior(callback) {
      self.versions.find({
        pageId: page._id
      }).sort({
        createdAt: -1
      }).limit(1).toArray(function(err, versions) {
        if (err) {
          return callback(err);
        }
        if (versions.length) {
          prior = versions[0];
        } else {
          // There may indeed be no prior version
          prior = null;
        }
        return callback(null);
      });
    }

    function addVersion(callback) {
      // Turn the page object we fetched into a version object.
      // But don't modify the page object!
      var version = {};
      extend(true, version, page);
      version.createdAt = new Date();
      version.pageId = version._id;
      version.author = (req && req.user && req.user.username) ? req.user.username : 'unknown';
      version._id = self.generateId();
      delete version.searchText;
      if (!prior) {
        version.diff = [ { value: '[NEW]', added: true } ];
      } else {
        version.diff = self.diffPages(prior, version);
      }
      return self.versions.insert(version, callback);
    }

    return async.series([findPage, findPrior, addVersion], callback);
  };

  self.diffPages = function(page1, page2) {
    var lines1 = self.diffPageLines(page1);
    var lines2 = self.diffPageLines(page2);
    var results = jsDiff.diffLines(lines1.join("\n"), lines2.join("\n"));
    // We're not interested in what stayed the same
    return _.filter(results, function(result) { return result.added || result.removed; });
  };

  // Returns a list of lines of text which, when diffed against the
  // results for another version of the page, will result in a reasonable
  // summary of what has changed
  self.diffPageLines = function(page) {
    var lines = [];
    lines.push('title: ' + page.title);
    lines.push('type: ' + page.type);
    if (page.tags) {
      lines.push('tags: ' + page.tags.join(','));
    }

    self.emit('diff', page, lines);

    if (page.areas) {
      var names = _.keys(page.areas);
      names.sort();
      _.each(names, function(name) {
        var area = page.areas[name];
        _.each(area.items, function(item) {
          lines.push(name + ': ' + item.type);
          var itemType = self.itemTypes[item.type];
          if (itemType) {
            if (itemType.addDiffLines) {
              itemType.addDiffLines(item, lines);
            }
          }
        });
      });
    }
    return lines;
  };

  // Given some plaintext, add diff-friendly lines to the lines array
  // based on its contents

  self.addDiffLinesForText = function(text, lines) {
    var wrapper = wordwrap(0, 60);
    var rawLines = text.split("\n");
    _.each(rawLines, function(line) {
      line = wrapper(line);
      _.each(line.split("\n"), function(finalLine) {
        if (!finalLine.length) {
          return;
        }
        lines.push(finalLine);
      });
    });
  };

  // Index the page for search purposes. The current implementation is a hack,
  // but a surprisingly tolerable one. We build two texts, one representing
  // only highly-weighted fields and the other including all text in the
  // document, and use a simple regex search on them when the request comes.
  // It's not suitable for huge amounts of content but it's not half bad either.
  // You can, of course, swap this out for a better implementation for
  // higher volume needs. We'll revisit when Mongo's text search is mature.

  self.indexPage = function(req, pageOrSlug, callback) {
    var page;
    var prior;

    function findPage(callback) {
      var finder;
      if (typeof(pageOrSlug) === 'string') {
        finder = function(pageOrSlug, callback) {
          return self.pages.findOne({ slug: pageOrSlug }, callback);
        };
      } else {
        finder = function(pageOrSlug, callback) {
          return callback(null, pageOrSlug);
        };
      }
      finder(pageOrSlug, function(err, pageArg) {
        if (err) {
          return callback(err);
        }
        page = pageArg;
        return callback(null);
      });
    }

    function index(callback) {
      // Index the page
      var texts = self.getSearchTextsForPage(page);
      // These texts have a weight property so they are ideal for feeding
      // to something better, but for now we'll prep for a dumb, simple regex search
      // via mongo that is not aware of the weight of fields. This is pretty
      // slow on big corpuses but it does have the advantage of being compatible
      // with the presence of other criteria. Our workaround for the lack of
      // really good weighting is to make separate texts available for searches
      // based on high-weight fields and searches based on everything

      // Individual widget types play with weights a little, but the really
      // big numbers are reserved for metadata fields. Look for those
      var highTexts = _.filter(texts, function(text) {
        return text.weight > 10;
      });

      function boilTexts(texts) {
        var text = _.reduce(texts, function(memo, text) {
          return memo + ' ' + text.text;
        }, '');
        text = self.sortify(text);
        return text;
      }

      var searchSummary = _.map(_.filter(texts, function(text) { return !text.silent; } ), function(text) { return text.text }).join(" ");
      var highText = boilTexts(highTexts);
      var lowText = boilTexts(texts);
      return self.pages.update({ slug: page.slug }, { $set: { highSearchText: highText, lowSearchText: lowText, searchSummary: searchSummary } }, callback);
    }

    return async.series([findPage, index], callback);
  };

  // Returns texts which are a reasonable basis for
  // generating search results for this page. Should return
  // an array in which each entry is an object with
  // 'weight' and 'text' properties. 'weight' is a measure
  // of relative importance. 'text' is the text associated
  // with that chunk of content.

  self.getSearchTextsForPage = function(page) {
    var texts = [];
    // Shown separately, so don't include it in the summary
    texts.push({ weight: 100, text: page.title, silent: true });
    // Not great to include in the summary
    texts.push({ weight: 100, text: (page.tags || []).join("\n"), silent: true });

    // This event is an opportunity to add custom texts for
    // various types of pages
    self.emit('index', page, texts);

    if (page.areas) {
      var names = _.keys(page.areas);
      names.sort();
      _.each(names, function(name) {
        var area = page.areas[name];
        _.each(area.items, function(item) {
          var itemType = self.itemTypes[item.type];
          if (itemType) {
            if (itemType.addSearchTexts) {
              itemType.addSearchTexts(item, texts);
            }
          }
        });
      });
    }
    return texts;
  };

  // Given some plaintext, add diff-friendly lines to the lines array
  // based on its contents

  self.addDiffLinesForText = function(text, lines) {
    var wrapper = wordwrap(0, 60);
    var rawLines = text.split("\n");
    _.each(rawLines, function(line) {
      line = wrapper(line);
      _.each(line.split("\n"), function(finalLine) {
        if (!finalLine.length) {
          return;
        }
        lines.push(finalLine);
      });
    });
  };

  // apos.get delivers pages that the current user is permitted to
  // view, with areas fully populated and ready to render if
  // they are present.
  //
  // Pages are also marked with a ._edit property if they are editable
  // by this user.
  //
  // The results are delivered as the second argument of the callback
  // if there is no error. The results object will have a `pages` property
  // containing 0 or more pages. The results object will also have a
  // `criteria` property containing the final MongoDB criteria used to
  // actually fetch the pages. This criteria can be reused for direct
  // MongoDB queries, for instance `distinct` queries to identify
  // unique tags relevant to the pages returned.
  //
  // WHO SHOULD USE THIS METHOD
  //
  // Developers who need something different from a simple fetch of one
  // page (use `apos.getPage`), fetch of ancestors, descendants, etc. of
  // tree pages (use `pages.getAncestors`, `pages.getDescendants`, etc.),
  // or fetch of snippets of some type such as blog posts or events
  // (use `snippets.get`, `blog.get`, etc). All of these methods are
  // built on this method.
  //
  // WARNING
  //
  // This function doesn't care if a page is a "tree page" (slug starting
  // with a `/`) or not. If you are only interested in tree pages and you
  // are not filtering by page type, consider setting
  // `userCriteria.slug` to a regular expression matching a leading /.
  //
  // CRITERIA
  //
  // A `userCriteria` object can be, and almost always is, passed
  // as the second argument.
  //
  // The `userCriteria` object is included in the MongoDB query made by
  // this method to fetch pages. This object can contain any
  // MongoDB userCriteria you wish. For instance, { type: 'default' }
  // would fetch only pages of that type. Other userCriteria, such as
  // permissions, are automatically applied as well via MongoDB's
  // `$and` keyword so that you are not restricted in what you can
  // do in your own userCriteria object.
  //
  // OPTIONS
  //
  // An options object can be passed as the third argument.
  //
  // If `options.editable` is true, only pages the current user can
  // edit are returned. Otherwise pages the user can see are returned.
  //
  // If `options.sort` is present, it is passed as the argument to the
  // MongoDB sort() function. The default sort is by title, on the
  // `sortTitle` property which is always lowercase for case insensitive
  // results.
  //
  // `options.limit` indicates the maximum number of results to return.
  // `options.skip` indicates the number of results to skip. These can
  // be used to implement pagination.
  //
  // If `options.fields` is present it is used to limit the fields
  // returned by MongoDB for performance reasons (the second argument
  // to MongoDB's find()). Set `options.fields` to { areas: 0 } to
  // retrieve everything *except* areas. This is usually the best way
  // to limit results.
  //
  // `options.titleSearch` can be used to search the titles of all
  // pages for a particular string using a fairly tolerant algorithm.
  // options.q does the same on the full text.
  //
  // `options.published` indicates whether to return only published pages
  // ('1' or true), return only unpublished pages (`0` or false), or
  // return both ('any' or null). It defaults to 'any', allowing suitable
  // users to preview unpublished pages.
  //
  // `options.trash` indicates whether to return only pages in the
  // trashcan the trashcan ('1' or true), return only pages not in the
  // trashcan ('0' or false), or return both ('any' or null). It defaults
  // to '0'.
  //
  // `options.orphan` indicates whether to return only pages that are
  // accessible yet hidden from normal navigation links ('1' or true),
  // return only such orphans ('0' or false), or return both
  // ('any' or null). It defaults to 'any' to ensure such pages
  // are reachable.
  //
  // `options.tags` is a convenient way to find content that has
  // at least one of the given array of tags. `options.notTags`
  // does the reverse: it excludes content that has at least one
  // of the given array of tags.
  //
  // In any case the user's identity limits what they can see.
  // Permissions are checked according to the Apostrophe permissions
  // model. The `admin` permission permits unlimited retrieval.
  // Otherwise the `published`, loginRequired`, `viewGroupIds`,
  // `viewPersonIds`, `editGroupIds` and `editPersonIds` properties
  // of the page are considered.
  //
  // You may disable permissions entirely by setting `options.permissions`
  // to `false`. This can make sense when you are using pages as storage
  // in a context where Apostrophe's permissions model is not relevant.
  //
  // Normally all areas associated with a page are included in the
  // areas property. If `options.areas` is explicitly false, no areas
  // will be returned. If `options.areas` contains an array of area names,
  // only those areas will be returned (if present).
  //
  // If options.getDistinctTags is true, an array of distinct tags
  // matching the current criteria is delivered in lieu of the usual
  // results object. This is useful when implementing filters. A
  // deeper refactoring of the fetchMetadata feature from the snippets
  // module is probably in order to support more types of filters.
  //
  // `options.lateCriteria`
  //
  // Unfortunately at least one MongoDB operator, `$near`, cannot be
  // combined with other operators using `$and` as this method normally
  // does to combine permissions checks with other criteria. You may
  // place such operators in `options.lateCriteria`, a MongoDB criteria
  // object which is merged into the query at the last possible moment.
  // This object must not contain an `$and` clause at the top level.
  // See https://jira.mongodb.org/browse/SERVER-4572 for more information.
  // The `criteria` and `options` arguments may be skipped.
  // (Getting everything is a bit unusual, but it's not forbidden!)
  //

  self.get = function(req, userCriteria, options, mainCallback) {
    if (arguments.length === 2) {
      mainCallback = userCriteria;
      userCriteria = {};
      options = {};
    } else if (arguments.length === 3) {
      mainCallback = options;
      options = {};
    }

    // Second criteria object based on our processing of `options`
    var filterCriteria = {};

    var editable = options.editable;

    var sort = options.sort;
    // Allow sort to be explicitly false. Otherwise there is no way
    // to get the sorting behavior of the "near" option
    if (sort === undefined) {
      sort = { sortTitle: 1 };
    }

    var limit = options.limit || undefined;

    var skip = options.skip || undefined;

    var fields = options.fields || undefined;

    var titleSearch = options.titleSearch || undefined;

    var areas = options.areas || true;

    var tags = options.tags || undefined;
    var notTags = options.notTags || undefined;

    var permissions = (options.permissions === false) ? false : true;

    var lateCriteria = options.lateCriteria || undefined;

    if (options.titleSearch !== undefined) {
      filterCriteria.sortTitle = self.searchify(titleSearch);
    }

    self.convertBooleanFilterCriteria('trash', options, filterCriteria, '0');
    self.convertBooleanFilterCriteria('orphan', options, filterCriteria, 'any');
    self.convertBooleanFilterCriteria('published', options, filterCriteria);

    if (tags || notTags) {
      filterCriteria.tags = { };
      if (tags) {
        filterCriteria.tags.$in = tags;
      }
      if (notTags) {
        filterCriteria.tags.$nin = notTags;
      }
    }

    if (options.q && options.q.length) {
      // Crude fulltext search support. It would be better to present
      // highSearchText results before lowSearchText results, but right now
      // we are doing a single query only
      filterCriteria.lowSearchText = self.searchify(options.q);
    }


    var projection = {};
    extend(true, projection, fields || {});
    if (!areas) {
      projection.areas = 0;
    } else if (areas === true) {
      // Great, get them all
    } else {
      // We need to initially get them all, then prune them, as
      // MongoDB is not great at fetching specific properties
      // of subdocuments while still fetching everything else
    }

    var results = {};

    var combine = [ userCriteria, filterCriteria ];

    if (permissions) {
      combine.push(self.getPermissionsCriteria(req, { editable: editable }));
    }
    var criteria = {
      $and: combine
    };

    // The lateCriteria option is merged with the criteria option last
    // so that it is not subject to any $and clauses, due to this
    // limitation of MongoDB which prevents the highly useful $near
    // clause from being used otherwise:
    //
    // https://jira.mongodb.org/browse/SERVER-4572

    if (lateCriteria) {
      extend(true, criteria, lateCriteria);
    }

    if (options.getDistinctTags) {
      // Just return the distinct tags matching the current criteria,
      // rather than the normal results. This is a bit of a hack, we need
      // to consider refactoring all of 'fetchMetadata' here
      return self.pages.distinct("tags", criteria, mainCallback);
    }

    async.series([count, loadPages, markPermissions, loadWidgets], done);

    function count(callback) {
      self.pages.find(criteria).count(function(err, count) {
        results.total = count;
        return callback(err);
      });
    }

    function loadPages(callback) {
      var q = self.pages.find(criteria, projection);

      // At last we can use skip and limit properly thanks to permissions stored
      // in the document
      if (skip !== undefined) {
        q.skip(skip);
      }
      if (limit !== undefined) {
        q.limit(limit);
      }
      if (sort) {
        q.sort(sort);
      }
      q.toArray(function(err, pagesArg) {
        if (err) {
          console.log(err);
          return callback(err);
        }
        results.pages = pagesArg;

        // Except for ._id, no property beginning with a _ should be
        // loaded from the database. These are reserved for dynamically
        // determined properties like permissions and joins
        _.each(results.pages, function(page) {
          self.pruneTemporaryProperties(page);
        });

        if (Array.isArray(areas)) {
          // Prune to specific areas only, alas this can't
          // happen in mongoland as near as I can tell. -Tom
          _.each(results.pages, function(page) {
            if (page.areas) {
              page.areas = _.pick(page.areas, areas);
            }
          });
        }
        return callback(err);
      });
    }

    function markPermissions(callback) {
      self.addPermissionsToPages(req, results.pages);
      return callback(null);
    }

    function loadWidgets(callback) {
      // Use eachSeries to avoid devoting overwhelming mongodb resources
      // to a single user's request. There could be many snippets on this
      // page, and callLoadersForPage is parallel already
      async.forEachSeries(results.pages, function(page, callback) {
        self.callLoadersForPage(req, page, callback);
      }, function(err) {
        return callback(err);
      });
    }

    function done(err) {
      return mainCallback(err, results);
    }
  };

  // Returns a MongoDB query object that will match pages the
  // user is permitted to view, based on their identity and the
  // permissions listed in the page. This object will be combined
  // with other criteria using $and. See also self.pagePermissions below
  // which must be compatible

  self.getPermissionsCriteria = function(req, options) {
    if (!options) {
      options = {};
    }
    var editable = options.editable;
    // If they have the admin permission we're done
    if (req.user && req.user.permissions.admin) {
      return { };
    }

    var userPermissions = (req.user && req.user.permissions) || {};

    var clauses = [];

    var groupIds = (req.user && req.user.groupIds) ? req.user.groupIds : [];

    // If we are not specifically searching for pages we can edit,
    // allow for the various ways we can be allowed to view a page

    if (!editable) {
      // Case #1: it is published and no login is required
      clauses.push({
        published: true,
        loginRequired: { $exists: false }
      });

      if (req.user) {
        // Case #2: for logged-in users with the guest permission,
        // it's OK to show pages with loginRequired set to `loginRequired` but not `certainPeople`
        // (this is called "Login Required" on the front end)
        if (userPermissions.guest) {
          clauses.push({
            published: true,
            loginRequired: 'loginRequired'
          });
        }

        // Case #3: page is restricted to certain people, see if
        // we are on the list of people or the list of groups

        clauses.push({
          published: true,
          loginRequired: 'certainPeople',
          $or: [
            { viewGroupIds: { $in: groupIds } },
            { viewPersonIds: { $in: [ req.user._id ] } }
          ]
        });
      }
    }

    if (req.user) {
      // Case #4: we have edit privileges on the page. Note that
      // it need not be published
      clauses.push({
        $or: [
          { editGroupIds: { $in: groupIds } },
          { editPersonIds: { $in: [ req.user._id ] } }
        ]
      });
    }

    return { $or: clauses };
  };

  // This method determines whether we can carry out an action on a
  // particular page. It must be in sync with what self.getPermissionsCriteria
  // would return. This method should invoke its callback with null if the user may
  // carry out the action or with an error string if they may not.

  self.pagePermissions = function(req, action, page, callback) {
    // In practice we only check two levels of permissions on pages right now:
    // permission to view and permission to edit. Reduce the requested action
    // to one of those

    var editable;
    if (action === 'view-page') {
      editable = false;
    } else {
      // Currently everything except viewing requires the edit permission
      editable = true;
    }

    var userPermissions = (req.user && req.user.permissions) || {};

    // If we are not specifically searching for pages we can edit,
    // allow for the various ways we can be allowed to view a page

    if (!editable) {
      // Case #1: it is published and no login is required

      if (page.published && (page.loginRequired === undefined)) {
        return callback(null);
      }

      if (req.user) {

        // Case #2: for users who have the viewLoginRequired permission,
        // it's OK to show pages with loginRequired set but not certainPeople
        // (this is called "loginRequired" on the front end)

        if (page.published && (page.loginRequired === 'loginRequired') && (_.contains(userPermissions, 'guest'))) {
          return callback(null);
        }

        // Case #3: page is restricted to certain people, see if
        // we are on the list of people or the list of groups

        if (page.published && (page.loginRequired === 'certainPeople')) {
          if (page.viewGroupIds && _.intersection(req.user.groupIds || [], page.viewGroupIds).length) {
            return callback(null);
          }
          if (page.viewPersonIds && _.contains(page.viewPersonIds, req.user._id)) {
            return callback(null);
          }
        }
      }
    }

    // Can we edit the page? (That's also good enough to view it.)

    if (req.user) {
      // Case #4: we have edit privileges on the page. Note that
      // it need not be published
      if (page.editGroupIds && _.intersection(req.user.groupIds || [], page.editGroupIds).length) {
        return callback(null);
      }
      if (page.editPersonIds && _.contains(page.editPersonIds, req.user._id)) {
        return callback(null);
      }
    }

    // No love
    return callback('Forbidden');
  };

  self.filePermissions = function(req, action, file, callback) {
    if (action === 'view-file') {
      return callback(null);
    }
    // Assume everything else is an editing operation
    // Note that self.permissions already let it through if
    // the user is an admin
    if (req.user && (file.ownerId === req.user._id)) {
      return callback(null);
    }
    return callback('Forbidden');
  };

  // Add a ._edit flag to each page that is editable by the
  // current user. Must be compatible with the way
  // apos.getPermissionsCriteria determines permissions.

  self.addPermissionsToPages = function(req, pages) {
    if (!req.user) {
      return;
    }
    _.each(pages, function(page) {
      if (req.user.permissions.admin) {
        page._edit = true;
      } else {
        if (page.editGroupIds && _.intersection(req.user.groupIds || [], page.editGroupIds).length) {
          page._edit = true;
        }
        if (page.editPersonIds && _.contains(page.editPersonIds, req.user._id)) {
          page._edit = true;
        }
      }
    });
  };

  // Fetch the "page" with the specified slug. As far as
  // apos is concerned, the "page" with the slug /about
  // is expected to be an object with a .areas property. If areas
  // with the slugs /about:main and /about:sidebar have
  // been saved, then the areas property will be an
  // object with properties named main and sidebar.
  //
  // A 'req' object is needed to provide a context for permissions.
  // Permissions are checked on the page based on the user's identity.
  // A ._edit property will be set on the page if it is editable by
  // the current user and it will not be returned at all if it is
  // not viewable by the current user.
  //
  // The first callback parameter is an error or null.
  // In the event of an exact slug match, the second parameter
  // to the callback is the matching page object. If there is a
  // partial slug match followed by a / in the URL or an exact
  // slug match, the longest such match is the third parameter.
  // The fourth parameter is the remainder of the URL following
  // the best match, or the empty string in the event of an
  // exact match.
  //
  // If the slug passed does not begin with a leading /,
  // partial matches are never returned.
  //
  // You MAY also store entirely unrelated properties in
  // your "page" objects, via your own mongo code.
  //
  // This allows the composition of objects as
  // different (and similar) as webpages, blog articles,
  // upcoming events, etc. Usually objects other than
  // webpages do not have a leading / on their slugs
  // (and when using the pages module they must not).
  //
  // The `options` parameter may be skipped. If it is not
  // skipped, it is passed on to `apos.get`.

  self.getPage = function(req, slug, optionsArg, callback) {
    if (!callback) {
      callback = optionsArg;
      optionsArg = {};
    }
    if (!optionsArg) {
      optionsArg = {};
    }
    var orClauses = [];
    var components;
    // Partial matches
    if (slug.length && (slug.substr(0, 1) === '/')) {
      var path = '';
      orClauses.unshift({ slug: '/' });
      components = slug.substr(1).split('/');
      for (var i = 0; (i < (components.length - 1)); i++) {
        var component = components[i];
        path += '/' + component;
        orClauses.unshift({ slug: path });
      }
    }
    // And of course always consider an exact match. We use unshift to
    // put the exact match first in the query, but we still need to use
    // sort() and limit() to guarantee that the best result wins
    orClauses.unshift({ slug: slug });

    var options = {
      sort: { slug: -1 },
      limit: 1
    };

    extend(true, options, optionsArg);

    // Ordering in reverse order by slug gives us the longest match first
    self.get(req, { $or: orClauses }, options, function(err, results) {
      if (err) {
        return callback(err);
      }
      if (results.pages.length) {
        var page = results.pages[0];
        var bestPage = page;
        if (page.slug !== slug) {
          // partial match only
          page = null;
        }

        // For convenience guarantee there is a page.areas property
        if (!bestPage.areas) {
          bestPage.areas = {};
        }
        var remainder = slug.substr(bestPage.slug.length);
        // Strip trailing slashes for consistent results
        remainder = remainder.replace(/\/+$/, '');
        // For consistency, guarantee a leading / if the remainder
        // is not empty. This way parsing remainders attached to the
        // home page (the slug of which is '/') is not a special case
        if (remainder.length && (remainder.charAt(0) !== '/')) {
          remainder = '/' + remainder;
        }
        return callback(err, page, bestPage, remainder);
      } else {
        // Nonexistence is not an error
        return callback(null, null);
      }
    });
  };

  // An internal function for locating a page by slug or recognizing that
  // it is already a page object. This function does NOT check permissions
  // or call loaders. It is useful in migrations and versioning.

  function findByPageOrSlug(pageOrSlug, callback) {
    var finder;
    if (typeof(pageOrSlug) === 'string') {
      finder = function(pageOrSlug, callback) {
        return self.pages.findOne({ slug: pageOrSlug }, callback);
      };
    } else {
      finder = function(pageOrSlug, callback) {
        return callback(null, pageOrSlug);
      };
    }
    finder(pageOrSlug, function(err, page) {
      if (err) {
        return callback(err);
      }
      return callback(null, page);
    });
  }


  // Invoke loaders for any items in any area of the page that have loaders,
  // then invoke callback. Loaders are expected to report failure as appropriate
  // to their needs by setting item properties that their templates can
  // use to display that when relevant, so there is no formal error
  // handling for loaders

  // The req object is available so that loaders can consider permissions
  // and perform appropriate caching for the lifetime of the request.

  // What happens if the loader for a page triggers a load of that same page?
  // To avoid infinite recursion we track the current recursion level for each
  // page id. We tolerate it but only up to a point. This allows some semi-reasonable
  // cases without crashing the site.

  var loaderRecursion = {};
  var maxLoaderRecursion = 3;

  self.callLoadersForPage = function(req, page, callback) {
    // Useful for debugging redundant calls
    // if (page.areas) {
    //   console.log(page.type + ':' + page.slug);
    // }

    if (loaderRecursion[page._id]) {
      if (loaderRecursion[page._id] === maxLoaderRecursion) {
        console.log('max loader recursion reached on ' + page.slug);
        return callback(null);
      }
      loaderRecursion[page._id]++;
    } else {
      loaderRecursion[page._id] = 1;
    }

    // Call loaders for all areas in a page. Wow, async.map is awesome.
    async.map(
      _.values(page.areas),
      function(area, callback) {
        return setImmediate(function() { self.callLoadersForArea(req, area, callback); });
      }, function(err, results) {
        loaderRecursion[page._id]--;
        return callback(err);
      }
    );
  };

  // Invoke loaders for any items in this area that have loaders, then
  // invoke callback. Loaders are expected to report failure as appropriate
  // to their needs by setting item properties that their templates can
  // use to display that when relevant, so there is no formal error
  // handling for loaders

  // The req object is available so that loaders can consider permissions
  // and perform appropriate caching for the lifetime of the request.

  self.callLoadersForArea = function(req, area, callback) {
    // Even more async.map goodness
    async.map(area.items, function(item, callback) {
      if (!self.itemTypes[item.type]) {
        console.error('WARNING: unrecognized item type ' + item.type + ' encountered in area, URL was ' + req.url);
        return callback();
      }
      if (self.itemTypes[item.type].load) {
        return self.itemTypes[item.type].load(req, item, callback);
      } else {
        return callback();
      }
    }, function(err, results) {
      return callback(err);
    });
  };

  var nunjucksEnvs = {};

  // Load and render a Nunjucks template by the specified name and give it the
  // specified data. All of the Apostrophe helpers are available as
  // aposArea, etc. from the template. You can also render another partial
  // from within your template by calling {{ partial('name') }}. You can pass a
  // full path for 'name' otherwise it is assumed to be relative to 'dir',
  // or to the Apostrophe's views folder if 'dir' is not specified.
  //
  // The .html extension is assumed.

  self.partial = function(name, data, dirs) {
    if (!data) {
      data = {};
    }

    if (typeof(data.partial) === 'undefined') {
      data.partial = self.partial;
    }

    // Make sure the apos-specific locals are visible to partials too.
    // If we import ALL the locals we'll point at the wrong views directory
    // and generally require the developer to worry about not breaking
    // our partials, which ought to be a black box they can ignore.

    _.defaults(data, self._aposLocals);

    return self.getNunjucksEnv(dirs).getTemplate(name + '.html').render(data);
  };

  self.getNunjucksEnv = function(dirs) {
    if (!dirs) {
      dirs = [];
    }

    if (!Array.isArray(dirs)) {
      dirs = [ dirs ];
    }

    dirs = dirs.concat(self.options.partialPaths || []);

    // The apostrophe module's views directory is always the last
    // thing tried, so that you can extend the widgetEditor template, etc.
    dirs = dirs.concat([ __dirname + '/../views' ]);

    var dirsKey = dirs.join(':');
    if (!nunjucksEnvs[dirsKey]) {
      nunjucksEnvs[dirsKey] = self.newNunjucksEnv(dirs);
    }
    return nunjucksEnvs[dirsKey];
  };

  // String.replace does NOT do this
  // Regexps can but they can't be trusted with UTF8 ):

  function globalReplace(haystack, needle, replacement) {
    var result = '';
    while (true) {
      if (!haystack.length) {
        return result;
      }
      var index = haystack.indexOf(needle);
      if (index === -1) {
        result += haystack;
        return result;
      }
      result += haystack.substr(0, index);
      result += replacement;
      haystack = haystack.substr(index + needle.length);
    }
  }

  // Determine search text based on a file object
  function fileSearchText(file) {
    var s = globalReplace(file.name, '-', ' ') + ' ' + file.extension + ' ' + file.group;
    if (file.extension === 'jpg') {
      s += ' jpeg';
    }
    return s;
  }

  // TODO: make sure item.type is on the allowed list for this specific area.
  // Write more validators for types.

  self.sanitizeItems = function(items)
  {
    _.each(items, function(item) {
      var itemType = self.itemTypes[item.type];
      if (!itemType) {
        return;
      }
      if (itemType.sanitize) {
        itemType.sanitize(item);
      }
    });
  };

  function sanitizeSlideshow(item) {
    if (!Array.isArray(item.ids)) {
      item.ids = [];
    }
    item.showTitles = self.sanitizeBoolean(item.showTitles);
    item.showDescriptions = self.sanitizeBoolean(item.showDescriptions);
    item.showCredits = self.sanitizeBoolean(item.showCredits);
    if (typeof(item.extras) !== 'object') {
      item.extras = {};
    }
    var ids = [];
    var extras = {};
    _.each(item.ids, function(id) {
      id = self.sanitizeString(id);
      if (!id) {
        return;
      }
      var extra = item.extras[id];
      if (typeof(extra) !== 'object') {
        extra = {};
      }
      var newExtra = {
        hyperlink: self.sanitizeUrl(extra.hyperlink, undefined),
        hyperlinkTitle: self.sanitizeString(extra.hyperlinkTitle, undefined)
      };

      if (extra.crop) {
        newExtra.crop = {
          top: self.sanitizeInteger(extra.crop.top),
          left: self.sanitizeInteger(extra.crop.left),
          width: self.sanitizeInteger(extra.crop.width),
          height: self.sanitizeInteger(extra.crop.height)
        };
      }
      extras[id] = newExtra;
      ids.push(id);
    });
    item.ids = ids;
    item.extras = extras;
    return item;
  }

  self.loadSlideshow = function(req, item, callback) {
    if (!item.ids) {
      console.error('WARNING: you need to run "node app apostrophe:migrate"');
      return callback(null);
    }
    return self.getFiles(req, { ids: item.ids }, function(err, result) {
      if (err) {
        return callback(err);
      }

      // Put them in the desired order, tolerating files that have
      // been removed
      var files = {};
      _.each(result.files, function(file) {
        files[file._id] = file;
      });
      item._items = [];
      _.each(item.ids, function(id) {
        if (files[id]) {
          item._items.push(files[id]);
        }
      });

      // Pull in placement specific fields like hyperlink and
      // hyperlinkTitle
      _.each(item._items, function(file) {
        if (item.extras && item.extras[file._id]) {
          extend(true, file, item.extras[file._id]);
        }
      });
      return callback(null);
    });
  };

  self.itemTypes = {
    richText: {
      markup: true,
      sanitize: function(item) {
        // This is just a down payment, we should be throwing out unwanted
        // tags attributes and properties as A1.5 does
        item.content = sanitize(item.content).xss().trim();
      },
      // Used by apos.getAreaPlaintext. Should not be present unless this type
      // actually has an appropriate plaintext representation for the public
      // to view. Most widgets won't. This is distinct from diff and search, see below.
      getPlaintext: function(item, lines) {
        return self.htmlToPlaintext(item.content);
      },
      addDiffLines: function(item, lines) {
        // Turn tags into line breaks, which generally produces some indication
        // of a change around that point
        var text = self.htmlToPlaintext(item.content);
        self.addDiffLinesForText(text, lines);
      },
      addSearchTexts: function(item, texts) {
        // Turn tags into line breaks, which generally produces some indication
        // of a change around that point
        var text = self.htmlToPlaintext(item.content);
        texts.push({ weight: 1, text: text});
      },
      empty: function(item) {
        // This is a little bit expensive, but it is otherwise very difficult to spot
        // things like a placeholder empty div or solitary br generated by the rich text editor
        // that designers consider "empty"
        var text = self.htmlToPlaintext(item.content);
        return (!text.trim().length);
      }
    },
    slideshow: {
      widget: true,
      label: 'Slideshow',
      icon: 'image',
      // icon: 'slideshow',
      sanitize: sanitizeSlideshow,
      render: function(data) {
        return self.partial('slideshow', data);
      },
      addDiffLines: function(item, lines) {
        var items = item._items || [];
        _.each(items, function(item) {
          lines.push('image: ' + item.name);
        });
      },
      addSearchTexts: function(item, texts) {
        var items = item._items || [];
        _.each(items, function(item) {
          texts.push({ weight: 1, text: item.name, silent: true });
        });
      },
      empty: function(item) {
        return !((item._items || []).length);
      },
      css: 'slideshow',
      // If these options are passed to the widget,
      // set them as JSON data attributes of the
      // widget element
      jsonOptions: [ 'delay', 'noHeight', 'widgetClass' ],
      jsonProperties: [ '_items' ],
      load: function(req, item, callback) {
        return self.loadSlideshow(req, item, callback);
      }
    },
    buttons: {
      widget: true,
      label: 'Button(s)',
      icon: 'button',
      sanitize: sanitizeSlideshow,
      // icon: 'slideshow',
      render: function(data) {
        return self.partial('buttons', data);
      },
      empty: function(item) {
        return !((item._items || []).length);
      },
      css: 'buttons',
      // If these options are passed to the widget,
      // set them as JSON data attributes of the
      // widget element
      jsonOptions: [ 'delay', 'noHeight', 'widgetClass' ],
      jsonProperties: [ '_items' ],
      load: function(req, item, callback) {
        return self.loadSlideshow(req, item, callback);
      }
    },
    marquee: {
      widget: true,
      label: 'Marquee',
      icon: 'slideshow',
      sanitize: sanitizeSlideshow,
      // icon: 'slideshow',
      render: function(data) {
        return self.partial('marquee', data);
      },
      empty: function(item) {
        return !((item._items || []).length);
      },
      css: 'marquee',
      // If these options are passed to the widget,
      // set them as JSON data attributes of the
      // widget element
      jsonOptions: [ 'delay', 'noHeight', 'widgetClass' ],
      jsonProperties: [ '_items' ],
      load: function(req, item, callback) {
        return self.loadSlideshow(req, item, callback);
      }
    },
    files: {
      widget: true,
      label: 'Files',
      icon: 'file',
      sanitize: sanitizeSlideshow,
      render: function(data) {
        var val = self.partial('files', data);
        return val;
      },
      addSearchTexts: function(item, texts) {
        var items = item._items || [];
        _.each(items, function(item) {
          texts.push({ weight: 1, text: item.name, silent: true });
        });
      },
      empty: function(item) {
        return !((item._items || []).length);
      },
      css: 'files',
      // If these options are passed to the widget,
      // set them as JSON data attributes of the
      // widget element
      jsonOptions: [ 'widgetClass' ],
      jsonProperties: [ '_items' ],
      load: function(req, item, callback) {
        return self.loadSlideshow(req, item, callback);
      }
    },
    video: {
      widget: true,
      label: 'Video',
      icon: 'video',
      render: function(data) {
        return self.partial('video', data);
      },
      addDiffLines: function(item, lines) {
        lines.push('video: ' + item.url);
      },
      css: 'video'
    },
    pullquote: {
      widget: true,
      label: 'Pullquote',
      plaintext: true,
      wrapper: 'span',
      icon: 'quote-left',
      // Without this it's bothersome for editor.js to grab the text
      // without accidentally grabbing the buttons. -Tom
      wrapperClass: 'apos-pullquote-text',
      css: 'pullquote',
      addDiffLines: function(item, lines) {
        lines.push('pullquote: ' + item.content || '');
      },
      addSearchTexts: function(item, texts) {
        texts.push({ weight: 1, text: item.content || ''});
      },
    },
    code: {
      widget: true,
      label: 'Code',
      // icon: 'code',
      plaintext: true,
      wrapper: 'pre',
      css: 'code',
      addDiffLines: function(item, lines) {
        self.addDiffLinesForText(item.content ? item.content : '', lines);
      },
      addSearchTexts: function(item, texts) {
        texts.push({ weight: 1, text: item.content || ''});
      },
    },
    html: {
      widget: true,
      label: 'HTML',
      icon: 'code',
      css: 'html',
      addDiffLines: function(item, lines) {
        self.addDiffLinesForText(item.content ? item.content : '', lines);
      },
      render: function(data) {
        return self.partial('html', data);
      }
    }
  };

  self.newNunjucksEnv = function(dirs) {

    var nunjucksEnv = new nunjucks.Environment(new nunjucks.FileSystemLoader(dirs));

    nunjucksEnv.addFilter('date', function(date, format) {
      var s = moment(date).format(format);
      return s;
    });

    nunjucksEnv.addFilter('query', function(data) {
      return qs.stringify(data);
    });

    nunjucksEnv.addFilter('json', function(data) {
      return JSON.stringify(data);
    });

    nunjucksEnv.addFilter('qs', function(data) {
      return qs.stringify(data);
    });

    // See apos.build

    nunjucksEnv.addFilter('build', self.build);

    nunjucksEnv.addFilter('nlbr', function(data) {
      data = globalReplace(data, "\n", "<br />\n");
      return data;
    });

    nunjucksEnv.addFilter('css', function(data) {
      return self.cssName(data);
    });

    nunjucksEnv.addFilter('truncate', function(data, limit) {
      return self.truncatePlaintext(data, limit);
    });

    nunjucksEnv.addFilter('jsonAttribute', function(data) {
      // Leverage jQuery's willingness to parse attributes as JSON objects and arrays
      // if they look like it. TODO: find out if this still works cross browser with
      // single quotes, all the double escaping is unfortunate
      if (typeof(data) === 'object') {
        return self.escapeHtml(JSON.stringify(data));
      } else {
        // Make it a string for sure
        data += '';
        return self.escapeHtml(data);
      }
    });

    return nunjucksEnv;
  };

  // TODO MAKE ME AN NPM MODULE
  //
  // Add and modify query parameters of a url. data is an object whose properties
  // become new query parameters. These parameters override any existing
  // parameters of the same name in the URL. If you pass a property with
  // a value of undefined, null or an empty string, that parameter is removed from the
  // URL if already present (note that the number 0 does not do this). This is very
  // useful for maintaining filter parameters in a query string without redundant code.
  //
  // PRETTY URLS
  //
  // If the optional `path` argument is present, it must be an array. (You
  // may skip this argument if you are just adding query parameters.) Any
  // properties of `data` whose names appear in `path` are concatenated
  // to the URL directly, separated by slashes, in the order they appear in that
  // array. The first missing or empty value for a property in `path` stops
  // this process to prevent an ambiguous URL.
  //
  // Note that there is no automatic detection that this has
  // already happened in an existing URL, so you can't override existing
  // components of the path. Typically this is used with a snippet index page,
  // on which the URL of the page is available as a starting point for
  // building the next URL.
  //
  // If a property's value is not equal to the slugification of itself
  // (apos.slugify), then a query parameter is set instead. This ensures your
  // URLs are not rejected by the browser. If you don't want to handle a
  // property as a query parameter, make sure it is always slug-safe.
  //
  // OVERRIDES: MULTIPLE DATA OBJECTS
  //
  // You may pass additional data objects. The last one wins, so you can
  // pass your existing parameters first and pass new parameters you are changing
  // as a second data object.

  self.build = function(url, path, data) {
    // Sometimes necessary with nunjucks, we may otherwise be
    // exposed to a SafeString object and throw an exception. Not
    // able to boil this down to a simple test case for jlongster so far
    url = url.toString();
    var qat = url.indexOf('?');
    var base = url;
    var dataObjects = [];
    var pathKeys;
    var original;
    var query = {};

    if (qat !== -1) {
      original = qs.parse(url.substr(qat + 1));
      base = url.substr(0, qat);
    }
    var dataStart = 1;
    if (path && Array.isArray(path)) {
      pathKeys = path;
      dataStart = 2;
    } else {
      pathKeys = [];
    }
    // Process data objects in reverse order so the last override wins
    for (var i = arguments.length - 1; (i >= dataStart); i--) {
      dataObjects.push(arguments[i]);
    }
    if (original) {
      dataObjects.push(original);
    }
    var done = {};
    var stop = false;
    _.every(pathKeys, function(key) {
      return _.some(dataObjects, function(dataObject) {
        if (stop) {
          return false;
        }
        if (dataObject.hasOwnProperty(key)) {
          var value = dataObject[key];
          // If we hit an empty value we need to stop all path processing to avoid
          // ambiguous URLs
          if ((value === undefined) || (value === null) || (value === '')) {
            done[key] = true;
            stop = true;
            return true;
          }
          // If the value is an object it can't be stored in the path,
          // so stop path processing, but don't mark this key 'done'
          // because we can still store it as a query parameter
          if (typeof(value) === 'object') {
            stop = true;
            return true;
          }
          var s = dataObject[key].toString();
          if (s === self.slugify(s)) {
            // Don't append double /
            if (base !== '/') {
              base += '/';
            }
            base += s;
            done[key] = true;
            return true;
          }
        }
        return false;
      });
    });
    _.each(dataObjects, function(data) {
      _.each(data, function(value, key) {
        if (done[key]) {
          return;
        }
        done[key] = true;
        if ((value === undefined) || (value === null) || (value === '')) {
          delete query[key];
        } else {
          query[key] = value;
        }
      });
    });
    if (_.size(query)) {
      return base + '?' + qs.stringify(query);
    } else {
      return base;
    }
  };

  self.escapeHtml = function(s) {
    if (s === 'undefined') {
      s = '';
    }
    if (typeof(s) !== 'string') {
      s = s + '';
    }
    return s.replace(/\&/g, '&amp;').replace(/</g, '&lt;').replace(/\>/g, '&gt;').replace(/\"/g, '&quot;');
  };

  // Convert HTML to true plaintext, with all entities decoded
  self.htmlToPlaintext = function(html) {
    // The awesomest HTML renderer ever (look out webkit):
    // block element opening tags = newlines, closing tags and non-container tags just gone
    html = html.replace(/<\/.*?\>/g, '');
    html = html.replace(/<(h1|h2|h3|h4|h5|h6|p|br|blockquote).*?\>/gi, '\n');
    html = html.replace(/<.*?\>/g, '');
    return ent.decode(html);
  };

  // Accept tags as a comma-separated string and sanitize them,
  // returning an array of zero or more nonempty strings. Must match
  // browser side implementation. Useful on the server side for
  // import implementations
  self.tagsToArray = function(tags) {
    if (typeof(tags) === 'number') {
      tags += '';
    }
    if (typeof(tags) !== 'string') {
      return [];
    }
    tags += '';
    tags = tags.split(/,\s*/);
    // split returns an array of one empty string for an empty source string ):
    tags = _.filter(tags, function(tag) { return tag.length > 0; });
    // Make them all strings
    tags = _.map(tags, function(tag) {
      // Tags are always lowercase otherwise they will not compare
      // properly in MongoDB. If you want to change this then you'll
      // need to address that deeper issue
      return (tag + '').toLowerCase();
    });
    return tags;
  };

  // Note: you'll need to use xregexp instead if you need non-Latin character
  // support in slugs. KEEP IN SYNC WITH BROWSER SIDE IMPLEMENTATION in editor.js
  self.slugify = function(s, options) {
    // Trim and deal with wacky cases like an array coming in without crashing
    s = self.sanitizeString(s);

    // By default everything not a letter or number becomes a dash.
    // You can add additional allowed characters via options.allow and
    // change the separator with options.separator

    if (!options) {
      options = {};
    }

    if (!options.allow) {
      options.allow = '';
    }

    if (!options.separator) {
      options.separator = '-';
    }

    var r = "[^A-Za-z0-9" + RegExp.quote(options.allow) + "]";
    var regex = new RegExp(r, 'g');
    s = s.replace(regex, options.separator);
    // Consecutive dashes become one dash
    var consecRegex = new RegExp(RegExp.quote(options.separator) + '+', 'g');
    s = s.replace(consecRegex, options.separator);
    // Leading dashes go away
    var leadingRegex = new RegExp('^' + RegExp.quote(options.separator));
    s = s.replace(leadingRegex, '');
    // Trailing dashes go away
    var trailingRegex = new RegExp(RegExp.quote(options.separator) + '$');
    s = s.replace(trailingRegex, '');
    // If the string is empty, supply something so that routes still match
    if (!s.length)
    {
      s = 'none';
    }
    s = s.toLowerCase();
    return s;
  };

  // Returns a string that, when used for searches and indexes, behaves
  // similarly to MySQL's default behavior for string matching, plus a little
  // extra tolerance of punctuation and whitespace differences. This is
  // in contrast to MongoDB's default "absolute match with same case only"
  // behavior which is no good for most searches
  self.sortify = function(s) {
    return self.slugify(s, { separator: ' ' });
  };

  // Turn a user-entered search query into a regular expression, suitable
  // for filtering on the highSearchText or lowSearchText property
  self.searchify = function(q) {
    q = self.sortify(q);
    q = q.replace(/ /g, '.*?');
    q = new RegExp(q);
    return q;
  };

  // For convenience when configuring uploadfs. We recommend always configuring
  // these sizes and adding more if you wish
  self.defaultImageSizes = [
    {
      name: 'full',
      width: 1140,
      height: 1140
    },
    {
      name: 'two-thirds',
      width: 760,
      height: 760
    },
    {
      name: 'one-half',
      width: 570,
      height: 700
    },
    {
      name: 'one-third',
      width: 380,
      height: 700
    },
    // Handy for thumbnailing
    {
      name: 'one-sixth',
      width: 190,
      height: 350
    }
  ];

  // Is this MongoDB error related to uniqueness? Great for retrying on duplicates.
  // Used heavily by the pages module and no doubt will be by other things.
  //
  // There are three error codes for this: 13596 ("cannot change _id of a document")
  // and 11000 and 11001 which specifically relate to the uniqueness of an index.
  // 13596 can arise on an upsert operation, especially when the _id is assigned
  // by the caller rather than by MongoDB.
  //
  // IMPORTANT: you are responsible for making sure ALL of your unique indexes
  // are accounted for before retrying... otherwise an infinite loop will
  // likely result.

  self.isUniqueError = function(err) {
    if (!err) {
      return false;
    }
    if (err.code === 13596) {
      return true;
    }
    return ((err.code === 13596) || (err.code === 11000) || (err.code === 11001));
  };

  // An easy way to leave automatic redirects behind as things are renamed.
  // Can be used with anything that lives in the pages table - regular pages,
  // blog posts, events, etc. See the pages and blog modules for examples of usage.

  self.updateRedirect = function(originalSlug, slug, callback) {
    if (slug !== originalSlug) {
      self.redirects.update(
        { from: originalSlug },
        { from: originalSlug, to: slug },
        { upsert: true, safe: true },
        function(err, doc) {
          return callback(err);
        }
      );
    }
    return callback(null);
  };

  // The browser already submits tags as a nice array, but make sure
  // that's really what we got.
  self.sanitizeTags = function(tags) {
    if (!Array.isArray(tags)) {
      return [];
    }
    tags = _.map(tags, function(tag) {
      if (typeof(tag) === 'number') {
        tag += '';
      }
      return tag;
    });
    tags = _.filter(tags, function(tag) {
      return (typeof(tag) === 'string');
    });
    return tags;
  };

  // STRING UTILITIES
  self.capitalizeFirst = function(s) {
    return s.charAt(0).toUpperCase() + s.substr(1);
  };

  // Convert everything else to a hyphenated css name. Not especially fast,
  // hopefully you only do this during initialization and remember the result
  // KEEP IN SYNC WITH BROWSER SIDE VERSION in content.js
  self.cssName = function(camel) {
    var i;
    var css = '';
    var dash = false;
    for (i = 0; (i < camel.length); i++) {
      var c = camel.charAt(i);
      var lower = ((c >= 'a') && (c <= 'z'));
      var upper = ((c >= 'A') && (c <= 'Z'));
      var digit = ((c >= '0') && (c <= '9'));
      if (!(lower || upper || digit)) {
        dash = true;
        continue;
      }
      if (upper) {
        if (i > 0) {
          dash = true;
        }
        c = c.toLowerCase();
      }
      if (dash) {
        css += '-';
        dash = false;
      }
      css += c;
    }
    return css;
  };

  // Accepts a camel-case type name such as blog and returns a browser-side
  // constructor function name such as AposBlog

  self.constructorName = function(camel) {
    return 'Apos' + camel.charAt(0).toUpperCase() + camel.substring(1);
  };

  // Simple string sanitization so junk submissions can't crash the app
  self.sanitizeString = function(s, def) {
    if (typeof(s) !== 'string') {
      if (typeof(s) === 'number') {
        s += '';
      } else {
        s = '';
      }
    }
    s = s.trim();
    if (def !== undefined) {
      if (s === '') {
        s = def;
      }
    }
    return s;
  };

  self.sanitizeUrl = function(s, def) {
    s = self.sanitizeString(s, def);
    // Allow the default to be undefined, null, false, etc.
    if (s === def) {
      return s;
    }
    s = self.fixUrl(s);
    if (s === null) {
      return def;
    }
    return s;
  };

  // Fix lame URLs. If we can't fix the URL, return null.
  //
  // Accepts valid URLs and relative URLs. If the URL smells like
  // it starts with a domain name, supplies an http:// prefix.
  //
  // KEEP IN SYNC WITH editor.js BROWSER SIDE VERSION

  self.fixUrl = function(href) {
    if (href.match(/^(((https?|ftp)\:\/\/)|mailto\:|\#|([^\/\.]+)?\/|[^\/\.]+$)/)) {
      // All good - no change required
      return href;
    } else if (href.match(/^[^\/\.]+\.[^\/\.]+/)) {
      // Smells like a domain name. Educated guess: they left off http://
      return 'http://' + href;
    } else {
      return null;
    }
  };

  // Sanitize a select element
  self.sanitizeSelect = function(s, choices, def) {
    if (!_.contains(choices, s)) {
      return def;
    }
    return s;
  };

  // Accepts true, 'true', 't', '1', 1 as true
  // Accepts everything else as false
  // If nothing is submitted the default (def) is returned
  // If def is undefined the default is false
  self.sanitizeBoolean = function(b, def) {
    if (b === true) {
      return true;
    }
    if (b === false) {
      return false;
    }
    b = self.sanitizeString(b, def);
    if (b === def) {
      if (b === undefined) {
        return false;
      }
      return b;
    }
    b = b.toLowerCase().charAt(0);
    if (b === '') {
      return false;
    }
    if ((b === 't') || (b === 'y') || (b === '1')) {
      return true;
    }
    return false;
  };

  // Given an `options` object in which options[name] is a string
  // set to '0', '1', or 'any', this method adds mongodb criteria
  // to the `criteria` object.
  //
  // false, true and null are accepted as synonyms for '0', '1' and 'any'.
  //
  // '0' or false means "the property must be false or absent," '1' or true
  // means "the property must be true," and 'any' or null means "we don't care
  // what the property is."
  //
  // An empty string is considered equivalent to '0'.
  //
  // This is not the same as apos.sanitizeBoolean which is concerned only with
  // true or false and does not address "any."
  //
  // def defaults to `any`.
  //
  // This method is most often used with REST API parameters and forms.

  self.convertBooleanFilterCriteria = function(name, options, criteria, def) {
    if (def === undefined) {
      def = 'any';
    }
    // Consume special options then remove them, turning the rest into mongo criteria

    if (def === undefined) {
      def = 'any';
    }
    var value = (options[name] === undefined) ? def : options[name];

    if ((value === 'any') || (value === null)) {
      // Don't care, show all
    } else if ((!value) || (value === '0')) {
      // Must be absent or false. Hooray for $ne
      criteria[name] = { $ne: true };
    } else {
      // Must be true
      criteria[name] = true;
    }
  };

  self.sanitizeInteger = function(i, def, min, max) {
    if (def === undefined) {
      def = 0;
    }
    if (typeof(i) === 'number') {
      i = Math.floor(i);
    }
    else
    {
      try {
        i = parseInt(i, 10);
        if (isNaN(i)) {
          i = def;
        }
      } catch (e) {
        i = def;
      }
    }
    if ((min !== undefined) && (i < min)) {
      i = min;
    }
    if ((max !== undefined) && (i > max)) {
      i = max;
    }
    return i;
  };

  // pad an integer with leading zeroes, creating a string
  self.padInteger = function(i, places) {
    var s = i + '';
    while (s.length < places) {
      s = '0' + s;
    }
    return s;
  };

  // Accept a user-entered string in YYYY-MM-DD, MM/DD, MM/DD/YY, or MM/DD/YYYY format
  // (tolerates missing leading zeroes on MM and DD). Also accepts a Date object.
  // Returns YYYY-MM-DD.
  //
  // The current year is assumed when MM/DD is used. If there is no explicit default
  // any unparseable date is returned as today's date.

  self.sanitizeDate = function(date, def) {
    var components;

    function returnDefault() {
      if (def === undefined) {
        def = moment().format('YYYY-MM-DD');
      }
      return def;
    }

    if (typeof(date) === 'string') {
      if (date.match(/\//)) {
        components = date.split('/');
        if (components.length === 2) {
          // Convert mm/dd to yyyy-mm-dd
          return self.padInteger(new Date().getYear() + 1900, 4) + '-' + self.padInteger(components[0], 2) + '-' + self.padInteger(components[1], 2);
        } else if (components.length === 3) {
          // Convert mm/dd/yyyy to yyyy-mm-dd
          if (components[2] < 100) {
            components[2] += 1000;
          }
          return self.padInteger(components[2], 4) + '-' + self.padInteger(components[0], 2) + '-' + self.padInteger(components[1], 2);
        } else {
          return returnDefault();
        }
      } else if (date.match(/\-/)) {
        components = date.split('-');
        if (components.length === 2) {
          // Convert mm-dd to yyyy-mm-dd
          return self.padInteger(new Date().getYear() + 1900, 4) + '-' + self.padInteger(components[0], 2) + '-' + self.padInteger(components[1], 2);
        } else if (components.length === 3) {
          // Convert yyyy-mm-dd (with questionable padding) to yyyy-mm-dd
          return self.padInteger(components[0], 4) + '-' + self.padInteger(components[1], 2) + '-' + self.padInteger(components[2], 2);
        } else {
          return returnDefault();
        }
      }
    }
    try {
      date = new Date(date);
      if (isNaN(date.getTime())) {
        return returnDefault();
      }
      return self.padInteger(date.getYear() + 1900, 4) + '-' + self.padInteger(date.getMonth() + 1, 2) + '-' + self.padInteger(date.getDay(), 2);
    } catch (e) {
      return returnDefault();
    }
  };

  // Given a jQuery date object, return a date string in
  // Apostrophe's preferred sortable, comparable, JSON-able format.
  // If 'date' is missing the current date is used
  self.formatDate = function(date) {
    return moment(date).format('YYYY-MM-DD');
  };

  // Accept a user-entered string in 12-hour or 24-hour time and returns a string
  // in 24-hour time. Seconds are not supported. If def is not set the default
  // is the current time

  self.sanitizeTime = function(time, def) {
    time = self.sanitizeString(time).toLowerCase();
    time = time.trim();
    var components = time.match(/^(\d+)(:(\d+))?(:(\d+))?\s*(am|pm)?$/);
    if (components) {
      var hours = parseInt(components[1], 10);
      var minutes = (components[3] !== undefined) ? parseInt(components[3], 10) : 0;
      var seconds = (components[5] !== undefined) ? parseInt(components[5], 10) : 0;
      var ampm = components[6];
      if ((hours === 12) && (ampm === 'am')) {
        hours -= 12;
      } else if ((hours === 12) && (ampm === 'pm')) {
        // Leave it be
      } else if (ampm === 'pm') {
        hours += 12;
      }
      if ((hours === 24) || (hours === '24')) {
        hours = 0;
      }
      return self.padInteger(hours, 2) + ':' + self.padInteger(minutes, 2) + ':' + self.padInteger(seconds, 2);
    } else {
      if (def !== undefined) {
        return def;
      }
      return moment().format('HH:mm');
    }
  };

  // Requires a time in HH:MM or HH:MM:ss format. Returns
  // an object with hours, minutes and seconds properties.
  // See sanitizeTime for an easy way to get a time into the
  // appropriate input format.

  self.parseTime = function(time) {
    var components = time.match(/^(\d\d):(\d\d)(:(\d\d))$/);
    return {
      hours: time[1],
      minutes: time[2],
      seconds: time[3] || 0
    };
  };

  // Given a jQuery date object, return a time string in
  // Apostrophe's preferred sortable, comparable, JSON-able format:
  // 24-hour time, with seconds.
  //
  // If 'date' is missing the current time is used

  self.formatTime = function(date) {
    return moment(date).format('HH:mm:ss');
  };

  // Date and time tests
  // console.log(self.padInteger(4, 2));
  // console.log(self.padInteger(12, 2));
  // console.log(self.sanitizeDate('04/01/2013'));
  // console.log(self.sanitizeDate('2013-04-01'));
  // console.log(self.sanitizeDate('04/01'));
  // console.log(self.sanitizeDate(new Date()));
  // console.log(self.sanitizeTime('23:35'));
  // console.log(self.sanitizeTime('11pm'));

  // KEEP IN SYNC WITH CLIENT SIDE VERSION IN content.js
  //
  // Convert a name to camel case.
  //
  // Useful in converting CSV with friendly headings into sensible property names.
  //
  // Only digits and ASCII letters remain.
  //
  // Anything that isn't a digit or an ASCII letter prompts the next character
  // to be uppercase. Existing uppercase letters also trigger uppercase, unless
  // they are the first character; this preserves existing camelCase names.

  self.camelName = function(s) {
    var i;
    var n = '';
    var nextUp = false;
    for (i = 0; (i < s.length); i++) {
      var c = s.charAt(i);
      // If the next character is already uppercase, preserve that, unless
      // it is the first character
      if ((i > 0) && c.match(/[A-Z]/)) {
        nextUp = true;
      }
      if (c.match(/[A-Za-z0-9]/)) {
        if (nextUp) {
          n += c.toUpperCase();
          nextUp = false;
        } else {
          n += c.toLowerCase();
        }
      } else {
        nextUp = true;
      }
    }
    return n;
  };

  // MONGO HELPERS

  // 'ids' should be an array of mongodb IDs. The elements of the 'items' array are
  // returned in the order specified by 'ids'. This is useful after performing an
  // $in query with MongoDB (note that $in does NOT sort its results in the order given).
  //
  // Any IDs that do not actually exist for an item in the 'items' array are not returned,
  // and vice versa. You should not assume the result will have the same length as
  // either array.

  self.orderById = function(ids, items) {
    var byId = {};
    _.each(items, function(item) {
      byId[item._id] = item;
    });
    items = [];
    _.each(ids, function(_id) {
      if (byId.hasOwnProperty(_id)) {
        items.push(byId[_id]);
      }
    });
    return items;
  };

  // Wrappers for conveniently invoking joinr. See the
  // joinr module for more information about joins.
  //
  // Apostrophe-specific features:
  //
  // If options.get is not set, apos.get is used; otherwise
  // it is usually the get method of a snippet subclass.
  // Looks for the returned documents in results.snippets,
  // then results.pages, then results itself. Additional
  // criteria for the getter can be passed via
  // options.getCriteria, and options to the getter can be
  // passed via options.getOptions (often used to prevent
  // infinite recursion when joining).

  self.joinByOne = function(req, items, idField, objectField, options, callback) {
    return self.join(joinr.byOne, false, req, items, idField, objectField, options, callback);
  };

  self.joinByOneReverse = function(req, items, idField, objectField, options, callback) {
    return self.join(joinr.byOneReverse, true, req, items, idField, objectField, options, callback);
  };

  self.joinByArray = function(req, items, idsField, objectsField, options, callback) {
    return self.join(joinr.byArray, false, req, items, idsField, objectsField, options, callback);
  };

  self.joinByArrayReverse = function(req, items, idsField, objectsField, options, callback) {
    return self.join(joinr.byArrayReverse, true, req, items, idsField, objectsField, options, callback);
  };

  // Driver for the above
  self.join = function(method, reverse, req, items, idField, objectField, options, callback) {
    if (!callback) {
      callback = options;
      options = {};
    }
    var getter = options.get || self.get;
    var getOptions = options.getOptions || {};
    var getCriteria = options.getCriteria || {};
    return method(items, idField, objectField, function(ids, callback) {
      var idsCriteria = {};
      if (reverse) {
        idsCriteria[idField] = { $in: ids };
      } else {
        idsCriteria._id = { $in: ids };
      }
      var criteria = { $and: [ getCriteria, idsCriteria ] };
      return getter(req, criteria, getOptions, function(err, results) {
        if (err) {
          return callback(err);
        }
        return callback(null, results.snippets || results.pages || results);
      });
    }, callback);
  };

  // FILE HELPERS

  // http://nodejs.org/api/crypto.html
  self.md5File = function(filename, callback) {
    var crypto = require('crypto');
    var fs = require('fs');

    var md5 = crypto.createHash('md5');

    var s = fs.ReadStream(filename);

    s.on('data', function(d) {
      md5.update(d);
    });

    s.on('error', function(err) {
      return callback(err);
    });

    s.on('end', function() {
      var d = md5.digest('hex');
      return callback(null, d);
    });
  };

  // COMMAND LINE TASKS
  //
  // Call this method just before invoking listen(). If it returns true, do not invoke
  // listen(). Just let the Apostrophe command line task that has been invoked
  // come to a graceful end on its own. This method only takes over if the
  // first argument begins with apostrophe:, so you can easily implement your own
  // command line processing without conflicts.
  //
  // "Why not have standalone task apps?" Because all the configuration and
  // initialization you do for a server is typically needed for command line tasks
  // to succeed as well (for instance, the right database connection).

  var taskActive = 0;

  // If a task event listener needs to return and keep working it should
  // invoke this callback to signify that. Apostrophe will not exit until
  // all busy tasks are marked done.
  self.taskBusy = function() {
    taskActive++;
  };

  // Call when no longer busy
  self.taskDone = function() {
    taskActive--;
  };

  // Return a `req` object suitable for use with putPage, getPage, etc.
  // that has full admin permissions. For use in command line tasks
  self.getTaskReq = function() {
    return { user: { permissions: { admin: true } } };
  };

  var taskFailed = false;

  // Call if the final exit status should not be 0 (something didn't work, and you want
  // shell scripts invoking this command line task to be able to tell)
  self.taskFailed = function() {
    taskFailed = true;
  };

  self.startTask = function(taskGroups) {

    if (!argv._.length) {
      return false;
    }
    if (!taskGroups) {
      taskGroups = {};
    }
    if (!taskGroups.apostrophe) {
      taskGroups.apostrophe = {};
    }
    _.defaults(taskGroups.apostrophe, self.tasks);

    // Accept . as well as : to please javascriptizens and symfonians
    var matches = argv._[0].match(/^(.*?)[\:|\.](.*)$/);
    if (!matches) {
      return false;
    }
    var group = matches[1];
    var cmd = matches[2];
    var camelGroup = self.camelName(group);
    if (!taskGroups[camelGroup]) {
      console.error('There are no tasks in the ' + group + ' group.');
      return usage();
    }
    group = taskGroups[camelGroup];

    function wait(callback) {
      var interval = setInterval(function() {
        if (!taskActive) {
          clearInterval(interval);
          return callback(null);
        }
      }, 10);
    }

    var camelCmd = self.camelName(cmd);
    if (_.has(group, camelCmd)) {
      // Think about switching to an event emitter that can wait.

      async.series({
        before: function(callback) {
          self.emit('task:' + argv._[0] + ':before');
          return wait(callback);
        },
        run: function(callback) {
          // Tasks can accept apos, argv, and a callback;
          // or just a callback;
          // or no arguments at all.
          //
          // If they accept no arguments at all, they must
          // utilize apos.taskBusy() and apos.taskDone(), and
          // call apos.taskFailed() in the event of an error.
          var task = group[camelCmd];
          if (task.length === 3) {
            return task(self, argv, callback);
          } else if (task.length === 1) {
            return task(callback);
          } else {
            task();
            return wait(callback);
          }
        },
        after: function(callback) {
          self.emit('task:' + argv._[0] + ':after');
          return wait(callback);
        }
      }, function(err) {
        if (err) {
          console.error('Task failed:');
          console.error(err);
          process.exit(1);
        }
        process.exit(taskFailed ? 1 : 0);
      });

      return true;

    } else {
      console.error('There is no such task.');
      return usage();
    }

    function usage() {
      console.error('\nAvailable tasks:\n');
      var groups = _.keys(taskGroups);
      groups.sort();
      _.each(groups, function(group) {
        var cmds = _.keys(taskGroups[group]);
        cmds.sort();
        _.each(cmds, function(cmd) {
          console.error(self.cssName(group) + ':' + self.cssName(cmd));
        });
        // Separate groups with a blank line
        console.error('');
      });
      console.error('\nYou may also use periods (.) as separators and camelCaseForNames.\n');
      process.exit(1);
    }
  };

  // Iterate over ALL page objects. This is pricey; it should be used in
  // migrations, not everyday operations if you can possibly avoid it.
  // Note this will fetch virtual pages that are not part of the tree, the
  // trash page, etc. if you don't set criteria to the contrary. The simplest
  // possible criteria is {} which will get everything, including the
  // trash page. Consider using criteria on type and slug.
  //
  // Your 'each' function is called with a page object and a callback for each
  // page. Your 'callback' function is called at the end with an error if any.

  self.forEachPage = function(criteria, each, callback) {
    return self.forEachDocumentInCollection(self.pages, criteria, each, callback);
  };

  // Iterates over files in the aposFiles collection. Note denormalized copies
  // of this information already exist in widgets (see self.forEachFileInAnyWidget)

  self.forEachFile = function(criteria, each, callback) {
    return self.forEachDocumentInCollection(self.files, criteria, each, callback);
  };

  self.forEachVideo = function(criteria, each, callback) {
    return self.forEachDocumentInCollection(self.videos, criteria, each, callback);
  };

  // Iterate over every area on every page on the entire site! Not fast. Definitely for
  // major migrations only. Iterator receives page object, area name, area object and
  // callback.
  //
  // The area object refers to the same object as page.areas[name], so updating the one
  // does update the other

  self.forEachArea = function(each, callback) {
    return self.forEachPage({}, function(page, callback) {
      var areaNames = Object.keys(page.areas || {});
      return async.forEachSeries(areaNames, function(name, callback) {
        // Make sure we don't crash the stack if 'each' invokes 'callback' directly
        // for many consecutive invocations
        return setImmediate(function() {
          return each(page, name, page.areas[name], callback);
        });
      }, callback);
    }, callback);
  };

  // Iterate over every Apostrophe item in every area in every page in the universe.
  // iterator receives page object, area name, area object, item offset, item object, callback.
  // Yes, the area and item objects do refer to the same objects you'd reach if you
  // stepped through the properites of the page object, so updating the one does
  // update the other

  self.forEachItem = function(each, callback) {
    return self.forEachArea(function(page, name, area, callback) {
      var n = -1;
      return async.forEachSeries(area.items || [], function(item, callback) {
        n++;
        // Make sure we don't crash the stack if 'each' invokes 'callback' directly
        // for many consecutive invocations
        return setImmediate(function() {
          return each(page, name, area, n, item, callback);
        });
      }, function(err) {
        return callback(err);
      });
    }, function(err) {
      return callback(err);
    });
  };

  self.forEachDocumentInCollection = function(collection, criteria, each, callback) {
    collection.find(criteria, function(err, cursor) {
      if (err) {
        return callback(err);
      }
      var done = false;
      async.whilst(function() { return !done; }, function(callback) {
        return cursor.nextObject(function(err, page) {
          if (err) {
            return callback(err);
          }
          if (!page) {
            done = true;
            return callback(null);
          }
          return each(page, callback);
        });
      }, callback);
    });
  };

  // An internal function for use by migrations that install system pages
  // like trash or search as children of the home page
  function insertSystemPage(page, callback) {
    // Determine rank of the new page, in case we didn't hardcode it, but
    // then check for a hardcoded rank too
    return self.pages.find({ path: /^home\/[\w\-]+$/ }, { rank: 1 }).sort({ rank: -1 }).limit(1).toArray(function(err, pages) {
      if (err) {
        return callback(null);
      }
      if (!page.rank) {
        var rank = 0;
        if (pages.length) {
          rank = pages[0].rank + 1;
        }
        page.rank = rank;
      }
      // System pages are always orphans at level 1
      page.level = 1;
      page.orphan = true;
      return self.pages.insert(page, callback);
    });
  }

  self.tasks = {};

  // Database migration (perform on deploy to address official database changes and fixes)
  self.tasks.migrate = function(callback) {
    // There shouldn't be anyone left with this issue, and it
    // wasn't an efficient migration.
    //
    // function fixEventEnd(callback) {
    //   // ISSUE: 'end' was meant to be a Date object matching
    //   // end_date and end_time, for sorting and output purposes, but it
    //   // contained start_time instead. Fortunately end_date and end_time are
    //   // authoritative so we can just rebuild it
    //   self.forEachPage({ type: 'event' }, function(event, callback) {
    //     if (event.endTime) {
    //       event.end = new Date(event.endDate + ' ' + event.endTime);
    //     } else {
    //       event.end = new Date(event.endDate + ' 00:00:00');
    //     }
    //     self.pages.update({ _id: event._id }, { $set: { end: event.end }}, function(err, count) {
    //       return callback(err);
    //     });
    //   }, function(err) {
    //     return callback(err);
    //   });
    // }

    function addTrash(callback) {
      // ISSUE: old sites might not have a trashcan page as a parent for trashed pages.
      self.pages.findOne({ type: 'trash', trash: true }, function (err, trash) {
        if (err) {
          return callback(err);
        }
        if (!trash) {
          console.log('No trash, adding it');
          return insertSystemPage({
            _id: 'trash',
            path: 'home/trash',
            slug: '/trash',
            type: 'trash',
            title: 'Trash',
            // Max home page direct kids on one site: 1 million. Max special
            // purpose admin pages: 999. That ought to be enough for
            // anybody... I hope!
            rank: 1000999,
            trash: true,
          }, callback);
        }
        return callback(null);
      });
    }

    function trimTitle(callback) {
      return self.forEachPage({ $or: [ { title: /^ / }, { title: / $/ } ] },
        function(page, callback) {
          return self.pages.update(
            { _id: page._id },
            { $set: { title: page.title.trim() } },
            callback);
        },
        callback);
    }

    function trimSlug(callback) {
      return self.forEachPage({ $or: [ { slug: /^ / }, { slug: / $/ } ] },
        function(page, callback) {
          return self.pages.update(
            { _id: page._id },
            { $set: { slug: page.slug.trim() } },
            callback);
        },
        callback);
    }

    function fixSortTitle(callback) {
      return self.forEachPage({ $or: [ { sortTitle: { $exists: 0 } }, { sortTitle: /^ / }, { sortTitle: / $/} ] },
        function(page, callback) {
          if (!page.title) {
            // Virtual pages will do this. Don't crash.
            return callback(null);
          }
          return self.pages.update(
            { _id: page._id },
            { $set: { sortTitle: self.sortify(page.title.trim()) } },
            callback);
        },
        callback);
    }

    // A2 uses plain strings as IDs. This allows true JSON serialization and
    // also allows known IDs to be used as identifiers which simplifies writing
    // importers from other CMSes. If someone who doesn't realize this plorps a lot
    // of ObjectIDs into the pages collection by accident, clean up the mess.

    function fixObjectId(callback) {
      return self.forEachPage({},
        function(page, callback) {
          var id = page._id;
          // Convert to an actual hex string, see if that makes it different, if so
          // save it with the new hex string as its ID. We have to remove and reinsert
          // it, unfortunately.
          page._id = id.toString();
          if (id !== page._id) {
            return self.pages.remove({ _id: id }, function(err) {
              if (err) {
                return callback(err);
              }
              return self.pages.insert(page, callback);
            });
          } else {
            return callback(null);
          }
        },
        callback);
    }

    // Reasonably certain we there are no projects left that need
    // this slow migration. -Tom
    //
    // // Early versions of Apostrophe didn't clean up their Unicode word joiner characters
    // // on save. These were present to prevent (Mac?) Chrome from selecting only half the widget
    // // when copying and pasting. To make matters worse, in Windows Chrome they turn out to
    // // show up as "I don't have this in my font" boxes. New versions use the 65279
    // // "zero-width non-break space" character, which is invisible on both platforms. And
    // // in addition they filter it out on save. Filter it out for existing pages on migrate.
    // function removeWidgetSaversOnSave(callback) {
    //   var used = false;
    //   self.forEachPage({},
    //     function(page, callback) {
    //       var modified = false;
    //       _.each(page.areas || [], function(area, name) {
    //         _.each(area.items, function(item) {
    //           if ((item.type === 'richText') && (item.content.indexOf(String.fromCharCode(8288)) !== -1)) {
    //             if (!modified) {
    //               modified = true;
    //               if (!used) {
    //                 used = true;
    //                 console.log('Removing widget-saver unicode characters');
    //               }
    //             }
    //             item.content = globalReplace(item.content, String.fromCharCode(8288), '');
    //           }
    //         });
    //       });
    //       if (modified) {
    //         return self.pages.update({ _id: page._id }, page, callback);
    //       } else {
    //         return callback(null);
    //       }
    //     }, callback
    //   );
    // }

    function explodePublishedAt(callback) {
      // the publishedAt property of articles must also be available in
      // the form of two more easily edited fields, publicationDate and
      // publicationTime
      var used = false;
      self.forEachPage({ type: 'blogPost' }, function(page, callback) {
        if ((page.publishedAt !== undefined) && (page.publicationDate === undefined)) {
          if (!used) {
            console.log('setting publication date and time for posts');
            used = true;
          }
          page.publicationDate = moment(page.publishedAt).format('YYYY-MM-DD');
          page.publicationTime = moment(page.publishedAt).format('HH:mm');
          return self.pages.update(
            { _id: page._id },
            { $set: { publicationDate: page.publicationDate, publicationTime: page.publicationTime } },
            callback);
        } else {
          return callback(null);
        }
      }, callback);
    }

    function missingImageMetadata(callback) {
      var n = 0;
      return self.forEachFile({ $or: [
          { md5: { $exists: 0 } },
          { $and:
            [
              { extension: { $in: [ 'jpg', 'gif', 'png' ] } },
              { width: { $exists: 0 } }
            ]
          }
        ] }, function(file, callback) {
        var originalFile = '/files/' + file._id + '-' + file.name + '.' + file.extension;
        var tempFile = self.uploadfs.getTempPath() + '/' + self.generateId() + '.' + file.extension;
        n++;
        if (n === 1) {
          console.log('Adding metadata for files (may take a while)...');
        }
        async.series([
          function(callback) {
            self.uploadfs.copyOut(originalFile, tempFile, callback);
          },
          function(callback) {
            return self.md5File(tempFile, function(err, result) {
              if (err) {
                return callback(err);
              }
              file.md5 = result;
              return callback(null);
            });
          },
          function(callback) {
            if (_.contains(['gif', 'jpg', 'png'], file.extension) && (!file.width)) {
              return self.uploadfs.identifyLocalImage(tempFile, function(err, info) {
                if (err) {
                  return callback(err);
                }
                file.width = info.width;
                file.height = info.height;
                if (file.width > file.height) {
                  file.landscape = true;
                } else {
                  file.portrait = true;
                }
                return callback(null);
              });
            } else {
              return callback(null);
            }
          },
          function(callback) {
            self.files.update({ _id: file._id }, file, { safe: true }, callback);
          },
          function(callback) {
            fs.unlink(tempFile, callback);
          }
        ], function(err) {
          if (err) {
            // Don't give up completely if a file is gone or bad
            console.log('WARNING: error on ' + originalFile);
          }
          return callback(null);
        });
      }, callback);
    }

    function missingFileSearch(callback) {
      var n = 0;
      return self.forEachFile({ searchText: { $exists: 0 } }, function(file, callback) {
        n++;
        if (n === 1) {
          console.log('Adding searchText to files...');
        }
        file.searchText = fileSearchText(file);
        self.files.update({ _id: file._id }, file, callback);
      }, callback);
    }

    // If there are any pages whose tags property is defined but set
    // to null, due to inadequate sanitization in the snippets module,
    // fix them to be empty arrays so templates don't crash
    function fixNullTags(callback) {
      return self.pages.findOne({ $and: [ { tags: null }, { tags: { $exists: true } } ] }, function(err, page) {
        if (err) {
          return callback(err);
        }
        if (!page) {
          return callback(null);
        }
        console.log('Fixing pages whose tags property is defined and set to null');
        return self.pages.update({ $and: [ { tags: null }, { tags: { $exists: true } } ] }, { $set: { tags: [] }}, { multi: true }, callback);
      });
    }

    // If there are any pages whose tags property is defined but set
    // to null, due to inadequate sanitization in the snippets module,
    // fix them to be empty arrays so templates don't crash
    function fixNullTags(callback) {
      return self.pages.findOne({ $and: [ { tags: null }, { tags: { $exists: true } } ] }, function(err, page) {
        if (err) {
          return callback(err);
        }
        if (!page) {
          return callback(null);
        }
        console.log('Fixing pages whose tags property is defined and set to null');
        return self.pages.update({ $and: [ { tags: null }, { tags: { $exists: true } } ] }, { $set: { tags: [] }}, { multi: true }, callback);
      });
    }

    // Tags that are numbers can be a consequence of an import.
    // Clean that up so they match regexes properly.
    function fixNumberTags(callback) {
      return self.pages.distinct("tags", {}, function(err, tags) {
        if (err) {
          return callback(err);
        }
        return async.eachSeries(tags, function(tag, callback) {
          if (typeof(tag) === 'number') {
            return self.forEachPage({ tags: { $in: [ tag ] } }, function(page, callback) {
              page.tags = _.without(page.tags, tag);
              page.tags.push(tag.toString());
              return self.pages.update({ slug: page.slug }, { $set: { tags: page.tags } }, callback);
            }, callback);
          } else {
            return callback(null);
          }
        }, callback);
      });
    }

    function fixTimelessEvents(callback) {
      var used = false;
      return self.forEachPage({ type: 'event' }, function(page, callback) {
        if ((page.startTime === null) || (page.endTime === null)) {
          // We used to construct these with just the date, which doesn't
          // convert to GMT, so the timeless events were someodd hours out
          // of sync with the events that had explicit times
          var start = new Date(page.startDate + ' ' + ((page.startTime === null) ? '00:00:00' : page.startTime));
          var end = new Date(page.endDate + ' ' + ((page.endTime === null) ? '00:00:00' : page.endTime));
          if ((page.start.getTime() !== start.getTime()) || (page.end.getTime() !== end.getTime())) {
            if (!used) {
              console.log('Fixing timeless events');
            }
            used = true;
            return self.pages.update({ _id: page._id }, { $set: { start: start, end: end } }, { safe: true }, callback);
          } else {
            return callback(null);
          }
        } else {
          return callback(null);
        }
      }, callback);
    }

    // Moved page rank of trash and search well beyond any reasonable
    // number of legit kids of the home page
    function moveTrash(callback) {
      return self.pages.findOne({ type: 'trash' }, function(err, page) {
        if (!page) {
          return callback(null);
        }
        if (page.rank !== 1000999) {
          page.rank = 1000999;
          return self.pages.update({ _id: page._id }, page, callback);
        }
        return callback(null);
      });
    }

    function moveSearch(callback) {
      return self.pages.findOne({ type: 'search' }, function(err, page) {
        if (!page) {
          return callback(null);
        }
        if (page.path !== 'home/search') {
          // This is some strange search page we don't know about and
          // probably shouldn't tamper with
          return callback(null);
        }
        if (page.rank !== 1000998) {
          page.rank = 1000998;
          return self.pages.update({ _id: page._id }, page, callback);
        }
        return callback(null);
      });
    }

    function fixButtons(callback) {
      var count = 0;
      // There was briefly a bug in our re-normalizer where the hyperlink and
      // hyperlinkTitle properties were concerned. We can fix this, but
      // we can't detect whether the fix is necessary, and we don't want
      // to annoy people who have gone on with their lives and deliberately
      // removed hyperlinks. So we do this only if --fix-buttons is on the
      // command line

      if (!argv['fix-buttons']) {
        return callback(null);
      }
      return self.forEachItem(function(page, name, area, n, item, callback) {
        self.slideshowTypes = self.slideshowTypes || [ 'slideshow', 'marquee', 'files', 'buttons' ];
        if (!_.contains(self.slideshowTypes, item.type)) {
          return callback(null);
        }
        var ids = [];
        var extras = {};
        if (!item.legacyItems) {
          // This was created after the migration we're fixing so it's OK
          return callback(null);
        }
        count++;
        if (count === 1) {
          console.log('Fixing buttons damaged by buggy normalizer');
        }
        var interesting = 0;
        async.each(item.legacyItems, function(file, callback) {
          ids.push(file._id);
          var extra = {};
          extra.hyperlink = file.hyperlink;
          extra.hyperlinkTitle = file.hyperlinkTitle;
          if (extra.hyperlink || extra.hyperlinkTitle) {
            extras[file._id] = extra;
            interesting++;
          }
          return callback(null);
        }, function(err) {
          if (err) {
            return callback(err);
          }
          item.extras = extras;
          if (!interesting) {
            return callback(null);
          }
          var value = { $set: {} };
          // ♥ dot notation
          value.$set['areas.' + name + '.items.' + n + '.extras'] = item.extras;
          return self.pages.update({ _id: page._id }, value, callback);
        });
      }, callback);
    }

    function fixCrops(callback) {
      var count = 0;
      // There was briefly a bug in our re-normalizer where the hyperlink and
      // hyperlinkTitle properties were concerned. We can fix this, but
      // we can't detect whether the fix is necessary, and we don't want
      // to annoy people who have gone on with their lives and deliberately
      // redone crops. So we do this only if --fix-crops is on the
      // command line

      if (!argv['fix-crops']) {
        return callback(null);
      }
      return self.forEachItem(function(page, name, area, n, item, callback) {
        self.slideshowTypes = self.slideshowTypes || [ 'slideshow', 'marquee', 'files', 'buttons' ];
        if (!_.contains(self.slideshowTypes, item.type)) {
          return callback(null);
        }
        var ids = [];
        var extras = {};
        if (!item.legacyItems) {
          // This was created after the migration we're fixing so it's OK
          return callback(null);
        }
        count++;
        if (count === 1) {
          console.log('Fixing crops damaged by buggy normalizer');
        }
        var interesting = 0;
        async.each(item.legacyItems, function(file, callback) {
          var value;
          if (file.crop) {
            var extra = item.extras[file._id];
            if (!extra) {
              extra = {};
            }
            if (!extra.crop) {
              extra.crop = file.crop;
              value = { $set: {} };
              value.$set['areas.' + name + '.items.' + n + '.extras.' + file._id] = extra;
              return self.pages.update({ _id: page._id }, value, callback);
            }
          }
          return callback(null);
        }, callback);
      }, callback);
    }

    function normalizeFiles(callback) {
      var count = 0;
      // We used to store denormalized copies of file objects in slideshow
      // widgets. This made it difficult to tell if a file was in the trash.
      // At some point we might bring it back but only if we have a scheme
      // in place to keep backreferences so the denormalized copies can be
      // efficiently found and updated.
      //
      // Migrate the truly slideshow-specific parts of that data to
      // .ids and .extras, and copy any titles and descriptions and credits
      // found in .items to the original file object (because they have
      // been manually edited and should therefore be better than what is in
      // the global object).
      //
      // This means two placements can't have different titles, but that
      // feature was little used and only lead to upset when users couldn't
      // change the title globally for an image.
      return self.forEachItem(function(page, name, area, n, item, callback) {
        self.slideshowTypes = self.slideshowTypes || [ 'slideshow', 'marquee', 'files', 'buttons' ];
        if (!_.contains(self.slideshowTypes, item.type)) {
          return callback(null);
        }
        if (item.ids) {
          // Already migrated
          return callback(null);
        }
        var ids = [];
        var extras = {};
        count++;
        if (count === 1) {
          console.log('Normalizing file references in slideshows etc.');
        }
        async.each(item.items, function(file, callback) {
          ids.push(file._id);
          var extra = {};
          item.showTitles = !!(item.showTitles || (file.title));
          item.showCredits = !!(item.showCredits || (file.credit));
          item.showDescriptions = !!(item.showDescriptions || (file.description));
          extra.hyperlink = file.hyperlink;
          extra.hyperlinkTitle = file.hyperlinkTitle;
          extra.crop = file.crop;
          extras[file._id] = extra;
          if (!(file.title || file.credit || file.description)) {
            return callback(null);
          }
          // Merge the metadata found in this placement back to
          // the global file object
          return self.files.findOne({ _id: file._id }, function(err, realFile) {
            if (err) {
              return callback(err);
            }
            if (!realFile) {
              return callback(null);
            }
            if ((file.title === realFile.title) && (file.description === realFile.description) && (file.credit === realFile.credit)) {
              // We have values but they are not more exciting than what's
              // already in the file object
              return callback(null);
            }
            var value = { $set: {} };
            if (file.title) {
              value.$set.title = file.title;
            }
            if (file.description) {
              value.$set.description = file.description;
            }
            if (file.credit) {
              value.$set.credit = file.credit;
            }
            return self.files.update({ _id: file._id }, value, callback);
          });
        }, function(err) {
          if (err) {
            return callback(err);
          }
          item.ids = ids;
          item.extras = extras;
          // Just in case we didn't get this migration quite so right
          item.legacyItems = item.items;
          // Removed so we don't keep attempting this migration and
          // smooshing newer data
          delete item.items;
          var value = { $set: {} };
          // ♥ dot notation
          value.$set['areas.' + name + '.items.' + n] = item;
          return self.pages.update({ _id: page._id }, value, callback);
        });
      }, callback);
    }

    async.series([ addTrash, moveTrash, moveSearch, trimTitle, trimSlug, fixSortTitle, fixObjectId, explodePublishedAt, missingImageMetadata, missingFileSearch, fixNullTags, fixNumberTags, fixTimelessEvents, normalizeFiles, fixButtons, fixCrops ], function(err) {
      return callback(err);
    });
  };

  self.tasks.reset = function(callback) {
    console.log('Resetting the database - removing ALL content');
    var collections = [ self.files, self.pages, self.redirects, self.versions ];
    async.map(collections, function(collection, callback) {
      return collection.remove({}, callback);
    }, function (err) {
      if (err) {
        return callback(err);
      }
      return async.series([ resetMain ], callback);
      function resetMain(callback) {
        return self.pages.insert([{ slug: '/', _id: '4444444444444', path: 'home', title: 'Home', level: 0, type: 'home', published: true }, { slug: '/search', _id: 'search', orphan: true, path: 'home/search', title: 'Search', level: 1, type: 'search', rank: 9998, published: true }, { slug: '/trash', _id: 'trash', path: 'home/trash', title: 'Trash', level: 1, trash: true, type: 'trash', rank: 9999 }], callback);
      }
    });
  };

  self.tasks.index = function(callback) {
    return async.series({
      indexPages: function(callback) {
        console.log('Indexing all pages for search');
        return self.forEachPage({},
          function(page, callback) {
            return self.indexPage({}, page, callback);
          },
          callback);
      },
      indexFiles: function(callback) {
        console.log('Indexing all files for search');
        return self.forEachFile({}, function(file, callback) {
          file.searchText = fileSearchText(file);
          self.files.update({ _id: file._id }, file, callback);
        }, callback);
      },
      indexVideos: function(callback) {
        console.log('Indexing all videos for search');
        return self.forEachVideo({}, function(video, callback) {
          video.searchText = self.sortify(video.title);
          self.videos.update({ _id: video._id }, video, callback);
        }, callback);
      }
    }, callback);
  };

  self.tasks.oembed = function(callback) {
    console.log('Refreshing all oembed data for videos');
    // iterator receives page object, area name, area object, item offset, item object.
    var oembedCache = {};
    var n = 0;
    return self.forEachItem(function(page, name, area, offset, item, callback) {

      function go(result) {
        n++;
        console.log('examining video ' + n);
        item.thumbnail = result.thumbnail_url;
        item.title = result.title;
        return self.pages.update({ _id: page._id }, page, function(err, count) {
          return callback(err);
        });
      }

      if (item.type !== 'video') {
        return callback(null);
      }
      if (oembedCache[item.video]) {
        go(oembedCache[item.video]);
      } else {
        // 1/10th second pause between oembed hits to avoid being rate limited
        // (I don't know what their rate limit is, but...)
        setTimeout(function() {
          return oembed.fetch(item.video, {}, function (err, result) {
            if (!err) {
              oembedCache[item.video] = result;
              go(result);
            } else {
              // A few oembed errors are normal and not cause for panic.
              // Videos go away, for one thing. If you get a zillion of these
              // it's possible you have hit a rate limit
              console.log('Warning: oembed error for ' + item.video + '\n');
              console.log(err);
              return callback(null);
            }
          });
        }, 100);
      }
    }, callback);
  };

  self.tasks.rescale = function(callback) {
    console.log('Rescaling all images with latest uploadfs settings');
    self.files.count(function(err, total) {
      if (err) {
        return callback(err);
      }
      var n = 0;
      self.forEachFile({},
        function(file, fileCallback) {
          if (!_.contains(['jpg', 'png', 'gif'], file.extension)) {
            n++;
            console.log('Skipping a non-image file: ' + file.name + '.' + file.extension);
            return fileCallback(null);
          }
          var tempFile;
          async.series([
            function(callback) {
              var originalFile = '/files/' + file._id + '-' + file.name + '.' + file.extension;
              tempFile = self.uploadfs.getTempPath() + '/' + self.generateId() + '.' + file.extension;
              n++;
              console.log(n + ' of ' + total + ': ' + originalFile);
              async.series([
                function(resumeCallback) {
                  // ACHTUNG: the --resume option will skip any image that
                  // has a one-third size rendering. So it's not very useful
                  // for resuming the addition of an additional size. But
                  // it's pretty handy after a full import. --resume takes
                  // a site URL (no trailing /) to which the relative URL
                  // to files will be appended. If your media are
                  // actually on s3 you can skip that part, it'll figure it out.
                  if (!argv.resume) {
                    return resumeCallback(null);
                  }
                  var url = self.uploadfs.getUrl() + '/files/' + file._id + '-' + file.name + '.one-third.' + file.extension;
                  if (url.substr(0, 1) === '/') {
                    url = argv.resume + url;
                  }
                  console.log('Checking ' + url);
                  return request.head(url, function(err, response, body) {
                    console.log(err);
                    console.log(response.statusCode);
                    if ((!err) && (response.statusCode === 200)) {
                      // Invoke the MAIN callback, skipping this file
                      console.log('exists, skipping');
                      return fileCallback(null);
                    }
                    // Continue the pipeline to rescale this file
                    return resumeCallback(null);
                  });
                },
                function(callback) {
                  self.uploadfs.copyOut(originalFile, tempFile, callback);
                },
                function(callback) {
                  if (!argv['crop-only']) {
                    return self.uploadfs.copyImageIn(tempFile, originalFile, callback);
                  } else {
                    return callback(null);
                  }
                }
              ], callback);
            },
            // Don't forget to recrop as well!
            function(callback) {
              async.forEachSeries(file.crops || [], function(crop, callback) {
                console.log('RECROPPING');
                var originalFile = '/files/' + file._id + '-' + file.name + '.' + crop.left + '.' + crop.top + '.' + crop.width + '.' + crop.height + '.' + file.extension;
                console.log("Cropping " + tempFile + " to " + originalFile);
                self.uploadfs.copyImageIn(tempFile, originalFile, { crop: crop }, callback);
              }, callback);
            },
            function(callback) {
              fs.unlink(tempFile, callback);
            }
          ], fileCallback);
        },
        callback);
    });
  };

  // This is not a migration because it is not mandatory to have search on your site
  self.tasks.search = function(callback) {
    console.log('Adding a search page to the site');
    self.pages.findOne({ type: 'search' }, function (err, search) {
      if (err) {
        return callback(err);
      }
      if (!search) {
        console.log('No search page, adding it');
        return insertSystemPage({
            _id: 'search',
            path: 'home/search',
            slug: '/search',
            type: 'search',
            title: 'Search',
            published: true,
            // Max home page direct kids on one site: 1 million. Max special
            // purpose admin pages: 999. That ought to be enough for
            // anybody... I hope!
            rank: 1000998
        }, callback);
      } else {
        console.log('We already have one');
      }
      return callback(null);
    });
  };

  self.tasks.dropTestData = function(callback) {
    console.log('Dropping all test data.');
    return self.pages.remove({ testData: true }, callback);
  };

  // INTEGRATING LOGINS WITH APPY
  //
  // Pass the result of a call to this method as the `auth` option to appy to allow people
  // (as managed via the "people" module) to log in as long as they have the "login" box checked.
  //
  // You must pass your instance of the `pages` module as the `pages` option so that the login
  // dialog can be presented.
  //
  // If the `adminPassword` option is set then an admin user is automatically provided
  // regardless of what is in the database, with the password set as specified.

  self.appyAuth = function(options, user) {
    var users = {};
    if (options.adminPassword) {
      users.admin = {
        type: 'person',
        username: 'admin',
        password: options.adminPassword,
        firstName: 'Ad',
        lastName: 'Min',
        title: 'Admin',
        _id: 'admin',
        // Without this login is forbidden
        login: true,
        permissions: { admin: true }
      };
    }
    return {
      strategy: 'local',
      options: {
        users: users,
        // A user is just a snippet page with username and password properties.
        // (Yes, the password property is hashed and salted.)
        collection: 'aposPages',
        // Render the login page
        template: options.loginPage,
        // Set the redirect for after login passing req.user from Appy l.~208
        redirect: function(user){
          if (options.redirect) {
            return options.redirect(user);
          } else {
            // This feels like overkill, because we're checking in Appy as well.
            return '/';
          }
        },
        verify: function(password, hash) {
          if (hash.match(/^a15/)) {
            // bc with Apostrophe 1.5 hashed passwords. The salt is
            // implemented differently, it's just prepended to the
            // password before hashing. Whatever createHmac is doing
            // in the password-hash module, it's not that. Fortunately
            // it isn't hard to do directly
            var components = hash.split(/\$/);
            if (components.length !== 3) {
              return false;
            }
            // Allow for a variety of algorithms coming over from A1.5
            var hashType = components[0].substr(3);
            var salt = components[1];
            var hashed = components[2];
            try {
              var shasum = crypto.createHash(hashType);
              shasum.update(salt + password);
              var digest = shasum.digest('hex');
              return (digest === hashed);
            } catch (e) {
              console.log(e);
              return false;
            }
          } else {
            return passwordHash.verify(password, hash);
          }
        }
      }
    };
  };

  // Pass this function to appy as the `beforeSignin` option to check for login privileges,
  // then apply the user's permissions obtained via group membership before
  // completing the login process

  self.appyBeforeSignin = function(user, callback) {
    if (user.type !== 'person') {
      // Whaaat the dickens this object is not even a person
      return callback('error');
    }
    if (!user.login) {
      return callback({ message: 'user does not have login privileges' });
    } else {
      user.permissions = user.permissions || {};
      self.pages.find({ type: 'group', _id: { $in: user.groupIds || [] } }).toArray(function(err, groups) {
        if (err) {
          console.log(err);
          return callback(err);
        }
        user._groups = groups;
        _.each(groups, function(group) {
          _.each(group.permissions || [], function(permission) {
            if (!_.contains(user.permissions, permission)) {
              user.permissions[permission] = true;
            }
          });
        });
        // The standard permissions are progressive
        if (user.permissions.admin) {
          user.permissions.edit = true;
        }
        if (user.permissions.edit) {
          user.permissions.guest = true;
        }
        return callback(null);
      });
    }
  };
}

// Required because EventEmitter is built on prototypal inheritance,
// calling the constructor is not enough
require('util').inherits(Apos, require('events').EventEmitter);

module.exports = function() {
  return new Apos();
};

