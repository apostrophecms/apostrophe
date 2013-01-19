var oembed = require('oembed');
var request = require('request');
var async = require('async');
var sanitize = require('validator').sanitize;
var fs = require('fs');
var _ = require('underscore');
var jQuery = require('jquery');
var nunjucks = require('nunjucks');

// MongoDB prefix queries are painful without this
RegExp.quote = require("regexp-quote");

module.exports = function() {
  return new jot();
}

function jot() {
  var self = this;
  var app, files, areas, pages, uploadfs, nunjucksEnv, permissions;

  // Obviously this needs to become an extensible list, with
  // registration of browser and server side yadda yadda yaddas
  var defaultControls = [ 'style', 'bold', 'italic', 'createLink', 'insertUnorderedList', 'image', 'video', 'pullquote', 'code' ];

  self.init = function(options, callback) {
    app = options.app;
    files = options.files;
    areas = options.areas;
    pages = options.pages;
    uploadfs = options.uploadfs;
    permissions = options.permissions;

    if (options.controls) {
      defaultControls = options.controls;
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

    nunjucksEnv = new nunjucks.Environment(new nunjucks.FileSystemLoader(__dirname + '/views'));
    nunjucksEnv.addFilter('json', function(data) {
      return JSON.stringify(data);
    });

    app.locals.jotTemplates = function(template, info) {
      var templates = [ 'imageEditor', 'pullquoteEditor', 'videoEditor', 'codeEditor', 'hint' ];
      return _.map(templates, function(template) {
        return partial(template + '.html', info);
      }).join('');
    };

    app.locals.jotArea = function(options) {
      if (!options.controls) {
        options.controls = defaultControls;
      }
      return partial('area.html', options);
    }

    app.locals.jotStylesheets = function(options) {
      return partial('stylesheets.html', options);
    }

    app.locals.jotScripts = function(options) {
      return partial('scripts.html', options);
    }

    // All routes must begin with /jot!

    // An iframe with file browse and upload buttons.
    // We use an iframe because traditional file upload buttons
    // can't be AJAXed (although you can do that in Chrome and
    // Firefox it is still not supported in IE9).

    app.get('/jot/file-iframe/:id', validId, function(req, res) {
      var id = req.params.id;
      return render(res, 'fileIframe.html', { id: id, error: false, uploaded: false });
    });

    // Deliver details about a previously uploaded file as a JSON response
    app.get('/jot/file-info/:id', validId, function(req, res) {
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
    app.post('/jot/file-iframe/:id', validId, function(req, res) {
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

    app.get('/jot/edit-area', function(req, res) {
      var slug = req.query.slug;
      var controls = req.query.controls ? req.query.controls.split(' ') : [];
      if (!controls.length) {
        controls = defaultControls;
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
              area.controlMap = {};
              _.each(defaultControls, function(control) {
                area.controlMap[control] = false;
              });
              _.each(controls, function(control) {
                area.controlMap[control] = true;
              });
            }
          });
        }
      });
    });

    app.post('/jot/edit-area', function(req, res) {
      var slug = req.body.slug;
      permissions(req, 'edit-area', slug, function(err) {
        if (err) {
          return forbid(res);
        }
        var area = {
          slug: req.body.slug,
          content: validateContent(req.body.content)
        };

        // TODO: validate content. XSS, tag balancing, allowed tags and attributes,
        // sensible use of widgets. All that stuff A1.5 does well

        self.putArea(slug, area, updated);

        function updated(err) {
          if (err) {
            console.log(err);
            return notfound(req, res);
          }
          res.send(area.content);
        }
      });
    });

    // A simple oembed proxy to avoid cross-site scripting restrictions. 
    // TODO: cache results according to MaxAge, including the thumbnails. 
    // Also, I should offer a whitelist of sites whose oembed codes are 
    // known not to be XSS vectors

    app.get('/jot/oembed', function(req, res) {
      oembed.fetch(req.query.url, {}, function (err, result) {
        if (err) {
          return res.send({ 'err': err });
        } else {
          return res.send(result);
        }
      });
    });

    // Try everything else as a static file. For some reason
    // app.use(express.static(...)) never wins here, but
    // res.sendfile provides the same functionality. We do have
    // to validate the path ourselves though. TODO: figure out
    // how we can use app.use successfully here

    app.get('/jot/*', function(req, res) {
      var path = req.params[0];
      // Don't let them peek at /etc/passwd
      path = globalReplace(path, '..', '');
      return res.sendfile(__dirname + '/public/' + path);
    });

    // app.use('/jot', express.static(__dirname + '/public'));

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

  self.getArea = function(slug, callback) {
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
          return callback(null, page.areas[areaSlug]);
        }
        // Nonexistence isn't an error, it's just nonexistence
        return callback(err, null);
      });
    } else {
      areas.findOne({ slug: slug }, function(err, area) {
        if (err) {
          return callback(err);
        }
        return callback(null, area);
      });
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
  // Jot is concerned, the "page" with the slug /about
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
      }
      return callback(err, page);
    });
  };

  // Private methods

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

  function partial(name, data) {
    if (!data) {
      data = {};
    }

    var path = __dirname + '/views/' + name;

    if (typeof(data.partial) === 'undefined') {
      data.partial = partial;
    }

    var tmpl = nunjucksEnv.getTemplate(path);
    return tmpl.render(data);
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

  function validateContent(content)
  {
    // Remove float arrows on save. 
    content = globalReplace(content, '↣', '');
    content = globalReplace(content, '↢', '');
    // Remove XSS threats. This is a tiny down payment on the
    // validation of allowable markup and CSS we really want to do,
    // similar to what Apostrophe 1.5 delivers
    content = sanitize(content).xss().trim();

    // Remove edit buttons from widgets. This is just the start of
    // what we can do with jQuery on the server side. Note that 
    // browser side validation is not enough because browsers are
    // inherently not trusted
    var wrapper = jQuery('<div></div>');
    wrapper.html(content);
    wrapper.find('.jot-widget-buttons').remove();
    return wrapper.html();
  }
}

