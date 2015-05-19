module.exports = {
  construct: function(self, options) {
    self.find = function(req, criteria, projection) {
      var cursor = self.apos.docs.find(req, criteria, projection);
      require('./lib/cursor.js')(self, cursor);
      return cursor;
    };
    self.insert = function(req, parentOrId, page, callback) {
    };
    self.move = function(req, page, target, relationship, callback) {
    };
    self.update = function(req, page, callback) {
    };
    // self.trash = function(req, pageOrId, callback) {
    // };
  }
};
