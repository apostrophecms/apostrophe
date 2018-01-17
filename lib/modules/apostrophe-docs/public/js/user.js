apos.define('apostrophe-docs', {
  beforeConstruct: function(self, options) {
    self.options = options;
    self.action = options.action;
  },
  construct: function(self, options) {
    self.trashInSchema = self.options.trashInSchema;
    self.managers = {};

    self.getManager = function(type) {
      return self.managers[type];
    };

    self.setManager = function(type, manager) {
      self.managers[type] = manager;
    };

    self.locks = {};

    // Obtain a lock on the given doc _id, interacting with the user
    // if necessary to give them the option of shattering another
    // user's lock. Invokes the callback with null on a successful lock,
    // an error otherwise. If `id` is falsy, the callback succeeds
    // immediately, because this indicates a new doc that no one
    // else could know about or have a lock on. The lock is
    // granted to the current html page.

    self.lock = function(_id, callback) {
      if (!_id) {
        return callback(null);
      }
      return $.jsonCall(self.action + '/lock',
        {
          _id: _id
        },
        function(result) {
          if (result.status === 'ok') {
            self.locks[_id] = true;
            return callback(null);
          } else if ((result.status === 'locked') || (result.status === 'locked-by-me')) {
            // TODO use shiny new async confirm modal, as yet unbuilt
            if (!confirm(result.message)) {
              return callback('locked');
            }
            return $.jsonCall(self.action + '/lock',
              {
                force: true,
                _id: _id
              },
              function(result) {
                if (result.status === 'ok') {
                  self.locks[_id] = true;
                  return callback(null);
                } else {
                  return callback(result.status);
                }
              },
              fail
            );
          } else {
            fail();
          }
        },
        fail
      );
      function fail() {
        apos.notify('You were unable to take control of the document.', { type: 'error' });
        return callback('error');
      }
    };

    // Obtain a lock via the lock method, then
    // watch the lock by periodically verifying
    // whether the lock is still held. If the
    // lock is lost the user is notified and
    // the page is reloaded. This method is used
    // by the modal editor for pieces, since they
    // do not otherwise carry out autosave operations
    // that would quickly make the user aware a lock has
    // been seized by someone else.
    //
    // The callback is invoked as soon as
    // the lock method succeeds, and monitoring
    // then proceeds in the background, stopping if unlock()
    // is invoked successfully.

    self.lockAndWatch = function(_id, callback) {
      return self.lock(_id, function(err) {
        // LACK OF RETURN STATEMENT IS INTENTIONAL
        callback(err);
        var interval = setInterval(function() {
          if (!_.has(self.locks, _id)) {
            // We voluntarily unlocked, stop watching
            clearInterval(interval);
            return;
          }
          $.jsonCall(self.action + '/verify-lock', {
            _id: _id
          }, function(result) {
            if (!_.has(self.locks, _id)) {
              // We voluntarily unlocked while the API call was in flight
              clearInterval(interval);
              return;
            }
            if (result.status !== 'ok') {
              alert(result.message);
              $(window).off('beforeunload');
              window.location.reload(true);
            }
          });
        }, 5000);
      });
    };

    // Release a lock on the given doc _id, if any.
    // Callback succeeds (receives `null`) as long as the
    // current HTML page does not have a lock anymore after
    // the call, whether they initially had one or not.
    //
    // If `sync` is true a synchronous call is made.
    // This is normally a bad thing, but it is appropriate
    // in a beforeunload handler.
    //
    // `callback` is optional.

    self.unlock = function(_id, sync, callback) {
      // Stop checking for this lock right away
      // so we don't get false positives for
      // a conflict and refresh the page every time
      // we close a modal and lockAndWatch races with us
      delete self.locks[_id];
      return $.jsonCall(self.action + '/unlock',
        {
          _id: _id
        },
        {
          async: !sync
        },
        function(result) {
          if (result.status === 'ok') {
            return callback && callback(null);
          }
          return callback && callback(result.status);
        },
        function(err) {
          return callback && callback(err);
        }
      );
    };

    apos.docs = self;
  }
});
