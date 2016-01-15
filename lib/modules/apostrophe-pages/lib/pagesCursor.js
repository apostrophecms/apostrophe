var async = require('async');
var _ = require('lodash');

module.exports = function(self, cursor) {

  // With docs in general it doesn't make sense to show unpublished docs most
  // of the time, however with pages it makes sense to show them as long as the
  // user has permission, which is checked for separately
  cursor.filters.published.def = null;

  cursor.addFilter('ancestors', {
    def: false,
    after: function(results, callback) {
      var options = cursor.get('ancestors');

      if (!options) {
        return setImmediate(callback);
      }

      return async.eachSeries(results, function(page, callback) {
        var req = cursor.get('req');

        var aCursor = self.find(req).areas(false);

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

  cursor.addFilter('children', {
    def: false,
    after: function(results, callback) {
      var value = cursor.get('children');
      if (!value) {
        return setImmediate(callback);
      }

      var cCursor = self.find(cursor.get('req')).areas(false);

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

      var pagesByPath = {};
      _.each(results, function(page) {
        pagesByPath[page.path] = page;
        page._children = [];
      });

      return cCursor.toArray(function(err, descendants) {
        if (err) {
          return callback(err);
        }

        try {
          _.each(descendants, function(page) {
            if (!_.has(pagesByPath, page.path)) {
              page._children = [];
              pagesByPath[page.path] = page;
            }
            var last = page.path.lastIndexOf('/');
            var parentPath = page.path.substr(0, last);
            if (parentPath === '') {
              parentPath = '/';
            }
            if (pagesByPath[parentPath]) {
              pagesByPath[parentPath]._children.push(page);
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

  cursor.addFilter('reorganize', {
    def: null,
    finalize: function() {
      var state = cursor.get('reorganize');
      if (state === null) {
        return;
      } else if (state === true) {
        cursor.and({
          reorganize: { $ne: false }
        });
      } else if (state === false) {
        cursor.and({
          reorganize: false
        });
      }
    }
  });
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
