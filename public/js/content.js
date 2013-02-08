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

apos.widgetPlayers = {};

// An example: the video player replaces a thumbnail with 
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
}

