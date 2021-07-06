// Migrations relevant only to those who used early alpha and beta versions of 3.x
// are kept here for tidiness

module.exports = (self) => {
  return {
    addLegacyMigrations() {
      self.addRoleMigration();
    },
    addRoleMigration() {
      self.apos.migration.add('add-role-to-user', async () => {
        return self.apos.doc.db.updateMany({
          type: '@apostrophecms/user',
          role: {
            $exists: 0
          }
        }, {
          $set: {
            role: 'admin'
          }
        });
      });
    }
  };
};
