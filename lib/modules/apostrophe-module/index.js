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
//
// TODO: wrapper for adding command-line tasks.
// In the meantime it is recommended that you always use
// your module's name and a colon as the prefix for a task name when
// calling `self.apos.tasks.add`.

var _ = require('@sailshq/lodash');
var async = require('async');
var fs = require('fs');
var syntaxError = require('syntax-error');
var Promise = require('bluebird');

module.exports = {

  beforeConstruct: function(self, options) {
    self.options = options;
    self.apos = options.apos;
    // all apostrophe modules are properties of self.apos.modules.
    // Those with an alias are also properties of self.apos
    self.apos.modules[self.__meta.name] = self;
    if (self.options.alias) {
      if (_.has(self.apos, self.options.alias)) {
        throw new Error('The module ' + self.__meta.name + ' has an alias, ' + self.options.alias + ', that conflicts with a module registered earlier or a core Apostrophe feature.');
      }
      self.apos[self.options.alias] = self;
    }
  },

  construct: function(self, options) {

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

    var routes = {};

    // Add an Express route to apos.app. The `path` argument is
    // appended to the "action" of this module, which is
    // `/modules/modulename/`.
    //
    // Calling this method again allows routes to be overridden, which you
    // normally can't do in Express.
    //
    // Syntax:
    //
    // `self.route('post', 'edit-monkey', function(req, res) { ... })`
    //
    // That is roughly equivalent to:
    //
    // `self.apos.app.post(self.action + '/edit-monkey', function(req, res) { ... })`
    //
    // You can also pass middleware in the usual way, after
    // the `path` argument. Note that some standardized optional
    // middleware is available to pass in this way, i.e.
    // `self.apos.middleware.files` for file uploads.
    //
    // The omittable `responder` argument is a string containing the
    // name of a method of this module used to send a response when given
    // `(req, err, value)`. It is normally provided for you by a call to
    // `self.apiRoute` or `self.htmlRoute`. It is not invoked at all
    // unless the route invokes its third argument, `next()`, with
    // an error (or null) and an optional value argument. next() cannot be
    // used in a route without a responder. (It behaves as normal for Express
    // in a middleware function.)

    self.route = function(method, path, responder, fn) {
      var key = method + '.' + path;
      if (!routes[key]) {
        self.apos.app[method](self.action + '/' + path, function(req, res) {
          var args = routes[key];
          var responder = args[0];
          var route = args[args.length - 1];
          var middleware;
          if ((typeof responder) !== 'string') {
            responder = null;
            // Don't run the route twice
            middleware = routes[key].slice(0, args.length - 1);
          } else {
            // Skip the responder (it's a method name not middleware), don't run the route twice
            middleware = routes[key].slice(1, args.length - 1);
          }
          return async.eachSeries(middleware, function(fn, callback) {
            return fn(req, res, function() {
              return callback();
            });
          }, function() {
            return route(req, res, function(err, result, extraError) {
              // If it is definitely a request object passed by accident as err,
              // let the dev know what is wrong
              if (err && err.res && err.baseUrl && err.ip) {
                err = new Error('Developer error: do not pass "req" to next().');
              }
              if (!responder) {
                responder = 'apiResponder';
                self.apos.utils.warnDevOnce('route-next', method + ' ' + path + ':\nthe route invoked its next() function but there is no responder, falling back to apiResponder. Use\napiRoute, htmlRoute or renderRoute if you want an error or value sent for you, otherwise\nuse res.send');

              }
              return self[responder](req, err, result, extraError);
            });
          });
        });
      }
      routes[key] = Array.prototype.slice.call(arguments, 2);
    };

    // Similar to `route`, except that the route function receives
    // (req, res, next), and you may pass `next` either an error or
    // `(null, result)` where `result` is a JSON-friendly object to be sent
    // to the browser; a `status: 'ok'` property is automatically
    // added.
    //
    // An exception: if `result` is an array, it is sent without a
    // status property. This loophole is needed because arrays cannot have
    // extra properties in JSON and certain legacy APIs send back arrays
    // without an enclosing object.
    //
    // If you do pass an error to `next`, the status code is still `200`
    // but the browser receives an object whose `status` property is not `ok`.
    // If the error is a string, it is sent as the `status`, otherwise
    // the error is logged and the status is simply `error` to avoid
    // revealing information that could be used maliciously.
    //
    // An exception: mongodb errors relating to duplicate keys are sent
    // as the status `unique`, which is useful for suggesting to users
    // that they may need to use a different username, etc.
    //
    // If you require additional properties for the JSON object sent
    // for an error, you can pass an object containing them as the
    // third argument to `next`. This is separate from the success value
    // to avoid accidentally disclosing information on errors.
    //
    // In addition, if `req.errorMessages` is set, it is
    // passed as the `messages` property of the JSON object.
    // This is a helpful way to accommodate percolating detailed
    // error messages up from a nested function call through a
    // stack that otherwise only accommodates simple string errors.

    self.apiRoute = function(method, path, fn) {
      return self.route.apply(self, [ method, path, 'apiResponder' ].concat(Array.prototype.slice.call(arguments, 2)));
    };

    // Similar to `route`, except that the route function receives
    // (req, res, next), and you may pass `next` either an error or
    // `(null, result)` where `result` is an HTML string to be sent
    // to the browser; a `200` status is automatically used.
    //
    // If you do pass an error to `next`, and the error is a string,
    // the string is converted to an error code according to
    // the following rules: `notfound` => 404, `invalid` => 401,
    // `forbidden` => 403, `error` => 500, anything else => 500.
    // If the error is not a string, it is converted to a 500 error
    // and logged for the developer on the server side only,
    // to avoid revealing information that could be used maliciously.

    self.htmlRoute = function(method, path, fn) {
      return self.route.apply(self, [ method, path, 'htmlResponder' ].concat(Array.prototype.slice.call(arguments, 2)));
    };

    // Similar to `htmlRoute`, except that the route function receives
    // (req, res, next), and you may pass `next` either an error or
    // `(null, result)` where `result` is an object with a `template`
    // property naming a template in the current module, and optionally
    // a `data` property containing an object to be passed to the template.
    // The result of template rendering is sent directly to the client, with a
    // 200 status code.
    //
    // If you do pass an error to `next`, and the error is a string,
    // the string is converted to an error code according to
    // the following rules: `notfound` => 404, `invalid` => 401,
    // `forbidden` => 403, `error` => 500, anything else => 500.
    // If the error is not a string, it is converted to a 500 error
    // and logged for the developer on the server side only,
    // to avoid revealing information that could be used maliciously.

    self.renderRoute = function(method, path, fn) {
      return self.route.apply(self, [ method, path, 'renderResponder' ].concat(Array.prototype.slice.call(arguments, 2)));
    };

    // See apiRoute for details. You should not call this directly.

    self.apiResponder = function(req, err, result, extraError) {
      if ((!req) || (!req.res)) {
        err = new Error('Looks like no req was passed to apiResponder, you probably do not need to call this method yourself, it is called for you when you use apiRoute');
      }
      if (err) {
        if ((typeof err) !== 'string') {
          if (!(err instanceof Error)) {
            err = new Error('Error is not a string or an instance of Error, maybe this is not an error and you forgot to\npass null as the first argument to next()?');
          }
          if (self.apos.docs.isUniqueError(err)) {
            // Unique key errors are generally things like "username already taken", they should
            // not be treated as developer errors and should be disclosed to the client
            err = 'unique';
          } else {
            // String errors are meant to be included in the API response,
            // while regular error objects should be logged and converted to
            // an error that doesn't give away sensitive information
            self.logError(req, err);
            err = 'error';
          }
        }
        if (req && req.res) {
          var response = {
            status: err
          };
          if (req.errorMessages) {
            response.messages = req.errorMessages;
          }
          return req.res.send(Object.assign(response, extraError || {}));
        } else {
          // We already flagged this as a developer mistake

        }
      } else {
        if (req && req.res) {
          if (Array.isArray(result)) {
            return req.res.send(result);
          } else {
            return req.res.send(Object.assign({ status: 'ok' }, result || {}));
          }
        } else {
          // We already flagged this as a developer mistake
        }
      }
    };

    // See htmlRoute for details. You should not call this directly.

    self.htmlResponder = function(req, err, result) {
      if ((!req) || (!req.res)) {
        err = new Error('Looks like no req was passed to htmlResponder, you probably do not need to call this method yourself, it is called for you when you use htmlRoute');
      }
      if (err) {
        if ((typeof err) !== 'string') {
          if (self.apos.docs.isUniqueError(err)) {
            // Unique key errors are generally things like "username already taken", they should
            // not be treated as developer errors and should be disclosed to the client
            err = 'unique';
          } else {
            // String errors are meant to be included in the API response,
            // while regular error objects should be logged and converted to
            // an error that doesn't give away sensitive information
            self.logError(req, err);
            err = 'error';
          }
        }
        var status = {
          invalid: 401,
          forbidden: 403,
          notfound: 404,
          error: 500
        }[err] || 500;
        return req.res.status(status).send(err);
      } else {
        return req.res.send(result);
      }
    };

    // See renderRoute for details. You should not call this directly.

    self.renderResponder = function(req, err, result) {
      if (err) {
        return self.htmlResponder(req, err, result);
      }
      try {
        if ((!result) || ((typeof result.template) !== 'string')) {
          throw new Error('When using renderRoute the result object must have a template property');
        }
        var html = self.render(req, result.template, result.data || {});
        return self.htmlResponder(req, null, html);
      } catch (e) {
        return self.htmlResponder(req, e);
      }
    };

    // Add nunjucks template helpers in the namespace for our module. Typically called
    // with an object in which each property is a helper name and each value
    // is a helper function. Can also be called with `name, function` to add
    // just one helper.

    self.addHelpers = function(object /* or name, value */) {
      if (typeof (object) === 'string') {
        self.apos.templates.addHelpersForModule(self, arguments[0], arguments[1]);
      } else {
        self.apos.templates.addHelpersForModule(self, object);
      }
    };

    // Add a nunjucks template helper to the global namespace. This should
    // be used very sparingly, and pretty much never in npm modules. The
    // only exceptions in apostrophe core are `apos.area` and `apos.singleton`.
    //
    // The helper must be added first with `addHelpers`.

    self.addHelperShortcut = function(name) {
      self.apos.templates.addHelperShortcutForModule(self, name);
    };

    // Push an asset to the browser. `type` may be `script` or `stylesheet`.
    // The second argument is the name of the file, without the extension.
    //
    // For stylesheets, if `name` is `editor`, then `public/css/editor.css`
    // is pushed. If `public/css/editor.less` exists it is compiled as needed
    // to create the CSS version.
    //
    // For scripts, if `name` is `editor`, then `public/js/editor.js` is pushed.
    //
    // For both scripts and stylesheets, if the module is subclassed, and
    // the file exists in both the parent module and the subclass, *both*
    // files are pushed, in that order.
    //
    // If `options.when` is set to `always` or not specified, the asset is
    // included in every page regardless of whether the user is logged in. If
    // `options.when` is set to `user`, it is included only if the user is logged in.

    self.pushAsset = function(type, name, options) {
      // We're interested in ALL versions of main.js or main.less,
      // starting with the base one. CSS and JS are additive.
      var exists = false;
      _.each(self.__meta.chain, function(typeMeta) {
        if (self.apos.assets.push(type, name, options, typeMeta)) {
          exists = true;
        }
      });
      if (!exists) {
        self.apos.utils.error('WARNING: no versions of the ' + type + ' ' + name + ' exist, but you are pushing that asset in the ' + self.__meta.name + ' module.');
      }
    };

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

    self.render = function(req, name, data) {
      if (!data) {
        data = {};
      }
      return self.apos.templates.renderForModule(req, name, data, self);
    };

    // Similar to `render`, but sends the response to the client, ending the
    // request. If an exception is thrown by `self.render`, the error is
    // properly logged and a 500 error is correctly sent to the client.
    // Convenient in routes that simply send the markup for a modal, for instance,
    // especially if for legacy reasons they must use self.route rather tha
    // self.renderRoute.

    self.renderAndSend = function(req, name, data) {
      var html;
      try {
        html = self.render(req, name, data);
        return self.htmlResponder(req, null, html);
      } catch (e) {
        return self.htmlResponder(req, e);
      }
    };

    // For use in Nunjucks helper functions. Renders a template,
    // in the context of the same request that started the
    // original call to Nunjucks. Otherwise the
    // same as `render`.

    self.partial = function(name, data) {
      if (!data) {
        data = {};
      }
      return self.apos.templates.partialForModule(name, data, self);
    };

    // Render a template in a string (not from a file), looking for
    // includes, etc. in our preferred places.
    //
    // Otherwise the same as `render`.

    self.renderString = function(req, s, data) {
      if (!data) {
        data = {};
      }
      return self.apos.templates.renderStringForModule(req, s, data, self);
    };

    // For use in Nunjucks helper functions. Renders a template
    // found in a string (not a file), in the context of the
    // same request that started the original call to Nunjucks.
    // Otherwise the same as `partial`.

    self.partialString = function(req, s, data) {
      if (!data) {
        data = {};
      }
      return self.apos.templates.partialStringForModule(s, data, self);
    };

    // Returns a function that can be used to invoke
    // self.render at a later time. The returned function
    // must be called with req. You may pass data now
    // and also when invoking the function; data passed
    // now serves as defaults for the object passed later.

    self.renderer = function(name, data) {
      return function(req, _data) {
        _data = _data || {};
        if (data) {
          _.defaults(_data, data);
        }
        return self.render(req, name, _data);
      };
    };

    // Returns a function that can be used to invoke
    // self.partial at a later time. You may pass data now
    // and also when invoking the function; data passed
    // now serves as defaults for the object passed later.

    self.partialer = function(name, data) {
      return function(_data) {
        _data = _data || {};
        if (data) {
          _.defaults(_data, data);
        }
        return self.partial(name, _data);
      };
    };

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
    self.renderPage = function(req, template, data) {
      return self.apos.templates.renderPageForModule(req, template, data, self);
    };

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
    // First, `pageBeforeSend` is invoked on **every module that
    // has such a method**. It receives `req` and an optional callback, and
    // can modify `req.data`.

    self.sendPage = function(req, template, data) {
      return async.series([
        pageBeforeSend,
        loadDeferredWidgets
      ], function(err) {
        if (err) {
          req.aposError = err;
        }
        if ((req.data.page && req.data.page._edit) || (req.data.piece && req.data.piece._edit) || (req.data.global && req.data.global._edit)) {
          // Defeat caching if the user has editing privileges for
          // the content. #1840
          req.res.setHeader('Cache-Control', 'no-cache, must-revalidate, max-age=0');
        }
        return req.res.send(
          self.apos.templates.renderPageForModule(req, template, data, self)
        );
      });

      function pageBeforeSend(callback) {
        // For consistency with the legacy `pageBeforeSend` callAll behavior,
        // this should emit the `beforeSend` event from the expected module
        // (apostrophe-pages), not this module. Otherwise we fail at both the
        // intended purpose and the past behavior of sendPage: rendering it
        // exactly like any standard page even though it's implemented by a custom route.
        req.sendPageModuleName = self.__meta.name;
        return self.apos.pages.callAllAndEmit('pageBeforeSend', 'beforeSend', req, callback);
      }

      function loadDeferredWidgets(callback) {
        return self.apos.areas.loadDeferredWidgets(req, callback);
      }

    };

    // Push a browser call to instantiate an object with the same
    // moog type name as this module on the browser side, passing the
    // given options to the constructor. The singleton is given the
    // same alias on the `apos` object as it has on the server, if any,
    // otherwise it is still available via `apos.modules[full-module-name]`.
    //
    // This method calls `getCreateSingletonOptions(req)` to determine
    // what options object to pass to the browser-side singleton.
    //
    // If the `req` option is omitted or null, `pushBrowserCall` is used;
    // this is adequate if you don't need different options depending
    // on the current user. `getCreateSingletonOptions()` will also
    // get an undefined argument in this case.
    //
    // If `req` is given, `req.browserCall` is used, and
    // the singleton is created only once per page lifetime in the browser,
    // even if an `apos.change` event would otherwise cause it to be created again.
    //
    // If `req` is given and `when` is not, the singleton is always created; it is assumed that
    // you are def the request to decide if it is needed before calling.
    //
    // If `when` is given, the singleton is created only for the specified scene
    // (`always` or `user`).
    //
    // If neither is given, the singleton is created only for the `user` scene
    // (a user is logged in, or `req.scene` has been set to `user`).
    //
    // This method is not called automatically. Invoke it if your module
    // actually needs a singleton on the browser side. Defining the moog type
    // for that singleton is up to you (hint: look at various `user.js` files).

    self.pushCreateSingleton = function(req, when) {
      var effectiveScene;
      if ((!req) && (!when)) {
        when = 'user';
      }
      if (req && when) {
        effectiveScene = req.scene || (req.user ? 'user' : 'always');
        if ((when !== 'always') && (when !== effectiveScene)) {
          return;
        }
      }
      var options = self.getCreateSingletonOptions(req);
      if (req) {
        req.browserCall('apos.createModule(?, ?, ?)', self.__meta.name, options, self.options.alias);
      } else {
        self.apos.push.browserCall(when, 'apos.createModule(?, ?, ?)', self.__meta.name, options, self.options.alias);
      }
    };

    // `pushCreateSingleton` calls this method to find out what options should
    // be passed to the singleton it creates on the browser side. These must be
    // in the form of a JSON-friendly object. By default, the `action` property
    // is passed as the sole option, which is sometimes sufficient.

    self.getCreateSingletonOptions = function(req) {
      return {
        action: self.action
      };
    };

    // Define a new moog type related to this module, autoloading its
    // definition from the appropriate file. This is very helpful when you
    // want to define another type of object, other than the module itself.
    // Apostrophe uses this method to define database cursor types related to modules.

    // The name of the related type will be the name of the module, followed by a
    // hyphen, followed by the value of `tool`. The definition of the type will be
    // automatically loaded from the `lib/tool.js` file of the module
    // (substitute the actual tool parameter for `tool`, i.e. `cursor.js`).

    // This is done recursively for all modules that this module
    // extends, whether or not they actually have a `lib/tool.js` file.
    // If the file is missing, an empty definition is synthesized that
    // extends the next "parent class" in the chain.

    // If any of the types are already defined, execution stops at that
    // point. For instance, if `apostrophe-images` has already called this
    // as a subclass of `apostrophe-pieces`, then `apostrophe-files` will
    // just define its own cursor, extending `apostrophe-pieces-cursor`, and stop.
    // This prevents duplicate definitions when many types extend `apostrophe-pieces`.

    // If `options.stop` is set to the name of an ancestor module,
    // the chain stops **after** defining the related type for that module.

    // For instance, the module `apostrophe-files` extends
    // `apostrophe-pieces`, which extends `apostrophe-doc-type-manager`.

    // So when that module calls:

    // ```
    // self.defineRelatedType('cursor', {
    //   stop: 'apostrophe-doc-type-manager'
    // });
    // ```

    // We get:

    // apostrophe-files-cursor extends...
    // apostrophe-pieces-cursor which extends...
    // apostrophe-doc-type-manager-cursor which extends...
    // apostrophe-cursor (because `cursor.js` for doc-type-manager says so)

    self.defineRelatedType = function(tool, options) {
      var chain = self.__meta.chain;
      // For the sake of the doc generator we'll keep track of these
      self.__meta.related = [];
      defineRelatedTypeBody(chain.length - 1, tool, options);

      // if (self.__meta.name === 'apostrophe-tags') {
      //   process.exit(1);
      // }
      function defineRelatedTypeBody(i, tool, options) {
        var definition;
        var extend;
        var name = chain[i].name + '-' + tool;
        if (_.has(self.apos.synth.definitions, self.apos.synth.myToOriginal(name))) {
          // Already defined
          return;
        }
        var path = chain[i].dirname + '/lib/' + tool + '.js';
        var related = {};
        if (!fs.existsSync(path)) {
          // Synthesize
          definition = {};
        } else {
          // Load the definition; supply `extend` if it is not set
          try {
            definition = _.clone(require(path));
          } catch (e) {
            // We need to stop the show in any case, but first print
            // a more helpful syntax error message if we can
            // find it via substack's node-syntax-error module. Without this
            // we get no line number information, a known limitations of node/v8
            // as opposed to Firefox. -Tom
            if (e instanceof SyntaxError) {
              var err = syntaxError(fs.readFileSync(path), path);
              if (err) {
                throw new Error(err.toString() + '\n^^^^ LOOK UP HERE FOR THE ERROR DEFINING THE RELATED TYPE ' + name);
              }
            }
            // Intentionally fall through and throw the error further on to
            // stop the show
            throw e;
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
        var inferred = inferParentName();
        if (inferred && ((extend === inferred) || (self.apos.synth.originalToMy(extend) === inferred))) {
          defineRelatedTypeBody(i - 1, tool, options);
        }
        if (self.apos.synth.isMy(name)) {
          // Restore the implicit subclassing
          name = self.apos.synth.myToOriginal(name);
          definition.extend = undefined;
        }
        related.name = name;
        related.module = chain[i].name;
        related.extend = definition.extend;
        self.__meta.related.push(related);
        self.apos.synth.define(name, definition);

        function inferParentName() {
          if ((i > 0) && (chain[i].name !== options.stop)) {
            return self.apos.synth.myToOriginal(chain[i - 1].name + '-' + tool);
          } else {
            // A hard stop, so we don't implicitly extend
            // `apostrophe-module`. Related types are not modules
            return false;
          }
        }

      }
    };

    // Create an object of a related type defined by this module.
    // See `defineRelatedType`. A convenient wrapper for calling `apos.create`.
    //
    // For instance, if this module is `apostrophe-images`, then
    // `self.createRelatedType('cursor', { options... })` will
    // create an instance of `apostrophe-images-cursor`.
    //
    // As usual with moog, the callback is required only if
    // at least one `construct`, `beforeConstruct` or `afterConstruct`
    // function takes a callback.

    self.createRelatedType = function(tool, options, callback) {
      return self.apos.synth.create(self.__meta.name + '-' + tool, options, callback);
    };

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
    // Also available as a Nunjucks helper; often convenient to invoke
    // as `module.getOption`. When calling the helper,
    // the `req` argument is implied, just pass the path(s).

    self.getOption = function(req, dotPathOrArray, def) {
      if ((!req) || (!req.res)) {
        throw new Error('Looks like you forgot to pass req to the getOption method');
      }
      return _.get(self.options, dotPathOrArray, def);
    };

    // Log the given error, with informative context based on the given request.

    self.logError = function(req, err) {
      if (!(req && req.res)) {
        self.apos.utils.error('Looks like you did not pass req to self.logError, you should not have to call this method yourself,\nit is usually called for you by self.apiRoute, self.htmlRoute or self.renderRoute', (new Error()).stack);
        return;
      }
      // err.stack also includes the description of the error
      self.apos.utils.error(req.method + ' ' + req.url + ': ' + '\n\n' + err.stack);
    };

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
    // `req.__ns('apostrophe', subject)`.
    //
    // The callback receives `(err, info)`, per the Nodemailer documentation.
    // With most transports, lack of an `err` indicates the message was
    // handed off but has not necessarily arrived yet and could still
    // bounce back at some point.
    //
    // If you do not provide a callback, a promise is returned.

    self.email = function(req, templateName, data, options, callback) {
      if (!callback) {
        return Promise.promisify(body)();
      } else {
        return body(callback);
      }
      function body(callback) {
        return self.apos.modules['apostrophe-email'].emailForModule(req, templateName, data, options, self, callback);
      }
    };

    // Add an Apostrophe command line task to your module. The command line
    // syntax will be:
    //
    // `node app name-of-module:name`
    //
    // Where `name` is the `name` argument given here (use hyphens).
    // The usage message is printed if the user asks for help with
    // the task.
    //
    // `fn` is invoked with `(apos, argv, callback)`. You may
    // return a promise, in which case you must *not* invoke `callback`.
    //
    // To carry out actions requiring `req` in your code, call
    // `self.apos.tasks.getReq` to get a `req` with unlimited admin permissions.

    self.addTask = function(name, usage, fn) {
      return self.apos.tasks.add(self.__meta.name, name, usage, fn);
    };

    // Only safe or meaningful to add a helper in modules initialized after the
    // templates module
    if (self.apos.templates && self.apos.templates.addHelpersForModule) {
      self.addHelpers({
        // A helper to fetch properties of `self.options`.
        //
        // The first argument may be a dotPath, as in:
        //
        // `(req, 'flavors.grape.sweetness')`
        //
        // Or an array, as in:
        //
        // `(req, [ 'flavors', 'grape', 'sweetness' ])`
        //
        // The optional `def` argument is returned if the
        // property, or any of its ancestors, does not exist.
        // If no second argument is given in this situation,
        // `undefined` is returned.
        //
        // Under the hood, this helper invokes the `getOption`
        // method of the module, passing the current request
        // as the first argument for extensibility.
        'getOption': function(dotPath, def) {
          return self.getOption(self.apos.templates.contextReq, dotPath, def);
        }
      });
    }

    require('./lib/events.js')(self, options);

  }
};
