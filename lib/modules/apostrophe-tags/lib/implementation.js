module.exports = function(self, options) {
  // Overridable hook
  self.beforeListTags = function(req, callback) {
    return setImmediate(callback);
  };

  // Overridable hook
  self.afterListTags = function(req, callback) {
    return setImmediate(callback);
  };

  // Overridable hook
  self.beforeAddTag = function(req, callback) {
    return setImmediate(callback);
  }

  // Overridable hook
  self.afterAddTag = function(req, callback) {
    return setImmediate(callback);
  };

  // Overridable hook
  self.beforeRenameTag = function(req, callback) {
    return setImmediate(callback);
  }

  // Overridable hook
  self.afterRenameTag = function(req, callback) {
    return setImmediate(callback);
  };

  // Overridable hook
  self.beforeDeleteTag = function(req, callback) {
    return setImmediate(callback);
  }

  // Overridable hook
  self.afterDeleteTag = function(req, callback) {
    return setImmediate(callback);
  };

};
