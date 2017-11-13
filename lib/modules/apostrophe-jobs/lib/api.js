module.exports = function(self, options) {

  // Start tracking a long-running job. Called by routes
  // that require progress display and/or the ability to take longer
  // than the server might permit a single HTTP request to last.
  //
  // On success this method invokes its callback with `(null, job)`.
  // You can then invoke the `setTotal`, `success`, `error`,
  // and `end` methods with the job object. *For convenience,
  // only `start` and `end` require a callback.*
  //
  // Once you successfully call `start`, you *must* eventually call
  // `end` with a `job` object and a callback. In addition, 
  // you *may* call `success(job)` and `error(job)` any number of times
  // to indicate the success or failure of one "row" or other item
  // processed, and you *may* call `setTotal(job, n)` to indicate
  // how many rows to expect for better progress display.
  //
  // *Canceling and stopping jobs*
  //
  // If `options.cancel` is passed, the user may cancel (undo) the job.
  // If they do `options.cancel` will be invoked with `(job, callback)` and
  // it *must undo what was done*. You must invoke the callback *after the
  // undo operation*. If you pass an error to the callback, the job will be stopped
  // with no further progress in the undo operation.
  //
  // If `options.stop` is passed, the user may stop (halt) the operation.
  // If they do `options.stop` will be invoked with `(job, callback)` and
  // it *must stop processing new items*. You must invoke the callback
  // *after all operations have stopped*.
  //
  // The difference between stop and cancel is the lack of undo with "stop".
  // Implement the one that is practical for you. Users like to be able to
  // undo things fully, of course.
  //
  // You should not offer both. If you do, only "Cancel" is presented
  // to the user.
  //
  // *Labeling the progress modal: `options.label`*
  //
  // `options.label` should be passed as an object with
  // a `title` property, to title the progress modal.
  //
  // In addition, it may have `failed`, `completed` and
  // `running` properties to label the progress modal when the job
  // is in those states, and `good` and `bad` properties to label
  // the count of items that were successful or had errors.
  // All of these properties are optional and reasonable
  // defaults are supplied.
  
  self.start = function(options, callback) {
        
    var job = {
      _id: self.apos.utils.generateId(),
      good: 0,
      bad: 0,
      processed: 0,
      status: 'running',
      ended: false,
      canceling: false,
      labels: options.labels || {},
      when: new Date(),
      canCancel: !!options.cancel,
      canStop: !!options.stop
    };
    
    var context = {
      _id: job._id,
      options: options
    };

    if (options.cancel || options.stop) {
       context.interval = setInterval(function() {
         self.checkStop(context);
       }, 250);
    }

    return self.db.insert(job, function(err) {
      if (err) {
        return callback(err);
      }
      return callback(null, context);
    });

  };
  
  // Call this to report that n items were good
  // (successfully processed).
  //
  // If the second argument is completely omitted,
  // the default is `1`.
  //
  // For simplicity there is no callback,
  // since the reporting is noncritical. Just
  // call it and move on.
  
  self.good = function(job, n) {
    var n = (n === undefined) ? 1 : n;
    self.db.update({
      _id: job._id
    }, {
      $inc: {
        good: n,
        processed: n
      }
    }, function(err) {
      console.error(err);
    });
  };

  // Call this to report that n items were bad
  // (not successfully processed).
  //
  // If the second argument is completely omitted,
  // the default is 1.
  //
  // For simplicity there is no callback,
  // since the reporting is noncritical. Just
  // call it and move on.

  self.bad = function(job, n) {
    var n = (n === undefined) ? 1 : n;
    self.db.update({
      _id: job._id
    }, {
      $inc: {
        bad: n,
        processed: n
      }
    }, function(err) {
      console.error(err);
    });
  };
  
  // Call this to indicate the total number
  // of items expected. Until and unless this is called
  // a different type of progress display is used.
  // If you do call this, the total of all calls
  // to success() and error() should not exceed it.
  //
  // It is OK not to call this, however the progress
  // display will be less informative.
  //
  // For simplicity there is no callback,
  // since the reporting is noncritical. Just
  // call it and move on.
  
  self.setTotal = function(job, total) {
    self.db.update({
      _id: job._id
    }, {
      total: total
    }, function(err) {
      if (err) {
        console.error(err);
      }
    });
  };
  
  // Mark the given job as ended. If `success`
  // is true the job is reported as an overall
  // success, if `failed` is true the job
  // is reported as an overall failure.
  // Either way the user can still see the
  // count of "good" and "bad" items.
  
  self.end = function(job, success, callback) {
    // context object gets an update to avoid a
    // race condition with checkStopped
    job.ended = true;
    return self.db.update({
      _id: job._id
    }, {
      $set: {
        ended: true,
        status: success ? 'completed' : 'failed'
      }
    }, callback);
  };  
};
