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
            return callback(null);
          } else if (result.status === 'locked') {
            // TODO use shiny new async confirm modal, as yet unbuilt
            if (!confirm(result.username + ' is editing this document. They made their last change ' + result.ago + ' minutes ago. If you take control, they may lose work. Do you want to take control?')) {
              return callback('locked');
            }
            return self.api(self.action + '/lock',
              {
                force: true,
                _id: _id
              },
              function(result) {
                if (result.status === 'ok') {
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
      return $.jsonCall(self.action + '/',
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
