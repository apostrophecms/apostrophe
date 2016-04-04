// editor for an area. See enableAreas() method
// in user.js for where this is invoked.
//

apos.define('apostrophe-area-editor', {
  extend: 'apostrophe-context',

  afterConstruct: function(self) {

    self.init();
    self.addEmptyClass();
    self.linkWidgetsToAreaEditor();
    self.enhanceExistingWidgetControls();
    self.registerClickHandlers();
    self.registerEventHandlers();
    self.registerAutosave();

    self.enableHideControlsOnRichTextStart();

  },

  construct: function(self, options) {

    self.options = options;
    self.$el = self.options.$el;
    self.$body = $('body');
    self.action = apos.areas.options.action;

    self.init = function() {
      // So we don't reinitialize it on every call to enableAll()
      self.$el.attr('data-initialized', 'true');
      // So serialize can be invoked from the outside world
      self.$el.data('editor', self);
      // Receive options from the DOM too
      _.extend(self.options, JSON.parse(self.$el.attr('data-options')));
      if (self.$el.parents('[data-apos-area]').length) {
        self.$el.removeAttr('data-autosave');
      }
      self.$controls = self.$el.findSafe('[data-apos-area-controls]', '[data-apos-widget]');
    };

    self.addEmptyClass = function() {
      if (self.$el.find('[data-apos-widgets]').html() === "") {
        self.$el.addClass('apos-empty');
      }
    };

    self.enhanceExistingWidgetControls = function() {
      var $widgets = self.getWidgets();
      $widgets.each(function() {
        var $widget = $(this);
        self.enhanceWidgetControls($widget);
        self.addAreaControls($widget);
      });
      self.respectLimit();
    };

    self.registerClickHandlers = function() {

      self.link('apos-add-item', self.addItem);
      self.link('apos-edit-item', self.editItem);
      self.link('apos-move-item', self.moveItem);
      self.link('apos-trash-item', self.trashItem);
    };

    self.registerEventHandlers = function() {
      self.$body.on('aposCloseMenus', function() {
        self.dismissContextContentMenu();
      });

      self.on('aposRichTextStarting', function() {
        // Stop any previously active editor
        self.stopEditingRichText();
      });
    };

    self.registerAutosave = function() {
      if (self.$el.is('[data-autosave]')) {
        // Self-saving. Used for areas on regular pages. Areas in snippets
        // will be queried for their content at the time the snippet is saved
        self.previousData = self.serialize();
        self.saveInterval = setInterval(self.saveIfNeeded, 5000);
        $(window).on('beforeunload', function() {
          // If there are outstanding changes when the user leaves the page,
          // attempt a synchronous save operation so we have a chance to complete
          // before leaving
          self.saveIfNeeded(true);
        });
      }
    };

    self.addItem = function($el, value) {
      self.$el.removeClass('apos-empty');

      // If this is not empty then we want to append the new item after this item.
      // If it is empty then we want to prepend it to the area (we used the content menu
      // at the top of the area, rather than one nested in an item).
      self.$insertItemContext = $el.parentsUntil('[data-apos-area]').filter('[data-apos-widget-wrapper]', self.$el);

      // We may have come from a context content menu associated with a specific item;
      // if so dismiss it, but note we waited until after calling closest() to figure out
      // if the click came from such a menu
      self.dismissContextContentMenu();

      // If there's any intial content items, remove them on selecting
      // your first widget. Right now, we're parsing the data-options through
      // self.options and using self.options.initialContent or what we think is
      // the default from aposLocals.
      self.removeInitialContent(self.$el, true);

      return self.addWidget(value);
    };

    self.editItem = function($el) {
      var $widget = $el.closest('[data-apos-widget]');
      if ($widget) {
        self.editWidget($widget);
        return false;
      }
    };

    self.moveItem = function($el) {
      // We move the widget wrapper, with its associated area controls
      var $wrapper = $el.closest('[data-apos-widget-wrapper]');
      var direction = $el.data('apos-move-item');

      if (direction === 'up') {
        $wrapper.prev().before($wrapper);
      } else if (direction === 'down') {
        $wrapper.next().after($wrapper);
      } else if (direction === 'top') {
        $wrapper.parent().children(':first').before($wrapper);
      } else if (direction === 'bottom') {
        $wrapper.parent().children(':last').after($wrapper);
      }
    };

    self.trashItem = function($el) {
      var $widget = $el.closest('[data-apos-widget]');
      self.stopEditingRichText();
      self.removeAreaControls($widget);
      $widget.parent('[data-apos-widget-wrapper]').remove();
      self.checkEmptyAreas();
      self.respectLimit();
    };

    self.getWidgets = function() {
      return self.$el.findSafe('[data-apos-widget]', '[data-apos-area]');
    }

    self.dismissContextContentMenu = function() {
      // TODO implement dismissContextContentMenu
      console.log('TODO implement dismissContextContentMenu');
      // self.$el.find('[data-apos-dropdown]').removeClass('apos-active');
    };

    self.linkWidgetsToAreaEditor = function() {
      // Every item should know its area editor so we can talk
      // to other area editors after drag-and-drop
      var $widgets = self.getWidgets();
      $widgets.each(function() {
        var $widget = $(this);
        $widget.data('areaEditor', self);
      });
    };

    self.removeInitialContent = function($el, entireItem) {
      if (entireItem) {
        // We added a real item to an area that only contains a
        // placeholder item which should be removed in its entirety
        $el.find('[data-apos-widget="apostrophe-rich-text"]:has([data-initial-content])').remove();
      } else {
        // We started editing such an item. Don't trash it,
        // just remove the initial content <p> tag
        $el.find('[data-initial-content]').remove();
      }
    };

    self.stopEditingRichText = function() {
      if (!self.$activeRichText) {
        return;
      }
      apos.areas.getWidgetManager('apostrophe-rich-text').stopEditing(self.$activeRichText);
      self.$activeRichText = undefined;
    };

    self.isText = function($widget) {
      return $widget.is('[data-apos-widget="apostrophe-rich-text"]');
    };

    // Insert a newly created apos-widget, typically called by the
    // widget's editor on save of a new widget

    self.insertWidget = function($wrapper) {
      var $widget = $wrapper.children('[data-apos-widget]').first();
      self.enhanceWidgetControls($widget);
      self.insertItem($wrapper);
      self.respectLimit();
      apos.emit('enhance', $widget);
    };

    self.enhanceWidgetControls = function($widget) {
      $controls = $widget.findSafe('[data-apos-widget-controls]', '[data-apos-area]');
      if (self.options.limit == 1) {
        $controls.addClass('apos-limit-one')
      }
      self.checkEmptyWidget($widget);
      $widget.parent('[data-apos-widget-wrapper]').draggable(self.draggableSettings);
    };

    self.addAreaControls = function($widget) {
      $widget.parent('[data-apos-widget-wrapper]').append(self.$controls.clone().removeAttr('data-apos-area-controls-original'));
    };

    self.removeAreaControls = function($widget) {
      $widget.parent('[data-apos-widget-wrapper]').find('[data-apos-area-controls]').remove();
    };

    self.checkEmptyWidget = function($widget) {
      var type = $widget.attr('data-apos-widget');
      if (apos.areas.getWidgetManager(type).isEmpty($widget)) {
        $widget.addClass('apos-empty');
      }
    };

    // Replace an existing widget, preserving any classes and
    // attributes specific to the area editor. Typically
    // called by the widget's editor on save, so it can change
    // attributes of the widget element itself

    self.replaceWidget = function($old, $widget) {
      var data = self.getWidgetData($old);
      self.enhanceWidgetControls($widget);
      data = self.getWidgetData($widget);
      self.setWidgetData($widget, data);
      $old.replaceWith($widget);
      apos.emit('enhance', $widget);
    };

    self.insertItem = function($item) {
      $item.data('areaEditor', self);
      if (self.$insertItemContext && self.$insertItemContext.length) {
        self.$insertItemContext.after($item);
      } else {
        self.$el.find('[data-apos-widgets]:first').prepend($item);
      }
      self.addAreaControls($item.findSafe('[data-apos-widget]', '[data-apos-area]'));
    };

    // This method recreates separators throughout the entire page as appropriate
    // to the element being dragged.
    self.addSeparators = function($draggable) {
      var $areas = self.getDroppableAreas($draggable);
      // Drop zone at the top of every area, unless we are dragging the top item
      // in that particular area

      $areas.each(function() {
        var $area = $(this);
        var $ancestor = $draggable.closest('[data-apos-area]');
        // $area.addClass('apos-dragging');

        if (($area[0] === $ancestor[0]) && (!$draggable.prev().length)) {
          return;
        }

        $area.find('[data-apos-widgets]:first').prepend(self.newSeparator());
      });

      var $widgets = $areas.findSafe('[data-apos-widget-wrapper]', '[data-apos-area]');
      $(window).trigger('aposDragging', [$widgets]);
      // Counter so we can peek ahead
      var i = 0;
      $widgets.each(function() {
        var $widget = $(this);
        if (!(($widgets[i] === $draggable[0]) || (((i + 1) < $widgets.length) && ($widgets[i + 1] === $draggable[0])))) {
          $widget.after(self.newSeparator());
        }
        i++;
      });
      $('[data-apos-drag-item-separator]:not(.apos-template)').droppable(self.separatorDropSettings);
      setImmediate(function() {
        $areas.addClass('apos-dragging');
      });
    };

    self.removeSeparators = function() {
      $(window).trigger('aposStopDragging');
      $('[data-apos-area]').removeClass('apos-dragging');
      $('[data-apos-refreshable] [data-apos-drag-item-separator]').on('transitionend webkitTransitionEnd oTransitionEnd', function() {
        $(this).remove();
      })
    };

    self.getDroppableAreas = function($draggable) {
      var $widget = $draggable.find('[data-apos-widget]').first();
      var richText;
      if ($widget.hasClass('apos-rich-text-item')) {
        richText = true;
      }
      // Only the current area, and areas that are not full; also
      // rule out areas that do not allow the widget type in question
      return $('[data-apos-area]').filter(function() {
        var editor = $(this).data('editor');
        if ((!editor.limitReached()) || ($widget.data('areaEditor') === editor)) {
          if ((richText && (editor.options.richText !== false)) || _.has(editor.options.widgets, $widget.attr('data-apos-widget'))) {
            return true;
          }
        }
      });
    };

    self.newSeparator = function() {
      var $separator = self.fromTemplate('[data-apos-drag-item-separator]');
      return $separator;
    };

    self.getAreaOptions = function($area) {
      // TODO: this could be a lot of parsing done over and over
      return JSON.parse($area.attr('data-options') || '{}');
    };

    self.editWidget = function($widget) {
      self.stopEditingRichText();
      var type = $widget.attr('data-apos-widget');
      var options = self.options.widgets[type] || {};

      apos.areas.getWidgetManager(type).edit(
        self.getWidgetData($widget),
        options,
        function(data, callback) {
          $.jsonCall(self.action + '/render-widget',
          {
            dataType: 'html'
          },
          {
            data: data,
            options: options,
            type: type
          }, function(html) {
            // This rather intense code works around
            // various situations in which jquery is
            // picky about HTML
            var $newWidget = $($.parseHTML($.trim(html), null, true));
            self.replaceWidget($widget, $newWidget);
            return callback(null);
          });
        }
      );
    };

    self.checkEmptyAreas = function() {
      $('[data-apos-area]').each(function() {
        var $el = $(this);
        if ($el.find('[data-apos-widget]').length === 0) {
          $el.addClass('apos-empty');
        } else {
          $el.removeClass('apos-empty');
        }
      });
      return false;
    };

    self.addWidget = function(type) {
      self.stopEditingRichText();
      var options = self.options.widgets[type] || {};

      apos.areas.getWidgetManager(type).edit(
        {},
        options,
        function(data, callback) {
          $.jsonCall(self.action + '/render-widget',
            {
              dataType: 'html'
            },
            {
              data: data,
              options: options,
              type: type
            }, function(html) {
              // This rather intense code works around
              // various situations in which jquery is
              // picky about HTML
              var $wrapper = $($.parseHTML($.trim(html), null, true));
              self.insertWidget($wrapper);
              self.checkEmptyAreas();
              return callback(null, $wrapper.findSafe('[data-apos-widget]', '[data-apos-area]'));
            }
          );
        }
      );
    };

    self.draggableSettings = {
      handle: '[data-apos-drag-item]',
      revert: 'invalid',
      refreshPositions: true,
      tolerance: 'pointer',
      start: function(event, ui) {
        self.stopEditingRichText();
        // If the limit has been reached, we can only accept
        // drags from the same area
        var $item = $(event.target);
        self.enableDroppables($item);
      },
      stop: function(event, ui) {
        self.disableDroppables();
      }
    };

    self.enableDroppables = function($draggable) {
      self.addSeparators($draggable);
    };

    self.disableDroppables = function($draggable) {
      self.removeSeparators();
    };

    self.separatorDropSettings = {
      accept: '[data-apos-widget-wrapper]',
      activeClass: 'apos-active',
      hoverClass: 'apos-hover',
      tolerance: 'pointer',

      drop: function(event, ui) {
        // TODO: after the drop we should re-render the dropped item to
        // reflect the options of its new parent area
        var $item = $(ui.draggable);
        // Get rid of the hardcoded position provided by jquery UI draggable,
        // but don't remove the position: relative without which we can't see the
        // element move when we try to drag it again later
        $item.css('top', '0');
        $item.css('left', '0');
        $(event.target).after($item);
        self.disableDroppables();
        self.reRenderWidget($item);
        self.changeOwners($item);
        self.checkEmptyAreas();
      }
    };

    // Get the server to re-render a widget for us, applying the
    // options appropriate to its new context at area
    // TODO: we should prevent input during this time
    self.reRenderWidget = function($widget) {
      self.stopEditingRichText();
      var type = $widget.attr('data-apos-widget');
      var data = self.getWidgetData($widget, true)
      var options = self.options[type] || {};

      return $.jsonCall(self.action + '/render-widget',
        {
          dataType: 'html'
        },
        {
          data: data,
          options: options,
          type: type
        }, function(html) {
          // This rather intense code works around
          // various situations in which jquery is
          // picky about HTML
          var $newWidget = $($.parseHTML($.trim(html), null, true));
          self.replaceWidget($widget, $newWidget);
          // TODO should this take a callback?
          // return callback(null);
        }
      );
    };

    self.getWidgetData = function($widget) {
      var type = $widget.attr('data-apos-widget');
      var manager = apos.areas.getWidgetManager(type);
      return manager.getData($widget);
    };

    self.setWidgetData = function($widget, data) {
      var type = $widget.attr('data-apos-widget');
      var manager = apos.areas.getWidgetManager(type);
      return manager.setData($widget, data);
    };

    // Get the options that apply to the widget in its current context
    self.getWidgetOptions = function($widget) {
      var $area = $widget.closest('[data-apos-area]');
      var data = self.getWidgetData($widget);
      var options = {};
      var areaOptions = self.getAreaOptions($area);
      var type = $widget.attr('data-type');
      if (areaOptions) {
        $.extend(true, options, areaOptions[type] || {});
      }
      return options;
    };

    // Serialize the editor to an array of items, exactly as expected for
    // storage in an area.
    self.serialize = function() {
      var items = [];
      self.getWidgets().each(function() {
        var $item = $(this);
        var item = self.getWidgetData($item);
        items.push(item);
      });
      return items;
    };

    self.saveIfNeeded = function(sync) {
      // Die gracefully if the area has been removed from the DOM
      if (!self.$el.closest('body').length) {
        clearInterval(self.saveInterval);
        return;
      }
      var items = self.serialize();
      if (JSON.stringify(items) !== JSON.stringify(self.previousData)) {
        $.jsonCall(
          self.options.action + '/save-area',
          {
            async: !sync,
            dataType: 'html'
          },
          {
            docId: self.$el.attr('data-doc-id'),
            dotPath: self.$el.attr('data-dot-path'),
            options: self.getAreaOptions(self.$el),
            items: items
          },
          function() {
            self.previousData = items;
            apos.emit('areaEdited', self.$el);
          },
          function() {
            apos.log('save FAILED');
          }
        );
      }
      self.checkEmptyAreas();
    };

    // Take an item that might belong to a different
    // area and make it ours
    self.changeOwners = function($item) {
      $item.data('areaEditor', self);
      self.respectLimit();
    };

    self.respectLimit = function() {
      var count = self.getWidgets().length;
      var $toggles = self.$el.find('[data-content-menu-toggle]');
      if (self.limitReached()) {
        self.$el.addClass('apos-limit-reached');
        $toggles.addClass('apos-disabled');
      } else {
        self.$el.removeClass('apos-limit-reached');
        $toggles.removeClass('apos-disabled');
      }
    };

    self.limitReached = function() {
      var count = self.getWidgets().length;
      return (self.options.limit && (count >= self.options.limit));
    };

    self.fromTemplate = function(sel) {
      return apos.areas.fromTemplate(sel);
    };

    self.enableHideControlsOnRichTextStart = function() {
      self.$el.off('aposRichTextStarted');
      self.on('aposRichTextStarted', function(e) {
        self.$activeRichText = $(e.target);
        $(e.target).find('[data-apos-area-item-buttons]:first').hide();
      });
      self.$el.off('aposRichTextStopped');
      self.on('aposRichTextStopped', function(e) {
        var $widget = $(e.target);
      });
    };

    // Override default apostrophe-context functionality because we
    // need to use $.onSafe, for the sake of nested areas.

    self.link = function(action, callback) {
      var attribute;
      attribute = 'data-' + apos.utils.cssName(action);
      var attributeSel = '[' + attribute + ']';
      self.on('click', attributeSel, function() {
        callback($(this), $(this).attr(attribute));
        return false;
      });
    };

    // This is a wrapper for $.onSafe that avoids events that are actually
    // happening in nested areas. -Tom and Sam

    self.on = function(eventType, selector, fn) {
      if (arguments.length === 2) {
        fn = selector;
        selector = undefined;
        self.$el.onSafe(eventType, '[data-apos-area]', fn);
      } else {
        self.$el.onSafe(eventType, selector, '[data-apos-area]', fn);
      }
    };
  }
});
