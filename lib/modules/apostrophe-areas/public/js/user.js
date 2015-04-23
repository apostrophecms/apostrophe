apos.define('apostrophe-areas', {

  afterConstruct: function(self) {
    self.enableSingletons();
    self.enableAreas();
  },

  construct: function(self, options) {

    self.enableSingletons = function() {
      $('body').on('click', '[data-edit-singleton]', function() {
        var $singleton = $(this).closest('[data-singleton]');
        var options = JSON.parse($singleton.attr('data-options'));
        var docId = $singleton.attr('data-doc-id');
        var dotPath = $singleton.attr('data-dot-path');
        var $widget = $singleton.find('[data-widget]:first');
        var options = JSON.parse($singleton.attr('data-options') || {});
        var data = {};

        if ($widget.length) {
          data = self.getWidgetData($widget);
        }

        self.getWidgetManager(options.type).edit(
          data,
          options,
          function(data, callback) {
            return self.saveSingleton($singleton, docId, dotPath, data, options, callback);
          }
        );

        return false;

      });
    };

    self.saveSingleton = function($singleton, docId, dotPath, data, options, callback) {
      if (docId) {
        return self.saveSingletonDirectly($singleton, docId, dotPath, data, options, callback);
      } else {
        // Virtual singletons must be saved in other ways. Add it as a
        // data attribute of the singleton, and post an event
        $singleton.attr('data-item', JSON.stringify(data));
        apos.emit('singletonEdited', $singleton, data);
        return callback();
      }
    };

    self.saveSingletonDirectly = function($singleton, docId, dotPath, data, options, callback) {
      // Has a docId, save it
      $.jsonCall(self.options.action + '/save-singleton',
        {
          dataType: 'html',
        },
        {
          docId: docId,
          dotPath: dotPath,
          options: options,
          data: data
        },
        function(markup) {
          var $wrapper = $singleton.find('[data-widget-wrapper]');
          $wrapper.html('');
          $wrapper.append(markup);
          apos.emit('enhance', $wrapper);
          return callback(null);
        },
        function() {
          alert(self.options.messages.tryAgain);
          return callback('error');
        }
      );
    };

    self.enableAreas = function() {
      var editorsOptions = {
        action: self.options.action
      };
      apos.create("apostrophe-area-editors", editorsOptions);
    };

  }
});
