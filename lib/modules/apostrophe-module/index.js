// This "module" is the base class for all other modules. This module
// is never actually configured and used directly. Instead all other modules
// extend it (or a subclass of it) and benefit from its standard features,
// such as asset pushing.
//
// New methods added here should be lightweight wrappers that invoke
// an implementation provided in another module, such as `apostrophe-assets`,
// with sensible defaults for the current module. For instance,
// any module can call `self.render(req, 'show', { data... })` to
// render the `views/show.html` template of that module.

const _ = require('lodash');
const fs = require('fs');
const syntaxError = require('syntax-error');

module.exports = {

  init(self, options) {
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

    if (self.apos.assets) {
      if (!self.apos.assets.chains) {
        self.apos.assets.chains = {};
      }
      _.each(self.__meta.chain, function(meta, i) {
        self.apos.assets.chains[meta.name] = self.__meta.chain.slice(0, i + 1);
      });
    }

    // The URL for routes relating to this module is based on the
    // module name but is not distinct at the project level. Use the
    // metadata provided by moog to figure out the name
    self.action = '/modules/' + self.__meta.name;

  },

  afterAllSections(self, options) {
    self.addHelpers(self.helpers || {});
    self.addHandlers(self.handlers || {});
  },

  methods(self, options) {
    return {
      addSectionRoutes(section) {
        _.each(self[section] || {}, function(routes, method) {
          _.each(routes, function(route, path) {
            // TODO we must set up this array based on the new route middleware section
            // at some point
            let url;
            if (path.substring(0, 1) === '/') {
              // Specifying our own site-relative URL
              url = path;
            } else {
              url = self.action + '/' + self.apos.utils.cssName(path);
            }
            if (Array.isArray(route)) {
              let routeFn = route[route.length - 1];
              if (self.routeWrappers[section]) {
                routeFn = self.routeWrappers[section](routeFn);
                route[route.length - 1] = routeFn;
              }
              self.apos.app[method](url, function(req, res) {
                // Invoke the middleware functions, then the route function,
                // which is on the same array. This is an async for loop.
                // We use async/await nearly everywhere but the Express-style
                // middleware pattern doesn't call for it
                let i = 0;
                next();
                function next() {
                  route[i++](req, res, (i < route.length) ? next : null);
                }
              });
            } else {
              if (self.routeWrappers[section]) {
                route = self.routeWrappers[section](route);
              }
              self.apos.app[method](url, route);
            }
          });
        });
      },

      routeWrappers: {
        apiRoutes(name, fn) {
          return async function(req, res) {
            try {
              const result = await fn(req);
              return res.send(result);
            } catch (err) {
              return self.routeSendError(res, err);
            }
          };
        },
        renderRoutes(name, fn) {
          return async function(req, res) {
            try {
              const result = await fn(req);
              return res.send(self.render(name, result));
            } catch (err) {
              return self.routeSendError(res, err);
            }
          };
        }
        // There is no htmlRoute because in 3.x, even data-oriented apiRoutes
        // use standard status codes and respond simply without a wrapper object.
        // So they are suited for both markup fragments and JSON data.
      },

      // Part of the implementation of `apiRoutes`, and `renderRoutes`, this method is also handy if
      // you wish to send an error the way `apiRoute` would upon catching an
      // exception in middleware, etc.

      routeSendError(res, err) {
        let data;
        let e = err;
        if (e && e.type === 'apostrophe-http-error') {
          data = e.data;
          e = e.name;
        }
        if ((typeof e) !== 'string') {
          self.apos.utils.error(e);
          e = 'error';
        }
        res.status(self.apos.http.errors[e] || 500);
        return res.send(data || err);
      },

      // Add nunjucks template helpers in the namespace for our module. Typically called
      // with an object in which each property is a helper name and each value
      // is a helper function.

      addHelpers(object) {
        Object.assign(self.__helpers, object);
      },

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
        self.apos.templates.addHelperShortcutForModule(self, name);
      },

      // Render a template. Template overrides are respected; the
      // project level lib/modules/modulename/views folder wins if
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
      // If not otherwise specified, `data.user` and
      // `data.permissions` are provided for convenience.
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
        return self.apos.templates.renderForModule(req, name, data, self);
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
        return self.apos.templates.renderStringForModule(req, s, data, self);
      },

      // Returns a function that can be used to invoke
      // self.render at a later time. The returned function
      // must be called with req. You may pass data now
      // and also when invoking the function; data passed
      // now serves as defaults for the object passed later.

      async renderer(name, data) {
        return async function(req, _data) {
          _data = _data || {};
          if (data) {
            _.defaults(_data, data);
          }
          return self.render(req, name, _data);
        };
      },

      // TIP: you probably want `self.sendPage`, which loads
      // `data.home` for you and also sends the response to the browser.
      //
      // This method generates a complete HTML page for transmission to the
      // browser. Returns HTML markup ready to send (but `self.sendPage` is
      // more convenient).
      //
      // If `template` is a function it is passed a data object,
      // otherwise it is rendered as a nunjucks template relative
      // to this module via self.render.
      //
      // `data` is provided to the template, with additional
      // default properties as described below.
      //
      // Depending on whether the request is an AJAX request,
      // `outerLayout` is set to:
      //
      // `apostrophe-templates:outerLayout.html`
      //
      // Or:
      //
      // `apostrophe-templates:refreshLayout.html`
      //
      // This allows the template to handle either a content area
      // refresh or a full page render just by doing this:
      //
      // `{% extend outerLayout %}`
      //
      // Note the lack of quotes.
      //
      // Under the following conditions, `refreshLayout.html`
      // is used in place of `outerLayout.html`:
      //
      // `req.xhr` is true (always set on AJAX requests by jQuery)
      // `req.query.xhr` is set to simulate an AJAX request
      // `req.decorate` is false
      // `req.query.apos_refresh` is true
      //
      // These default properties are provided on
      // the `data` object in nunjucks:
      //
      // `data.user` (req.user)
      // `data.query` (req.query)
      // `data.permissions` (req.user._permissions)
      // `data.calls` (javascript markup to insert all global and
      //   request-specific calls pushed by server-side code)
      //
      // This method is async in 3.x and must be awaited.

      async renderPage(req, template, data) {
        return self.apos.templates.renderPageForModule(req, template, data, self);
      },

      // This method generates and sends a complete HTML page to the browser.
      //
      // If `template` is a function it is passed a data object,
      // otherwise it is rendered as a nunjucks template relative
      // to this module via self.render.
      //
      // `data` is provided to the template, with additional
      // default properties as described below.
      //
      // `outerLayout` is set to:
      //
      // `apostrophe-templates:outerLayout.html`
      //
      // Or:
      //
      // `apostrophe-templates:refreshLayout.html`
      //
      // This allows the template to handle either a content area
      // refresh or a full page render just by doing this:
      //
      // `{% extend outerLayout %}`
      //
      // Note the lack of quotes.
      //
      // Under the following conditions, `refreshLayout.html`
      // is used in place of `outerLayout.html`:
      //
      // `req.xhr` is true (always set on AJAX requests by jQuery)
      // `req.query.xhr` is set to simulate an AJAX request
      // `req.decorate` is false
      // `req.query.apos_refresh` is true
      //
      // These default properties are provided on
      // the `data` object in nunjucks:
      //
      // `data.user` (req.user)
      // `data.query` (req.query)
      // `data.permissions` (req.user._permissions)
      // `data.calls` (javascript markup to insert all global and
      //   request-specific calls pushed by server-side code)
      // `data.home` (basic information about the home page, usually with ._children)
      //
      // First, the `apostrophe-pages` module emits a `beforeSend` event. Handlers receive `req`,
      // allowing them to modify `req.data`, set `req.redirect` to a URL, set
      // `req.statusCode`, etc.
      //
      // This method is async and may be awaited although you should bear
      // in mind that a response has already been sent to the browser at
      // that point.

      async sendPage(req, template, data) {
        await self.apos.pages.emit('beforeSend', req);
        await self.apos.areas.loadDeferredWidgets(req);
        req.res.send(
          await self.apos.templates.renderPageForModule(req, template, data, self)
        );
      },

      // Override this method to return the appropriate browser data for
      // your module. If you want browser data for the given req, return
      // an object. That object is merged with the `browser` option passed
      // to your module, then assigned to `apos.modules['your-module-name']`
      // in the browser. Do not return huge data structures, as this will impact
      // page load time and performance.
      //
      // If your module has an alias the data will also be accessible
      // via `apos.yourAlias`.
      //
      // Modules derived from pieces, etc. already implement this method,
      // so be sure to follow the super pattern if you want to add additional data.
      //
      // This method will only be invoked if enableBrowserData was invoked.
      //
      // Browser data created this way is visible only when a user is logged in
      // with editing privileges.

      getBrowserData(req) {
        return {};
      },

      // Call this method to enable browser data for your module. You will
      // then receive calls to `getBrowserData(req)`, which you may override to
      // return the object of your choice. See that method for more information.

      enableBrowserData() {
        self.on('apostrophe-pages:beforeSend', 'pushBrowserData', function(req) {
          const data = self.getBrowserData(req);
          if (!data) {
            return;
          }
          _.merge(data, self.options.browser || {});
          req.browserModule(self, data);
        });
      },

      // Define a new apostrophe class related to this module, autoloading its
      // definition from the appropriate file. This is very helpful when you
      // want to define another class of object, other than the module itself.
      // Apostrophe uses this method to define database cursor classes related to modules.

      // The name of the related class will be the name of the module, followed by a
      // hyphen, followed by the value of `tool`. The definition of the type will be
      // automatically loaded from the `lib/tool.js` file of the module
      // (substitute the actual tool parameter for `tool`, i.e. `cursor.js`).

      // This is done recursively for all modules that this module
      // extends, whether or not they actually have a `lib/tool.js` file.
      // If the file is missing, an empty definition is synthesized that
      // extends the next "parent class" in the chain.

      // If any of classes are already defined, execution stops at that
      // point. For instance, if `apostrophe-images` has already called this
      // as a subclass of `apostrophe-pieces`, then `apostrophe-files` will
      // just define its own cursor, extending `apostrophe-pieces-cursor`, and stop.
      // This prevents duplicate definitions when many classes extend `apostrophe-pieces`.

      // If `options.stop` is set to the name of an ancestor module,
      // the chain stops **after** defining the related class for that module.

      // For instance, the module `apostrophe-files` extends
      // `apostrophe-pieces`, which extends `apostrophe-doc-type-manager`.

      // So when that module calls:

      // self.defineRelatedClass('cursor', {
      //   stop: 'apostrophe-doc-type-manager'
      // });
      // ```

      // We get:

      // apostrophe-files-cursor extends...
      // apostrophe-pieces-cursor which extends...
      // apostrophe-doc-type-manager-cursor which extends...
      // apostrophe-cursor (because `cursor.js` for doc-type-manager says so)

      defineRelatedClass(tool, options) {
        const chain = self.__meta.chain;
        // For the sake of the doc generator we'll keep track of these
        self.__meta.related = [];
        defineRelatedClassBody(chain.length - 1, tool, options);

        // if (self.__meta.name === 'apostrophe-tags') {
        //   process.exit(1);
        // }
        function defineRelatedClassBody(i, tool, options) {
          let definition;
          let extend;
          let name = chain[i].name + '-' + tool;
          if (_.has(self.apos.synth.definitions, name.replace(/^my-/, ''))) {
            // Already defined
            return;
          }
          const path = chain[i].dirname + '/lib/' + tool + '.js';
          const related = {};
          if (!fs.existsSync(path)) {
            // Synthesize
            definition = {};
          } else {
            // Load the definition; supply `extend` if it is not set
            try {
              ;
              definition = _.clone(require(path));
            } catch (err) {
              // We need to stop the show in any case, but first print
              // a more helpful syntax error message if we can
              // find it via substack's node-syntax-error module. Without this
              // we get no line number information, a known limitations of node/v8
              // as opposed to Firefox. -Tom
              if (err instanceof SyntaxError) {
                let err = syntaxError(fs.readFileSync(path), path);
                if (err) {
                  throw new Error(err.toString() + '\n^^^^ LOOK UP HERE FOR THE ERROR DEFINING THE RELATED TYPE ' + name);
                }
              }
              // Intentionally fall through and throw the error further on to
              // stop the show
              throw err;
            }
            related.filename = path;
          }
          extend = definition.extend;
          if (extend === undefined) {
            extend = inferParentName();
            if (extend !== undefined) {
              definition.extend = extend;
            }
          }
          const inferred = inferParentName();
          if (inferred && ((extend === inferred) || (('my-' + extend) === inferred))) {
            defineRelatedClassBody(i - 1, tool, options);
          }
          if (name.match(/^my-/)) {
            // Restore the implicit subclassing
            name = name.replace(/^my-/, '');
            definition.extend = undefined;
          }
          related.name = name;
          related.module = chain[i].name;
          related.extend = definition.extend;
          self.__meta.related.push(related);
          self.apos.synth.define(name, definition);

          function inferParentName() {
            if ((i > 0) && (chain[i].name !== options.stop)) {
              return (chain[i - 1].name + '-' + tool).replace(/^my-/, '');
            } else {
              // A hard stop, so we don't implicitly extend
              // `apostrophe-module`. Related types are not modules
              return false;
            }
          }

        }
      },

      // A convenience method to fetch properties of `self.options`.
      //
      // `req` is required to provide extensibility; modules such as
      // `apostrophe-workflow` and `apostrophe-option-overrides`
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

      // If `name` is `manager` and `options.browser.components.manager` is set,
      // return that string, otherwise return `def`. This is used to decide what
      // Vue component to instantiate on the browser side.

      getComponentName(name, def) {
        return _.get(self.options, `browser.components.${name}`, def);
      },

      // Send email. Renders an HTML email message using the template
      // specified in `templateName`, which receives `data` as its
      // `data` object (literally called `data` in your templates,
      // just like with page templates).
      //
      // **The `nodemailer` option of the `apostrophe-email` module
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
      // of the `apostrophe-email` module, or locally for this particular
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
        return self.apos.modules['apostrophe-email'].emailForModule(req, templateName, data, options, self);
      },

      // Add an Apostrophe command line task to your module. The command line
      // syntax will be:
      //
      // `node app name-of-module:name`
      //
      // Where `name` is the `name` argument given here (use hyphens).
      // The usage message is printed if the user asks for help with
      // the task.
      //
      // `fn` is invoked with `(apos, argv)` and will be awaited. On
      // errors, throw an exception. If your exception is a `string`
      // rather than an object, it is displayed to the user exactly as
      // shown, without a stack trace. This is useful for user errors,
      // as opposed to failures of your code, database server, etc.
      //
      // To carry out actions requiring `req` in your code, call
      // `self.apos.tasks.getReq()` to get a `req` with unlimited admin permissions.

      addTask(name, usage, fn) {
        return self.apos.tasks.add(self.__meta.name, name, usage, fn);
      },

      // Given a Vue component name, such as ApostrophePiecesManagerModal,
      // return that name unless `options.components[name]` has been set to
      // an alternate name. Overriding keys in the `components` option
      // allows modules to provide alternative functionality for standard
      // components while maintaining readabile Vue code via the
      // <component :is="..."> syntax.

      getVueComponentName(name) {
        return (self.options.components && self.options.components[name]) || name;
      },
      // Merge in the event emitter / responder capabilities
      ...require('./lib/events.js')(self, options)
    };
  },

  handlers(self, options) {
    return {
      'apostrophe:modulesReady': {
        addHelpers() {
          // We check this just to allow init in bootstrap tests that
          // have no templates module
          if (self.apos.templates) {
            self.apos.templates.addHelpersForModule(self, self.__helpers);
          }
        },
        addAllRoutes() {
          // Sections like `routes` don't populate `self.routes` until after init
          // resolves. Call methods that bring those sections
          // fully to life here
          self.addSectionRoutes('routes');
          self.addSectionRoutes('apiRoutes');
          self.addSectionRoutes('renderRoutes');
        }
      }
    };
  }
};
