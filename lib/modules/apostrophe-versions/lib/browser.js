module.exports = function(self, options) {

  self.getBrowserData = function(req) {
    return {
      action: self.action
    };
  };

};
