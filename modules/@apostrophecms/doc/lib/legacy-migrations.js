// Migrations relevant only to those who used early alpha and beta versions of 3.x
// are kept here for tidiness

module.exports = (self) => {
  return {
    addLegacyMigrations() {
      self.addDuplicateOrMissingWidgetIdMigration();
      self.addDraftPublishedMigration();
      self.addLastPublishedToAllDraftsMigration();
      self.addLastPublishedToAllPublishedDocsMigration();
      self.addAposModeMigration();
      self.addStoreRelationshipIdsAsAposDocIdsMigration();
    },
    addDuplicateOrMissingWidgetIdMigration() {
      self.apos.migration.add('duplicate-or-missing-widget-id', async () => {
        return self.apos.migration.eachDoc({}, 5, async (doc) => {
          const widgetIds = {};
          const patches = {};
          // Walk the areas in a doc. Your iterator function is invoked once
          // for each area found, and receives the
          // area object and the dot-notation path to that object.
          // note that areas can be deeply nested in docs via
          // array schemas.
          //
          // If the iterator explicitly returns `false`, the area
          // is *removed* from the page object, otherwise no
          // modifications are made. This happens in memory only;
          // the database is not modified.
          self.apos.area.walk(doc, (area, dotPath) => {
            if (!area.items) {
              return;
            }
            for (let i = 0; (i < area.items.length); i++) {
              const item = area.items[i];
              if (!item) {
                continue;
              }
              if ((!item._id) || widgetIds[item._id]) {
                patches[`${dotPath}.items.${i}._id`] = self.apos.util.generateId();
              }
              if (item._id) {
                widgetIds[item._id] = true;
              }
            }
          });
          if (Object.keys(patches).length) {
            return self.apos.doc.db.updateOne({
              _id: doc._id
            }, {
              $set: patches
            });
          }
        });
      });
    },
    addDraftPublishedMigration() {
      self.apos.migration.add('add-draft-published', async () => {
        const indexes = await self.apos.doc.db.indexes();
        for (const index of indexes) {
          let keys = Object.keys(index.key);
          keys.sort();
          keys = keys.join(',');
          if ((keys === 'slug') && index.unique) {
            await self.apos.doc.db.dropIndex(index.name);
          }
          if ((keys === 'path') && index.unique) {
            await self.apos.doc.db.dropIndex(index.name);
          }
        }
        // If a document should be localized but is not, localize it in
        // all locales and modes, as a migration strategy from alpha 2
        const types = Object.keys(self.managers).filter(type => {
          return self.managers[type].isLocalized();
        });
        if (!types.length) {
          return;
        }
        return self.apos.migration.eachDoc({
          aposLocale: {
            $exists: 0
          },
          type: {
            $in: types
          }
        }, 5, async (doc) => {
          const locales = self.apos.i18n.locales;
          for (const locale of locales) {
            await self.apos.doc.db.insertOne({
              ...doc,
              _id: `${doc._id}:${locale}:draft`,
              aposLocale: `${locale}:draft`,
              aposDocId: doc._id,
              lastPublishedAt: doc.updatedAt
            });
            await self.apos.doc.db.insertOne({
              ...doc,
              _id: `${doc._id}:${locale}:published`,
              aposLocale: `${locale}:published`,
              aposDocId: doc._id
            });
          }
          await self.apos.doc.db.removeOne({
            _id: doc._id
          });
        });
      });
    },
    addLastPublishedToAllDraftsMigration() {
      return self.apos.migration.add('add lastPublishedAt to all published drafts without it', async () => {
        return self.apos.migration.eachDoc({
          _id: /:draft$/,
          lastPublishedAt: null
        }, async (doc) => {
          const published = await self.db.findOne({
            _id: doc._id.replace(':draft', ':published')
          });
          if (published) {
            return self.db.updateOne({
              _id: doc._id
            }, {
              $set: {
                lastPublishedAt: published.updatedAt
              }
            });
          }
        });
      });
    },
    addLastPublishedToAllPublishedDocsMigration() {
      return self.apos.migration.add('add-last-published-to-published-docs', async () => {
        return self.apos.migration.eachDoc({
          _id: /:published$/,
          lastPublishedAt: null
        }, async (doc) => {
          const draft = await self.db.findOne({
            _id: doc._id.replace(':published', ':draft')
          });
          if (draft) {
            return self.db.updateOne({
              _id: doc._id
            }, {
              $set: {
                lastPublishedAt: draft.lastPublishedAt
              }
            });
          }
        });
      });
    },
    addAposModeMigration() {
      self.apos.migration.add('add-apos-mode', async () => {
        return self.apos.migration.eachDoc({
          aposLocale: { $exists: 1 },
          aposMode: { $exists: 0 }
        }, 5, async (doc) => {
          // eslint-disable-next-line no-unused-vars
          const [ locale, mode ] = doc.aposLocale.split(':');
          return self.db.updateOne({
            _id: doc._id
          }, {
            $set: {
              aposMode: mode
            }
          });
        });
      });
    },
    addStoreRelationshipIdsAsAposDocIdsMigration() {
      self.apos.migration.add('store-relationship-ids-as-apos-doc-ids', async () => {
        return self.apos.migration.eachDoc({}, 5, async doc => {
          const needed = self.migrateRelationshipIds(doc);
          if (needed) {
            return self.apos.doc.db.replaceOne({ _id: doc._id }, doc);
          }
        });
      });
    }
  };
};
