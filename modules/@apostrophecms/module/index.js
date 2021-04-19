// This "module" is the base class for all other modules. This module
// is never actually configured and used directly. Instead all other modules
// extend it (or a subclass of it) and benefit from its standard features,
// such as asset pushing.
//
// New methods added here should be lightweight wrappers that invoke
// an implementation provided in another module, such as `@apostrophecms/asset`,
// with sensible defaults for the current module. For instance,
// any module can call `self.render(req, 'show', { data... })` to
// render the `views/show.html` template of that module.
//
// ## Options
//
// `csrfExceptions` can be set to an array of URLs or route names
// to be excluded from CSRF protection.

const _ = require('lodash');

module.exports = {

  cascades: [ 'csrfExceptions' ],

  init(self) {
    self.apos = self.options.apos;
    // all apostrophe modules are properties of self.apos.modules.
    // Those with an alias are also properties of self.apos
    self.apos.modules[self.__meta.name] = self;
    if (self.options.alias) {
      if (_.has(self.apos, self.options.alias)) {
        throw new Error('The module ' + self.__meta.name + ' has an alias, ' + self.options.alias + ', that conflicts with a module registered earlier or a core Apostrophe feature.');
      }
      self.apos[self.options.alias] = self;
    }

    self.__helpers = {};
    self.templateData = self.options.templateData || {};

    if (self.apos.asset) {
      if (!self.apos.asset.chains) {
        self.apos.asset.chains = {};
      }
      _.each(self.__meta.chain, function(meta, i) {
        self.apos.asset.chains[meta.name] = self.__meta.chain.slice(0, i + 1);
      });
    }

    // The URL for routes relating to this module is based on the
    // module name unless they are registered with a leading /.
    // self.action is used to implement this
    self.enableAction();
    // Routes in their final ready-to-add-to-Express form
    self._routes = [];
  },

  async afterAllSections(self) {
    self.addHelpers(self.helpers || {});
    self.addHandlers(self.handlers || {});
    await self.executeAfterModuleInitTask();
  },

  methods(self) {
    return {
      compileSectionRoutes(section) {
        _.each(self[section] || {}, function(routes, method) {
          _.each(routes, function(config, name) {
            let route;
            if ((typeof config) === 'object') {
              // Route with extra config like `before`,
              // get to the actual route function
              route = config.route;
            } else {
              route = config;
            }
            // TODO we must set up this array based on the new route middleware section
            // at some point
            const url = self.getRouteUrl(name);
            if (Array.isArray(route)) {
              let routeFn = route[route.length - 1];
              if (self.routeWrappers[section]) {
                routeFn = self.routeWrappers[section](name, routeFn);
                route[route.length - 1] = routeFn;
              }
              self._routes.push({
                before: config.before,
                method,
                url,
                route: (req, res) => {
                  // Invoke the middleware functions, then the route function,
                  // which is on the same array. This is an async for loop.
                  // We use async/await nearly everywhere but the Express-style
                  // middleware pattern doesn't call for it
                  let i = 0;
                  next();
                  function next() {
                    route[i++](req, res, (i < route.length) ? next : null);
                  }
                }
              });
            } else {
              if (self.routeWrappers[section]) {
                route = self.routeWrappers[section](name, route);
              }
              self._routes.push({
                before: config.before,
                method,
                url,
                route
              });
            }
          });
        });
      },

      compileRestApiRoutesToApiRoutes() {
        if (self.restApiRoutes.getAll) {
          self.apiRoutes.get = self.apiRoutes.get || {};
          self.apiRoutes.get[''] = self.restApiRoutes.getAll;
        }
        if (self.restApiRoutes.getOne) {
          self.apiRoutes.get = self.apiRoutes.get || {};
          self.apiRoutes.get[':_id'] = wrapId(self.restApiRoutes.getOne);
        }
        if (self.restApiRoutes.delete) {
          self.apiRoutes.delete = self.apiRoutes.delete || {};
          self.apiRoutes.delete[':_id'] = wrapId(self.restApiRoutes.delete);
        }
        if (self.restApiRoutes.patch) {
          self.apiRoutes.patch = self.apiRoutes.patch || {};
          self.apiRoutes.patch[':_id'] = wrapId(self.restApiRoutes.patch);
        }
        if (self.restApiRoutes.put) {
          self.apiRoutes.put = self.apiRoutes.put || {};
          self.apiRoutes.put[':_id'] = wrapId(self.restApiRoutes.put);
        }
        if (self.restApiRoutes.post) {
          self.apiRoutes.post = self.apiRoutes.post || {};
          self.apiRoutes.post[''] = self.restApiRoutes.post;
        }
        function wrapId(route) {
          if (Array.isArray(route)) {
            // Allow middleware, last fn is route
            return route.slice(0, route.length - 1).concat([ wrapId(route[route.length - 1]) ]);
          }
          return async req => route(req, req.params._id);
        }
      },

      routeWrappers: {
        apiRoutes(name, fn) {
          return async function(req, res) {
            try {
              const result = await fn(req);
              res.status(200);
              res.send(result);
            } catch (err) {
              return self.routeSendError(req, err);
            }
          };
        },
        renderRoutes(name, fn) {
          return async function(req, res) {
            try {
              const result = await fn(req);
              const markup = await self.render(req, name, result);
              return res.send(markup);
            } catch (err) {
              return self.routeSendError(req, err);
            }
          };
        }
        // There is no htmlRoute because in 3.x, even data-oriented apiRoutes
        // use standard status codes and respond simply without a wrapper object.
        // So they are suited for both markup fragments and JSON data.
      },

      // Part of the implementation of `apiRoutes` and `renderRoutes`, this method is also handy if
      // you wish to send an error the way `apiRoute` would upon catching an
      // exception in middleware, etc.

      routeSendError(req, err) {
        if (!(req && req.res)) {
          self.apos.util.error('Looks like you did not pass req to self.routeSendError, you should not have to call this method yourself,\nit is usually called for you by self.apiRoute, self.htmlRoute or self.renderRoute', (new Error()).stack);
          return;
        }
        if (Array.isArray(err)) {
          err = self.apos.error('invalid', {
            errors: err.map(err => {
              const response = getResponse(err);
              return {
                name: response.name,
                message: response.message,
                path: err.path,
                code: response.code,
                data: response.data
              };
            })
          });
        }
        const response = getResponse(err);
        // err.stack includes basic description of error
        if (Object.keys(response.data).length > 1) {
          response.fn(`${req.method} ${req.url}: \n\n${err.stack}\n\n${JSON.stringify(response.data, null, '  ')}`);
        } else {
          response.fn(req.method + ' ' + req.url + ': ' + '\n\n' + err.stack);
        }
        req.res.status(response.code);
        return req.res.send({
          name: response.name,
          data: response.data,
          message: response.message
        });
        function getResponse(err) {
          let name, data, code, fn, message, path;
          if (err && err.name && self.apos.http.errors[err.name]) {
            data = err.data || {};
            code = self.apos.http.errors[err.name];
            fn = self.apos.util.info;
            name = err.name;
            message = err.message;
            path = err.path;
          } else {
            code = 500;
            fn = self.apos.util.error;
            name = 'error';
            data = {};
            message = 'An error occurred.';
            path = err.path;
          }
          if ((name === 'invalid') && Array.isArray(data.errors)) {
            // Sub-errors must get the same cleansing treatment
            // before sending to the browser
            data.errors = data.errors.map(error => {
              const response = getResponse(error);
              return {
                // Omitting fn
                name: response.name,
                code: response.code,
                message: response.message,
                data: response.data,
                path: response.path
              };
            });
          }
          return {
            name,
            data,
            code,
            path,
            fn,
            message
          };
        }
      },

      // Automatically called for you to add the helpers in the "helpers" section of your module.

      addHelpers(object) {
        Object.assign(self.__helpers, object);
      },

      // Automatically called for you to add the event handlers in the "handlers" section of your module.

      addHandlers(object) {
        Object.keys(object).forEach(eventName => {
          Object.keys(object[eventName]).forEach(handlerName => {
            self.on(eventName, handlerName, object[eventName][handlerName]);
          });
        });
      },

      // Add a nunjucks template helper to the global namespace. This should
      // be used very sparingly, and pretty much never in npm modules. The
      // only exceptions in apostrophe core are `apos.area` and `apos.singleton`.
      //
      // The helper must be added first with `addHelpers` or `addHelper`.

      addHelperShortcut(name) {
        self.apos.template.addHelperShortcutForModule(self, name);
      },

      // Render a template. Template overrides are respected; the
      // project level modules/modulename/views folder wins if
      // it has such a template, followed by the npm module,
      // followed by its parent classes. If you subclass a module,
      // your version wins if it exists.
      //
      // You MUST pass req as the first argument. This allows
      // internationalization/localization to work. If you
      // are writing a Nunjucks helper function, use
      // self.partial instead. This method is primarily used
      // to implement routes that respond with HTML fragments.
      //
      // All properties of `data` appear in Nunjucks templates as
      // properties of the `data` object. Nunjucks helper functions
      // can be accessed via the `apos` object.
      //
      // If not otherwise specified, `data.user` is
      // provided for convenience.
      //
      // The data argument may be omitted.
      //
      // This method is `async` in 3.x and must be awaited.

      async render(req, name, data) {
        if (!(req && req.res)) {
          throw new Error('The first argument to self.render must be req.');
        }
        if (!data) {
          data = {};
        }
        return self.apos.template.renderForModule(req, name, data, self);
      },

      // Similar to `render`, however this method then sends the
      // rendered content as a response to the request. You may
      // await this function, but since the response has already been
      // sent you typically will not have any further work to do.

      async send(req, name, data) {
        return req.res.send(await self.render(req, name, data));
      },

      // Render a template in a string (not from a file), looking for
      // includes, etc. in our preferred places.
      //
      // Otherwise the same as `render`.

      async renderString(req, s, data) {
        if (!data) {
          data = {};
        }
        return self.apos.template.renderStringForModule(req, s, data, self);
      },

      // TIP: you probably want `self.sendPage`, which loads
      // `data.home` for you and also sends the response to the browser.
      //
      // This method generates a complete HTML page for transmission to the
      // browser. Returns HTML markup ready to send (but `self.sendPage` is
      // more convenient).
      //
      // `template` is a nunjucks template name, relative
      // to this module's views/ folder.
      //
      // `data` is provided to the template, with additional
      // default properties as described below.
      //
      // Depending on whether the request is an AJAX request,
      // `outerLayout` is set to:
      //
      // `@apostrophecms/template:outerLayout.html`
      //
      // Or:
      //
      // `@apostrophecms/template:refreshLayout.html`
      //
      // This allows the template to handle either a content area
      // refresh or a full page render just by doing this:
      //
      // `{% extend outerLayout %}`
      //
      // Note the lack of quotes.
      //
      // If `req.query.apos-refresh` is `'1'`,
      // `refreshLayout.html` is used in place of `outerLayout.html`.
      //
      // These default properties are provided on
      // the `data` object in nunjucks:
      //
      // `data.user` (req.user)
      // `data.query` (req.query)
      //
      // This method is async in 3.x and must be awaited.

      async renderPage(req, template, data) {
        return self.apos.template.renderPageForModule(req, template, data, self);
      },

      // This method generates and sends a complete HTML page to the browser.
      //
      // `template` is a nunjucks template name, relative
      // to this module's views/ folder.
      //
      // `data` is provided to the template, with additional
      // default properties as described below.
      //
      // `outerLayout` is set to:
      //
      // `@apostrophecms/template:outerLayout.html`
      //
      // Or:
      //
      // `@apostrophecms/template:refreshLayout.html`
      //
      // This allows the template to handle either a content area
      // refresh or a full page render just by doing this:
      //
      // `{% extend outerLayout %}`
      //
      // Note the lack of quotes.
      //
      // If `req.query.apos-refresh` is `'1'`,
      // `refreshLayout.html` is used in place of `outerLayout.html`.
      //
      // These default properties are provided on
      // the `data` object in nunjucks:
      //
      // `data.user` (req.user)
      // `data.query` (req.query)
      // `data.calls` (javascript markup to insert all global and
      //   request-specific calls pushed by server-side code)
      // `data.home` (basic information about the home page, usually with ._children)
      //
      // First, the `@apostrophecms/page` module emits a `beforeSend` event. Handlers receive `req`,
      // allowing them to modify `req.data`, set `req.redirect` to a URL, set
      // `req.statusCode`, etc.
      //
      // This method is async and may be awaited although you should bear
      // in mind that a response has already been sent to the browser at
      // that point.

      async sendPage(req, template, data) {
        await self.apos.page.emit('beforeSend', req);
        await self.apos.area.loadDeferredWidgets(req);
        req.res.send(
          await self.apos.template.renderPageForModule(req, template, data, self)
        );
      },

      // Call from init once if this module implements the `getBrowserData` method.
      // The data returned by `getBrowserData(req)` will then be available on
      // `apos.modules['your-module-name']` in the browser.
      //
      // By default browser data is pushed only for the `apos` scene, so public
      // site pages will not be cluttered with it, except on the /login page and
      // other pages that opt into the `apos` scene. If `scene` is set to `public`
      // then the data is available al the time.
      //
      // Be sure to use `extendMethods` when implementing `getBrowserData`
      // as your base class may also implement `getBrowserData`.

      enableBrowserData(scene = 'apos') {
        self.enabledBrowserData = scene;
      },

      // Extend this method to return the appropriate browser data for
      // your module. If you want browser data for the given req, return
      // an object. That object is assigned to `apos.modules['your-module-name']`
      // in the browser. Do not return huge data structures, as this will impact
      // page load time and performance.
      //
      // If your module has an alias the data will also be accessible
      // via `apos.yourAlias`.
      //
      // Modules derived from pieces, etc. already implement this method,
      // so be sure to follow the super pattern if you want to add additional data.
      //
      // For performance, this method will only be invoked if `enableBrowserData`
      // was called. See also `enableBrowserData` for more restrictions on when
      // this method is called; if you want data for anonymous site visitors
      // you must explicitly opt in.

      getBrowserData(req) {
        return {};
      },

      // Transform a route name into a route URL. If the name begins with `/` it is understood to
      // already be a site-relative URL. Otherwise, if it contains : or *, it is considered to be
      // module-relative but still already in URL format because the developer will have used a "/"
      // to separate these parameters from the route name. If neither of these rules applies,
      // the name is converted to "kebab case" and then treated as a module-relative URL, allowing
      // method syntax to be used for most routes.

      getRouteUrl(name) {
        let url;
        if (name.substring(0, 1) === '/') {
          // Specifying our own site-relative URL
          url = name;
        } else {
          if (name.match(/[:/*]/)) {
            // If the name contains placeholder parameters or slashes, it is
            // still "module-relative" but transforming to kebab case
            // is not appropriate as the developer is already naming it
            // with a URL in mind
            url = self.action + '/' + name;
          } else {
            // Map from linter-friendly method names like `saveArea` to
            // URL-friendly names like `save-area`
            url = self.action + '/' + self.apos.util.cssName(name);
          }
        }
        return url;
      },

      // A convenience method to fetch properties of `self.options`.
      //
      // `req` is required to provide extensibility; modules such as
      // `@apostrophecms/workflow` and `@apostrophecms/option-overrides`
      // can use it to change the response based on the current page
      // and other factors tied to the request.
      //
      // The second argument may be a dotPath, as in:
      //
      // `(req, 'flavors.grape.sweetness')`
      //
      // Or an array, as in:
      //
      // `(req, [ 'flavors', 'grape', 'sweetness' ])`
      //
      // The optional `def` argument is returned if the
      // property, or any of its ancestors, does not exist.
      // If no third argument is given in this situation,
      // `undefined` is returned.
      //
      // In templates, `getOption` is a global function, not
      // a property of each module. If you call it with an ordinary
      // key, the option is located in the module that called
      // render(). If you call it with a cross-module key,
      // like `module-name:optionName`, the option is located
      // in the specified module. You do not have to pass `req`.

      getOption(req, dotPathOrArray, def) {
        if ((!req) || (!req.res)) {
          throw new Error('Looks like you forgot to pass req to the getOption method');
        }
        return _.get(self.options, dotPathOrArray, def);
      },

      // If `name` is `manager` and `options.components.manager` is set,
      // return that string, otherwise return `def`. This is used to decide what
      // Vue component to instantiate on the browser side.
      getComponentName(name, def) {
        return _.get(self.options, `components.${name}`, def);
      },

      // Send email. Renders an HTML email message using the template
      // specified in `templateName`, which receives `data` as its
      // `data` object (literally called `data` in your templates,
      // just like with page templates).
      //
      // **The `nodemailer` option of the `@apostrophecms/email` module
      // must be configured before this method can be used.** That
      // option's value is passed to Nodemailer's `createTransport`
      // method. See the [Nodemailer documentation](https://nodemailer.com).
      //
      // A plaintext version is automatically generated for email
      // clients that require or prefer it, including plaintext versions
      // of links. So you do not need a separate plaintext template.
      //
      // `nodemailer` is used to deliver the email. The `options` object
      // is passed on to `nodemailer`, except that `options.html` and
      // `options.plaintext` are automatically provided via the template.
      //
      // In particular, your `options` object should contain
      // `from`, `to` and `subject`. You can also configure a default
      // `from` address, either globally by setting the `from` option
      // of the `@apostrophecms/email` module, or locally for this particular
      // module by setting the `from` property of the `email` option
      // to this module.
      //
      // If you need to localize `options.subject`, you can call
      // `self.apos.i18n.__(subject)`.
      //
      // This method returns `info`, per the Nodemailer documentation.
      // With most transports, a successful return indicates the message was
      // handed off but has not necessarily arrived yet and could still
      // bounce back at some point.

      async email(req, templateName, data, options) {
        return self.apos.modules['@apostrophecms/email'].emailForModule(req, templateName, data, options, self);
      },

      // Given a Vue component name, such as AposPiecesManager,
      // return that name unless `options.components[name]` has been set to
      // an alternate name. Overriding keys in the `components` option
      // allows modules to provide alternative functionality for standard
      // components while maintaining readable Vue code via the
      // <component :is="..."> syntax.

      getVueComponentName(name) {
        return (self.options.components && self.options.components[name]) || name;
      },

      // When a CMS page is rendered, it will render the
      // template name passed on the last call to this
      // method during the processing of the request.
      // This facilitates the implementation of separate
      // templates for separate dispatch routes.

      setTemplate(req, name) {
        req.template = `${self.__meta.name}:${name}`;
      },

      // Sets `self.action` which is the base URL for all APIs of
      // this module
      enableAction() {
        self.action = `/api/v1/${self.__meta.name}`;
      },

      async executeAfterModuleInitTask() {
        for (const [ name, info ] of Object.entries(self.tasks || {})) {
          if (info.afterModuleInit) {
            // Execute a task like @apostrophecms/asset:build or
            // @apostrophecms/db:reset which
            // must run before most modules are awake
            if (self.apos.argv._[0] === `${self.__meta.name}:${name}`) {
              await info.task(self.apos.argv);
              // In most cases we exit after running a task
              if (info.exitAfter !== false) {
                process.exit(0);
              } else {
                // Provision for @apostrophecms/db:reset which should be
                // followed by normal initialization so all the collections
                // and indexes are recreated as they would be on a first run
                // Avoid double execution
                self.apos.taskRan = true;
              }
            }
          }
        }
      },

      // Merge in the event emitter / responder capabilities
      ...require('./lib/events.js')(self)
    };
  },

  handlers(self) {
    return {
      'apostrophe:modulesReady': {
        addHelpers() {
          // We check this just to allow init in bootstrap tests that
          // have no templates module
          if (self.apos.template) {
            self.apos.template.addHelpersForModule(self, self.__helpers);
          }
        }
      },
      '@apostrophecms/express:compileRoutes': {
        compileAllRoutes() {
          // Sections like `routes` don't populate `self.routes` until after init
          // resolves. Call methods that bring those sections
          // fully to life here
          self.compileRestApiRoutesToApiRoutes();
          self.compileSectionRoutes('routes');
          self.compileSectionRoutes('renderRoutes');
          // Put the api routes last so the REST api routes
          // they contain, with their wildcards, don't
          // block ordinary apiRoute names by matching them
          // as _ids
          self.compileSectionRoutes('apiRoutes');
        }
      },
      ...self.enabledBrowserData && {
        '@apostrophecms/template:addBodyData': {
          addBrowserDataToBody(req, data) {
            let myData;
            if (self.enabledBrowserData === 'apos') {
              if (req.scene === 'apos') {
                // apos scene only
                myData = self.getBrowserData(req);
              }
            } else {
              // All the time
              myData = self.getBrowserData(req);
            }
            if (!myData) {
              return;
            }
            data.modules[self.__meta.name] = myData;
            if (self.options.alias) {
              data.modules[self.__meta.name].alias = self.options.alias;
            }
          }
        }
      }
    };
  }
};
