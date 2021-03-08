// Image Gallery

apos.define('apostrophe-images-manager-modal', {
  extend: 'apostrophe-pieces-manager-modal',

  construct: function(self, options) {
    // save manager so we can call edit() later
    self.manager = apos.docs.getManager(options.name);

    var superEnableButtonEvents = self.enableButtonEvents;
    self.enableButtonEvents = function() {
      // focus on single click
      self.$el.on('click', '[data-focus-' + options.name + ']', function(e) {
        // If the click was actually on the edit button, we should
        // focus and toggle the selection only if the image was not already
        // part of the selection. Otherwise images disappear from the
        // selection as they are edited which is very confusing. -Tom
        if ($(e.target).attr('data-apos-edit-apostrophe-image')) {
          var $checkbox = $(this).find('input[type="checkbox"]');
          if ($checkbox.prop('checked')) {
            return;
          }
        }
        e.preventDefault();
        self.focusElement($(this));
      });

      // edit on double click
      self.$el.on('dblclick', '[data-edit-dbl-' + options.name + ']', function() {
        var id = $(this).attr('data-edit-dbl-' + options.name);
        self.manager.edit(id);
      });

      // toggle selection mode on checkmark select
      superEnableButtonEvents();
    };

    self.focusElement = function($el) {
      // set checkbox to :checked, and trigger change event
      var $checkbox = $el.find('input[type="checkbox"]');

      // only toggle if either the checkbox is already checked
      // or the chooser is not full. Always release a checked box
      if ($checkbox.prop('checked') || (!(self.chooser && self.chooser.full))) {
        $el.toggleClass('apos-focus');
        $checkbox.prop('checked', function(i, currentState) { return !currentState; });
        $checkbox.trigger('change');
        $el.toggleClass('apos-focus', $checkbox.prop('checked'));
      }
    };

    var superAfterRefresh = self.afterRefresh;
    self.afterRefresh = function() {
      self.$gridView = self.$el.find('.apos-manage-view');
      self.$gridItems = self.$el.find('.apos-manage-grid-piece');
      superAfterRefresh();
    };

    var superDisplayChoiceInCheckbox = self.displayChoiceInCheckbox;
    self.displayChoiceInCheckbox = function(id, state) {
      var $checkbox = superDisplayChoiceInCheckbox(id, state);
      $checkbox.parent('label').toggleClass('apos-focus', state);
      $checkbox.closest('[data-piece]').toggleClass('apos-focus', state);
      return $checkbox;
    };

    self.enableSearch = function() {
      var isListening = false;
      var inputSelector = '[name="search-' + self.options.name + '"]';

      self.$filters.on('keyup', inputSelector, function(e) {
        var $input = $(e.target);
        var $search = self.$filters.find('.apos-modal-filters-search');
        var $suggestionsList = $search.find('.ui-autocomplete');
        var $activeItem = $suggestionsList.find('li.ui-menu-item.active');
        var listener = getListener($search);

        if (e.keyCode === 13) {
          return search($input, $activeItem);
        }

        if ([38, 40].includes(e.keyCode)) {
          return selectItems($suggestionsList, $activeItem, e.keyCode);
        }

        var options = {
          term: $input.val()
        };

        self.api('suggestions', options, function(results) {
          if (results && results.length) {
            var suggestions = '<ul class="ui-autocomplete">';
            results.forEach(function (result, i) {
              suggestions = suggestions.concat('<li class="ui-menu-item">' + result + '</li>');
              if (i === results.length - 1) {
                suggestions = suggestions.concat('</ul>');
              }
            });

            $search.find('ul').remove();
            $search.append(suggestions);

            $search.find('ul > .ui-menu-item').each(function (i, elem) {
              var $el = $(elem);

              $(elem).on('click', function() {
                search($input, $el);
              });
            });

            if (!isListening) {
              isListening = true;
              window.addEventListener('click', listener);
            }

          } else {
            if (isListening) {
              listener();
            }
          }
        });
      });

      function search ($input, $activeItem) {
        var val;
        if ($activeItem && $activeItem.length) {
          val = $activeItem.text();
        } else {
          val = $input.text();
        }

        self.search = val;
        self.currentFilters.page = 1;
        $input.focus();

        self.refresh(function() {
          // refocus input element after search
          $input.focus();
          // put the search query before the cursor
          $input.val(val);
        });
      };

      function getListener ($search) {
        return function listener () {
          $search.find('ul').remove();
          isListening = false;
          window.removeEventListener('click', listener);
        };
      };

      function selectItems ($suggestionsList, $activeItem, keyCode) {
        if (!$suggestionsList.length) {
          return;
        }

        var isDown = keyCode === 40;
        var firstOrLastSelector = ':last-child';
        if (isDown) {
          firstOrLastSelector = ':first-child';
        }

        if ($activeItem.length) {
          var $nextItem;
          if (isDown) {
            $nextItem = $activeItem.next();
          } else {
            $nextItem = $activeItem.prev();
          }

          if ($nextItem.length) {
            $nextItem.focus().addClass('active');
          }
          $activeItem.removeClass('active');

        } else {
          $suggestionsList.find('li' + firstOrLastSelector).focus().addClass('active');
        }
      }
    };

  }
});
