var async = require('async');
var _ = require('lodash');

module.exports = function(self, cursor) {
  cursor.addFilter('ancestors', {
    def: false,
    after: function(results, callback) {
      var options = cursor.get('ancestors');

      if (!options) {
        return setImmediate(callback);
      }

      return async.eachSeries(results, function(page, callback) {
        var req = cursor.get('req');
        var components = page.path.split('/');
        var paths = [];
        var path = '';
        _.each(components, function(component) {
          path += component;
          // Don't redundantly load ourselves
          if (path === page.path) {
            return;
          }
          paths.push(path);
          path += '/';
        });

        var aCursor = self.find(req, {
          path: { $in: paths }
        }).areas(false);

        if (options === true) {
          // OK, go with defaults
        } else if (typeof(options) === 'object') {
          _.each(options, function(val, key) {
            aCursor[key](val);
          });
        } else if (typeof(options) === 'function') {
          options(aCursor);
        } else {
          // something else truthy, go with defaults
        }

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
      var depth = value.children;
      // Careful, let them specify a depth of 0 but still have a good default
      if (depth === undefined) {
        depth = 1;
      }
      if (!depth) {
        return setImmediate(callback);
      }

      var cCursor = self.find(cursor.get('req')).areas(false);

      var clauses = [];

      _.each(results, function(page) {
        clauses.push({
          $and: [
            {
              path: new RegExp('^' + self.apos.utils.regExpQuote(page.path + '/')),
              level: { $gt: page.level, $lte: page.level + depth }
            }
          ]
        });
      });

      cCursor.and({ $or: clauses });

      console.error(require('util').inspect(cCursor.get('criteria'), { depth: 5 }));

      cCursor.sort({ level: 1, rank: 1 });

      var pagesByPath = {};
      _.each(results, function(page) {
        pagesByPath[page.path] = page;
      });

      return cCursor.toArray(function(err, descendants) {
        if (err) {
          return callback(err);
        }

        try {
          _.each(descendants, function(page) {
            page.children = [];
            pagesByPath[page.path] = page;
            var last = page.path.lastIndexOf('/');
            var parentPath = page.path.substr(0, last);
            if (pagesByPath[parentPath]) {
              pagesByPath[parentPath].children.push(page);
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

};
