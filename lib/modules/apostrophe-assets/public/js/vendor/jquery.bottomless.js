// bottomless: a jQuery plugin that makes it easy to set or get the
// current value of a group of bottomless buttons.
//
// Copyright 2013 P'unk Avenue LLC
//
// Please see:
//
// https://github.com/punkave/jquery-bottomless
//
// For complete documentation.

(function( $ ){
  $.fn.bottomless = function(options) {
    var $el = this;
    var url = options.url;
    var now = options.now || false;
    var page = options.page || 1;
    var skipAndLimit = options.skipAndLimit;
    // Consulted only if skipAndLimit is true, otherwise we just send a page parameter
    var perPage = options.perPage || 20;
    var resetTimeout = null;
    if (now) {
      if (options.page === undefined) {
        // loadPage will increment this and load page one immediately
        page = 0;
      }
    }
    var criteria = options.criteria || {};
    var distance = options.distance || 350;
    var method = options.method || 'GET';
    var $spinner = $(options.spinner);
    var atEnd = false;
    var loading = false;

    // Infinite scroll
    var interval = setInterval(function() {
      // Don't try anything fancy when we're not in the DOM, avoids
      // heavy background activity after removal. Also see
      // the aposScrollDestroy event
      if ($el.parents('body').length) {
        if ((!atEnd) && (!loading)) {
          // Allow for an intentional gap between the content of the
          // infinitely scrolled element and the bottom of the page
          // (although it's foolish to expect anyone to see it...!)
          var footerHeight = $(document).height() - ($el.offset().top + $el.height());
          if (($(document).scrollTop() + $(window).height() + distance) >= $(document).height() - footerHeight)
          {
            loadPage();
          }
        }
      }
    }, 100);

    $el.on('aposScrollReset', function(e, data) {
      function resetWhenAvailable() {
        if (loading) {
          if (resetTimeout) {
            clearTimeout(resetTimeout);
          }
          resetTimeout = setTimeout(resetWhenAvailable, 500);
          return;
        }

        resetTimeout = null;
        if (data) {
          criteria = data;
        }
        reset();
      }
      resetWhenAvailable();
    });

    $el.on('aposScrollEnded', function(e) {
      end();
    });

    $el.on('aposScrollDestroy', function(e) {
      end();
      // Go away!
      clearInterval(interval);
    });

    function afterPageOne() {
      if (!options.reset) {
        $el.html('');
      } else {
        options.reset();
      }
    }

    function reset() {
      page = 0;
      atEnd = false;
      loadPage();
    }

    function loadPage() {
      if (loading) {
        return setTimeout(loadPage,500);
      }
      start();
      page++;
      // Copy the criteria and add the page
      var query = {};
      $.extend(true, query, criteria);
      if (skipAndLimit) {
        query.skip = (page - 1) * perPage;
        query.limit = perPage;
      } else {
        query.page = page;
      }
      $.ajax({
        url: url,
        type: method,
        data: query,
        dataType: options.dataType || 'html',
        success: function(data) {
          if (page === 1) {
            afterPageOne();
          }
          (options.success || function(data) {
            var $items = $.parseHTML(data);
            $el.append($items);
          })(data);
          $el.data('page', page);
          stop();
          $el.trigger('aposScrollLoaded');
        },
        error: function(err) {
          if (page === 1) {
            afterPageOne();
          }
          $el.data('loading', false);
          loading = false;
        },
        statusCode: {
          404: function() {
            $el.trigger('aposScrollEnded');
          }
        }
      });
    }

    function start() {
      $el.data('loading', true);
      loading = true;
      $el.trigger('aposScrollStarted');
      $spinner.show();
    }

    function stop() {
      $el.data('loading', false);
      loading = false;
      $el.trigger('aposScrollStopped');
      $spinner.hide();
    }

    function end() {
      if (loading) {
        stop();
      }
      atEnd = true;
      $spinner.hide();
    }

    if (now) {
      loadPage();
    }
  };
})( jQuery );
