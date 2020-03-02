apos.define('apostrophe-docs', {
  afterConstruct: function(self) {
    self.enableFix();
  },
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
    self.watchingLocks = {};

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
            // If the lock belonged to us, we should just seize it, and if that tab is really
            // still open, we'll get a notice there that it happened. This is necessary going
            // forward because we can't reliably unlock on refresh in modern browsers, which
            // restrict or disable synchronous requests at unload time. But if the lock belonged
            // to someone else, ask nicely first
            if (result.status === 'locked') {
              if (!confirm(result.message)) {
                return callback('locked');
              }
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
      if (self.watchingLocks[_id] && self.locks[_id]) {
        // Relocking would be redundant and risk a race condition
        return callback(null);
      }
      return self.lock(_id, function(err) {
        // LACK OF RETURN STATEMENT IS INTENTIONAL
        callback(err);
        if (self.watchingLocks[_id]) {
          // Don't queue up more and more pending calls
          return;
        }
        self.watchingLocks[_id] = true;
        var interval = setInterval(function() {
          if (!_.has(self.locks, _id)) {
            // We voluntarily unlocked, stop watching
            clearInterval(interval);
            return;
          }
          $.jsonCall(self.action + '/verify-lock', {
            _id: _id
          }, function(result) {
            if (self.reloading) {
              // Don't display the alert repeatedly while waiting for the refresh after
              // we lose control
              return;
            }
            if (!_.has(self.locks, _id)) {
              // We voluntarily unlocked while the API call was in flight
              clearInterval(interval);
              self.watchingLocks[_id] = false;
              return;
            }
            if (result.status !== 'ok') {
              self.watchingLocks[_id] = false;
              alert(result.message);
              $(window).off('beforeunload');
              self.reloading = true;
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
          async: !sync
        },
        {
          _id: _id
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

    // Watch for clicks on links with a [data-apos-fix-id], and open
    // the relevant document for editing, displaying the
    // [data-apos-fix-hint] first to explain why the document is being
    // opened and ask the user to confirm. This is designed for use cases
    // such as editing a document that is "camping" on the slug we want to
    // use for another document. The implementation of the hint is currently
    // an alert, but this API allows for us to gracefully upgrade that
    // at any time.
    //
    // The data-apos-fix-id, data-apos-fix-type and data-apos-fix-url
    // attributes should be populated on your link or button.
    // If you know the doc is a piece, not a page, you can skip
    // the url attribute.
    //
    // If data-apos-fix-error is present, the error with the same name
    // is removed from the enclosing fieldset when the link is clicked.

    self.enableFix = function() {
      $('body').on('click', '[data-apos-fix-id]', function() {
        var $el = $(this);
        var hint = $el.attr('data-apos-fix-hint');
        var type = $el.attr('data-apos-fix-type');
        var id = $el.attr('data-apos-fix-id');
        var manager = apos.docs.getManager(type);
        if (!confirm(hint)) {
          return false;
        }
        apos.schemas.removeError($el.closest('[data-name]'), $el.attr('data-apos-fix-error'));
        if (manager && manager.edit) {
          manager.edit(id, { field: 'slug' });
        } else {
          apos.pages.pageSettings({
            page: {
              type: type,
              _id: id
            },
            field: 'slug'
          });
        }
        return false;
      });
    };

    apos.docs = self;
  }
});
