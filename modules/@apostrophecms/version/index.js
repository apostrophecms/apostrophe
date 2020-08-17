const _ = require('lodash');
const jsDiff = require('diff');
const Promise = require('bluebird');
// Provides versioning for all docs in Apostrophe. Every time a doc
// is updated, a new version of it is created in the `aposVersions` collection.
// A UI is provided for viewing past versions and rolling back to them.
//
// Versions contain only properties that are not marked as unsafe
// for rollback.
//
// For space reasons, older versions are gradually pruned to be more sparse
// (infrequent) as you go back in time, however an attempt is made to
// preserve most transitions between different individuals editing content.

module.exports = {
  options: {
    enabled: true,
    alias: 'version'
  },
  async init(self, options) {
    if (!self.options.enabled) {
      return;
    }
    if (!self.options.enabled) {
      return;
    }
    self.enableBrowserData();
    await self.enableCollection();
    await self.createIndexes();
  },
  apiRoutes(self, options) {
    return {
      post: {
        async list(req) {
          const _id = self.apos.launder.id(req.body._id);
          let doc = await self.apos.doc.find(req, { _id: _id }).published(null).permission('edit').toObject();
          if (!doc) {
            throw self.apos.error('notfound');
          }
          let versions = await self.find(req, { docId: doc._id }, {});
          for (let i = 0; i < versions.length - 1; i++) {
            // Something to diff against
            versions[i]._previous = versions[i + 1];
          }
          return {
            doc: doc,
            versions: versions
          };
        },
        async compare(req) {
          const oldId = self.apos.launder.id(req.body.oldId);
          const currentId = self.apos.launder.id(req.body.currentId);
          let current;
          let versions = await self.find(req, {
            _id: {
              $in: [
                oldId,
                currentId
              ]
            }
          }, { changes: true });
          if (versions.length !== 2) {
            throw self.apos.error('notfound');
          }
          current = versions[0];
          return { version: current };
        },
        async revert(req) {
          const versions = await self.find(req, { _id: self.apos.launder.id(req.body._id) }, {});
          if (!versions[0]) {
            throw self.apos.error('notfound');
          }
          const version = versions[0];
          return self.revert(req, version);
        }
      }
    };
  },
  handlers(self, options) {
    return {
      '@apostrophecms/doc-type:afterSave': {
        async addVersion(req, doc, options) {
          let pruned = self.apos.util.clonePermanent(doc);
          let version = {
            _id: self.apos.util.generateId(),
            docId: pruned._id,
            authorId: req.user && req.user._id,
            author: req.user && req.user.title,
            createdAt: new Date()
          };
          // Let all modules participate in pruning data before
          // it is stored as a version
          let unversionedFields = [];
          await self.emit('unversionedFields', req, doc, unversionedFields);
          pruned = _.omit(pruned, unversionedFields);
          version.doc = pruned;
          await self.db.insertOne(version);
          return self.pruneOldVersions(doc);
        }
      }
    };
  },
  methods(self, options) {
    return {
      async enableCollection() {
        self.db = await self.apos.db.collection('aposDocVersions');
      },
      createIndexes() {
        return self.db.createIndex({
          docId: 1,
          createdAt: -1
        });
      },
      // Prune old versions so that the database is not choked
      // with them. If a version's time difference relative to
      // the previous version is less than 1/24th the time
      // difference from the newest version, that version can be
      // removed. Thus versions become more sparse as we move back
      // through time. However if two consecutive versions have
      // different authors we never discard them because
      // we don't want to create a false audit trail.
      async pruneOldVersions(doc) {
        let now = new Date();
        let last = null;
        let cursor = self.db.find({
          createdAt: { $lt: now },
          docId: doc._id
        }).project({
          createdAt: 1,
          _id: 1,
          author: 1
        }).sort({ createdAt: -1 });
        const next = Promise.promisify(cursor.next, { context: cursor });
        await one();
        async function one() {
          const version = await next();
          if (version === null) {
            // We're done
            return;
          }
          let age = now.getTime() - version.createdAt.getTime();
          let difference;
          let remove = false;
          if (last) {
            if (last.author === version.author) {
              difference = last.createdAt.getTime() - version.createdAt.getTime();
              if (difference < age / 24) {
                remove = true;
              }
            }
          }
          if (!remove) {
            last = version;
          } else {
            await self.db.deleteMany({ _id: version._id });
          }
          return one();
        }
      },
      // Revert to the specified version. The doc need not be passed
      // because it is already in version._doc.
      async revert(req, version) {
        let unversionedFields = [];
        let doc = version._doc;
        await self.emit('unversionedFields', req, version._doc, unversionedFields);
        let newDoc = _.pick(doc, unversionedFields);
        _.assign(newDoc, _.omit(version.doc, unversionedFields));
        return self.apos.doc.update(req, newDoc);
      },
      // Fetches versions.
      //
      // Returns an array of versions, most recent first.
      //
      // options.skip and options.limit may be used to paginate.
      // If options.compare is set, then for each version `._changes`
      // will be set to an array of changes since the preceding version
      // in the result set.
      //
      // Permissions for the document associated with the returned
      // versions are checked. Any attempt to retrieve multiple versions
      // from different documents will result in an error.
      //
      // The `._doc` property of each version is set to the document.
      async find(req, criteria, options) {
        const cursor = self.db.find(criteria);
        cursor.sort({ createdAt: -1 });
        if (options.limit) {
          cursor.limit(options.limit);
        }
        if (options.skip) {
          cursor.skip(options.skip);
        }
        const versions = await cursor.toArray();
        if (versions.length) {
          let docId = versions[0].docId;
          for (let i = 1; i < versions.length; i++) {
            if (versions[i].docId !== docId) {
              // For security; could otherwise be used to sniff
              // docs you have no business looking at
              throw new Error('mixed documents not allowed in same versions find query');
            }
          }
        }
        // We already checked that they all have the same document
        if (versions.length) {
          const docId = versions[0].docId;
          const doc = await self.apos.doc.find(req, { _id: docId }).published(null).permission('edit').toObject();
          if (!doc) {
            throw self.apos.error('notfound');
          }
          _.each(versions, function (version) {
            version._doc = doc;
          });
        }
        if (options.changes) {
          for (let i = versions.length - 2; i >= 0; i--) {
            const doc = versions[i]._doc;
            versions[i]._changes = await self.compare(req, doc, versions[i + 1], versions[i]);
          }
          // Oldest version has no changes from a previous version
          if (versions.length) {
            versions[versions.length - 1]._changes = [];
          }
        }
        return versions;
      },
      // Compares two versions and returns a description of
      // the differences between them. The description is an
      // array of objects, which may contain nested `changes`
      // arrays when changed properties are areas or
      // schema arrays. version2 is assumed to be the
      // newer version. The doc is examined to determine what
      // schema to use.
      async compare(req, doc, version1, version2) {
        const manager = self.apos.doc.getManager(doc.type);
        if (!manager) {
          // Document type is no longer valid, can't interpret schema
          return [];
        }
        let schema = manager.schema;
        let changes = compareObjects(schema, version1.doc, version2.doc);
        let flatChanges = flatten(changes);
        // Some changes are best displayed by first fetching the docs they
        // refer to in order to get their title or another representation
        let joined = _.filter(flatChanges, function (change) {
          return change.docType;
        });
        let docTypes = _.uniq(_.map(joined, 'docType'));
        for (const docType of docTypes) {
          const ids = _.map(_.filter(joined, { docType: docType }), function (change) {
            return change.current || change.old;
          });
          const changesById = {};
          _.each(joined, function (change) {
            changesById[change.current || change.old] = change;
          });
          const manager = self.apos.doc.getManager(docType);
          if (!manager) {
            continue;
          }
          const docs = await manager.find(req, { _id: { $in: ids } }).published(null).toArray();
          _.each(docs, function (doc) {
            manager.decorateChange(doc, changesById[doc._id]);
          });
        }
        return changes;
        function flatten(changes) {
          let flat = [];
          _.each(changes, function (change) {
            flat.push(change);
            if (change.changes) {
              flat = flat.concat(flatten(change.changes));
            }
          });
          return flat;
        }
        // Invoked recursively as needed
        function compareObjects(schema, version1, version2) {
          let changes = [];
          _.each(version1, function (val, key) {
            let change;
            let field = getField(schema, key, val);
            if (!field) {
              // Current schema can't describe this field
              return;
            }
            if (!_.has(version2, key)) {
              change = {
                action: 'remove',
                key: key,
                field: field,
                old: version1[key]
              };
            } else if (!_.isEqual(version2[key], version1[key])) {
              change = {
                action: 'change',
                key: key,
                field: field,
                old: version1[key],
                current: version2[key]
              };
            }
            if (change) {
              change.changes = compareField(field, change.old, change.current);
              changes.push(change);
            }
          });
          _.each(version2, function (val, key) {
            let change;
            let field = getField(schema, key, val);
            if (!field) {
              // Current schema can't describe this field
              return;
            }
            if (!_.has(version1, key)) {
              change = {
                action: 'add',
                key: key,
                field: field,
                current: val
              };
              change.changes = compareField(field, change.old, change.current);
              changes.push(change);
            }
          });
          return changes;
          function compareField(field, old, current) {
            if (current && !old) {
              old = synth(field.type, current);
            } else if (old && !current) {
              current = synth(field.type, old);
            }
            if (field.type === 'array') {
              return compareArrays(schemaIdentifier, schemaDecoratorGenerator(field.schema), old, current);
            } else if (field.type === 'area' || field.type === 'singleton') {
              return compareAreas(old, current);
            } else if (field.type === 'join') {
              return compareArrays(joinIdentifier, joinDecoratorGenerator(field.withType), old, current);
            } else {
              // Take advantage of Apostrophe's support for boiling fields
              // down to search text to generate a basis for a text diff.
              // If a special "diffable" function is available use it;
              // that allows us to compare things that don't make
              // good search text but are human readable, like URLs. -Tom
              let oldLines = [];
              let oldText = '';
              let currentLines = [];
              let currentText = '';
              let fieldType = self.apos.schema.getFieldType(field.type);
              let diffable = fieldType.diffable;
              if (diffable) {
                oldText = diffable(old);
                currentText = diffable(current);
              } else {
                let indexer = fieldType.index;
                if (indexer) {
                  indexer(old, field, oldLines);
                  indexer(current, field, currentLines);
                  oldText = _.filter(_.map(oldLines, 'text'), function (line) {
                    return line !== undefined;
                  }).join('\n');
                  currentText = _.filter(_.map(currentLines, 'text'), function (line) {
                    return line !== undefined;
                  }).join('\n');
                }
              }
              let diff = [];
              if (oldText !== undefined && currentText !== undefined) {
                diff = jsDiff.diffSentences(oldText, currentText, { ignoreWhitespace: true });
              }
              let changes = _.map(_.filter(diff, function (diffChange) {
                return diffChange.added || diffChange.removed;
              }), function (diffChange) {
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
              let value;
              if (existing && existing.metaType === 'area') {
                value = {
                  metaType: 'area',
                  items: []
                };
              } else if (Array.isArray(existing)) {
                value = [];
              } else if (typeof existing === 'object') {
                value = {};
              }
              return value;
            }
          }
        }
        function compareAreas(version1, version2) {
          version1 = version1 || {
            items: [],
            metaType: 'area'
          };
          version2 = version2 || {
            items: [],
            metaType: 'area'
          };
          let changes = [];
          let importantChanges = 0;
          _.each(version1.items, function (widget1) {
            let manager = self.apos.area.getWidgetManager(widget1.type);
            if (!manager) {
              // No warning message here because it may have been removed deliberately
              // from a later version of the site
              return;
            }
            let newVersion = _.find(version2.items, { _id: widget1._id });
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
              let change = {
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
          _.each(version2.items, function (widget2) {
            let manager = self.apos.area.getWidgetManager(widget2.type);
            if (!manager) {
              // No warning message here because it may have been removed deliberately
              // from a later version of the site
              return;
            }
            let oldVersion = _.find(version1.items, { _id: widget2._id });
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
          if (version1.items && version2.items && version1.items.length === version2.items.length && !importantChanges) {
            let ranksById = {};
            let i;
            let oldRank;
            let currentRank;
            for (i = 0; i < version1.items.length; i++) {
              let item = version1.items[i];
              ranksById[item._id] = i;
            }
            let moved = _.find(version2.items, function (widget2, i) {
              if (self.apos.area.getWidgetManager(widget2.type) && ranksById[widget2._id] !== i) {
                oldRank = ranksById[widget2._id];
                currentRank = i;
                return true;
              }
            });
            if (moved) {
              changes.push({
                action: 'move-' + (currentRank > oldRank ? 'down' : 'up'),
                current: moved,
                manager: self.apos.area.getWidgetManager(moved.type)
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
          let changes = [];
          let importantChanges = 0;
          let change;
          _.each(version1, function (item1) {
            let newVersion = _.find(version2, function (item2) {
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
          _.each(version2, function (item2) {
            let oldVersion = _.find(version1, function (item1) {
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
          if (version1.length === version2.length && !importantChanges) {
            let ranksById = {};
            let i;
            for (i = 0; i < version1.length; i++) {
              let item = version1[i];
              ranksById[identifier(item)] = i;
            }
            let oldRank;
            let currentRank;
            let moved = _.find(version2, function (item2, i) {
              if (ranksById[identifier(item2)] !== i) {
                oldRank = ranksById[identifier(item2)];
                currentRank = i;
                return true;
              }
            });
            if (moved) {
              change = {
                action: 'move-' + (currentRank > oldRank ? 'down' : 'up'),
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
          return function (change) {
            change.field = {
              label: 'item',
              schema: schema
            };
            if (!change.action.match(/move/)) {
              change.changes = compareObjects(schema, change.old || { type: schema.type }, change.current || { type: schema.type });
            }
          };
        }
        function joinIdentifier(item) {
          // It's an id already
          return item;
        }
        function joinDecoratorGenerator(withType) {
          return function (change) {
            change.docType = withType;
          };
        }
        function getField(schema, key, val) {
          let field = _.find(schema, { name: key });
          if (field) {
            return field;
          }
          // Maybe it's a join, in which case we need to
          // associate that join with the ids field that stores it
          field = _.find(schema, function (field) {
            if (field.idField) {
              return field.idField === key;
            }
            if (field.idsField) {
              return field.idsField === key;
            }
          });
          return field;
        }
      },
      getBrowserData(req) {
        return { action: self.action };
      }
    };
  }
};
