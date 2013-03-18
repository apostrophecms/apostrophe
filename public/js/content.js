/* jshint undef: true */
/* global $, _ */
/* global alert, prompt */

if (!window.apos) {
  window.apos = {};
}

var apos = window.apos;

// An extensible way to fire up javascript-powered players for
// the normal views of widgets that need them

apos.enablePlayers = function(sel) {
  if (!sel) {
    sel = 'body';
  }
  $(sel).find('.apos-widget').each(function() {
    var $widget = $(this);
    var type = $widget.attr('data-type');
    if (apos.widgetPlayers[type]) {
      apos.widgetPlayers[type]($widget);
    }
  });
};

// When apos.change('blog') is invoked, the contents of all elements in the page
// with data-apos-trigger-blog are refreshed from the URL specified by their
// data-apos-source attribute. If they have no data-apos-source attribute, they
// receive an apos-change-blog jQuery event instead. This accommodates the needs
// of both server-rendered and browser-rendered components.

apos.change = function(what) {
  apos.log('apos.change');
  var sel = '[data-apos-trigger-' + what + ']';
  apos.log('Triggering on' + sel);
  $(sel).each(function() {
    var $el = $(this);
    apos.log('Found an element');
    var source = $el.attr('data-apos-source');
    if (source) {
      apos.log('With a source');
      $.get(source, {}, function(data) {
        apos.log('Data is ' + data);
        apos.log(this);
        $el.html(data);
      });
    } else {
      apos.log('No source, triggering event: ' + 'apos-change-' + what);
      $(this).trigger('apos-change-' + what);
    }
  });
};

apos.widgetPlayers = {};

apos.widgetPlayers.slideshow = function($widget)
{
  // TODO take the interval from data attributes, add arrows based on
  // data attributes, and so on. Include controls in the form to set
  // those options. Consider allowing for titles and descriptions.
  // Support all those cool fades we love to do. Et cetera, et cetera.

  var interval = setInterval(function() {
    var $current = $widget.find('[data-slideshow-item].apos-current');
    if (!$current.length) {
      // Widget has gone away. Kill the interval timer and go away too
      clearInterval(interval);
      return;
    }
    var $next = $current.next();
    if (!$next.length) {
      $next = $current.closest('[data-slideshow-items]').find('[data-slideshow-item]:first');
    }
    $current.removeClass('apos-current');
    $next.addClass('apos-current');
  }, 5000);

  // Wait until the height of all images is known, then
  // set the height of the entire slideshow. This prevents
  // the clearly unacceptable "jumping" behavior.
  function adjustSize() {
    var ready = true;
    var maxHeight = 0;
    $widget.find('[data-image]').each(function(i, item) {
      if (!item.complete) {
        ready = false;
        return;
      }
      var height = $(item).height();
      if (height > maxHeight) {
        maxHeight = height;
      }
    });

    if (ready) {
      $widget.find('[data-slideshow-items]').height(maxHeight);
    } else {
      setTimeout(adjustSize, 100);
    }
  }

  adjustSize();
};

// The video player replaces a thumbnail with
// a suitable player via apos's oembed proxy

apos.widgetPlayers.video = function($widget)
{
  var videoUrl = $widget.attr('data-video');
  $.get('/apos/oembed', { url: videoUrl }, function(data) {
    var e = $(data.html);
    e.removeAttr('width');
    e.removeAttr('height');
    e.width($widget.width());
    e.height($widget.height());
    $widget.html(e);
  });
};

