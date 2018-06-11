apos.define('apostrophe-notifications', {

  extend: 'apostrophe-context',

  construct: function(self) {

    // Call with a message, followed by any interpolated strings which must correspond
    // to %s placeholders in `message`, followed by an `options` object if desired.
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

      var $notification;

      if (options.dismiss === true) {
        options.dismiss = 5;
      }

      self.html('notification', { message: message, strings: strings }, function(data) {
        $notification = $($.parseHTML(data));

        if (options.type) {
          $notification.addClass('apos-notification--' + options.type);
        }

        if (options.pulse) {
          $notification.addClass('apos-notification--pulse');
        }

        if (options.id) {
          $notification.attr('id', options.id);
        }

        if (options.dismiss) {
          $notification.attr('data-apos-notification-dismiss', options.dismiss);

          setTimeout(function() {
            self.dismiss($notification);
          }, (1000 * options.dismiss));
        }

        $notification.click(function() {
          self.dismiss($notification);
        });

        self.addToContainer($notification);
      });
    };

    self.createContainer = function() {
      self.$container = $('<div class="apos-notification-container" data-apos-notification-container></div>');
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

    self.dismiss = function($notification) {
      $notification.addClass('apos-notification--hidden');

      setTimeout(function() {
        $notification.remove();
        if (!self.$container.find('[data-apos-notification]').length) {
          self.$container.hide();
        }
      }, 300);
    };
  },

  afterConstruct: function(self) {
    apos.notify = self.trigger;

    apos.on('modalStackPop', self.reparentContainer);
    apos.on('modalStackPush', self.reparentContainer);

    self.createContainer();
  }
});
