module.exports = function(self, options) {
  // Overridable hook
  self.beforeList = function(req, callback) {
    return setImmediate(callback);
  };

  // Overridable hook
  self.afterList = function(req, callback) {
    return setImmediate(callback);
  };
};
