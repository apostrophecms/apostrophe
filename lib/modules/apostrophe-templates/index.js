// Implements template rendering via Nunjucks. **You should use the
// `self.render` and `self.partial` methods of *your own* module**,
// which exist courtesy of [apostrophe-module](/reference/modules/apostrophe-module)
// and invoke methods of this module more conveniently for you.
//
// You may have occasion to call `self.apos.templates.safe` when
// implementing a helper that returns a value that should not be
// escaped by Nunjucks. You also might call `self.apos.templates.filter` to
// add a new filter to Nunjucks.
//
// ## Options
//
// ### `filters`: an object in which
// each key is the name of a Nunjucks filter and
// its corresponding value is a function that implements it.
// You may find it easier and more maintainable to call `apos.templates.addFilter(name, fn)`.
//
// ### `language`: your own alternative to the object
// returned by require('nunjucks'). Replacing Nunjucks
// entirely in Apostrophe would be a vast undertaking, but perhaps
// you have a custom version of Nunjucks that is compatible.
//
// ### `viewsFolderFallback`: specifies a folder or an array of folders to be checked for templates
// if they are not found in the module that called `self.render` or `self.partial`
// or those it extends. This is a handy place for project-wide macro files.
// Often set to `__dirname + '/views'` in `app.js`.

var _ = require('@sailshq/lodash');
var moment = require('moment');
var qs = require('qs');

module.exports = {

  alias: 'templates',

  afterConstruct: function(self) {
    self.enableHelpers();
  },

  construct: function(self, options) {

    self.templateApos = {
      modules: {},
      log: function(msg) {
        self.apos.utils.log.apply(self.apos, arguments);
      },
      prefix: self.apos.prefix
    };

    self.helperShortcuts = {};
    self.filters = {};

    self.nunjucks = options.language || require('@apostrophecms/nunjucks');

    // Add helpers in the namespace for a particular module.
    // They will be visible in nunjucks at
    // apos.modules[module-name].helperName. If the alias
    // option for the module is set to "shortname", then
    // they are also visible as apos.shortname.helperName.
    // Note that the alias option must be set only by the
    // project-level developer (except for core modules).

    self.addHelpersForModule = function(module, object /* or module, name, value */) {
      var helpersForModules = self.templateApos.modules;
      helpersForModules[module.__meta.name] = helpersForModules[module.__meta.name] || {};
      var helpersForModule = helpersForModules[module.__meta.name];
      if (typeof (object) === 'string') {
        helpersForModule[arguments[1]] = arguments[2];
      } else {
        _.merge(helpersForModule, object);
      }
    };

    self.addHelperShortcutForModule = function(module, name) {
      self.helperShortcuts[module.__meta.name] = self.helperShortcuts[module.__meta.name] || [];
      self.helperShortcuts[module.__meta.name].push(name);
    };

    // The use of this method is restricted to core modules
    // and should only be used for apos.area, apos.singleton,
    // and anything we later decide is at least that important.
    // Everything else should be namespaced at all times,
    // at least under its module alias. -Tom

    self.addShortcutHelper = function(name, value) {
      self.shortcutHelpers[name] = value;
    };

    // When all modules have finished adding helpers, wrap all
    // helper functions so that the true line numbers responsible
    // for any errors can be seen in the error logs. Also apply
    // module aliases, make the options passed to the module available
    // in nunjucks, and apply any helper shortcuts

    self.modulesReady = function() {
      wrapFunctions(self.templateApos);
      _.each(self.templateApos.modules, function(helpers, moduleName) {
        var alias = self.apos.modules[moduleName].options.alias;
        if (alias) {
          if (_.has(self.templateApos, alias)) {
            throw new Error('The module ' + moduleName + ' has the alias ' + alias + ' which conflicts with core functionality. Change the alias.');
          }
          self.templateApos[alias] = helpers;
        }
      });
      _.each(self.templateApos.modules, function(helpers, moduleName) {
        helpers.options = self.apos.modules[moduleName].options;
      });
      _.each(self.helperShortcuts, function(list, moduleName) {
        _.each(list, function(name) {
          self.templateApos[name] = self.templateApos.modules[moduleName][name];
        });
      });

      function wrapFunctions(object) {
        _.each(object, function(value, key) {
          if (typeof (value) === 'object') {
            wrapFunctions(value);
          } else if (typeof (value) === 'function') {
            object[key] = function() {
              return value.apply(self, arguments);
            };
          }
        });
      }
    };

    // Add new filters to the Nunjucks environment. You
    // can add many by passing an object with named
    // properties, or add just one by passing a name
    // and a function. You can also do this through the
    // filters option of this module.

    self.addFilter = function(object /* or name, fn */) {
      if (typeof (object) === 'string') {
        self.filters[arguments[0]] = arguments[1];
      } else {
        _.extend(self.filters, object);
      }
    };

    // return a string which will not be escaped
    // by Nunjucks. Call this in your helper function
    // when your return value contains markup and you
    // are absolutely sure that any user input has
    // been correctly escaped already.

    self.safe = function(s) {
      return new self.nunjucks.runtime.SafeString(s);
    };

    // Load and render a Nunjucks template, internationalized
    // by the given req object. The template with the name
    // specified is loaded from the views folder of the
    // specified module or its superclasses; the deepest
    // version of the template wins. You normally won't call
    // this directly; you'll call self.render on your module.

    // Apostrophe Nunjucks helpers such as `apos.area` are
    // attached to the `apos` object in your template.

    // Data passed in your `data` object is provided as the
    // `data` object in your template, which also contains
    // properties of `req.data` and `module.templateData`,
    // if those objects exist.

    // If there is a conflict, your `data` argument wins,
    // followed by `req.data`.

    // If not overridden, `data.user` and `data.permissions`
    // are provided for convenience.

    // The .html extension is assumed.

    self.renderForModule = function(req, name, data, module) {
      if (typeof (req) !== 'object') {
        throw new Error('The first argument to module.render must be req. If you are trying to implement a Nunjucks helper function, use module.partial.');
      }
      return self.renderBody(req, 'file', name, data, module);
    };

    // Works just like self.render, except that the
    // entire template is passed as a string rather than
    // a filename.

    self.renderStringForModule = function(req, s, data, module) {
      if (typeof (req) !== 'object') {
        throw new Error('The first argument to module.render must be req. If you are trying to implement a Nunjucks helper function, use module.partial.');
      }
      return self.renderBody(req, 'string', s, data, module);
    };

    self.partialForModule = function(name, data, module) {
      var req = self.contextReq;
      if (!req) {
        throw new Error('partial() must always be called from within a Nunjucks helper function invoked via a Nunjucks template. If you are rendering a template in your own route, use render() and pass req at the first argument.');
      }
      return self.safe(self.renderForModule(req, name, data, module));
    };

    self.partialStringForModule = function(name, data, module) {
      var req = self.contextReq;
      if (!req) {
        throw new Error('partialString() must always be called from within a Nunjucks helper function invoked via a Nunjucks template. If you are rendering a template in your own route, use renderString() and pass req at the first argument.');
      }
      return self.safe(self.renderStringForModule(req, name, data, module));
    };

    // Stringify the data as JSON, then escape any sequences
    // that would cause a `script` tag to end prematurely if
    // the JSON were embedded in it. Also make sure the JSON is
    // JS-friendly by escaping unicode line and paragraph
    // separators.
    //
    // If the argument is `undefined`, `"null"` is returned. This is
    // better than the behavior of JSON.stringify (which returns
    // `undefined`, not "undefined") while still being JSONic
    // (`undefined` is not valid in JSON).

    self.jsonForHtml = function(data) {
      if (data === undefined) {
        return 'null';
      }
      data = JSON.stringify(data); // , null, '  ');
      data = data.replace(/<!--/g, '<\\!--');
      data = data.replace(/<\/script>/gi, '<\\/script>');
      // unicode line separator and paragraph separator break JavaScript parsing
      data = data.replace(/\u2028/g, "\\u2028");
      data = data.replace(/\u2029/g, "\\u2029");
      return data;
    };

    // Implements `render` and `renderString`. See their
    // documentation.

    self.renderBody = function(req, type, s, data, module) {
      if (self.contextReq && (req !== self.contextReq)) {
        throw new Error('render() must not be called from a Nunjucks helper function nested inside another call to render(). Use partial() instead.');
      }

      try {
        // "OMG, a global variable?" Yes, it's safe for the
        // duration of a single synchronous render operation,
        // which allows partial() to be called without a req.
        //
        // However note that partialForModule calls
        // renderForModule, so we track the depth of
        // those calls to avoid clearing contextReq
        // prematurely

        if (!self.renderDepth) {
          self.renderDepth = 0;
          self.contextReq = req;
        }
        self.renderDepth++;

        var merged = {};

        if (data) {
          _.defaults(merged, data);
        }

        var args = {};

        args.data = merged;
        args.module = self.templateApos.modules[module.__meta.name];

        // // Allows templates to render other templates in an independent
        // // nunjucks environment, rather than including them
        // args.partial = function(name, data) {
        //   return self.partialForModule(name, data, module);
        // };

        if (req.data) {
          _.defaults(merged, req.data);
        }
        _.defaults(merged, {
          user: req.user,
          permissions: (req.user && req.user._permissions) || {}
        });

        if (module.templateData) {
          _.defaults(merged, module.templateData);
        }

        args.data.locale = args.data.locale || req.locale;

        var result;

        var env = self.getEnv(module);

        // "Why are you using addGlobal here?" Because Apostrophe
        // developers expect these things (well, at least apos and __)
        // to be visible in all templates, including imported macro
        // templates.
        //
        // "Is this safe?" Yes, because we call nunjucks
        // synchronously.
        //
        // "Can we push `data` this way?" No. That would mess
        // up nested nunjucks render calls (partials). If you want
        // data in your imported macros you'll just have to pass it in.

        env.addGlobal('apos', self.templateApos);

        var fns = [ '__ns', '__ns_n', '__ns_mf', '__ns_l', '__ns_h', '__', '__n', '__mf', '__l', '__h' ];
        _.each(fns, function(name) {
          env.addGlobal(name, function(key) {
            return self.i18n.apply(null, [ req, name ].concat(Array.prototype.slice.call(arguments)));
          });
        });

        if (type === 'file') {
          var finalName = s;
          if (!finalName.match(/\.\w+$/)) {
            finalName += '.html';
          }
          result = env.getTemplate(finalName).render(args);
        } else if (type === 'string') {
          result = env.renderString(s, args);
        } else {
          throw new Error('renderBody does not support the type ' + type);
        }
      } catch (e) {
        self.renderDepth--;
        if (!self.renderDepth) {
          delete self.contextReq;
        }
        self.apos.utils.error('e.stack: ', e.stack);
        throw e;
      };
      self.renderDepth--;
      if (!self.renderDepth) {
        delete self.contextReq;
      }
      return result;
    };

    // Takes `req`, `operation` which will be '__', '__mf' or another
    // standard helper name provided by the i18n module, and the
    // arguments intended for that helper, beginning always with `key`.
    // Invokes the specified operation of the i18n module. This
    // method exists as an override and extension point for
    // Apostrophe's static text internationalization features.

    self.i18n = function(req, operation /* , additional arguments */) {
      return req.res[operation].apply(req.res, Array.prototype.slice.call(arguments, 2));
    };

    self.envs = {};

    // Fetch a nunjucks environment in which `include`,
    // `extends`, etc. search the views directories of the
    // specified module and its ancestors. Typically you
    // will call `self.render`, `self.renderPage` or
    // `self.partial` on your module object rather than calling
    // this directly.

    self.getEnv = function(module) {
      var name = module.__meta.name;

      // Cache for performance
      if (_.has(self.envs, name)) {
        return self.envs[name];
      }
      self.envs[name] = self.newEnv(name, self.getViewFolders(module));
      return self.envs[name];
    };

    self.getViewFolders = function(module) {
      var dirs = _.map(module.__meta.chain, function(entry) {
        return entry.dirname + '/views';
      });
      // Final class should win
      dirs.reverse();
      if (options.viewsFolderFallback) {
        if (typeof options.viewsFolderFallback === "string") {
          dirs.push(options.viewsFolderFallback);
        } else {
          dirs.push(...options.viewsFolderFallback);
        }
      }
      return dirs;
    };

    // Create a new nunjucks environment in which the
    // specified directories are searched for includes,
    // etc. Don't call this directly, use:
    //
    // apos.templates.getEnv(module)

    self.newEnv = function(moduleName, dirs) {

      var loader = self.newLoader(moduleName, dirs, undefined, self);

      var env = new self.nunjucks.Environment(loader, { autoescape: true });

      self.addStandardFilters(env);

      _.each(self.filters, function(filter, name) {
        env.addFilter(name, filter);
      });

      if (self.options.filters) {
        _.each(self.options.filters, function(filter, name) {
          env.addFilter(name, filter);
        });
      }

      return env;
    };

    // Creates a Nunjucks loader object for the specified
    // list of directories, which can also call back to
    // this module to resolve cross-module includes. You
    // will not need to call this directly.

    self.newLoader = function(moduleName, dirs) {
      var NunjucksLoader = require('./lib/nunjucksLoader.js');
      return new NunjucksLoader(moduleName, dirs, undefined, self, self.options.loader);
    };

    self.addStandardFilters = function(env) {

      // Format the given date with the given momentjs
      // format string.

      env.addFilter('date', function(date, format, locale) {
        // Nunjucks is generally highly tolerant of bad
        // or missing data. Continue this tradition by not
        // crashing if date is null. -Tom
        if (!date) {
          return '';
        }
        var dateLocale = locale || self.apos.templates.contextReq.locale;
        var m = moment(date);
        if (dateLocale) {
          m.locale(dateLocale);
        }
        var s = m.format(format);
        return s;
      });

      // Stringify the given data as a query string.

      env.addFilter('query', function(data) {
        return qs.stringify(data || {});
      });

      // Stringify the given data as JSON, with
      // additional escaping for safe inclusion
      // in a script tag.

      env.addFilter('json', function(data) {
        return self.safe(self.jsonForHtml(data));
      });

      // Builds filter URLs. See the URLs module.

      env.addFilter('build', self.apos.urls.build);

      // Remove HTML tags from string, leaving only
      // the text. All lower case to match jinja2's naming.

      env.addFilter('striptags', function(data) {
        return data.replace(/(<([^>]+)>)/ig, "");
      });

      // Convert newlines to <br /> tags.
      env.addFilter('nlbr', function(data) {
        data = self.apos.utils.globalReplace(data, "\n", "<br />\n");
        return self.apos.templates.safe(data);
      });

      // Newlines to paragraphs, produces better spacing and semantics
      env.addFilter('nlp', function(data) {
        if ((data === null) || (data === undefined)) {
          // don't crash, nunjucks tolerates nulls
          return '';
        }
        var parts = data.toString().split(/\n/);
        var output = _.map(parts, function(part) {
          return '<p>' + part + '</p>\n';
        }).join('');
        return output;
      });

      // Convert the camelCasedString s to a hyphenated-string,
      // for use as a CSS class or similar.
      env.addFilter('css', function(s) {
        return self.apos.utils.cssName(s);
      });

      env.addFilter('clonePermanent', function(o, keepScalars) {
        return self.apos.utils.clonePermanent(o, keepScalars);
      });

      // Output "data" as JSON, escaped to be safe in an
      // HTML attribute. By default it is escaped to be
      // included in an attribute quoted with double-quotes,
      // so all double-quotes in the output must be escaped.
      // If you quote your attribute with single-quotes
      // and pass { single: true } to this filter,
      // single-quotes in the output are escaped instead,
      // which uses dramatically less space and produces
      // more readable attributes.
      //
      // EXCEPTION: if the data is not an object or array,
      // it is output literally as a string. This takes
      // advantage of jQuery .data()'s ability to treat
      // data attributes that "smell like" objects and arrays
      // as such and take the rest literally.

      env.addFilter('jsonAttribute', function(data, options) {
        if (typeof (data) === 'object') {
          return self.safe(self.apos.utils.escapeHtml(JSON.stringify(data), options));
        } else {
          // Make it a string for sure
          data += '';
          return self.safe(self.apos.utils.escapeHtml(data, options));
        }
      });

      env.addFilter('merge', function(data /* ,obj2, obj3... */) {
        var output = {};
        var i;
        for (i = 0; (i < arguments.length); i++) {
          _.assign(output, arguments[i]);
        }
        return output;
      });

      // "Blesses" a particular options object, remembering that it is acceptable
      // for API calls during the same session that check their options with
      // apos.utils.isBlessed and the same additional arguments. See
      // self.apos.utils.bless.

      env.addFilter('bless', function(options /* , 'widget', widget.type... */) {
        var args = [ self.contextReq ];
        var i;
        for (i = 0; (i < arguments.length); i++) {
          args.push(arguments[i]);
        }
        self.apos.utils.bless.apply(self.apos.utils, args);
        return options;
      });
    };

    // Typically you will call the `sendPage` method of
    // your own module, provided by the `apostrophe-module`
    // base class, which is a wrapper for this method.
    //
    // Send a complete HTML page for to the
    // browser.
    //
    // If `template` is a function it is passed a data object,
    // otherwise it is rendered as a nunjucks template relative
    // to this module via self.render.
    //
    // `data` is provided to the template, with additional
    // default properties as described below.
    //
    // `module` is the module from which the template should
    // be rendered, if an explicit module name is not part
    // of the template name.
    //
    // Additional properties merged with the `data object:
    //
    // "outerLayout" is set to...
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
    // Under **any** of the following conditions, "refreshLayout.html"
    // is used in place of "outerLayout.html":
    //
    // * `req.xhr` is true (always set on AJAX requests by jQuery)
    // * `req.query.xhr` is set to simulate an AJAX request
    // * `req.decorate` is false
    // * `req.query.apos_refresh` is true
    //
    // These default properties are also provided on the `data` object
    // visible in Nunjucks:
    //
    // * `url` (`req.url`)
    // * `user` (`req.user`)
    // * `query` (`req.query`)
    // * `permissions` (`req.user._permissions`)
    // * `refreshing` (true if we are refreshing the content area of the page without reloading)
    // * `js.globalCalls` (javascript markup to insert all global pushed javascript calls)
    // * `js.reqCalls` (javascript markup to insert all req-specific pushed javascript calls)

    self.renderPageForModule = function(req, template, data, module) {

      var content;
      var scene = req.user ? 'user' : 'anon';
      if (req.scene) {
        scene = req.scene;
      }
      var globalCalls = self.apos.push.getBrowserCalls('always');
      if (scene === 'user') {
        globalCalls += self.apos.push.getBrowserCalls('user');
      }

      // Always the last call; signifies we're done initializing the
      // page as far as the core is concerned; a lovely time for other
      // modules and project-level javascript to do their own
      // enhancements.
      //
      // This method emits a 'ready' event, and also
      // emits an 'enhance' event with the entire $body
      // as its argument.
      //
      // Waits for DOMready to give other
      // things maximum opportunity to happen.

      var decorate = !(req.query.apos_refresh || req.query.xhr || req.xhr || (req.decorate === false));

      if (req.query.apos_refresh) {
        // Trigger the apos.ready and apos.enhance events after the
        // DOM settles and pushed javascript has had a chance to run;
        // do it just in the context of the refreshed main content div
        req.browserCall('apos.pageReadyWhenCalm($("[data-apos-refreshable]"))');
      } else if (decorate) {
        // Trigger the apos.ready and apos.enhance events after the
        // DOM settles and pushed javascript has had a chance to run
        req.browserCall('apos.pageReadyWhenCalm($("body"));');
      } else {
        // If we're ajaxing something other than data-apos-refreshable,
        // responsibility for progressive enhancement falls on the developer
      }

      // JavaScript may want to know who the user is. Provide
      // just a conservative set of basics for security. Devs
      // who want to know more about the user in browserland
      // can push more data and it'll merge
      if (req.user) {
        req.browserCall('apos.user = ?;', _.pick(req.user, 'title', '_id', 'username'));
      }

      req.browserCall('apos.scene = ?', scene);

      var reqCalls = req.getBrowserCalls();

      var urls = require('url');

      // data.url will be the original requested page URL, for use in building
      // relative links, adding or removing query parameters, etc. If this is a
      // refresh request, we remove that so that frontend templates don't build
      // URLs that also refresh

      var dataUrl = req.url;

      var parsed = urls.parse(req.url, true);
      if (parsed.query && parsed.query.apos_refresh) {
        delete parsed.query.apos_refresh;
        delete parsed.search;
        dataUrl = urls.format(parsed);
      }

      var args = {
        outerLayout: decorate ? 'apostrophe-templates:outerLayout.html' : 'apostrophe-templates:refreshLayout.html',
        permissions: (req.user && req.user._permissions) || {},
        when: scene,
        js: {
          globalCalls: self.safe(globalCalls),
          reqCalls: self.safe(reqCalls)
        },
        refreshing: req.query && (!!req.query.apos_refresh),
        // Make the query available to templates for easy access to
        // filter settings etc.
        query: req.query,
        url: dataUrl
      };

      _.extend(args, data);

      if (req.aposError) {
        // A 500-worthy error occurred already, i.e. in `pageBeforeSend`
        return error(req.aposError, 'template');
      }

      try {
        if (typeof (template) === 'string') {
          content = module.render(req, template, args);
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
        self.apos.utils.error(':: ' + now + ': ' + type + ' error at ' + req.url);
        self.apos.utils.error('Current user: ' + (req.user ? req.user.username : 'none'));
        self.apos.utils.error(e);
        req.statusCode = 500;
        return self.render(req, 'templateError');
      }
    };

    // Add a body class or classes to be emitted when the page is rendered. This information
    // is attached to `req.data`, where the string `req.data.aposBodyClasses` is built up.
    // The default `outerLayoutBase.html` template outputs that string.
    // The string passed may contain space-separated class names.

    self.addBodyClass = function(req, bodyClass) {
      req.data.aposBodyClasses = (req.data.aposBodyClasses ? (req.data.aposBodyClasses + ' ') : '') +
        bodyClass;
    };

    // Add a body attribute to be emitted when the page is rendered. This information
    // is attached to `req.data`, where `req.data.aposBodyDataAttributes` is built up
    // using `name` as the attribute name which is automatically prepended with "data-"
    // and the optional `value` argument
    // Also receives an object with key/pair values which becomes attribute name(s) and value(s)
    // The default `outerLayoutBase.html` template outputs that string.

    self.addBodyDataAttribute = function(req, name, value = '') {
      var values = {};
      if (_.isObject(name) && !_.isArray(name) && !_.isFunction(name)) {
        values = name;
      } else {
        if (name && name.toString().length > 0 && value && value.toString().length > 0) {
          values[name] = value;
        }
      }
      _.each(values, (value, key) => {
        if (_.isEmpty(key)) {
          return;
        }
        req.data.aposBodyDataAttributes = (req.data.aposBodyDataAttributes ? (req.data.aposBodyDataAttributes + ' ') : ' ') +
        ('data-' + (!_.isUndefined(value) && value.toString().length > 0 ? (self.apos.utils.escapeHtml(key) + ('="' + self.apos.utils.escapeHtml(value) + '"')) : self.apos.utils.escapeHtml(key)));
      });
    };

    self.insertions = {};

    // Use this method to provide a function that will be invoked at the point
    // in the page layout identified by the string `location`. Standard locations
    // are `head`, `body`, `main` and `contextMenu`.
    //
    //  The page layout, template or outerLayout must contain a corresponding
    // `apos.templates.prepended('location')` call, with the same location, to
    // actually insert the content.
    //
    // **Your function is called once per request,** and will receive `req` as an argument
    // as a convenience. Since page rendering is in progress, `req` will be equal to
    // `apos.templates.contextReq`.
    //
    // The output of functions added with `prepend` is prepended just after the
    // opening tag of an element, such as `<head>`. Use `append` to insert material
    // before the closing tag.
    //
    // This method is most often used when writing a module that adds new UI
    // to Apostrophe and allows you to add that markup without forcing
    // developers to customize their layout for your module to work.

    self.prepend = function(location, helperFn) {
      if ((typeof helperFn) === 'string') {
        throw new Error('Do not pass a string to apos.templates.prepend. Pass a function which returns a string and optionally takes a req argument.');
      }
      return self.insert('prepend', location, helperFn);
    };

    // Use this method to provide a function that will be invoked at the point
    // in the page layout identified by the string `location`. Standard locations
    // are `head`, `body`, `main` and `contextMenu`.
    //
    //  The page layout, template or outerLayout must contain a corresponding
    // `apos.templates.prepended('location')` call, with the same location, to
    // actually insert the content.
    //
    // **Your function is called once per request,** and will receive `req` as an argument
    // as a convenience. Since page rendering is in progress, `req` will be equal to
    // `apos.templates.contextReq`.
    //
    // The output of functions added with `append` is appended just before the
    // closing tag of an element, such as `</head>`. Use `prepend` to insert material
    // after the opening tag.
    //
    // This method is most often used when writing a module that adds new UI
    // to Apostrophe and allows you to add that markup without forcing
    // developers to customize their layout for your module to work.

    self.append = function(location, helperFn) {
      if ((typeof helperFn) === 'string') {
        throw new Error('Do not pass a string to apos.templates.append. Pass a function which returns a string and optionally takes a req argument.');
      }
      return self.insert('append', location, helperFn);
    };

    // Implementation detail of `apos.templates.prepend` and `apos.templates.append`.

    self.insert = function(end, location, helperFn) {
      var key = end + '-' + location;
      self.insertions[key] = self.insertions[key] || [];
      self.insertions[key].push(helperFn);
    };

    // Implementation detail of `apos.templates.prepended` and `apos.templates.appended`.

    self.inserted = function(end, location) {
      var key = end + '-' + location;
      return self.apos.templates.safe(_.map(self.insertions[key] || [], function(helperFn) {
        return helperFn(self.apos.templates.contextReq);
      }).join('\n'));
    };

    // Invokes all of the `prepend` helper functions registered for the given
    // location and returns the resulting markup as a Nunjucks "safe" string
    // (HTML tags are allowed). Available as the `apos.templates.prepended`
    // helper, and invoked as such by `outerLayoutBase.html`.

    self.prepended = function(location) {
      return self.inserted('prepend', location);
    };

    // Invokes all of the `append` helper functions registered for the given
    // location and returns the resulting markup as a Nunjucks "safe" string
    // (HTML tags are allowed). Available as the `apos.templates.appended`
    // helper, and invoked as such by `outerLayoutBase.html`.

    self.appended = function(location) {
      return self.inserted('append', location);
    };

    // Determines whether the aposContextMenu block, which contains
    // the "Page Settings" and "Published" UIs in the lower left corner
    // in addition to further UI pushed by modules like workflow, should
    // appear or not. Override to add additional nuances to this decision.

    self.showContextMenu = function(req) {
      return req.user && (
        (req.data.page && req.data.page._edit) || (req.data.piece && req.data.piece._edit)
      );
    };

    self.enableHelpers = function() {
      self.addHelpers(_.pick(self, 'prepended', 'appended'));
      self.addHelpers({
        showContextMenu: function() {
          return self.showContextMenu(self.contextReq);
        }
      });
    };

  }

};
