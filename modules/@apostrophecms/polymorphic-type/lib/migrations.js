module.exports = (self) => {
  return {
    addMigrations() {
      self.removePolymorphicTypeAliasMigration();
    },
    removePolymorphicTypeAliasMigration() {
      self.apos.migration.add('remove-polymorphic-type-alias', () => {
        return self.apos.doc.db.updateMany({
          type: '@apostrophecms/polymorphic'
        }, {
          $set: {
            type: '@apostrophecms/polymorphic-type'
          }
        });
      });
    }
  };
};
