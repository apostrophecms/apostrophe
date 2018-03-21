var _ = require('lodash');
var async = require('async');

module.exports = {

  construct: function(self, options) {

    if (!options.optimize) {
      return;
    }

    // This method does not require a callback because it performs its work in
    // the background. It is an optimization and thus does not need to be
    // completed before other actions

    self.docAfterSave = function(req, doc, options) {
      self.updateOptimizeIds(req, doc);
    };

    // Callback is optional. If not given, proceeds in background.

    self.updateOptimizeIds = function(req, doc, callback) {
      // Re-fetch the doc naturally with its joins. Use an admin req so
      // we get everything that could be relevant
      var manager = self.apos.docs.getManager(doc.type);
      return manager.find(self.apos.tasks.getReq(), { _id: doc._id }).trash(null).published(null).areas(true).joins(true).toObject().then(function(doc) {
        if (!doc) {
          return;
        }
        var optimizeIds = self.findIdsInDoc(doc);
        optimizeIds.sort();
        if (_.isEqual(doc.optimizeIds, optimizeIds)) {
          return;
        }
        return self.apos.docs.db.update({
          _id: doc._id
        }, {
          $set: {
            optimizeIds: optimizeIds
          }
        });
      }).then(function() {
        // Nothing more to do
        return callback && callback(null);
      }).catch(function(err) {
        if (!callback) {
          self.apos.utils.error(err);
        }
        return callback && callback(err);
      });
    };

    self.findIdsInDoc = function(doc) {
      var ids = findIds(doc);
      // widget _ids are not doc _ids
      return _.uniq(_.difference(ids, _.keys(doc._originalWidgets)));
      function findIds(object) {
        var result = [];
        if (object.type === 'attachment') {
          return result;
        }
        _.forOwn(object, function(val, key) {
          if ((key === '_id') || key.match(/Id$/)) {
            result.push(val);
          }
          if (key.match(/Ids$/)) {
            if (Array.isArray(val)) {
              result = result.concat(val);
            }
          }
          if (val && ((typeof val) === 'object')) {
            result = result.concat(findIds(val));
          }
        });
        return result;
      }
    };

    self.apos.tasks.add(self.__meta.name, 'reoptimize', 'Reoptimize docs for fewer total database queries.\nShould only be needed once when transitioning to versions of Apostrophe\nthat support this feature. Safe to run again however.', function(apos, argv, callback) {

      var req = self.apos.tasks.getReq();

      // All this task currently does is re-fetch docs (so we get them with all of their joins etc.)
      // and then re-save them (so they update optimizeIds).

      return self.apos.migrations.eachDoc({}, 5, function(doc, callback) {
        return async.series({
          find: function(callback) {
            return self.apos.docs.find(req, { _id: doc._id }).toObject(function(err, _doc) {
              if (err) {
                return callback(err);
              }
              doc = _doc;
              return callback(null);
            });
          },
          update: function(callback) {
            if (!doc) {
              return callback(null);
            }
            return self.updateOptimizeIds(req, doc, callback);
          }
        }, callback);
      }, callback);
    });

    self.apos.define('apostrophe-cursor', require('./lib/cursor.js'));

  }

};
