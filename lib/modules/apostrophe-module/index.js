// This "module" is the base class for all other modules. This module
// is never actually configured and used directly. Instead all other modules
// extend it (or a subclass of it) and benefit from its standard features,
// including asset pushing, template rendering, etc.
//
// New methods added here should be lightweight wrappers that invoke
// an implementation provided in another module, such as `apostrophe-assets`,
// with sensible defaults for the current module. For instance,
// any module can call `self.render(req, 'show', { data... })` to
// render the `views/show.html` template of that module.
//
// TODO: wrappers for delivering email and adding command-line tasks.
// In the meantime it is recommended that you always use
// your module's name and a colon as the prefix for a task name when
// calling `self.apos.tasks.add`.

var _ = require('lodash');
var async = require('async');
var moment = require('moment');
var fs = require('fs');
var syntaxError = require('syntax-error');

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

    var i;

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

    self.route = function(method, path, fn) {
      var key = method + '.' + path;
      if (!routes[key]) {
        self.apos.app[method](self.action + '/' + path, function(req, res) {
          var fns = routes[key];
          return async.eachSeries(fns, function(fn, callback) {
            return fn(req, res, function() {
              return callback();
            });
          });
        });
      }
      routes[method + '.' + path] = Array.prototype.slice.call(arguments, 2);
    };

    // Add nunjucks template helpers in the namespace for our module. Typically called
    // with an object in which each property is a helper name and each value
    // is a helper function. Can also be called with `name, function` to add
    // just one helper.

    self.addHelpers = function(object /* or name, value */) {
      if (typeof(object) === 'string') {
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

    // Push an asset to the browser. `type` may be `script`, `stylesheet`
    // or `template`. The second argument is the name of the file, without
    // the extension.
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
    // If `type` is `template`, the corresponding template in this module is
    // rendered and added to the DOM of each page before the closing `body` tag, to be
    // cloned and made visible as needed. If the module is subclassed, only
    // the newest (subclass) version is sent.
    //
    // If `options.when` is set to `always` or not specified, the asset is
    // included in every page regardless of whether the user is logged in. If
    // `options.when` is set to `user`, it is included only if the user is logged in.

    self.pushAsset = function(type, name, options) {
      if (type === 'template') {
        // Render templates in our own nunjucks context
        self.apos.assets.push('template', self.renderer(name), options, self.__meta.chain[self.__meta.chain.length - 1]);
      } else {
        // We're interested in ALL versions of main.js or main.less,
        // starting with the base one. CSS and JS are additive.
        var exists = false;
        _.each(self.__meta.chain, function(typeMeta) {
          if (self.apos.assets.push(type, name, options, typeMeta)) {
            exists = true;
          }
        });
        if (!exists) {
          console.error('WARNING: no versions of the ' + type + ' ' + name + ' exist, but you are pushing that asset in the ' + self.__meta.name + ' module.');
        }
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

    // For use in Nunjucks helper functions. Renders a template,
    // in the context of the same request that started the
    // original call to Nunjucks. Otherwise the
    // same as `render`.

    self.partial = function(name, data) {
      if (!data) {
        data = {};
      }
      return self.apos.templates.partialForModule(name, data, self);
    }

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
          req.error = err;
        }
        return req.res.send(
          self.apos.templates.renderPageForModule(req, template, data, self)
        );
      });
      
      function pageBeforeSend(callback) {
        return self.apos.callAll('pageBeforeSend', req, callback);
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
    // on the current user. `getBrowserSingletonOptions()` will also
    // get an undefined argument in this case.
    //
    // If `req` is given, `req.browserCall` is used, and
    // the singleton is created only once per page lifetime in the browser,
    // even if an `apos.change` event would otherwise cause it to be created again.
    //
    // If `req` is given and `when` is not, the singleton is always created; it is assumed that
    // you are looking at the request to decide if it is needed before calling.
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
        var synthesized;
        var name = chain[i].name + '-' + tool;
        if (_.has(self.apos.synth.definitions, name.replace(/^my-/, ''))) {
          // Already defined
          return;
        }
        var path = chain[i].dirname + '/lib/' + tool + '.js';
        var related = {};
        if (!fs.existsSync(path)) {
          // Synthesize
          definition = {};
          synthesized = true;
        } else {
          // Load the definition; supply `extend` if it is not set
          try {
            definition = require(path);
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
        if (inferred && ((extend === inferred) || (('my-' + extend) === inferred))) {
          defineRelatedTypeBody(i - 1, tool, options);
        }
        if (name.match(/^my-/)) {
          // Restore the implicit subclassing
          name = name.replace(/^my-/, '');
          definition.extend = undefined;
        }
        // console.log('DEFINING ' + name + (synthesized ? ' (synthetic)' : ''));
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

  }
};
