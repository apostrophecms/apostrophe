apos.define('apostrophe-areas', {

  afterConstruct: function(self) {
    return async.series({
      getTemplates: function(callback) {
        return self.getTemplates(callback);
      }
    }, function(err) {
      self.enableSingletons();
      self.enableCkeditor();
      self.enableOnEnhance();
      self.enableShift();
      // the enhance event already happened while
      // we were waiting for our templates, so call
      // this ourselves
      self.enableAll();
    });
  },

  construct: function(self, options) {

    self.enableSingletons = function() {

      $('body').on('click', '[data-edit-singleton]', function() {
        var $singleton = $(this).closest('[data-singleton]');
        self.editSingleton($singleton);
        return false;
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
        // modal editing experience
        manager.edit(
          data,
          options,
          function(data, callback) {
            return self.saveSingleton($singleton, docId, dotPath, data, options, callback);
          }
        );
      } else {
        // If the widget is contextually edited, it must
        // exist. Create it and populate its data attributes
        if (!$widget.length) {
          $widget = apos.areas.fromTemplate('.apos-rich-text-item');
          $widget.attr('data-options', JSON.stringify(options));
          $widget.attr('data', JSON.stringify({ type: options.type }));
          $singleton.append($widget);
        }
        // TODO handle click off
        var lastJson = JSON.stringify(data);
        manager.startEditing($widget);
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
        var data = manager.getData($widget);
        var json = JSON.stringify(data);
        if (json !== lastJson) {
          lastJson = json;
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

    // The area editor has a number of DOM templates that
    // it clones as needed. We don't push DOM templates with
    // every page anymore, so fetch them and append them
    // to the DOM now. This is pretty much the only place
    // we still use this technique heavily.

    self.getTemplates = function(callback) {
      $.post(self.options.action + '/editor',
        function(markup) {
          $('body').append(markup);
          return setImmediate(callback);
        }
      );
    };

    self.fromTemplate = function(sel) {
      return $('[data-area-editor-templates]').find(sel).clone();
    };

    self.enableCkeditor = function() {

      // Automatic inline use of ckeditor is not suitable as it can't handle AJAX,
      // making it unsuitable for our uses, and it interferes with explicit
      // ckeditor instantiation, the only workaround for the AJAX problem.
      //
      // So we have to globally shut this off if we are active at all. If you wish
      // to make direct use of ckeditor you must do it explicitly with
      // CKEDITOR.inline(id) like we do. Hey, it's not our fault.

      CKEDITOR.disableAutoInline = true;

      // This clears the auto-populated Title attribute CKEditor puts on stuff, makes for ugly tooltips

      CKEDITOR.on('instanceReady',function(event){
        $(event.editor.element.$).attr('title', '');
      });

      CKEDITOR.plugins.addExternal('split', apos.prefix + self.options.action + '/js/ckeditorPlugins/split/', 'plugin.js');

      // This particular plugin has proven difficult for our users and therefore,
      // we're removing it for now. --Joel (joel@punkave.com)
      CKEDITOR.config.removePlugins = 'magicline';
    };

    self.enableOnEnhance = function() {
      apos.on('enhance', function($context) {
        self.enableAll($context);
      });
    };

    self.enableAll = function(sel) {
      if (!sel) {
        sel = 'body';
      }
      $(sel).find('[data-area]').each(function() {
        var $el = $(this);
        if ($el.attr('data-initialized')) {
          return;
        }
        var instance = apos.create('apostrophe-area-editor', { $el: $el, action: self.options.action });
      });
    };

    self.enableShift = function() {

      // listen for shiftActive for power up/down nudge
      apos.on('shiftDown', function() {
        $('[data-move-item]').each(function() {
          $self = $(this);
          if ($self.attr('data-move-item') === 'up') {
            $self.children('i').toggleClass('icon-double-angle-up');
            $self.attr('data-move-item', 'top');
          } else if ($self.attr('data-move-item') === 'down') {
            $self.children('i').toggleClass('icon-double-angle-down');
            $self.attr('data-move-item', 'bottom');
          }
        });
      });

      apos.on('shiftUp', function() {
        $('[data-move-item]').each(function() {
          $self = $(this);
          $self.children('i').removeClass('icon-double-angle-up');
          $self.children('i').removeClass('icon-double-angle-down');
          if ($self.attr('data-move-item') === 'top') {
            $self.attr('data-move-item', 'up');
          } else if ($self.attr('data-move-item') === 'bottom') {
            $self.attr('data-move-item', 'down');
          }
        });
      });
    };
  }
});
