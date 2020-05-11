apos.define('apostrophe-areas', {

  afterConstruct: function(self) {
    return async.series({
      getTemplates: function(callback) {
        return self.getTemplates(callback);
      }
    }, function(err) {
      if (err) {
        // Cannot continue
        apos.utils.error(err);
        return;
      }
      self.enableCkeditor();
      self.enableOnEnhance();
      self.enableShift();
      self.enhanceAddContent();
      self.enhanceControlsHover();
      self.enableUnload();
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
        var $area = $(this).closest('.apos-area');
        var $dropdown = $(this).closest('[data-apos-dropdown]');
        if ($dropdown.hasClass('apos-active')) {
          // Call this consistently in all places we dismiss the menu
          $area.data('editor').dismissContextContentMenu();
        } else {
          $(this).closest('[data-apos-dropdown]').addClass('apos-active');
          $(this).closest('.apos-area-controls').addClass('apos-active');
          $(this).closest('.apos-area').addClass('apos-content-menu-active');
          // Prevent slapfights with the workflow controls while
          // an add content menu is active, we have UX problems (and
          // don't pass our tests) on smaller screens otherwise. -Tom
          $('.apos-context-menu-container').addClass('apos-content-menu-active');
          $area.data('editor').disableAreaControls();
          $body.one('click', $area.data('editor').dismissContextContentMenu);
          $(window).keyup($area.data('editor').dismissContextContentMenuKeyEvent);
        }
      });
    };

    // Handles the hovering of widgets in the specified selector or jQuery object
    // and reveals only the controls on the directly hovered widget, not the parent wrapper widget
    self.enhanceControlsHover = function(sel) {
      $(sel).find('[data-apos-widget]').addBack('[data-apos-widget]').each(function() {
        var $widget = $(this);
        $widget.on('mouseenter', '[data-apos-tooltip]', apos.ui.createTooltip);
        $widget.on('mouseleave click', '[data-apos-tooltip]', apos.ui.removeTooltip);
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
        $el.on('mouseout', function(e) {
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

      CKEDITOR.on('instanceReady', function(event) {
        $(event.editor.element.$).attr('title', '');
      });

      CKEDITOR.plugins.addExternal('split', apos.prefix + self.options.action + '/js/ckeditorPlugins/split/', 'plugin.js');

      // NOTE: This particular plugin has proven difficult for our users and
      // therefore, we're removing it for now. --Joel
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
        var areaId = $el.attr('data-doc-id') + '.' + $el.attr('data-dot-path');
        if (_.has(self.editors, areaId)) {
          // If there is already an existing editor for this area, use that.
          // Without this, inserting an image piece as part of editing a
          // widget will destroy our ability to accept the widget's new
          // value and save the area.
          self.editors[areaId].resetEl($el);
        } else {
          apos.create('apostrophe-areas-editor', { $el: $el, action: self.options.action });
        }
      });
      self.enhanceControlsHover(sel);
    };

    self.register = function(docId, dotPath, editor) {
      self.editors[docId + '.' + dotPath] = editor;
    };

    self.remapDotPaths = function() {
      $('body').find('[data-apos-area]').each(function() {
        var $area = $(this);
        var docId = $area.attr('data-doc-id');
        if (!docId) {
          return;
        }
        if ($area.parents('[data-doc-id="' + docId + '"]').length) {
          return;
        }
        self.recalculateDotPathsInArea($area);
      });
      self.editors = {};
      $('body').find('[data-apos-area]').each(function() {
        var $area = $(this);
        var docId = $area.attr('data-doc-id');
        var dotPath = $area.attr('data-dot-path');
        if (!(docId && dotPath)) {
          return;
        }
        if (!$area.data('editor')) {
          return;
        }
        self.register(docId, dotPath, $area.data('editor'));
      });
    };

    self.recalculateDotPathsInArea = function($area) {
      var docId = $area.attr('data-doc-id');
      var dotPath = $area.attr('data-dot-path');
      var $widgets = $area.findSafe('[data-apos-widget]', '[data-apos-area]');
      var ordinal = 0;
      $widgets.each(function() {
        var widgetDotPath = dotPath + '.items.' + ordinal;
        try {
          var $widget = $(this);
          var data = JSON.parse($widget.attr('data') || '{}');
          data.__docId = docId;
          data.__dotPath = widgetDotPath;
          $widget.attr('data', JSON.stringify(data));
          self.recalculateDotPathsOfAreasInWidget($widget, docId, widgetDotPath);
        } catch (e) {
          // Do not fail outright if a widget has an unusual storage mode
          apos.utils.warn(e);
        }
        ordinal++;
      });
    };

    self.recalculateDotPathsOfAreasInWidget = function($widget, docId, dotPath) {
      var $areas = $widget.findSafe('[data-apos-area]', '[data-apos-widget]');
      $areas.each(function() {
        var $area = $(this);
        var areaDocId = $area.attr('data-doc-id');
        if ((areaDocId !== docId) && areaDocId && (areaDocId.substring(0, 1) === 'w')) {
          $area.attr('data-doc-id', docId);
          areaDocId = docId;
        }
        if (areaDocId === docId) {
          var areaDotPath = $area.attr('data-dot-path');
          if (areaDotPath) {
            var components = areaDotPath.split('.');
            var name = components.pop();
            $area.attr('data-dot-path', dotPath + '.' + name);
            self.recalculateDotPathsInArea($area);
          }
        }
      });
    };

    self.enableShift = function() {

      // listen for shiftActive for power up/down nudge
      apos.on('shiftDown', function() {
        $('[data-apos-move-item]').each(function() {
          var $self = $(this);
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
          var $self = $(this);
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
        apos.utils.warn('WARNING: no manager for widget type ' + type);
        return;
      }
      return manager.getData($widget);
    };

    self.setWidgetData = function($widget, data) {
      var type = $widget.attr('data-apos-widget');
      var manager = self.getWidgetManager(type);
      if (!manager) {
        apos.utils.log('WARNING: no manager for widget type ' + type);
        return;
      }
      return manager.setData($widget, data);
    };

    // Return an array of all area editor objects
    // (subclasses of apostrophe-areas-editor) which
    // are currently visible.

    self.getEditors = function() {
      var $areas = $('[data-apos-area]:visible');
      var editors = [];
      $areas.each(function() {
        var $area = $(this);
        var editor = $area.data('editor');
        if (editor) {
          editors.push(editor);
        }
      });
      return editors;
    };

    // Gives all area editors a chance to save changes,
    // if they need to, before invoking the callback.
    //
    // Both the sync flag and the callback may be
    // omitted entirely. The default is asynchronous.
    // The sync flag is supported for bc only, we use
    // a beforeUnload warning now.
    //
    // This method is ideal in situations where
    // you wish to be sure everything has been saved
    // before transitioning to a UI such as a commit dialog box
    // that displays what has changed, etc.

    self.saveAllIfNeeded = function(sync, callback) {
      if (typeof (arguments[0]) === 'function') {
        callback = arguments[0];
        sync = false;
      }
      var editors = self.getEditors();
      return async.eachSeries(editors, function(editor, callback) {
        return editor.saveIfNeeded(sync, callback);
      }, function(err) {
        return callback && callback(err);
      });
    };

    // For bc only, we use an onBeforeUnload warning now as
    // most browsers now refuse to do sync API calls in
    // onBeforeUnload.
    //
    // Similar to `saveAllIfNeeded`, this method is
    // invoked on a `beforeunload` event, when the user
    // navigates away or closes the tab. However this method
    // has no callback, makes only one synchronous API call
    // to complete all of the work to maximize
    // the chances of success when called during the
    // `beforeunload` event, and also unlocks any docs locked
    // by the current html page as part of that one API call.

    self.saveAllIfNeededAndUnlock = function() {
      var editors = self.getEditors();
      var requests = [];
      _.each(editors, function(editor) {
        var request = editor.prepareAutosaveRequest();
        if (request) {
          requests.push(request);
        }
      });
      return $.jsonCall(self.options.action + '/save-areas-and-unlock',
        {
          async: false
        },
        {
          areas: requests
        },
        function(result) {
          // Precious little we can do here, as we're unloading the page
        }
      );
    };

    self.enableUnload = function() {
      $(window).on('beforeunload', function() {
        var editors = self.getEditors();
        var requests = [];
        _.each(editors, function(editor) {
          var request = editor.prepareAutosaveRequest({
            updatePreviousData: false
          });
          if (request) {
            requests.push(request);
          }
        });
        if (requests.length) {
          self.markUnsaved();
          // Not shown in all but IE, an appropriate browser specific
          // message appears instead, but we must set it
          return 'You may have unsaved changes. Are you sure?';
        }
      });
    };

    self.markUnsaved = function() {
      if (!$('.apos-unsaved').length) {
        $('.apos-context-menu-container').append('<span class="apos-button apos-unsaved">Saving...</span>');
      }
    };

    self.markSavedIfReady = function() {
      // If there are now zero areas requiring a save operation, we
      // can remove the apos-unsaved class
      if ($('.apos-unsaved').length) {
        var editors = self.getEditors();
        var requests = [];
        _.each(editors, function(editor) {
          var request = editor.prepareAutosaveRequest({
            updatePreviousData: false
          });
          if (request) {
            requests.push(request);
          }
        });
        if (!requests.length) {
          $('.apos-unsaved')
            .addClass('apos-unsaved--complete')
            .text('Saved!');
          setTimeout(function() {
            $('.apos-unsaved').fadeOut(function() {
              $('.apos-unsaved').remove();
            });
          }, 800);
        }
      }
    };

    apos.areas = self;

  }
});
