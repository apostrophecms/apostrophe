apos.define('apostrophe-jobs', {
  extend: 'apostrophe-context',
  construct: function(self, options) {
    // Start a progress display for the given job id. 
    // If options.change is set, an `apos.change` call is
    // made with that argument when the progress display
    // is dismissed.
    self.progress = function(jobId, options) {
      apos.create(self.__meta.name + '-modal', _.assign({
        body: {
          _id: jobId
        },
        change: options && options.change
      }, self.options));
    };
  }
});
