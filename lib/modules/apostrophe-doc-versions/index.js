var async = require('async');
var _ = require('lodash');

module.exports = {

  enabled: true,

  alias: 'versions',

  afterConstruct: function(self, callback) {
    if (!self.options.enabled) {
      return setImmediate(callback);
    }

    return async.series([
      self.enableCollection,
      self.ensureIndexes
    ], callback);
  },

  construct: function(self, options) {
    if (!self.options.enabled) {
      return;
    }

    self.enableCollection = function(callback) {
      return self.apos.db.collection('aposDocVersions', function(err, collection) {
        self.db = collection;
        return callback(err);
      });
    };

    self.ensureIndexes = function(callback) {
      return self.db.ensureIndex({ docId: 1, createdAt: -1 }, callback);
    };

    self.docAfterSave = function(req, doc, callback) {

      var pruned = self.apos.utils.clonePermanent(doc);
      var version = {
        _id: self.apos.utils.generateId(),
        docId: pruned._id,
        authorId: req.user && req.user._id,
        author: req.user && req.user.title,
        createdAt: new Date()
      };

      // Let all modules participate in pruning data before
      // it is stored as a version

      var unversionedFields = [];

      return async.series({
        unversionedFields: function(callback) {
          return self.apos.callAll('docUnversionedFields', req, doc, unversionedFields, function(err) {
            if (err) {
              return callback(err);
            }
            pruned = _.omit(pruned, unversionedFields);
            return callback(null);
          });
        },
        insert: function(callback) {
          version.doc = pruned;
          return self.db.insert(version, callback);
        },
        pruneOldVersions: function(callback) {
          return self.pruneOldVersions(doc, callback);
        }
      }, callback);

    };

    // Prune old versions so that the database is not choked
    // with them. If a version's time difference relative to
    // the previous version is less than 1/24th the time
    // difference from the newest version, that version can be
    // removed. Thus versions become more sparse as we move back
    // through time. However if two consecutive versions have
    // different authors we never discard them because
    // we don't want to create a false audit trail. -Tom

    self.pruneOldVersions = function(doc, callback) {

      var now = Date.now();

      var last = null;
      var cursor = self.db.find({ createdAt: { $lt: now }, docId: doc._id }, { createdAt: 1, _id: 1, author: 1 }).sort({ createdAt: -1 });
      return cursor.nextObject(iterator);

      function iterator(err, version) {
        if (err) {
          console.error('An error occurred while pruning versions.');
          console.error(err);
          return callback(err);
        }
        if (version === null) {
          // We're done
          return callback(err);
        }
        var age = now.getTime() - version.createdAt.getTime();
        var difference;
        var remove = false;
        if (last) {
          if (last.author === version.author) {
            difference = last.createdAt.getTime() - version.createdAt.getTime();
            if (difference < (age / 24)) {
              remove = true;
            }
          }
        }
        if (!remove) {
          last = version;
          return cursor.nextObject(iterator);
        }
        return self.db.remove({ _id: version._id }, function(err) {
          if (err) {
            console.error('An error occurred while pruning versions (remove)');
            console.error(err);
          }
          return cursor.nextObject(iterator);
        });
      }
    };

    // Revert the specified doc to the specified version.

    self.revert = function(req, doc, version, callback) {
      var unversionedFields = [];
      return self.apos.callAll('docUnversionedFields', req, doc, unversionedFields, function(err) {
        if (err) {
          return callback(err);
        }
        var newDoc = _.pick(doc, unversionedFields);
        _.assign(newDoc, version.doc);
        return self.apos.pages.update(req, newDoc, callback);
      });
    };

  }
};
