const _ = require('lodash');
// The `@apostrophecms/job` module runs long-running jobs in response
// to user actions. Batch operations on pieces are a good example.
//
// The `@apostrophecms/job` module makes it simple to implement
// progress display, avoid server timeouts during long operations,
// and implement a "stop" button.
//
// See the `run` method for the easiest way to use this module.
// The `run` method allows you to implement routes that are designed
// to be paired with the `progress` method of this module on
// the browser side. All you need to do is make sure the
// ids are posted to your route and then write a function that
// can carry out the operation on one id.
//
// If you just want to add a new batch operation for pieces,
// see the examples already in `@apostrophecms/piece-type` and those added
// by the `@apostrophecms/workflow` module. You don't need to go
// directly to this module for that case.
//
// If your operation doesn't break down neatly into repeated operations
// on single documents, look into calling the `start` method and friends
// directly from your code.
//
// The `@apostrophecms/job` module DOES NOT have anything to do with
// cron jobs or command line tasks.

module.exports = {
  options: { collectionName: 'aposJobs' },
  async init(self) {
    await self.ensureCollection();
  },
  // TODO RESTify these
  apiRoutes(self) {
    return {
      post: {
        async cancel(req) {
          const _id = self.apos.launder.id(req.body._id);
          const count = await self.db.updateOne({ _id: _id }, { $set: { canceling: true } });
          if (!count) {
            throw self.apos.error('notfound');
          }
        },
        async progress(req) {
          const _id = self.apos.launder.id(req.body._id);
          const job = await self.db.findOne({ _id: _id });
          if (!job) {
            throw self.apos.error('notfound');
          }
          // % of completion rounded off to 2 decimal places
          if (!job.total) {
            job.percentage = 0;
          } else {
            job.percentage = (job.processed / job.total * 100).toFixed(2);
          }
          return job;
        }
      }
    };
  },
  methods(self) {
    return {
      // Starts and supervises a long-running job such as a
      // batch operation on pieces. Call it to implement an API route
      // that runs a job involving carrying out the same action
      // repetitively on many things. If your job doesn't look like
      // that, check out `runNonBatch` instead.
      //
      // The `ids` to be processed should be provided via `req.body.ids`.
      //
      // Pass `req` and an async `change` function that accepts `(req, id)`,
      // performs the modification on that one id and throws an error if
      // necessary; this is recorded as a bad item in the job, it does
      // not stop the job. `change` may optionally return a result object.
      //
      // Returns an object with `{ jobId: 'cxxxx' }` before the work actually
      // begins. This can then be used for progress monitoring via the
      // ApostropheJobMonitor Vue component.
      //
      // The actual work continues in background after this method returns.
      //
      // Jobs run in this way support the stop operation. They do not
      // currently support the cancel (undo/rollback) operation.
      //
      // The `batchSimple` method of `@apostrophecms/piece-type` is an even
      // simpler wrapper for this method if you are implementing a batch operation
      // on a single type of piece.
      //
      // *Options*
      //
      // `options.label` should be passed as an object with
      // a `title` property, to title the progress modal.
      // A default is provided but it is not very informative.
      //
      // In addition, it may have `failed`, `completed` and
      // `running` properties to label the progress modal when the job
      // is in those states, and `good` and `bad` properties to label
      // the count of items that were successful or had errors.
      // All of these properties are optional and reasonable
      // defaults are supplied.
      async run(req, ids, change, options) {
        let job;
        let stopping = false;
        const results = {};
        const res = req.res;
        try {
          // sends a response with a jobId to the browser
          const job = await startJob();
          // Runs after response is already sent
          run();
          return job;
        } catch (err) {
          self.apos.util.error(err);
          if (!job) {
            return res.status(500).send('error');
          }
          try {
            await self.end(job, false);
          } catch (err) {
            // Not a lot we can do about this since we already
            // stopped talking to the user
            self.apos.util.error(err);
          }
        }
        async function startJob() {
          job = await self.start(_.assign({}, options, {
            stop: function (job) {
              stopping = true;
            }
          }));
          self.setTotal(job, ids.length);
          return { jobId: job._id };
        }
        async function run() {
          let good = false;
          try {
            for (const id of ids) {
              if (stopping) {
                return;
              }
              try {
                const result = await change(req, id);
                self.good(job);
                results[id] = result;
              } catch (err) {
                self.bad(job);
              }
            }
            good = true;
          } finally {
            await self.end(job, good, results);
          }
        }
      },
      // Similar to `run`, this method Starts and supervises a long-running job,
      // however unlike `run` the `doTheWork` function provided is invoked just
      // once, and when it completes the job is over. This is not the way to
      // implement a batch operation on pieces; see the `batchSimple` method
      // of that module.
      //
      // The `doTheWork` function receives `(req, reporting)` and may optionally invoke
      // `reporting.good()` and `reporting.bad()` to update the progress and error
      // counters, and `reporting.setTotal()` to indicate the total number of
      // counts expected so a progress meter can be rendered. This is optional and
      // an indication of progress is still displayed without it.
      // `reporting.setResults(object)` may also be called to pass a
      // `results` object, which is displayed as a table by the
      // `ApostropheJobMonitor` Vue component on the browser side.
      //
      // This method will return `{ jobId: 'cxxxx' }` as soon as the job is
      // ready to start, and the actual job will continue in the background
      // afterwards. You should pass `jobId` as a prop to the
      // `ApostropheJobMonitor` Vue component (TODO: write this component
      // for 3.0).
      //
      // After the job status is `completed` that component will emit
      // suitable events and the `results` object, if any.
      //
      // *Options*
      //
      // `options.label` should be passed as an object with
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
      // You may optionally provide `options.stop` or `options.cancel`.
      // These async functions will be invoked and awaited
      // after the user requests to stop the operation. `stop` must cease
      // all operations before resolving, while `cancel` must both cease
      // operations and reverse all changes made before resolving.
      async runNonBatch(req, doTheWork, options) {
        const res = req.res;
        let job;
        const canceling = false;
        try {
          const info = await startJob();
          run();
          return info;
        } catch (err) {
          self.apos.util.error(err);
          if (job) {
            // Not a lot we can do about this since we already
            // stopped talking to the user
            self.apos.util.error(err);
          } else {
            // If we never made a job, then we never responded
            return res.status(500).send('error');
          }
        }
        async function startJob() {
          job = await self.start(options);
          return { jobId: job._id };
        }
        async function run() {
          let results;
          let good = false;
          try {
            await doTheWork(req, {
              good: function (n) {
                n = n || 1;
                return self.good(job, n);
              },
              bad: function (n) {
                n = n || 1;
                return self.bad(job, n);
              },
              setTotal: function (n) {
                return self.setTotal(job, n);
              },
              setResults: function (_results) {
                results = _results;
              },
              isCanceling: function () {
                return canceling;
              }
            });
            good = true;
          } finally {
            await self.end(job, good, results);
          }
        }
      },
      // Start tracking a long-running job. Called by routes
      // that require progress display and/or the ability to take longer
      // than the server might permit a single HTTP request to last.
      // *You usually won't call this yourself. The easy way is usually
      // to call the `run` or `runNonBatch` methods.*
      //
      // On success this method returns a `job` object.
      // You can then invoke the `setTotal`, `success`, `error`,
      // and `end` methods of the job object. `start` and `end`
      // are async functions.
      //
      // Once you successfully call `start`, you *must* eventually call
      // `end` with a `job` object. In addition,
      // you *may* call `success(job)` and `error(job)` any number of times
      // to indicate the success or failure of one "row" or other item
      // processed, and you *may* call `setTotal(job, n)` to indicate
      // how many rows to expect for better progress display.
      //
      // *Canceling and stopping jobs*
      //
      // If `options.cancel` is passed, the user may cancel (undo) the job.
      // If they do `options.cancel` will be invoked with `(job)` and
      // it *must undo what was done*. `cancel` must be async and will
      // be awaited. If it throws an error, the job will be stopped
      // with no further progress in the undo operation.
      //
      // If `options.stop` is passed, the user may stop (halt) the operation.
      // If they do `options.stop` will be invoked with `(job)` and
      // it *must stop processing new items*. This function may be
      // async and it must not resolve until it is guaranteed that
      // *no more operations will run*.
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
      async start(options) {
        const job = {
          _id: self.apos.util.generateId(),
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
        const context = {
          _id: job._id,
          options: options
        };
        if (options.cancel || options.stop) {
          context.interval = setInterval(function () {
            self.checkStop(context);
          }, 250);
        }
        await self.db.insertOne(job);
        return context;
      },
      // Call this to report that n items were good
      // (successfully processed).
      //
      // If the second argument is completely omitted,
      // the default is `1`.
      //
      // No promise is returned as this method just updates
      // the job tracking information in the background.
      good(job, n) {
        n = n === undefined ? 1 : n;
        self.db.updateOne({ _id: job._id }, {
          $inc: {
            good: n,
            processed: n
          }
        }, function (err) {
          if (err) {
            self.apos.util.error(err);
          }
        });
      },
      // Call this to report that n items were bad
      // (not successfully processed).
      //
      // If the second argument is completely omitted,
      // the default is 1.
      //
      // No promise is returned as this method just updates
      // the job tracking information in the background.
      bad(job, n) {
        n = n === undefined ? 1 : n;
        self.db.updateOne({ _id: job._id }, {
          $inc: {
            bad: n,
            processed: n
          }
        }, function (err) {
          if (err) {
            self.apos.util.error(err);
          }
        });
      },
      // Call this to indicate the total number
      // of items expected. Until and unless this is called
      // a different type of progress display is used.
      // If you do call this, the total of all calls
      // to success() and error() should not exceed it.
      //
      // It is OK not to call this, however the progress
      // display will be less informative.
      //
      // No promise is returned as this method just updates
      // the job tracking information in the background.
      setTotal(job, total) {
        self.db.updateOne({ _id: job._id }, { $set: { total: total } }, function (err) {
          if (err) {
            self.apos.util.error(err);
          }
        });
      },
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
      async end(job, success, results) {
        // context object gets an update to avoid a
        // race condition with checkStopped
        job.ended = true;
        return self.db.updateOne({ _id: job._id }, {
          $set: {
            ended: true,
            status: success ? 'completed' : 'failed',
            results: results
          }
        });
      },
      async ensureCollection() {
        self.db = await self.apos.db.collection(self.options.collectionName);
      },
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
      async checkStop(context) {
        if (context.checkingStop || context.ended) {
          return;
        }
        context.checkingStop = true;
        let job;
        try {
          job = await self.db.findOne({ _id: context._id });
          if (!job) {
            self.apos.util.error('job never found');
            return;
          }
          if (job.canceling) {
            if (job.canCancel) {
              return await halt('cancel', 'canceled');
            } else if (job.canStop) {
              return await halt('stop', 'stopped');
            }
          }
        } catch (err) {
          self.apos.util.error(err);
          await self.db.updateOne({ _id: context._id }, {
            $set: {
              ended: true,
              canceling: false,
              status: 'failed'
            }
          });
        } finally {
          context.checkingStop = false;
          if (job && job.ended) {
            clearInterval(context.interval);
          }
        }
        async function halt(verb, status) {
          await context.options[verb](job);
          const $set = {
            ended: true,
            canceling: false,
            status: status
          };
          await self.db.updateOne({ _id: job._id }, { $set: $set });
        }
      }
    };
  }
};
