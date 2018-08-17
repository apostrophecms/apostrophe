module.exports = function(self, options) {
  self.apos.migrations.add('apostrophe-docs.normalizeTrash', function(callback) {
    return self.apos.docs.db.update({
      trash: { $exists: false }
    }, {
      $set: {
        trash: false
      }
    }, {
      multi: true
    }, callback);
  });
};
