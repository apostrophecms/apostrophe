var async = require('async');
var _ = require('lodash');

module.exports = {

  extend: 'apostrophe-cursor',

  construct: function(self, options) {

    // With docs in general it doesn't make sense to show unpublished docs most
    // of the time, however with pages it makes sense to show them as long as the
    // user has permission, which is checked for separately
    self.filters.published.def = null;

    // When calling self.pages.find our expectation is that we will only get pages,
    // not docs that are not a part of the page tree
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

    self.addFilter('ancestors', {
      def: false,
      after: function(results, callback) {
        var options = self.get('ancestors');

        if (!options) {
          return setImmediate(callback);
        }

        return async.eachSeries(results, function(page, callback) {
          var req = self.get('req');

          var aCursor = self.apos.pages.find(req).areas(false);

          var parameters = applySubcursorOptions(aCursor, options, [ 'depth' ]);

          var components = page.path.split('/');
          var paths = [];
          var path = '';
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
            paths = paths.slice(- parameters.depth);
          }

          aCursor.and({
            path: { $in: paths }
          });

          aCursor.sort({ path: 1 });

          return aCursor.toArray(function(err, _ancestors) {
            if (err) {
              return callback(err);
            }
            page._ancestors = _ancestors;
            return callback(null);
          });
        }, callback);
      }
    });

    self.addFilter('children', {
      def: false,
      after: function(results, callback) {
        var value = self.get('children');
        if (!value) {
          return setImmediate(callback);
        }

        var cCursor = self.apos.pages.find(self.get('req')).areas(false);

        var parameters = applySubcursorOptions(cCursor, value, [ 'depth' ]);

        var depth = parameters.depth;
        // Careful, let them specify a depth of 0 but still have a good default
        if (depth === undefined) {
          depth = 1;
        }
        if (!depth) {
          return setImmediate(callback);
        }

        var clauses = [];

        _.each(results, function(page) {
          clauses.push({
            $and: [
              {
                path: new RegExp('^' + self.apos.utils.regExpQuote(self.apos.utils.addSlashIfNeeded(page.path))),
                level: { $gt: page.level, $lte: page.level + depth }
              }
            ]
          });
        });

        // Because mongo is incredibly stubborn in
        // that awful mysql way now
        if (clauses.length) {
          cCursor.and({ $or: clauses });
        } else {
          cCursor.and({ ___neverEverDefined: true });
        }

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

        var pagesByPath = {};
        _.each(results, function(page) {
          pagesByPath[page.path] = [ page ];
          page._children = [];
        });

        return cCursor.toArray(function(err, descendants) {
          if (err) {
            return callback(err);
          }

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
                throw new Error('internal inconsistency in children()');
              }
            });
          } catch (e) {
            return callback(e);
          }
          return callback(null);
        });
      }
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
          return;
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
  }
};

function applySubcursorOptions(aCursor, options, ours) {
  var parameters = {};
  if (options === true) {
    // OK, go with defaults
  } else if (typeof(options) === 'object') {
    parameters = _.pick(options, ours);

    // Pass everything that's not a parameter to
    // cursor used to get ancestors
    _.each(_.omit(options, ours), function(val, key) {
      aCursor[key](val);
    });
    if (options.callback) {
      options.callback(aCursor);
    }
  } else if (typeof(options) === 'function') {
    options(aCursor);
  } else {
    // something else truthy, go with defaults
  }
  return parameters;
}
