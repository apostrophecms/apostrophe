var _ = require('lodash');
var async = require('async');
var moment = require('moment');

module.exports = {
  construct: function(self, options) {

    self.options = options;
    self.apos = options.apos;
    self.templateData = self.options.templateData || {};

    var i;

    if (self.apos.assets) {
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
          console.error(self.__meta);
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
    // The data argument may be omitted.

    self.render = function(req, name, data) {
      if (!data) {
        data = {};
      }
      return self.apos.templates.render(req, name, data, self);
    };

    // For use in Nunjucks helper functions. Renders a template,
    // in the context of the same request that started the original
    // call to Nunjucks.

    self.partial = function(name, data) {
      if (!data) {
        data = {};
      }
      return self.apos.templates.partial(name, data, self);
    }

    // Render a template in a string (not from a file), looking for
    // includes, etc. in our preferred places.
    //
    // You MUST pass req as the first argument. This allows
    // internationalization/localization to work. If you
    // are writing a Nunjucks helper function, use
    // self.partialString instead.

    self.renderString = function(req, s, data) {
      if (!data) {
        data = {};
      }
      return self.apos.templates.renderString(req, s, data, self);
    };

    // For use in Nunjucks helper functions. Renders a template
    // found in a string (not a file), in the context of the
    // same request that started the original call to Nunjucks.

    self.partialString = function(req, s, data) {
      if (!data) {
        data = {};
      }
      return self.apos.templates.partial(name, data, self);
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
        return self.render(req, name, _data);
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
    // permissions (req.user.permissions)
    // calls (javascript markup to insert all global and
    //   request-specific calls pushed by server-side code)
    // data (javascript markup to insert all global and
    //   request-specific data pushed by server-side code)
    //
    self.renderPage = function(req, template, data) {

      req.pushData({
        permissions: (req.user && req.user.permissions) || {}
      });

      var when = req.user ? 'user' : 'anon';
      var calls = self.apos.push.getGlobalCallsWhen('always');
      if (when === 'user') {
        calls = calls + self.apos.push.getGlobalCallsWhen('user');
      }
      calls = calls + req.getCalls();

      // Always the last call; signifies we're done initializing the
      // page as far as the core is concerned; a lovely time for other
      // modules and project-level javascript to do their own
      // enhancements. The content area refresh mechanism also
      // triggers this event. Use afterYield to give other things
      // a chance to finish initializing
      calls += '\napos.afterYield(function() { apos.emit("ready"); });\n';

      // JavaScript may want to know who the user is. Provide
      // just a conservative set of basics for security. Devs
      // who want to know more about the user in browserland
      // can push more data and it'll merge
      if (req.user) {
        req.pushData({ user: _.pick('title', '_id', 'username') });
      }

      var decorate = !(req.query.apos_refresh || req.query.xhr || req.xhr || (req.decorate === false));

      var args = {
        outerLayout: decorate ? 'apostrophe-templates:outerLayout.html' : 'apostrophe-templates:refreshLayout.html',
        user: req.user,
        permissions: (req.user && req.user.permissions) || {},
        when: req.user ? 'user' : 'anon',
        jsCalls: calls,
        jsData: self.apos.push.getGlobalData() +
          req.getData(),
        refreshing: req.query && (!!req.query.apos_refresh),
        // Make the query available to templates for easy access to
        // filter settings etc.
        query: req.query,
      };

      _.extend(args, data);

      try {
        if (typeof(template) === 'string') {
          content = self.render(req, template, args);
        } else {
          content = template(req, args);
        }
      } catch (e) {
        // The page template
        // threw an exception. Log where it
        // occurred for easier debugging
        return error(e, 'template');
      }

      return content;

      function error(e, type) {
        var now = Date.now();
        now = moment(now).format("YYYY-MM-DDTHH:mm:ssZZ");
        console.error(':: ' + now + ': ' + type + ' error at ' + req.url);
        console.error('Current user: ' + (req.user ? req.user.username : 'none'));
        console.error(e);
        req.statusCode = 500;
        return self.render(req, 'templateError');
      }
    };

  }
};
