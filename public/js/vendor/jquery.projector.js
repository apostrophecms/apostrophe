// projector: a simple jQuery slideshow plugin
//
// Copyright 2014 P'unk Avenue LLC
//
// Complete docs here: http://github.com/punkave/jquery-projector

(function( $ ) {
  $.fn.projector = function(options) {
    this.each(function(i, el) {
      var $el = $(this);
      // grab only the FIRST instance of data-slideshow-items.
      var $items = $el.find('[data-slideshow-items]').eq(0);
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

      var currentClass = $el.attr('data-current-class') || options.currentClass || 'apos-current';
      var nextClass = $el.attr('data-next-class') || options.nextClass || 'apos-next';
      var previousClass = $el.attr('data-previous-class') || options.previousClass || 'apos-previous';
      var otherClass = $el.attr('data-other-class') || options.otherClass || 'apos-other';
      var noHeight = ($el.attr('data-no-height') !== undefined) || options.noHeight || false;
      var noNextAndPreviousClasses = ($el.attr('data-no-next-and-previous-classes') !== undefined) || options.noNextAndPreviousClasses || false;

      var slideshowLength = findItems().length;

      // extra checks in case false was passed to the data attribute
      if($el.attr('data-no-height') === 'false') {
        noHeight = false;
      }
      if($el.attr('data-no-next-and-previous-classes') === 'false') {
        noNextAndPreviousClasses = false;
      }

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

      findSafe($el, '[data-pager]', '[data-slideshow-items]').click(function(){
        setPager($(this).index());
        return false;
      });

      findSafe($el, '[data-previous]', '[data-slideshow-items]').click(function() {
        previous();
        return false;
      });

      findSafe($el, '[data-next]', '[data-slideshow-items]').click(function() {
        next();
        return false;
      });


      initializeSiblings();

      function setPager(target) {
        var $current = getCurrent();
        $current.removeClass(currentClass);
        findItems().eq(target).addClass(currentClass);
        setSiblings( getCurrent() );
        refreshPager(target);
        reset();
      }

      function getCurrent() {
        var $current = findSafe($items, '[data-slideshow-item].' + currentClass, '[data-slideshow-items]');
        return $current;
      }

      function previous() {
        var $current = getCurrent();
        var $prev = $current.prev();
        if (!$prev.length) {
          $prev = findItems().last();
        }
        $current.removeClass(currentClass);
        $prev.addClass(currentClass);

        setSiblings($prev);

        refreshPager($prev.index());

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
          $next = findItems().first();
        }
        $current.removeClass(currentClass);
        $next.addClass(currentClass);

        setSiblings($next);

        refreshPager($next.index());
        // A fresh n seconds for the next auto rotate
        reset();
      }

      function setSiblings($current, ignoreOld) {
        if(noNextAndPreviousClasses || slideshowLength < 2) {
          return;
        }
        if(!ignoreOld) {
          var $oldNext = findSafe($items, '[data-slideshow-item].' + nextClass, '[data-slideshow-items]');
          var $oldPrevious = findSafe($items, '[data-slideshow-item].' + previousClass, '[data-slideshow-items]');
          $oldNext.removeClass(nextClass);
          $oldPrevious.removeClass(previousClass);
        }

        var $newNext = $current.next();
        if(!$newNext.length) {
          $newNext = findItems().first();
        }
        $newNext.addClass(nextClass);

        if(slideshowLength === 2) {
          $current.removeClass(otherClass);
          $newNext.addClass(otherClass);
          return;
        }

        var $newPrevious = $current.prev();
        if(!$newPrevious.length) {
          $newPrevious = findItems().last();
        }
        $newPrevious.addClass(previousClass);
      }

      function initializeSiblings() {
        setSiblings( getCurrent() , true);
      }

      function refreshPager(target) {
        findSafe($el, '[data-pager]', '[data-slideshow-items]')
          .removeClass(currentClass)
          .eq(target)
          .addClass(currentClass)
        ;
      }

      function adjustSize() {
        findSafe($items, '[data-image]', '[data-slideshow-items]').imagesReady(function() {
          var tallest = 0;
          findItems().each(function() {
            var $item = $(this);
            if ($item.height() > tallest) {
              tallest = $item.height();
            }
          });

          if (!noHeight) {
            $items.height(tallest);
          }

        });
      }

      // use this for supporting nested projector instances
      function findSafe($element, selector, ignore) {
        var $self = $element;
        return $self.find(selector).filter(function() {
          var $parents = $(this).parents();
          var i;
          for (i = 0; (i < $parents.length); i++) {
            if ($parents[i] === $self[0]) {
              return true;
            }
            if ($($parents[i]).is(ignore)) {
              return false;
            }
          }
        });
      }

      // shorthand for the most common `find` operation
      function findItems() {
        return findSafe($items, '[data-slideshow-item]', '[data-slideshow-items]');
      }

      adjustSize();
    });
  };
})( jQuery );
