// Migrations relevant only to those who used early alpha and beta versions of 3.x
// are kept here for tidiness

module.exports = (self) => {
  return {
    addLegacyMigrations() {
      self.addRetirePublishedFieldMigration();
    },
    addRetirePublishedFieldMigration() {
      self.apos.migration.add('retire-published-field', async () => {
        await self.apos.migration.eachDoc({}, 5, async (doc) => {
          if (doc.published === true) {
            doc.visibility = 'public';
          } else if (doc.published === false) {
            doc.visibility = 'loginRequired';
          }
          delete doc.published;
          return self.apos.doc.db.replaceOne({
            _id: doc._id
          }, doc);
        });
      });
    }
  };
};
