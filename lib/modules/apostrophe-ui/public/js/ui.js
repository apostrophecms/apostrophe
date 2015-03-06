apos.define('apostrophe-ui', {

  afterConstruct: function(self) {
    $(function() {
      self.enablePrefix();
      self.enableShift();
      self.enableSelectize();
      self.enableMenus();
      self.enableSkipdown();
      self.enableClickUrl();
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

    self.enableMenus = function() {
      // Enable toggles. Note the use of $('body').on('click', 'selector'...)
      // to avoid problems with elements added later
      $('body').on('click', '.apos-accordion-title', function(event){
        // $(this).parent().find('.apos-accordion-items').toggleClass('open');
        var opened;
        if($(this).parent().hasClass('open')){
          opened = true;
        }
        $('body').trigger('aposCloseMenus');
        if (!opened){
          $(this).parent().toggleClass('open');
          $('.apos-admin-bar').addClass('item-open');
        }

        //$(this).parent().siblings().removeClass('open');
      });

      $('body').on('click', '.apos-preview-toggle', function(event){
        $('.apos-preview-toggle').toggleClass('previewing');
        $('body').toggleClass('previewing');
      });

      // Close menus when an item is picked please!
      $('body').on('click', '.apos-accordion-items .apos-control', function() {
        $('body').trigger('aposCloseMenus');
      });

      //Call for when media or tag editor is opened
      $('body').on('click', '.apos-admin-bar-item > .apos-button', function(){
        $('.apos-admin-bar').addClass('item-open');
        $('body').trigger('aposCloseMenus');
      });

      $('body').on('aposCloseMenus', function(){
        $('.apos-admin-bar-item').removeClass('open');
        $('.apos-admin-bar').removeClass('item-open');
      });

      //sets up listeners for tabbed modals
      $('body').on('click', '.apos-modal-tab-title', function(){
        $(this).closest('.apos-modal-tabs').find('.apos-active').removeClass('apos-active');
        $(this).closest('.apos-modal-tabs').find('[data-tab-id="'+$(this).attr('data-tab')+'"]').addClass('apos-active');
        $(this).addClass('apos-active');
      });
    };

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
  }
});

