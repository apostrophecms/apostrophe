// Provides apos.ui, a singleton that provides user interface features
// used throughout Apostrophe on the browser side.
//
// ## Properties of interest
//
// ### apos.ui.shiftActive
//
// True whenever the shift key is down.

apos.define('apostrophe-ui', {

  afterConstruct: function(self) {
    $(function() {
      self.enablePrefix();
      self.enableShift();
      self.enableClickUrl();
      self.enableStyledFileButtons();
      self.enableActionable();
      self.enhanceDropdowns();
      self.enableAjax();
    });
  },

  construct: function(self, options) {

    self.options = options;

    // Utility that lets you add a tooltip to any HTML element using
    // the data-apos-tooltip="YR TOOLTIP MSG" pattern

    // If using outside of the current implementation (widget controls and chooser controls)
    // you need assign your own event handlers

    self.prepTooltip = function() {
      var $tooltip = $('[data-apos-tooltip-template]');
      var $clone = $tooltip.clone();
      return $clone
        .removeAttr('data-apos-tooltip-template')
        .attr('data-apos-tooltip', 'true')
        .removeClass('apos-hidden');
    };

    self.createTooltip = function($el) {
      var $body = $('body');
      var $this = $(this);
      var $newTooltip = self.prepTooltip().clone();
      var left = $this.offset().left;
      var top = $this.offset().top;
      var width = $this.outerWidth();
      var height = $this.outerHeight();

      $newTooltip.text($this.attr('data-apos-tooltip'));

      $body.prepend($newTooltip);

      left = left - ($newTooltip.outerWidth() / 2) + (width / 2);
      top = top - (height + 10);

      // If tooltip will rise above the viewport, put it on the bottom

      if (top < 0) {
        $newTooltip.addClass('apos-tooltip--bottom');
        top = $this.offset().top + height + 10;
      }

      $newTooltip.css({
        top: top + 'px',
        left: left + 'px'
      });

      $newTooltip.addClass('apos-tooltip--visible');

      scheduleRemoveTimeout();
      // If the parent has been removed from the DOM we need
      // to clean up since we're not nested in the DOM
      function removeIfParentRemoved() {
        if (!$newTooltip.closest('body').length) {
          // Already removed
          return;
        }
        if (!$this.closest('body').length) {
          $newTooltip.remove();
        } else {
          scheduleRemoveTimeout();
        }
      }
      function scheduleRemoveTimeout() {
        setTimeout(removeIfParentRemoved, 200);
      }
    };

    self.removeTooltip = function() {
      var $body = $('body');
      var $tooltip = $body.find('[data-apos-tooltip="true"]');
      $tooltip.one('webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend', function() {
        $tooltip.remove();
      });
      $tooltip.removeClass('apos-tooltip--visible');
    };

    self.infiniteScrollOffset = self.options.infiniteScrollOffset || 500;

    // Sets apos.ui.shiftActive whenever the shift key is down.

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

    // Utility that lets you add the data attribute 'data-apos-actionable' to any element and have
    // its `apos-active` class be toggled on click.
    //
    // Optionally you can give the attr a value which can be used to target another element's active
    // class to be toggled.

    self.enableActionable = function() {
      var $body = $('body');
      $body.on('click', '[data-apos-actionable]', function(event) {
        var $el = $(this);
        if ($el.attr('data-apos-actionable')) {
          $el.closest('[' + $el.attr('data-apos-actionable') + ']').toggleClass('apos-active');
        } else {
          $el.toggleClass('apos-active');
        }
      });
    };

    // Implement automatic width adjustment for `[data-apos-dropdown]` menus that have a
    // `[data-apos-dropdown-button-label]`.

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
            var extra = ($(this).find('[data-apos-dropdown-items]')[0].getBoundingClientRect().width - $label[0].getBoundingClientRect().width + val);
            $label.css('padding-right', extra);
            $label.attr('data-apos-dropdown-button-label', 'active');
          }
        }
      });
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
        var matches = hash.match(/^#click-(.*)$/);
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

    // If Apostrophe has a global URL prefix, patch
    // jQuery's AJAX capabilities to prepend that prefix
    // to any non-absolute URL. This assists in avoiding the
    // need for application code to be specifically prefix-aware
    // and allows the prefix to be changed whenever needed.
    // See also [apostrophe-express](/reference/modules/apostrophe-express.md)

    self.enablePrefix = function(prefix) {

      if (prefix) {
        $.ajaxPrefilter(function(options, originalOptions, jqXHR) {
          if (options.url) {
            if (!options.url.match(/^[a-zA-Z]+:/)) {
              options.url = prefix + options.url;
            }
          }

        });
      }
    };

    // Click the original file upload button if the styled
    // proxy for it is clicked. Allows indirect styling of
    // file buttons
    self.enableStyledFileButtons = function() {
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

    self.globalBusyStack = [];

    // Call this method when the global busy mechanism is in effect, but
    // you need to temporarily suspend it and allow interaction again.
    // Must be paired with a call to `popGlobalBusy`. This is probably
    // not what you need for most situations, see `globalBusy`.
    //
    // If the global busy mechanism was not in effect in the first place, that is
    // handled gracefully.

    self.pushGlobalBusy = function() {
      var counter = self.globalBusyCounter;
      self.globalBusyStack.push(counter);
      var i;
      for (i = 0; (i < counter); i++) {
        self.globalBusy(false);
      }
    };

    // Call this method when the global busy mechanism has been suspended,
    // and you are ready to allow it back into effect.
    // Must be paired with a call to `pushGlobalBusy`. This is probably
    // not what you need for most situations, see `globalBusy`.
    //
    // If the global busy mechanism was not in effect in the first place, that is
    // handled gracefully.

    self.popGlobalBusy = function() {
      var counter = self.globalBusyStack.pop();
      var i;
      for (i = 0; (i < counter); i++) {
        self.globalBusy(true);
      }
    };

    // Do not call this method yourself. It is called
    // by self.globalBusy to display the global spinner.
    // Feel free to override this method to change the UI.

    self.globalLock = function() {
      self.globalLockAt = Date.now();
      var $freezer = $('<div class="apos-global-busy"></div>');
      $('body').append($freezer);
      $freezer.focus(); // focus adds a tick before triggering the active transition
      $freezer.addClass('active');
    };

    // Do not call this method yourself. It is called
    // by self.globalBusy to hide the global spinner.
    // Feel free to override this method to change the UI.

    self.globalUnlock = function() {
      var elapsed = Date.now() - self.globalLockAt;
      var $freezer = $('.apos-global-busy');
      $freezer.removeClass('active');
      $('body').one('webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend', function() {
        $freezer.remove();
      });
      // As a fallback, remove on a timer. Wait for as long as we were locked
      // or 0.5 seconds, whichever is shortest. This covers the longest
      // possible time for the transition without interfering with the
      // transition. The use case is situations where the transition never fires,
      // which has been documented when the busy spinner only appears for a very
      // short time. -Tom
      setTimeout(function() {
        $freezer.remove();
      }, Math.min(elapsed, 0.5));
    };

    // Simple progress display. Enables a progress display
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
    // (you should provide a non-prefixed path). Note that
    // when prefixes are in use it is especially important
    // to use this method rather than simply setting
    // `window.location.href` yourself.

    self.redirect = function(slug) {
      var href = apos.prefix + slug;
      if (href === window.location.href) {
        window.location.reload();
      } else {
        window.location.href = href;
      }
    };

    // Enhance a plaintext date field with a pikaday date widget.

    self.enhanceDate = function($el, options) {
      if (!options) {
        options = {};
      }

      // eslint-disable-next-line no-new
      new Pikaday(_.merge({
        field: $el[0],
        format: 'YYYY-MM-DD'
      }, options));
    };

    // Enhance a plaintext color field with Spectrum
    self.enhanceColorpicker = function($el, data, options) {
      var $preview = $el.prev();
      var $label = $el.next();

      options.move = updateUi;
      options.change = updateUi;
      options.hide = updateUi;
      // initialize
      $el.spectrum(options);

      // set up preview on load
      if ($el.spectrum('get')) {
        populateColorpicker(options.color);
      } else {
        emptyColorpicker();
      }

      function updateUi(color) {
        if (color) {
          populateColorpicker(color.toString());
          $el.val(color.toString());
        } else {
          emptyColorpicker();
        }
      }

      function emptyColorpicker() {
        $label.text($el.attr('data-apos-color-empty-label'));
        $preview.addClass('apos-field-input-color-preview--empty');
        $preview.css('background-color', '');
      };

      function populateColorpicker(color) {
        if (color) {
          $label.text(color);
          $preview.removeClass('apos-field-input-color-preview--empty');
          $preview.css('background-color', color);
        }
      }
    };

    // Converts apostrophe-schemas 24 hour time field strings
    // to local time. The format string depends on the
    // `userTimeFormat` option passed to this module, which
    // defaults to US 12 hour time. It must be understandable
    // by `launder.time`, however that method is very tolerant.

    self.formatTime = function(time, options) {
      if (!options) {
        options = {};
      }

      return moment(time, 'HH:mm:ss').format(self.options.userTimeFormat);
    };

    // Status of the shift key. Dynamically updated.
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
    // self.link('apos-manage', 'blogPost', fn)
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
    //
    // The `object` argument may be null if the language doesn't
    // flow that way, for example 'apos-workflow-export' does not
    // end with a noun, so just pass it as `verb`.

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

    self.enableAjax = function() {
      $('body').on('submit', '[data-apos-ajax-context] form', self.ajaxSubmitHandler);
      $('body').on('click', '[data-apos-ajax-context] a', self.ajaxClickHandler);
      $(window).on('popstate', function(event) {
        self.ajaxPopStateHandler(event);
      });

      $(function() {
        self.ajaxInfiniteScrollHandler();
        $(window).on('scroll', _.throttle(function() {
          self.ajaxInfiniteScrollHandler();
        }, 200));
      });
    };

    self.ajaxInfiniteScrollHandler = function() {
      var $infiniteScroll = $('[data-apos-ajax-infinite-scroll]');
      if (!$infiniteScroll.length) {
        return;
      }
      $infiniteScroll.each(function() {
        var $el = $(this);
        if ($el.data('aposSeen')) {
          return;
        }
        var scrollElement = document.scrollingElement || document.documentElement;
        var scrollBottom = scrollElement.scrollTop + $(window).height();
        var top = $el.offset().top;
        if (top - self.infiniteScrollOffset <= scrollBottom) {
          $el.data('aposSeen', 1);
          $el.trigger('click');
        }
      });
    };

    self.ajaxSubmitHandler = function(event) {
      var $form = $(this);
      var method = $form.attr('method') || 'GET';
      // For consistency with the standard behavior of GET method forms, we must blow out anything else in the query
      // string before we serialize. Combining the "here" macro with an input text field isn't an AJAX problem, it's
      // a preexisting issue. -Tom
      var action = $form.attr('action') || (window.location.href.replace(/\?.*$/, ''));
      if (!self.isAjaxUrl(action)) {
        return true;
      }
      // if an empty "relative" URL doesn't work we can consider using:
      // (window.location.pathname.replace(new RegExp('^' + apos.utils.regExpQuote(apos.prefix)), ''));
      var data = $form.serialize();
      self.ajaxGo(self.ajaxContextOf($form), action, data, { method: method });
      return false;
    };

    self.ajaxClickHandler = function(event) {
      var $anchor = $(this);
      // Fun fact: the attribute is relative but the property is absolute, which is useful here
      var href = this.href;
      if (!self.isAjaxUrl(href)) {
        return true;
      }
      if ($anchor.attr('data-apos-no-ajax')) {
        return true;
      }
      var target = $anchor.attr('target');
      if (target) {
        // Let the event proceed normally
        return true;
      }
      self.ajaxGo(self.ajaxContextOf($anchor), href);
      return false;
    };

    // Given a jQuery object, return the name of the ajax context containing it
    // (the `data-apos-ajax-context` attribute of its closest ancestor that has one).

    self.ajaxContextOf = function($el) {
      return $el.closest('[data-apos-ajax-context]').attr('data-apos-ajax-context');
    };

    // Refresh the named `data-apos-ajax-context` with the content returned by the specified
    // URL. The URL is submitted with the additional query data specified by `data`, if any;
    // it may be a string (the output of serializing a form) or an object for convenience.
    // The URL will be pushed to the browser history as specified unless `options.push`
    // is explicitly `false`.
    //
    // Any text input or textarea fields, and any other elements with a distinct data-apos-ajax-preserve
    // attribute, are NOT refreshed; their ancestors are also not refreshed. This prevents loss of
    // focus when typing which is a very severe cross browser problem otherwise.
    //
    // After the replacement takes place, the `enhance` and `ajax` Apostrophe events
    // are emitted, in that order, with a jQuery object containing the ajax context div
    // as the argument.
    //
    // Note that your event handlers for these should watch out for preserved elements and
    // their ancestors, and not do things twice. You can address this by checking for
    // `data-apos-ajax-preserve` and `data-apos-ajax-preserved` attributes.
    //
    // If `url` or `data` contains an `append` parameter set to `1`, then the portion of
    // the new content that falls within an element with the `data-apos-ajax-append` attribute
    // is appended to the corresponding element already nested within `data-apos-ajax-content`.
    // However everything *not* in side the `data-apos-ajax-append` element is replaced in the
    // usual way. So you can refresh the "load more..." button itself, filters, etc. even when
    // appending just one page of content. This is useful for "load more..." buttons and
    // infinite scroll.

    self.ajaxGo = function(name, url, data, options) {
      data = data || {};
      var $old = $('[data-apos-ajax-context="' + name + '"]');
      var $appendTo = $old.find('[data-apos-ajax-append]');
      var append = false;
      var hasAposAjax = false;
      var oldTop;

      if (url.match(/[?&]append=1/)) {
        append = true;
      }

      // A form serialization will already be a string; other callers might pass
      // an object they want us to handle serializing for them. Either way
      // add an apos-ajax=1 parameter if not present

      if (url.match(/[?&]apos-ajax=1/)) {
        hasAposAjax = true;
      }

      if (typeof (data) === 'string') {
        if (!hasAposAjax) {
          if (data.match(/=/)) {
            data += '&apos-ajax=1';
          } else {
            data += 'apos-ajax=1';
          }
        }
        if (data.match(/(^|&)append=1/)) {
          append = true;
        }
      } else if (typeof (data) === 'object') {
        if (!hasAposAjax) {
          data['apos-ajax'] = 1;
        }
        if (data.append) {
          append = true;
        }
      }

      options = _.extend({
        method: 'GET',
        append: append
      }, options || {});

      if (append) {
        options.push = false;
      }

      apos.emit('beforeAjax', $old);

      $.ajax({
        url: url,
        method: options.method,
        // Presence of a special query parameter to keep this from being cached as the
        // content for a full page
        data: data,
        success: function(html) {
          var url = this.url;
          if (options.push !== false) {
            self.ajaxPushHistory(name, url);
          }
          var $new = $('<div></div>');
          var $appending;
          $new.html(html);
          if (append) {
            // the replacement algorithm changes the scrolling position,
            // which is good for pagination but bad for appending, so make
            // a note of the old scrolling position
            var scrollElement = document.scrollingElement || document.documentElement;
            oldTop = scrollElement.scrollTop;
            $appending = $new.find('[data-apos-ajax-append]');
            $appending.prepend($appendTo.contents());
          }
          self.replaceUnpreserved($old, $new, { text: true });
          // Note that this may enhance preserved elements twice. If this is
          // a concern you can avoid it by checking for `data-apos-ajax-preserved`
          apos.emit('enhance', $old);
          apos.emit('ajax', $old);
          if (append) {
            $('html, body').scrollTop(oldTop);
            $old.imagesReady(function() {
              // In case one page of content did not actually
              // add enough content to pass the bottom of the screen,
              // check whether infinite scroll should fire again
              self.ajaxInfiniteScrollHandler();
            });
          }
        },
        error: function(err) {
          self.ajaxError(err);
        }
      });

      return false;

    };

    self.ajaxPopStateHandler = function(event) {
      // jQuery hasn't normalized this one yet, so we need to go to the original for the state
      event = event.originalEvent;
      if (event.state && event.state.aposAjax) {
        self.ajaxGo(event.state.aposAjax.name, document.location.href, null, { push: false });
      }
    };

    // Push the specified URL to the browser history, associating it with the named data-apos-ajax-context
    // element in the page. Any apos-ajax query parameter is stripped off so that the history shows
    // full-page URLs rather than ajax refresh URLs. You will not need to call this method yourself. It is
    // called for you by `ajaxGo`.

    self.ajaxPushHistory = function(name, url) {
      // We don't want the extra query parameter that prevents IE from caching the ajax response as a regular
      // full page response to be in the history
      url = url.replace('&apos-ajax=1', '');
      url = url.replace('?apos-ajax=1', '?');
      url = url.replace(/\?$/, '');
      // Call pushState if the browser supports it, if not our graceful degradation is that you don't get
      // "back" support, pretty reasonable considering how rare IE9 is now
      if (('history' in window) && ('pushState' in window.history)) {
        if (!self.ajaxStatePushed) {
          // If this is our first push, establish a state object for the
          // original URL, so we can click "back" to undo our first AJAX click
          window.history.replaceState({ aposAjax: { url: window.location.href, name: name } }, $('title').text(), window.location.href);
          self.ajaxStatePushed = true;
        }
        window.history.pushState({ 'aposAjax': { url: url, name: name } }, $('title').text(), url);
      }
    };

    // Returns true if the given URL is appropriate for an AJAX update when found
    // within `data-apos-ajax-context`. To avoid unexpected results the default behavior
    // is quite conservative: the URL must be the same as the current page, except
    // for the query string and/or hashtag.

    self.isAjaxUrl = function(url) {
      // Fun fact: the `href` property of an anchor DOM element is always absolute, so we can
      // use this to resolve URLs
      var $anchor = $('<a></a>');
      $anchor.attr('href', url);
      // Lop off query string and beyond, or hashtag and beyond, whichever comes first
      var absoluteNew = $anchor[0].href.replace(/[?#].*$/, '');
      var absoluteOld = window.location.href.replace(/[?#].*$/, '');
      // Normalize trailing slashes
      absoluteNew = absoluteNew.replace(/\/$/, '');
      absoluteOld = absoluteOld.replace(/\/$/, '');

      return absoluteNew === absoluteOld;
    };

    self.ajaxError = function(err) {
      apos.utils.error(err);
      apos.notify('Unfortunately a server error occurred. Please try again later.', { type: 'error', dismiss: true });
    };

    // This method is used to AJAX-refresh forms without breaking text input in progress
    // and can also be used to single out other elements for preservation during an
    // ajax replace.
    //
    // The jquery objects $old and $new represent HTML container elements. $old is
    // something currently in the DOM such as a form. $new is newly constituted from an AJAX call.
    // Replace the contents of $new with the contents of $old, except that elements
    // of $old with a data-apos-ajax-preserve attribute are preserved, and of
    // necessity their ancestors are also preserved, because removing an input element
    // from the DOM temporarily is as bad as removing it forever as far as text input in
    // progress is concerned.
    //
    // Each preserved element must have a **unique value** for data-apos-ajax-preserve,
    // and this attribute must be consistent between $old and $new.
    //
    // If options.text is true, all text input and textarea elements are automatically
    // marked to be preserved, provided they have a name attribute.

    self.replaceUnpreserved = function($old, $new, options) {

      options = options || {};

      if (options.text) {
        autoPreserveText();
      }

      removeOrphans();
      tagAncestors($old);
      tagAncestors($new);
      cleanout($old);
      restore($old, $new);

      function autoPreserveText() {
        var $preserve = $old.find('input[name]:focus,textarea[name]:focus');
        $preserve.each(function() {
          var type = $(this).attr('type');
          // Watch out for input element types that are not actually text
          if (_.includes([ 'checkbox', 'radio', 'submit' ], type)) {
            return;
          }
          var $el = $(this);
          var name = $el.attr('name');
          attr($el, 'preserve', name);
          attr(findName($new, name), 'preserve', name);
        });
      }

      // If an element no longer exists in the new markup, then there is nothing to preserve, so don't try
      function removeOrphans() {
        var $alive = find($new, 'preserve');
        var $previous = find($old, 'preserve');
        $previous.each(function() {
          var $el = $(this);
          if (!isVal($alive, 'preserve', attr($el, 'preserve'))) {
            $el.remove();
          }
        });
      }

      // Tag ancestors of each preserved element as preserving it, in a way that uniquely tags them for each
      // preserved element, including indicating how many generations removed they are, so that we can find
      // equivalent parent elements between $old and $new
      function tagAncestors($context) {
        // If we don't do this they start doubling up on the second and subsequent refreshes
        find($context, 'preserves').removeAttr('data-apos-ajax-preserves');
        var $preserve = find($context, 'preserve');
        $preserve.each(function() {
          var $el = $(this);
          var level = 0;
          $el.parentsUntil($context).each(function() {
            var $ancestor = $(this);
            addPreserves($ancestor, $el, level);
            level++;
          });
        });
      }

      // Scrap all elements of $old that are neither preserved, nor preserving a descendant
      function cleanout($old) {
        $old.contents().each(function() {
          var $node = $(this);
          if (is($node, 'preserves')) {
            cleanout($node);
          } else if (is($node, 'preserve')) {
            // Leave it
          } else {
            $node.remove();
          }
        });
      }

      // Copy children of $new to $old except where a preserved element or its ancestor must be respected;
      // flow the new elements around those, after invoking recursively where appropriate
      function restore($old, $new) {
        // We append the next element after this point. If $after is not yet set, we prepend to $new
        // and then set $after to the node just prepended.
        var $after;
        $new.contents().each(function() {
          var $node = $(this);
          var handled = false;
          var $nodeOld;
          if (is($node, 'preserve')) {
            $nodeOld = findVal($old, 'preserve', attr($node, 'preserve'));
            $after = $nodeOld;
            handled = true;
          } else if (is($node, 'preserves')) {
            $nodeOld = findVal($old, 'preserves', attr($node, 'preserves'));
            if ($nodeOld.length) {
              restore($nodeOld, $node);
              $after = $nodeOld;
              handled = true;
            }
          }
          if (!handled) {
            if ($after) {
              $after.after($node);
            } else {
              $old.prepend($node);
            }
            $after = $node;
          }
        });
      }

      // Fetch an array of name:ancestorLevel pairs indicating what this element is preserving
      function getPreserves($el) {
        var val = attr($el, 'preserves');
        if (!val) {
          return [];
        }
        return val.split(',');
      }

      // Add a new name:ancestorLevel pair for the element specified by $preserve
      function addPreserves($el, $preserve, level) {
        attr($el, 'preserves', getPreserves($el).concat([ attr($preserve, 'preserve') + ':' + level ]).join(','));
      }

      // Find prefixed
      function find($el, key) {
        return $el.find('[data-apos-ajax-' + key + ']');
      }

      // Find prefixed with specified value
      function findVal($el, key, val) {
        return $el.find('[data-apos-ajax-' + key + '="' + val + '"]');
      }

      // .is() prefixed
      function is($el, key) {
        return $el.is('[data-apos-ajax-' + key + ']');
      }

      // is() prefixed with specified value
      function isVal($el, key, val) {
        return $el.is('[data-apos-ajax-' + key + '="' + val + '"]');
      }

      // .attr() prefixed, getter and setter
      function attr($el, key, val) {
        if (arguments.length === 2) {
          return $el.attr('data-apos-ajax-' + key);
        }
        $el.attr('data-apos-ajax-' + key, val);
      }

      // Find by name attribute, unprefixed, for autoprotecting input fields
      function findName($el, name) {
        return $el.find('[name="' + name + '"]');
      }

    };

    apos.ui = self;
  }
});
