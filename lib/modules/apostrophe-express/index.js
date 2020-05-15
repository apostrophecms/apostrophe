// This module initializes the Express framework, which Apostrophe
// uses and extends to implement both API routes and page-serving routes.
// The Express `app` object is made available as `apos.app`, and
// the `express` object itself as `apos.express`. You can add
// Express routes directly in your modules via `apos.app.get`,
// `apos.app.post`, etc., however be sure to also check
// out the [route method](/reference/modules/apostrophe-module#route-method-path-fn) available
// in all modules for a cleaner way to implement API routes. Adding
// routes directly to the Express app object is still sometimes useful when
// the URLs will be public.
//
// This module also adds a number of standard middleware functions
// and implements the server side of CSRF protection for Apostrophe.
//
// ## Options
//
// ### `baseUrl` (GLOBAL OPTION, NOT SET FOR THIS SPECIFIC MODULE)
//
// As a convenience, `req.absoluteUrl` is set to the absolute URL of
// the current request. If the `baseUrl` option **at the top level,
// not for this specific module** is set to a string
// such as `http://mysite.com`, any site-wide prefix and `req.url` are
// appended to that. Otherwise the absolute URL is constructed based
// on the browser's request. Setting the `baseUrl` global option is
// necessary for reasonable URLs when generating markup from a
// command line task.
//
// ### `address`
//
// Apostrophe listens for connections on all interfaces (`0.0.0.0`)
// unless this option is set to another address.
//
// In any case, if the `ADDRESS` environment variable is set, it is
// used instead.
//
// ### `port`
//
// Apostrophe listens for connections on port `3000` unless this
// option is set to another port.
//
// In any case, if the `PORT` environment variable is set, it is used
// instead.
//
// ### `bodyParser`
//
// The `json` and `urlencoded` properties of this object are merged
// with Apostrophe's default options to be passed to the `body-parser`
// npm module's `json` and `urlencoded` flavors of middleware.
//
// ### `prefix` *(a global option, not a module option)*
//
// This module implements parts of the sitewide `prefix` option, which is a global
// option to Apostrophe not specific to this module. If a `prefix` such
// as `/blog` is present, the site responds with its home page
// at `/blog` rather than `/`. All calls to `res.redirect` are adjusted
// accordingly, and supporting code in other modules adjusts AJAX calls
// made by jQuery as well, so that your code does not have to be
// "prefix-aware" in order to work.
//
// ### `afterListen` *(a global option, not a module option)*
//
// If Apostrophe was configured with an `afterListen` option, that
// function is invoked after the site is ready to accept connections.
// An error will be passed if appropriate.
//
// ### `session`
//
// Properties of the `session` option are passed to the
// [express-session](https://npmjs.org/package/express-session) module.
// If each is not otherwise specified, Apostrophe enables these defaults:
//
// ```javascript
// {
//   // Do not save sessions until something is stored in them.
//   // Greatly reduces aposSessions collection size
//   saveUninitialized: false,
//   // The mongo store uses TTL which means we do need
//   // to signify that the session is still alive when someone
//   // views a page, even if their session has not changed
//   resave: true,
//   // Always update the cookie, so that each successive
//   // access revives your login session timeout
//   rolling: true,
//   secret: 'you should have a secret',
//   cookie: {
//     path: '/',
//     httpOnly: true,
//     secure: false,
//     // Default login lifetime between requests is one day
//     maxAge: 86400000
//   },
//   store: (instance of connect-mongo/es5 provided by Apostrophe)
// }
// ```
//
// If you want to use another session store, you can pass an instance,
// but it's easier to let Apostrophe do the work of setting it up:
//
// session: {
//   store: {
//     name: 'connect-redis',
//     options: {
//       // redis-specific options here
//     }
//   }
// }
//
// Just be sure to install `connect-redis`, or the store of your choice,
// as an npm dependency.
//
// ### `csrf`
//
// By default, Apostrophe implements Angular-compatible [CSRF protection](https://en.wikipedia.org/wiki/Cross-site_request_forgery)
// via an `XSRF-TOKEN` cookie. The `apostrophe-assets` module pushes
// a call to the browser to set a jQuery `ajaxPrefilter` which
// adds an `X-XSRF-TOKEN` header to all requests, which must
// match the cookie. This is effective because code running from
// other sites or iframes will not be able to read the cookie and
// send the header.
//
// All non-safe HTTP requests (not `GET`, `HEAD`, `OPTIONS` or `TRACE`)
// automatically receive this proection via the csrf middleware, which
// rejects requests in which the CSRF token does not match the header.
//
// If the `csrf` option is set to `false`, CSRF protection is
// disabled (NOT RECOMMENDED).
//
// If the `csrf` option is set to an object, you can configure
// individual exceptions:
//
// ```javascript
// csrf: {
//   exceptions: [ '/cheesy-post-route' ]
// }
// ```
//
// Exceptions may use minimatch wildcards (`*` and `**`). They can
// also be regular expression objects.
//
// You may need to use this feature when implementing POST form submissions that
// do not use AJAX and thus don't send the header. We recommend using
// `$.post` or `$.jsonCall` for your forms, which eliminates this issue.
//
// There is also a `minimumExceptions` option, which defaults
// to `[ /login ]`. The login form is the only non-AJAX form
// that ships with Apostrophe. XSRF protection for login forms
// is unnecessary because the password itself is unknown to the
// third party site; it effectively serves as an XSRF token.
//
// You can also pass options to the Express [`res.cookie`](https://expressjs.com/en/api.html#res.cookie) call that sets the cookie:
//
// ```javascript
// csrf: {
//   exceptions: [ '/cheesy-post-route' ],
//   cookie: {
//     // Send it only if the request is HTTPS
//     secure: true
//   },
//   // Disable storing a true random CSRF token in sessions for all site visitors.
//   // Some protection is still provided via a well-known token and the Same Origin Policy.
//   // Logged-in users always get a true random CSRF token in their session.
//   // This setting is recommended because otherwise a session must be stored for
//   // 100% of site accesses.
//   disableAnonSession: true
// }
// ```
//
// Do not set the `httpOnly` flag as this will prevent legitimate same-origin
// JavaScript from adding it to requests.
//
// ### middleware
//
// If a `middleware` array is present, those functions are added
// as Express middleware by the `requiredMiddleware` method, immediately
// after Apostrophe's standard middleware.
//
// ## Optional middleware: `apos.middleware`
//
// This module adds a few useful but optional middleware functions
// to the `apos.middleware` object for your use where appropriate:
//
// ### `apos.middleware.files`
//
// This middleware function accepts file uploads and makes them
// available via `req.files`. See the
// [connect-multiparty](https://npmjs.org/package/connect-multiparty) npm module.
// This middleware is used by [apostrophe-attachments](/reference/modules/apostrophe-attachments).
//
// ## Module-specific middleware
//
// In addition, this module will look for an `expressMiddleware` property
// in EVERY module. If such a property is found, it will be invoked as
// middleware on ALL routes, after the required middleware (such as the body parser) and
// before the configured middleware. If the property is an array, all of the functions
// in the array are invoked as middleware.
//
// If `expressMiddleware` is a non-array object, it must have a `middleware`
// property containing a function or an array of functions, and it may also have a
// `before` property containing the name of another module. The function(s) in the
// `middleware` property will be run before those for the named module.
//
// If you need to run the middleware very early, the object may also have a
// `when` property, which may be set to `beforeRequired` (the absolute
// beginning, before even req.body is available), `afterRequired` (after all
// middleware shipped with apostrophe-express but before all middleware passed
// to it as options), or `afterConfigured` (the default, with other module
// middleware).

var fs = require('fs');
var _ = require('@sailshq/lodash');
var minimatch = require('minimatch');
var async = require('async');
var enableDestroy = require('server-destroy');

module.exports = {

  afterConstruct: function(self) {
    self.createApp();
    self.prefix();
    // for bc make sure this method can accept an argument
    if (self.useModuleMiddleware.length === 1) {
      self.useModuleMiddleware('beforeRequired');
    }
    self.requiredMiddleware();
    // No bc check needed because this is the original place we called it
    self.useModuleMiddleware('afterRequired');
    self.configuredMiddleware();
    if (self.useModuleMiddleware.length === 1) {
      self.useModuleMiddleware('afterConfigured');
    }
    self.optionalMiddleware();
    self.addListenMethod();
    if (self.options.baseUrl && (!self.apos.baseUrl)) {
      self.apos.utils.error('WARNING: you have baseUrl set as an option to the `apostrophe-express` module.');
      self.apos.utils.error('Set it as a global option (a property of the main object passed to apostrophe).');
      self.apos.utils.error('When you do so other modules will also pick up on it and make URLs absolute.');
    }
  },

  construct: function(self, options) {

    var express = require('express');
    var bodyParser = require('body-parser');
    var expressSession = require('express-session');
    var connectFlash = require('connect-flash');
    var cookieParser = require('cookie-parser');

    // Create Apostrophe's `apos.app` and `apos.express` objects

    self.createApp = function() {
      self.apos.app = self.apos.baseApp = express();
      self.apos.express = express;
    };

    // Patch Express so that all calls to `res.redirect` honor
    // the global `prefix` option without the need to make each
    // call "prefix-aware"

    self.prefix = function() {
      if (self.apos.prefix) {
        // Use middleware to patch the redirect method to accommodate
        // the prefix. This is cleaner than patching the prototype, which
        // breaks if you have multiple instances of Apostrophe, such as
        // in our unit tests. Also make res.rawRedirect available for
        // edge cases where a new URL is built from a URL that is
        // already prefixed.
        self.apos.app.use(function(req, res, next) {
          res.rawRedirect = res.redirect;
          res.redirect = function(status, url) {
            if (arguments.length === 1) {
              url = status;
              status = 302;
            }
            if (!url.match(/^[a-zA-Z]+:/)) {
              url = self.apos.prefix + url;
            }
            return res.rawRedirect(status, url);
          };
          return next();
        });

        self.apos.baseApp = express();
        self.apos.baseApp.use(self.apos.prefix, self.apos.app);
      } else {
        // res.rawRedirect must be available whether prefix is present or not
        self.apos.app.use(function(req, res, next) {
          res.rawRedirect = res.redirect;
          return next();
        });
      }
    };

    // Standard middleware. Creates the `req.data` object, so that all
    // code wishing to eventually add properties to the `data` object
    // seen in Nunjucks templates may assume it already exists

    self.createData = function(req, res, next) {
      if (!req.data) {
        req.data = {};
      }
      return next();
    };

    // Establish Express sessions. See [options](#options)

    self.sessions = function() {
      var Store;
      self.options.session = self.options.session || {};
      var sessionOptions = self.options.session;
      _.defaults(sessionOptions, {
        // Do not save sessions until something is stored in them.
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
        name: self.apos.shortName + '.sid',
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
        self.apos.utils.error('WARNING: No session secret provided, please set the `secret` property of the `session` property of the apostrophe-express module in app.js');
      }
      if (!sessionOptions.store) {
        sessionOptions.store = {};
      }
      if (sessionOptions.store.createSession) {
        // Already an instantiated store object.
        // Duck typing: don't be picky about who constructed who
      } else {
        if (!sessionOptions.store.options) {
          sessionOptions.store.options = {};
        }
        // Some stores will flip out if you pass them a mongo db as an option,
        // but try to help all flavors of connect-mongo
        var name = sessionOptions.store.name;
        if ((!name) || (name.match(/^connect-mongo/))) {
          if (!sessionOptions.store.options.db) {
            sessionOptions.store.options.db = self.apos.db;
          }
        }
        if (!sessionOptions.store.name) {
          // baked in legacy compatible version
          Store = require('./lib/connect-mongo/es5.js')(expressSession);
        } else {
          // require from project's dependencies
          Store = self.apos.root.require(sessionOptions.store.name)(expressSession);
        }
        sessionOptions.store = new Store(sessionOptions.store.options);
      }

      // Exported for the benefit of code that needs to
      // interoperate in a compatible way with express-sessions
      self.sessionOptions = sessionOptions;
      self.apos.app.use(expressSession(sessionOptions));

    };

    // Install all standard middleware:
    //
    // * Create the `req.data` object on all requests
    // * Implement Express sessions
    // * Add the cookie parser
    // * Angular-style CSRF protection
    // * Extended body parser (`req.body` supports nested objects)
    // * JSON body parser (useful with `$.jsonCall`)
    // * Flash messages (see [connect-flash](https://github.com/jaredhanson/connect-flash))
    // * Internationalization (see [apostrophe-i18n](apostrophe-i18n.md))
    // * `req.absoluteUrl` always available (also see [baseUrl](#baseUrl))
    //

    self.requiredMiddleware = function() {

      self.apos.app.use(self.createData);

      self.sessions();

      // First so self.csrf can use it.
      self.apos.app.use(cookieParser());

      // Allow the options for bodyParser to be customized
      // in app.js
      var bodyParserOptions = _.extend({
        json: {
          limit: '16mb'
        },
        urlencoded: {
          extended: true
        }
      }, options.bodyParser);

      // extended: true means that people[address[street]] works
      // like it does in a PHP urlencoded form. This has a cost
      // but is too useful and familiar to leave out. -Tom and Ben

      self.apos.app.use(bodyParser.urlencoded(bodyParserOptions.urlencoded));
      self.apos.app.use(bodyParser.json(bodyParserOptions.json));
      self.apos.app.use(connectFlash());
      self.apos.app.use(self.apos.i18n.init);
      self.apos.app.use(self.apos.modules['apostrophe-i18n'].namespacesMiddleware);
      self.apos.app.use(self.absoluteUrl);
      self.apos.app.use(self.htmlPageId);

      // self.apos.app.use(function(req, res, next) {
      //   self.apos.utils.log('URL: ' + req.url);
      //   return next();
      // });

    };

    // For bc, in case an existing override of `useModuleMiddleware` doesn't know better
    self.moduleMiddleware = [];

    // Broken down by when it will run
    self.moduleMiddlewareByWhen = {
      beforeRequired: [],
      afterRequired: [],
      afterConfigured: []
    };

    // Implement middleware added via self.expressMiddleware properties in modules.
    self.useModuleMiddleware = function(when) {
      self.apos.app.use(function(req, res, next) {
        return async.eachSeries(self.moduleMiddlewareByWhen[when], function(fn, callback) {
          return fn(req, res, function() {
            return callback(null);
          });
        }, next);
      });
    };

    self.configuredMiddleware = function() {
      if (options.middleware) {
        _.each(options.middleware, function(fn) {
          self.apos.app.use(fn);
        });
      }
    };

    // Enable CSRF protection middleware. See
    // `compileCsrfExceptions` for details on how to
    // exclude a route from this.

    self.enableCsrf = function() {
      // The kernel of apostrophe in browserland needs this info, so
      // make it conveniently available to the assets module when it
      // picks a few properties from apos to boot that up
      self.apos.csrfCookieName = (self.options.csrf && self.options.csrf.name) ||
        self.apos.shortName + '.csrf';
      self.compileCsrfExceptions();
    };

    // Compile CSRF exceptions, which may be regular expression objects or
    // "minimatch" strings using the * and ** wildcards. They are
    // taken from `options.csrf.exceptions`. `/login`, `/password-reset` and `/password-reset-request`
    // are exceptions by default, which can be overridden via `options.csrf.minimumExceptions`.
    // Also invokes the `csrfExceptions` Apostrophe event, passing
    // the array of exceptions so it can be added to or otherwise modified
    // by modules such as `apostrophe-headless`.

    self.compileCsrfExceptions = function() {
      var list = (self.options.csrf && self.options.csrf.minimumExceptions) || [self.apos.login.getLoginUrl(), '/login', '/password-reset', '/password-reset-request'];
      list = list.concat((self.options.csrf && self.options.csrf.exceptions) || []);
      self.apos.emit('csrfExceptions', list);
      self.csrfExceptions = _.map(list, function(e) {
        if (e instanceof RegExp) {
          return e;
        }
        return minimatch.makeRe(e);
      });
    };

    // Angular-compatible CSRF protection middleware. On safe requests (GET, HEAD, OPTIONS, TRACE),
    // set the XSRF-TOKEN cookie if missing. On unsafe requests (everything else),
    // make sure our jQuery `ajaxPrefilter` set the X-XSRF-TOKEN header to match the
    // cookie.
    //
    // This works because if we're running via a script tag or iframe, we won't
    // be able to read the cookie.
    //
    // [See the Angular docs for further discussion of this strategy.](https://docs.angularjs.org/api/ng/service/$http#cross-site-request-forgery-xsrf-protection)

    self.csrf = function(req, res, next) {

      if (_.find(self.csrfExceptions || [], function(e) {
        return req.url.match(e);
      })) {
        return next();
      }
      return self.csrfWithoutExceptions(req, res, next);
    };

    // See the `csrf` middleware method. This middleware method
    // performs the actual CSRF check, without checking for exceptions
    // first. It does check for and allow safe methods. This
    // method is useful when you have made your own determination
    // that this URL should be subject to CSRF.

    self.csrfWithoutExceptions = function(req, res, next) {
      var token;
      // OPTIONS request cannot set a cookie, so manipulating the session here
      // is not helpful. Do not attempt to set XSRF-TOKEN for OPTIONS
      if (req.method === 'OPTIONS') {
        return next();
      }
      // Safe request establishes XSRF-TOKEN in session if not set already
      if ((req.method === 'GET') || (req.method === 'HEAD') || (req.method === 'TRACE')) {

        token = req.session && req.session['XSRF-TOKEN'];

        if (!token) {
          if (!req.user && (self.options.csrf && self.options.csrf.disableAnonSession)) {
            token = 'csrf-fallback';
          } else {
            token = self.apos.utils.generateId();
            req.session['XSRF-TOKEN'] = token;
          }
        }
        // Always reset the cookie so that if its lifetime somehow detaches from
        // that of the session cookie we're still OK
        res.cookie(self.apos.csrfCookieName, token, (self.options.csrf && self.options.csrf.cookie) || {});
      } else {
        // All non-safe requests must be preceded by a safe request that establishes
        // the CSRF token, both as a cookie and in the session. Otherwise a user who is logged
        // in but doesn't currently have a CSRF token is still vulnerable.
        // See options.csrf.exceptions

        if (!req.user && (self.options.csrf && self.options.csrf.disableAnonSession)) {
          if (req.get('X-XSRF-TOKEN') !== 'csrf-fallback') {
            res.statusCode = 403;
            warn();
            return res.send('forbidden');
          }
        } else if ((!req.cookies[self.apos.csrfCookieName]) || (req.get('X-XSRF-TOKEN') !== req.cookies[self.apos.csrfCookieName]) || (req.session['XSRF-TOKEN'] !== req.cookies[self.apos.csrfCookieName])) {
          res.statusCode = 403;
          warn();
          return res.send('forbidden');
        }
      }
      return next();
      function warn() {
        self.apos.utils.warnDevOnce('csrf', '\n⚠️ A request for ' + req.url + ' was rejected\ndue to the absence of a CSRF token. If you experience this while editing\nnormally with Apostrophe during development, try logging out and logging in\nagain. If you experience it accessing a custom route, please read:\n\nhttps://apos.dev/csrf');
      }
    };

    // Establish optional middleware functions as properties
    // of the `apos.middleware` object. Currently just `apos.middleware.files`.

    self.optionalMiddleware = function() {
      // Middleware that is not automatically installed on
      // every route but is recommended for use in your own
      // routes when needful
      self.apos.middleware = {
        files: require('connect-multiparty')()
      };
    };

    // Establish the `apos.listen` method, which Apostrophe will invoke
    // at the end of its initialization process.

    self.addListenMethod = function() {
      self.apos.listen = function() {

        var port;
        var address;

        try {
          if (self.options.forcePort !== undefined) {
            port = self.options.forcePort;
          } else if (self.options.port !== undefined) {
            port = self.options.port;
          }

          if (!self.options.forcePort) {
            if (process.env.PORT) {
              port = process.env.PORT;
            } else {
              if (fs.existsSync(self.apos.rootDir + '/data/port')) {
                // Stagecoach option
                port = fs.readFileSync(self.apos.rootDir + '/data/port', 'UTF-8').replace(/\s+$/, '');
              }
            }
          }

          if (port === undefined) {
            port = 3000;
            self.apos.utils.log("I see no data/port file, port option, forcePort option, or PORT environment variable,\ndefaulting to port " + port);
          }

          if ((typeof port) !== 'number') {
            port = Number.isNaN(parseInt(port)) ? port : parseInt(port);
          }

          if (self.options.forceAddress) {
            address = self.options.forceAddress;
          } else if (self.options.address) {
            address = self.options.address;
          }

          if (!self.options.forceAddress) {
            if (process.env.ADDRESS) {
              address = process.env.ADDRESS;
            } else {
              if (fs.existsSync(self.apos.rootDir + '/data/address')) {
                // Stagecoach option
                address = fs.readFileSync(self.apos.rootDir + '/data/address', 'UTF-8').replace(/\s+$/, '');
              }
            }
          }

          if (address === undefined) {
            address = false;
            self.apos.utils.log('I see no data/address file, address option, forceAddress option, or ADDRESS environment variable,\nlistening on all interfaces');
          }

          if (address !== false) {
            self.server = self.apos.baseApp.listen(port, address);
            self.server.on('listening', listening);
          } else {
            self.server = self.apos.baseApp.listen(port);
            self.server.on('listening', listening);
          }

        } catch (e) {
          if (self.apos.options.afterListen) {
            return self.apos.options.afterListen(e);
          } else {
            self.apos.utils.error(e);
            process.exit(1);
          }
        }

        function listening() {
          enableDestroy(self.server);
          self.port = self.server.address().port;
          self.address = address;
          if (address) {
            self.apos.utils.log('Listening on http://' + address + ':' + port);
          } else {
            self.apos.utils.log('Listening at http://localhost:' + port);
          }
          if (self.apos.options.afterListen) {
            return self.apos.options.afterListen(null);
          }
        }

        self.server.on('error', function(err) {
          if (self.apos.options.afterListen) {
            return self.apos.options.afterListen(err);
          }
        });
      };
    };

    // Invoked by `callAll` when `apos.destroy` is called.
    // Destroys the HTTP server object, freeing the port.

    self.apostropheDestroy = function(callback) {
      if (!(self.server && self.server.destroy)) {
        return setImmediate(callback);
      }
      return self.server.destroy(callback);
    };

    // Standard middleware. Sets the `req.absoluteUrl` property for all requests,
    // based on the `baseUrl` option if available, otherwise based on the user's
    // request headers. The global `prefix` option and `req.url` are then appended.
    //
    // `req.baseUrl` and `req.baseUrlWithPrefix` are also made available, and all three
    // properties are also added to `req.data` if not already present.
    //
    // The `baseUrl` option should be configured at the top level, for Apostrophe itself,
    // NOT specifically for this module, but for bc the latter is also accepted in this
    // one case. For a satisfyingly global result, set it at the top level instead.

    self.absoluteUrl = function(req, res, next) {
      self.addAbsoluteUrlsToReq(req);
      next();
    };

    // Makes the `Apostrophe-Html-Page-Id` header available
    // as `req.htmlPageId`. This header is passed by
    // all jQuery AJAX requests made by Apostrophe. It
    // contains a unique identifier just for the current
    // webpage in the browser; that is, navigating to a new
    // page always generates a *new* id, the same page in two tabs
    // will have *different* ids, etc. This makes it easy to
    // identify requests that come from the "same place"
    // for purposes of conflict resolution and locking.
    // (Note that conflicts can occur between two tabs
    // belonging to the same user, so a session ID is not enough.)

    self.htmlPageId = function(req, res, next) {
      req.htmlPageId = req.header('Apostrophe-Html-Page-Id');
      next();
    };

    // Sets the `req.absoluteUrl` property for all requests,
    // based on the `baseUrl` option if available, otherwise based on the user's
    // request headers. The global `prefix` option and `req.url` are then appended.
    //
    // `req.baseUrl` and `req.baseUrlWithPrefix` are also made available, and all three
    // properties are also added to `req.data` if not already present.
    //
    // The `baseUrl` option should be configured at the top level, for Apostrophe itself,
    // NOT specifically for this module, but for bc the latter is also accepted in this
    // one case. For a satisfyingly global result, set it at the top level instead.
    //
    // If you want reasonable URLs in req objects used in tasks you must
    // set the `baseUrl` option for Apostrophe.

    self.addAbsoluteUrlsToReq = function(req) {
      req.baseUrl = (self.apos.baseUrl || self.options.baseUrl || (req.protocol + '://' + req.get('Host')));
      req.baseUrlWithPrefix = req.baseUrl + self.apos.prefix;
      req.absoluteUrl = req.baseUrlWithPrefix + req.url;
      _.defaults(req.data, _.pick(req, 'baseUrl', 'baseUrlWithPrefix', 'absoluteUrl'));
    };

    // Locate modules with middleware and add it to the list.
    // Also compile the CSRF exceptions, late, so that other
    // modules can respond to the `csrfExceptions` event.
    self.afterInit = function() {
      self.enableCsrf();
      self.findModuleMiddleware();
    };

    // Locate modules with middleware and add it to the list
    self.findModuleMiddleware = function() {
      var labeledList = [];
      var obj;
      _.each(self.apos.modules, function(module, name) {
        if (!module.expressMiddleware) {
          return;
        }
        var prop = module.expressMiddleware;
        if (Array.isArray(prop) || (typeof (prop) === 'function')) {
          obj = {
            middleware: prop
          };
        } else {
          obj = prop;
        }
        obj.module = name;
        // clone so we can safely delete a property
        labeledList.push(_.clone(obj));
      });
      do {
        var beforeIndex = _.findIndex(labeledList, function(item) {
          return item.before;
        });
        if (beforeIndex === -1) {
          break;
        }
        var item = labeledList[beforeIndex];
        var otherIndex = _.findIndex(labeledList, { module: item.before });
        if ((otherIndex !== -1) && (otherIndex < beforeIndex)) {
          labeledList.splice(beforeIndex, 1);
          labeledList.splice(otherIndex, 0, item);
        }
        delete item.before;
      } while (true);
      _.each(labeledList, function(item) {
        var prop = item.middleware;
        var when = item.when || 'afterRequired';
        if (Array.isArray(prop)) {
          self.moduleMiddlewareByWhen[when] = self.moduleMiddlewareByWhen[when].concat(prop);
          // bc
          self.moduleMiddleware = self.moduleMiddleware.concat(prop);
        } else if (typeof (prop) === 'function') {
          self.moduleMiddlewareByWhen[when].push(prop);
          // bc
          self.moduleMiddleware.push(prop);
        }
      });
    };
  }
};
