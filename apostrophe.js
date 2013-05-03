/* jshint undef: true */
var oembed = require('oembed');
var request = require('request');
var async = require('async');
var sanitize = require('validator').sanitize;
var fs = require('fs');
var _ = require('underscore');
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

// MongoDB prefix queries are painful without this
RegExp.quote = require("regexp-quote");

function Apos() {
  var self = this;

  // Apostrophe is an event emitter/receiver
  require('events').EventEmitter.call(self);

  var app, files, areas, versions, pages, uploadfs, nunjucksEnv, db, aposLocals;

  // Helper functions first to please jshint

  // Something we can export via app.locals etc.
  function partial(name, data, dir) {
    return self.partial(name, data, dir);
  }

  // Render views specific to this module

  function render(res, template, info) {
    return res.send(partial(template, info));
  }

  function fail(req, res) {
    res.statusCode = 500;
    res.send('500 error, URL was ' + req.url);
  }

  function forbid(res) {
    res.statusCode = 403;
    res.send('Forbidden');
  }

  function notfound(req, res) {
    res.statusCode = 404;
    res.send('404 not found error, URL was ' + req.url);
  }

  function generateId() {
    // TODO use something better, although this is not meant to be
    // cryptographically secure
    return Math.floor(Math.random() * 1000000000) + '' + Math.floor(Math.random() * 1000000000);
  }

  // This is our standard set of controls. If you add a new widget you'll be
  // adding that to self.itemTypes (with widget: true) and to this list of
  // default controls - or not, if you think your widget shouldn't be available
  // unless explicitly specified in a aposArea call. If your project should *not*
  // offer a particular control, ever, you can remove it from this list
  // programmatically

  self.defaultControls = [ 'style', 'bold', 'italic', 'createLink', 'insertUnorderedList', 'slideshow', 'buttons', 'video', 'files', 'pullquote', 'code', 'html' ];

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
      label: 'b',
      icon: 'bold'
    },
    italic: {
      type: 'button',
      label: 'i',
      icon: 'italic'
    },
    createLink: {
      type: 'button',
      label: 'Link',
      icon: 'link'
    },
    insertUnorderedList: {
      type: 'button',
      label: 'List',
      icon: 'ul'
    }
  };

  // Default stylesheet requirements
  // TODO: lots of override options
  var stylesheets = [
    // Has a subdirectory of relative image paths so give it a folder
    "jquery-ui-darkness/jquery-ui-darkness",
    "content",
    "editor"
  ];

  // Default browser side script requirements
  // TODO: lots of override options
  var scripts = [
    // VENDOR DEPENDENCIES

    // Makes broken browsers usable
    'vendor/underscore-min',
    // For everything
    'vendor/jquery',
    // For parsing query parameters browser-side
    'vendor/jquery-url-parser',
    // For blueimp uploader, drag and drop reordering of anything, datepicker
    // & autocomplete
    'vendor/jquery-ui',
    // For the RTE
    'vendor/jquery-hotkeys',
    // For selections in the RTE
    'vendor/rangy-core',
    'vendor/rangy-selectionsaverestore',
    // For selections in ordinary textareas and inputs (part of Rangy)
    'vendor/jquery-textinputs',
    // Graceful fallback for older browsers
    'vendor/blueimp-iframe-transport',
    // Spiffy multiple file upload
    'vendor/blueimp-fileupload',
    // imaging cropping plugin
    'vendor/jquery.Jcrop.min',

    // OUR CODE

    // Editing functionality
    'editor',
    // Viewers for standard content types
    'content',
  ];

  // Templates pulled into the page by the aposTemplates() Express local
  // These are typically hidden at first by CSS and cloned as needed by jQuery

  var templates = [
    'slideshowEditor', 'buttonsEditor', 'filesEditor', 'pullquoteEditor', 'videoEditor', 'codeEditor', 'htmlEditor', 'cropEditor'
  ];

  // Full paths to assets as computed by pushAsset
  self._assets = { stylesheets: [], scripts: [], templates: [] };

  // self.pushAsset('stylesheet', 'foo', __dirname, '/apos-mymodule') will preload
  // /apos-mymodule/css/foo.css

  // self.pushAsset('script', 'foo', __dirname, '/apos-mymodule') will preload
  // /apos-mymodule/js/foo.js

  // self.pushAsset('template', 'foo', __dirname, '/apos-mymodule') will render
  // the partial {__dirname}/views/foo.html at the bottom of the body
  // (self.partial will take care of adding the extension). However you can also
  // use:
  //
  // self.pushAsset('template', function() { foo })
  //
  // Which allows you to render the template in your own context and is typically
  // the easier way when pushing a template from a module like apostrophe-snippets.
  //
  // The fs and web parameters default to __dirname and '/apos' for easy use here.
  // Other modules typically have a wrapper method that passes them correctly
  // for their needs.
  //
  // You should pass BOTH fs and web for a stylesheet or script. This allows
  // minification, LESS compilation that is aware of relative base paths, etc.
  // fs should be the PARENT of the public folder, not the public folder itself.

  self.pushAsset = function(type, name, fs, web) {
    // Careful with the defaults on this, '' is not false for this purpose
    if (typeof(fs) !== 'string') {
      fs = __dirname;
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
      return self._assets[types[type].key].push(name);
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
    self._assets[types[type].key].push({ file: filePath, web: webPath });
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

    uploadfs = options.uploadfs;
    self.permissions = options.permissions;

    // An id for this particular process that should be unique
    // even in a multiple server environment
    self._pid = generateId();

    aposLocals = {};

    if (options.locals) {
      _.extend(aposLocals, options.locals);
    }

    function setupPages(callback) {
      db.collection('aposPages', function(err, collection) {
        function indexSlug(callback) {
          self.pages.ensureIndex({ slug: 1 }, { safe: true, unique: true }, callback);
        }
        self.pages = pages = collection;
        async.series([indexSlug], callback);
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
      db.collection('aposVersions', function(err, collection) {
        function index(callback) {
          self.versions.ensureIndex({ pageId: 1, createdAt: -1 }, { safe: true }, callback);
        }
        self.versions = versions = collection;
        async.series([index], callback);
        // ... more index functions
      });
    }

    function setupFiles(callback) {
      db.collection('aposFiles', function(err, collection) {
        self.files = files = collection;
        return callback(err);
      });
    }

    function setupRedirects(callback) {
      db.collection('aposRedirects', function(err, collection) {
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

      // Default is to allow anyone to do anything.
      // You will probably want to at least check for req.user.
      // Possible actions are edit-area and edit-media.
      // edit-area calls will include a slug as the third parameter.
      // edit-media calls for existing files may include a file, with an
      // "owner" property set to the id or username property of req.user
      // at the time the file was last edited. edit-media calls with
      // no existing file parameter also occur, for new file uploads.
      if (!self.permissions) {
        self.permissions = function(req, action, fileOrSlug, callback) {
          return callback(null);
        };
      }

      // aposTemplates renders templates that are needed on any page that will
      // use apos. Examples: slideshowEditor.html, codeEditor.html,
      // etc. These lie dormant in the page until they are needed as prototypes to
      // be cloned by jQuery

      aposLocals.aposTemplates = function() {
        var templates = self._assets['templates'];
        return _.map(templates, function(template) {
          if (typeof(template) === 'function') {
            return template();
          } else {
            return partial(template.file);
          }
        }).join('');
      };

      aposLocals.aposArea = function(options) {
        if (!options.controls) {
          options.controls = self.defaultControls;
        }
        var area = options.area;
        delete options.area;
        if (!area) {
          // Invent the area if it doesn't exist yet, so we can
          // edit pages not previously edited
          area = { items: [] };
        }
        // Keep options and area separate, area is much too big to stuff into
        // the options attribute of every area element, whoops
        return partial('area', { options: options, area: area });
      };

      aposLocals.aposSingleton = function(options) {
        if (!self.itemTypes[options.type]) {
          console.log("Unknown item type: " + options.type);
          return;
        }
        // If someone transforms an existing area into a singleton, do a reasonable thing by
        // taking the first existing item of the proper type
        var item = _.find(options.area.items, function(item) {
          return item.type === options.type;
        });
        options.itemType = self.itemTypes[options.type];
        options.item = item;
        if (options.item) {
          options.item.position = 'middle';
          options.item.size = 'full';
        }
        // Options to pass on to the widget
        options.options = _.omit(options, 'area', 'item', 'slug', 'type');

        return partial('singleton', options);
      };

      aposLocals.aposAreaIsEmpty = function(options) {
        if (!options.area) {
          return true;
        }
        return !_.some(options.area.items, function(item) {
          if (self.itemTypes[item.type] && self.itemTypes[item.type].empty) {
            return !self.itemTypes[item.type].empty(item);
          } else {
            return true;
          }
        });
      };

      aposLocals.aposSingletonIsEmpty = function(options) {
        return !_.some(options.area.items, function(item) {
          return item.type === options.type;
        });
      };

      aposLocals.aposAreaContent = function(items, options) {
        var result = '';
        _.each(items, function(item) {
          var itemOptions = options ? options[item.type] : undefined;
          result += aposLocals.aposItemNormalView(item, itemOptions).trim();
        });
        return result;
      };

      aposLocals.aposItemNormalView = function(item, options) {
        if (!options) {
          options = {};
        }
        if (!self.itemTypes[item.type]) {
          console.log("Unknown item type: " + item.type);
          return;
        }
        var itemType = self.itemTypes[item.type];
        options.widget = itemType.widget;

        if (options.bodyOnly) {
          options.widget = false;
        }

        // The content property doesn't belong in a data attribute,
        // and neither does any property beginning with an _
        var attributes = {};
        _.each(item, function(value, key) {
          if ((key === 'content') || (key.substr(0, 1) === '_')) {
            return;
          }
          attributes[key] = value;
        });
        return partial('itemNormalView', { item: item, itemType: itemType, options: options, attributes: attributes });
      };

      aposLocals.aposStylesheets = function() {
        if (options.minify) {
          return '<link href="/apos/stylesheets.css?pid=' + self._pid + '" rel="stylesheet" />';
        } else {
          return _.map(self._assets['stylesheets'], function(stylesheet) {
            return '<link href="' + stylesheet.web + '" rel="stylesheet" />';
          }).join("\n");
        }
      };

      aposLocals.aposScripts = function() {
        if (options.minify) {
          return '<script src="/apos/scripts.js?pid=' + self._pid + '"></script>\n';
        } else {
          return _.map(self._assets['scripts'], function(script) {
            return '<script src="' + script.web + '"></script>';
          }).join("\n");
        }
      };

      // Keep in sync with browser side implementation in content.js
      aposLocals.aposFilePath = function(file, options) {
        options = options || {};
        var path = uploadfs.getUrl() + '/files/' + file._id + '-' + file.name;
        if (file.crop) {
          var c = file.crop;
          path += '.' + c.left + '.' + c.top + '.' + c.width + '.' + c.height;
        }
        if (options.size) {
          path += '.' + options.size;
        }
        return path + '.' + file.extension;
      };

      aposLocals.aposLog = function(m) {
        console.log(m);
        return '';
      };

      aposLocals.aposGenerateId = function() {
        return generateId();
      };

      // In addition to making these available in app.locals we also
      // make them available in our own partials later.
      _.extend(app.locals, aposLocals);

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
      // apos.pushGlobalCall('my.browserSide.method(?, ?)', arg1, arg2, ...)
      //
      // Which pushes a call that will be included EVERY TIME
      // apos.globalCalls is invoked. This is NOT specific
      // to a single request and should be used for global client-side
      // configuration needed at all times. The pages module automatically
      // passes this code as the 'globalCalls' property of the data object given
      // to the page template.

      app.request.pushCall = function(pattern) {
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

      self._globalCalls = [];

      // Just like req.pushCall except there is one global list, to be
      // used every time self.playGlobalCalls is invoked. NOT limited
      // to the lifetime of a single request. Use this only for global
      // initialization of the browser-side environment.

      self.pushGlobalCall = function(pattern) {
        // Turn arguments into a real array https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Functions_and_function_scope/arguments
        var args = Array.prototype.slice.call(arguments);
        self._globalCalls.push({ pattern: pattern, arguments: args.slice(1) });
      };

      self.getGlobalCalls = function() {
        var s = self._getCalls(self._globalCalls || []);
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

      // Pass data to JavaScript on the browser side. We extend the app.request template
      // so that req.pushData() is a valid call.
      //
      // req.pushData() expects an object. The properties of this object are
      // merged recursively with the browser side apos.data object, using the
      // jQuery extend() method. You can make many calls, merging in more data,
      // and unspool them all
      // as a block of valid browser-ready javascript by invoking apos.getData(req).
      // The pages module automatically does this and makes that code available
      // to the page template as the `data` property.

      app.request.pushData = function(datum) {
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
        aposLocals[name] = fn;
        app.locals[name] = fn;
      };

      // All routes must begin with /apos!

      // Upload files
      app.post('/apos/upload-files', function(req, res) {
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
            _id: generateId(),
            length: file.length,
            group: group.name,
            createdAt: new Date(),
            name: self.slugify(path.basename(file.name, path.extname(file.name))),
            extension: extension
          };

          function permissions(callback) {
            self.permissions(req, 'edit-media', null, callback);
          }

          function upload(callback) {
            if (image) {
              // For images we correct automatically for common file extension mistakes
              return uploadfs.copyImageIn(file.path, '/files/' + info._id + '-' + info.name, function(err, result) {
                if (err) {
                  return callback(err);
                }
                info.extension = result.extension;
                info.width = result.width;
                info.height = result.height;
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
              return uploadfs.copyIn(file.path, '/files/' + info._id + '-' + info.name + '.' + info.extension, callback);
            }
          }

          function db(callback) {
            files.insert(info, { safe: true }, function(err, docs) {
              if (!err) {
                infos.push(docs[0]);
              }
              return callback(err);
            });
          }

          async.series([ permissions, upload, db ], callback);

        }, function(err) {
          return res.send({ files: infos, status: 'ok' });
        });
      });

      // Crop a previously uploaded image. This uploads a new, cropped version of
      // it to uploadfs, named /files/ID-NAME.top.left.width.height.extension
      app.post('/apos/crop', function(req, res) {
        var _id = req.body._id;
        var crop = req.body.crop;
        var file;
        async.series([
          function(callback) {
            return self.permissions(req, 'edit-media', null, callback);
          },
          function(callback) {
            files.findOne({ _id: _id }, function(err, fileArg) {
              file = fileArg;
              return callback(err);
            });
          }
        ], function(err) {
          if (!file) {
            return fail();
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
          var tempFile = uploadfs.getTempPath() + '/' + generateId() + '.' + file.extension;
          var croppedFile = '/files/' + file._id + '-' + file.name + '.' + crop.left + '.' + crop.top + '.' + crop.width + '.' + crop.height + '.' + file.extension;

          async.series([
            function(callback) {
              uploadfs.copyOut(originalFile, tempFile, callback);
            },
            function(callback) {
              uploadfs.copyImageIn(tempFile, croppedFile, { crop: crop }, callback);
            },
            function(callback) {
              file.crops.push(crop);
              files.update({ _id: file._id }, file, callback);
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

      // Render an area editor ready to edit the area specified by
      // req.query.slug.

      app.get('/apos/edit-area', function(req, res) {
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

        function permissions(callback) {
          if (!slug) {
            return callback(null);
          }
          self.permissions(req, 'edit-area', slug, function(err) {
            if (err) {
              return forbid(res);
            }
            var isNew = false;
            if (!slug) {
              return notfound(req, res);
            } else {
              return callback(null);
            }
          });
        }

        function getArea(callback) {
          self.getArea(req, slug, function(err, areaArg) {
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
          area.wid = 'w-' + generateId();
          area.controls = controls;
          area.controlTypes = self.controlTypes;
          area.itemTypes = self.itemTypes;
          area.standalone = true;
          area.editView = true;
          area.options = options;
          return render(res, 'editArea', area);
        }

        async.series([ permissions, getArea ], sendArea);

      });

      // Render an editor for a virtual area with the content
      // specified as a JSON array of items by the req.body.content
      // property, if any. For use when you are supplying your own storage
      // (for instance, the blog module uses this to render
      // an area editor for the content of a post).

      app.post('/apos/edit-virtual-area', function(req, res) {
        var content = req.body.content ? JSON.parse(req.body.content) : [];
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
        area.wid = 'w-' + generateId();
        area.controls = controls;
        area.controlTypes = self.controlTypes;
        area.itemTypes = self.itemTypes;
        // TODO: accept JSON options in this method as we do in regular edit-area
        area.options = {};
        return render(res, 'editArea', area);
      });

      // Render an editor for a virtual area with the content
      // specified as a JSON array of items by the req.body.content
      // property, if any (there will be 0 or 1 elements, any further
      // elements are ignored). For use when you are supplying your own storage
      // (for instance, the blog module uses this to render
      // a singleton thumbnail edit button for a post).

      app.post('/apos/edit-virtual-singleton', function(req, res) {
        var options = {};
        var content = req.body.content ? JSON.parse(req.body.content) : [];
        self.sanitizeItems(content);
        var area = {
          items: content
        };
        var type = req.body.type;
        // A temporary id for the duration of the editing activity, useful
        // in the DOM. Regular areas are permanently identified by their slugs,
        // not their IDs. Virtual areas are identified as the implementation sees fit.
        area.wid = 'w-' + generateId();
        extend(options, _.omit(req.body, 'content', 'type'), true);
        options.type = type;
        options.area = area;
        options.edit = true;
        return res.send(aposLocals.aposSingleton(options));
      });

      app.post('/apos/edit-area', function(req, res) {
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
            return notfound(req, res);
          }

          return self.callLoadersForArea(req, area, function() {
            return res.send(aposLocals.aposAreaContent(area.items));
          });
        }
      });

      app.post('/apos/edit-singleton', function(req, res) {
        var slug = req.body.slug;
        var content = JSON.parse(req.body.content);
        // "OMG, what if they cheat and use a type not allowed for this singleton?"
        // When they refresh the page they will discover they can't see their hack.
        // aposSingleton only shows the first item of the specified type, regardless
        // of what is kicking around in the area.
        var type = content.type;
        var itemType = self.itemTypes[type];
        if (!itemType) {
          return fail(req, res);
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
            return notfound(req, res);
          }

          return self.callLoadersForArea(req, area, function() {
            return res.send(aposLocals.aposAreaContent(area.items));
          });
        });
      });

      // Used to render newly created, as yet unsaved widgets to be displayed in
      // the main apos editor. We're not really changing anything in the database
      // here. We're just allowing the browser to leverage the same normal view
      // generator that the server uses for actual page rendering. Renders the
      // body of the widget only since the widget div has already been updated
      // or created in the browser.

      app.post('/apos/render-widget', function(req, res) {
        var item = req.body;
        var options = req.query;

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
          return res.send(aposLocals.aposItemNormalView(item, options));
        }

        if ((options.load !== '0') && (itemType.load)) {
          return itemType.load(req, item, go);
        } else {
          return go();
        }
      });

      // A simple oembed proxy to avoid cross-site scripting restrictions.
      // Includes bare-bones caching to avoid hitting rate limits.
      // TODO: expiration for caching.
      // TODO: whitelist to avoid accepting oembed from evil XSS sites.

      var oembedCache = {};

      app.get('/apos/oembed', function(req, res) {
        if (oembedCache[req.query.url]) {
          return res.send(oembedCache[req.query.url]);
        }
        oembed.fetch(req.query.url, {}, function (err, result) {
          if (err) {
            return res.send({ 'err': err });
          } else {
            oembedCache[req.query.url] = result;
            return res.send(result);
          }
        });
      });

      // Serve minified CSS. (If we're not minifying, aposStylesheets won't
      // point here at all.)
      app.get('/apos/stylesheets.css', function(req, res) {
        if (self._minifiedCss === undefined) {
          var css = _.map(self._assets['stylesheets'], function(stylesheet) {
            var result;
            var src = stylesheet.file;
            var exists = false;
            if (fs.existsSync(src)) {
              exists = true;
            }
            if (!exists) {
              var lessPath = src.replace(/\.css$/, '.less');
              if (fs.existsSync(lessPath)) {
                src = lessPath;
                exists = true;
              }
            }
            if (!exists) {
              console.log('WARNING: stylesheet ' + stylesheet.file + ' does not exist');
              return;
            }
            // We run ALL CSS through the LESS compiler, because
            // it fixes relative paths for us so that a combined file
            // will still have valid paths to background images etc.
            less.render(fs.readFileSync(src, 'utf8'),
            {
              rootpath: path.dirname(stylesheet.web) + '/',
              // Without this relative import paths are in trouble
              paths: [ path.dirname(src) ],
              // Ensures the callback is invoked immediately.
              // Note we only do this once in production.
              syncImport: true
            }, function(err, css) {
              if (!err) {
                result = css;
              }
            });
            if (result === undefined) {
              throw "lessjs has gone asynchronous on us. That should not have happened. See: https://github.com/fson/less.js/commit/e21ddb74de6017cbce7a9cf1f3406697b98774ec";
            }
            return result;
          }).join("\n");
          self._minifiedCss = cleanCss.process(css);
        }
        res.type('text/css');
        res.send(self._minifiedCss);
      });

      // Serve minified js. (If we're not minifying, aposScripts won't
      // point here at all.)
      app.get('/apos/scripts.js', function(req, res) {
        if (self._minifiedJs === undefined) {
          // Minify them all!
          var scripts = _.filter(self._assets['scripts'], function(script) {
            var exists = fs.existsSync(script.file);
            if (!exists) {
              console.log("Warning: " + script.file + " does not exist");
            }
            return exists;
          });
          self._minifiedJs = uglifyJs.minify(_.map(scripts, function(script) { return script.file; })).code;
        }
        res.contentType = 'text/javascript';
        res.send(self._minifiedJs);
      });

      app.get('/apos/*', self.static(__dirname + '/public'));

      // app.use('/apos', express.static(__dirname + '/public'));

      // Middleware
      function validId(req, res, next) {
        var id = req.params.id;
        if (!id.match(/^[\w\-\d]+$/)) {
          return fail(req, res);
        }
        next();
      }

      if (uploadfs) {
        self.pushGlobalData({
          uploadsUrl: uploadfs.getUrl()
        });
      }

      return callback(null);
    }

    self.options = options;

    app = options.app;

    self.db = db = options.db;

    async.series([setupPages, setupVersions, setupFiles, setupRedirects, afterDb], callback);
  };

  // self.static returns a function for use as a route that
  // serves static files from a folder. This is helpful when writing
  // your own modules that extend apos and need to serve their own static
  // assets:
  //
  // app.get('/apos-twitter/*', apos.static(__dirname + '/public'))
  //
  // Because self.static is suitable for use as a route rather
  // than as global middleware, it is easier to set it up for many
  // separate modules.

  var lessMiddlewares = {};

  self.static = function(dir) {
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
  // A 'req' object is needed to provide a context for permissions in custom
  // widget loaders, and for caching for the duration of the current request.
  // However this need not be a real Express 'req' object. Note that permissions
  // are NOT checked on the page itself here. You should perform such checks before
  // invoking this method.
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
  // Slugs of the latter type are an efficient way to store related areas
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
    pages.findOne({ slug: pageSlug }, projection, function (err, page) {
      if (err) {
        return callback(err);
      }
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

  // putArea stores an area in a "page." We put "page" in quotes here
  // because it is only a page in the narrowest sense: a mongodb document
  // with a slug, containing one or more named areas, and open to the storage of
  // other properties as well.
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
  // If a page does not exist this method will create it. You should
  // NOT rely on this for pages that have a type property, including any
  // page in the page tree, a snippet, etc. Such pages should be created
  // first with putPage before they are used. It is convenient, however, for
  // simple virtual pages used to hold things like a global footer area.
  //
  // A copy of the page is inserted into the versions collection.
  //
  // The req argument is required for permissions checking. The
  // edit-page permission is checked on the page slug.

  self.putArea = function(req, slug, area, callback) {
    var pageOrSlug;

    var matches = slug.match(/^(.*?)\:(\w+)$/);
    if (!matches) {
      return callback('Area slugs now must be page-based: page-slug:areaname');
    }
    var pageSlug = matches[1];
    var areaSlug = matches[2];

    function permissions(callback) {
      self.permissions(req, 'edit-page', pageSlug, callback);
    }

    function update(callback) {
      area.slug = slug;
      var set = {};
      set.slug = pageSlug;
      // Use MongoDB's dot notation to update just the area in question
      set['areas.' + areaSlug] = area;
      pages.update(
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
              id: generateId(),
              slug: pageSlug,
              areas: {}
            };
            page.areas[areaSlug] = area;
            return pages.insert(page, { safe: true }, function(err, page) {
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
  // A copy of the page is inserted into the versions collection.

  self.putPage = function(req, slug, page, callback) {
    if (!page.slug) {
      page.slug = slug;
    }
    if (!page._id) {
      page._id = generateId();
    }

    // Provide the object rather than the slug since we have it and we can
    // avoid extra queries that way and also do meaningful permissions checks
    // on new pages
    function permissions(callback) {
      self.permissions(req, 'edit-page', page, callback);
    }

    function update(callback) {
      self.pages.update({ slug: slug }, page, { upsert: true, safe: true },
        function(err) {
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
            // Retry must use the OLD slug or it will just keep hitting dupe errors
            return self.putPage(req, slug, page, callback);
          }
          return callback(err);
        }
      );
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
    async.series([permissions, update, versioning, indexing], finish);
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
      versions.find({
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
      // Turn the page object we fetched into a version object
      var version = page;
      version.createdAt = new Date();
      version.pageId = version._id;
      version.author = (req && req.user && req.user.username) ? req.user.username : 'unknown';
      version._id = generateId();
      delete version.searchText;
      if (!prior) {
        version.diff = [ { value: '[NEW]', added: true } ];
      } else {
        version.diff = self.diffPages(prior, version);
      }
      return versions.insert(version, callback);
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
          return pages.findOne({ slug: pageOrSlug }, callback);
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
      return pages.update({ slug: page.slug }, { $set: { highSearchText: highText, lowSearchText: lowText, searchSummary: searchSummary } }, callback);
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

  // Fetch the "page" with the specified slug. As far as
  // apos is concerned, the "page" with the slug /about
  // is expected to be an object with a .areas property. If areas
  // with the slugs /about:main and /about:sidebar have
  // been saved, then the areas property will be an
  // object with properties named main and sidebar.
  //
  // A 'req' object is needed to provide a context for permissions in custom
  // widget loaders, and for caching for the duration of the current request.
  // However this need not be a real Express 'req' object. Note that permissions
  // are NOT checked on the page itself here. You should perform such checks before
  // invoking this method.
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

  self.getPage = function(req, slug, callback) {
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

    // Ordering in reverse order by slug gives us the longest match first
    pages.find({
      $or: orClauses,
      // This method never returns pages from the trash
      trash: { $exists: false }
    }).sort({ slug: -1 }).limit(1).toArray(function(err, pages) {
      if (pages.length) {
        var page = pages[0];
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
        self.callLoadersForPage(req, bestPage, function(err) {
          return callback(err, page, bestPage, remainder);
        });
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
        return pages.findOne({ slug: pageOrSlug }, callback);
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

  self.callLoadersForPage = function(req, page, callback) {
    // Call loaders for all areas in a page. Wow, async.map is awesome.
    async.map(
      _.values(page.areas),
      function(area, callback) {
        return self.callLoadersForArea(req, area, callback);
      }, function(err, results) {
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

    // Make sure the apos-specific locals are visible to partials too.
    // If we import ALL the locals we'll point at the wrong views directory
    // and generally require the developer to worry about not breaking
    // our partials, which ought to be a black box they can ignore.

    _.defaults(data, aposLocals);

    if (typeof(data.partial) === 'undefined') {
      data.partial = partial;
    }

    if (!dirs) {
      dirs = [];
    }

    if (!Array.isArray(dirs)) {
      dirs = [ dirs ];
    }

    dirs = dirs.concat(self.options.partialPaths || []);

    // The apostrophe module's views directory is always the last
    // thing tried, so that you can extend the widgetEditor template, etc.
    dirs = dirs.concat([ __dirname + '/views' ]);

    var dirsKey = dirs.join(':');
    if (!nunjucksEnvs[dirsKey]) {
      nunjucksEnvs[dirsKey] = self.newNunjucksEnv(dirs);
    }

    return nunjucksEnvs[dirsKey].getTemplate(name + '.html').render(data);
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

  self.itemTypes = {
    richText: {
      markup: true,
      sanitize: function(item) {
        // This is just a down payment, we should be throwing out unwanted
        // tags attributes and properties as A1.5 does
        item.content = sanitize(item.content).xss().trim();
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
      render: function(data) {
        return partial('slideshow', data);
      },
      addDiffLines: function(item, lines) {
        var items = item.items || [];
        _.each(items, function(item) {
          lines.push('image: ' + item.name);
        });
      },
      addSearchTexts: function(item, texts) {
        var items = item.items || [];
        _.each(items, function(item) {
          texts.push({ weight: 1, text: item.name });
        });
      },
      empty: function(item) {
        return !((item.items || []).length);
      },
      css: 'slideshow'
    },
    buttons: {
      widget: true,
      label: 'Button(s)',
      icon: 'button',
      // icon: 'slideshow',
      render: function(data) {
        return partial('buttons', data);
      },
      empty: function(item) {
        return !((item.items || []).length);
      },
      css: 'buttons'
    },
    files: {
      widget: true,
      label: 'Files',
      icon: 'file',
      render: function(data) {
        var val = partial('files', data);
        return val;
      },
      addSearchTexts: function(item, texts) {
        var items = item.items || [];
        _.each(items, function(item) {
          texts.push({ weight: 1, text: item.name });
        });
      },
      empty: function(item) {
        return !((item.items || []).length);
      },
      css: 'files'
    },
    video: {
      widget: true,
      label: 'Video',
      icon: 'video',
      render: function(data) {
        return partial('video', data);
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
        return partial('html', data);
      }
    }
  };

  self.newNunjucksEnv = function(dirs) {

    nunjucksEnv = new nunjucks.Environment(new nunjucks.FileSystemLoader(dirs));

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

    nunjucksEnv.addFilter('nlbr', function(data) {
      data = globalReplace(data, "\n", "<br />\n");
      return data;
    });

    nunjucksEnv.addFilter('css', function(data) {
      return self.cssName(data);
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

  self.escapeHtml = function(s) {
    if (s === 'undefined') {
      s = '';
    }
    if (typeof(s) !== 'string') {
      s = s + '';
    }
    return s.replace(/\&/g, '&amp;').replace(/</g, '&lt;').replace(/\>/g, '&gt;').replace(/\"/g, '&quot;');
  };

  self.htmlToPlaintext = function(html) {
    return ent.decode(html.replace(/<.*?\>/g, "\n"));
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
  // Convert a name to camel case. Only digits and ASCII letters remain.
  // Anything that isn't a digit or an ASCII letter prompts the next character
  // to be uppercase. Useful in converting CSV with friendly headings into
  // sensible property names
  self.camelName = function(s) {
    var i;
    var n = '';
    var nextUp = false;
    for (i = 0; (i < s.length); i++) {
      var c = s.charAt(i);
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

  var taskFailed = false;

  // Call if the final exit status should not be 0 (something didn't work, and you want
  // shell scripts invoking this command line task to be able to tell)
  self.taskFailed = function() {
    taskFailed = true;
  };

  self.startTask = function() {
    if (!argv._.length) {
      return false;
    }
    var matches = argv._[0].match(/^apostrophe:(.*)$/);
    if (!matches) {
      return false;
    }
    var cmd = matches[1];
    if (_.has(self.tasks, cmd)) {
      self.emit('task:' + argv._[0] + ':before');
      self.tasks[cmd](function(err) {
        if (err) {
          console.log('Command line task failed:');
          console.log(err);
          process.exit(1);
        }
        self.emit('task:' + argv._[0] + ':after');
        // Exit when no listeners are busy. Both before and after listeners
        // need to call apos.taskBusy() and apos.taskDone() to signify that
        // they are going to do more work asynchronously and when they complete that work.
        setInterval(function() {
          if (!taskActive) {
            process.exit(taskFailed ? 1 : 0);
          }
        }, 10);
        // *Don't* exit. We want to allow things initiated by trigger
        // to finish. Node will exit for us when the event queue is empty
      });
      return true;
    } else {
      console.error('There is no such Apostrophe task. Available tasks:');
      console.error();
      var tasks = _.keys(self.tasks);
      tasks.sort();
      _.each(tasks, function(task) {
        console.error('apostrophe:' + task);
      });
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

  self.forEveryPage = function(criteria, each, callback) {
    return self.forEveryItemInCollection(self.pages, criteria, each, callback);
  };

  self.forEveryFile = function(criteria, each, callback) {
    return self.forEveryItemInCollection(self.files, criteria, each, callback);
  };

  self.forEveryItemInCollection = function(collection, criteria, each, callback) {
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
    function fixEventEnd(callback) {
      // ISSUE: 'end' was meant to be a Date object matching
      // end_date and end_time, for sorting and output purposes, but it
      // contained start_time instead. Fortunately end_date and end_time are
      // authoritative so we can just rebuild it
      self.forEveryPage({ type: 'event' }, function(event, callback) {
        if (event.endTime) {
          event.end = new Date(event.endDate + ' ' + event.endTime);
        } else {
          event.end = new Date(event.endDate);
        }
        self.pages.update({ _id: event._id }, { $set: { end: event.end }}, function(err, count) {
          return callback(err);
        });
      }, function(err) {
        return callback(err);
      });
    }

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
            rank: 9999,
            trash: true,
          }, null);
        }
        return callback(null);
      });
    }

    function spacesInSortTitle(callback) {
      self.forEveryPage({ sortTitle: /\-/ },
        function(page, callback) {
          return self.pages.update(
            { _id: page._id },
            { $set: { sortTitle: page.sortTitle.replace(/\-/g, ' ') } },
            callback);
        },
        callback);
    }

    // Early versions of Apostrophe didn't clean up their Unicode word joiner characters
    // on save. These were present to prevent (Mac?) Chrome from selecting only half the widget
    // when copying and pasting. To make matters worse, in Windows Chrome they turn out to
    // show up as "I don't have this in my font" boxes. New versions use the 65279
    // "zero-width non-break space" character, which is invisible on both platforms. And
    // in addition they filter it out on save. Filter it out for existing pages on migrate.
    function removeWidgetSaversOnSave(callback) {
      var used = false;
      self.forEveryPage({},
        function(page, callback) {
          var modified = false;
          _.each(page.areas || [], function(area, name) {
            _.each(area.items, function(item) {
              if ((item.type === 'richText') && (item.content.indexOf(String.fromCharCode(8288)) !== -1)) {
                if (!modified) {
                  modified = true;
                  if (!used) {
                    used = true;
                    console.log('Removing widget-saver unicode characters');
                  }
                }
                item.content = globalReplace(item.content, String.fromCharCode(8288), '');
              }
            });
          });
          if (modified) {
            return self.pages.update({ _id: page._id }, page, callback);
          } else {
            return callback(null);
          }
        }, callback
      );
    }

    function explodePublishedAt(callback) {
      // the publishedAt property of articles must also be available in
      // the form of two more easily edited fields, publicationDate and
      // publicationTime
      var used = false;
      self.forEveryPage({ type: 'blogPost' }, function(page, callback) {
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

    async.series([fixEventEnd, addTrash, spacesInSortTitle, removeWidgetSaversOnSave, explodePublishedAt], callback);
  };

  self.tasks.index = function(callback) {
    console.log('Indexing all pages for search');
    self.forEveryPage({},
      function(page, callback) {
        return self.indexPage({}, page, callback);
      }, callback);
  };

  self.tasks.rescale = function(callback) {
    console.log('Rescaling all images with latest uploadfs settings');
    self.files.count(function(err, total) {
      if (err) {
        return callback(err);
      }
      var n = 0;
      self.forEveryFile({},
        function(file, callback) {
          if (!_.contains(['jpg', 'png', 'gif'], file.extension)) {
            n++;
            console.log('Skipping a non-image file: ' + file.name + '.' + file.extension);
            return callback(null);
          }
          var originalFile = '/files/' + file._id + '-' + file.name + '.' + file.extension;
          var tempFile = uploadfs.getTempPath() + '/' + generateId() + '.' + file.extension;
          n++;
          console.log(n + ' of ' + total + ': ' + originalFile);
          async.series([
            function(callback) {
              uploadfs.copyOut(originalFile, tempFile, callback);
            },
            function(callback) {
              uploadfs.copyImageIn(tempFile, originalFile, callback);
            },
            function(callback) {
              fs.unlink(tempFile, callback);
            }
          ], callback);
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
            rank: 9998
        }, callback);
      } else {
        console.log('We already have one');
      }
      return callback(null);
    });
  }
}

// Required because EventEmitter is built on prototypal inheritance,
// calling the constructor is not enough
require('util').inherits(Apos, require('events').EventEmitter);

module.exports = function() {
  return new Apos();
};

