module.exports = function(self, cursor) {
  return cursor.type(self.name).sort({ sortTitle: 1 });
};
