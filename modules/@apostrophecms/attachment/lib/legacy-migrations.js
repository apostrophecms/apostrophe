// Migrations relevant only to those who used early alpha and beta versions of 3.x
// are kept here for tidiness

module.exports = (self) => {
  return {
    addLegacyMigrations() {
      self.addFixLengthPropertyMigration();
      self.addDocReferencesContainedMigration();
    },
    addFixLengthPropertyMigration() {
      self.apos.migration.add('fix-length-property', async () => {
        return self.each({
          'length.size': {
            $exists: 1
          }
        }, 5, attachment => {
          if (attachment.length && attachment.length.size) {
            return self.db.updateOne({
              _id: attachment._id
            }, {
              $set: {
                length: attachment.length.size
              }
            });
          }
        });
      });
    },
    // This migration is needed because formerly,
    // docs that only referenced this attachment via
    // a join were counted as "owning" it, which is
    // incorrect and leads to failure to make it
    // unavailable at the proper time. The name was
    // changed to ensure this migration would run
    // again after that bug was discovered and fixed.
    addDocReferencesContainedMigration() {
      self.apos.migration.add(self.__meta.name + '.docReferencesContained', self.recomputeAllDocReferences);
    }
  };
};
