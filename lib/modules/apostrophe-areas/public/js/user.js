apos.define('apostrophe-areas', {

  afterConstruct: function(self) {
    return async.series({
      getTemplates: function(callback) {
        return self.getTemplates(callback);
      }
    }, function(err) {
      self.enableCkeditor();
      self.enableOnEnhance();
      self.enableShift();
      self.enhanceAddContent();
      self.enhanceControlsHover();
      // the enhance event already happened while
      // we were waiting for our templates, so call
      // this ourselves
      self.enableAll();
    });
  },

  construct: function(self, options) {

    // When a `[data-apos-add-content]` button is clicked, toggle the `apos-active` class
    // on the closest ancestor with `[data-apos-dropdown]`, and also the closest
    // ancestor with `.apos-area-controls`.
    self.enhanceAddContent = function() {
      var $body = $('body');
      $body.on('click', '[data-apos-add-content]', function(e) {
        $(this).closest('[data-apos-dropdown]').toggleClass('apos-active');
        $(this).closest('.apos-area-controls').toggleClass('apos-active');
      });
    }

    // Handles the hovering of widgets in the specified selector or jQuery object
    // and reveals only the controls on the directly hovered widget, not the parent wrapper widget
    self.enhanceControlsHover = function(sel) {

      $(sel).find('[data-apos-widget]').addBack('[data-apos-widget]').each(function() {
        var $widget = $(this);
        mouseoverEnhance($widget);
        mouseleaveEnhance($widget);
      });

      function mouseoverEnhance($el) {
        $el.on('mouseover', function(e) {
          var $self = $(this);
          e.stopPropagation();
          $('.apos-area-widget-controls').removeClass('apos-peek');
          $self.find('[data-apos-widget-controls]:first .apos-area-widget-controls').addClass('apos-peek');
          $self.next().children().addClass('apos-peek');
        });
      };

      function mouseleaveEnhance($el) {
        $el.on('mouseleave', function(e) {
          var $self = $(this);
          $self.find('[data-apos-widget-controls]:first .apos-area-widget-controls').removeClass('apos-peek');
          $self.next().children().removeClass('apos-peek');
        });
      }

    };

    // The area editor has a number of DOM templates that
    // it clones as needed. We don't push DOM templates with
    // every page anymore, so fetch them and append them
    // to the DOM now. This is pretty much the only place
    // we still use this technique heavily.

    self.editors = {};

    self.getTemplates = function(callback) {
      $.post(self.options.action + '/editor',
        function(markup) {
          $('body').append(markup);
          return setImmediate(callback);
        }
      );
    };

    self.fromTemplate = function(sel) {
      return $('[data-apos-area-editor-templates]').find(sel).clone();
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

    // Enable the areas in the specified selector or jQuery object to be edited.
    // If sel is falsy all areas currently in the body are made editable

    self.enableAll = function(sel) {
      if (!sel) {
        sel = 'body';
      }
      $(sel).find('[data-apos-area-edit]').each(function() {
        var $el = $(this);
        if ($el.attr('data-initialized')) {
          return;
        }
        var areaId = $el.attr('data-doc-id') + $el.attr('data-dot-path');
        if (_.has(self.editors, areaId)) {
          // If there is already an existing editor for this area, use that.
          self.editors[areaId].resetEl($el);
        } else {
          apos.create('apostrophe-areas-editor', { $el: $el, action: self.options.action });
        }
      });
      self.enhanceControlsHover(sel);
    };

    self.register = function(docId, dotPath, editor) {
      self.editors[docId + dotPath] = editor;
    };

    self.enableShift = function() {

      // listen for shiftActive for power up/down nudge
      apos.on('shiftDown', function() {
        $('[data-apos-move-item]').each(function() {
          $self = $(this);
          if ($self.attr('data-apos-move-item') === 'up') {
            $self.children('i').toggleClass('icon-double-angle-up');
            $self.attr('data-apos-move-item', 'top');
          } else if ($self.attr('data-apos-move-item') === 'down') {
            $self.children('i').toggleClass('icon-double-angle-down');
            $self.attr('data-apos-move-item', 'bottom');
          }
        });
      });

      apos.on('shiftUp', function() {
        $('[data-apos-move-item]').each(function() {
          $self = $(this);
          $self.children('i').removeClass('icon-double-angle-up');
          $self.children('i').removeClass('icon-double-angle-down');
          if ($self.attr('data-apos-move-item') === 'top') {
            $self.attr('data-apos-move-item', 'up');
          } else if ($self.attr('data-apos-move-item') === 'bottom') {
            $self.attr('data-apos-move-item', 'down');
          }
        });
      });
    };

    // Helper functions for getting widget data and options that don't depend
    // on the context of a specific area editor

    // Get the options that apply to the widget in its current context
    self.getWidgetOptions = function($widget) {
      var $area = $widget.closest('[data-apos-area]');
      var options = {};
      var areaOptions = self.getAreaOptions($area);
      var type = $widget.attr('data-apos-widget');
      if (areaOptions && areaOptions.widgets) {
        $.extend(true, options, areaOptions.widgets[type] || {});
      }
      return options;
    };

    self.getAreaOptions = function($area) {
      // TODO: this could be a lot of parsing done over and over
      return JSON.parse($area.attr('data-options') || '{}');
    };

    self.getWidgetData = function($widget) {
      var type = $widget.attr('data-apos-widget');
      var manager = self.getWidgetManager(type);
      if (!manager) {
        apos.log('WARNING: no manager for widget type ' + type);
        return;
      }
      return manager.getData($widget);
    };

    self.setWidgetData = function($widget, data) {
      var type = $widget.attr('data-apos-widget');
      var manager = self.getWidgetManager(type);
      if (!manager) {
        apos.log('WARNING: no manager for widget type ' + type);
        return;
      }
      return manager.setData($widget, data);
    };

  }
});
