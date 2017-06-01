apos.define('apostrophe-notifications', {

  extend: 'apostrophe-context',

  construct: function(self) {
    self.trigger = function(message, options) {
      var options = options || {};
      var $notification;

      if (options.dismiss === true) {
        options.dismiss = 5;
      }

      self.html('notification', { message: message }, function(data) {
        $notification = $($.parseHTML(data));

        if (options.type) {
          $notification.addClass('apos-notification--' + options.type);
        }

        if (options.dismiss) {
          $notification.attr('data-apos-notification-dismiss', options.dismiss);

          setTimeout(function() {
            self.dismiss($notification);
          }, (1000 * options.dismiss));
        }

        $notification.click(function() {
          self.dismiss($notification);
        })

        self.addToContainer($notification);
      })
    };
    
    self.createContainer = function() {
      $('body').append('<div class="apos-notification-container" data-apos-notification-container></div>');
    };
    
    self.addToContainer = function($notification) {      
      $('[data-apos-notification-container]').append($notification);
    
      setTimeout(function() {
        $notification.removeClass('apos-notification--hidden');
      }, 100);
    };
    
    self.dismiss = function($notification) {
      $notification.addClass('apos-notification--hidden');
      
      setTimeout(function() {
        $notification.css('display', 'none');
      }, 300);
    };
  },
  
  afterConstruct: function(self) {
    apos.notify = self.trigger;
    
    self.createContainer();
  }
});
