var appy = require('appy');
var async = require('async');
var uploadfs = require('uploadfs')();
var fs = require('fs');
var jot = require(__dirname + '/../jot.js')();

var app, db;

var options = {
  viewEngine: function(app) {
    var nunjucks = require('nunjucks');
    var env = new nunjucks.Environment(new nunjucks.FileSystemLoader(__dirname + '/views'));
    env.express(app);
  },

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
    // jot needs these sizes to exist with these names
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
    async.series([ createTemp, initUploadfs, initJot, setRoutes ], listen);
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

function initJot(callback) {
  return jot.init({
    files: appy.files,
    areas: appy.areas,
    app: app,
    uploadfs: uploadfs,
    permissions: jotPermissions,
  }, callback);
}

function setRoutes(callback) {
  // Other app-specific routes here.

  // LAST ROUTE: pages in the wiki. We want these at the root level.

  // If we haven't matched anything else, look for a page with content.
  // This is a wiki so if there is no content just show an empty page
  // so the user can edit and save and bring it into being.

  // Note the leading slash is included. Express automatically supplies / 
  // if the URL is empty
  app.get('*', 
    function(req, res, next) {
      // Get content for this page
      req.slug = req.params[0];
      jot.getAreasForPage(req.slug, function(e, info) {
        if (e) {
          console.log(e);
          return fail(req, res);
        }
        req.page = info;
        return next();
      });
    },
    function(req, res, next) {
      // Get the shared footer
      jot.getArea('footer', function(e, info) {
        if (e) {
          console.log(e);
          return fail(req, res);
        }
        req.footer = info;
        return next();
      });
    },
    function (req, res) {
      return res.render('page.html', { 
        slug: req.slug, 
        main: req.page.main ? req.page.main.content : '', 
        sidebar: req.page.sidebar ? req.page.sidebar.content : '',
        user: req.user,
        edit: req.user && req.user.username === 'admin',
        footer: req.footer ? req.footer.content : ''
      });
    }
  );

  return callback(null);
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

function getTempPath(path) {
  return __dirname + '/temp' + path;
}

// Allow only the admin user to edit anything with Jot

function jotPermissions(req, action, fileOrSlug, callback) {
  if (req.user && (req.user.username === 'admin')) {
    // OK
    return callback(null);
  } else {
    return callback('Forbidden');
  }
}
