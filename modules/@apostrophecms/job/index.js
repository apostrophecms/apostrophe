const { stripIndent } = require('common-tags');
// The `@apostrophecms/job` module runs long-running jobs in response
// to user actions. Batch operations on pieces are a good example.
//
// The `@apostrophecms/job` module makes it simple to implement
// progress display, and avoid server timeouts during long operations.
//
// See the `run` method for the easiest way to use this module.
// The `run` method allows you to implement routes that are designed
// to be paired with the `progress` method of this module on
// the browser side. All you need to do is make sure the
// IDs are posted to your route and then write a function that
// can carry out the operation on one id.
//
// If you just want to add a new batch operation for pieces,
// see the examples already in `@apostrophecms/piece-type` (e.g.,
// `batchSimpleRoute`). You don't need to go directly to this module for that
// case.
//
// If your operation doesn't break down neatly into repeated operations
// on single documents, look into calling the `start` method and friends
// directly from your code.
//
// The `@apostrophecms/job` module DOES NOT have anything to do with
// cron jobs or command line tasks.

module.exports = {
  options: { collectionName: 'aposJobs' },
  icons: {
    'database-export-icon': 'DatabaseExport'
  },
  async init(self) {
    await self.ensureCollection();

    self.enableBrowserData();
  },
  apiRoutes(self) {
    return {
      post: {
        async progress(req) {
          self.apos.util.warnDev(stripIndent`
            The @apostrophecms/job module's "/progress" route is deprecated.
            Use the RESTful registered "action" route on the module instead.
          `);

          return {};
        }
      }
    };
  },
  restApiRoutes (self) {
    return {
      async getOne(req, _id) {
        if (!self.apos.permission.can(req, 'view-draft')) {
          throw self.apos.error('notfound');
        }

        const jobId = self.apos.launder.id(_id);
        const job = await self.db.findOne({ _id: jobId });

        if (!job) {
          throw self.apos.error('notfound');
        }

        job.percentage = !job.total ? 0 : (job.processed / job.total * 100).toFixed(2);

        return job;
      }
    };
  },
  methods(self) {
    return {
      // Starts and supervises a long-running job such as a
      // batch operation on pieces. Call it to implement an API route
      // that runs a job involving carrying out the same action
      // repetitively on many things. If your job doesn't look like
      // that, check out `run` instead.
      //
      // The `ids` to be processed should be provided via `req.body.ids`.
      //
      // Pass `req` and an async `change` function that accepts `(req, id)`,
      // performs the modification on that one id and throws an error if
      // necessary; this is recorded as a bad item in the job, it does
      // not stop the job. `change` may optionally return a result object.
      //
      // This method will return an object with a `jobId` identifier as soon as
      // the job is ready to start, and the actual job will continue in the
      // background afterwards. You can pass `jobId` to the `progress` API route
      // of this module as `_id` on the request body to get job status info.
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
      // Notification messages should be included on a `req.body.messages` object. See `triggerNotification for details`.
      async runBatch(req, ids, change, options = {}) {
        let job;
        let notification;
        const total = ids.length;

        const results = {};
        const res = req.res;
        try {
          // sends a response with a jobId to the browser
          job = await self.start(options);

          self.setTotal(job, ids.length);
          // Runs after response is already sent
          run();

          // Trigger the "in progress" notification.
          notification = await self.triggerNotification(req, 'progress', {
            // It's only relevant to pass a job ID to the notification if
            // the notification will show progress. Without a total number we
            // can't show progress.
            jobId: total && job._id,
            ids,
            action: options.action
          });

          return {
            jobId: job._id
          };
        } catch (err) {
          self.apos.util.error(err);
          if (!job) {
            return res.status(500).send('error');
          }
          try {
            return await self.end(job, false);
          } catch (err) {
            // Not a lot we can do about this since we already
            // stopped talking to the user
            self.apos.util.error(err);
          }
        }
        async function run() {
          let good = false;
          try {
            for (const id of ids) {
              try {
                const result = await change(req, id);
                self.success(job);
                results[id] = result;
              } catch (err) {
                self.failure(job);
              }
            }
            good = true;
          } finally {
            await self.end(job, good, results);
            // Trigger the completed notification.
            await self.triggerNotification(req, 'completed', {
              dismiss: true
            });
            // Dismiss the progress notification. It will delay 4 seconds
            // because "completed" notification will dismiss in 5 and we want
            // to maintain the feeling of process order for users.
            await self.apos.notification.dismiss(req, notification.noteId, 4000);
          }
        }
      },
      // Similar to `runBatch`, this method Starts and supervises a long-running job,
      // however unlike `runBatch` the `doTheWork` function provided is invoked just
      // once, and when it completes the job is over. This is not the way to
      // implement a batch operation on pieces; see the `batchSimple` method
      // of that module.
      //
      // The `doTheWork` function receives `(req, reporting)` and may optionally invoke
      // `reporting.success()` and `reporting.failure()` to update the progress and error
      // counters, and `reporting.setTotal()` to indicate the total number of
      // counts expected so a progress meter can be rendered. This is optional
      // and an indication of progress is still displayed without it.
      //
      // `reporting.setResults(object)` may also be called to pass a
      // results object, which will be available on the finished job document.
      //
      // This method will return an object with a `jobId` identifier as soon as
      // the job is ready to start, and the actual job will continue in the
      // background afterwards. You can pass `jobId` to the `progress` API route
      // of this module as `_id` on the request body to get job status info.
      //
      // Notification messages should be included on a `req.body.messages` object. See `triggerNotification for details`.
      async run(req, doTheWork, options = {}) {
        const res = req.res;
        let job;
        let total;

        try {
          job = await self.start(options);

          const notification = await self.triggerNotification(req, 'progress', {
            jobId: job._id
          });

          run({ notificationId: notification.noteId });

          return {
            jobId: job._id
          };
        } catch (err) {
          self.apos.util.error(err);

          if (!job) {
            // If we never made a job, then we never responded
            // otherwise we already stopped talking to the user
            return res.status(500).send('error');
          }
        }

        async function run(info) {
          let results;
          let good = false;
          try {
            await doTheWork(req, {
              success (n) {
                n = n || 1;
                return self.success(job, n);
              },
              failure (n) {
                n = n || 1;
                return self.failure(job, n);
              },
              setTotal (n) {
                total = n;
                return self.setTotal(job, n);
              },
              setResults (_results) {
                results = _results;
              }
            }, info);
            good = true;
          } finally {
            await self.end(job, good, results);

            // Trigger the completed notification.
            await self.triggerNotification(req, 'completed', {
              count: total,
              dismiss: true
            }, results);
            // Dismiss the progress notification. It will delay 4 seconds
            // because "completed" notification will dismiss in 5 and we want
            // to maintain the feeling of process order for users.
            await self.apos.notification.dismiss(req, info.notificationId, 4000);
          }
        }
      },
      // Job notification messages are passed to `triggerNotifications`
      // through `req.body.messages` via `run` and `runBatch`. The
      // `req.body.messages` object can include `progress` and `completed`
      // properties, which will be used for notifications when the job starts
      // (`progress`) and ends (`completed`). Those messages can include the
      // following interpolation keys:
      // - {{ type }}: The doc type, as passed to the job on req.body.type
      // - {{ count }}: The count of total document IDs in the req.body._ids
      //   array
      // No messages are required, but they provide helpful information to
      // end users.
      async triggerNotification(req, stage, options = {}, results) {
        if (!req.body || !req.body.messages || !req.body.messages[stage]) {
          return {};
        }

        const event = req.body.messages.resultsEventName && results
          ? {
            name: req.body.messages.resultsEventName,
            data: { ...results }
          }
          : null;

        return self.apos.notification.trigger(req, req.body.messages[stage], {
          interpolate: {
            count: options.count || (req.body._ids && req.body._ids.length),
            type: req.t(req.body.type) || req.t('apostrophe:document')
          },
          dismiss: options.dismiss,
          job: {
            _id: options.jobId,
            action: options.action,
            ids: options.ids
          },
          event,
          classes: options.classes,
          icon: req.body.messages.icon || 'database-export-icon',
          type: options.type || 'success',
          return: true
        });
      },
      // Start tracking a long-running job. Called by routes
      // that require progress display and/or the ability to take longer
      // than the server might permit a single HTTP request to last.
      // *You usually won't call this yourself. The easy way is usually
      // to call the `runBatch` or `run` methods.*
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
      async start(options) {
        const job = {
          _id: self.apos.util.generateId(),
          good: 0,
          bad: 0,
          processed: 0,
          status: 'running',
          ended: false,
          when: new Date()
        };
        const context = {
          _id: job._id,
          options
        };

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
      success(job, n) {
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
      failure(job, n) {
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
        self.db.updateOne({ _id: job._id }, { $set: { total } }, function (err) {
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
            results
          }
        });
      },
      async ensureCollection() {
        self.db = await self.apos.db.collection(self.options.collectionName);
      },
      getBrowserData(req) {
        return {
          action: self.action
        };
      }
    };
  }
};
