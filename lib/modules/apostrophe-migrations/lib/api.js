var async = require('async');
var Promise = require('bluebird');
var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  // Add a migration function to be invoked when the apostrophe-migrations:migrate task is invoked.
  //
  // The function is invoked with a callback. If it returns a promise,
  // the promise is awaited, and the function should not also invoke the callback.
  // However for bc this situation is tolerated.
  //
  // The options argument may be omitted. If options.safe is true, this migration will still be run when the
  // --safe option is passed to the task. ONLY SET THIS OPTION IF THE CALLBACK HAS NO NEGATIVE IMPACT ON A RUNNING,
  // LIVE SITE. But if you can mark a migration safe, do it, because it minimizes downtime when deploying.

  self.add = function(name, fn, options) {
    if (!options) {
      options = {};
    }
    self.migrations.push({ name: name, options: options, callback: fn });
  };

  // Invoke the iterator function once for each doc in the aposDocs collection.
  // If only three arguments are given, `limit` is assumed to be 1 (only one
  // doc may be processed at a time).
  //
  // The iterator is passed a document and a callback. If the iterator
  // returns a promise, it is awaited, and must NOT invoke the callback.
  //
  // This method will never visit the same doc twice in a single call, even if
  // modifications are made.
  //
  // THIS API IS FOR MIGRATION AND TASK USE ONLY AND HAS NO SECURITY
  //
  // This method returns a promise if no callback is supplied.

  self.eachDoc = function(criteria, limit, iterator, callback) {
    if ((typeof limit) === 'function') {
      callback = iterator;
      iterator = limit;
      limit = 1;
    }
    return self.each(self.apos.docs.db, criteria, limit, iterator, callback);
  };

  // Invoke the iterator function once for each document in the given collection.
  // If `limit` is omitted, `limit` is assumed to be 1 (only one
  // doc may be processed at a time).
  //
  // This method will never visit the same document twice in a single call, even if
  // modifications are made.
  //
  // THIS API IS FOR MIGRATION AND TASK USE ONLY AND HAS NO SECURITY.
  //
  // The iterator is passed a document and a callback. If the iterator
  // accepts only one parameter, it is assumed to return a promise,
  // which is awaited in lieu of a callback.
  //
  // If it is determined that node is running in an interactive terminal
  // and will run for enough time, a simple plaintext progress display
  // is shown. If this is not desired, the `progressDisplay` option
  // of this module may be set to `false`.

  self.each = function(collection, criteria, limit, iterator, callback) {
    if ((typeof limit) === 'function') {
      callback = iterator;
      iterator = limit;
      limit = 1;
    }
    if (callback) {
      return body(callback);
    } else {
      return Promise.promisify(body)();
    }

    function body(callback) {

      var ids;
      var skip = 0;
      var batchSize = 200;
      var meter;

      return async.series([
        getIds,
        processIds
      ], complete);

      function complete(err) {
        if (meter) {
          meter.end();
        }
        return callback(err);
      }

      function getIds(callback) {
        var getIdsMeter = self.progressStart({
          getTotal: function(callback) {
            return callback(null, 1);
          }
        });
        getIdsMeter.message('Initializing (fetching ids)');
        return getCursor().project({ _id: 1 }).toArray(function(err, docs) {
          if (!err) {
            getIdsMeter.step();
          }
          getIdsMeter.end();
          if (err) {
            return callback(err);
          }
          ids = _.pluck(docs, '_id');
          meter = self.progressStart({
            getTotal: function(callback) {
              return callback(null, ids.length);
            }
          });
          return callback(null);
        });
      }

      // Recursively processes batches of ids, to avoid using up
      // too much RAM while still having reasonable parallel
      // performance. We used to use the broadband module but keeping
      // a cursor alive too long leads to unpredictable outcomes.
      function processIds(callback) {
        if (skip >= ids.length) {
          return callback(null);
        }
        return collection.find({
          _id: {
            $in: ids.slice(skip, skip + batchSize)
          }
        }).sort({ _id: 1 }).toArray(function(err, docs) {
          if (err) {
            return callback(err);
          }
          return async.eachLimit(docs, limit, function(doc, callback) {
            return doOne(doc, function(err) {
              if (err) {
                return callback(err);
              }
              meter.step();
              return callback(null);
            });
          }, function(err) {
            if (err) {
              return callback(err);
            }
            skip += batchSize;
            return processIds(callback);
          });
        });

        function doOne(doc, callback) {
          if (iterator.length === 1) {
            return Promise.try(function() {
              return iterator(doc);
            }).then(function() {
              // Shaddap: http://bluebirdjs.com/docs/warning-explanations.html#warning-a-promise-was-created-in-a-handler-but-was-not-returned-from-it
              callback(null);
              return null;
            }).catch(function(err) {
              return callback(err);
            });
          } else {
            return iterator(doc, callback);
          }
        }
      }

      function getCursor() {
        // Sort by _id. This ensures that no document is
        // ever visited twice, even if we modify documents as
        // we go along.
        //
        // Otherwise there can be unexpected results from find()
        // in typical migrations as the changes we make can
        // affect the remainder of the query.
        //
        // https://groups.google.com/forum/#!topic/mongodb-user/AFC1ia7MHzk
        return collection.find(criteria).sort({ _id: 1 });
      }
    }
  };

  // Start CLI progress meter. Takes an `options` object which must
  // have a `getTotal` callback function that obtains the
  // total number of steps from you. If that function returns a promise,
  // its value is awaited, otherwise it must invoke its callback with
  // `(null, total)`. This function only gets called if a progress meter
  // will actually be displayed. We do it this way to avoid wasting time
  // calculating totals in contexts where the progress meter would be
  // nested or there is no TTY to display it on.
  //
  // Returns a meter object with `message`, `step` and `end`
  // methods. `message` displays a message, `step` takes an
  // optional number of steps to update the progress meter (defaults to 1),
  // and `end` terminates the progress meter. You must call `end`.
  //
  // If there is no TTY (such as in a pipeline deployment script),
  // the progress meter object displays nothing. If you create a
  // meter while another meter is already active, the nested progress meter
  // object displays nothing.
  //
  // If the operation takes less than a second to complete the
  // progress meter is never shown and `getTotal` is never invoked.
  // If you have messages that should ALWAYS be output, output
  // them yourself.

  self.progressStart = function(options) {
    var getTotal = options.getTotal;
    self.progressDepth = self.progressDepth || 0;
    self.progressDepth++;
    if ((!self.progressAppropriate()) || (self.progressDepth > 1)) {
      return {
        message: function(m) {},
        step: function(s) {},
        end: function() {
          self.progressDepth--;
        }
      };
    }

    var meter = {

      startTime: Date.now(),
      steps: 0,
      messages: [],
      active: false,
      ticks: 0,

      // No display or overhead to calculate the total
      // needed at all if it runs for less than 1 second

      start: setTimeout(function() {
        meter.displayNeeded();
      }, 1000),

      displayNeeded: function() {

        if (meter.ended) {
          return;
        }

        // getTotal can take a callback or return a promise
        meter.displayMessages();
        meter.requestedTotal = true;

        var promise = getTotal(function(err, total) {
          // Callback case
          if (err) {
            // eslint-disable-next-line no-console
            console.error(err);
            return;
          }
          gotTotal(total);
        });

        // Promise case
        if (promise && promise.then) {
          return promise.then(function(total) {
            gotTotal(total);
            // Quiet bluebird down
            return null;
          }).catch(function(e) {
            // eslint-disable-next-line no-console
            console.error(e);
          });
        }

        // Start displaying an indication of progress right away
        // while we wait to compute total
        meter.active = true;
        meter.displayMessages();
        meter.display();
        // Output at 200ms intervals
        meter.interval = setInterval(meter.display, 200);

        function gotTotal(total) {
          if (meter.ended) {
            return;
          }
          meter.total = total;
          meter.start = null;
          if (meter.endPending) {
            meter.displayMessages();
            return meter.end();
          }
        }
      },

      message: function(s) {
        meter.messages.push(s);
        if (meter.active) {
          meter.displayMessages();
        }
      },

      displayMessages: function() {
        _.each(meter.messages, function(message) {
          // eslint-disable-next-line no-console
          console.error(message);
        });
        meter.messages = [];
      },

      step: function(s) {
        if (s === undefined) {
          s = 1;
        }
        meter.steps += s;
      },

      end: function() {
        self.progressDepth--;
        if (meter.total === undefined) {
          if (!meter.requestedTotal) {
            meter.ended = true;
            return;
          }
          // Currently waiting for the total,
          // let a final display happen after
          // that completes
          meter.endPending = true;
          return;
        }
        meter.display();
        clearInterval(meter.interval);
      },

      display: function() {
        meter.ticks++;
        process.stderr.cursorTo(0);
        if (!meter.total) {
          process.stderr.write(meter.steps + ' of [calculating...] ' + meter.per());
        } else {
          process.stderr.write(meter.bar() + ' ' + meter.portion() + ' ' + meter.percentage() + ' ETA: ' + meter.eta() + ' ' + meter.per());
        }
        process.stderr.clearLine(1);
      },

      bar: function() {
        var s = '[';
        var units = Math.floor(meter.steps / meter.total * 20);
        // Do not throw errors if the step count exceeds the total
        units = Math.min(units, 20);
        var whirly = (units < 20) ? '\\|/-'.charAt(meter.ticks % 4) : '';
        s += '#'.repeat(units) + whirly + ' '.repeat(20 - units);
        s += ']';
        return s;
      },

      portion: function() {
        return meter.steps + ' of ' + meter.total;
      },

      percentage: function() {
        return '(' + (Math.ceil(meter.steps / meter.total * 10000) / 100).toFixed(2) + '%)';
      },

      eta: function() {
        if (!meter.steps) {
          return '[calculating...]';
        }
        var elapsed = Date.now() - meter.startTime;
        var totalTime = (elapsed / meter.steps) * meter.total;
        var eta = totalTime - elapsed;
        eta = Math.floor(eta / 1000);
        var s = eta % 60;
        var m = Math.floor(eta / 60) % 60;
        var h = Math.floor(eta / (60 * 60)) % 60;
        var d = Math.floor(eta / (60 * 60 * 24));
        if (d >= 1) {
          return d + 'd' + pad(h) + 'h';
        }
        if (h >= 1) {
          return h + 'h' + pad(m) + 'm';
        }
        if (m >= 1) {
          return m + 'm' + pad(s) + 's';
        }
        return s + 's';

        function pad(n) {
          if (n < 10) {
            return '0' + n;
          } else {
            return n;
          }
        }
      },

      per: function() {
        var per = meter.steps / (Date.now() - meter.startTime);
        per *= 1000;
        if (per >= 1.0) {
          return format(per) + '/sec';
        }
        per *= 60;
        if (per >= 1.0) {
          return format(per) + '/min';
        }
        per *= 60;
        if (per >= 1.0) {
          return format(per) + '/hr';
        }
        per *= 24;
        return format(per) + '/day';

        function format(per) {
          if (per > 9) {
            return Math.round(per);
          }
          return per.toFixed(2);
        }
      }
    };

    return meter;

  };

  self.progressAppropriate = function() {
    return process.stdout.isTTY && (self.options.progressDisplay !== false);
  };

  // Invoke the iterator function once for each area in each doc in
  // the aposDocs collection. The `iterator` function receives
  // `(doc, area, dotPath, callback)`. `criteria` may be used to limit
  // the docs for which this is done.
  //
  // If only three arguments are given, `limit` is assumed to be 1 (only one
  // doc may be processed at a time).
  //
  // This method will never visit the same doc twice in a single call, even if
  // modifications are made.
  //
  // If `callback` is omitted, a promise is returned.
  //
  // If the iterator accepts only four parameters, it is assumed to
  // return a promise. The promise is awaited, and the
  // iterator must NOT invoke its callback.
  //
  // THIS API IS FOR MIGRATION AND TASK USE ONLY AND HAS NO SECURITY.
  //
  // YOUR ITERATOR MUST BE ASYNCHRONOUS.

  self.eachArea = function(criteria, limit, iterator, callback) {
    if ((typeof limit) === 'function') {
      callback = iterator;
      iterator = limit;
      limit = 1;
    }
    if (callback) {
      return body(callback);
    } else {
      return Promise.promisify(body)();
    }
    function body(callback) {
      return self.eachDoc(criteria, limit, function(doc, callback) {
        var areaInfos = [];
        self.apos.areas.walk(doc, function(area, dotPath) {
          areaInfos.push({ area: area, dotPath: dotPath });
        });
        return async.eachSeries(areaInfos, function(areaInfo, callback) {
          if (iterator.length === 3) {
            return Promise.try(function() {
              return iterator(doc, areaInfo.area, areaInfo.dotPath);
            }).then(function() {
              return callback(null);
            }).catch(callback);
          }
          return iterator(doc, areaInfo.area, areaInfo.dotPath, callback);
        }, function(err) {
          if (err) {
            return callback(err);
          }
          // Prevent stack crash when a lot of docs have no areas to iterate
          return setImmediate(callback);
        });
      }, callback);
    }
  };

  // Invoke the iterator function once for each widget in each area in each doc
  // in the aposDocs collection.
  //
  // If only three arguments are given, `limit` is assumed to be 1 (only one
  // doc may be processed at a time).
  //
  // The `iterator` function receives `(doc, widget, dotPath, callback)`.
  // `criteria` may be used to limit
  // the docs for which this is done. If the iterator accepts exactly
  // three arguments, it is assumed to return a promise, and the iterator
  // must NOT invoke the callback.
  //
  // This method will never visit the same doc twice in a single call, even if
  // modifications are made.
  //
  // Widget loaders are NOT called.
  //
  // If `callback` is omitted, a promise is returned.
  //
  // THIS API IS FOR MIGRATION AND TASK USE ONLY AND HAS NO SECURITY.
  //
  // YOUR ITERATOR MUST BE ASYNCHRONOUS.

  self.eachWidget = function(criteria, limit, iterator, callback) {
    if ((typeof limit) === 'function') {
      callback = iterator;
      iterator = limit;
      limit = 1;
    }
    if (callback) {
      return body(callback);
    } else {
      return Promise.promisify(body)();
    }
    function body(callback) {
      return self.eachArea(criteria, limit, function(doc, area, dotPath, callback) {
        var i = 0;
        return async.eachSeries(area.items || [], function(item, callback) {
          var n = i;
          i++;
          if (iterator.length === 3) {
            return Promise.try(function() {
              return iterator(doc, item, dotPath + '.items.' + n);
            }).then(function() {
              // https://github.com/petkaantonov/bluebird/blob/master/docs/docs/warning-explanations.md#warning-a-promise-was-created-in-a-handler-but-was-not-returned-from-it
              callback(null);
              return null;
            }).catch(callback);
          } else {
            return iterator(doc, item, dotPath + '.items.' + n, callback);
          }
        }, callback);
      }, callback);
    }
  };

  // Most of the time, this is called automatically for you. Any
  // doc type schema field marked with `sortify: true` automatically
  // gets a migration implemented via this method. Don't forget
  // to run the `apostrophe-migration:migrate` task.
  //
  // Adds a migration that takes the given field, such as `lastName`, and
  // creates a parallel `lastNameSortified` field, formatted with
  // `apos.utils.sortify` so that it sorts and compares in a more
  // intuitive, case-insensitive way.
  //
  // The migration applies only to documents that match `criteria`.
  //
  // After adding such a migration, you can add `sortify: true` to the
  // schema field declaration for `field`, and any calls to
  // the `sort()` cursor filter for `lastName` will automatically
  // use `lastNameSortified`. You can also do that explicitly of course.
  //
  // Note that you want to do both things (add the migration, and
  // add `sortify: true`) because `sortify: true` guarantees that
  // `lastNameSortified` gets updated on all saves of the doc.
  //
  // `migrationNamePrefix` just helps uniquely identify this
  // migration, since different modules might contribute migrations
  // for fields of the same name.

  self.addSortify = function(migrationNamePrefix, criteria, field) {
    self.add(migrationNamePrefix + ':' + field + '-sortified', function(callback) {
      var clauses = [];
      var clause = {};
      clause[field + 'Sortified'] = { $exists: 0 };
      clauses.push(clause);
      clauses.push(criteria);
      return self.eachDoc({
        $and: clauses
      }, 5, function(doc, callback) {
        var $set = {};
        $set[field + 'Sortified'] = self.apos.utils.sortify(doc[field]);
        return self.apos.docs.db.update({
          _id: doc._id
        }, {
          $set: $set
        },
        callback);
      }, callback);
    });
  };

};
