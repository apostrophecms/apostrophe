apos.define('apostrophe-jobs', {
  construct: function(self, options) {
    self.progress = function(jobId) {
      apos.create(self.__meta.name + '-modal', {
        body: {
          jobId: jobId
        }
      });
    };
  }
});
