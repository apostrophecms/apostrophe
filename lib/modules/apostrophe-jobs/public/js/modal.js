// A modal for importing pieces

apos.define('apostrophe-jobs-modal', {

  extend: 'apostrophe-modal',

  source: 'modal',

  construct: function(self, options) {

    self.canceling = false;

    self.beforeShow = function(callback) {
      self._id = options.body._id;
      self.$el.find('[data-apos-job-done]').hide();
      self.startProgress();
      return setImmediate(callback);
    };
    
    self.startProgress = function() {
      self.progressInterval = setInterval(self.updateProgress, 1000);
      self.updateProgress();
    };
    
    self.updateProgress = function() {
      return self.api('progress', { _id: self._id }, function(data) {
        if (data.status === 'ok') {
          self.$el.find('[data-apos-job-progress-container]').html(data.html);
          if (data.job.ended) {
            self.$el.find('[data-apos-job-cancel],[data-apos-job-stop]').hide();
            self.$el.find('[data-apos-job-done]').show();
            clearInterval(self.progressInterval);
            self.progressInterval = null;
          }
        }
      });
    };
    
    self.afterHide = function() {
      if (self.progressInterval) {
        clearInterval(self.progressInterval);
      }
      if (self.options.change) {
        apos.change(self.options.change);
      }
    };
    
    self.hideForm = function() {
      self.$el.find('[data-apos-form]').hide();
    };

    self.beforeCancel = function(callback) {
      if ((!self._id) || (self.finished)) {
        // Easy to cancel when we haven't even started yet;
        // impossible to cancel once we're finished
        return setImmediate(callback);
      }
      apos.ui.globalBusy(true);
      self.canceling = true;
      if (self.progressInterval) {
        clearInterval(self.progressInterval);
      }
      return self.api('cancel', { _id: self._id }, function(data) {
        apos.ui.globalBusy(false);
        return callback(null);
      }, function(err) {
        // Even if some sort of network error occurs we can't do anything useful
        // at this point by keeping the modal up in this situation
        apos.ui.globalBusy(false);
        return callback(null);
      });
    };

  }
});
