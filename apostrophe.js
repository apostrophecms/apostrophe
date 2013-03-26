/* jshint undef: true */
var oembed = require('oembed');
var request = require('request');
var async = require('async');
var sanitize = require('validator').sanitize;
var fs = require('fs');
var _ = require('underscore');
var jQuery = require('jquery');
var nunjucks = require('nunjucks');
var async = require('async');
var lessMiddleware = require('less-middleware');
var hash_file = require('hash_file');
var path = require('path');
// provides quality date/time formatting which we make available in templates
var moment = require('moment');
// Query string parser/generator
var qs = require('qs');

// MongoDB prefix queries are painful without this
RegExp.quote = require("regexp-quote");

function Apos() {
  var self = this;
  var app, files, areas, pages, uploadfs, nunjucksEnv, db, aposLocals;

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
    return Math.floor(Math.random() * 1000000000) + '' + Math.floor(Math.random() * 1000000000);
  }

  // This is our standard set of controls. If you add a new widget you'll be
  // adding that to self.itemTypes (with widget: true) and to this list of
  // default controls - or not, if you think your widget shouldn't be available
  // unless explicitly specified in a aposArea call. If your project should *not*
  // offer a particular control, ever, you can remove it from this list
  // programmatically

  self.defaultControls = [ 'style', 'bold', 'italic', 'createLink', 'insertUnorderedList', 'slideshow', 'video', 'pullquote', 'code' ];

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

    // OUR CODE

    // Editing functionality
    'editor',
    // Viewers for standard content types
    'content',
  ];

  // Templates pulled into the page by the aposTemplates() Express local
  // These are typically hidden at first by CSS and cloned as needed by jQuery

  var templates = [
    'slideshowEditor', 'pullquoteEditor', 'videoEditor', 'codeEditor', 'hint'
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

  self.pushAsset = function(type, name, fs, web) {
    if (!fs) {
      fs = __dirname;
    }
    if (!web) {
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

    var dir;
    if (types[type].serve === 'fs') {
      dir = fs + '/' + types[type].fs;
    } else {
      dir = web + '/' + types[type].web;
    }

    var file = dir + '/' + name;
    if (types[type].ext) {
      file += '.' + types[type].ext;
    }
    self._assets[types[type].key].push(file);
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

  self.init = function(options, callback) {

    function setupAreas(callback) {
      db.collection('aposAreas', function(err, collection) {
        self.areas = areas = collection;
        collection.ensureIndex({ slug: 1 }, { safe: true, unique: true }, function(err) {
          return callback(err);
        });
      });
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
      uploadfs = options.uploadfs;
      self.permissions = options.permissions;

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

      aposLocals = {};

      // All the locals we export to Express must have a apos prefix on the name
      // for clean namespacing.

      // Make crucial data such as apos.uploadsUrl available to the browser
      aposLocals.aposSetVariables = function() {
        return partial('variables', { uploadsUrl: uploadfs.getUrl() });
      };

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
            return partial(template);
          }
        }).join('');
      };

      aposLocals.aposArea = function(options) {
        if (!options.controls) {
          options.controls = self.defaultControls;
        }
        if (!options.area) {
          // Invent the area if it doesn't exist yet, so we can
          // edit pages not previously edited
          options.area = { items: [] };
        }
        return partial('area', options);
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
        return partial('singleton', options);
      };

      aposLocals.aposAreaIsEmpty = function(options) {
        if (!options.area) {
          return true;
        }
        return !options.area.items.length;
      };

      aposLocals.aposSingletonIsEmpty = function(options) {
        return !_.some(options.area.items, function(item) {
          return item.type === options.type;
        });
      };

      aposLocals.aposAreaContent = function(items, options) {
        var result = '';
        _.each(items, function(item) {
          result += aposLocals.aposItemNormalView(item, options).trim();
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
        // We can easily add a minifier and combiner here etc., but
        // that's not important at this stage of development
        return _.map(self._assets['stylesheets'], function(stylesheet) {
          return '<link href="' + stylesheet + '" rel="stylesheet" />';
        }).join("\n");
      };

      aposLocals.aposScripts = function() {
        // We can easily add a minifier and combiner here etc., but
        // that's not important at this stage of development
        return _.map(self._assets['scripts'], function(script) {
          return '<script src="' + script + '"></script>';
        }).join("\n");
      };

      aposLocals.aposFilePath = function(file, options) {
        var path = uploadfs.getUrl() + '/files/' + file._id + '-' + file.name;
        if (options.size) {
          path += '.' + options.size;
        }
        return path + '.' + file.extension;
      };

      aposLocals.aposLog = function(m) {
        console.log(m);
        return '';
      };

      // In addition to making these available in app.locals we also
      // make them available in our own partials later.
      _.extend(app.locals, aposLocals);

      // Add more locals for Apostrophe later. Used by extension modules
      // like apostrophe-pages
      self.addLocal = function(name, fn) {
        aposLocals[name] = fn;
        app.locals[name] = fn;
      };

      // All routes must begin with /apos!

      // Upload a file for slideshow purposes (TODO: extend to
      // accept non-image files when appropriate)
      app.post('/apos/upload-files', function(req, res) {
        var newFiles = req.files.files;
        if (!(newFiles instanceof Array)) {
          newFiles = [ newFiles ];
        }
        var infos = [];
        async.map(newFiles, function(file, callback) {
          var info = {
            _id: generateId(),
            length: file.length,
            createdAt: new Date(),
            name: self.slugify(path.basename(file.name, path.extname(file.name)))
          };

          function permissions(callback) {
            self.permissions(req, 'edit-media', null, callback);
          }

          function upload(callback) {
            return uploadfs.copyImageIn(file.path, '/files/' + info._id + '-' + info.name, function(err, result) {
              if (err) {
                return callback(err);
              }
              info.extension = result.extension;
              return callback(null);
            });
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

      // Render an area editor ready to edit the area specified by
      // req.query.slug.

      app.get('/apos/edit-area', function(req, res) {
        var slug = req.query.slug;
        var area;
        var controls = req.query.controls ? req.query.controls.split(' ') : [];
        if (!controls.length) {
          controls = self.defaultControls;
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
                _id: generateId(),
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
          area.wid = 'w-' + area._id;
          area.controls = controls;
          area.controlTypes = self.controlTypes;
          area.itemTypes = self.itemTypes;
          area.standalone = true;
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
          items: content,
          // We give it an id anyway, even though we're not storing it,
          // because it makes it more convenient to find in the DOM
          _id: generateId()
        };
        var controls = req.query.controls ? req.query.controls.split(' ') : [];
        if (!controls.length) {
          controls = self.defaultControls;
        }
        area.wid = 'w-' + area._id;
        area.controls = controls;
        area.controlTypes = self.controlTypes;
        area.itemTypes = self.itemTypes;
        return render(res, 'editArea', area);
      });

      app.post('/apos/edit-area', function(req, res) {
        var slug = req.body.slug;
        self.permissions(req, 'edit-area', slug, function(err) {
          if (err) {
            return forbid(res);
          }
          var content = JSON.parse(req.body.content);
          self.sanitizeItems(content);
          var area = {
            slug: req.body.slug,
            items: content
          };

          function updated(err) {
            if (err) {
              console.log(err);
              return notfound(req, res);
            }

            return self.callLoadersForArea(req, area, function() {
              return res.send(aposLocals.aposAreaContent(area.items));
            });
          }

          self.putArea(slug, area, updated);

        });
      });

      app.post('/apos/edit-singleton', function(req, res) {
        var slug = req.body.slug;
        self.permissions(req, 'edit-area', slug, function(err) {
          if (err) {
            console.log('forbid');
            return forbid(res);
          }
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

          function updated(err) {
            if (err) {
              console.log(err);
              return notfound(req, res);
            }

            return self.callLoadersForArea(req, area, function() {
              return res.send(aposLocals.aposAreaContent(area.items));
            });
          }

          self.putArea(slug, area, updated);

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
      // TODO: cache results according to MaxAge, including the thumbnails.
      // Also, I should offer a whitelist of sites whose oembed codes are
      // known not to be XSS vectors

      app.get('/apos/oembed', function(req, res) {
        oembed.fetch(req.query.url, {}, function (err, result) {
          if (err) {
            return res.send({ 'err': err });
          } else {
            return res.send(result);
          }
        });
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

      return callback(null);
    }

    self.options = options;

    app = options.app;

    self.db = db = options.db;

    async.series([setupAreas, setupPages, setupFiles, setupRedirects, afterDb], callback);
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

  // getArea retrieves an area from MongoDB. It supports both
  // freestanding areas and areas that are part of a page object.
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
    if (matches) {
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
    } else {
      areas.findOne({ slug: slug }, function(err, area) {
        if (err) {
          return callback(err);
        }
        return loadersThenCallback(area);
      });
    }

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

  // putArea stores an area in MongoDB. It supports both
  // freestanding areas and areas that are part of a page object.
  //
  // Invokes the callback with an error if any, and if no error,
  // the area object with its slug property set to the slug under
  // which it was stored with putArea.
  //
  // If 'slug' matches the following pattern:
  //
  // /cats/about:sidebar
  //
  // Then 'sidebar' is assumed to be the name of an area stored
  // within the areas property of the page object with the slug /cats/about. 
  // If the page object was previously empty it now looks like:
  //
  // { 
  //   slug: '/cats/about', 
  //   areas: { 
  //     sidebar: { 
  //       slug: '/cats/about/:sidebar', 
  //       content: 'whatever your area.content property was'
  //     } 
  //   } 
  // }
  //
  // Page objects are stored in the 'pages' collection.
  //
  // Slugs of this type are an efficient way to store related areas 
  // that are usually desired at the same time, because the getPage method
  // returns the entire page object, including all of its areas.
  //
  // If the slug does not contain a : then the area is stored directly
  // in the 'areas' collection.
  //
  // Page objects must already exist, otherwise an error occurs.
  // Create pages with putPage.

  self.putArea = function(slug, area, callback) {
    function invokeCallback(err) {
      if (err) {
        return callback(err);
      }
      return callback(err, area);
    }

    var matches = slug.match(/^(.*?)\:(\w+)$/);
    if (matches) {
      // This area is part of a page
      var pageSlug = matches[1];
      var areaSlug = matches[2];
      area.slug = slug;
      var set = {};
      set.slug = pageSlug;
      // Use MongoDB's dot notation to update just the area in question
      set['areas.' + areaSlug] = area;
      pages.update(
        { slug: pageSlug },
        { $set: set },
        { safe: true },
        invokeCallback);
    } else {
      areas.update({ slug: slug }, area, { upsert: true, safe: true }, invokeCallback);
    }
  };

  // slug is the existing slug of the page in the database. If page.slug is
  // different then the slug of the page is changed. If page.slug is not defined
  // it is set to the slug parameter for your convenience. The slug of the page,
  // and the path of the page if it is defined, are both automatically made 
  // unique through successive addition of random digits if necessary

  self.putPage = function(slug, page, callback) {
    if (!page.slug) {
      page.slug = slug;
    }
    if (!page._id) {
      page._id = generateId();
    }
    self.pages.update({ slug: slug }, page, { upsert: true, safe: true },
      function(err) {
        if (err) {
          if (self.isUniqueError(err, 'slug') || self.isUniqueError(err, 'path'))
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
            return self.putPage(page, self.options, callback);
          }
          return callback(err);
        }
        return callback(null, page);
      }
    );
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
      $or: orClauses
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
      css: 'slideshow'
    },
    video: {
      widget: true,
      label: 'Video',
      icon: 'video',
      render: function(data) {
        return partial('video', data);
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
      css: 'pullquote'
    },
    code: {
      widget: true,
      label: 'Code',
      plaintext: true,
      wrapper: 'pre',
      css: 'code'
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

    nunjucksEnv.addFilter('jsonAttribute', function(data) {
      // Leverage jQuery's willingness to parse attributes as JSON objects and arrays
      // if they look like it. TODO: find out if this still works cross browser with
      // single quotes, all the double escaping is unfortunate
      if (typeof(data) === 'object') {
        return JSON.stringify(data).replace(/\&/g, '&amp;').replace(/</g, '&lt').replace(/\>/g, '&gt').replace(/\"/g, '&quot;');
      } else {
        // Make it a string for sure
        data += '';
        return data.replace(/\&/g, '&amp;').replace(/</g, '&lt').replace(/\>/g, '&gt').replace(/\"/g, '&quot;');
      }
    });

    return nunjucksEnv;
  };

  // Note: you'll need to use xregexp instead if you need non-Latin character
  // support in slugs. KEEP IN SYNC WITH BROWSER SIDE IMPLEMENTATION in editor.js
  self.slugify = function(s, options) {

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
    s = s.replace(consecRegex, '-');
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

  // For convenience when configuring uploadfs
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
    }
  ];

  // Is this MongoDB error related to the uniqueness of the specified field?
  // Great for retrying on duplicates. Used heavily by the pages module and
  // no doubt will be by other things
  self.isUniqueError = function(err, field) {
    if (!err) {
      return false;
    }
    return (((err.code === 11000) || (err.code === 11001)) && (err.err.indexOf(field) !== -1));
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

  // Convert camel case to a hyphenated css name. Not especially fast,
  // hopefully you only do this during initialization and remember the result
  self.cssName = function(camel) {
    var i;
    var css = '';
    for (i = 0; (i < camel.length); i++) {
      var c = camel.charAt(i);
      if (c === c.toUpperCase()) {
        css += '-';
        css += c.toLowerCase();
      } else {
        css += c;
      }
    }
    return css;
  }
}

module.exports = function() {
  return new Apos();
};

