var appy = require('appy');
var oembed = require('oembed');
var request = require('request');
var async = require('async');
var sanitize = require('validator').sanitize;
var uploadfs = require('uploadfs');
var fs = require('fs');
var _ = require('underscore');
var jQuery = require('jquery');

// MongoDB is pretty ridiculous without this
RegExp.quote = require("regexp-quote");

var app, db;

var options = {
  // auth: {
  //   strategy: 'local',
  //   options: {
  //     users: {
  //       admin: {
  //         username: 'admin',
  //         password: 'demo',
  //         id: 'admin'
  //       }
  //     }
  //   }
  // },

  // Lock the /user prefix to require login
  // locked: '/user',

  sessionSecret: 'whatever',

  db: {
    // host: 'localhost'
    // port: 27017,
    name: 'jotwiki',
    collections: [ 
      { name: 'areas', index: { fields: { slug: 1 }, unique: true } }, 
      'files' 
    ],
  },  

  static: __dirname + '/public',

  uploadfs: {
    backend: 'local', 
    uploadsPath: __dirname + '/public/uploads',
    uploadsUrl: 'http://localhost:3000/uploads',
    tempPath: __dirname + '/temp/uploadfs',
    imageSizes: [
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
    ],
  },

  ready: function(appArg, dbArg)
  {
    app = appArg;
    db = dbArg;
    async.series([ createTemp, initUploadfs, setRoutes ], listen);
  }
};

appy.bootstrap(options);

function createTemp(callback) {
  if (!fs.existsSync(__dirname + '/temp')) {
    fs.mkdir(__dirname + '/temp', callback);
  } else {
    callback(null);
  }
}

function initUploadfs(callback) {
  uploadfs.init(options.uploadfs, callback);  
}

function setRoutes(callback) {
  // An iframe with file browse and upload buttons.
  // We use an iframe because traditional file upload buttons
  // can't be AJAXed (although you can do that in Chrome and
  // Firefox it is still not supported in IE9).

  app.get('/jot/file-iframe/:id', validId, function(req, res) {
    var id = req.params.id;
    res.render('fileIframe', { id: id, error: false, uploaded: false });
  });

  // Deliver details about a previously uploaded file as a JSON response
  app.get('/jot/file-info/:id', validId, function(req, res) {
    var id = req.params.id;
    appy.files.findOne({ _id: id }, gotFile);
    function gotFile(err, file) {
      if (err || (!file)) {
        res.statusCode = 404;
        res.send("Not Found");
        return;
      }
      file.url = uploadfs.getUrl() + '/images/' + id;
      res.send(file);
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

    appy.files.findOne({ _id: id }, gotExisting);

    var info;

    function gotExisting(err, existing) {
      // This is a good place to add permissions checks

      // Let uploadfs do the heavy lifting of scaling and storage to fs or s3
      uploadfs.copyImageIn(src, '/images/' + id, update);
    }

    function update(err, infoArg) {
      if (err) {
        return fail(req, res);
      }
      info = infoArg;
      info._id = id;
      info.name = slugify(file.name);
      info.createdAt = new Date();

      appy.files.update({ _id: info._id }, info, { upsert: true, safe: true }, inserted);
    }

    function inserted(err) {
      info.uploaded = true;
      info.error = false;
      info.id = info._id;
      res.render('fileIframe', info);
    }

    function fail(req, res) {
      return res.render('fileIframe', { id: id, error: "Not a GIF, JPEG or PNG image file", uploaded: false });
    }
  });

  // Area editor

  app.get('/jot/edit-area', function(req, res) {
    var slug = req.query.slug;
    var isNew = false;
    if (!slug) {
      return notfound(req, res);
    } else {
      appy.areas.findOne({ slug: slug }, function(err, area) {
        if (!area) {
          var area = {
            slug: slug,
            _id: generateId(),
            content: null,
            isNew: true
          };
          area.wid = 'w-' + area._id;
          return res.render('editArea', area);
        }
        else
        {
          area.wid = 'w-' + area._id;
          area.isNew = false;
          return res.render('editArea', area);
        }
      });
    }
  });

  app.post('/jot/edit-area', function(req, res) {
    var slug = req.body.slug;
    var area = {
      slug: req.body.slug,
      content: validateContent(req.body.content)
    };

    // TODO: validate content. XSS, tag balancing, allowed tags and attributes,
    // sensible use of widgets. All that stuff A1.5 does well

    appy.areas.update({ slug: area.slug }, area, { upsert: true, safe: true }, updated);

    function updated(err) {
      if (err) {
        console.log(err);
        return notfound(req, res);
      }
      res.send(area.content);
    }
  });

  // A simple oembed proxy to avoid cross-site scripting restrictions. 
  // A more complete project should cache oembed results, 
  // including the thumbnails. Also, I recommend a whitelist of
  // sites whose oembed codes are known not to be XSS attacks

  app.get('/jot/oembed', function(req, res) {
    oembed.fetch(req.query.url, {}, function (err, result) {
      if (err) {
        return res.send({ 'err': err });
      } else {
        return res.send(result);
      }
    });
  });

  // LAST ROUTE: pages in the wiki.
  
  // If we haven't matched anything special, look for a page with content.
  // Note the leading slash is included. Express automatically supplies / 
  // if the URL is empty
  app.get(/^(.*)$/, function(req, res) {
    var slug = req.params[0];
    req.slug = slug;
    renderPage(req, res);
  });

  function renderPage(req, res) {
    var slug = req.slug;
    // Ask MongoDB for all areas whose slug starts with
    // the slug of the page, followed by a :. This gives us
    // a namespace for areas within the page
    var pattern = new RegExp('^' + RegExp.quote(slug) + ':', 'i');
    appy.areas.find({ slug: pattern }).toArray(function(err, areas) {
      if (err) {
        return notfound(req, res);
      }
      var data = {};
      // Organize the areas by name
      _.each(areas, function(area) {
        var results = area.slug.match(/:(\w+)$/);
        if (results) {
          data[results[1]] = area;
        }
      });
      data.slug = slug;
      return res.render('page', data);
    });
  }

  // Middleware
  function validId(req, res, next) {
    var id = req.params.id;
    if (!id.match(/^[\w\-\d]+$/)) {
      return fail(req, res);
    }
    next();
  }

  callback();
}

function listen(err) {
  if (err) {
    throw err;
  }
  console.log("Calling appy.listen");
  appy.listen();
}

function fail(req, res) {
  res.statusCode = 500;
  res.send('500 error, URL was ' + req.url);
}

function notfound(req, res) {
  res.statusCode = 404;
  res.send('404 not found error, URL was ' + req.url);
}

function generateId() {
  return Math.floor(Math.random() * 1000000000) + '' + Math.floor(Math.random() * 1000000000);
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

function getTempPath(path) {
  return __dirname + '/temp' + path;
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
  var $content = jQuery(content);
  $content.find('.jot-edit-widget').remove();
  var wrapper = jQuery('<div></div>');
  wrapper.append($content);
  return wrapper.html();
}

