apos.define('apostrophe-pieces-selector', {

  extend: 'apostrophe-modal',
  source: 'select',

  construct: function(self, options) {

    self.beforeShow = function(callback) {
      return callback(null);
    };

  }
});
