// This module initializes the Express framework, which Apostrophe
// uses and extends to implement both API routes and page-serving routes.
// The Express `app` object is made available as `apos.app`, and
// the `express` object itself as `apos.express`. You can add
// Express routes directly in your modules via `apos.app.get`,
// `apos.app.post`, etc., however be sure to also check
// out the [route method](../apostrophe-module/index.html#route) available
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
//```javascript
// {
//   // Do not save sesions until something is stored in them.
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
//   store: // creates an instance of connect-mongo/es5
// }
//```
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
// This middleware is used by [apostrophe-attachments](../apostrophe-attachments/index.html).
//
// ## Module-specific middleware
//
// In addition, this module will look for an `expressMiddleware` property
// in EVERY module. If such a property is found, it will be invoked as
// middleware on ALL routes, after the required middleware (such as the body parser) and
// before the configured middleware. If the property is an array, all of the functions
// in the array are invoked as middleware.

var fs = require('fs');
var _ = require('lodash');
var minimatch = require('minimatch');
var async = require('async');

module.exports = {

  afterConstruct: function(self) {
    self.createApp();
    self.prefix();
    self.requiredMiddleware();
    self.useModuleMiddleware();
    self.configuredMiddleware();
    self.optionalMiddleware();
    self.addListenMethod();
    self.enableCsrf();
    if (self.options.baseUrl && (!self.apos.baseUrl)) {
      console.error('WARNING: you have baseUrl set as an option to the `apostrophe-express` module.');
      console.error('Set it as a global option (a property of the main object passed to apostrophe).');
      console.error('When you do so other modules will also pick up on it and make URLs absolute.');
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

    // Standard middleware. Creates the `req.data` object, so that all
    // code wishing to eventually add properties to the `data` object
    // seen in Nunjucks templates may assume it already exists

    self.createData = function(req, res, next) {
      if(!req.data) {
        req.data = {};
      }
      return next();
    };

    // Establish Express sesions. See [options](#options)

    self.sessions = function() {
      var sessionOptions = self.options.session || {};
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
        console.error('WARNING: No session secret provided, please set the `secret` property of the `session` property of the apostrophe-express module in app.js');
      }
      if (!sessionOptions.store) {
        var MongoStore = require('connect-mongo/es5')(expressSession);
        sessionOptions.store = new MongoStore({ db: self.apos.db });
      }
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
    // * Internationalization (see [apostrophe-i18n](../apostrophe-i18n/index.html))
    // * `req.absoluteUrl` always available (also see [baseUrl](#baseUrl))
    //

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

      
      // Allow the options for bodyParser to be customized
      // in app.js
      var bodyParserOptions = _.extend({
        json:{ },
        urlencoded:{extended: true}
      },options.bodyParser);

      
      // extended: true means that people[address[street]] works
      // like it does in a PHP urlencoded form. This has a cost
      // but is too useful and familiar to leave out. -Tom and Ben

      self.apos.app.use(bodyParser.urlencoded(bodyParserOptions.urlencoded));
      self.apos.app.use(bodyParser.json(bodyParserOptions.json));
      self.apos.app.use(connectFlash());
      self.apos.app.use(self.apos.i18n.init);
      self.apos.app.use(self.absoluteUrl);

      // self.apos.app.use(function(req, res, next) {
      //   console.log('URL: ' + req.url);
      //   return next();
      // });

    };

    self.moduleMiddleware = [];
    
    // Implement middleware added via self.expressMiddleware properties in modules.
    self.useModuleMiddleware = function() {
      self.apos.app.use(function(req, res, next) {
        return async.eachSeries(self.moduleMiddleware, function(fn, callback) {
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
    
    self.enableCsrf = function() {
      // The kernel of apostrophe in browserland needs this info, so
      // make it conveniently available to the assets module when it
      // picks a few properties from apos to boot that up
      self.apos.csrfCookieName = (self.options.csrf && self.options.csrf.name) ||
        self.apos.shortName + '.csrf';
      self.compileCsrfExceptions();
    };

    // Compile CSRF exceptions, which may be regular expression objects or
    // "minimatch" strings using the * and ** wildcards

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

    // Angular-compatible CSRF protection. On safe requests (GET, HEAD, OPTIONS, TRACE),
    // set the XSRF-TOKEN cookie if missing. On unsafe requests (everything else),
    // make sure our jQuery `ajaxPrefilter` set the X-XSRF-TOKEN header to match the
    // cookie.
    //
    // This works because if we're running via a script tag or iframe, we won't
    // be able to read the cookie.
    //
    // [See the Angular docs for further discussion of this strategy.](https://docs.angularjs.org/api/ng/service/$http#cross-site-request-forgery-xsrf-protection)

    self.csrf = function(req, res, next) {

      var token;

      if (_.find(self.csrfExceptions || [], function(e) {
        return req.url.match(e);
      })) {
        return next();
      }

      // All non-safe methods are subject to CSRF by default
      if ((req.method === 'GET') || (req.method === 'HEAD') || (req.method === 'OPTIONS') || (req.method === 'TRACE')) {
        token = req.session && req.session['XSRF-TOKEN'];
        if (!token) {
          token = self.apos.utils.generateId();
          req.session['XSRF-TOKEN'] = token;
        }
        // Reset the cookie so that if its lifetime somehow detaches from
        // that of the session cookie we're still OK
        res.cookie(self.apos.csrfCookieName, token);
      } else {
        // All non-safe requests must be preceded by a safe request that establishes
        // the CSRF token, both as a cookie and in the session. Otherwise a user who is logged
        // in but doesn't currently have a CSRF token is still vulnerable.
        // See options.csrfExceptions
        if ((!req.cookies[self.apos.csrfCookieName]) || (req.get('X-XSRF-TOKEN') !== req.cookies[self.apos.csrfCookieName]) || (req.session['XSRF-TOKEN'] !== req.cookies[self.apos.csrfCookieName])) {
          res.statusCode = 403;
          return res.send('forbidden');
        }
      }
      return next();
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
    
    // Locate modules with middleware and add it to the list
    self.afterInit = function() {
      self.findModuleMiddleware();
    }
    
    // Locate modules with `expressMiddleware` properties and add those functions or arrays
    // of functions the list in `self.moduleMiddleware`.
    //
    // If `expressMiddleware` is an object, look for function(s) in its `middleware` property
    // and implement the `before` option if present.

    self.findModuleMiddleware = function() {
      var labeledList = [];
      _.each(self.apos.modules, function(module, name) {
        var prop = module.expressMiddleware;
        var obj;
        if (!prop) {
          return;
        }
        if (Array.isArray(prop) || (typeof(prop) === 'function')) {
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
      } while(true);
      console.log(labeledList);
      _.each(labeledList, function(item) {
        var prop = item.middleware;
        if (Array.isArray(prop)) {
          self.moduleMiddleware = self.moduleMiddleware.concat(prop);
        } else if (typeof(prop) === 'function') {
          self.moduleMiddleware.push(prop);
        }
      });
    };
  }
};
