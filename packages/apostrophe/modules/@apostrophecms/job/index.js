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
        },
        // Request cancellation of a running job. The running process
        // observes the flag via `reporting.isCanceling` and decides how
        // to wind down; the request is a no-op for jobs that never
        // check it and for jobs that already ended.
        async ':_id/cancel'(req) {
          if (!self.apos.permission.can(req, 'view-draft')) {
            throw self.apos.error('notfound');
          }

          const jobId = self.apos.launder.id(req.params._id);
          const job = await self.db.findOne({ _id: jobId });

          if (!job) {
            throw self.apos.error('notfound');
          }

          if (job.userId && job.userId !== (req.user && req.user._id)) {
            throw self.apos.error('notfound');
          }

          await self.requestCancel(jobId);

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

        if (job.userId && job.userId !== (req.user && req.user._id)) {
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
      // simpler wrapper for this method if you are implementing a batch
      // operation on a single type of piece.
      //
      // Notification messages should be included on a `req.body.messages`
      // object. See `triggerNotification for details`. Pass
      // `notifications: false` in `options` to skip that wiring entirely,
      // e.g. when the caller provides its own progress transport.
      async runBatch(req, ids, change, options = {}) {
        let job;
        let notification;
        const notifications = options.notifications !== false;
        const total = ids.length;

        const results = {};
        const res = req.res;
        try {
          // sends a response with a jobId to the browser
          job = await self.start(options);

          // Persist the total before work begins so the completed notification
          // and job document always report it, even if processing finishes fast.
          await self.setTotal(job, ids.length);
          // Runs after response is already sent
          run();

          // Trigger the "in progress" notification.
          notification = notifications && await self.triggerNotification(req, 'progress', {
            // It's only relevant to pass a job ID to the notification if
            // the notification will show progress. Without a total number we
            // can't show progress.
            jobId: total && job._id,
            ids,
            action: options.action,
            docTypes: options.docTypes
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
            return await self.end(job, false, undefined, err);
          } catch (err) {
            // Not a lot we can do about this since we already
            // stopped talking to the user
            self.apos.util.error(err);
          }
        }
        async function run() {
          let good = false;
          const promises = [];
          try {
            for (const id of ids) {
              try {
                const result = await change(req, id);
                promises.push(self.success(job));
                results[id] = result;
              } catch (err) {
                promises.push(self.failure(job));
              }
            }
            good = true;
          } finally {
            await self.end(job, good, results);
            // Wait for increments to be updated in DB
            await Promise.allSettled(promises);
            if (notifications) {
              // Trigger the completed notification.
              await self.triggerNotification(req, 'completed', {
                contextId: job._id,
                dismiss: true
              });
              // Dismiss the progress notification. It will delay 4 seconds
              // because "completed" notification will dismiss in 5 and we want
              // to maintain the feeling of process order for users.
              if (notification && notification.noteId) {
                await self.apos.notification.dismiss(req, notification.noteId, 4000);
              }
            }
          }
        }
      },
      // Similar to `runBatch`, this method Starts and supervises a
      // long-running job, however unlike `runBatch` the `doTheWork` function
      // provided is invoked just once, and when it completes the job is over.
      // This is not the way to implement a batch operation on pieces; see the
      // `batchSimple` method of that module.
      //
      // The `doTheWork` function receives `(req, reporting)` and may
      // optionally invoke `reporting.success()` and `reporting.failure()` to
      // update the progress and error counters, and `reporting.setTotal()` to
      // indicate the total number of counts expected so a progress meter can be
      // rendered. This is optional and an indication of progress is still
      // displayed without it.
      //
      // `reporting.setResults(object)` may also be called to pass a
      // results object, which will be available on the finished job document.
      //
      // `reporting.isCanceling()` resolves to `true` once cancellation of
      // the job has been requested (see the cancel route and
      // `requestCancel`) — or when the job document is gone or already
      // marked ended: a record nobody can observe or cancel anymore is a
      // standing instruction to stop, so an expired (`expireAfter`) or
      // externally deleted record winds down its own orphaned run.
      // `doTheWork` may check it at convenient points and wind down
      // early; the job then ends with a `cancelled` status. Jobs that
      // never check it simply run to completion.
      //
      // If `doTheWork` throws, the job ends with a `failed` status and the
      // error is recorded on the job document (see `end`).
      //
      // This method will return an object with a `jobId` identifier as soon as
      // the job is ready to start, and the actual job will continue in the
      // background afterwards. You can pass `jobId` to the `progress` API route
      // of this module as `_id` on the request body to get job status info.
      //
      // Notification messages should be included on a `req.body.messages`
      // object. See `triggerNotification for details`. Pass
      // `notifications: false` in `options` to skip that wiring entirely,
      // e.g. when the caller provides its own progress transport
      // (`req.body` is client-controlled, so callers cannot rely on the
      // absence of `messages`).
      async run(req, doTheWork, options = {}) {
        const res = req.res;
        const notifications = options.notifications !== false;
        let job;
        let total;

        try {
          job = await self.start(options);

          const notification = notifications && await self.triggerNotification(req, 'progress', {
            jobId: job._id,
            ids: options.ids,
            action: options.action,
            docTypes: options.docTypes
          });

          run({ notificationId: notification && notification.noteId });

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
          let error;
          let good = false;
          const promises = [];
          try {
            await doTheWork(req, {
              success (n) {
                n = n || 1;
                const result = self.success(job, n);
                promises.push(result);
                return result;
              },
              failure (n) {
                n = n || 1;
                const result = self.failure(job, n);
                promises.push(result);
                return result;
              },
              setTotal (n) {
                total = n;
                const result = self.setTotal(job, n);
                promises.push(result);
                return result;
              },
              setResults (_results) {
                results = _results;
              },
              async isCanceling () {
                const found = await self.db.findOne({ _id: job._id }, {
                  projection: {
                    cancelRequested: 1,
                    ended: 1
                  }
                });
                return !found || Boolean(found.cancelRequested || found.ended);
              }
            }, info);
            good = true;
          } catch (err) {
            error = err;
            self.apos.util.error(err);
          } finally {
            await self.end(job, good, results, error);
            // Wait for increments to be updated in DB
            await Promise.allSettled(promises);
            if (notifications) {
              // Trigger the completed notification.
              await self.triggerNotification(req, 'completed', {
                contextId: job._id,
                count: total,
                dismiss: true
              }, results);
              // Dismiss the progress notification. It will delay 4 seconds
              // because "completed" notification will dismiss in 5 and we want
              // to maintain the feeling of process order for users.
              if (info.notificationId) {
                await self.apos.notification.dismiss(req, info.notificationId, 4000);
              }
            }
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
        if (!req?.body?.messages?.[stage]) {
          return {};
        }

        const event = req.body.messages.resultsEventName && results
          ? {
            name: req.body.messages.resultsEventName,
            data: { ...results }
          }
          : null;

        const {
          good, bad, processed, total
        } = stage === 'completed' && options.contextId
          ? await self.db.findOne({ _id: options.contextId })
          : {};

        let message = req.body.messages[stage];
        if (stage === 'completed' && req.body.messages.failed && bad > 0 && good === 0) {
          message = req.body.messages.failed;
        } else if (stage === 'completed' && req.body.messages.completedWithFailures && bad > 0 && good > 0) {
          message = req.body.messages.completedWithFailures;
        }

        return self.apos.notification.trigger(req, message, {
          interpolate: {
            bad,
            count: options.count || (req.body._ids && req.body._ids.length),
            good,
            processed,
            total,
            type: req.t(req.body.type) || req.t('apostrophe:document')
          },
          context: {
            _id: options.contextId
          },
          dismiss: options.dismiss,
          job: {
            // NOTE: if options.jobId is present, the notification will be a progress bar
            _id: options.jobId,
            action: options.action,
            ids: options.ids,
            docTypes: options.docTypes
          },
          event,
          classes: options.classes,
          icon: req.body.messages.icon || 'database-export-icon',
          type: options.type || 'success'
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
      //
      // `options` may include:
      //
      // `userId`: the `_id` of the user who owns the job. When present,
      // the status and cancel routes are restricted to that user; jobs
      // without a `userId` remain readable by anyone who can `view-draft`.
      //
      // `expireAfter`: a number of seconds after which the job document
      // is deleted from the database (a TTL index on `expireAt`). The
      // countdown starts now, not at completion, so pick a value
      // comfortably above the longest expected run — this also cleans up
      // orphaned records whose process died before calling `end`. Jobs
      // without `expireAfter` are kept forever, as before.
      async start(options) {
        const now = new Date();
        const job = {
          _id: self.apos.util.generateId(),
          good: 0,
          bad: 0,
          processed: 0,
          status: 'running',
          ended: false,
          cancelRequested: false,
          when: now,
          // same instant as the legacy `when`, which is kept for
          // backwards compatibility; startedAt/endedAt are the pair to use
          startedAt: now,
          ...(options.userId && { userId: options.userId }),
          ...(options.expireAfter && {
            expireAt: new Date(now.getTime() + options.expireAfter * 1000)
          })
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
      async success(job, n) {
        n = n === undefined ? 1 : n;
        try {
          await self.db.updateOne({ _id: job._id }, {
            $inc: {
              good: n,
              processed: n
            }
          });
        } catch (err) {
          self.apos.util.error(err);
        }
      },
      // Call this to report that n items were bad
      // (not successfully processed).
      //
      // If the second argument is completely omitted,
      // the default is 1.
      async failure(job, n) {
        n = n === undefined ? 1 : n;
        try {
          await self.db.updateOne({ _id: job._id }, {
            $inc: {
              bad: n,
              processed: n
            }
          });
        } catch (err) {
          self.apos.util.error(err);
        };
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
      async setTotal(job, total) {
        try {
          await self.db.updateOne({ _id: job._id }, { $set: { total } });
        } catch (err) {
          self.apos.util.error(err);
        }
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
      //
      // A successful end after cancellation was requested is recorded
      // with the `cancelled` status instead of `completed` — a
      // cooperatively cancelled job winds down and ends normally, with
      // any partial results preserved. A failure is always `failed`.
      //
      // If `error` is present it is recorded on the job document:
      // an `Error` instance is reduced to `{ name, message, data? }`
      // (already-serializable payloads are stored as given).
      async end(job, success, results, error) {
        // context object gets an update to avoid a
        // race condition with checkStopped
        job.ended = true;
        // Read-then-update leaves a small window: a cancel request landing
        // between the two ends up `completed` with `cancelRequested: true`,
        // which is acceptable — cancellation is a request that arrived too
        // late. Closing the window would take an aggregation-pipeline
        // update, which not every supported database backend understands;
        // revisit if a stricter guarantee is ever needed.
        const current = await self.db.findOne({ _id: job._id }, {
          projection: { cancelRequested: 1 }
        });
        const status = success
          ? (current && current.cancelRequested ? 'cancelled' : 'completed')
          : 'failed';
        return self.db.updateOne({ _id: job._id }, {
          $set: {
            ended: true,
            endedAt: new Date(),
            status,
            results,
            ...(error !== undefined && { error: serializeError(error) })
          }
        });

        function serializeError(error) {
          if (error instanceof Error) {
            return {
              name: error.name,
              message: error.message,
              ...(error.data !== undefined && { data: error.data })
            };
          }
          return error;
        }
      },
      // Request cancellation of a running job. Sets the `cancelRequested`
      // flag the running process observes via `reporting.isCanceling`,
      // whichever process that is — the flag travels through the
      // database, so it works across processes. Like SIGTERM, this is a
      // request rather than preemption: the job decides when and whether
      // to wind down, and its status flips to `cancelled` only once it
      // actually ends. Unlike SIGTERM there is no default handler — a
      // job that never checks the flag simply runs to completion.
      // Has no effect on jobs that already ended.
      async requestCancel(jobId) {
        return self.db.updateOne({
          _id: jobId,
          ended: false
        }, {
          $set: { cancelRequested: true }
        });
      },
      async ensureCollection() {
        self.db = await self.apos.db.collection(self.options.collectionName);
        // Per-document TTL: `expireAfterSeconds: 0` expires each document
        // at the exact time stored in its `expireAt` field; documents
        // without the field never expire, and `sparse` keeps them out of
        // the index entirely.
        await self.db.createIndex({ expireAt: 1 }, {
          expireAfterSeconds: 0,
          sparse: true
        });
      },
      getBrowserData(req) {
        return {
          action: self.action
        };
      }
    };
  }
};
