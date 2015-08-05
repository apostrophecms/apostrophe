// editor for an area. See enableAreas() method
// in user.js for where this is invoked.
//
// For the singleton editor, see enableSingletons in user.js.

apos.define('apostrophe-area-editor', {

  afterConstruct: function(self) {

    self.$el = self.options.$el;

    // So we don't reinitialize it on every call to enableAll()
    self.$el.attr('data-initialized', 'true');

    // So serialize can be invoked from the outside world
    self.$el.data('editor', self);

    // Receive options from the DOM too
    _.extend(self.options, JSON.parse(self.$el.attr('data-options')));

    if (self.options.textOnly) {
      // So it can be easily excluded in selectors for drag and drop
      self.$el.attr('data-text-only', true);
    }

    self.$el.on('aposRichTextStarting', function() {
      // Stop any previously active editor
      self.stopEditingRichText();
    });

    self.init();

    self.enableHideControlsOnRichTextStart();

  },

  construct: function(self, options) {

    self.options = options;

    self.action = apos.areas.options.action;

    // Selectors to locate items and lockups without crossing into
    // the rendered content of a widget such as the blog widget
    self.selItems = '[data-widget]:not([data-widget] [data-widget])';
    self.selLockups = '.apos-lockup:not([data-widget] .apos-lockup)';

    // TODO refactor me into many methods that can
    // be overridden

    self.init = function() {
      if (self.$el.find('[data-widgets]').html() === "") {
        self.$el.find('[data-widgets]').addClass('apos-empty');
      }
      self.$el.on('click', '[data-add-item-type]', function() {
        self.$el.find('[data-widgets]').removeClass('apos-empty');
        var itemType = $(this).attr('data-add-item-type');

        // If this is not empty then we want to append the new item after this item.
        // If it is empty then we want to prepend it to the area (we used the content menu
        // at the top of the area, rather than one nested in an item).
        self.$insertItemContext = $(this).closest('[data-widget],.apos-lockup');

        // We may have come from a context content menu associated with a specific item;
        // if so dismiss it, but note we waited until after calling closest() to figure out
        // if the click came from such a menu
        self.dismissContextContentMenu();

        // If there's any intial content items, remove them on selecting
        // your first widget. Right now, we're parsing the data-options through
        // self.options and using self.options.initialContent or what we think is
        // the default from aposLocals.

        self.removeInitialContent(self.$el, true);

        if (itemType === 'apostrophe-rich-text') {
          return self.addRichText();
        } else {
          return self.addWidget(itemType);
        }
      });

      self.$el.on('click', '[data-edit-item]', function(event) {
        var $item = $(this).closest('[data-widget], .apos-lockup');
        if ($item.hasClass('apos-lockup')) {
          $item = $item.find('.apos-rich-text-item');
        }
        if ($item.attr('data-widget') === 'apostrophe-rich-text') {
          self.editRichText($item);
          // Follow that up with a focus call so ckeditor decides to show itself
          // if it is already present, but dormant. We don't have to or want to do
          // this on click events on the text so this code is specific to this button
          $item.find('[data-rich-text]:first').focus();
          return false;
        } else if ($item.is('[data-widget]')) {
          self.editWidget($item);
          return false;
        }
      });

      self.$el.on('click', '[data-move-item]', function(e) {
        var $self = $(this);
        var $item = $self.closest('[data-widget], .apos-lockup');
        var direction = $self.attr('data-move-item');

        if (direction === 'up') {
          $item.prev().before($item);
        } else if (direction === 'down') {
          $item.next().after($item);
        } else if (direction === 'top') {
          $item.parent().children(':first').before($item);
        } else if (direction === 'bottom') {
          $item.parent().children(':last').after($item);
        }
      });


      // Switch a lockup between types (left, right, etc)
      self.$el.on('click', '[data-lockup-type]', function(event) {
        var type = $(this).attr('data-lockup-type');
        var $lockup = $(this).closest('.apos-lockup');
        var oldType = self.getLockupType($lockup);
        if (oldType !== type) {

          // The type of the lockup is actually stored as an attribute of
          // its widget
          var $widget = $lockup.find('.apos-widget');
          var data = self.getWidgetData($widget);
          data.lockup = type;
          self.setWidgetData($widget, data);

          // The lockup also gets a class
          $lockup.removeClass(oldType);
          $lockup.addClass(type);

          // Re-render the widget to reflect changes to things like
          // the size option of slideshows
          self.reRenderWidget($widget);

          // Show which option is currently active
          $lockup.find('[data-lockup-type]').removeClass('apos-active');
          $(this).addClass('apos-active');
        }
        return false;
      });

      self.$el.on('click', '[data-trash-item]', function() {
        var $item = $(this).closest('[data-widget],.apos-lockup');
        return self.trashItem($item);
      });

      self.$el.on('click', '[data-content-menu-toggle]', function() {
        if ($(this).hasClass('apos-disabled')) {
          // Limit reached
          return false;
        }
        var $contentMenu = $(this).closest('[data-content-menu]');
        if ($contentMenu.hasClass('apos-open')) {
          $contentMenu.removeClass('apos-open');
          delete self.$contextContentMenu;
          return;
        }
        $('body').trigger('aposCloseMenus');
        $contentMenu.addClass('apos-open');
        self.$contextContentMenu = $contentMenu;
        return false;
      });

      $('body').on('aposCloseMenus', function() {
        self.dismissContextContentMenu();
      });

      self.$el.on('click', '[data-add-item]', function() {
        var $item = $(this).closest('[data-widget],.apos-lockup');

        // If the user clicks add and our menu was already up, just take it down
        // and return
        if (self.$contextContentMenu) {
          var $itemOfMenu = self.$contextContentMenu.closest('[data-widget],.apos-lockup');
          if ($itemOfMenu[0] === $item[0]) {
            self.dismissContextContentMenu();
            return;
          }
        }

        // Make sure any previous menu is dismissed
        self.dismissContextContentMenu();
        self.$contextContentMenu = self.$contentMenuTemplate.clone();
        // The toggle is redundant when we use the add button
        self.$contextContentMenu.find('[data-content-menu-toggle]').remove();
        self.$contextContentMenu.find('[data-content-menu-options]').show();
        $item.find('.apos-editor2-item-buttons').after(self.$contextContentMenu);
        return false;
      });

      self.$el.on('click', '[data-unlock-item]', function() {
        var $lockup = $(this).closest('.apos-lockup');
        return self.unlock($lockup);
      });

      // Any "outside" click should dismiss the "add content" menu.
      self.$el.on('click', function() {
        // self.dismissContextContentMenu();
        return true;
      });

      self.dismissContextContentMenu = function() {
        if (self.$contextContentMenu) {
          // Permanent menus, like the one at the top of an area, will have
          // a data-content-menu-toggle element for showing and hiding their
          // options. These should be hidden when not needed. Other menus
          // were produced by clicking "add" and can be removed when not needed.
          if (self.$contextContentMenu.has('[data-content-menu-toggle]').length) {
            self.$contextContentMenu.toggleClass('apos-open', false);
          } else {
            //self.$contextContentMenu.toggleClass('apos-open', false);
            self.$contextContentMenu.remove();
            delete self.$contextContentMenu;
          }
        }
      };

      self.linkItemsToAreaEditor();

      addButtons();

      function addButtons() {
        self.addButtonsToExistingItems();
        self.respectLimit();
      }

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

      // In text-only mode make sure there is a text to edit
      if (self.options.textOnly && (!self.$el.find(self.selItems).length)) {
        return self.addRichText();
      }
    };

    self.linkItemsToAreaEditor = function() {
      // Every item should know its area editor so we can talk
      // to other area editors after drag-and-drop
      var $items = self.$el.find(self.selItems);
      $items.each(function() {
        var $item = $(this);
        $item.data('areaEditor', self);
      });
    };

    self.editRichText = function($widget) {

      // Remove any initial "click to type" content when we
      // start actual editing
      self.removeInitialContent(self.$el);

      self.stopEditingRichText();
      apos.areas.getWidgetManager('apostrophe-rich-text').startEditing($widget);
      return false;
    };

    self.removeInitialContent = function($el, entireItem) {
      if (entireItem) {
        // We added a real item to an area that only contains a
        // placeholder item which should be removed in its entirety
        $el.find('[data-widget="apostrophe-rich-text"]:has([data-initial-content])').remove();
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

    self.isText = function($item) {
      return $item.is('[data-widget="apostrophe-rich-text"]');
    };

    // Decorate a new or existing apos-widget with a top bar of buttons suitable for whatever can be
    // done to it "in context" in the editor - at a minimum, opening the widget's dialog
    self.addButtonsToWidget = function($widget) {
      self.addButtonsToItem($widget);
    };

    // We decorate widgets and texts the same way in this editor. This is also a good place
    // to make the item draggable. You may call this more than once to replace the buttons
    self.addButtonsToItem = function($item) {
      // This allows css to be scoped to the admin ui buttons when the widget is hovered
      $item.addClass("apos-item");

      var $itemButtons;
      $item.find('.apos-editor2-item-buttons,.apos-editor2-locked-item-buttons').remove();

      // Items in a lockup get a restricted set of buttons. The rich text itself still
      // has all of them
      var isLocked = self.isItemLocked($item);
      if (self.isItemLocked($item) && !self.isText($item)) {
        $itemButtons = self.fromTemplate('.apos-editor2-locked-item-buttons');
      } else if (self.isItemLocked($item)) {
        $itemButtons = self.fromTemplate('.apos-editor2-lockup-widget-buttons');
      } else {
        $itemButtons = self.fromTemplate('.apos-editor2-item-buttons');
      }

      $item.prepend($itemButtons);

      // Horizontally center a locked widget w/ unknown height
      if ($item.find('.apos-ui-container').hasClass('center')) {
        var buttonsWidth = $item.find('.apos-ui-container').width();
        var widgetWidth = $item.width();
        var left = (widgetWidth / 2) - (buttonsWidth / 2);
        $item.find('.center').css('left', left + 'px');
      }

      if (isLocked) {
        // If we let the text of a lockup be draggable and a widget is floated left
        // next to it, the widget will not be reachable by the mouse, so we don't permit
        // this. Instead you can get the items out again by breaking the lockup with its
        // "unlock" button
        if ($item.hasClass('ui-draggable')) {
          // Do this after yield to avoid a crash in jquery UI
          setImmediate(function() {
            $item.draggable('destroy');
          });
        }
      } else {
        $item.draggable(self.draggableSettings);
      }
      if (self.options.textOnly) {
        $item.find('[data-drag-item]').remove();
        $item.find('[data-add-item]').remove();
        $item.find('[data-trash-item]').remove();
      }
    };

    // Add controls to a lockup, and make it draggable as appropriate
    self.addButtonsToLockup = function($lockup) {
      var $lockupButtons;
      $lockup.find('.apos-editor2-locked-item-buttons:not(.apos-template)').remove();
      $lockupButtons = self.fromTemplate('.apos-editor2-locked-item-buttons');
      // $lockupButtons = self.fromTemplate('.apos-editor2-lockup-buttons');

      var $typeTemplate = $lockupButtons.find('[data-lockup-type]');
      var lockups = self.getLockupsForArea($lockup.closest('[data-area]'));
      if (lockups) {
        $lockup.closest('[data-area]').find('[data-lockups-menu]').removeClass('apos-template');
      }
      var $previous = $typeTemplate;
      _.each(lockups, function(lockup, name) {
        var $button = self.fromTemplate($typeTemplate);
        if (lockup.tooltip) {
          $button.attr('title', lockup.tooltip);
        } else {
          $button.attr('title', lockup.label);
        }
        if (lockup.icon) {
          $button.find('i').attr('class', lockup.icon);
        }

        $button.append(lockup.label);

        $button.attr('data-lockup-type', name);
        $previous.after($button);
      });
      $typeTemplate.remove();

      var type = self.getLockupType($lockup);
      $lockupButtons.find('[data-lockup-type="' + type + '"]').addClass('apos-active');

      $lockup.prepend($lockupButtons);

      $lockup.find('[data-content-menu-toggle]').click(function(e) {
        $(this).next().toggleClass('apos-active');
      });
      $lockup.draggable(self.draggableSettings);
    };

    self.isItemLocked = function($item) {
      var $lockup = $item.parent('.apos-lockup');
      return !!$lockup.length;
    };

    // Decorate the existing items with buttons, create the separators, and
    // make the rich text items droppable
    self.addButtonsToExistingItems = function() {
      var $items;
      // Use the :not selector to avoid recursing into widgets that include
      // areas in their rendered output
      $items = self.$el.find(self.selItems);
      $items.each(function() {
        var $item = $(this);
        self.addButtonsToItem($item);
      });
      $items = self.$el.find(self.selLockups);
      $items.each(function() {
        var $item = $(this);
        self.addButtonsToLockup($item);
      });
    };

    // Insert a newly created apos-widget, typically called by the
    // widget's editor on save of a new widget

    self.insertWidget = function($widget) {
      $widget.addClass('apos-item');
      self.addButtonsToWidget($widget);
      self.insertItem($widget);
      self.respectLimit();
    };

    // Replace an existing widget, preserving any classes and
    // attributes specific to the area editor, like lockups. Typically
    // called by the widget's editor on save, so it can change
    // attributes of the widget element itself

    self.replaceWidget = function($old, $widget) {
      var data = self.getWidgetData($old);
      var lockup = data.lockup;
      self.addButtonsToWidget($widget);
      data = self.getWidgetData($widget);
      data.lockup = lockup;
      self.setWidgetData($widget, data);
      $old.replaceWith($widget);
    };

    self.insertItem = function($item) {
      $item.data('areaEditor', self);
      if (self.$insertItemContext && self.$insertItemContext.length) {
        self.$insertItemContext.after($item);
      } else {
        self.$el.find('[data-widgets]:first').prepend($item);
      }
    };

    // This method recreates separators throughout the entire page as appropriate
    // to the element being dragged.
    self.addSeparators = function($draggable) {
      var $areas = self.getDroppableAreas($draggable);
      // Drop zone at the top of every area, unless we are dragging the top item
      // in that particular area


      $areas.each(function() {
        var $area = $(this);
        var $ancestor = $draggable.closest('[data-area]');
        $area.addClass('apos-dragging');

        if (($area[0] === $ancestor[0]) && (!$draggable.prev().length)) {
          return;
        }

        $area.find('[data-widgets]:first').prepend(self.newSeparator());
      });

      var $elements = $areas.find(self.selItems + ',' + self.selLockups);
      $(window).trigger('apos-dragging', [$elements]);
      // Counter so we can peek ahead
      var i = 0;
      $elements.each(function() {
        var $element = $(this);
        var good = true;
        // Individual items inside lockups don't get dropzones above and below them
        if ($element.parent('.apos-lockup').length) {
          good = false;
          // There should be no dropzone immediately below or above the element
          // being dragged
        } else if (($elements[i] === $draggable[0]) || (((i + 1) < $elements.length) && ($elements[i + 1] === $draggable[0]))) {
          good = false;
        }
        if (good) {
          $element.after(self.newSeparator());
        }
        i++;
      });
      $('[data-drag-item-separator]:not(.apos-template)').droppable(self.separatorDropSettings);
    };

    self.removeSeparators = function() {
      $(window).trigger('apos-stop-dragging');
      $('[data-area]').removeClass('apos-dragging');
      $('[data-drag-item-separator]:not(.apos-template)').remove();
    };

    self.getDroppableAreas = function($draggable) {
      var richText;
      if ($draggable.hasClass('apos-rich-text-item')) {
        richText = true;
      }
      // Lockups can only be dragged within the current area
      var betweenAreas = !$draggable.hasClass('apos-lockup');
      var $areas;
      if (betweenAreas) {
        // Only the current area, and areas that are not full; also
        // rule out areas that do not allow the widget type in question
        $areas = $('[data-area]:not([data-text-only])').filter(function() {
          var editor = $(this).data('editor');
          if ((!editor.limitReached()) || ($draggable.data('areaEditor') === editor)) {
            if ((richText && (editor.options.richText !== false)) || _.contains(editor.options.controls, $draggable.attr('data-type'))) {
              return true;
            }
          }
        });
      } else {
        $areas = $draggable.closest('[data-area]');
      }
      return $areas;
    };

    self.newSeparator = function() {
      var $separator = self.fromTemplate('.apos-editor2-item-separator');
      return $separator;
    };

    self.enableDropOnText = function($draggable) {
      var $areas = self.getDroppableAreas($draggable);
      $areas.find("[data-widgets] [data-widget='apostrophe-rich-text']:not('[data-widget] [data-widget='apostrophe-rich-text'])").each(function() {
        var $item = $(this);
        // What we accept depends on which lockups allow which widgets. We can
        // automatically switch lockups if one lockup supports widget A and the
        // other supports widget B
        var type = $draggable.attr('data-type');
        var good = false;
        if (type === 'apostrophe-rich-text') {
          // Great, always acceptable to drag to other text
          good = true;
        } else {
          var areaOptions = self.getAreaOptions($item.closest('[data-area]'));
          if (!areaOptions.lockups) {
            // No lockups at all - text is a drag target only for other text
          } else {
            var lockupWidgetTypes = [];
            _.some(areaOptions.lockups, function(lockupName) {
              var lockup = apos.data.lockups[lockupName];
              if (lockup && _.contains(lockup.widgets, type)) {
                good = true;
                return true;
              }
            });
          }
        }
        if (good) {
          $item.droppable(self.richTextDropSettings);
        }
      });
    };

    self.disableDropOnText = function() {
      $('[data-area] [data-widgets] [data-widget="apostrophe-rich-text"]').droppable('destroy');
    };

    self.getAreaOptions = function($area) {
      // TODO: this could be a lot of parsing done over and over
      return JSON.parse($area.attr('data-options') || '{}');
    };

    self.editWidget = function($widget) {
      self.stopEditingRichText();
      var type = $widget.attr('data-widget');
      // TODO is this needed? -Jimmy
      //var widgetId = $widget.attr('data-id');
      var options = self.options[type] || {};

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

    self.addRichText = function(html, editNow) {
      self.stopEditingRichText();
      var $text = self.fromTemplate('.apos-rich-text-item');
      // Populate the options just as if this widget had
      // been rendered as part of an existing page
      $text.attr('data-options', JSON.stringify(self.options.widgets['apostrophe-rich-text'] || {}));
      // Every widget needs an _id for participation in versioning
      $text.attr('data', JSON.stringify({ _id: apos.utils.generateId(), type: 'apostrophe-rich-text' }));
      self.addButtonsToItem($text);
      self.insertItem($text);
      if (html !== undefined) {
        $text.find('[data-rich-text]').html(html);
      }
      if (editNow || (editNow === undefined)) {
        self.editRichText($text);
      }
      self.respectLimit();
      return false;
    };

    self.checkEmptyAreas = function() {
      $('[data-area]').each(function() {
        var $el = $(this);
        if ($el.find('[data-type]').length === 0) {
          $el.find('[data-widgets]').addClass('apos-empty');
        }
      });
      return false;
    };

    self.addWidget = function(type) {
      self.stopEditingRichText();
      var options = self.options[type] || {};

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
              var $widget = $($.parseHTML($.trim(html), null, true));
              self.insertWidget($widget);
              return callback(null);
            }
          );
        }
      );
    };

    self.trashItem = function($item) {
      self.stopEditingRichText();
      self.unlock($item);
      $item.remove();
      self.checkEmptyAreas();
      self.respectLimit();
    };

    self.draggableSettings = {
      handle: '[data-drag-item]',
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
      self.enableDropOnText($draggable);
    };

    self.disableDroppables = function($draggable) {
      self.removeSeparators();
      self.disableDropOnText();
    };

    self.separatorDropSettings = {
      accept: '[data-widget],.apos-lockup',
      activeClass: 'apos-editor2-active',
      hoverClass: 'apos-editor2-hover',
      tolerance: 'pointer',

      drop: function(event, ui) {
        // TODO: after the drop we should re-render the dropped item to
        // reflect the options of its new parent area
        var $item = $(ui.draggable);
        // If it's not a lockup itself, dragging it somewhere else automatically busts it out
        // of any lockup it may currently be in
        if (!$item.hasClass('apos-lockup')) {
          self.unlock($item);
        }
        // Get rid of the hardcoded position provided by jquery UI draggable,
        // but don't remove the position: relative without which we can't see the
        // element move when we try to drag it again later
        $item.css('top', '0');
        $item.css('left', '0');
        $(event.target).after($item);
        self.disableDroppables();
        self.reRenderWidget($item);
        self.changeOwners($item);
      }
    };

    self.richTextDropSettings = {
      accept: '[data-widget]',
      activeClass: 'apos-editor2-active',
      hoverClass: 'apos-editor2-hover',
      tolerance: 'pointer',

      drop: function(event, ui) {
        if (!self.isText(ui.draggable)) {
          // TODO: after the drop we should re-render both the widget and the
          // target text to reflect the options of the area and the lockup, if any

          // Widget dragged to text - create a lockup
          var $newWidget = $(ui.draggable);
          var $richTextItem = $(event.target);
          // If the rich text is already part of a lockup, undo that
          self.unlock($richTextItem);
          // Create a lockup containing this text and this widget
          var $lockup = $('<div class="apos-lockup"></div>');
          // use the first lockup allowed in this area which is compatible
          // with the widget type
          var type = $newWidget.attr('data-type');
          var lockups = self.getLockupsForArea($richTextItem.closest('[data-area]'));
          // Should always be defined because we check for this when enabling droppables
          var key;
          var lockupName;
          for (key in lockups) {
            var lockup = lockups[key];
            if (_.contains(lockup.widgets, type)) {
              lockupName = key;
              break;
            }
          }
          if (lockupName) {
            $lockup.addClass(lockupName);
          }
          // Position the lockup where the text was, then move the widget and text into it
          $richTextItem.before($lockup);
          $lockup.append($newWidget);
          $lockup.append($richTextItem);
          // Redecorate the items to account for the fact that they are now stuck in a lockup
          self.addButtonsToItem($newWidget);
          self.addButtonsToItem($richTextItem);
          // Otherwise it stays offset where dropped
          $newWidget.removeAttr('style');
          var data = self.getWidgetData($newWidget);
          data.lockup = lockupName;
          self.setWidgetData($newWidget, data);
          self.reRenderWidget($newWidget);
          self.addButtonsToLockup($lockup);
        } else {
          // Text dragged to text - append the text
          var $contents = $(ui.draggable).find('[data-rich-text]').contents();
          $(event.target).find('[data-rich-text]').append($contents);
          $(ui.draggable).remove();
        }
        self.disableDroppables();
        // $item is not defined here, get the item from the event
        self.changeOwners($(ui.draggable));
      }
    };

    self.getLockupsForArea = function($area) {
      var options = self.getAreaOptions($area);
      var names = options.lockups || [];
      var lockups = {};
      _.each(names, function(name) {
        if (_.has(apos.data.lockups, name)) {
          lockups[name] = apos.data.lockups[name];
        }
      });
      return lockups;
    };

    self.getLockupType = function($lockup) {
      var $widget = $lockup.find('[data-widget]');
      var data = self.getWidgetData($widget);
      return data.lockup;
    };

    // Given an item that may be part of a lockup, bust it and its
    // peers, if any, out of the lockup so they can be dragged separately again
    self.unlock = function($item) {
      var $lockup;
      if ($item.hasClass('apos-lockup')) {
        $lockup = $item;
      } else {
        $lockup = $item.parent('.apos-lockup');
        if (!$lockup.length) {
          return;
        }
      }
      var $items = $lockup.children('[data-widget]');
      $items.each(function() {
        var $item = $(this);
        if (!self.isText($item)) {
          var data = self.getWidgetData($item);
          if (data.lockup) {
            delete data.lockup;
          }
          self.setWidgetData($item, data);
          self.reRenderWidget($item);
        }
      });
      $lockup.before($items);
      $lockup.remove();
      $items.each(function() {
        self.addButtonsToItem($(this));
      });
      // Actually, we may already be over the limit at this point,
      // but we give the user until they leave the page to do
      // something about that (TODO: a visual indication that their
      // content is in peril would be best).
      self.respectLimit();
    };

    // Get the server to re-render a widget for us, applying the
    // options appropriate to its new context at area and possibly lockup level
    // TODO: we should prevent input during this time
    self.reRenderWidget = function($widget) {
      var options = self.getWidgetOptions($widget);
      var data = { _options: options };
      $.extend(true, data, self.getWidgetData($widget, true));
      return $.ajax({
        type: 'POST',
        url: '/apos/render-widget?bodyOnly=1&editView=1',
        processData: false,
        contentType: 'application/json',
        data: JSON.stringify(data),
        dataType: 'html',
        success: function(html) {
          $widget.html(html);
          var type = $widget.attr('data-type');
          if (apos.widgetPlayers[type]) {
            apos.widgetPlayers[type]($widget);
          }
          self.addButtonsToWidget($widget);
        }
      });
    };

    self.getWidgetData = function($widget) {
      var type = $widget.attr('data-widget');
      var manager = apos.areas.getWidgetManager(type);
      return manager.getData($widget);
    };

    self.setWidgetData = function($widget, data) {
      var type = $widget.attr('data-widget');
      var manager = apos.areas.getWidgetManager(type);
      return manager.setData($widget, data);
    };

    // Get the options that apply to the widget in its current context
    // (area and possibly lockup)
    self.getWidgetOptions = function($widget) {
      var $area = $widget.closest('[data-area]');
      var data = self.getWidgetData($widget);
      var options = {};
      var areaOptions = self.getAreaOptions($area);
      var type = $widget.attr('data-type');
      if (areaOptions) {
        $.extend(true, options, areaOptions[type] || {});
      }
      if (data.lockup) {
        var lockupOptions = apos.data.lockups[data.lockup];
        $.extend(true, options, lockupOptions[type] || {});
      }
      return options;
    };

    // Serialize the editor to an array of items, exactly as expected for
    // storage in an area.
    self.serialize = function() {
      var items = [];
      self.$el.find(self.selItems).each(function() {
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
      $item.data('areaEditor').respectLimit();
      $item.data('areaEditor', self);
      self.respectLimit();
    };

    self.respectLimit = function() {
      var count = self.$el.find(self.selItems).length;
      var $toggles = self.$el.find('[data-content-menu-toggle]');
      if (self.limitReached()) {
        $toggles.addClass('apos-disabled');
      } else {
        $toggles.removeClass('apos-disabled');
      }
    };

    self.limitReached = function() {
      var count = self.$el.find(self.selItems).length;
      return (self.options.limit && (count >= self.options.limit));
    };

    self.fromTemplate = function(sel) {
      return apos.areas.fromTemplate(sel);
    };

    self.enableHideControlsOnRichTextStart = function() {
      self.$el.off('aposRichTextStarted');
      self.$el.on('aposRichTextStarted', function(e) {
        self.$activeRichText = $(e.target);
        $(e.target).find('[data-area-item-buttons]:first').hide();
      });
      self.$el.off('aposRichTextStopped');
      self.$el.on('aposRichTextStopped', function(e) {

        var $widget = $(e.target);
        $widget.find('[data-area-item-buttons]:first').show();

        var html = self.getWidgetData($widget);

        if (html.length !== 0) {
          $widget.removeClass('apos-empty');
        } else {
          $widget.addClass('apos-empty');
        }
      });
    };
  }
});
