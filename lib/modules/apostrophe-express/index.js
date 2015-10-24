var _ = require('lodash');
var minimatch = require('minimatch');

module.exports = {

  afterConstruct: function(self) {
    self.createApp();
    self.prefix();
    self.requiredMiddleware();
    self.optionalMiddleware();
    self.addListenMethod();
    self.compileCsrfExceptions();
  },

  construct: function(self, options) {

    var express = require('express');
    var bodyParser = require('body-parser');
    var expressSession = require('express-session');
    var connectFlash = require('connect-flash');
    var cookieParser = require('cookie-parser');

    self.createApp = function() {
      self.apos.app = self.apos.baseApp = express();
      self.apos.express = express;
    };

    self.prefix = function() {
      if (self.apos.prefix) {
        // Use middleware to patch the redirect method to accommodate
        // the prefix. This is cleaner than patching the prototype, which
        // breaks if you have multiple instances of Apostrophe, such as
        // in our unit tests. -Tom
        self.apos.app.use(function(req, res, next) {
          var superRedirect = res.redirect;
          res.redirect = function(status, url) {
            if (arguments.length === 1) {
              url = status;
              status = 302;
            }
            if (!url.match(/^[a-zA-Z]+:/))
            {
              url = self.apos.prefix + url;
            }
            return superRedirect.call(this, status, url);
          };
          return next();
        });

        self.apos.baseApp = express();
        self.apos.baseApp.use(self.apos.prefix, self.apos.app);
      }
    };

    // Now everyone can rely on this property already existing and just add to it
    self.createData = function(req, res, next) {
      if(!req.data) {
        req.data = {};
      }
      return next();
    };

    self.sessions = function() {
      var sessionOptions = self.apos.options.sessions || {};
      _.defaults(sessionOptions, {
        // Do not save sesions until something is stored in them.
        // Greatly reduces aposSessions collection size
        saveUninitialized: false,
        // The mongo store uses TTL which means we do need
        // to signify that the session is still alive when someone
        // views a page, even if their session has not changed
        resave: true,
        // Always update the cookie, so that each successive
        // access revives your login session timeout
        rolling: true,
        secret: 'you should have a secret',
        cookie: {}
      });
      _.defaults(sessionOptions.cookie, {
        path: '/',
        httpOnly: true,
        secure: false,
        // Default login lifetime between requests is one day
        maxAge: 86400000
      });
      if (sessionOptions.secret === 'you should have a secret') {
        console.log('WARNING: No session secret provided, please set `secret` for apostrophe-express module in app.js');
      }
      if (!sessionOptions.store) {
        var MongoStore = require('connect-mongo')(expressSession);
        sessionOptions.store = new MongoStore({ db: self.apos.db });
      }
      self.apos.app.use(expressSession(sessionOptions));
    };

    self.requiredMiddleware = function() {

      self.apos.app.use(self.createData);

      self.sessions();

      // First so self.csrf can use it.
      self.apos.app.use(cookieParser());

      // Angular-style CSRF protection. See also the
      // csrf.exceptions option. -Tom
      if (self.options.csrf !== false) {
        self.apos.app.use(self.csrf);
      }

      // extended: true means that people[address[street]] works
      // like it does in a PHP urlencoded form. This has a cost
      // but is too useful and familiar to leave out. -Tom and Ben

      self.apos.app.use(bodyParser.urlencoded({ extended: true }));
      self.apos.app.use(bodyParser.json({}));
      self.apos.app.use(connectFlash());
      self.apos.app.use(self.apos.i18n.init);
      self.apos.app.use(self.absoluteUrl);

      // self.apos.app.use(function(req, res, next) {
      //   console.log('URL: ' + req.url);
      //   return next();
      // });

      if (options.middleware) {
        _.each(options.middleware, function(fn) {
          self.apos.app.use(fn);
        });
      }
    };

    // Allows us to accept both '/api/**' and /^\/api\/.*$/

    self.compileCsrfExceptions = function() {
      var list = (self.options.csrf && self.options.csrf.minimumExceptions) || [ '/login' ];
      list = list.concat((self.options.csrf && self.options.csrf.exceptions) || []);
      self.csrfExceptions = _.map(list, function(e) {
        if (e instanceof RegExp) {
          return e;
        }
        return minimatch.makeRe(e);
      });
    };

    // Angular-compatible. Send the csrftoken cookie as the X-CSRFToken header.
    // This works because if we're running via a script tag or iframe, we won't
    // be able to read the cookie.
    //
    // https://docs.angularjs.org/api/ng/service/$http#cross-site-request-forgery-xsrf-protection
    //
    // We use Angular's cookie name although CSRF is a more common spelling. -Tom

    self.csrf = function(req, res, next) {

      if (_.find(self.csrfExceptions || [], function(e) {
        return req.url.match(e);
      })) {
        return next();
      }

      // All non-safe methods are subject to CSRF by default
      if ((req.method === 'GET') || (req.method === 'HEAD') || (req.method === 'OPTIONS') || (req.method === 'TRACE')) {
        if (!req.cookies['XSRF-TOKEN']) {
          res.cookie('XSRF-TOKEN', self.apos.utils.generateId());
        }
      } else {
        // All non-safe requests must be preceded by a safe request that establishes
        // the CSRF token cookie. Otherwise a user who is logged in but doesn't
        // currently have a CSRF token is still vulnerable. See options.csrfExceptions
        if ((!req.cookies['XSRF-TOKEN']) || (req.get('X-XSRF-TOKEN') !== req.cookies['XSRF-TOKEN'])) {
          res.statusCode = 403;
          return res.send('forbidden');
        }
      }
      return next();
    };

    self.optionalMiddleware = function() {
      // Middleware that is not automatically installed on
      // every route but is recommended for use in your own
      // routes when needful
      self.apos.middleware = {
        files: require('connect-multiparty')()
      };
    };

    self.addListenMethod = function() {
      self.apos.listen = function() {
        // Default address for dev
        var address = self.options.address || '0.0.0.0';
        // Default port for dev
        var port = self.options.port || 3000;
        // Heroku
        if (process.env.ADDRESS) {
          address = process.env.ADDRESS;
        } else {
          try {
            // Stagecoach option
            address = fs.readFileSync(self.apos.rootDir + '/data/address', 'UTF-8').replace(/\s+$/, '');
          } catch (err) {
            console.log("I see no data/address file, defaulting to address " + address);
          }
        }
        if (process.env.PORT) {
          port = process.env.PORT;
        } else {
          try {
            // Stagecoach option
            port = fs.readFileSync(self.apos.rootDir + '/data/port', 'UTF-8').replace(/\s+$/, '');
          } catch (err) {
            console.log("I see no data/port file, defaulting to port " + port);
          }
        }
        var server;
        if (port.toString().match(/^\d+$/)) {
          console.log("Listening on " + address + ":" + port);
          server = self.apos.baseApp.listen(port, address);
        } else {
          console.log("Listening at " + port);
          server = self.apos.baseApp.listen(port);
        }
        if (self.apos.options.afterListen) {
          server.on('error', function(err) {
            return self.apos.options.afterListen(err);
          });
          server.on('listening', function() {
            return self.apos.options.afterListen(null);
          });
        }
      };
    };

    self.absoluteUrl = function(req, res, next) {
      req.absoluteUrl = (self.options.baseUrl || (req.protocol + '://' + req.get('Host'))) + self.apos.prefix + req.url;
      next();
    };
  }
};
