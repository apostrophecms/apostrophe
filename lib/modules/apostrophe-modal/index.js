// This module provides a base class for modal dialog boxes and supplies
// related markup and LESS files.

module.exports = {
  construct: function(self, options) {
    self.pushAsset('script', 'modal');
    self.pushAsset('stylesheet', 'user');
  }
};
