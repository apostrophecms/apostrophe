var _ = require('lodash');
var async = require('async');
var moment = require('moment');

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

    // mailer
    // route
    // etc

    // Allows routes to be overridden, which you normally can't do
    // in Express. You call...
    //
    // self.route('post', 'edit-monkey', function(req, res) { ... })
    //
    // That is similar to:
    //
    // self.apos.app.post(self.action + '/edit-monkey', ...)
    //
    // You can also pass middleware in the usual way, after
    // "path".
    //
    // For instance, if you want to accept a file upload,
    // you should use this middleware: self.apos.middleware.files

    var routes = {};
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

    // Add nunjucks helpers in the namespace for our module

    self.addHelpers = function(object /* or name, value */) {
      if (typeof(object) === 'string') {
        self.apos.templates.addHelpersForModule(self, arguments[0], arguments[1]);
      } else {
        self.apos.templates.addHelpersForModule(self, object);
      }
    };

    self.addHelperShortcut = function(name) {
      self.apos.templates.addHelperShortcutForModule(self, name);
    };

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

    // TODO: self.replaceAsset, which would allow you to
    // replace an existing asset, such as jquery or editor.js,
    // rather than the usual browser-side subclassing pattern.

    // SYNTAX ONE:
    // If you replace the 'editor' asset, this should remove any
    // copies of 'editor.js' from your ancestor classes, but
    // should NOT prevent those in your subclasses from being pushed.

    // SYNTAX TWO:
    // If you explicitly replace the 'editor' asset for a specific
    // module, which need not be your own ancestor, then that specific
    // module's file is substituted with no impact on what happens
    // with ancestors or subclasses.

    // self.replaceAsset = function(type, name, options);

    // self.replaceAsset = function(type, name, options, targetModule);






    // Render a template. Template overrides are respected; the
    // project level lib/modules/modulename/views folder wins if
    // it has such a template, followed by the npm module,
    // followed by its parent classes.
    //
    // You MUST pass req as the first argument. This allows
    // internationalization/localization to work. If you
    // are writing a Nunjucks helper function, use
    // self.partial instead.
    //
    // All properties of `data` appear in Nunjucks as
    // the `data` object. Nunjucks helper functions
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
    // now serves as defaults for the object passed later

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
    // now serves as defaults for the object passed later

    self.partialer = function(name, data) {
      return function(_data) {
        _data = _data || {};
        if (data) {
          _.defaults(_data, data);
        }
        return self.partial(name, _data);
      };
    };

    // Generate a complete HTML page for transmission to the
    // browser.
    //
    // If `template` is a function it is passed a data object,
    // otherwise it is rendered as a nunjucks template relative
    // to this module via self.render.
    //
    // `data` is provided to the template, with additional
    // default properties as described below.
    //
    // "outerLayout" is set to:
    //
    // "apostrophe-templates:outerLayout.html"
    //
    // Or:
    //
    // "apostrophe-templates:refreshLayout.html"
    //
    // This allows the template to handle either a content area
    // refresh or a full page render just by doing this:
    //
    // {% extend outerLayout %}
    //
    // Note the lack of quotes.
    //
    // Under the following conditions, "refreshLayout.html"
    // is used in place of "outerLayout.html":
    //
    // req.xhr is true (always set on AJAX requests by jQuery)
    // req.query.xhr is set to simulate an AJAX request
    // req.decorate is false
    // req.query.apos_refresh is true
    //
    // These default properties are also provided:
    //
    // user (req.user)
    // query (req.query)
    // permissions (req.user._permissions)
    // calls (javascript markup to insert all global and
    //   request-specific calls pushed by server-side code)
    // data (javascript markup to insert all global and
    //   request-specific data pushed by server-side code)
    //
    self.renderPage = function(req, template, data) {
      return self.apos.templates.renderPageForModule(req, template, data, self);
    };

  }
};
