// `apostrophe-modal` is a base class for modal dialog boxes. Define a new
// type that extends `apostrophe-modal`, set the `source` option to the
// name of a server-side route that outputs suitable HTML, extend the
// `beforeShow` method to add custom event handlers and dynamic content,
// and extend `saveContent` to take action when the `save` button is clicked.
//
// *Where the markup comes from*
//
// The `source` option is combined with the `action` option to arrive at
// the URL for fetching the modal's markup:
//
// `/action/source`
//
// `action` is usually pushed from the server side via `pushBrowserCall`,
// so that the server-side code can just implement its route via
// `self.route`. The route is a POST route. Any data present in the
// `body` option is passed as POST parameters.
//
// *Examples*
//
// The `apostrophe-tags`, `apostrophe-widgets` and `apostrophe-pieces` modules
// provide excellent examples of how modals are defined, created
// and populated.
//
// *An alternative to "save and cancel"*
//
// An alternative approach: if a single `save` operation doesn't make sense,
// you can implement buttons that perform actions immediately and use a "cancel"
// button labeled `Done` to close the modal.
//
// When a modal creates another modal, they "stack," unless the new
// modal has the `transition: slide` option and the top modal already
// on the stack has the `apos-modal-slideable` CSS class, in which case
// the new modal "slides in" creating a breadcrumb trail.
//
// Subclasses of `apostrophe-modal` can also provide a `$view` jQuery
// reference, in which case the new "modal" actually populates that div
// directly and doesn't actually block the page or display in its own
// modal dialog box. This is convenient when you wish to build up modals
// by composition.

apos.define('apostrophe-modal', {

  extend: 'apostrophe-context',

  afterConstruct: function(self) {

    // A new modal opened during a busy state = an exception to the busy state,
    // to gather information
    apos.ui.pushGlobalBusy();
    apos.ui.globalBusy(true);

    return async.series([
      self.getSource,
      function(callback) {
        self.saving = false;
        self.enableGlobalEventsOnce();
        self.enableLifecycleEvents();
        self.overrideFormSubmission();
        self.captureTitle();
        self.captureControls();
        self.captureFilters();
        self.captureInstructions();
        self.resetEl();
        self.setSelfReference();
        self.enableButtonEvents();
        self.enableBreadcrumbEvents();
        return setImmediate(callback);
      },
      self.beforeShow
    ], function(err) {
      apos.ui.globalBusy(false);
      if (err && self.$el) {
        self.hide();
        return;
      }
      if (err) {
        apos.utils.error(err);
        return;
      }
      self.show();
      self.afterShow();
    });
  },

  construct: function(self, options) {

    if (options.$view) {
      self.$view = options.$view;
    }

    self.body = options.body;
    self.$body = $('body');

    // Fetch rendered HTML to populate self.$el with the actual content
    // of the modal. The HTML is fetched from:
    //
    // self.options.action + '/' + self.options.source
    //
    // Via a POST request.
    //
    // If a `self.body` object exists it is passed to the server side
    // as POST parameters.
    //
    // Invoked for you as the first step of `afterConstruct`.

    self.getSource = function(callback) {
      return self.html(options.source, self.body || {}, function(html) {
        self.$el = $(html);
        return callback(null);
      }, function(err) {
        return callback(err);
      });
    };

    // Enables support for the escape key and click-outside-to-cancel
    // behaviors. The handlers are installed on first use and then
    // reused by any nested modals. Invoked for you as part of
    // `afterConstruct`.

    self.enableGlobalEventsOnce = function() {
      if (!apos.modalSupport.initialized) {
        apos.modalSupport.initialized = true;
        // Just ONE event handler for the escape key so we don't have
        // modals falling all over themselves to hide each other
        // consecutively.

        // Escape key should dismiss the top modal, if any

        $(document).on({
          'keydown.aposModal': function(e) {
            if (e.keyCode === 27) {
              apos.modalSupport.cancelTopModal();
              return false;
            }
          },
          'click.aposModal': function(e) {
            if (e.target.className === 'apos-modal-blackout') {
              apos.modalSupport.cancelTopModal();
              return false;
            }
          }
        });
      }
    };

    // Removes the global event handlers for ESC and click-outside-
    // to-close. Invoked when the last open modal closes.

    self.disableGlobalEvents = function() {
      // Leggo of the keyboard when there are no modals!
      // We can reinstall the handler when it's relevant.
      // Fewer event handlers all the time = better performance

      apos.modalSupport.initialized = false;
      $(document).off('keydown.aposModal');
      $(document).off('click.aposModal');
    };

    // Add event handlers for the cancel and save buttons,
    // [data-apos-cancel] and [data-apos-save]. If the save
    // also has the [data-next] attribute, the self.next() method
    // is invoked with no arguments after the normal save-and-close operation.
    // This is meant to allow "save and create another" behavior, which is
    // popular with experienced users.
    //
    // In this base class self.next() is not implemented.

    self.enableButtonEvents = function() {
      // TODO this should use .link for consistency
      self.$controls.on('click', '[data-apos-cancel]', function() {
        return self.cancel();
      });

      self.$controls.on('click', '[data-apos-save]', function() {
        var $button = $(this);
        self.save(function(err) {
          if (err) {
            return;
          }
          if ($button.is('[data-next]')) {
            // Up to you to implement this by setting
            // this nonexistent method in your subclass. Should
            // create another instance of [whatever]
            self.next();
          }
        });
        return false;
      });
    };

    // Enable clicks on the breadcrumb trail [data-modal-breadcrumb], which is
    // present when "stacked" modals "slide in" instead by setting the `transition`
    // option to `slide` when constructing the modal. The breadcrumb trail can
    // be used to back up to any point in the series of slides. All modals after
    // that point have their cancel operation invoked, starting with the
    // last/newest modal.

    self.enableBreadcrumbEvents = function() {
      self.$el.on('click', '[data-modal-breadcrumb]:first .apos-modal-breadcrumb-item', function() {
        var $item = $(this);
        var index = $item.data('aposBreadcrumbIndex');
        var slides = self.getSlides();
        var cancels = slides.length - index - 1;
        cancelUntilCurrent(null);
        function cancelUntilCurrent(err) {
          if (err) {
            // The user decided not to cancel at some level
            return;
          }
          if (!cancels) {
            return;
          }
          cancels--;
          self.getLastSlide().cancel(cancelUntilCurrent);
        }
      });
    };

    // Fetches the title of the modal from the element with
    // [data-modal-title] and records it in `self.title`. Called
    // as part of `afterConstruct`.

    self.captureTitle = function() {
      self.title = self.$el.find('[data-modal-title]:first').text();
    };

    // Locates the div that contains the controls for saving, cancelling,
    // and other top-level operations on this modal and stores a
    // jQuery reference to it in `self.$controls`. Part of the implementation
    // of the slide transition, which moves these controls to a shared div
    // outside of the individual slide modals for layout reasons.

    self.captureControls = function() {
      self.$controls = self.$el.find('[data-modal-controls]:first');
      self.setDepthAttribute(self.$controls);
    };

    // Locates the div that contains the filters for this modal and stores a
    // jQuery reference to it in `self.$modalFilters`. Part of the implementation
    // of the slide transition, which moves these filters to a shared div
    // outside of the individual slide modals for layout reasons. The name
    // `modalFilters` avoids a bc break with the pieces manager modal.

    self.captureFilters = function() {
      self.$modalFilters = self.$el.find('[data-modal-filters]:first');
      self.setDepthAttribute(self.$modalFilters);
    };

    // Locates the div that contains the instructions (the explanatory caption)
    // for the modal and stores a jQuery reference to it in `self.$instructions`.
    // Part of the implementation of the slide transition, which moves these
    // controls to a shared div outside of the individual slide modals for
    // layout reasons.

    self.captureInstructions = function() {
      self.$instructions = self.$el.find('[data-modal-instructions]:first');
      self.setDepthAttribute(self.$instructions);
    };

    // Part of the implementation of the slide transition. When sliding a
    // new modal in, `self.$el` is reset to the `[data-modal-content]` element
    // within the modal, so that event handlers relying on `self.$el` work
    // reasonably after the original modal div is diced up to move the
    // controls, filters and instructions to one area of the slide container and
    // the content div to another.
    //
    // If this modal does not have the `{ transition: 'slide' }` option,
    // or there is no modal already open with the `apos-modal-slideable`
    // CSS class, this method does nothing.
    //
    // The original div is captured in `self.$shell`, which is currently used
    // only as a test for whether the modal is a slide.

    self.resetEl = function() {
      if (self.$view || (self.options.transition !== 'slide')) {
        return;
      }

      if (!self.getSlideableAncestorEl()) {
        return;
      }

      self.$shell = self.$el;
      var $content = self.$el.find('[data-modal-content]:first');
      self.$el = $content;
    };

    // Part of the implementation of the `slide` transition. Checks the
    // most recent non-sliding modal in the stack to see whether it has
    // the `apos-modal-slideable` CSS class and, if so, returns
    // a jQuery reference to that modal.

    self.getSlideableAncestorEl = function() {
      var stack = apos.modalSupport.stack;
      if (!stack.length) {
        return false;
      }
      var $slideableAncestorEl = stack[stack.length - 1];

      if (!$slideableAncestorEl.hasClass('apos-modal-slideable')) {
        return false;
      }

      return $slideableAncestorEl;
    };

    // Records a reference to the modal in the `aposModal` jQuery data
    // attribute of `self.$el`, the div corresponding to the modal.
    // Invoked by `afterConstruct`.

    self.setSelfReference = function() {
      self.$el.data('aposModal', self);
    };

    // Adds jQuery event handlers to `self.$el`, the div corresponding to
    // the modal, for the `aposModalCancel` and `aposModalHide` events.

    self.enableLifecycleEvents = function() {
      self.$el.on('aposModalCancel', function() {
        // so we don't wind up passing an event as a "callback"
        return self.getLastSlide().cancel();
      });
      self.$el.on('aposModalHide', function() {
        self.getLastSlide().hide();
      });
      $(window).on('beforeunload', self.beforeunload);
    };

    self.beforeunload = function() {
      if (self.unsavedChanges) {
        return self.getBeforeUnloadText();
      }
    };

    // Return the last slide, or the modal itself if it has no nested slides.
    // Returns the `apostrophe-modal` object, not a jQuery element. Use findSafe
    // so we are not faked out by nested views.

    self.getLastSlide = function() {
      var $slides = self.$el.findSafe('[data-modal-content]', '[data-modal-content]');
      if ($slides.length <= 1) {
        return self;
      }
      var $last = $slides.eq($slides.length - 1);
      return $last.data('aposModal');
    };

    // Returns the `apostrophe-modal` objects corresponding to each
    // slide nested in this modal, which presumably is a slide parent
    // modal (one with the `apos-modal-slideable` CSS class). The
    // slides are returned in the order they slid in, so the deepest
    // (currently visible) slide is the last in the array. Used by
    // the breadcrumb trail mechanism that displays the titles of
    // all of the slides and allows clicking to jump backwards,
    // closing intervening slides.

    self.getSlides = function() {
      var $slides = self.$el.find('[data-modal-content]');
      var slides = [];
      $.each($slides, function() {
        slides.push($(this).data('aposModal') || self);
      });
      return slides;
    };

    // Displays the modal. The `enhance` Apostrophe event is triggered,
    // with `self.$el` as the argument, allowing progressive enhancement
    // to take place. If the modal has a `$view` option, it is appended
    // to that div rather than displaying as a modal normally would.
    //
    // Otherwise, if the `transition` option is set to `slide` and
    // the top modal already on the stack has the `apos-modal-slideable`
    // CSS class, the new modal "slides in," adding its title to the
    // breadcrumb trail.
    //
    // Otherwise, the modal is pushed onto the stack, appearing on
    // top of the previous modal if any.
    //
    // Note that `self.beforeShow(callback)` and `self.afterShow()` are
    // provided for your overriding convenience. Usually it is better
    // to override these rather than changing the implementation of
    // `self.show()` to do extra work.

    self.show = function() {
      apos.emit('enhance', self.$el);

      if (self.$view) {
        // Remove elements that are inappropriate in a view and
        // can cause problems for regression testing selectors
        self.$el.find('[data-modal-breadcrumb]').remove();
        self.$el.find('[data-modal-controls]').remove();
        // Append ourselves to the appropriate placeholder div
        self.$view.append(self.$el);
        // Make sure the parent can enumerate it as a view
        self.$view.attr('data-view', '');
        // Make sure we can be found from it
        self.$view.data('view', self);
        self.$view.show();
        self.$el.show();
      } else {
        if (self.options.transition === 'slide') {
          self.slideIn();
        } else {
          self.stackPush();
        }
        apos.modalSupport.depth++;
      }
      self.refreshBreadcrumb();
      _.each(self.getViews(), function(view) {
        view.show();
      });
      self.resizeContentHeight();
      self.focusFirstFormElement();
      self.shown = true;
    };

    // Invoked for you by `self.show()`, this method causes the modal
    // to "slide in" and add itself to the breadcrumb trail if the top
    // modal on the stack has the `apos-modal-slideable` CSS class.
    // Otherwise it defaults to calling `self.stackPush()` instead,
    // causing the modal to appear normally on top of any modals
    // already open.

    self.slideIn = function() {

      if (!self.slid) {
        self.slid = true;
      }
      self.$slideableAncestorEl = self.getSlideableAncestorEl();
      if (!self.$slideableAncestorEl) {
        return self.stackPush();
      }

      // due to resetEl self.$el is already just data-modal-content at this point
      var $content = self.$el;
      self.setDepthAttribute($content);

      var $currentControls = self.$slideableAncestorEl.find('[data-modal-controls]:visible:first');
      self.$previousControls = $currentControls;
      // If we hide and show rather than using replaceWith it's more efficient, but more
      // importantly, we don't lose all of our event handlers. -Tom and Matt
      $currentControls.hide();
      $currentControls.after(self.$controls);

      var $currentFilters = self.$slideableAncestorEl.find('[data-modal-filters]:visible:first');
      self.$previousFilters = $currentFilters;
      $currentFilters.hide();
      $currentFilters.after(self.$modalFilters);

      var $currentInstructions = self.$slideableAncestorEl.find('[data-modal-instructions]:visible:first');
      self.$previousInstructions = $currentInstructions;
      $currentInstructions.hide();
      $currentInstructions.after(self.$instructions);

      var $wrapper = self.$slideableAncestorEl.find('[data-modal-contents]:first');

      $wrapper.append($content);

      // we need a gap of time to trigger the transition
      setImmediate(function() {
        $wrapper.find('[data-modal-content]').removeClass('apos-modal-slide-current');
        var fired = false;
        $content.one('webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend', function() {
          if (fired) {
            // Has been seen firing twice in nightwatch tests, in spite of `one`
            return;
          } else {
            fired = true;
          }
          self.indicateCurrentModal(true);
        });
        $content.addClass('apos-modal-slide-current');
      });

    };

    // Make the current modal's depth available as an attribute on various
    // elements such as `data-apos-modal-instructions`. This is needed for
    // reliable Nightwatch testing
    self.setDepthAttribute = function($el) {
      $el.attr('data-apos-modal-depth', apos.modalSupport.depth);
    };

    // Called for you by `self.show()`, this method adds the modal to
    // the stack, blacking out the page, preventing unwanted interaction
    // with the page while the modal is active, and stacking on top of
    // any modals already open, if any. This is normal behavior for
    // modals that do not have the `transition: 'slide'` option set,
    // and fallback behavior if there is no parent modal already on
    // the stack or the parent modal does not have the `apos-modal-slideable`
    // CSS class.

    self.stackPush = function() {
      // A true modal in the stack
      self.applyBlackout();
      // Remember scroll top so we can easily get back
      self.$el.data('aposSavedScrollTop', $(window).scrollTop());

      apos.modalSupport.stack.push(self.$el);

      apos.emit('modalStackPush');

      self.$el.addClass('apos-modal-stack-push');
      $('body').append(self.$el);

      self.$el.show();
      self.$el.removeClass('apos-modal-stack-push');

      // To simplify regression testing
      self.indicateCurrentModal(true);
    };

    // For ease of browser regression testing, make sure the current modal
    // and its proxies such as $instructions, $modalFilters, etc.
    // all have the data-apos-modal-current attribute, and
    // that nothing else does.

    self.indicateCurrentModal = function(adding) {
      if (adding) {
        apos.modalSupport.all.push(self);
      } else {
        var top = apos.modalSupport.getLatestModal();
        if (top !== self) {
          apos.utils.error('Types do not match in indicateCurrentModal');
        }
        apos.modalSupport.all.pop();
      }
      $('body [data-apos-modal-current]').removeAttr('data-apos-modal-current');
      var latest = apos.modalSupport.getLatestModal();
      if (latest) {
        _.each([ latest.$el, latest.$controls, latest.$modalFilters, latest.$instructions ], function($el) {
          $el.attr('data-apos-modal-current', latest.__meta.name);
        });
      }
    };

    // Calculates the appropriate modal body height by subtracting
    // header, breadcrumb, and footer heights and an additional
    // 50 pixels from the browser window height. Invoked for you
    // by `self.show()`.

    self.resizeContentHeight = function() {

      // get the ancestor if it's available, if not then self.$el is outer
      var $container = self.getSlideableAncestorEl() || self.$el;

      var headerHeight = $container.find('.apos-modal-header').outerHeight() || 0;
      var breadcrumbHeight = $container.find('.apos-modal-breadcrumb').outerHeight() || 0;
      var footerHeight = $container.find('.apos-modal-footer').outerHeight() || 0;
      var modalOffset = parseInt($('[data-modal]').css('top')) + parseInt($('[data-modal]').css('bottom'));

      var contentHeight = 'calc(100vh - ' + footerHeight + 'px - ' + (headerHeight + breadcrumbHeight + modalOffset) + 'px)';

      // Set height on .apos-modal-content.
      // Check if self.$el is a sliding .apos-modal-content or modal wrapper

      var $content;
      if (self.$el.is('.apos-modal-content')) {
        $content = self.$el;

        // dont resize the height of modals within modals
        if ($content.parents('[data-tab]').length === 0) {
          self.$el.css('height', contentHeight);
          self.$el.find('[data-schema-tabs]').css('height', contentHeight);
        }
      } else {
        $content = self.$el.find('.apos-modal-content').last();

        // dont resize the height of modals within modals
        if ($content.parents('[data-tab]').length === 0) {
          $content.css('height', contentHeight);
          self.$el.find('.apos-modal-content').find('[data-schema-tabs]').css('height', contentHeight);
        }
      }

      // apos-modal-footer is now *inside* apos-modal-content, we need to
      // adjust the height of apos-modal-body relative to it. -Tom
      var $body = $content.find('.apos-modal-body');

      if ($body.parents('[data-tab]').length === 0) {
        $body.css('height', 'calc(100% - ' + footerHeight + 'px)');
      }

      // apos-chooser needs the same treatment, although the CSS seems to imply it should not.
      var $chooser = $content.find('.apos-chooser');
      if ($chooser.length) {
        $chooser.css('height', 'calc(100% - ' + footerHeight + 'px)');
      }
    };

    // Rebuilds the breadcrumb trail of slide titles inside the slideable
    // ancestor of the current slide, or the modal itself if it is a
    // parent of slides. Normally the text of the breadcrumb is simply the
    // title of the corresponding slide modal. If the `field` option is set,
    // the slide is assumed to be either the modal for editing an array
    // schema field (see `apostrophe-schemas`) or a modal related to editing one
    // entry in that field. For the former, the title is set to `field.label`.
    // For the latter, the title is set to the value of the `field.titleField`
    // property of the array element indicated by the `active` property of
    // the slide for the array (the previous slide).
    //
    // TODO: this is dodgy separation of concerns. Where possible the code
    // that pokes into the implementation of the array modal should be replaced
    // by suitable methods that could also be implemented in other places
    // where a similar behavior is desired.

    self.refreshBreadcrumb = function() {
      var $ancestor = self.$slideableAncestorEl;
      if (!$ancestor) {
        if (self.$el.hasClass('apos-modal-slideable')) {
          $ancestor = self.$el;
        }
        if (!$ancestor) {
          return;
        }
      }
      var ancestor = $ancestor.data('aposModal');
      var $breadcrumb = $ancestor.find('[data-modal-breadcrumb]');
      $breadcrumb.html('');
      var slides = ancestor.getSlides();
      _.each(slides, function(slide, i) {
        var $li = $('<li></li>');
        $li.addClass('apos-modal-breadcrumb-item');
        // Is this an array editor modal?  Use options.field.label
        if (slide.options.field && slide.options.field.label) {
          // Check if we came from an array.  If we did, we can
          // also provide the name of the item that we are within.
          if (i > 0 && slides[i - 1].arrayItems && slides[i - 1].arrayItems.length > 0 && slides[i - 1].options.field.titleField) {
            $li.text(slide.options.field.label + ' (' + slides[i - 1].arrayItems[slides[i - 1].active][slides[i - 1].options.field.titleField] + ')');
          } else {
            $li.text(slide.options.field.label);
          }

        // Normal modal, pass the title
        } else if (slide.title) {
          $li.text(slide.title);
        }
        $li.data('aposModal', slide);
        $li.data('aposBreadcrumbIndex', i);
        $breadcrumb.append($li);
      });
    };

    // This method is provided as your opportunity to modify the DOM via
    // `self.$el` and add your own event handlers before the modal appears.
    // By default it does nothing, however if you are extending a subclass
    // such as `apostrophe-pieces-editor-modal` that provides its own version,
    // be sure to invoke the  original version before or after yours.

    self.beforeShow = function(callback) {
      return setImmediate(callback);
    };

    // Called after the modal is visible. Normally you should
    // use beforeShow to do your work behind the scenes, but
    // perhaps you need to call `self.$el.width()`, which only
    // works properly on visible elements. There is no callback
    // because the modal has no more work to do after yours.

    self.afterShow = function() {
    };

    // Save the modal. Prevents simultaneous saves, displays
    // a busy indicator, saves all views if any and then invokes
    // saveContent to do the actual saving of data. If there
    // is no error the modal is hidden (dismissed).
    //
    // The callback is optional. If it is provided any error
    // preventing the save operation will be passed to it.
    //
    // `self.saveContent` is invoked to carry out the actual
    // work (e.g. saving to a database via an API route, for
    // instance) and by default does nothing. If `self.saveContent`
    // delivers an error to its callback, the save operation fails
    // and the modal is not hidden.

    self.save = function(callback) {
      if (self.saving) {
        // Avoid race conditions
        return;
      }

      self.saving = true;

      if (!self.$view) {
        // saving a modal is a globalBusy operation, adding a class to a button
        // does not cut it, what if the user continues to edit?
        apos.ui.globalBusy(true);
      }

      return async.eachSeries(self.getViews(), function(view, callback) {
        return view.save(callback);
      }, function(err) {
        if (err) {
          return callback && callback(err);
        }
        return self.saveContent(function(err) {
          apos.ui.globalBusy(false);
          self.saving = false;
          if (err) {
            return callback && callback(err);
          }

          if (!self.$view) {
            self.afterHideInternal = function() {
              return callback && callback(null);
            };
            self.hide();
          } else {
            return callback && callback(null);
          }
        });
      });
    };

    // Override this method to carry out the actual storing of data
    // when a modal is saved.
    //
    // If you invoke the callback with an error, the modal does not disappear.
    //
    // Displaying the error to the user is your responsibility.

    self.saveContent = function(callback) {
      return setImmediate(callback);
    };

    // Override this method to clean up timers, etc. after the modal or view has
    // been dismissed.

    self.afterHide = function() {
    };

    // Reserved for internal implementation use.
    self.afterHideInternal = function() {
    };

    // Invoked after the modal or view has been dismissed.
    // Calls `self.afterHideInternal`, which invokes the callbacks of
    // `self.save` or `self.cancel` when appropriate, and also invokes
    // `self.afterHide`, an initially empty method for your
    // overriding convenience.

    self.afterHideWrapper = function() {
      self.afterHideInternal();
      self.afterHide();
      // restore the busy state from before the modal was launched
      apos.ui.popGlobalBusy();
    };

    // This method is invoked to confirm the user's request to cancel
    // the modal. Currently invokes `confirm`, which is ugly. However
    // `confirmCancel` is async so this can be replaced with a more
    // attractive implementation.

    self.confirmCancel = function(callback) {
      if (!self.unsavedChanges) {
        return setImmediate(callback);
      }
      if (!confirm(self.getConfirmCancelText())) {
        return callback('notconfirmed');
      }
      return callback();
    };

    // Returns text to be displayed by the browser in the event the user
    // attempts to leave the page without saving or cancelling the modal,
    // if `self.unsavedChanges` is truthy.
    //
    // Note that some browsers now display a generic message in this case
    // in order to discourage misleading wording.
    //
    // By default the `label` option passed when creating the modal is
    // used to customize the text.

    self.getBeforeUnloadText = function() {
      return "You are about to discard unsaved changes to this " +
        (options.label ? options.label.toLowerCase() : 'item') + '.';
    };

    // Returns the text to be displayed to the user when they attempt
    // to cancel the modal, if `self.unsavedChanges` is truthy.
    //
    // By default the `label` option passed when creating the modal is
    // used to customize the text.
    self.getConfirmCancelText = function() {
      return 'Are you sure you want to discard unsaved changes to this ' +
        (options.label ? options.label.toLowerCase() : 'item') + '?';
    };

    // Override this method to alter the behavior when the modal is
    // dismissed by clicking the cancel/done button, pressing escape or
    // clicking outside the modal.
    //
    // You can prevent the modal from disappearing by invoking the callback
    // with an error. The error is not displayed; doing so is your
    // responsibility if you wish to.
    //
    // You must invoke the callback, with or without an error.

    self.beforeCancel = function(callback) {
      return setImmediate(callback);
    };

    // Cancels the modal, dismissing it without invoking `save`.
    //
    // Currently this method assumes you wish to close the top modal
    // (or most recent slide of the top modal) and does not actually check
    // to make sure `self` is that modal. Generally speaking modals that
    // are lower in the stack should not attempt to interfere when the user
    // is working with a new modal on top of the stack.
    //
    // If the modal has views, their cancel methods are also invoked first.
    //
    // If the `confirmCancel` or `beforeCancel` method invokes its callback
    // with an error the modal is not closed.
    //
    // `self.afterHide` is invoked.

    self.cancel = function(callback) {
      return async.eachSeries(self.getViews(), function(view, callback) {
        return view.cancel(callback);
      }, function(err) {
        if (err) {
          if (!callback) {
            return;
          }
          return callback(err);
        }
        return async.series([
          self.confirmCancel,
          self.beforeCancel
        ], function(err) {
          if (err) {
            if (!callback) {
              return;
            }
            return callback(err);
          }
          if (!self.$view) {
            self.afterHideInternal = function() {
              return callback && callback(null);
            };
            apos.modalSupport.closeTopModal();
          }
          if (callback) {
            return callback();
          }
        });
      });
    };

    // Hides (dismisses) the modal, sliding out or popping off the stack
    // as appropriate. Invokes for you when the user saves or cancels.
    // If the modal is a view, nothing happens by default. The `hide()`
    // methods of any views within the modal are also called.

    self.hide = function() {

      $(window).off('beforeunload', self.beforeunload);

      if (!self.$view) {

        // If we have a shell (the original, discarded modal div from the
        // route), then we were sliding

        apos.modalSupport.depth--;

        if (self.shown) {
          if (self.$shell) {
            self.slideOut();
          } else {
            self.stackPop();
          }
        }

        _.each(self.getViews(), function(view) {
          // Everybody gets a chance to clean up, remove timers, etc.
          view.hide();
        });

      }
    };

    // Reverses the slide transition, revealing the previous slide.
    // Invoked for you when the user saves or cancels a slide.

    self.slideOut = function() {
      // Remove current class
      self.$el.removeClass('apos-modal-slide-current');

      // Set the next to last slide as current
      var $slides = self.$slideableAncestorEl.findSafe('[data-modal-content]', '[data-modal-content]');
      $slides.eq($slides.length - 2).addClass('apos-modal-slide-current');

      // On transition end, remove previous current slide and refresh
      // modal breadcrumbs and controls
      var fired = false;
      self.$el.one('webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend', function() {
        if (fired) {
          // Has been seen firing twice in Nightwatch tests
          return;
        } else {
          fired = true;
        }
        self.$el.remove();
        self.$slideableAncestorEl.data('aposModal').refreshBreadcrumb();
        self.$controls.hide();
        self.$previousControls.show();
        self.$modalFilters.hide();
        self.$previousFilters.show();
        self.$instructions.hide();
        self.$previousInstructions.show();
        self.afterHideWrapper();
        self.indicateCurrentModal(false);
      });
    };

    // Pops this modal off the stack. Assumes the modal is a stacked modal
    // and not a slide. Called for you when the modal is saved or cancelled.

    self.stackPop = function() {
      // We assume we are on top.

      // Reset scroll position to what it was before this modal opened.
      // Really awesome if you scrolled while using the modal
      var $current = apos.modalSupport.getTopModalOrBody();
      if ($current.data('aposSavedScrollTop') !== undefined) {
        $(window).scrollTop($current.data('aposSavedScrollTop'));
      }

      apos.modalSupport.stack.pop();

      apos.emit('modalStackPop');

      var $blackoutContext = apos.modalSupport.getTopModalOrBody();
      var $blackout = $blackoutContext.find('.apos-modal-blackout');
      if ($blackout.data('interval')) {
        clearInterval($blackout.data('interval'));
      }

      $blackout.addClass('apos-modal-blackout-fade');
      self.$el.addClass('apos-modal-stack-push');

      // Remove elements on transition end.
      self.$el.one('webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend', function() {
        $blackout.remove();
        self.$el.remove();

        self.$body.removeClass('apos-active-blackout');

        if (!apos.modalSupport.stack.length) {
          self.disableGlobalEvents();
        }
        self.afterHideWrapper();
        self.indicateCurrentModal(false);
      });
    };

    // Prevents the enter key from inadvertently submitting a form
    // the old-fashioned way. Invoked for you by `afterConstruct`.

    self.overrideFormSubmission = function() {
      // Enter key driven submits of the form should act like a click on the save button,
      // do not try to submit the form old-school
      self.$el.on('submit', 'form', function() {
        self.save();
        return false;
      });
    };

    // Applies a blackout div with the `apos-modal-blackout` CSS class to
    // hide the content of the page (with partial opacity) and prevent
    // unwanted interactions with the page while the modal is active.
    // Blackouts are also applied to modals higher in the stack for the
    // same reason. The top-level blackout adjusts its height at regular
    // intervals so that it always adequately covers the document while the
    // modal is active. Invoked for you when a new stacked modal is added.

    self.applyBlackout = function() {
      // Black out the document or the top modal if there already is one.
      // If we are blacking out the body height: 100% won't cover the entire document,
      // so address that by tracking the document height with an interval timer
      var $blackoutContext = apos.modalSupport.getTopModalOrBody();
      var $blackout = $('<div class="apos-modal-blackout"></div>');
      if ($blackoutContext.prop('tagName') === 'BODY') {
        var interval = setInterval(function() {
          var contextHeight = $(document).height();
          if ($blackout.height() !== contextHeight) {
            $blackout.height(contextHeight);
          }
          $blackout.data('interval', interval);
        }, 200);
      }
      $blackoutContext.append($blackout);
      self.$body.addClass('apos-active-blackout');
    };

    // Gives the focus to the first form element in the modal. Invoked
    // for you when a modal is displayed. TODO: should respect tabindex if present.

    self.focusFirstFormElement = function() {
      // Give the focus to the first form element. (Would be nice to
      // respect tabindex if it's present, but it's rare that
      // anybody bothers)

      // Get the first element, if it is a text input
      var $firstElm = self.$el.find('.apos-modal-body form fieldset:first input');

      if ($firstElm.length) {
        self.$el.one('webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend', function() {
          $firstElm.focus();
        });
      }
    };

    // Returns an array of views nested within the modal.

    self.getViews = function() {
      var views = [];
      self.$el.findSafe('[data-view]', '[data-view]').each(function() {
        views.push($(this).data('view'));
      });
      return views;
    };

  }
});

// `apos.modalSupport` provides a handful of global methods used to manipulate
// the modal stack and holds the stack itself. TODO: this should be another
// moog type so that it is easier to extend it consistently and generate
// documentation.

apos.modalSupport = {
  // jQuery objects for freestanding modals
  stack: [],
  initialized: false,
  // Depth of the stack (above)
  depth: 0,
  // All non-view modals, including slides and freestanding;
  // also set up as a stack, with the newest at the end.
  // The objects are actual modal objects (`apostrophe-modal`),
  // NOT jQuery objects
  all: [],
  // Returns jQuery object
  getTopModalOrBody: function() {
    return $(apos.modalSupport.stack.length ? apos.modalSupport.stack[apos.modalSupport.stack.length - 1] : 'body');
  },
  // Returns actual apostrophe-modal object, including latest slide (not views)
  getLatestModal: function() {
    if (!apos.modalSupport.all.length) {
      return null;
    }
    return apos.modalSupport.all[apos.modalSupport.all.length - 1];
  },
  closeTopModal: function() {
    var topModal = apos.modalSupport.getTopModalOrBody();
    if (topModal.is('[data-modal]')) {
      topModal.trigger('aposModalHide');
    }
  },
  cancelTopModal: function() {
    var topModal = apos.modalSupport.getTopModalOrBody();
    if (topModal.is('[data-modal]')) {
      topModal.trigger('aposModalCancel');
    }
  }
};
