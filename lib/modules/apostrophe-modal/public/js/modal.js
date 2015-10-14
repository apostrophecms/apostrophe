apos.define('apostrophe-modal', {

  extend: 'apostrophe-context',

  afterConstruct: function(self) {

    apos.ui.globalBusy(true);

    return async.series([
      self.getSource,
      function(callback) {
        self.saving = false;
        self.enableGlobalEventsOnce();
        self.enableLifecycleEvents();
        self.overrideFormSubmission();
        self.enableButtonEvents();
        self.captureTitle();
        self.resetEl();
        self.setSelfReference();
        return setImmediate(callback);
      },
      self.beforeShow
    ], function(err) {
      apos.ui.globalBusy(false);
      if (err && self.$el) {
        self.hide();
      }
      if (err) {
        apos.log(err);
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

    self.getSource = function(callback) {
      return self.html(options.source, self.body || {}, function(html) {
        self.$el = $(html);
        return callback(null);
      }, function(err) {
        return callback(err);
      });
    };

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

    self.disableGlobalEvents = function() {
      // Leggo of the keyboard when there are no modals!
      // We can reinstall the handler when it's relevant.
      // Fewer event handlers all the time = better performance

      apos.modalSupport.initialized = false;
      $(document).off('keydown.aposModal');
      $(document).off('click.aposModal');
    };

    self.enableButtonEvents = function() {
      self.$el.on('click', '[data-cancel]', function() {
        return self.cancel();
      });

      self.$el.on('click', '[data-save]', function() {
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

    self.captureTitle = function() {
      self.title = self.$el.find('[data-modal-title]').text();
    };

    // If we are planning to slide, then we need to reset self.$el to
    // the data-modal-content element because it will be moved out
    // of self.$el and event handlers counting on self.$el would
    // no longer work. -Tom and Matt

    self.resetEl = function() {

      if (self.options.transition !== 'slide') {
        return;
      }

      if (!self.getSlideableAncestorEl()) {
        return;
      }

      self.$shell = self.$el;
      var $content = self.$el.find('[data-modal-content]:first');
      self.$el = $content;
    };

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

    self.setSelfReference = function() {
      self.$el.data('aposModal', self);
    };

    self.enableLifecycleEvents = function() {
      self.$el.on('aposModalCancel', function() {
        // so we don't wind up passing an event as a "callback"
        return self.getLastSlide().cancel();
      });
      self.$el.on('aposModalHide', function() {
        self.getLastSlide().hide();
      });
    };

    // Return the last slide or the modal itself if it has no nested slides.
    // Returns an apostrophe-modal object, not a jQuery element

    self.getLastSlide = function() {
      var $slides = self.$el.find('[data-modal-content]');
      if ($slides.length <= 1) {
        return self;
      }
      var $last = $slides.eq($slides.length - 1);
      return $last.data('aposModal');
    };

    self.getSlides = function() {
      var $slides = self.$el.find('[data-modal-content]');
      var slides = [];
      $.each($slides, function() {
        slides.push($(this).data('aposModal') || self);
      });
      return slides;
    };

    self.show = function() {

      apos.emit('enhance', self.$el);

      if (self.$view) {
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
      }
      self.refreshBreadcrumb();
      _.each(self.getViews(), function(view) {
        view.show();
      });
      self.focusFirstFormElement();
    };

    self.slideIn = function() {

      self.$slideableAncestorEl = self.getSlideableAncestorEl();
      if (!self.$slideableAncestorEl) {
        return self.stackPush();
      }

      var $wrapper = self.$slideableAncestorEl.find('[data-modal-contents]:first');
      // due to resetEl self.$el is already just data-modal-content at this point
      var $content = self.$el;
      $wrapper.find('[data-modal-content]').removeClass('apos-modal-slide-current');
      $content.addClass('apos-modal-slide-current');
      $wrapper.append($content);
    };

    self.stackPush = function() {
      // A true modal in the stack
      self.applyBlackout();
      // Remember scroll top so we can easily get back
      self.$el.data('aposSavedScrollTop', $(window).scrollTop());

      apos.modalSupport.stack.push(self.$el);

      $('body').append(self.$el);

      var top = self.determineTop();
      var left = self.determineLeft();
      self.setOffset({ top: top, left: left });

      self.$el.show();
    };

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
      var titles = _.pluck(ancestor.getSlides(), 'title');
      _.each(titles, function(title) {
        var $li = $('<li></li>');
        $li.addClass('apos-modal-breadcrumb-item');
        $li.text(title);
        $breadcrumb.append($li);
      });
    };

    // Your chance to touch the DOM and add
    // event handlers before the modal appears
    self.beforeShow = function(callback) {
      return setImmediate(callback);
    };

    // Called after the modal is visible. Normally you should
    // use beforeShow to do your work behind the scenes, but
    // perhaps you need to call self.$el.width(), which only
    // works properly on visible elements. There is no callback
    // because the modal has no more work to do after yours.
    self.afterShow = function() {
    };

    // Save the modal. Prevents simultaneous saves, displays
    // a busy indicator, saves all views and then invokes
    // saveContent to do the actual saving of data. If there
    // is no error the modal is hidden.
    //
    // The callback is optional.

    self.save = function(callback) {
      if (self.saving) {
        // Avoid race conditions
        return;
      }

      self.saving = true;

      if (!self.$view) {
        var $save = self.$el.find('[data-save]');
        $save.addClass('apos-busy');
      }

      return async.eachSeries(self.getViews(), function(view, callback) {
        return view.save(callback);
      }, function(err) {
        if (err) {
          return callback && callback(err);
        }
        return self.saveContent(function(err) {
          if (err) {
            return;
          }
          self.saving = false;

          if (!self.$view) {
            $save.removeClass('apos-busy');
            self.hide();
          }

          return callback && callback(null);
        });
      });
    };

    // Override this method to do your actual storing of data. If you
    // invoke the callback with an error, the modal does not disappear.

    self.saveContent = function(callback) {
      return setImmediate(callback);
    };

    // Override to clean up timers, etc. after the modal or view has
    // been dismissed.

    self.afterHide = function(callback) {
      return setImmediate(callback);
    };

    // Called before the modal disappears when cancel or "done" is clicked.
    // You can prevent the modal from disappearing by invoking the callback
    // with an error. You must invoke the callback.

    self.beforeCancel = function(callback) {
      return setImmediate(callback);
    };

    // Callback is optional
    self.cancel = function(callback) {
      return async.eachSeries(self.getViews(), function(view, callback) {
        view.cancel(callback);
      }, function(err) {
        if (err) {
          return callback(err);
        }
        return self.beforeCancel(function(err) {
          if (err) {
            return callback(err);
          }
          if (!self.$view) {
            apos.modalSupport.closeTopModal();
          }
          // callback is optional
          if (callback && (typeof(callback) !== 'function')) {
            apos.log(callback);
          }
          return callback && callback(null);
        });
      });
    };

    self.hide = function() {

      if (!self.$view) {

        // If we have a shell (the original, discarded modal div from the
        // route), then we were sliding
        if (self.$shell) {
          self.slideOut();
        } else {
          self.stackPop();
        }

        _.each(self.getViews(), function(view) {
          // Everybody gets a chance to clean up, remove timers, etc.
          view.hide();
        });

        self.afterHide(function(err) {
          return;
        });

      }
    };

    self.slideOut = function() {
      // This actually needs to happen after a transition
      self.$el.remove();
      self.$slideableAncestorEl.find('[data-modal-content]:last').addClass('apos-modal-slide-current');
      self.$slideableAncestorEl.data('aposModal').refreshBreadcrumb();
    };

    self.stackPop = function() {
      // We assume we are on top.

      // Reset scroll position to what it was before this modal opened.
      // Really awesome if you scrolled while using the modal
      var $current = apos.modalSupport.getTopModalOrBody();
      if ($current.data('aposSavedScrollTop') !== undefined) {
        $(window).scrollTop($current.data('aposSavedScrollTop'));
      }

      apos.modalSupport.stack.pop();
      var $blackoutContext = apos.modalSupport.getTopModalOrBody();
      var $blackout = $blackoutContext.find('.apos-modal-blackout');
      if ($blackout.data('interval')) {
        clearInterval($blackout.data('interval'));
      }
      $blackout.remove();

      self.$el.hide();
      self.$el.remove();

      if (!apos.modalSupport.stack.length) {
        self.disableGlobalEvents();
      }

    };

    self.overrideFormSubmission = function() {
      // Enter key driven submits of the form should act like a click on the save button,
      // do not try to submit the form old-school
      self.$el.on('submit', 'form', function() {
        self.save();
        return false;
      });
    };

    self.determineTop = function() {
      if (self.$el.hasClass('apos-modal-full-page')) {
        return Math.max($('.apos-admin-bar').height(),130);
      } else {
        return 100 + apos.modalSupport.stack.length * 10;
      }
    };

    self.determineLeft = function() {
      return (($(window).width() - self.$el.outerWidth()) / 2) + apos.modalSupport.stack.length * 10;
    };

    self.setOffset = function(offset) {
      self.$el.offset({ top: offset.top, left: offset.left });
    };

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
    };

    self.focusFirstFormElement = function() {
      // Give the focus to the first form element. (Would be nice to
      // respect tabindex if it's present, but it's rare that
      // anybody bothers)

      // If we don't have a select element first - focus the first input.
      // We also have to check for a select element within an array as the first field.
      if (self.$el.find("form:not(.apos-filter) .apos-fieldset:first.apos-fieldset-selectize, form:not(.apos-filter) .apos-fieldset:first.apos-fieldset-array .apos-fieldset:first.apos-fieldset-selectize").length === 0 ) {
        self.$el.find("form:not(.apos-filter) .apos-fieldset:not([data-extra-fields-link]):first :input:visible:enabled:first").focus();
      }
    };

    self.getViews = function() {
      var views = [];
      self.$el.findSafe('[data-view]', '[data-view]').each(function() {
        views.push($(this).data('view'));
      });
      return views;
    };

  }
});

apos.modalSupport = {
  stack: [],
  initialized: false,
  getTopModalOrBody: function() {
    return $(apos.modalSupport.stack.length ? apos.modalSupport.stack[apos.modalSupport.stack.length - 1] : 'body');
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

