var oembed = require('oembed');
var request = require('request');
var async = require('async');
var sanitize = require('validator').sanitize;
var fs = require('fs');
var _ = require('underscore');
var jQuery = require('jquery');
var nunjucks = require('nunjucks');
var async = require('async');

// MongoDB prefix queries are painful without this
RegExp.quote = require("regexp-quote");

module.exports = function() {
  return new apos();
}

function apos() {
  var self = this;
  var app, files, areas, pages, uploadfs, nunjucksEnv, permissions, partial;

  // This is our standard set of controls. If you add a new widget you'll be
  // adding that to self.itemTypes (with widget: true) and to this list of
  // default controls - or not, if you think your widget shouldn't be available
  // unless explicitly specified in a aposArea call. If your project should *not*
  // offer a particular control, ever, you can remove it from this list
  // programmatically

  self.defaultControls = [ 'style', 'bold', 'italic', 'createLink', 'insertUnorderedList', 'image', 'video', 'pullquote', 'code' ];

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
        { value: 'h6', label: 'Heading 6' }
      ]
    },
    bold: {
      type: 'button',
      label: 'b'
    },
    italic: {
      type: 'button',
      label: 'i'
    },
    createLink: {
      type: 'button',
      label: 'Link'
    },
    insertUnorderedList: {
      type: 'button',
      label: 'List'
    }
  };

  // Default stylesheet requirements
  self.stylesheets = [
    "/apos/css/content.css",
    "/apos/css/editor.css"
  ];

  // Default browser side script requirements

  self.scripts = [ 
    '/apos/js/jquery-1.8.1.min.js',
    '/apos/js/underscore-min.js',
    '/apos/js/jquery.hotkeys/jquery.hotkeys.js',
    '/apos/js/rangy-1.2.3/rangy-core.js',
    '/apos/js/rangy-1.2.3/rangy-selectionsaverestore.js',
    '/apos/js/textinputs_jquery.js',
    '/apos/js/jquery.cookie.js',
    '/apos/js/editor.js', 
    '/apos/js/content.js' 
  ];

  // Templates pulled into the page by the aposTemplates() Express local
  // These are typically hidden at first by CSS and cloned as needed by jQuery

  self.templates = [
    'imageEditor', 'pullquoteEditor', 'videoEditor', 'codeEditor', 'hint'
  ];

  self.init = function(options, callback) {
    app = options.app;
    files = options.files;
    areas = options.areas;
    pages = options.pages;
    uploadfs = options.uploadfs;
    permissions = options.permissions;

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
    if (!permissions) {
      permissions = function(req, action, fileOrSlug, callback) {
        return callback(null);
      };
    }

    nunjucksEnv = self.newNunjucksEnv(__dirname + '/views');

    aposLocals = {};

    // All the locals we export to Express must have a apos prefix on the name
    // for clean namespacing.

    // aposTemplates renders templates that are needed on any page that will
    // use apos. Examples: imageEditor.html, codeEditor.html, etc. These lie
    // dormant in the page until they are needed as prototypes to be cloned 
    // by jQuery

    aposLocals.aposTemplates = function(options) {
      if (!options) {
        options = {};
      }
      if (!options.templates) {
        options.templates = self.templates;
      }
      return _.map(options.templates, function(template) {
        return partial(template + '.html', options);
      }).join('');
    };

    aposLocals.aposArea = function(options) {
      if (!options.controls) {
        options.controls = self.defaultControls;
      }
      return partial('area.html', options);
    }

    aposLocals.aposAreaContent = function(items, options) {
      var result = '';
      _.each(items, function(item) {
        result += aposLocals.aposItemNormalView(item, options).trim();
      });
      return result;
    }

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
      return partial('itemNormalView.html', { item: item, itemType: itemType, options: options, attributes: attributes });
    }

    aposLocals.aposStylesheets = function(options) {
      if (!options) {
        options = {};
      }
      if (!options.stylesheets) {
        options.stylesheets = self.stylesheets;
      }
      // We can easily add a minifier and combiner here etc., but
      // that's not important at this stage of development
      return _.map(options.stylesheets, function(stylesheet) { 
        return '<link href="' + stylesheet + '" rel="stylesheet" />';
      }).join("\n");
    }

    aposLocals.aposScripts = function(options) {
      if (!options) {
        options = {};
      }
      if (!options.scripts) {
        options.scripts = self.scripts;
      }
      // We can easily add a minifier and combiner here etc., but
      // that's not important at this stage of development
      return _.map(options.scripts, function(script) { 
        return '<script src="' + script + '"></script>';
      }).join("\n");
    }

    aposLocals.aposLog = function(m) {
      console.log(m);
      return '';
    }

    // In addition to making these available in app.locals we also
    // make them available in our own partials later.
    _.extend(app.locals, aposLocals);

    // All routes must begin with /apos!

    // An iframe with file browse and upload buttons.
    // We use an iframe because traditional file upload buttons
    // can't be AJAXed (although you can do that in Chrome and
    // Firefox it is still not supported in IE9).

    app.get('/apos/file-iframe/:id', validId, function(req, res) {
      var id = req.params.id;
      return render(res, 'fileIframe.html', { id: id, error: false, uploaded: false });
    });

    // Deliver details about a previously uploaded file as a JSON response
    app.get('/apos/file-info/:id', validId, function(req, res) {
      var id = req.params.id;
      files.findOne({ _id: id }, gotFile);
      function gotFile(err, file) {
        if (err || (!file)) {
          res.statusCode = 404;
          res.send("Not Found");
          return;
        }
        permissions(req, 'edit-media', file, function(err) {
          if (err) {
            return forbid(res);
          }
          file.url = uploadfs.getUrl() + '/images/' + id;
          return res.send(file);
        });
      }
    });

    // An upload submitted via the iframe
    app.post('/apos/file-iframe/:id', validId, function(req, res) {
      var id = req.params.id;
      var file = req.files.file;

      if (!file) {
        return fail(req, res);
      }

      var src = file.path;

      files.findOne({ _id: id }, gotExisting);

      var info;

      function gotExisting(err, existing) {
        permissions(req, 'edit-media', existing, function(err) {
          if (err) {
            return forbid(res);
          }
          // Let uploadfs do the heavy lifting of scaling and storage to fs or s3
          return uploadfs.copyImageIn(src, '/images/' + id, update);
        });
      }

      function update(err, infoArg) {
        if (err) {
          return fail(req, res);
        }
        info = infoArg;
        info._id = id;
        info.name = slugify(file.name);
        info.createdAt = new Date();

        // Do our best to record who owns this file to allow permissions
        // checks later. If req.user exists and has an _id, id or username property, 
        // record that
        if (req.user) {
          info.owner = req.user._id || req.user.id || req.user.username;
        }

        files.update({ _id: info._id }, info, { upsert: true, safe: true }, inserted);
      }

      function inserted(err) {
        info.uploaded = true;
        info.error = false;
        info.id = info._id;
        render(res, 'fileIframe.html', info);
      }

      function fail(req, res) {
        return render(res, 'fileIframe.html', { id: id, error: "Not a GIF, JPEG or PNG image file", uploaded: false });
      }
    });

    // Area editor

    app.get('/apos/edit-area', function(req, res) {
      var slug = req.query.slug;
      var controls = req.query.controls ? req.query.controls.split(' ') : [];
      if (!controls.length) {
        controls = self.defaultControls;
      }
      permissions(req, 'edit-area', slug, function(err) {
        if (err) {
          return forbid(res);
        }
        var isNew = false;
        if (!slug) {
          return notfound(req, res);
        } else {
          self.getArea(slug, function(err, area) {
            if (!area) {
              var area = {
                slug: slug,
                _id: generateId(),
                content: null,
                isNew: true,
              };
              extraProperties(area);
              return render(res, 'editArea.html', area);
            }
            else
            {
              extraProperties(area);
              area.isNew = false;
              return render(res, 'editArea.html', area);
            }
            function extraProperties(area) {
              area.wid = 'w-' + area._id;
              area.controls = controls;
              area.controlTypes = self.controlTypes;
              area.itemTypes = self.itemTypes;
            }
          });
        }
      });
    });

    app.post('/apos/edit-area', function(req, res) {
      var slug = req.body.slug;
      permissions(req, 'edit-area', slug, function(err) {
        if (err) {
          return forbid(res);
        }
        var content = JSON.parse(req.body.content);
        sanitizeArea(content);
        var area = {
          slug: req.body.slug,
          items: content
        };

        self.putArea(slug, area, updated);

        function updated(err) {
          if (err) {
            console.log(err);
            return notfound(req, res);
          }

          return callLoadersForArea(area, function() {
            return res.send(aposLocals.aposAreaContent(area.items));
          });
        }
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

      // Invoke server-side loader middleware like getArea or getPage would,
      // unless explicitly asked not to

      if ((options.load !== '0') && (itemType.load)) {
        return itemType.load(item, go);
      } else {
        return go();
      }

      function go() {
        return res.send(aposLocals.aposItemNormalView(item, options));
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

  self.static = function(dir) {
    return function(req, res) {
      var path = req.params[0];
      // Don't let them peek at /etc/passwd etc. Browsers
      // pre-resolve these anyway
      path = globalReplace(path, '..', '');
      return res.sendfile(dir + '/' + path);
    };
  };

  // getArea retrieves an area from MongoDB. It supports both
  // freestanding areas and areas that are part of a page object.
  //
  // Invokes the callback with an error if any, and if no error,
  // the area object requested if it exists. If the area does not
  // exist, both parameters to the callback are null.
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

  self.getArea = function(slug, options, callback) {
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
      if (options.load) {
        return callLoadersForArea(area, after);
      } else {
        return after();
      }
      function after() {
        return callback(null, area);
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

  self.putArea = function(slug, area, callback) {
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
        { upsert: true, safe: true }, 
        invokeCallback);
    } else {
      areas.update({ slug: slug }, area, { upsert: true, safe: true }, invokeCallback);
    }

    function invokeCallback(err) {
      if (err) {
        return callback(err);
      }
      return callback(err, area);
    }
  };

  // Fetch the "page" with the specified slug. As far as
  // apos is concerned, the "page" with the slug /about
  // is expected to be an object with a .areas property. If areas
  // with the slugs /about:main and /about:sidebar have
  // been saved, then the areas property will be an
  // object with properties named main and sidebar.
  //
  // You MAY also store entirely unrelated properties in
  // your "page" objects, via your own mongo code.
  //
  // This allows the composition of objects as 
  // different (and similar) as webpages, blog articles,
  // upcoming events, etc.

  self.getPage = function(slug, callback) {
    pages.findOne({ slug: slug }, function(err, page) {
      if (page) {
        // For convenience guarantee there is a page.areas property
        if (!page.areas) {
          page.areas = {};
        }
        // Call loaders for all areas in the page. Wow, async.map is awesome.
        async.map(_.values(page.areas), callLoadersForArea, function(err, results) {
          return callback(err, page);
        });
      } else {
        // Nonexistence is not an error
        return callback(null, null);
      }
    });
  };

  // Private methods

  // Invoke loaders for any items in this area that have loaders, then
  // invoke callback. Loaders are expected to report failure as appropriate
  // to their needs by setting item properties that their templates can 
  // use to display that when relevant, so there is no formal error
  // handling for loaders

  function callLoadersForArea(area, callback) {
    async.map(area.items, function(item, callback) {
      if (self.itemTypes[item.type].load) {
        return self.itemTypes[item.type].load(item, callback);
      } else {
        return callback();
      }
    }, function(err, results) {
      return callback(err);
    });
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

  self.partial = function(name, data, dir) {
    if (!data) {
      data = {};
    }

    if (!dir) {
      dir = __dirname + '/views';
    }

    // Make sure the apos-specific locals are visible to partials too.
    // If we import ALL the locals we'll point at the wrong views directory
    // and generally require the developer to worry about not breaking
    // our partials, which ought to be a black box they can ignore.

    _.extend(data, aposLocals);

    var path;

    // Allow absolute paths
    if (name.substr(0, 1) === '/') {
      path = name;
    } else {
      path = dir + '/' + name;
      if (typeof(data.partial) === 'undefined') {
        data.partial = partial;
      }
    }

    var tmpl = nunjucksEnv.getTemplate(path);
    return tmpl.render(data);
  }

  // Something we can export via app.locals etc.
  function partial(name, data, dir) {
    return self.partial(name, data, dir);
  }

  function slugify(s) {
    // Note: you'll need to use xregexp instead if you need non-Latin character
    // support in slugs

    // Everything not a letter or number becomes a dash
    s = s.replace(/[^A-Za-z0-9]/g, '-');
    // Consecutive dashes become one dash
    s = s.replace(/\-+/g, '-');
    // Leading dashes go away
    s = s.replace(/^\-/, '');
    // Trailing dashes go away
    s = s.replace(/\-$/, '');
    // If the string is empty, supply something so that routes still match
    if (!s.length)
    {
      s = 'none';
    }
    return s.toLowerCase();
  }

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

  function sanitizeArea(items)
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
  }

  self.itemTypes = {
    richText: {
      markup: true,
      sanitize: function(item) {
        // This is just a down payment, we should be throwing out unwanted
        // tags attributes and properties as A1.5 does
        item.content = sanitize(item.content).xss().trim();
      }
    },
    image: {
      widget: true,
      label: 'Image',
      render: function(data) {
        return partial('image.html', data);
      },
      css: 'image'
    },
    video: {
      widget: true,
      label: 'Video',
      render: function(data) {
        return partial('video.html', data);
      },
      css: 'video'
    },
    pullquote: {
      widget: true,
      label: 'Pullquote',
      plaintext: true,
      wrapper: 'span',
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

  self.newNunjucksEnv = function(dir) {
    nunjucksEnv = new nunjucks.Environment(new nunjucks.FileSystemLoader(dir));
    nunjucksEnv.addFilter('json', function(data) {
      return JSON.stringify(data);
    });
    return nunjucksEnv;
  }
}

