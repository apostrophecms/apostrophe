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
    self.getSource = function(callback) {
      return self.html(options.source, options.body || {}, function(html) {
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
      self.$el.on('click', '[data-cancel]', self.cancel);

      self.$el.on('click', '[data-save]', function() {
        var $button = $(this);
        self.saveWithBusy($button.is('[data-next]'));
        return false;
      });
    };

    self.enableLifecycleEvents = function() {
      self.$el.on('aposModalCancel', self.cancel);
      self.$el.on('aposModalHide', self.hide);
    };

    self.show = function() {
      apos.emit('enhance', self.$el);
      self.applyBlackout();
      // Remember scroll top so we can easily get back
      self.$el.data('aposSavedScrollTop', $(window).scrollTop());

      apos.modalSupport.stack.push(self.$el);

      $('body').append(self.$el);

      var top = self.determineTop();
      var left = self.determineLeft();
      self.setOffset({ top: top, left: left });
      self.$el.show();

      self.focusFirstFormElement();
    };

    // Your chance to touch the DOM and add
    // event handlers before the modal appears
    self.beforeShow = function(callback) {
      return setImmediate(callback);
    };

    // Called after the modal is visible. Normally you should
    // use beforeShow to do your work behind the scenes, but
    // perhaps you need to call $('sel').width(), which only
    // works properly on visible elements. There is no callback
    // because the modal has no more work to do after yours.
    self.afterShow = function() {
    };

    self.save = function(callback) {
      return setImmediate(callback);
    };

    self.afterHide = function(callback) {
      return setImmediate(callback);
    };

    self.beforeCancel = function(callback) {
      return setImmediate(callback);
    };

    self.cancel = function(callback) {
      return self.beforeCancel(function(err) {
        if (err) {
          return;
        }
        apos.modalSupport.closeTopModal();
      });
    };

    self.hide = function() {
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
      self.afterHide(function(err) {
        return;
      });
      if (!apos.modalSupport.stack.length) {
        self.disableGlobalEvents();
      }
    };

    self.saveWithBusy = function(next) {
      if (self.saving) {
        // Avoid race conditions
        return;
      }
      self.saving = true;
      var $save = self.$el.find('[data-save]');
      $save.addClass('apos-busy');
      return self.save(function(err) {
        self.saving = false;
        $save.removeClass('apos-busy');
        if (!err) {
          self.hide();
          if (next) {
            self.next();
          }
        }
      });
    };

    self.overrideFormSubmission = function() {
      // Enter key driven submits of the form should act like a click on the save button,
      // do not try to submit the form old-school
      self.$el.on('submit', 'form', function() {
        self.saveWithBusy();
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

