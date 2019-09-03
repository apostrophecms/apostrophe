apos.define('apostrophe-notifications', {

  extend: 'apostrophe-context',

  afterConstruct: function(self) {
    apos.notify = self.trigger;

    apos.on('modalStackPop', self.reparentContainer);
    apos.on('modalStackPush', self.reparentContainer);

    self.createContainer();

    self.enable();
  },

  construct: function(self, options) {

    // Call with a message, followed by any interpolated strings which must correspond
    // to %s placeholders in `message` (variable number of arguments), followed by an
    // `options` object if desired.
    //
    // `options.type` styles the notification and may be set to `error`,
    // `warn` or `success`. If not set, a "plain" default style is used.
    //
    // If `options.dismiss` is set to `true`, the message will auto-dismiss after 5 seconds.
    // If it is set to a number of seconds, it will dismiss after that number of seconds.
    // Otherwise it will not dismiss unless clicked.
    //
    // This method is aliased as `apos.notify` for convenience.
    //
    // The message is internationalized by the server, which is why the use of
    // %s placeholders for any inserted titles, etc. is important.

    self.trigger = function(message, options) {

      var strings = [];
      var i = 1;
      var index = 0;
      while (true) {
        index = message.indexOf('%s', index);
        if (index === -1) {
          break;
        }
        // Don't match the same one over and over
        index += 2;
        if ((i >= arguments.length) || ((typeof (arguments[i]) === 'object'))) {
          throw new Error('Bad notification call: number of %s placeholders does not match number of string arguments after message');
        }
        strings.push(arguments[i++]);
      }
      if ((i === (arguments.length - 1)) && (typeof (arguments[i]) === 'object')) {
        options = arguments[i++];
      } else {
        options = {};
      }

      if (i !== arguments.length) {
        throw new Error('Bad notification call: number of %s placeholders does not match number of string arguments after message');
      }

      if (options.dismiss === true) {
        options.dismiss = 5;
      }

      // Send it to the server, which will send it back to us via
      // the same long polling mechanism that allows it to reach
      // other tabs, and allows server-sent notifications to
      // reach us

      self.api('trigger', {
        message: message,
        strings: strings,
        type: options.type,
        dismiss: options.dismiss,
        pulse: options.pulse,
        id: options.id
      }, function() {
        // We sent it, we're good. The server will get back to us
        // and display it quite soon thanks to long polling
      });

    };

    self.enable = function() {
      // wait for apos.user to be testable
      setImmediate(go);
      function go() {
        if (!(apos.user && apos.user._id)) {
          // user styles and js are being used for extra features but
          // there is no actual user, the API will fail
          return;
        }
        self.ids = [];
        poll();
        function poll() {
          self.api('poll-notifications', {
            displayingIds: self.ids
          }, function(data) {
            if (data.status !== 'ok') {
              apos.utils.error(data.status);
              return retryLater();
            }
            _.each(data.notifications, function(notification) {
              self.display(notification);
            });
            self.ids = self.ids.concat(_.pluck(data.notifications, '_id'));
            self.ids = _.uniq(self.ids);
            _.each(data.dismissed, function(id) {
              var $notification = $('[data-apos-notification-id="' + id + '"]');
              self.dismiss($notification, true);
            });
            // Long polling loop continues
            poll();
          }, function(err) {
            apos.utils.error(err);
            return retryLater();
          });
        }
        function retryLater() {
          setTimeout(poll, 5000);
        }
      }
    };

    // Display a notification received from the server.
    // You want `apos.notify`, not this method, unless you are
    // overriding how notifications are displayed.

    self.display = function(notification) {

      var $notification = $($.parseHTML(notification.html));

      if (notification.type) {
        $notification.addClass('apos-notification--' + notification.type);
      }

      if (notification.pulse) {
        $notification.addClass('apos-notification--pulse');
      }

      // This is an id assigned programmatically by the developer, it
      // is separate from the `_id` property assigned by the server.
      if (notification.id) {
        $notification.attr('id', notification.id);
      }

      $notification.attr('data-apos-notification-id', notification._id);

      if (notification.dismiss) {
        $notification.attr('data-apos-notification-dismiss', notification.dismiss);

        setTimeout(function() {
          self.dismiss($notification);
        }, (1000 * notification.dismiss));
      }

      $notification.click(function() {
        self.dismiss($notification);
      });

      self.addToContainer($notification);
    };

    self.createContainer = function() {
      self.$container = $('<div class="apos-notification-container" data-apos-notification-container role="alert"></div>');
      self.$container.hide();
      $('body').append(self.$container);
    };

    self.reparentContainer = function() {
      var $topModal = apos.modalSupport.getTopModalOrBody();
      $topModal.append(self.$container);
    };

    self.addToContainer = function($notification) {
      self.$container.prepend($notification);
      self.$container.show();

      setTimeout(function() {
        $notification.removeClass('apos-notification--hidden');
      }, 100);
    };

    self.dismiss = function($notification, fromServer) {

      var _id = $notification.attr('data-apos-notification-id');
      self.ids = _.filter(self.ids, function(id) {
        return id !== _id;
      });

      if (!fromServer) {
        // We're doing it, so tell the server
        self.api('dismiss', {
          _id: _id
        }, function() {
          // Now the server knows not to send it anymore
        });
      }

      $notification.addClass('apos-notification--hidden');

      setTimeout(function() {
        $notification.remove();
        if (!self.$container.find('[data-apos-notification]').length) {
          self.$container.hide();
        }
      }, 300);
    };
  }

});
