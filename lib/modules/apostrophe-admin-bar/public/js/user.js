apos.define('apostrophe-admin-bar', {

  afterConstruct: function(self) {
    self.enhance();
  },

  construct: function(self, options) {

    // When the specified admin bar item is clicked, call the specified function
    self.link = function(name, callback) {
      return $('body').on('click', '[data-apos-admin-bar-item="' + name + '"]', function() {
        callback();
        return false;
      });
    };

    // Implement the admin bar's toggle behavior and graceful close of dropdowns at
    // appropriate times.

    self.enhance = function() {
      var $bar = $('[data-apos-admin-bar]');
      var isHomepage = $('[data-apos-level="0"]').length;
      if ((options.openOnHomepageLoad && isHomepage) || options.openOnLoad) {
        $bar.css('overflow', 'visible');
        $bar.addClass('apos-active');
      } else {
        $bar.css('overflow', 'hidden');
      }
      var $dropdowns = $bar.find('[data-apos-dropdown]');

      // on transitionend, turn overflow on so we can see dropdowns!
      $bar.on('transitionend webkitTransitionEnd oTransitionEnd', function() {
        if ($bar.hasClass('apos-active')) {
          $bar.css('overflow', 'visible');
        }
      });

      // when we collapse the menu, turn all dropdowns off. Don't show overflow while transitioning
      $bar.find('[data-apos-admin-bar-logo]').on('click', function() {
        $bar.css('overflow', '');
        $bar.find('[data-apos-dropdown]').removeClass('apos-active');
      });

      // when the bar is clicked, make a note of it so we don't auto
      // collapse the menu from load
      $bar.on('click', function() {
        $bar.addClass('apos-admin-bar--clicked');
      });

      $bar.on('click', '[data-apos-dropdown-items]>li', function() {
        $dropdowns.removeClass('apos-active');
      });

      $bar.on('click', '[data-apos-dropdown-items] a[href]', function(e) {
        // Let links in dropdown items function as links
        e.stopPropagation();
      });

      self.autoCollapse($bar);

      // when opening dropdowns, close other dropdowns
      $dropdowns.on('click', function() {
        $bar.find('[data-apos-dropdown]').not(this).removeClass('apos-active');
      });

    };

    self.collapse = function($bar) {
      if (!$bar.hasClass('apos-admin-bar--clicked')) {
        $bar.css('overflow', '');
        $bar.removeClass('apos-active');
      }
    };

    self.autoCollapse = function ($bar) {
      if (typeof options.closeDelay === 'number' && options.closeDelay > 0) {
        setTimeout(function () {
          self.collapse($bar);
        }, options.closeDelay);
      }
    };

    apos.adminBar = self;
  }
});
