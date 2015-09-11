module.exports = function(self, cursor) {
  return cursor.type(self.name).sort(self.options.sort || { updatedAt: -1 });
};
