const _ = require('lodash');

module.exports = {

  extend: 'apostrophe-cursor',

  construct: function(self, options) {

    // With docs in general it doesn't make sense to show unpublished docs most
    // of the time, however with pages it makes sense to show them as long as the
    // user has permission, which is checked for separately
    self.filters.published.def = null;

    // Filter. When calling `self.pages.find` our expectation is that we will only get pages,
    // not docs that are not a part of the page tree. This filter defaults to `true`.

    self.addFilter('isPage', {
      def: true,
      finalize: function() {
        var state = self.get('isPage');
        if (state) {
          self.and({
            slug: /^\//
          });
        }
      }
    });

    // Filter. If set to `true`, retrieve the ancestors of each page and assign them
    // to the `._ancestors` property. The home page is `._ancestors[0]`. The
    // page itself is not included in its `._ancestors` array.
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

    self.addFilter('ancestors', {
      def: false,
      after: async function(results) {
        const options = self.get('ancestors');

        if (!options) {
          return;
        }

        for (let page of results) {
          const req = self.req;

          const aCursor = self.apos.pages.find(req);

          aCursor.ancestorPerformanceRestrictions();

          const parameters = applySubcursorOptions(aCursor, options, [ 'depth' ]);

          const components = page.path.split('/');
          const paths = [];
          let path = '';
          _.each(components, function(component) {
            path += component;
            // Special case: the path of the homepage
            // is /, not an empty string
            var queryPath = path;
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

          aCursor.and({
            path: { $in: paths }
          });

          aCursor.sort({ path: 1 });

          page._ancestors = await aCursor.toArray();
        }
      }
    });

    // Filter. if flag is `null`, `undefined` or this method
    // is never called, return docs regardless of
    // orphan status. if flag is `true`, return only
    // orphan docs. If flag is `false`, return only
    // docs that are not orphans. Orphans are pages that
    // are not returned by the default behavior of the
    // `children` filter implemented by `apostrophe-pages-cursor`
    // and thus are left out of standard navigation.

    self.addFilter('orphan', {
      finalize: function() {
        const orphan = self.get('orphan');
        if ((orphan === undefined) || (orphan === null)) {
          return;
        }
        if (!orphan) {
          self.and({
            orphan: { $ne: true }
          });
          return;
        }
        self.and({
          orphan: true
        });
      }
    });

    self.addFilter('children', {
      def: false,
      after: async function(results) {
        const value = self.get('children');
        if ((!value) || (!results.length)) {
          return;
        }

        const cCursor = self.apos.pages.find(self.req).areas(false).joins(false).orphan(false);

        const parameters = applySubcursorOptions(cCursor, value, [ 'depth' ]);

        const depth = parameters.depth;
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
                level: { $gt: page.level, $lte: page.level + depth }
              }
            ]
          });
        });

        cCursor.and({ $or: clauses });

        cCursor.sort({ level: 1, rank: 1 });

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

        const descendants = cCursor.toArray();

        try {
          _.each(descendants, function(page) {
            page._children = [];
            if (!_.has(pagesByPath, page.path)) {
              pagesByPath[page.path] = [];
            }
            pagesByPath[page.path].push(page);
            var last = page.path.lastIndexOf('/');
            var parentPath = page.path.substr(0, last);
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
          });
        }
      });
    });

    // Use .reorganize(true) to return only pages that
    // are suitable for display in the reorganize view.
    // For instance, if you have thousands of subpages
    // of a "blog" page, you might want to hide them from
    // the global reorganize interface by setting their
    // reorganize property to false. —Tom and Sam

    self.addFilter('reorganize', {
      def: null,
      finalize: function() {
        var state = self.get('reorganize');
        if (state === null) {

        } else if (state === true) {
          self.and({
            reorganize: { $ne: false }
          });
        } else if (state === false) {
          self.and({
            reorganize: false
          });
        }
      }
    });

    // Apply default restrictions suitable for fetching ancestor pages to the cursor as
    // a starting point before applying the ancestor options. Called by the
    // ancestors filter here and also by pages.pageBeforeSend when it fetches just
    // the home page using the same options, in the event ancestors were not loaded,
    // such as on the home page itself. You should not need to modify or invoke this.

    self.ancestorPerformanceRestrictions = function() {
      self.areas(false).joins(false);
      return self;
    };
  }
};

function applySubcursorOptions(aCursor, options, ours) {
  let parameters = {};
  if (options === true) {
    // OK, go with defaults
  } else if (typeof (options) === 'object') {
    parameters = _.pick(options, ours);

    // Pass everything that's not a parameter to
    // cursor used to get ancestors
    _.each(_.omit(options, ours), function(val, key) {
      aCursor[key](val);
    });
  } else {
    // something else truthy, go with defaults
  }
  return parameters;
}
