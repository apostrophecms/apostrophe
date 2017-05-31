apos.define('apostrophe-notifications', {

  extend: 'apostrophe-context',

  construct: function(self) {
    self.trigger = function(message, options) {
      var options = options || {};
      var $notification;

      if (options.dismiss === true) {
        options.dismiss = 10;
      }

      self.html('notification', { message: message }, function(data) {
        $notification = $($.parseHTML(data));

        if (options.type) {
          $notification.addClass('apos-notification--' + options.type);
        }

        if (options.dismiss) {
          $notification.attr('data-apos-notification-dismiss', options.dismiss);
        }

        self.addToContainer($notification);
      })
    };
    
    self.createContainer = function() {
      $('body').append('<div class="apos-notification-container" data-apos-notification-container></div>');
    };
    
    self.addToContainer = function($notification) {      
      $('[data-apos-notification-container]').append($notification);
    };
  },
  
  afterConstruct: function(self) {
    apos.notify = self.trigger;
    
    self.createContainer();
  }
});
