var _ = require('lodash');
var Promise = require('bluebird');
var sift = require('sift');
var async = require('async');

var statsTimeout;

module.exports = {
  construct: function(self, options) {
    var optimizer = self.apos.modules['apostrophe-optimizer'];
    if (!optimizer.stats) {
      optimizer.stats = {
        direct: 0,
        optimized: 0
      };
    }

    if (!statsTimeout) {
      statsTimeout = setTimeout(function() {
        console.log(optimizer.stats);
        statsTimeout = false;
      }, 2000);
    }

    // We have to use the super pattern here to prefetch the optimized docs
    // before all the other filters, like join and areas, jump in and
    // try to get them
    var superAfter = self.after;
    self.after = function(results, callback) {
      if (callback) {
        return body(callback);
      } else {
        return Promise.promisify(body)(results);
      }
      function body(callback) {
        return self.optimize(results, function(err) {
          if (err) {
            return callback(err);
          }
          return superAfter(results, callback);
        });
      }
    };

    self.optimize = function(results, callback) {
      var req = self.get('req');
      return Promise.try(function() {
        var ids = [];
        _.each(results, function(doc) {
          ids = ids.concat(doc.optimizeIds || []);
        });
        if (!ids.length) {
          return [];
        }
        ids = _.uniq(ids);
        ids = _.difference(ids, _.keys(req.optimizeDocs));
        if (!ids.length) {
          return [];
        }
        return self.apos.docs.db.find({ _id: { $in: ids } }).toArray();
      }).then(function(docs) {
        req.optimizeDocs = req.optimizeDocs || {};
        _.each(docs, function(doc) {
          req.optimizeDocs[doc._id] = doc;
        });
        // console.log('**** now our ids are:', JSON.stringify(_.keys(req.optimizeDocs), null, '  '));
        return callback(null);
      }).catch(function(err) {
        return callback(err);
      });
    };

    var superLowLevelMongoCursor = self.lowLevelMongoCursor;
    self.lowLevelMongoCursor = function(req, criteria, projection, options) {
      var docs;
      if (!self.optimizeCompatible(req, criteria, projection, options)) {
        self.apos.utils.debug('apostrophe-optimizer cannot handle query due to constraints beyond optimized ids for this req, kicking it over to MongoDB: ', require('util').inspect(criteria, { depth: 20 }), JSON.stringify(_.keys(req.optimizeDocs), null, '  '));
        optimizer.stats.direct++;
        return superLowLevelMongoCursor(req, criteria, projection, options);
      }
      try {
        docs = self.optimizeFilterDocs(req, criteria, projection, options);
      } catch (e) {
        self.apos.utils.debug('apostrophe-optimizer cannot handle query due to sift limitation, kicking it over to MongoDB: ', require('util').inspect(criteria, { depth: 20 }));
        optimizer.stats.direct++;
        return superLowLevelMongoCursor(req, criteria, projection, options);
      }
      // return a fake MongoDB cursor. TODO: a more complete emulation, but this is what
      // Apostrophe currently relies upon
      optimizer.stats.optimized++;
      return {
        toObject: function(callback) {
          if (!callback) {
            return Promise.promisify(body);
          }
          return body(callback);
          function body(callback) {
            return callback(null, docs[0]);
          }
        },
        toArray: function(callback) {
          if (!callback) {
            return Promise.promisify(body);
          }
          return body(callback);
          function body(callback) {
            return callback(null, docs);
          }
        },
        toCount: function(callback) {
          if (!callback) {
            return Promise.promisify(body);
          }
          return body(callback);
          function body(callback) {
            return callback(null, docs.length);
          }
        }
      };
    };

    // Reject anything with _id's not found in the keys of req.optimizeDocs.
    // Also reject projections that use metafields we can't replicate
    // (we can't do text search without real mongo). We do not have to worry
    // about unsupported mongo operators in `sift` because sift will throw
    // an exception, which we catch in `optimizeFilterDocs`.

    self.optimizeCompatible = function(req, criteria, projection, options) {
      var ids = _.keys(req.optimizeDocs || {});
      var other;
      return criteriaSafe(criteria) && projectionSafe();
      function criteriaSafe(criteria) {
        if (criteria.$and) {
          other = _.omit(criteria, '$and');
          if (!_.isEmpty(other)) {
            return criteriaSafe({ $and: [ other ].concat(criteria.$and) });
          }
          // $and: at least one subclause must be safe, because it constrains all the others
          return _.some(criteria.$and, criteriaSafe);
        } else if (criteria.$or) {
          other = _.omit(criteria, '$or');
          if (!_.isEmpty(other)) {
            return criteriaSafe({ $and: [ other ].concat([ { $or: criteria.$or } ]) });
          }
          // $or: every subclause must be safe (here written "there must be no subclause
          // which is not safe")
          return !_.some(criteria.$or, function(criteria) {
            return !criteriaSafe(criteria);
          });
        } else {
          return simpleCriteriaSafe(criteria);
        }
      }

      function projectionSafe() {
        // console.log(projection);
        var result = !_.some(_.keys(projection), function(key) {
          // All projection values must be simple flags, objects imply something
          // fancy like $meta is going on
          return projection[key] && ((typeof projection[key]) === 'object');
        });
        // console.log(result);
        return result;
      }

      // A simple criteria object without $and or $or may be said to be safe
      // if it has an `_id` property and that property permits only ids
      // already fetched by the optimizer

      function simpleCriteriaSafe(criteria) {
        if (criteria._id) {
          if (_.includes(ids, criteria._id)) {
            return true;
          }
          if (criteria._id.$in && (!_.difference(criteria._id.$in, ids).length)) {
            return true;
          }
        }
        return false;
      }
    };

    // May throw an exception if the implementation cannot support some of
    // the criteria (sift will throw an exception on unknown operators).

    self.optimizeFilterDocs = function(req, criteria, projection, options) {
      var docs;
      docs = sift(criteria, _.values(req.optimizeDocs));
      if (_.isNumber(options.skip)) {
        docs = docs.slice(options.skip);
      }
      if (_.isNumber(options.limit)) {
        docs = docs.slice(0, options.limit);
      }
      self.optimizeSort(docs, options.sort);
      if (projection) {
        if (_.values(projection)[0]) {
          docs = _.map(docs, function(doc) {
            return _.pick(doc, _.keys(projection));
          });
        } else {
          docs = _.map(docs, function(doc) {
            return _.omit(doc, _.keys(projection));
          });
        }
      }
      return docs;
    };

    self.optimizeSort = function(docs, sort) {
      return docs.sort(function(a, b) {
        var keys = _.keys(sort);
        var i;
        for (i = 0; (i < keys.length); i++) {
          var av = a[keys[i]];
          var bv = b[keys[i]];
          if (sort[keys[i]] < 0) {
            if (av < bv) {
              return 1;
            } else if (av > bv) {
              return -1;
            }
          } else {
            if (av < bv) {
              return -1;
            } else if (av > bv) {
              return 1;
            }
          }
        }
        // equal according to all criteria
        return 0;
      });

    };

    self.apos.tasks.add(self.__meta.name, 'reoptimize', 'Reoptimize docs for fewer total database queries.\nShould only be needed once when transitioning to versions of Apostrophe\nthat support this feature. Safe to run again however.', function(apos, argv, callback) {

      var req = self.apos.tasks.getReq();

      // All this task currently does is re-fetch docs (so we get them with all of their joins etc.)
      // and then re-save them (so they update optimizeIds).

      return self.apos.migrations.eachDoc({}, 5, function(doc, callback) {
        return Promise.try(function() {
          return self.apos.docs.find(req).toObject(doc)
        }).then(function(doc) {
          if (!doc) {
            return;
          }
          return self.apos.docs.update(req, doc);
        }).then(function() {
          return callback(null);
        }).catch(function(err) {
          return callback(err);
        });
      }, callback);
    });

  }

};
