module.exports = function(self, options) {
  // Overridable hook
  self.beforeListTags = function(req, options, callback) {
    return setImmediate(callback);
  };

  // Overridable hook
  self.afterListTags = function(req, options, callback) {
    return setImmediate(callback);
  };

  // Overridable hook
  self.beforeAddTag = function(req, tag, callback) {
    return setImmediate(callback);
  };

  // Overridable hook
  self.afterAddTag = function(req, tag, callback) {
    return setImmediate(callback);
  };

  // Overridable hook
  self.beforeRenameTag = function(req, tag, newTag, callback) {
    return setImmediate(callback);
  };

  // Overridable hook
  self.afterRenameTag = function(req, tag, newTag, callback) {
    return setImmediate(callback);
  };

  // Overridable hook
  self.beforeDeleteTag = function(req, tag, callback) {
    return setImmediate(callback);
  };

  // Overridable hook
  self.afterDeleteTag = function(req, tag, callback) {
    return setImmediate(callback);
  };

};
