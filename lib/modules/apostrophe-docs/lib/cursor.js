var _ = require('lodash');

module.exports = function(self, options) {
  var cursor = {};
  _.defaults(cursor, {
    _state: {},

    set: function(key, value) {
      cursor._state[key] = value;
      return cursor;
    },

    get: function(key) {
      return cursor._state[key];
    },

    sort: function(obj) {
      cursor.set('sort', obj);
      return cursor;
    },

    skip: function(n) {
      cursor.set('skip', n);
      return cursor;
    },

    limit: function(n) {
      cursor.set('limit', n);
      return cursor;
    },

    permission: function(permissionNameOrFalse) {
      cursor.set('permission', permissionNameOrFalse);
    },

    applyPermission: function() {
      var permission = cursor.get('permission');

      if (permission !== false) {
        cursor.set('criteria', {
          $and: [
            cursor.get('criteria'),
            self.apos.permissions.criteria(req, permission || 'view-page')
          ]
        };
      }
    },

    projection: function(p) {
      cursor.set('projection', p);
    }

    autocomplete: function(flag) {
      cursor.set('autocomplete', flag);
    },

    sort: function(expr) {
      cursor.set('sort', sort);
    },

    applySort: function(callback) {

      // adjust the sort option taking the search
      // option into account, and supplying a default
      // sort unless expressly declined

      var sort = cursor.get('sort');

      if (sort === false) {
        // OK, you really truly don't want a sort
        // (for instance, you are relying on the
        // implicit sort of $near)
      } else if (cursor.get('search')) {
        // Text search is in the picture. If they don't
        // specify a sort or specify sort: 'q' or
        // sort: 'search', sort by search result quality
        if ((!sort) || (sort === 'q') || (sort === 'search')) {
          sort = { textScore: { $meta: 'textScore' } };
        }
      } else if (!sort) {
        // A reasonable default sorting behavior
        sort = { sortTitle: 1 };
      }
      cursor.set('sort', sort);
    },

    applyAutocomplete: require('./autocomplete.js')(self, cursor),

    trash: function(flag) {
      cursor.set('trash', flag);
    },

    applyTrash: function() {
      var trash = cursor.get('trash');
      if (trash === null) {
        return;
      }
      if (!trash) {
        cursor.set('criteria', {
          $and: [
            {
              trash: { $exists: 0 }
            },
            cursor.get('criteria')
          ]
        });
        return;
      }
      cursor.set('criteria', {
        $and: [
          {
            trash: true
          },
          cursor.get('criteria')
        ]
      });
    },

    orphan: function(flag) {
      cursor.set('orphan', flag);
    },

    applyOrphan: function() {
      var orphan = cursor.get('orphan');
      if ((orphan === undefined) || (orphan === null) {
        return;
      }
      if (!trash) {
        cursor.set('criteria', {
          $and: [
            {
              trash: { $exists: 0 }
            },
            cursor.get('criteria')
          ]
        });
        return;
      }
      cursor.set('criteria', {
        $and: [
          {
            trash: true
          },
          cursor.get('criteria')
        ]
      });
    },

    published: function(flag) {
      cursor.set('published', flag);
    },

    applyPublished: function() {
      var published = cursor.get('published');
      if (orphan === null) {
        return;
      }
      if (published && (published === undefined)) {
        cursor.set('criteria', {
          $and: [
            {
              published: true
            },
            cursor.get('criteria')
          ]
        });
        return;
      }
      cursor.set('criteria', {
        $and: [
          {
            trash: { $exists: 0 }
          },
          cursor.get('criteria')
        ]
      });
    },

    toArray: function(callback) {

      var results;

      cursor.applyPermission();
      cursor.applySort();

      return async.series(
        autocomplete: function(callback) {
          return cursor.applyAutocomplete(callback);
        },
        query: function(callback) {
          var mongo = self.db.find(cursor.get('criteria') || {}, cursor.get('projection') || {});

          var mongoMethods = [ 'skip', 'limit' ];

          _.each(mongoMethods, function(method) {
            var value = cursor.get(method);
            if (value) {
              mongo[method](value);
            }
          });

          return mongo.toArray(function(err, _results) {
            results = _results;
            return callback(err);
          }
        }
      }, function(err) {
        return callback(err, results);
      });
    }
  });
  return cursor;
};

