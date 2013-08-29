// projector: a simple jQuery slideshow plugin
//
// Copyright 2013 P'unk Avenue LLC
//
// Complete docs here: http://github.com/punkave/jquery-projector

(function( $ ) {
  $.fn.projector = function(options) {
    var $el = this;
    if (!options) {
      options = {};
    }

    var delay = 5000;
    if (options.delay !== undefined) {
      delay = options.delay;
    }
    if ($el.attr('data-delay') !== undefined) {
      delay = $el.attr('data-delay');
    }
    delay = parseInt(delay, 10);

    var currentClass = options.currentClass || 'apos-current';
    var noHeight = options.noHeight || ($el.attr('data-no-height') !== undefined);

    var interval;

    function reset() {
      if (interval) {
        clearInterval(interval);
      }
      if (delay) {
        interval = setInterval(function() {
          if (!getCurrent().length) {
            // Widget has gone away. Kill the interval timer and go away too
            clearInterval(interval);
          }
          next();
        }, delay);
      }
    }

    reset();

    $el.find('[data-previous]').click(function() {
      previous();
      return false;
    });

    $el.find('[data-next]').click(function() {
      next();
      return false;
    });

    function getCurrent() {
      var $current = $el.find('[data-slideshow-item].' + currentClass);
      return $current;
    }

    function previous() {
      var $current = getCurrent();
      var $prev = $current.prev();
      if (!$prev.length) {
        $prev = $current.closest('[data-slideshow-items]').find('[data-slideshow-item]:last');
      }
      $current.removeClass(currentClass);
      $prev.addClass(currentClass);
      // A fresh n seconds for the next auto rotate
      reset();
    }

    function next() {
      var $current = getCurrent();
      if (!$current.length) {
        // Widget has gone away. Kill the interval timer and go away too
        clearInterval(interval);
        return;
      }
      var $next = $current.next();
      if (!$next.length) {
        $next = $current.closest('[data-slideshow-items]').find('[data-slideshow-item]:first');
      }
      $current.removeClass(currentClass);
      $next.addClass(currentClass);
      // A fresh n seconds for the next auto rotate
      reset();
    }

    function adjustSize() {
      $el.find('[data-image]').imagesReady(function() {
        var tallest = 0;
        $el.find('[data-slideshow-item]').each(function() {
          var $item = $(this);
          if ($item.height() > tallest) {
            tallest = $item.height();
          }
        });

        if (!noHeight) {
          $el.find('[data-slideshow-items]').height(tallest);
        }

      });
    }

    adjustSize();
  };
})( jQuery );
