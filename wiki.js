var appy = require('appy');
var oembed = require('oembed');
var request = require('request');
var async = require('async');
var sanitize = require('validator').sanitize;
var uploadfs = require('uploadfs');
var fs = require('fs');

var app, db;

var options = {
  auth: {
    strategy: 'local',
    options: {
      users: {
        admin: {
          username: 'admin',
          password: 'demo',
          id: 'admin'
        }
      }
    }
  },

  // Lock the /user prefix to require login
  locked: '/user',

  sessionSecret: 'whatever',

  db: {
    // host: 'localhost'
    // port: 27017,
    name: 'jot',
    collections: [ 'posts', 'files' ]
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

  app.get('/user/file-iframe/:id', validId, function(req, res) {
    var id = req.params.id;
    res.render('fileIframe', { id: id, error: false, uploaded: false });
  });

  // Deliver details about a previously uploaded file as a JSON response
  app.get('/user/file-info/:id', validId, function(req, res) {
    var id = req.params.id;
    appy.files.findOne({ _id: id, ownerId: req.user.id }, gotFile);
    console.log('id was ' + id);
    console.log(req.user);
    function gotFile(err, file) {
      if (err || (!file)) {
        res.statusCode = 404;
        console.log(err);
        console.log(file);
        res.send("Not Found");
        return;
      }
      file.url = uploadfs.getUrl() + '/images/' + id;
      res.send(file);
      console.log(file);
    }
  });

  // An upload submitted via the iframe
  app.post('/user/file-iframe/:id', validId, function(req, res) {
    var id = req.params.id;
    var file = req.files.file;

    if (!file) {
      return fail(req, res);
    }

    var src = file.path;

    appy.files.findOne({ _id: id }, gotExisting);

    var info;

    function gotExisting(err, existing) {
      // If it's already in the db, make sure it belongs to us
      // before we allow the user to overwrite it
      if (existing && (existing.ownerId !== req.user.id)) {
        console.log('existing and not ours:' + existing.ownerId + ',' + req.user.id);
        return fail(req, res);
      }
      // Let uploadfs do the heavy lifting of scaling and storage to fs or s3
      uploadfs.copyImageIn(src, '/images/' + id, update);
    }

    function update(err, infoArg) {
      if (err) {
        console.log(err);
        return fail(req, res);
      }
      info = infoArg;
      info._id = id;
      info.name = slugify(file.name);
      info.ownerId = req.user.id ? req.user.id : req.user.username;
      info.createdAt = new Date();

      appy.files.update({ _id: info._id, ownerId: req.user.id }, info, { upsert: true, safe: true }, inserted);
    }

    function inserted(err) {
      info.uploaded = true;
      info.error = false;
      info.id = info._id;
      console.log(info);
      console.log('so there');
      res.render('fileIframe', info);
    }

    function fail(req, res) {
      return res.render('fileIframe', { id: id, error: "Not a GIF, JPEG or PNG image file", uploaded: false });
    }
  });

  // Display an editor for a new or existing blog post

  app.get('/user/editor', function(req, res) {
    var id = req.query.id;
    var isNew = false;
    if (!id) {
      isNew = true;
      var post = {
        body: '',
        _id: generateId()
      };
      return edit(req, res, post, isNew);
    } else {
      appy.posts.findOne({ _id: id, userId: req.user.id }, function(err, post) {
        if (err || (!post)) {
          return notfound(req, res);
        }
        else
        {
          return edit(req, res, post, isNew);
        }
      });
    }
  });

  function edit(req, res, post, isNew, error) {
    var cancelUrl = '/' + req.user.username;
    var deleteUrl = null;
    if (!isNew) {
      cancelUrl += '/' + post.slug;
      deleteUrl = '/user/delete/' + post.slug;
    }
    res.render('editor', { post: post, cancelUrl: cancelUrl, deleteUrl: deleteUrl, error: error, isNew: isNew });
  }

  app.post('/user/editor', function(req, res) {
    var id = req.body.id;
    var title = req.body.title.substr(0, 130);
    var post = {
      title: title,
      post: validatePost(req.body.body),
      slug: slugify(title) + '-' + id,
      userId: req.user.id,
      username: req.user.username
    };

    // I wanted to use upsert here, but you can't have fields
    // that are only inserted and not updated (createdAt), so I can't.
    // https://jira.mongodb.org/browse/SERVER-340

    appy.posts.findOne({ _id: req.body.id }, function(err, doc) {
      if ((!err) && doc) {
        // This is an existing post. On update make sure it belongs to us
        appy.posts.update({ 
          _id: req.body.id, 
          userId: req.user.id 
        }, 
        { 
          $set: post 
        }, function (err) {
          return after(err, post);
        });
      } else {
        // A new post
        post.createdAt = new Date();
        post._id = id;
        appy.posts.insert(post, function(err, docs) {
          return after(err, post);
        });
      }
    });
    function after(err, post) {
      if (err || (!post)) {
        return fail(req, res);
      }
      return res.redirect('/' + req.user.username + '/' + post.slug);
    }
  });

  // A simple oembed proxy to avoid cross-site scripting restrictions. 
  // A more complete project would need to cache oembed results, 
  // including the thumbnails
  app.get('/oembed', function(req, res) {
    oembed.fetch(req.query.url, {}, function (err, result) {
      if (err) {
        return res.send({ 'err': err });
      } else {
        return res.send(result);
      }
    });
  });

  // Delete the specified post
  app.get('/user/delete/:slug', function(req, res) {
    appy.posts.remove({ username: req.user.username, slug: req.params.slug },
      function(err, post) {
        return res.redirect('/');
      }
    );
  });

  // Show a post, with an edit button if it's ours
  app.get('/:username/:slug', function(req, res) {
    var username = req.user ? req.user.username : null;
    appy.posts.findOne({ username: req.params.username, slug: req.params.slug },
      function(err, post) {
        if (err || (!post)) {
          return notfound(req, res);
        }
        res.render('show', { post: post, mine: username === req.params.username });
      }
    );
  });

  // Show feed of posts for a user
  app.get('/:username', function(req, res) {
    if (req.params.username === 'favicon.ico') {
      return notfound(req, res);
    }
    return indexFor(req, res, { username: req.params.username });
  });

  function indexFor(req, res, criteria) {
    return appy.posts.find(criteria).sort({ createdAt: -1 }).toArray(function(err, posts) {
        if (err) {
          return notfound(req, res);
        }
        if (!posts.length) {
          if (req.user && (req.params.username === req.user.username)) {
            return ok();
          } else {
            console.log("Not sure about " + req.url); 
            return notfound(req, res);
          }
        } else {
          return ok();
        }
        function ok() {
          res.render('index', { username: req.params.username, posts: posts, mine: req.user && (req.user.username === req.params.username) });
        }
      }
    );
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

function validatePost(body)
{
  // Remove float arrows on save. 
  body = globalReplace(body, '↣', '');
  body = globalReplace(body, '↢', '');
  body = sanitize(body).xss().trim();
  return body;
}

