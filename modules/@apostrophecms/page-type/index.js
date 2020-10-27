const _ = require('lodash');
// Same engine used by express to match paths
const pathToRegexp = require('path-to-regexp');

module.exports = {
  extend: '@apostrophecms/doc-type',
  fields(self, options) {
    return {
      add: {
        slug: {
          type: 'slug',
          label: 'Slug',
          required: true,
          page: true,
          following: 'title'
        },
        type: {
          type: 'select',
          label: 'Type',
          required: true,
          choices: options.apos.page.typeChoices.map(function (type) {
            return {
              value: type.name,
              label: type.label
            };
          })
        },
        orphan: {
          type: 'boolean',
          label: 'Hide in Navigation',
          def: false
        }
      },
      remove: [ 'trash' ],
      group: {
        utility: {
          fields: [
            'slug',
            'type',
            'orphan'
          ]
        }
      }
    };
  },
  init(self, options) {
    self.removeTrashPrefixFields([ 'slug' ]);
    self.addTrashSuffixFields([
      'slug'
    ]);
    self.rules = {};
    self.dispatchAll();
  },
  handlers(self, options) {
    return {
      '@apostrophecms/page:serve': {
        async dispatchPage(req) {
          if (!req.data.bestPage) {
            return;
          }
          if (req.data.bestPage.type !== self.name) {
            return;
          }
          let matched;
          if (_.isEmpty(self.rules)) {
            // If there are no dispatch rules, assume this is an "ordinary" page type and
            // just look for an exact match
            if (req.remainder !== '/') {
              req.notFound = true;
            } else {
              self.acceptResponsibility(req);
            }
            return;
          }
          _.each(self.rules, function (_rule) {
            if (self.match(req, _rule, req.remainder)) {
              matched = _rule;
              return false;
            }
          });
          if (!matched) {
            req.notFound = true;
            return;
          }
          self.acceptResponsibility(req);
          for (const fn of matched.middleware) {
            const result = await fn(req);
            if (result === false) {
              return;
            }
          }
          await matched.handler(req);
        }
      }
    };
  },
  methods(self, options) {
    return {
      dispatchAll() {
        self.dispatch('/', req => self.setTemplate(req, 'page'));
      },
      // Add an Express-style route that responds when "the rest" of the URL, beyond
      // the page slug itself, matches a pattern.
      //
      // For instance,  if the page slug is `/poets`, the URL is
      // `/poets/chaucer`, and this method has been called with
      // `('/:poet', self.poetPage)`, then the `poetPage` method will
      // be invoked with `(req)`. **The method must be an async
      // function, and it will be awaited.**
      //
      // **Special case:** if the page slug is simply `/poets` (with no slash) and
      // there is a dispatch route with the pattern `/`, that route will be invoked.
      //
      // Dispatch routes can also have async middleware. Pass middleware functions as
      // arguments in between the pattern and the handler. Dispatch middleware
      // functions are async functions which receive `(req)` as an argument. If
      // a middleware function explicitly returns `false`, no more middleware is run
      // and the handler is not run. Otherwise the chain of middleware continues
      // and, at the end, the handler is invoked.
      dispatch(pattern) {
        const keys = [];
        const regexp = pathToRegexp(pattern, keys);
        self.rules[pattern] = {
          pattern: pattern,
          middleware: Array.prototype.slice.call(arguments, 1, arguments.length - 1),
          handler: arguments[arguments.length - 1],
          regexp: regexp,
          keys: keys
        };
      },
      // Match a URL according to the provided rule as registered
      // via the dispatch method. If there is a match, `req.params` is
      // set exactly as it would be by Express and `true` is returned.
      match(req, rule, url) {
        const matches = rule.regexp.exec(url);
        if (!matches) {
          return false;
        }
        req.params = {};
        for (let i = 0; i < rule.keys.length; i++) {
          req.params[rule.keys[i].name] = matches[i + 1];
        }
        return true;
      },
      // Called by `pageServe`. Accepts responsibility for
      // the current URL by assigning `req.data.bestPage` to
      // `req.page` and implementing the `scene` option, if set
      // for this module.
      acceptResponsibility(req) {
        // We have a match, so consider bestPage to be the
        // current page for template purposes
        req.data.page = req.data.bestPage;
        if (self.options.scene) {
          req.scene = self.options.scene;
        }
      },
      // Returns a string to represent the given `doc` in an
      // autocomplete menu. `doc` will contain only the fields returned
      // by `getAutocompleteProjection`. `query.field` will contain
      // the schema field definition for the relationship the user is attempting
      // to match titles from. The default behavior is to return
      // the `title` property, but since this is a page we are including
      // the slug as well.
      getAutocompleteTitle(doc, query) {
        return doc.title + ' (' + doc.slug + ')';
      },
      // `req` determines what the user is eligible to edit, `criteria`
      // is the MongoDB criteria object, and any properties of `options`
      // are invoked as methods on the query with their values.
      find(req, criteria = {}, options = {}) {
        return self.apos.modules['@apostrophecms/any-page-type'].find(req, criteria, options).type(self.name);
      }
    };
  },
  extendMethods(self, options) {
    return {
      getAutocompleteProjection(_super, query) {
        const projection = _super(query);
        projection.slug = 1;
        return projection;
      },
      // Extend `composeSchema` to flag the use of field names
      // that are forbidden or nonfunctional in page types,
      // i.e. path, rank, level
      composeSchema(_super) {
        _super();
        const forbiddenFields = [
          'path',
          'rank',
          'level'
        ];
        _.each(self.schema, function (field) {
          if (_.includes(forbiddenFields, field.name)) {
            throw new Error('Page type ' + self.name + ': the field name ' + field.name + ' is forbidden');
          }
        });
      }
    };
  }
};
