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

        var aCursor = self.pages.find(req, {
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

};
