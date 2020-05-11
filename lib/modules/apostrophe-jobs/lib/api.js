var async = require('async');
var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  // Starts and supervises a long-running job such as a
  // batch operation on pieces. Call it to implement an API route
  // that runs a job involving carrying out the same action
  // repetitively on many things. If your job doesn't look like
  // that, check out `runNonBatch` instead.
  //
  // The `ids` to be processed should be provided via `req.body.ids`.
  //
  // Pass `req` and a `change` function that accepts `(req, id, callback)`,
  // performs the modification on that one id and invokes its callback
  // with an error if any (if passed, this is recorded as a bad item
  // in the job, it does not stop the job) and an optional
  // `result` object.
  //
  // If `req.body.job` is truthy, sends an immediate JSON response to `req.res` with
  // `{ status: 'ok', jobId: 'cxxxx' }`.
  //
  // The `jobId` can then be passed to `apos.modules['apostrophe-jobs'].progress(jobId)`
  // on the browser side to monitor progress. After the job status is `completed`,
  // the results of the job can be obtained via the progress API as the `results`
  // property, an object with a sub-property for each `id`.
  //
  // Jobs run in this way support the stop operation. They do not currently support
  // the cancel (undo/rollback) operation.
  //
  // Note that this method does not actually care if `id` is a doc id or not.
  // It is just a unique identifier for one item to be processed that your
  // `change` function must understand.
  //
  // The `batchSimple` method of `apostrophe-pieces` is an even
  // simpler wrapper for this method if you are implementing a batch operation
  // on a single type of piece.
  //
  // *Options*
  //
  // `options.labels` should be passed as an object with
  // a `title` property, to title the progress modal.
  // A default is provided but it is not very informative.
  //
  // In addition, it may have `failed`, `completed` and
  // `running` properties to label the progress modal when the job
  // is in those states, and `good` and `bad` properties to label
  // the count of items that were successful or had errors.
  // All of these properties are optional and reasonable
  // defaults are supplied.
  //
  // *Backwards compatibility*
  //
  // For bc a single id can be provided via `req.body._id`.
  //
  // If `req.body.job` is not truthy, the entire job is processed and
  // a single HTTP response is sent, like:
  //
  // `{ status: 'ok', data: firstResult }` on success.
  //
  // `firstResult` is an empty object if `ids` was passed rather than `id`.
  //
  // This alternative approach is for bc only. Proxy timeouts are bad. Don't use it.

  self.run = function(req, change, options) {
    var single;
    var job;
    var stopping = false;
    var results = {};
    var ids;
    if (req.body._id) {
      ids = [ self.apos.launder.id(req.body._id) ];
    } else if (req.body.ids) {
      ids = self.apos.launder.ids(req.body.ids);
    } else {
      return self.apiResponder(req, 'invalid');
    }
    return async.series([
      startJob,
      run
    ], function(err) {
      if (err) {
        if (job) {
          return self.end(job, false, function(err) {
            if (err) {
              // Not a lot we can do about this since we already
              // stopped talking to the user
              self.apos.utils.error(err);
            }
          });
        }
        return self.apiResponder(req, err);
      } else {
        if (job) {
          return self.end(job, true, results, function(err) {
            if (err) {
              // Not a lot we can do about this since we already
              // stopped talking to the user
              self.apos.utils.error(err);
            }
          });
        }
        return self.apiResponder(req, null, {
          // legacy
          data: single || {},
          // preferred
          results: results
        });
      }
    });

    function startJob(callback) {
      if (!req.body.job) {
        return callback(null);
      }
      return self.start(_.assign({}, options, {
        stop: function(job, callback) {
          stopping = callback;
        }
      }), function(err, _job) {
        if (err) {
          // Failed to insert the job. Don't continue the series,
          // just tell the browser that.
          return self.apiResponder(req, err);
        }
        job = _job;
        self.setTotal(job, ids.length);
        // DELIBERATE FALLTHROUGH: respond to the browser
        // *right now* with the job id, then continue the
        // series WITHOUT ever touching `res` again. The
        // browser will call back for progress.
        self.apiResponder(req, null, { jobId: job._id });
        return callback(null);
      });
    }

    function run(callback) {
      return async.eachSeries(ids, function(id, callback) {
        if (stopping) {
          // That's it, abandon the eachSeries
          return stopping(null);
        }
        return change(req, id, function(err, result) {
          if (job) {
            if (err) {
              self.bad(job);
            } else {
              self.good(job);
              results[id] = result;
              if (req.body._id && (!single)) {
                single = result;
              }
            }
            return callback(null);
          }
          // Fallback implementation without job progress
          if (!err) {
            return callback(err);
          }
          if (req.body._id && (!single)) {
            single = result;
          }
          results[id] = result;
        });
      }, callback);
    }

  };

  // Similar to `run`, this method Starts and supervises a long-running job,
  // however unlike `run` the `doTheWork` callback function provided is invoked just
  // once, and when it completes the job is over. This is not the way to
  // implement a batch operation on pieces; see the `batchSimple` method
  // of that module.
  //
  // The `doTheWork` function receives `(req, reporting, callback)` and may optionally invoke
  // `reporting.good()` and `reporting.bad()` to update the progress and error
  // counters, and `reporting.setTotal()` to indicate the total number of
  // counts expected so a progress meter can be rendered. This is optional and
  // an indication of progress is still displayed without it.
  // `reporting.setResults(object)` may also be called to pass a
  // `results` object, which is made available to the optional `success` callback
  // of the job's modal on the browser side. `doTheWork` may optionally
  // return a promise rather than invoking the callback.
  //
  // This method will send `{ status: 'ok', jobId: 'cxxxx' }` to the
  // browser for you. There is no callback because there is nothing more for
  // you to do in your route.
  //
  // The `jobId` can then be passed to `apos.modules['apostrophe-jobs'].progress(jobId)`
  // on the browser side to monitor progress. After the job status is `completed`,
  // the results of the job can be obtained via the progress API as the `results`
  // property, an object with a sub-property for each `id`.
  //
  // *Options*
  //
  // `options.labels` should be passed as an object with
  // a `title` property, to title the progress modal.
  // A default is provided but it is not very informative.
  //
  // In addition, it may have `failed`, `completed` and
  // `running` properties to label the progress modal when the job
  // is in those states, and `good` and `bad` properties to label
  // the count of items that were successful or had errors.
  // All of these properties are optional and reasonable
  // defaults are supplied.
  //
  // You may set `options.canStop` or `options.canCancel` to true.
  // If you do, a "stop" or "cancel" button is presented to the user.
  // Your code may then invoke `reporting.isCanceling()` when convenient
  // and, if it returns a function, must cease the operation and then invoke
  // that function **instead of** its callback. If the operation has completed
  // in the meantime your code must take care not to invoke it afterwards.
  //
  // If `canCancel` was used, your code must also
  // undo all effects of the entire job **before invoking** the function.

  self.runNonBatch = function(req, doTheWork, options) {
    var job;
    var canceling = false;
    var results;
    return async.series([
      startJob,
      run
    ], function(err) {
      if (err) {
        self.apos.utils.error(err);
        return self.end(job, false, function(err) {
          if (err) {
            // Not a lot we can do about this since we already
            // stopped talking to the user
            self.apos.utils.error(err);
          }
        });
      } else {
        return self.end(job, true, results, function(err) {
          if (err) {
            // Not a lot we can do about this since we already
            // stopped talking to the user
            self.apos.utils.error(err);
          }
        });
      }
    });

    function startJob(callback) {
      return self.start(_.assign({}, options, {
        stop: options.canStop ? function(job, callback) {
          canceling = callback;

        } : null,
        cancel: options.canCancel ? function(job, callback) {
          canceling = callback;

        } : null
      }), function(err, _job) {
        if (err) {
          // Failed to insert the job. Don't continue the series,
          // just tell the browser that.
          return self.apiResponder(req, err);
        }
        job = _job;
        // DELIBERATE FALLTHROUGH: respond to the browser
        // *right now* with the job id, then continue the
        // series WITHOUT ever touching `res` again. The
        // browser will call back for progress.
        self.apiResponder(req, null, { jobId: job._id });
        return callback(null);
      });
    }

    function run(callback) {
      var result = doTheWork(req, {
        good: function(n) {
          n = n || 1;
          return self.good(job, n);
        },
        bad: function(n) {
          n = n || 1;
          return self.bad(job, n);
        },
        setTotal: function(n) {
          return self.setTotal(job, n);
        },
        setResults: function(_results) {
          results = _results;
        },
        isCanceling: function() {
          return canceling;
        }
      }, callback);
      // If `doTheWork` returned a promise instead,
      // invoke the callback on its behalf when it resolves
      if (result && result.then) {
        result.then(function() {
          return callback(null);
        })
          .catch(function(e) {
            return callback(e);
          });
      }
    }

  };

  // Start tracking a long-running job. Called by routes
  // that require progress display and/or the ability to take longer
  // than the server might permit a single HTTP request to last.
  // *You usually won't call this yourself. The easy way is usually
  // to call the `run` method, above.*
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
  // *Labeling the progress modal: `options.labels`*
  //
  // `options.labels` should be passed as an object with
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
    n = (n === undefined) ? 1 : n;
    self.db.update({
      _id: job._id
    }, {
      $inc: {
        good: n,
        processed: n
      }
    }, function(err) {
      if (err) {
        self.apos.utils.error(err);
      }
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
    n = (n === undefined) ? 1 : n;
    self.db.update({
      _id: job._id
    }, {
      $inc: {
        bad: n,
        processed: n
      }
    }, function(err) {
      if (err) {
        self.apos.utils.error(err);
      }
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
      $set: {
        total: total
      }
    }, function(err) {
      if (err) {
        self.apos.utils.error(err);
      }
    });
  };

  // Mark the given job as ended. If `success`
  // is true the job is reported as an overall
  // success, if `failed` is true the job
  // is reported as an overall failure.
  // Either way the user can still see the
  // count of "good" and "bad" items.
  //
  // If the results parameter is not omitted entirely,
  // it is added to the job object in the database
  // as the `results` property.

  self.end = function(job, success, results, callback) {
    if (!callback) {
      callback = results;
      results = null;
    }
    // context object gets an update to avoid a
    // race condition with checkStopped
    job.ended = true;
    if (job.interval) {
      clearInterval(job.interval);
    }
    return self.db.update({
      _id: job._id
    }, {
      $set: {
        ended: true,
        status: success ? 'completed' : 'failed',
        results: results
      }
    }, callback);
  };
};
