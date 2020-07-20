// This module provides a special doc type manager for the `@apostrophecms/page` type, which
// actually refers to any page in the tree, regardless of type. This
// allows you to create [@apostrophecms/schemas](Apostrophe schema joins) that can link to
// any page in the page tree, rather than one specific page type.

const _ = require('lodash');

module.exports = {

  extend: '@apostrophecms/doc-type',

  options: {
    // Never actually found
    name: '@apostrophecms/page',
    pluralLabel: 'Pages'
  },

  methods(self, options) {
    return {
      // Returns a string to represent the given `doc` in an
      // autocomplete menu. `doc` will contain only the fields returned
      // by `getAutocompleteProjection`. `query.field` will contain
      // the schema field definition for the join the user is attempting
      // to match titles from. The default behavior is to return
      // the `title` property, but since this is a page we are including
      // the slug as well.
      getAutocompleteTitle(doc, query) {
        return doc.title + ' (' + doc.slug + ')';
      }
    };
  },

  extendMethods(self, options) {
    return {
      find(_super, req, criteria, projection) {
        return _super(req, criteria, projection).type(false).isPage(true).published(null);
      },
      // Returns a MongoDB projection object to be used when querying
      // for this type if all that is needed is a title for display
      // in an autocomplete menu. Since this is a page, we are including
      // the slug as well. `query.field` will contain the schema field definition
      // for the join we're trying to autocomplete.
      getAutocompleteProjection(_super, query) {
        const projection = _super(query);
        projection.slug = 1;
        return projection;
      }
    };
  },

  queries(self, query) {
    return {
      builders: {
        // `.isPage(true)` filters to only documents that are pages. Defaults
        // to true
        isPage: {
          def: true,
          finalize() {
            const state = query.get('isPage');
            if (state) {
              query.and({
                slug: /^\//
              });
            }
          }
        },

        // `.ancestors(true)` retrieves the ancestors of each returned page and assign sthem
        // to the `._ancestors` property. The home page is `._ancestors[0]`. The
        // page itself is not included in its own `._ancestors` array.
        //
        // If the argument is an object, do all of the above, and also call the
        // filters present in the object on the cursor that fetches the ancestors.
        // For example, you can pass `{ children: true }` to fetch the children of
        // each ancestor as the `._children` property of each ancestor, or pass
        // `{ children: { depth: 2 } }` to get really fancy.
        //
        // `ancestors` also has its own `depth` option, but it doesn't do what you think.
        // If the `depth` option is present as a top-level property of the object passed
        // to `ancestors`, then only that many ancestors are retrieved, counting backwards
        // from the immediate parent of each page.
        ancestors: {
          def: false,
          async after(results) {
            const options = query.get('ancestors');
            if (!options) {
              return;
            }
            for (const page of results) {
              const req = query.req;
              const subquery = self.apos.pages.find(req);
              subquery.ancestorPerformanceRestrictions();
              const parameters = applySubqueryOptions(subquery, options, [ 'depth' ]);
              const components = page.path.split('/');
              let paths = [];
              let path = '';
              _.each(components, function(component) {
                path += component;
                // Special case: the path of the homepage
                // is /, not an empty string
                let queryPath = path;
                if (queryPath === '') {
                  queryPath = '/';
                }
                // Don't redundantly load ourselves
                if (queryPath === page.path) {
                  return;
                }
                paths.push(queryPath);
                path += '/';
              });
              if (parameters.depth !== undefined) {
                paths = paths.slice(-parameters.depth);
              }
              if (!paths.length) {
                page._ancestors = [];
                return;
              }
              subquery.and({
                path: { $in: paths }
              });
              subquery.sort({ path: 1 });
              page._ancestors = await subquery.toArray();
            }
          }
        },

        // If `.orphan(null)` or `undefined` is called or this method
        // is never called, return docs regardless of
        // orphan status. if flag is `true`, return only
        // orphan docs. If flag is `false`, return only
        // docs that are not orphans. Orphans are pages that
        // are not returned by the default behavior of the
        // `children` filter implemented by `@apostrophecms/pages-cursor`
        // and thus are left out of standard navigation.
        orphan: {
          finalize() {
            const orphan = query.get('orphan');
            if ((orphan === undefined) || (orphan === null)) {
              return;
            }
            if (!orphan) {
              query.and({
                orphan: { $ne: true }
              });
              return;
            }
            query.and({
              orphan: true
            });
          }
        },

        // If `.children(true)` is called, return all children of a given page
        // as a `._children` array property of the page. If the argument is an
        // object, it may have a `depth` property to fetch nested children. Any
        // other properties are passed on to the query builder when making the query
        // for the children, which you may use to filter them.
        children: {
          def: false,
          async after(results) {
            const value = query.get('children');
            if ((!value) || (!results.length)) {
              return;
            }

            const subquery = self.apos.pages.find(query.req).areas(false).joins(false).orphan(false);

            const parameters = applySubqueryOptions(subquery, value, [ 'depth' ]);

            let depth = parameters.depth;
            // Careful, let them specify a depth of 0 but still have a good default
            if (depth === undefined) {
              depth = 1;
            }
            if (!depth) {
              return;
            }

            const clauses = [];

            results.forEach(page => {
              clauses.push({
                $and: [
                  {
                    path: new RegExp('^' + self.apos.utils.regExpQuote(self.apos.utils.addSlashIfNeeded(page.path))),
                    level: {
                      $gt: page.level,
                      $lte: page.level + depth
                    }
                  }
                ]
              });
            });

            subquery.and({ $or: clauses });

            subquery.sort({
              level: 1,
              rank: 1
            });

            // pagesByPath is a lookup table of all the page objects we've seen so far
            // indexed by their path. An important wrinkle: two page objects can exist
            // for the same page if we're fetching descendants of ancestors with a
            // depth of 2. For instance, if foo is the first child of the home page,
            // then /foo/bar should appear as a child of _ancestors[0]._children[0],
            // but also of _ancestors[1]. We address that by building an array of page
            // objects with the same path and adding appropriate children to
            // all of them. We don't try to get cute and reuse the same page object
            // because the other filters specified for fetching the ancestors may be
            // different from those used to fetch their children. -Tom

            const pagesByPath = {};
            _.each(results, function(page) {
              pagesByPath[page.path] = [ page ];
              page._children = [];
            });

            const descendants = await subquery.toArray();

            for (const page of descendants) {
              page._children = [];
              if (!_.has(pagesByPath, page.path)) {
                pagesByPath[page.path] = [];
              }
              pagesByPath[page.path].push(page);
              let last = page.path.lastIndexOf('/');
              let parentPath = page.path.substr(0, last);
              if (parentPath === '') {
                parentPath = '/';
              }
              if (pagesByPath[parentPath]) {
                _.each(pagesByPath[parentPath], function(parent) {
                  parent._children.push(page);
                });
              } else {
                // Parent page is an orphan, so it doesn't make sense
                // to return this page either, even though it's not an orphan
              }
            }
          }
        },
        // Use .reorganize(true) to return only pages that
        // are suitable for display in the reorganize view.
        // The only pages excluded are those with a `reorganize`
        // property explicitly set to `false`.
        reorganize: {
          def: null,
          finalize() {
            const state = query.get('reorganize');
            if (state === null) {
              // Do nothing
            } else if (state === true) {
              query.and({
                reorganize: { $ne: false }
              });
            } else if (state === false) {
              query.and({
                reorganize: false
              });
            }
          }
        }
      },
      // Apply default restrictions suitable for fetching ancestor pages to the cursor as
      // a starting point before applying the ancestor options. Called by the
      // ancestors filter here and also by pages.pageBeforeSend when it fetches just
      // the home page using the same options, in the event ancestors were not loaded,
      // such as on the home page itself. You should not need to modify or invoke this.
      methods: {
        ancestorPerformanceRestrictions() {
          query.areas(false).joins(false);
          return query;
        }
      }
    };
  }
};

function applySubqueryOptions(subquery, options, ours) {
  let parameters = {};
  if (options === true) {
    // OK, go with defaults
  } else if (typeof (options) === 'object') {
    parameters = _.pick(options, ours);
    // Pass everything that's not a parameter to
    // cursor used to get ancestors
    _.each(_.omit(options, ours), function(val, key) {
      subquery[key](val);
    });
  } else {
    // something else truthy, go with defaults
  }
  return parameters;
}
