// This module initializes the Express framework, which Apostrophe
// uses and extends to implement both API routes and page-serving routes.
// The Express `app` object is made available as `apos.app`, and
// the `express` object itself as `apos.express`. You can add
// Express routes directly in your modules via `apos.app.get`,
// `apos.app.post`, etc., however be sure to also check
// out the [route method](../@apostrophecms/module/index.html#route) available
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
//   // We are using the 3.x mongo store which is compatible
//   // with resave: false, preventing the vast majority of
//   // session-related race conditions
//   resave: false,
//   // Always update the cookie, so that each successive
//   // access revives your login session timeout
//   rolling: true,
//   secret: 'you should have a secret',
//   name: self.apos.shortName + '.sid',
//   cookie: {}
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
// as an npm dependency of your project.
//
// ### `csrf`
//
// By default, Apostrophe implements Angular-compatible [CSRF protection](https://en.wikipedia.org/wiki/Cross-site_request_forgery)
// via an `XSRF-TOKEN` cookie. The `@apostrophecms/asset` module pushes
// a call to the browser to set a jQuery `ajaxPrefilter` which
// adds an `X-XSRF-TOKEN` header to all requests, which must
// match the cookie. This is effective because code running from
// other sites or iframes will not be able to read the cookie and
// send the header.
//
// All non-safe HTTP requests (not `GET`, `HEAD`, `OPTIONS` or `TRACE`)
// automatically receive this proection via the csrf middleware, which
// rejects requests in which the CSRF token does not match the header.
// If the request was made with a valid api key or bearer token it
// bypasses this check.
//
// If the `csrf` option is set to `false`, CSRF protection is
// disabled (NOT RECOMMENDED).
//
// You can configure exceptions to CSRF protection
// by setting the `csrfExceptions` option of ANY MODULE
// to an array of route names specific to that module, or URLs
// (starting with `/`). Exceptions may use minimatch wildcards
// (`*` and `**`).
//
// You may need to use this feature when implementing POST form
// submissions that do not use AJAX and thus don't send the header.
//
// There is also a `minimumExceptions` option, which defaults
// to `[ /login ]`. The login form is the only non-AJAX form
// that ships with Apostrophe. XSRF protection for login forms
// is unnecessary because the password itself is unknown to the
// third party site; it effectively serves as an XSRF token.
//
// ### Adding your own middleware
//
// Use the `middleware` section in your module. That function should
// return an object containing named middleware functions. These are
// activated for all requests.
//
// ### trustProxy
//
// Enables the ["trust proxy" option for Express](https://expressjs.com/en/api.html#trust.proxy.options.table).
// Set to `true` to tell the Express app to  respect `X-Forwarded-* ` headers.
// This is helpful when Apostrophe is generating `http:` URLs even though a
// proxy like nginx is being used to serve it over `https:`.

const fs = require('fs');
const _ = require('lodash');
const minimatch = require('minimatch');
const enableDestroy = require('server-destroy');
const express = require('express');
const bodyParser = require('body-parser');
const expressSession = require('express-session');
const cookieParser = require('cookie-parser');
const qs = require('qs');
const expressBearerToken = require('express-bearer-token');
const cors = require('cors');
const Promise = require('bluebird');

module.exports = {
  init(self) {
    self.createApp();
    self.prefix();
    self.trustProxy();
    if (self.options.baseUrl && !self.apos.baseUrl) {
      self.apos.util.error('WARNING: you have baseUrl set as an option to the `@apostrophecms/express` module.');
      self.apos.util.error('Set it as a global option (a property of the main object passed to apostrophe).');
      self.apos.util.error('When you do so other modules will also pick up on it and make URLs absolute.');
    }
  },
  handlers(self) {
    return {
      'apostrophe:run': {
        async listenIfNotTask(isTask) {
          if (isTask) {
            return;
          }
          await self.listen();
          // Emit the @apostrophecms/express:afterListen event
          await self.emit('afterListen');
        }
      },
      'apostrophe:destroy': {
        async destroyServer() {
          if (!(self.server && self.server.destroy)) {
            return;
          }
          return require('util').promisify(self.server.destroy)();
        }
      },
      'apostrophe:modulesRegistered': {
        addCsrf() {
          self.enableCsrf();
        },
        async addModuleMiddlewareAndRoutes() {
          // This has to happen on modulesReady, so that it happens before
          // the adding of routes by other, later modules on modulesReady,
          // and before the adding of the catch-all route for pages
          // on afterInit
          await self.findModuleMiddlewareAndRoutes();
          for (const item of self.finalModuleMiddlewareAndRoutes) {
            if (item.method) {
              self.apos.app[item.method](item.url, item.route);
            } else if (item.middleware) {
              if (item.url) {
                self.apos.app.use(item.url, item.middleware);
              } else {
                self.apos.app.use(item.middleware);
              }
            } else if ((typeof item) === 'function') {
              // Simple middleware
              self.apos.app.use(item);
            } else {
              throw self.apos.error('error', 'Unrecognized entry on finalModuleMiddlewareAndRoutes chain', item);
            }
          }
        }
      }
    };
  },

  middleware(self) {
    return {
      // Enable CORS headers for all APIs
      enableCors: {
        url: '/api/v1',
        middleware: cors()
      },
      attachUtilityMethods(req, res, next) {
        // We apply the super pattern variously to res.redirect,
        // make sure the original version is always available
        res.rawRedirect = res.redirect;
        // Convenient way to make a new req object with
        // some tweaked properties
        req.clone = (properties = {}) => {
          return self.apos.util.cloneReq(req, properties);
        };
        return next();
      },
      createDataAndGuards(req, res, next) {
        if (!req.data) {
          req.data = {};
        }
        req.aposNeverLoad = {};
        req.aposStack = [];
        return next();
      },
      sessions: expressSession(self.getSessionOptions()),
      cookieParser: cookieParser(),
      apiKeys(req, res, next) {
        const key = req.query.apikey || req.query.apiKey || getAuthorizationApiKey();
        let taskReq;
        if (!key) {
          return next();
        }
        if (_.has(self.options.apiKeys && self.options.apiKeys, key)) {
          const info = self.options.apiKeys[key];
          if (info.role === 'admin') {
            taskReq = self.apos.task.getReq();
          } else {
            taskReq = self.apos.task.getAnonReq();
          }
          req.user = taskReq.user;
          req.csrfExempt = true;
          return next();
        }
        return res.status(403).send({ error: 'invalid api key' });

        function getAuthorizationApiKey() {
          const header = req.headers.authorization;
          if (!header) {
            return null;
          }
          const matches = header.match(/^ApiKey\s+(\S.*)$/i);
          if (!matches) {
            return null;
          }
          return matches[1];
        }
      },
      expressBearerTokenMiddleware: expressBearerToken(self.options.expressBearerToken || {}),
      async bearerTokens(req, res, next) {
        if (!req.token) {
          return next();
        }
        try {
          const userId = await getBearer();
          if (userId) {
            req.user = await deserializeUser(userId);
          }
          if (!req.user) {
            return res.status(401).send({
              name: 'invalid',
              message: 'bearer token invalid'
            });
          }
          req.csrfExempt = true;
          return next();
        } catch (e) {
          self.apos.utils.error(e);
          return res.status(500).send({
            name: 'error'
          });
        }
        async function getBearer() {
          // The expireAfterSeconds feature of mongodb
          // is not instantaneous so we should check
          // "expires" ourselves too
          const bearer = await self.apos.login.bearerTokens.findOne({
            _id: req.token,
            expires: { $gte: new Date() }
          });
          return bearer && bearer.userId;
        }
        async function deserializeUser(userId) {
          return self.apos.login.deserializeUser(userId);
        }
      },
      ...((self.options.csrf === false) ? {} : {
        // Angular-compatible CSRF protection middleware. On safe requests (GET, HEAD, OPTIONS, TRACE),
        // set the XSRF-TOKEN cookie if missing. On unsafe requests (everything else),
        // make sure our jQuery `ajaxPrefilter` set the X-XSRF-TOKEN header to match the
        // cookie.
        //
        // This works because if we're running via a script tag or iframe, we won't
        // be able to read the cookie.
        csrf(req, res, next) {
          if (req.csrfExempt) {
            return next();
          }
          if (_.find(self.csrfExceptions || [], function (e) {
            return req.url.match(e);
          })) {
            return next();
          }
          return self.csrfWithoutExceptions(req, res, next);
        }
      }),
      bodyParserUrlencoded: bodyParser.urlencoded({
        extended: true,
        ...(self.options.bodyParser && self.options.bodyParser.urlencoded)
      }),
      bodyParserJson: bodyParser.json({
        limit: '16mb',
        ...(self.options.bodyParser && self.options.bodyParser.json)
      })
    };
  },

  methods(self) {
    return {

      // Create Apostrophe's `apos.app` and `apos.express` objects
      createApp() {
        self.apos.app = self.apos.baseApp = express();
        self.apos.express = express;
        self.apos.app.set('query parser', function (str) {
          return qs.parse(str, {
            strictNullHandling: true
          });
        });
      },

      // Patch Express so that all calls to `res.redirect` honor
      // the global `prefix` option and locale prefix without the need to
      // make each call "prefix-aware"
      prefix() {
        if (self.apos.prefix) {
          // Use middleware to patch the redirect method to accommodate
          // the prefix. This is cleaner than patching the prototype, which
          // breaks if you have multiple instances of Apostrophe, such as
          // in our unit tests. -Tom
          self.apos.app.use(function (req, res, next) {
            const superRedirect = res.redirect;
            res.redirect = function (status, url) {
              if (arguments.length === 1) {
                url = status;
                status = 302;
              }
              if (!url.match(/^[a-zA-Z]+:/)) {
                url = self.apos.prefix + url;
              }
              return superRedirect.call(this, status, url);
            };
            return next();
          });
          self.apos.baseApp = express();
          self.apos.baseApp.use(self.apos.prefix, self.apos.app);
        }
      },

      // Implement the trustProxy option
      trustProxy() {
        if (self.options.trustProxy) {
          self.apos.app.set('trust proxy', true);
        }
      },

      // Options to be passed to the express session options middleware
      getSessionOptions() {
        if (self.sessionOptions) {
          return self.sessionOptions;
        }
        let Store;
        const sessionOptions = self.options.session || {};
        _.defaults(sessionOptions, {
          // Do not save sessions until something is stored in them.
          // Greatly reduces aposSessions collection size
          saveUninitialized: false,
          // We are using the 3.x mongo store which is compatible
          // with resave: false, preventing the vast majority of
          // session-related race conditions
          resave: false,
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
          secure: false
          // maxAge is set for us by connect-mongo,
          // and defaults to 2 weeks
        });
        if (sessionOptions.secret === 'you should have a secret') {
          self.apos.util.error('WARNING: No session secret provided, please set the `secret` property of the `session` property of the @apostrophecms/express module in app.js');
        }
        if (!sessionOptions.store) {
          sessionOptions.store = {
            options: {
              // Performance enhancement: we need to touch the session
              // on at least some accesses to prevent expiration, but
              // once an hour is sufficient
              touchAfter: 3600
              // ttl (time to live) can be set in seconds here,
              // defaults to 2 weeks in mongo
            }
          };
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
          const name = sessionOptions.store.name;
          if (!name || name.match(/^connect-mongo/)) {
            if (!sessionOptions.store.options.client) {
              sessionOptions.store.options.client = self.apos.dbClient;
              sessionOptions.store.options.dbName = sessionOptions.store.options.dbName || self.apos.db.databaseName;
            }
          }
          if (!sessionOptions.store.name) {
            // require from this module's dependencies
            Store = require('connect-mongo')(expressSession);
          } else {
            // require from project's dependencies
            Store = self.apos.root.require(sessionOptions.store.name)(expressSession);
          }
          sessionOptions.store = new Store(sessionOptions.store.options);
        }
        // Exported for the benefit of code that needs to
        // interoperate in a compatible way with express-sessions
        self.sessionOptions = sessionOptions;
        return self.sessionOptions;
      },

      enableCsrf() {
        // The kernel of apostrophe in browserland needs this info, so
        // make it conveniently available to the assets module when it
        // picks a few properties from apos to boot that up
        self.apos.csrfCookieName = (self.options.csrf && self.options.csrf.name) || self.apos.shortName + '.csrf';
        self.compileCsrfExceptions();
      },

      // Compile CSRF exceptions configured via the `addCsrfExceptions` option of each module
      // that has one.

      compileCsrfExceptions() {
        let list = [];
        for (const module of Object.values(self.apos.modules)) {
          if (module.options.csrfExceptions) {
            list = list.concat(module.options.csrfExceptions.map(path => module.getRouteUrl(path)));
          }
        }
        self.csrfExceptions = list.map(function (e) {
          return minimatch.makeRe(e);
        });
      },

      // See the `csrf` middleware which checks for exceptions first. This method
      // performs the actual CSRF check, without checking for exceptions
      // first. It does check for and allow safe methods. This
      // method is useful when you have made your own determination
      // that this URL should be subject to CSRF.

      csrfWithoutExceptions(req, res, next) {
        let token;
        // OPTIONS request cannot set a cookie, so manipulating the session here
        // is not helpful. Do not attempt to set XSRF-TOKEN for OPTIONS
        if (req.method === 'OPTIONS') {
          return next();
        }
        // Safe request establishes XSRF-TOKEN in session if not set already
        if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'TRACE') {
          token = req.session && req.session['XSRF-TOKEN'];
          if (!token) {
            token = self.apos.util.generateId();
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
          if (!req.cookies[self.apos.csrfCookieName] || req.get('X-XSRF-TOKEN') !== req.cookies[self.apos.csrfCookieName] || req.session['XSRF-TOKEN'] !== req.cookies[self.apos.csrfCookieName]) {
            res.statusCode = 403;
            return res.send({
              name: 'forbidden',
              message: 'CSRF exception'
            });
          }
        }
        return next();
      },

      async listen() {

        let port;
        let address;

        if (process.env.PORT) {
          port = process.env.PORT;
        } else if (fs.existsSync(self.apos.rootDir + '/data/port')) {
          // Stagecoach option
          port = fs.readFileSync(self.apos.rootDir + '/data/port', 'UTF-8').replace(/\s+$/, '');
        } else {
          port = self.options.port;
        }

        if (port === undefined) {
          port = 3000;
        }

        if (typeof port === 'string') {
          port = Number.isNaN(parseInt(port)) ? port : parseInt(port);
        }

        if (process.env.ADDRESS) {
          address = process.env.ADDRESS;
        } else if (fs.existsSync(self.apos.rootDir + '/data/address')) {
          // Stagecoach option
          address = fs.readFileSync(self.apos.rootDir + '/data/address', 'UTF-8').replace(/\s+$/, '');
        } else {
          address = self.options.address;
        }

        if (address === undefined) {
          address = false;
        }

        const attempts = (process.env.NODE_ENV === 'production') ? 1 : 5;
        let attempt = 0;
        while (true) {
          try {
            await listen();
            break;
          } catch (e) {
            attempt++;
            if (attempt === attempts) {
              throw e;
            } else {
              // Work around frequent issue with nodemon due to long polling
              await Promise.delay(500);
            }
          }
        }
        self.apos.util.log(`Listening at http://${self.address}:${self.port}`);

        // awaitable listen function
        function listen() {
          if (address !== false) {
            self.server = self.apos.baseApp.listen(port, address);
          } else if (port) {
            self.server = self.apos.baseApp.listen(port);
          } else {
            self.server = self.apos.baseApp.listen();
          }
          return new Promise(function (resolve, reject) {
            self.server.on('error', function(e) {
              return reject(e);
            });
            self.server.on('listening', function () {
              self.address = self.server.address().address;
              if (self.address === '::') {
                // :: is not recognized as an ipv6 address by Chrome
                self.address = 'localhost';
              }
              self.port = self.server.address().port;
              enableDestroy(self.server);
              return resolve();
            });
          });
        }
      },

      // Locate modules with middleware and routes and add them to the list. By default
      // the order is: middleware of this module, then middleware of all other
      // modules in module registration order, then routes of all modules in
      // module registration order.
      //
      // The "before" keyword can be used to change this
      async findModuleMiddlewareAndRoutes() {
        await self.emit('compileRoutes');
        const labeledList = [];
        const moduleNames = Array.from(new Set([ self.__meta.name, ...Object.keys(self.apos.modules) ]));
        for (const name of moduleNames) {
          const middleware = self.apos.modules[name].middleware || {};
          labeledList.push({
            name: `middleware:${name}`,
            middleware: Object.values(middleware).filter(middleware => !middleware.before)
          });
        }
        for (const name of Object.keys(self.apos.modules)) {
          const _routes = self.apos.modules[name]._routes;
          labeledList.push({
            name: `routes:${name}`,
            routes: _routes.filter(route => !route.before)
          });
        }
        for (const name of Object.keys(self.apos.modules)) {
          const middleware = self.apos.modules[name].middleware || {};
          const _routes = self.apos.modules[name]._routes;
          for (const item of [ ...Object.values(middleware), ..._routes ]) {
            if (item.before) {
              let fullBeforeName = item.before;
              if ((!item.before.startsWith('routes:')) && (!item.before.startsWith('middleware:'))) {
                if (item.routes) {
                  fullBeforeName = `routes:${item.before}`;
                } else {
                  fullBeforeName = `middleware:${item.before}`;
                }
              }
              const before = labeledList.find(entry => entry.name === fullBeforeName);
              if (!before) {
                throw new Error(`The module ${name} attempted to add middleware or routes "before" the module ${fullBeforeName.split(':')[1]}, which does not exist`);
              }
              before.prepending = before.prepending || [];
              before.prepending.push(item);
            }
          }
        }
        self.finalModuleMiddlewareAndRoutes = labeledList.map(item => (item.prepending || []).concat(item.middleware || item.routes)).flat();
      }
    };
  }
};
