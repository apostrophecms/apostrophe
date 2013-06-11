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
    if (now) {
      if (options.page === undefined) {
        // loadPage will increment this and load page one immediately
        options.page = 0;
      }
    }
    var criteria = options.criteria || {};
    var distance = options.distance || 350;
    var method = options.method || 'GET';
    var $spinner = $(options.spinner);
    var atEnd = false;
    var loading = false;

    // Infinite scroll
    setInterval(function() {
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
    }, 100);

    $el.on('apos.scroll.reset', function(e, data) {
      if (data) {
        criteria = data;
      }
      reset();
    });

    function reset() {
      $el.html('');
      page = 0;
      atEnd = false;
      start();
      loadPage();
    }

    function loadPage() {
      page++;
      loading = true;
      $el.data('loading', true);
      // Copy the criteria and add the page
      var query = $.extend(true, criteria, {
        page: page
      });
      $.ajax({
        url: url,
        type: method,
        data: query,
        success: function(data) {
          var $items = $.parseHTML(data);
          $el.append($items);
          $el.data('page', page);
          $el.trigger('apos.scroll.loaded');
          stop();
        },
        error: function() {
          $el.data('loading', false);
          loading = false;
        },
        statusCode: {
          404: function() {
            stop();
            end();
          }
        }
      });
    }

    function start() {
      $el.data('loading', true);
      loading = true;
      $el.trigger('apos.scroll.started');
      $spinner.show();
    }

    function stop() {
      $el.data('loading', false);
      loading = false;
      $el.trigger('apos.scroll.stopped');
      $spinner.hide();
    }

    function end() {
      $el.data('loading', false);
      atEnd = true;
      $el.trigger('apos.scroll.ended');
      $spinner.hide();
    }

    if (now) {
      loadPage();
    }
  };
})( jQuery );
