apos.define('apostrophe-ui', {

  afterConstruct: function(self) {
    $(function() {
      self.enablePrefix();
      self.enableShift();
      self.enableSelectize();
      self.enablePreview();
      self.enableTabbedModals();
      self.enableSkipdown();
      self.enableClickUrl();
      self.enableStyledFileButtons();
      self.enableActionable();
      self.enhanceDropdowns();
      self.enhanceAdminMenu();
      apos.emit('enhance', $('body'));
    });
  },

  construct: function(self, options) {
    self.enableShift = function() {
      // Status of the shift key. Automatically updated.
      self.shiftActive = false;
      var $body = $('body');
      $body.keydown(function(e) {
        if (e.keyCode === 16) {
          self.shiftActive = true;
          apos.emit('shiftDown', e);
        }
      });

      $body.keyup(function(e) {
        if (e.keyCode === 16) {
          self.shiftActive = false;
          apos.emit('shiftUp', e);
        }
      });
    };

    self.enableSelectize = function() {

      // Extend selectize to initiate select options on startup.
      // This will allow us to show fields from the default value
      $.extend(Selectize.prototype, {
          superSetup: Selectize.prototype.setup,
          setup: function() {
              this.superSetup();
              this.refreshOptions(false);
          }
      });

      apos.on('enhance', function($el) {

        // Selectize - Single Select
        $el.find('select[data-selectize]:not(.apos-template select[data-selectize], [select="multiple"])').selectize({
          create: false,
          sortField: 'text',
          dataAttr: 'data-extra',
          searchField: ['label', 'value'],
          valueField: 'value',
          labelField: 'label',

          // We need to render custom templates to include our data-extra fields.
          //
          // If you need to include extra fields on a select option
          // format a JSON string in 'data-extra' like this:
          //
          // <option data-extra='{ "myField": "thing" }' > Label </option>
          //
          // -matt
          render: {
            item: function(data) {
              var attrs = ' data-value="'+data.value+'"';
              for (key in _.omit(data, ['value', 'label', '$order'])) {
                attrs = attrs + ' data-' + key + '="' + data[key] + '"';
              }
              return '<div data-selected ' + attrs + ' class="item">' + data.label + '</div>';
            },
            option: function(data) {
              var attrs = 'data-value="'+data.value+'"';
              for (key in _.omit(data, ['value', 'label', '$order'])) {
                attrs = attrs + ' data-' + key + '="' + data[key] + '"';
              }
              return '<div data-selectable ' + attrs + ' class="option">' + data.label + '</div>';
            }
          }
        });

        // Selectize - Multi Select
        $el.find('select[data-selectize][select="multiple"]:not(.apos-template select[data-selectize])').selectize({
          maxItems: null,
          delimiter: ', ',
        });
      });
    };

    self.enablePreview = function() {
      var $body = $('body');
      $body.on('click', '.apos-preview-toggle', function(event){
        console.log('REFACTOR THIS TO USE DATA ATTR');
        $('.apos-preview-toggle').toggleClass('previewing');
        $body.toggleClass('previewing');
      });
    }

    self.enableTabbedModals = function() {
      //sets up listeners for tabbed modals
      var $body = $('body');
      $body.on('click', '.apos-modal-tab-title', function(){
        console.log('REFACTOR THIS TO USE DATA ATTR');
        $(this).closest('.apos-modal-tabs').find('.apos-active').removeClass('apos-active');
        $(this).closest('.apos-modal-tabs').find('[data-tab-id="'+$(this).attr('data-tab')+'"]').addClass('apos-active');
        $(this).addClass('apos-active');
      });
    }


    // Utility that lets you add the data attribute 'data-apos-actionable' to any element and have
    // it's 'apos-active' class be toggled on click.
    // optionally you can give the attr a value which can be used to target another element's active
    // class be toggled.
    self.enableActionable = function() {
      var $body = $('body');
      $body.on('click', '[data-apos-actionable]', function(event) {
        var $el = $(this);
        if ($el.attr('data-apos-actionable')) {
          // $el.closest('[' + $el.attr('data-apos-actionable') + ']').toggleClass('apos-active');
          $el.closest('[' + $el.attr('data-apos-actionable') + ']').toggleClass('apos-active');
        } else {
          $el.toggleClass('apos-active');
        }
      });
    }

    self.enhanceAdminMenu = function() {
      var $bar = $('[data-apos-admin-bar]');
      var $dropdowns = $('[data-apos-dropdown]');
      $bar.css('overflow', 'visible');

      // on transitionend, turn overflow on so we can see dropdowns!
      $bar.find('[data-apos-admin-bar-items]').on('transitionend', function() {
        if ($bar.hasClass('apos-active')) {
          $bar.css('overflow', 'visible');
        } else {
          $bar.css('overflow', '');
        }
      });

      // when we collapse the menu, turn all dropdowns off
      $bar.find('[data-apos-admin-bar-logo]').on('click', function(){
        $bar.find('[data-apos-dropdown]').removeClass('apos-active');
      });

      // when the bar is clicked, make a note of it so we don't auto
      // collapse the menu from load
      $bar.on('click', function(){ $bar.addClass('apos-admin-bar--clicked') });

      setTimeout(function() {
        if (!$bar.hasClass('apos-admin-bar--clicked')) {
          $bar.removeClass('apos-active');
        }
      }, 3000);

      // when opening dropdowns, close other dropdowns
      $dropdowns.on('click', function(){
        $bar.find('[data-apos-dropdown]').not(this).removeClass('apos-active');
      });

    }

    self.enhanceDropdowns = function() {
      $('body').on('click change', '[data-apos-dropdown]', function(event) {
        event.preventDefault();
        var $this = $(this);
        if ($this.find('[data-apos-dropdown-button-label]').length) {
          // only adjust width for button'y dropdowns
          // not global menu dropdowns
          var $label = $(this).find('[data-apos-dropdown-button-label]');
          if ($label.attr('data-apos-dropdown-button-label') === 'active') {
            $label.css('padding-right', $label.attr('data-apos-original-right-padding'));
            $label.attr('data-apos-dropdown-button-label', '');
          } else {
            $label.attr('data-apos-original-right-padding', $label.css('padding-right'));
            var val = parseInt($label.attr('data-apos-original-right-padding').substring(0, $label.attr('data-apos-original-right-padding').length - 2));
            var extra = ($(this).find('[data-apos-dropdown-items]').outerWidth() - $label.outerWidth() + val );
            $label.css('padding-right', extra);
            $label.attr('data-apos-dropdown-button-label', 'active');
          }
        }
      })
    }

    self.enableSkipdown = function() {
      // If the URL ends in #skipdown, locate the element with the
      // attribute data-skip-down-to and scroll to it, then remove
      // #skipdown from the URL. Useful for "poor man's AJAX" situations
      // where a page refresh is needed but you don't want the user to
      // be forced to scroll past the logo, etc. again.

      if (document.location.hash === '#skipdown') {
        document.location.hash = '';
        // slice off the remaining '#' in modern browsers
        if (window.history && (typeof window.history.replaceState === 'function')) {
          history.replaceState({}, '', window.location.href.slice(0, -1));
        }
        // Must yield first or this has no effect in Chrome.
        setImmediate(function() {
          $('html, body').scrollTop($('[data-skip-down-to]').offset().top - 50);
        });
      }
    };

    // If the URL ends in: #click-whatever
    //
    // ... Then we locate an element with the attribute data-whatever,
    // and trigger a click event on it.
    //
    // This is useful for resuming an activity after requiring the
    // user to log in.

    self.enableClickUrl = function() {

      // Waiting long enough for both the click and the autoscroll to work is
      // tricky. We need to yield beyond DOMready so that other code installing click
      // handlers on DOMready has had time to do so. And we need to yield a little
      // extra time or the browser will crush our efforts to set scrollTop based on
      // its own idea of where we are on the page (at least in Chrome). ):

      setTimeout(function() {
        var hash = window.location.hash;
        var matches = hash.match(/^\#click\-(.*)$/);
        if (matches) {
          var $element = $('[data-' + matches[1] + ']');
          if ($element.length) {
            // Scroll back to the right neighborhood
            var offset = $element.offset();
            var scrollTop = offset.top - 100;
            $('html, body').scrollTop(scrollTop);
            // Now carry out the action
            $('[data-' + matches[1] + ']').trigger('click');
          }
        }
      }, 200);
    };

    self.enablePrefix = function(prefix) {
      // If Apostrophe has a global URL prefix, patch
      // jQuery's AJAX capabilities to prepend that prefix
      // to any non-absolute URL

      if (prefix) {
        $.ajaxPrefilter(function(options, originalOptions, jqXHR) {
          if (options.url) {
            if (!options.url.match(/^[a-zA-Z]+:/))
            {
              options.url = prefix + options.url;
            }
          }
          return;
        });
      }
    };

    self.enableStyledFileButtons = function() {
      // Click the original file upload button if the styled
      // proxy for it is clicked. Allows indirect styling of
      // file buttons
      $('body').on('click', '[data-file-styled]', function() {
        $(this).parent().children('input').click();
      });
    };

    self.globalBusyCounter = 0;

    // If state is true, the interface changes to
    // indicate Apostrophe is busy loading a modal
    // dialog or other experience that preempts other
    // activities. If state is false, the interface
    // is unlocked. Calls may be nested and the
    // interface will not unlock until all
    // locks are released.
    //
    // See also apos.busy for interactions that
    // only need to indicate that one particular
    // element is busy.

    self.globalBusy = function(state) {
      if (state) {
        self.globalBusyCounter++;
        if (self.globalBusyCounter === 1) {
          // Newly busy
          self.globalLock();
        }
      } else {
        self.globalBusyCounter--;
        if (!self.globalBusyCounter) {
          // newly free
          self.globalUnlock();
        }
      }
    };

    // Do not call this method yourself. It is called
    // by self.globalBusy to display the global spinner.
    // Freel free to override this method to change the UI.

    self.globalLock = function() {
      var $freezer = $('<div class="apos-global-busy"></div>');
      $('body').append($freezer);
    };

    // Do not call this method yourself. It is called
    // by self.globalBusy to hide the global spinner.
    // Freel free to override this method to change the UI.

    self.globalUnlock = function() {
      $('.apos-global-busy').remove();
    }

    // Simple progress display. Locates a progress display
    // inside the given element. If state is true, the
    // element with a [data-progress] attribute is shown,
    // otherwise the element with a [data-finished] attribute
    // is shown. Neither element is required. Supports
    // nested calls; does not revert to indicating complete
    // until the nesting level is 0.

    self.busy = function($el, state) {
      var busy = $el.data('busy') || 0;
      if (state) {
        busy++;
        $el.data('busy', busy);
        if (busy === 1) {
          $el.find('[data-progress]').show();
          $el.find('[data-finished]').hide();
        }
      } else {
        busy--;
        $el.data('busy', busy);
        if (!busy) {
          $el.find('[data-progress]').hide();
          $el.find('[data-finished]').show();
        }
      }
    };

    // Redirect correctly to the given location on the
    // Apostrophe site, even if the prefix option is in use
    // (you should provide a non-prefixed path)

    self.redirect = function(slug) {
      var href = apos.prefix + slug;
      if (href === window.location.href) {
        window.location.reload();
      } else {
        window.location.href = href;
      }
    };

    // Enhance a plaintext date field with a nice jquery ui date widget.
    // Just pass a jquery object referring to the text element as the
    // first argument.
    //
    // Uses the YYYY-MM-DD format we use on the back end.
    //
    // If $minFor is set, any date selected for $el becomes the
    // minimum date for $minFor. For instance, start_date should be the
    // minimum date for the end_date field.
    //
    // Similarly, if $maxFor is set, any date selected for $el becomes the maximum
    // date for $maxFor.

    self.enhanceDate = function($el, options) {
      if (!options) {
        options = {};
      }
      $el.datepicker({
        defaultDate: "+0w",
        dateFormat: 'yy-mm-dd',
        changeMonth: true,
        numberOfMonths: 1,
        onClose: function(selectedDate) {
          if (options.$minFor) {
            options.$minFor.datepicker( "option", "minDate", selectedDate);
          }
          if (options.$maxFor) {
            options.$maxFor.datepicker( "option", "maxDate", selectedDate);
          }
        }
      });
    };

    // Accepts a time in 24-hour HH:MM:SS format and returns a time
    // in the user's preferred format as determined by apos.data.timeFormat,
    // which may be either 24 or 12. Useful to allow 12-hour format editing
    // of times previously saved in the 24-hour format (always used on the back end).
    // Seconds are not included in the returned value unless options.seconds is
    // explicitly true. If options.timeFormat is set to 24 or 12, that format is
    // used, otherwise apos.data.timeFormat is consulted, which allows the format
    // to be pushed to the browser via apos.pushGlobalData on the server side
    //
    // For convenience, the values null, undefined and empty string are returned as
    // themselves rather than throwing an exception. This is useful when the absence of any
    // setting is an acceptable value.
    self.formatTime = function(time, options) {
      if ((time === null) || (time === undefined) || (time === '')) {
        return time;
      }
      if (!options) {
        options = {};
      }
      var timeFormat = options.timeFormat || apos.data.timeFormat || 12;
      var showSeconds = options.seconds || false;
      var matches, hours, minutes, seconds, tail;
      if (apos.data.timeFormat === 24) {
        if (showSeconds) {
          return time;
        } else {
          matches = time.match(/^(\d+):(\d+)(:(\d+))?$/);
          return matches[1] + ':' + matches[2];
        }
      } else {
        matches = time.match(/^(\d+):(\d+)(:(\d+))?$/);
        hours = parseInt(matches[1], 10);
        minutes = matches[2];
        seconds = matches[3];
        tail = minutes;
        if (showSeconds) {
          tail += ':' + seconds;
        }
        if (hours < 1) {
          return '12:' + tail + 'am';
        }
        if (hours < 12) {
          return apos.utils.padInteger(hours, 2) + ':' + tail + 'am';
        }
        if (hours === 12) {
          return '12:' + tail + 'pm';
        }
        hours -= 12;
        return apos.utils.padInteger(hours, 2) + ':' + tail + 'pm';
      }
    };

    // Status of the shift key. Automatically updated.
    self.shiftActive = false;

    // Add a callback when a link is clicked to trigger
    // a certain action.
    //
    // Example:
    //
    // self.link($el, 'edit', 'blogPost', fn)
    //
    // When a click occurs on anything inside $el with a
    // data-edit-blog-post attribute, invoke
    // "fn" with the jQuery element clicked and the value
    // of the attribute.
    //
    // self.link('manage', 'blogPost', fn)
    //
    // When a click occurs anywhere on the page
    // on something with a data-manage-blog-post
    // attribute, invoke "fn" with the jquery element
    // clicked and the value of that attribute.
    //
    // Event propagation and the default behavior of
    // the click event are both automatically stopped.
    //
    // The word "object" refers to "the object of the sentence."
    // It is a STRING, not a javascript object.

    self.link = function(sel, verb, object, callback) {
      if (arguments.length === 3) {
        callback = object;
        object = verb;
        verb = sel;
        sel = 'body';
      }
      var attribute;
      if (object === null) {
        attribute = 'data-' + apos.utils.cssName(verb);
      } else {
        attribute = 'data-' + apos.utils.cssName(verb) + '-' + apos.utils.cssName(object);
      }
      var attributeSel = '[' + attribute + ']';
      $(sel).on('click', attributeSel, function() {
        callback($(this), $(this).attr(attribute));
        return false;
      });
    };

    apos.ui = self;
  }
});
