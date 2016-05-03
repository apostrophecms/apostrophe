module.exports = function(self, options) {
  // Overridable hook
  self.beforeList = function(req, callback) {
    return setImmediate(callback);
  };

  // Overridable hook
  self.afterList = function(req, callback) {
    return setImmediate(callback);
  };

  // Overridable hook
  self.beforeEdit = function(req, callback) {
    return setImmediate(callback);
  }

  // Overridable hook
  self.afterEdit = function(req, callback) {
    return setImmediate(callback);
  };

  // Overridable hook
  self.beforeTrash = function(req, callback) {
    return setImmediate(callback);
  }

  // Overridable hook
  self.afterTrash = function(req, callback) {
    return setImmediate(callback);
  };

};
