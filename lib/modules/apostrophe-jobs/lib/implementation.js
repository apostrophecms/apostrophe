module.exports = function(self, options) {

  self.ensureCollection = function(callback) {
    self.db = self.apos.db.collection(self.options.collectionName);
    return setImmediate(callback);
  };

  // Periodically invoked to check whether
  // a request to cancel or stop the job has been made.
  // If it has we invoke options.cancel or options.stop to
  // actually cancel it, preferably the former. This method is invoked
  // by an interval timer installed by `self.start`.
  // This allows a possibly different apostrophe process
  // to request a cancellation by setting the `canceling` property;
  // the original process actually running the job
  // cancels and then acknowledges this by setting status to `canceled`
  // or `stopped` according to which operation is
  // actually supported by the job.

  self.checkStop = function(context) {

    if (context.checkingStop || context.ended) {
      return;
    }

    context.checkingStop = true;

    return self.db.findOne({ _id: context._id }, function(err, job) {
      if (err) {
        self.apos.utils.error(err);
        // We'll retry automatically
        context.checkingStop = false;
        return;
      }
      if (!job) {
        self.apos.utils.error('job never found');
        context.checkingStop = false;
        return;
      }
      if (job.canceling) {
        if (job.canCancel) {
          return halt('cancel', 'canceled');
        } else if (job.canStop) {
          return halt('stop', 'stopped');
        }
      }
      context.checkingStop = false;

      function halt(verb, status) {
        return context.options[verb](job, function(err) {
          if (err) {
            self.apos.utils.error(err);
            // If "stop" or "cancel" fails, that's bad news.
            // Fail the job
            return self.db.update({
              _id: context._id
            }, {
              $set: {
                ended: true,
                canceling: false,
                status: 'failed'
              }
            }, function(err) {
              self.apos.utils.error(err);
              context.checkingStop = false;
            });
          }
          var $set = {
            ended: true,
            canceling: false,
            status: status
          };
          return self.db.update({ _id: job._id }, {
            $set: $set
          }, function(err) {
            if (err) {
              self.apos.utils.error(err);
              context.checkingStop = false;
              return;
            }
            context.checkingStop = false;
          });
        });
      }
    });
  };
};
