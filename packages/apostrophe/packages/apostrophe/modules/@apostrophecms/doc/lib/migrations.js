module.exports = (self) => {
  return {
    addMigrations() {
      self.addCacheFieldMigration();
      self.addSetPreviousDocsAposModeMigration();
      self.addSetDocumentModesMigration();
    },

    addCacheFieldMigration() {
      self.apos.migration.add('add-cache-invalidated-at-field', self.setCacheField);
    },

    async addSetPreviousDocsAposModeMigration () {
      self.apos.migration.add('set-previous-docs-apos-mode', async () => {
        await self.apos.doc.db.updateMany({
          _id: { $regex: ':previous$' },
          aposMode: { $ne: 'previous' }
        }, {
          $set: {
            aposMode: 'previous'
          }
        });
      });
    },

    addSetDocumentModesMigration() {
      self.apos.migration.add('set-document-modes', async () => {
        return self.apos.migration.eachDoc({}, 5, async (doc) => {
          const manager = self.getManager(doc.type);
          if (!manager?.isLocalized()) {
            return;
          }
          const idMode = doc._id.split(':').pop(); ;
          const [ locale, localeMode ] = doc.aposLocale.split(':');
          const aposMode = doc.aposMode;

          if (idMode !== localeMode || idMode !== aposMode) {
            await self.apos.doc.db.updateOne({ _id: doc._id }, {
              $set: {
                aposLocale: `${locale}:${idMode}`,
                aposMode: idMode
              }
            });
          }
        });
      });
    },

    // Add the "cacheInvalidatedAt" field to the documents that do not have it
    // yet, and set it to equal doc.updatedAt.
    setCacheField() {
      return self.apos.migration.eachDoc(
        { cacheInvalidatedAt: { $exists: 0 } },
        5,
        async doc => {
          await self.apos.doc.db.updateOne({ _id: doc._id }, {
            $set: { cacheInvalidatedAt: doc.updatedAt }
          });
        }
      );
    }
  };
};
