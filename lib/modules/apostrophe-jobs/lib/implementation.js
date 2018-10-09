module.exports = function(self, options) {

  self.ensureCollection = async function() {
    self.db = await self.apos.db.collection(self.options.collectionName);
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

  self.checkStop = async function(context) {

    if (context.checkingStop || context.ended) {
      return;
    }

    context.checkingStop = true;

    try {
      const job = await self.db.findOne({ _id: context._id });
      if (!job) {
        self.apos.utils.error('job never found');
        return;
      }
      if (job.canceling) {
        if (job.canCancel) {
          return halt('cancel', 'canceled');
        } else if (job.canStop) {
          return halt('stop', 'stopped');
        }
      }
    } catch (err) {
      self.apos.utils.error(err);
      await self.db.updateOne({
        _id: context._id
      }, {
        $set: {
          ended: true,
          canceling: false,
          status: 'failed'
        }
      });
    } finally {
      context.checkingStop = false;
      if (job.ended) {
        clearInterval(context.interval);
      }
    }

    function halt(verb, status) {
      await context.options[verb](job);
      const $set = {
        ended: true,
        canceling: false,
        status: status
      };
      await self.db.updateOne({ _id: job._id }, {
        $set: $set
      });
    }
  };
};
