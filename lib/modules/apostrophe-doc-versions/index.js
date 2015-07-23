module.exports = {

  enabled: true,

  alias: 'versions',

  afterConstruct: function(self, callback) {
    if (!self.enabled) {
      return setImmediate(callback);
    }

    return async.series([
      self.enableCollection,
      self.enableIndexes
    ], callback);
  },

  construct: function(self, options) {
    if (!self.enabled) {
      return;
    }

    self.enableCollection = function(callback) {
      self.apos.db.collection('aposDocVersions', function(err, collection) {
        self.db = collection;
        return callback(err);
      });
    };

    self.ensureIndexes = function(callback) {
      return self.db.ensureIndex({ docId: 1, createdAt: -1 }, callback);
    };

    self.docAfterSave = function(req, doc, callback) {

      var pruned = self.apos.utils.clonePermanent(doc);
      pruned.docId = pruned._id;
      pruned._id = self.apos.utils.generateId();
      pruned.authorId = req.user && req.user._id;
      // because people go away but versions don't
      pruned.author = req.user && req.user.title;
      pruned.createdAt = new Date();

      // Let all modules participate in pruning data before
      // it is stored as a version

      return async.series({
        callAll: function(callback) {
          return self.apos.callAll('docVersionPrune', req, pruned, callback);
        },
        insert: function(callback) {
          return self.db.insert(pruned, callback);
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

  }
};
