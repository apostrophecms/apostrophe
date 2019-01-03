var async = require('async');
var _ = require('@sailshq/lodash');
var jsDiff = require('diff');

module.exports = function(self, options) {
  self.enableCollection = function(callback) {
    return self.apos.db.collection('aposDocVersions', function(err, collection) {
      self.db = collection;
      return callback(err);
    });
  };

  self.ensureIndexes = function(callback) {
    return self.db.ensureIndex({ docId: 1, createdAt: -1 }, callback);
  };

  self.docAfterSave = function(req, doc, options, callback) {

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
        return self.callAllAndEmit('docUnversionedFields', 'unversionedFields', req, doc, unversionedFields, function(err) {
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

    var now = new Date();

    var last = null;
    var cursor = self.db.findWithProjection({ createdAt: { $lt: now }, docId: doc._id }, { createdAt: 1, _id: 1, author: 1 }).sort({ createdAt: -1 });
    return cursor.nextObject(iterator);

    function iterator(err, version) {
      if (err) {
        self.apos.utils.error('An error occurred while pruning versions.');
        self.apos.utils.error(err);
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
          self.apos.utils.error('An error occurred while pruning versions (remove)');
          self.apos.utils.error(err);
        }
        return cursor.nextObject(iterator);
      });
    }
  };

  // Revert to the specified version. The doc need not be passed
  // because it is already in version._doc.

  self.revert = function(req, version, callback) {
    var unversionedFields = [];
    var doc = version._doc;
    return async.series({
      unversionedFields: function(callback) {
        return self.callAllAndEmit('docUnversionedFields', 'unversionedFields', req, version._doc, unversionedFields, callback);
      }
    }, function(err) {
      if (err) {
        return callback(err);
      }
      var newDoc = _.pick(doc, unversionedFields);
      _.assign(newDoc, _.omit(version.doc, unversionedFields));
      return self.apos.docs.update(req, newDoc, callback);
    });
  };

  // Searches for versions.
  //
  // The callback is invoked like this:
  //
  // callback(null, versions)
  //
  // The most recent version is first in the array.
  //
  // options.skip and options.limit may be used to paginate.
  // If options.compare is set, then for each version ._changes
  // will be set to an array of changes since the preceding version
  // in the result set.
  //
  // Permissions for the document associated with the returned
  // versions are checked. Any attempt to retrieve multiple versions
  // from different documents will result in an error.
  //
  // The ._doc property of each version is set to the document.

  self.find = function(req, criteria, options, callback) {
    var cursor = self.db.findWithProjection(criteria);
    cursor.sort({ createdAt: -1 });
    if (options.limit) {
      cursor.limit(options.limit);
    }
    if (options.skip) {
      cursor.skip(options.skip);
    }
    var versions;
    return async.series({
      fetch: function(callback) {
        return cursor.toArray(function(err, _versions) {
          var i;
          if (err) {
            return callback(err);
          }
          versions = _versions;
          if (versions.length) {
            var docId = versions[0].docId;
            for (i = 1; (i < versions.length); i++) {
              if (versions[i].docId !== docId) {
                // For security; could otherwise be used to sniff
                // docs you have no business looking at
                return callback('mixed documents not allowed in same versions find query');
              }
            }
          }
          return callback(null);
        });
      },
      permissions: function(callback) {
        // We already checked that they all have the same document
        if (!versions.length) {
          return setImmediate(callback);
        }
        var docId = versions[0].docId;
        return self.apos.docs.find(req, { _id: docId }).published(null).permission('edit').toObject(function(err, doc) {
          if (err) {
            return callback(err);
          }
          if (!doc) {
            // Probably due to permissions, but don't reveal info
            // to the browser
            return callback('notfound');
          }
          _.each(versions, function(version) {
            version._doc = doc;
          });
          return callback(null);
        });
      },
      compare: function(callback) {
        if (!options.changes) {
          return setImmediate(callback);
        }

        var i = versions.length - 2;

        // async descending for loop
        compare(i);

        function compare(i) {
          if (i < 0) {
            // Oldest version has no changes from a previous version
            if (versions.length) {
              versions[versions.length - 1]._changes = [];
            }
            return callback(null);
          }
          var doc = versions[i]._doc;
          return self.compare(req, doc, versions[i + 1], versions[i], function(err, changes) {
            if (err) {
              return callback(err);
            }
            versions[i]._changes = changes;
            return compare(i - 1);
          });
        }
      }
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return callback(null, versions);
    });
  };

  // Compares two versions and returns a description of
  // the differences between them. The description is an
  // array of objects, which may contain nested `changes`
  // arrays when changed properties are areas or
  // schema arrays. version2 is assumed to be the
  // newer version. The doc is examined to determine what
  // schema to use.

  self.compare = function(req, doc, version1, version2, callback) {
    var manager = self.apos.docs.getManager(doc.type);
    if (!manager) {
      // Document type is no longer valid, can't interpret schema
      return callback(null, []);
    }
    var schema = manager.schema;

    var changes = compareObjects(schema, version1.doc, version2.doc);
    var flatChanges = flatten(changes);

    // Some changes are best displayed by first fetching the docs they
    // refer to in order to get their title or another representation

    var joined = _.filter(flatChanges, function(change) {
      return change.docType;
    });

    var docTypes = _.uniq(_.pluck(joined, 'docType'));

    return async.eachSeries(docTypes, function(docType, callback) {

      var ids = _.map(_.filter(joined, { docType: docType }), function(change) {
        return change.current || change.old;
      });

      var changesById = {};
      _.each(joined, function(change) {
        changesById[change.current || change.old] = change;
      });

      var manager = self.apos.docs.getManager(docType);
      if (!manager) {
        return callback(null);
      }
      return manager.find(req, { _id: { $in: ids } }).published(null).toArray(function(err, docs) {
        if (err) {
          return callback(err);
        }
        _.each(docs, function(doc) {
          manager.decorateChange(doc, changesById[doc._id]);
        });
        return callback(null);
      });

    }, function(err) {

      if (err) {
        return callback(err);
      }
      return callback(null, changes);

    });

    function flatten(changes) {
      var flat = [];
      _.each(changes, function(change) {
        flat.push(change);
        if (change.changes) {
          flat = flat.concat(flatten(change.changes));
        }
      });
      return flat;
    }

    // Invoked recursively as needed
    function compareObjects(schema, version1, version2) {

      var changes = [];

      _.each(version1, function(val, key) {
        var change;
        var field = getField(schema, key, val);
        if (!field) {
          // Current schema can't describe this field
          return;
        }
        if (!_.has(version2, key)) {
          change = { action: 'remove', key: key, field: field, old: version1[key] };
        } else if (!_.isEqual(version2[key], version1[key])) {
          change = { action: 'change', key: key, field: field, old: version1[key], current: version2[key] };
        }
        if (change) {
          change.changes = compareField(field, change.old, change.current);
          changes.push(change);
        }
      });

      _.each(version2, function(val, key) {
        var change;
        var field = getField(schema, key, val);
        if (!field) {
          // Current schema can't describe this field
          return;
        }
        if (!_.has(version1, key)) {
          change = { action: 'add', key: key, field: field, current: val };
          change.changes = compareField(field, change.old, change.current);
          changes.push(change);
        }
      });

      return changes;

      function compareField(field, old, current) {

        if (current && (!old)) {
          old = synth(field.type, current);
        } else if (old && (!current)) {
          current = synth(field.type, old);
        }

        if (field.type === 'array') {

          return compareArrays(schemaIdentifier, schemaDecoratorGenerator(field.schema), old, current);

        } else if ((field.type === 'area') || (field.type === 'singleton')) {

          return compareAreas(old, current);

        } else if (field.type === 'joinByArray') {

          return compareArrays(joinByArrayIdentifier, joinByArrayDecoratorGenerator(field.withType), old, current);

        } else if (field.type === 'joinByOne') {

          return compareArrays(joinByArrayIdentifier, joinByArrayDecoratorGenerator(field.withType), old ? [ old ] : [], current ? [ current ] : []);

        } else {

          // Take advantage of Apostrophe's support for boiling fields
          // down to search text to generate a basis for a text diff.
          // If a special "diffable" function is available use it;
          // that allows us to compare things that don't make
          // good search text but are human readable, like URLs. -Tom

          var oldLines = [];
          var oldText = '';
          var currentLines = [];
          var currentText = '';
          var fieldType = self.apos.schemas.getFieldType(field.type);
          var diffable = fieldType.diffable;
          if (diffable) {
            oldText = diffable(old);
            currentText = diffable(current);
          } else {
            var indexer = fieldType.index;
            if (indexer) {
              indexer(old, field, oldLines);
              indexer(current, field, currentLines);
              oldText = _.filter(_.pluck(oldLines, 'text'), function(line) {
                return line !== undefined;
              }).join("\n");
              currentText = _.filter(_.pluck(currentLines, 'text'), function(line) {
                return line !== undefined;
              }).join("\n");
            }
          }

          var diff = [];
          if (oldText !== undefined && currentText !== undefined) {
            diff = jsDiff.diffSentences(oldText, currentText, { ignoreWhitespace: true });
          }

          var changes = _.map(_.filter(diff, function(diffChange) {
            return diffChange.added || diffChange.removed;
          }), function(diffChange) {
            // Convert a jsDiff change object to an
            // apos versions change object
            if (diffChange.removed) {
              return {
                action: 'remove',
                text: diffChange.value,
                field: {
                  type: 'string',
                  label: 'Content'
                }
              };
            } else {
              return {
                action: 'add',
                text: diffChange.value,
                field: {
                  type: 'string',
                  label: 'Content'
                }
              };
            }
          });
          return changes;
        }

        // If "old" or "current" doesn't exist, make sure
        // we compare the other one to a reasonable value.
        // This is currently only an issue for areas, arrays and objects.
        // TODO: should probably be something we ask schemas to
        // generate for us so it's extensible. -Tom

        function synth(type, existing) {
          var value;
          if (existing && (existing.type === 'area')) {
            value = { type: 'area', items: [] };
          } else if (Array.isArray(existing)) {
            value = [];
          } else if (typeof (existing) === 'object') {
            value = {};
          }
          return value;
        }

      }
    }

    function compareAreas(version1, version2) {
      version1 = version1 || { items: [], type: 'area' };
      version2 = version2 || { items: [], type: 'area' };
      var changes = [];
      var importantChanges = 0;
      _.each(version1.items, function(widget1) {
        var manager = self.apos.areas.getWidgetManager(widget1.type);
        if (!manager) {
          // No warning message here because it may have been removed deliberately
          // from a later version of the site
          return;
        }
        var newVersion = _.find(version2.items, { _id: widget1._id });
        if (!newVersion) {
          changes.push({
            action: 'remove',
            old: widget1,
            manager: manager,
            changes: compareWidgets(manager, widget1, { type: widget1.type })
          });
          importantChanges++;
          return;
        }
        if (!_.isEqual(newVersion, widget1)) {
          var change = {
            action: 'change',
            old: widget1,
            current: newVersion,
            manager: manager,
            changes: compareWidgets(manager, widget1, newVersion)
          };
          importantChanges++;
          changes.push(change);
        }
      });
      _.each(version2.items, function(widget2) {
        var manager = self.apos.areas.getWidgetManager(widget2.type);
        if (!manager) {
          // No warning message here because it may have been removed deliberately
          // from a later version of the site
          return;
        }
        var oldVersion = _.find(version1.items, { _id: widget2._id });
        if (!oldVersion) {
          changes.push({
            action: 'add',
            current: widget2,
            manager: manager,
            changes: compareWidgets(manager, { type: widget2.type }, widget2)
          });
          importantChanges++;
        }
      });
      // If there are no "important changes" (add, remove, change)
      // but the areas are still different, look to see if a
      // widget changed position. The first one that changed position
      // is worth reporting as "moved"
      if ((version1.items && version2.items && version1.items.length === version2.items.length) && (!importantChanges)) {
        var ranksById = {};
        var i;
        var oldRank;
        var currentRank;
        for (i = 0; (i < version1.items.length); i++) {
          var item = version1.items[i];
          ranksById[item._id] = i;
        }
        var moved = _.find(version2.items, function(widget2, i) {
          if (self.apos.areas.getWidgetManager(widget2.type) && (ranksById[widget2._id] !== i)) {
            oldRank = ranksById[widget2._id];
            currentRank = i;
            return true;
          }
        });
        if (moved) {
          changes.push({
            action: 'move-' + ((currentRank > oldRank) ? 'down' : 'up'),
            current: moved,
            manager: self.apos.areas.getWidgetManager(moved.type)
          });
        }
      }
      return changes;
    }

    function compareWidgets(manager, old, current) {
      // A widget manager may provide its own compare method,
      // otherwise its schema is used to drive the
      // compareObjects function
      if (manager.compare) {
        return manager.compare(old, current);
      } else if (manager.schema) {
        return compareObjects(manager.schema, old, current);
      }
    }

    function compareArrays(identifier, decorator, version1, version2) {
      version1 = version1 || [];
      version2 = version2 || [];
      var changes = [];
      var importantChanges = 0;
      var change;
      _.each(version1, function(item1) {
        var newVersion = _.find(version2, function(item2) {
          return identifier(item2) === identifier(item1);
        });
        if (!newVersion) {
          change = {
            action: 'remove',
            old: item1
          };
          decorator(change);
          changes.push(change);
          importantChanges++;
          return;
        }
        if (!_.isEqual(newVersion, item1)) {
          change = {
            action: 'change',
            old: item1,
            current: newVersion
          };
          decorator(change);
          importantChanges++;
          changes.push(change);
        }
      });
      _.each(version2, function(item2) {
        var oldVersion = _.find(version1, function(item1) {
          return identifier(item1) === identifier(item2);
        });
        if (!oldVersion) {
          change = {
            action: 'add',
            current: item2
          };
          decorator(change);
          changes.push(change);
          importantChanges++;
        }
      });
      // If there are no "important changes" (add, remove, change)
      // but the arrays are still different, look to see if an
      // item changed position. The first one that changed position
      // is worth reporting as "moved"
      if ((version1.length === version2.length) && (!importantChanges)) {
        var ranksById = {};
        var i;
        for (i = 0; (i < version1.length); i++) {
          var item = version1[i];
          ranksById[identifier(item)] = i;
        }
        var oldRank;
        var currentRank;
        var moved = _.find(version2, function(item2, i) {
          if (ranksById[identifier(item2)] !== i) {
            oldRank = ranksById[identifier(item2)];
            currentRank = i;
            return true;
          }
        });
        if (moved) {
          change = {
            action: 'move-' + ((currentRank > oldRank) ? 'down' : 'up'),
            current: moved
          };
          decorator(change);
          changes.push(change);
        }
      }
      return changes;
    }

    function schemaIdentifier(item) {
      return item._id;
    }

    function schemaDecoratorGenerator(schema) {
      return function(change) {
        change.field = {
          label: 'item',
          schema: schema
        };
        if (!change.action.match(/move/)) {
          change.changes = compareObjects(schema, change.old || { type: schema.type }, change.current || { type: schema.type });
        }
      };
    }

    function joinByArrayIdentifier(item) {
      // It's an id already
      return item;
    }

    function joinByArrayDecoratorGenerator(withType) {
      return function(change) {
        change.docType = withType;
      };
    }

    function getField(schema, key, val) {
      var field = _.find(schema, { name: key });
      if (field) {
        return field;
      }
      if (val && (val.type === 'area')) {
        // Spontaneous areas don't have labels
        return {
          label: key,
          type: 'area'
        };
      }
      // Maybe it's a join, in which case we need to
      // associate that join with the ids field that stores it
      field = _.find(schema, function(field) {
        if (field.idField) {
          return field.idField === key;
        }
        if (field.idsField) {
          return field.idsField === key;
        }
      });
      return field;
    }
  };
};
