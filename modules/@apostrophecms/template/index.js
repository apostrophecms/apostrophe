// Implements template rendering via Nunjucks. **You should use the
// `self.render` and `self.partial` methods of *your own* module**,
// which exist courtesy of [@apostrophecms/module](../@apostrophecms/module/index.html)
// and invoke methods of this module more conveniently for you.
//
// You may have occasion to call `self.apos.template.safe` when
// implementing a helper that returns a value that should not be
// escaped by Nunjucks. You also might call `self.apos.template.filter` to
// add a new filter to Nunjucks.
//
// ## Options
//
// ### `filters`: an object in which
// each key is the name of a Nunjucks filter and
// its corresponding value is a function that implements it.
// You may find it easier and more maintainable to call `apos.template.addFilter(name, fn)`.
//
// ### `language`: your own alternative to the object
// returned by require('nunjucks'). Replacing Nunjucks
// entirely in Apostrophe would be a vast undertaking, but perhaps
// you have a custom version of Nunjucks that is compatible.
//
// ### `viewsFolderFallback`: specifies a folder to be checked for templates
// if they are not found in the module that called `self.render` or `self.partial`
// or those it extends. This is a handy place for project-wide macro files.
// Often set to `__dirname + '/views'` in `app.js`.

const _ = require('lodash');
const dayjs = require('dayjs');
const qs = require('qs');
const Promise = require('bluebird');

module.exports = {
  options: { alias: 'template' },
  customTags(self, options) {
    return {
      component: require('./lib/custom-tags/component')(self, options)
    };
  },
  components(self, options) {
    return {
      async inject(req, data) {
        const key = `${data.end}-${data.where}`;
        return {
          components: self.insertions[key]
        };
      }
    };
  },
  init(self, options) {
    self.templateApos = {
      modules: {},
      log: function (msg) {
        self.apos.util.log.apply(self.apos, arguments);
      },
      prefix: self.apos.prefix
    };

    self.helperShortcuts = {};
    self.filters = {};

    self.nunjucks = options.language || require('nunjucks');

    self.envs = {};

    self.insertions = {};
  },
  handlers(self, options) {
    return {
      'apostrophe:afterInit': {
        wrapHelpersForTemplateAposObject() {
          wrapFunctions(self.templateApos);
          _.each(self.templateApos.modules, function (helpers, moduleName) {
            const alias = self.apos.modules[moduleName].options.alias;
            if (alias) {
              if (_.has(self.templateApos, alias)) {
                throw new Error('The module ' + moduleName + ' has the alias ' + alias + ' which conflicts with core functionality. Change the alias.');
              }
              self.templateApos[alias] = helpers;
            }
          });
          _.each(self.templateApos.modules, function (helpers, moduleName) {
            helpers.options = self.apos.modules[moduleName].options;
          });
          _.each(self.helperShortcuts, function (list, moduleName) {
            _.each(list, function (name) {
              self.templateApos[name] = self.templateApos.modules[moduleName][name];
            });
          });

          function wrapFunctions(object) {
            _.each(object, function (value, key) {
              if (typeof value === 'object') {
                wrapFunctions(value);
              } else if (typeof value === 'function') {
                object[key] = function () {
                  try {
                    return value.apply(self, arguments);
                  } catch (e) {
                    self.apos.util.error(e);
                    self.apos.util.error(e.stack);
                    self.apos.util.error('^^^^^ LOOK UP HERE FOR THE LOCATION WITHIN YOUR HELPER');
                    throw e;
                  }
                };
              }
            });
          }
        }
      }
    };
  },
  methods(self, options) {
    return {

      // Add helpers in the namespace for a particular module.
      // They will be visible in nunjucks at
      // apos.modules[module-name].helperName. If the alias
      // option for the module is set to "shortname", then
      // they are also visible as apos.shortname.helperName.
      // Note that the alias option must be set only by the
      // project-level developer (except for core modules).

      addHelpersForModule(module, object) {
        const helpersForModules = self.templateApos.modules;
        helpersForModules[module.__meta.name] = helpersForModules[module.__meta.name] || {};
        const helpersForModule = helpersForModules[module.__meta.name];
        if (typeof object === 'string') {
          helpersForModule[arguments[1]] = arguments[2];
        } else {
          _.merge(helpersForModule, object);
        }
      },

      addHelperShortcutForModule(module, name) {
        self.helperShortcuts[module.__meta.name] = self.helperShortcuts[module.__meta.name] || [];
        self.helperShortcuts[module.__meta.name].push(name);
      },

      // The use of this method is restricted to core modules
      // and should only be used for apos.area, apos.singleton,
      // and anything we later decide is at least that important.
      // Everything else should be namespaced at all times,
      // at least under its module alias. -Tom

      addShortcutHelper(name, value) {
        self.shortcutHelpers[name] = value;
      },

      // Add new filters to the Nunjucks environment. You
      // can add many by passing an object with named
      // properties, or add just one by passing a name
      // and a function. You can also do this through the
      // filters option of this module.

      addFilter(object) {
        if (typeof object === 'string') {
          self.filters[arguments[0]] = arguments[1];
        } else {
          _.extend(self.filters, object);
        }
      },

      // return a string which will not be escaped
      // by Nunjucks. Call this in your helper function
      // when your return value contains markup and you
      // are absolutely sure that any user input has
      // been correctly escaped already.

      safe(s) {
        return new self.nunjucks.runtime.SafeString(s);
      },

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

      // If there is no extension, looks for `.njk`, or `.html`
      // if `.njk` is not found.

      // Must be awaited (async function).

      async renderForModule(req, name, data, module) {
        if (typeof req !== 'object') {
          throw new Error('The first argument to module.render must be req. If you are trying to implement a Nunjucks helper function, use module.partial.');
        }
        return self.renderBody(req, 'file', name, data, module);
      },

      // Works just like self.render, except that the
      // entire template is passed as a string rather than
      // a filename.

      async renderStringForModule(req, s, data, module) {
        if (typeof req !== 'object') {
          throw new Error('The first argument to module.render must be req. If you are trying to implement a Nunjucks helper function, use module.partial.');
        }
        return self.renderBody(req, 'string', s, data, module);
      },

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

      jsonForHtml(data) {
        if (data === undefined) {
          return 'null';
        }
        data = JSON.stringify(data);
        // , null, '  ');
        data = data.replace(/<!--/g, '<\\!--');
        data = data.replace(/<\/script>/gi, '<\\/script>');
        // unicode line separator and paragraph separator break JavaScript parsing
        data = data.replace(/\u2028/g, '\\u2028');
        data = data.replace(/\u2029/g, '\\u2029');
        return data;
      },

      // Implements `render` and `renderString`. See their
      // documentation. async function.

      async renderBody(req, type, s, data, module) {

        let result;

        const merged = {};

        if (data) {
          _.defaults(merged, data);
        }

        const args = {};

        args.data = merged;
        args.module = self.templateApos.modules[module.__meta.name];
        args.getOption = function(key, def) {
          const colonAt = key.indexOf(':');
          let optionModule = module;
          if (colonAt !== -1) {
            const name = key.substring(0, colonAt);
            key = key.substring(colonAt + 1);
            optionModule = self.apos.modules[name];
          }
          return optionModule.getOption(req, key, def);
        };

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

        const env = self.getEnv(req, module);

        args.apos = self.templateApos;
        args.__ = req.res.__;

        if (type === 'file') {
          let finalName = s;
          if (!finalName.match(/\.\w+$/)) {
            finalName += '.html';
          }
          result = await Promise.promisify(function (finalName, args, callback) {
            return env.getTemplate(finalName).render(args, callback);
          })(finalName, args);
        } else if (type === 'string') {
          result = await Promise.promisify(function (s, args, callback) {
            return env.renderString(s, args, callback);
          })(s, args);
        } else {
          throw new Error('renderBody does not support the type ' + type);
        }
        return result;
      },

      // Fetch a nunjucks environment in which `include`,
      // `extends`, etc. search the views directories of the
      // specified module and its ancestors. Typically you
      // will call `self.render`, `self.renderPage` or
      // `self.partial` on your module object rather than calling
      // this directly.

      getEnv(req, module) {
        const name = module.__meta.name;

        req.envs = req.envs || {};
        // Cache for performance
        if (_.has(req.envs, name)) {
          return req.envs[name];
        }
        req.envs[name] = self.newEnv(req, name, self.getViewFolders(module));
        return req.envs[name];
      },

      getViewFolders(module) {
        const dirs = _.map(module.__meta.chain, function (entry) {
          return entry.dirname + '/views';
        });
        // Final class should win
        dirs.reverse();
        if (options.viewsFolderFallback) {
          dirs.push(options.viewsFolderFallback);
        }
        return dirs;
      },

      // Create a new nunjucks environment in which the
      // specified directories are searched for includes,
      // etc. Don't call this directly, use:
      //
      // apos.template.getEnv(module)

      newEnv(req, moduleName, dirs) {

        const loader = self.newLoader(moduleName, dirs, undefined, self);

        const env = new self.nunjucks.Environment(loader, {
          autoescape: true,
          apos: self.apos,
          req
        });

        self.addStandardFilters(env);

        _.each(self.filters, function (filter, name) {
          env.addFilter(name, filter);
        });

        if (self.options.filters) {
          _.each(self.options.filters, function (filter, name) {
            env.addFilter(name, filter);
          });
        }

        _.each(self.apos.modules, function (module, name) {
          if (module.customTags) {
            _.each(module.customTags, function (config, tagName) {
              env.addExtension(tagName, configToExtension(tagName, config));
            });
          }
        });

        function configToExtension(name, config) {
          // Legacy glue to create a Nunjucks custom tag extension from our
          // async/await-friendly, simplified format
          const extension = {};
          extension.tags = [ name ];
          extension.parse = function (parser, nodes, lexer) {
            const parse = config.parse ? config.parse : function (parser, nodes, lexer) {
              // Default parser gets comma separated arguments,
              // assumes no body

              // get the tag token
              const token = parser.nextToken();
              // parse the args and move after the block end. passing true
              // as the second arg is required if there are no parentheses
              const args = parser.parseSignature(null, true);
              parser.advanceAfterBlockEnd(token.value);
              return args;
            };
            const args = parse(parser, nodes, lexer);
            return new nodes.CallExtensionAsync(extension, 'run', args, []);
          };
          extension.run = async function (context) {
            const callback = arguments[arguments.length - 1];
            try {
              // Pass req, followed by other args that are not "context" (first)
              // or "callback" (last)
              const args = [
                context.env.opts.req,
                ...[].slice.call(arguments, 1, arguments.length - 1)
              ];
              const result = await config.run.apply(config, args);
              return callback(null, self.apos.template.safe(result));
            } catch (e) {
              return callback(e);
            }
          };
          return extension;
        }

        return env;
      },

      // Creates a Nunjucks loader object for the specified
      // list of directories, which can also call back to
      // this module to resolve cross-module includes. You
      // will not need to call this directly.

      newLoader(moduleName, dirs) {
        const NunjucksLoader = require('./lib/nunjucksLoader.js');
        return new NunjucksLoader(moduleName, dirs, undefined, self, self.options.loader);
      },

      addStandardFilters(env) {

        // Format the given date with the given momentjs
        // format string.

        env.addFilter('date', function (date, format) {
          // Nunjucks is generally highly tolerant of bad
          // or missing data. Continue this tradition by not
          // crashing if date is null. -Tom
          if (!date) {
            return '';
          }
          const s = dayjs(date).format(format);
          return s;
        });

        // Stringify the given data as a query string.

        env.addFilter('query', function (data) {
          return qs.stringify(data || {});
        });

        // Stringify the given data as JSON, with
        // additional escaping for safe inclusion
        // in a script tag.

        env.addFilter('json', function (data) {
          return self.safe(self.jsonForHtml(data));
        });

        // Builds filter URLs. See the URLs module.

        env.addFilter('build', self.apos.url.build);

        // Remove HTML tags from string, leaving only
        // the text. All lower case to match jinja2's naming.

        env.addFilter('striptags', function (data) {
          return data.replace(/(<([^>]+)>)/ig, '');
        });

        // Convert newlines to <br /> tags.
        env.addFilter('nlbr', function (data) {
          data = self.apos.util.globalReplace(data, '\n', '<br />\n');
          return data;
        });

        // Newlines to paragraphs, produces better spacing and semantics
        env.addFilter('nlp', function (data) {
          if (data === null || data === undefined) {
            // don't crash, nunjucks tolerates nulls
            return '';
          }
          const parts = data.toString().split(/\n/);
          const output = _.map(parts, function (part) {
            return '<p>' + part + '</p>\n';
          }).join('');
          return output;
        });

        // Convert the camelCasedString s to a hyphenated-string,
        // for use as a CSS class or similar.
        env.addFilter('css', function (s) {
          return self.apos.util.cssName(s);
        });

        env.addFilter('clonePermanent', function (o, keepScalars) {
          return self.apos.util.clonePermanent(o, keepScalars);
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

        env.addFilter('jsonAttribute', function (data, options) {
          if (typeof data === 'object') {
            return self.safe(self.apos.util.escapeHtml(JSON.stringify(data), options));
          } else {
            // Make it a string for sure
            data += '';
            return self.safe(self.apos.util.escapeHtml(data, options));
          }
        });

        env.addFilter('merge', function (data) {
          const output = {};
          let i;
          for (i = 0; i < arguments.length; i++) {
            _.assign(output, arguments[i]);
          }
          return output;
        });

      },

      // Typically you will call the `sendPage` method of
      // your own module, provided by the `@apostrophecms/module`
      // base class, which is a wrapper for this method.
      //
      // Send a complete HTML page for to the
      // browser.
      //
      // `template` is a nunjucks template name, relative
      // to the provided module's views/ folder.
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
      //
      // async function.

      async renderPageForModule(req, template, data, module) {

        let content;
        let scene = req.user ? 'apos' : 'public';
        if (req.scene) {
          scene = req.scene;
        } else {
          req.scene = scene;
        }

        const aposBodyData = {
          modules: {},
          prefix: self.apos.prefix,
          csrfCookieName: self.apos.csrfCookieName,
          htmlPageId: self.apos.util.generateId(),
          scene
        };
        if (req.user) {
          aposBodyData.user = {
            title: req.user.title,
            _id: req.user._id,
            username: req.user.username
          };
        }
        await self.emit('addBodyData', req, aposBodyData);
        self.addBodyDataAttribute(req, { apos: JSON.stringify(aposBodyData) });

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

        const decorate = !(req.query.apos_refresh || req.query.xhr || req.xhr || req.decorate === false);

        // data.url will be the original requested page URL, for use in building
        // relative links, adding or removing query parameters, etc. If this is a
        // refresh request, we remove that so that frontend templates don't build
        // URLs that also refresh

        let dataUrl = req.url;

        const parsed = new URL(req.absoluteUrl);
        if (parsed.query && parsed.searchParams.get('apos_refresh')) {
          parsed.searchParams.remove('apos_refresh');
          dataUrl = parsed.toString();
        }

        const args = {
          outerLayout: decorate ? '@apostrophecms/template:outerLayout.html' : '@apostrophecms/template:refreshLayout.html',
          permissions: req.user && (req.user._permissions || {}),
          when: scene,
          refreshing: req.query && !!req.query.apos_refresh,
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
          content = await module.render(req, template, args);
        } catch (e) {
          // The page template
          // threw an exception. Log where it
          // occurred for easier debugging
          return error(e, 'template');
        }

        return content;

        function error(e, type) {
          let now = Date.now();
          now = dayjs(now).format('YYYY-MM-DDTHH:mm:ssZZ');
          self.apos.util.error(':: ' + now + ': ' + type + ' error at ' + req.url);
          self.apos.util.error('Current user: ' + (req.user ? req.user.username : 'none'));
          self.apos.util.error(e);
          req.statusCode = 500;
          return self.render(req, 'templateError');
        }
      },

      // Add a body class or classes to be emitted when the page is rendered. This information
      // is attached to `req.data`, where the string `req.data.aposBodyClasses` is built up.
      // The default `outerLayoutBase.html` template outputs that string.
      // The string passed may contain space-separated class names.

      addBodyClass(req, bodyClass) {
        req.data.aposBodyClasses = (req.data.aposBodyClasses ? req.data.aposBodyClasses + ' ' : '') + bodyClass;
      },

      // Add a body attribute to be emitted when the page is rendered. This information
      // is attached to `req.data`, where `req.data.aposBodyDataAttributes` is built up
      // using `name` as the attribute name which is automatically prepended with "data-"
      // and the optional `value` argument.
      //
      // Alternatively the second argument may be an object, in which case each property
      // becomes a data attribute, with the `data-` prefix.
      //
      // The default `outerLayoutBase.html` template outputs the data attributes on the `body`
      // tag.

      addBodyDataAttribute(req, name, value) {
        let values = {};
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
          // Single quotes are used to avoid unreadably massive data attributes as
          // double quotes are so common when the value is JSON
          req.data.aposBodyDataAttributes = (req.data.aposBodyDataAttributes ? req.data.aposBodyDataAttributes + ' ' : ' ') + ('data-' + (!_.isUndefined(value) && value.toString().length > 0 ? self.apos.util.escapeHtml(key) + (`='${self.apos.util.escapeHtml(value, { single: true })}'`) : self.apos.util.escapeHtml(key)));
        });
      },

      // Use this method to provide an async component name that will be invoked at the point
      // in the page layout identified by the string `location`. Standard locations
      // are `head`, `body`, `main` and `contextMenu`.
      //
      //  The page layout, template or outerLayout must contain a corresponding
      // `{% component '@apostrophecms/template:inject', 'location', 'prepend' %}` call, with the same location,
      // to actually insert the content.
      //
      // The output of components added with `prepend` is prepended just after the
      // opening tag of an element, such as `<head>`. Use `append` to insert material
      // before the closing tag.
      //
      // This method is most often used when writing a module that adds new UI
      // to Apostrophe and allows you to add that markup without forcing
      // developers to customize their layout for your module to work.

      prepend(location, componentName) {
        if (typeof componentName !== 'string') {
          throw new Error('Do not pass a function to apos.template.prepend. Pass a fully qualified component name, i.e. module-name:async-component-name');
        }
        return self.insert('prepend', location, componentName);
      },

      // Use this method to provide an async component name that will be invoked at the point
      // in the page layout identified by the string `location`. Standard locations
      // are `head`, `body`, `main` and `contextMenu`.
      //
      //  The page layout, template or outerLayout must contain a corresponding
      // `apos.template.prepended('location')` call, with the same location, to
      // actually insert the content.
      //
      // The output of components added with `append` is appended just before the
      // closing tag of an element, such as `</head>`. Use `prepend` to insert material
      // after the opening tag.
      //
      // This method is most often used when writing a module that adds new UI
      // to Apostrophe and allows you to add that markup without forcing
      // developers to customize their layout for your module to work.

      append(location, componentName) {
        if (typeof componentName !== 'string') {
          throw new Error('Do not pass a function to apos.template.prepend. Pass a fully qualified component name, i.e. module-name:async-component-name');
        }
        return self.insert('append', location, componentName);
      },

      // Implementation detail of `apos.template.prepend` and `apos.template.append`.

      insert(end, location, componentName) {
        const key = end + '-' + location;
        self.insertions[key] = self.insertions[key] || [];
        self.insertions[key].push(componentName);
      }

    };
  }
};
