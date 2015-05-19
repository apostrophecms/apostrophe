apos.define('apostrophe-areas', {

  afterConstruct: function(self) {
    self.enableSingletons();
    self.enableAreas();
  },

  construct: function(self, options) {

    self.enableSingletons = function() {

      $('body').on('click', '[data-edit-singleton]', function() {
        var $singleton = $(this).closest('[data-singleton]');
        self.editSingleton($singleton);
      });

      // When the editor actually starts, whether via the
      // "edit singleton" button or via a click on the text,
      // start monitoring and saving it

      $('body').on('aposRichTextStarting', '[data-singleton]', function() {
        var $singleton = $(this);
        self.monitorAndSaveSingleton($singleton);
        return false;
      });

    };

    self.editSingleton = function($singleton) {
      var options = JSON.parse($singleton.attr('data-options'));
      var docId = $singleton.attr('data-doc-id');
      var dotPath = $singleton.attr('data-dot-path');
      var $widget = $singleton.find('[data-widget]:first');
      var options = JSON.parse($singleton.attr('data-options') || {});
      var data = {};

      if ($widget.length) {
        data = self.getWidgetData($widget);
      }

      var manager = self.getWidgetManager(options.type);
      if (manager.edit) {
        apos.log('modal experience');
        // modal editing experience
        manager.edit(
          data,
          options,
          function(data, callback) {
            return self.saveSingleton($singleton, docId, dotPath, data, options, callback);
          }
        );
      } else {
        // TODO handle click off
        $widget.data('editing-singleton');
        var lastJson = JSON.stringify(data);
        apos.log('calling startEditing');
        manager.startEditing($widget, data, options);
      }
    };

    self.monitorAndSaveSingleton = function($singleton) {
      var options = JSON.parse($singleton.attr('data-options'));
      var docId = $singleton.attr('data-doc-id');
      var dotPath = $singleton.attr('data-dot-path');
      var $widget = $singleton.find('[data-widget]:first');
      var options = JSON.parse($singleton.attr('data-options') || {});
      var data = {};

      if ($widget.length) {
        data = self.getWidgetData($widget);
      }
      var manager = self.getWidgetManager(options.type);

      // TODO handle click off
      $widget.data('editing-singleton');
      var lastJson = JSON.stringify(data);
      function pass() {
        apos.log('making pass');
        var data = manager.getData($widget);
        apos.log(data);
        var json = JSON.stringify(data);
        if (json !== lastJson) {
          lastJson = json;
          apos.log('calling saveSingleton');
          return self.saveSingleton($singleton, docId, dotPath, data, options, schedule);
        } else {
          schedule();
        }
      }
      function schedule() {
        setTimeout(pass, 5000);
      }
      schedule();
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

      var manager = self.getWidgetManager(options.type);

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

          // For a singleton edited by a modal, we need
          // to display the rendered normal view now.
          // For a singleton edited continuously that would
          // just disrupt the WYSIWYG editor already
          // operating.

          if (manager.edit) {
            var $wrapper = $singleton.find('[data-widget-wrapper]');
            $wrapper.html('');
            $wrapper.append(markup);
            apos.emit('enhance', $wrapper);
          }

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
