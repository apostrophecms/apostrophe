if (!window.jot) {
  window.jot = {};
}

var jot = window.jot;

// An extensible way to fire up javascript-powered players for 
// the normal views of widgets that need them

jot.enablePlayers = function(sel) {
  if (!sel) {
    sel = 'body';
  }
  $(sel).find('.jot-widget').each(function() {
    var $widget = $(this);
    var type = $widget.attr('data-type');
    if (jot.widgetPlayers[type]) {
      jot.widgetPlayers[type]($widget);
    }
  });
};

jot.widgetPlayers = {};

// An example: the video player replaces a thumbnail with 
// a suitable player via jot's oembed proxy

jot.widgetPlayers.video = function($widget)
{
  var videoUrl = $widget.attr('data-video');
  $.get('/jot/oembed', { url: videoUrl }, function(data) {
    var e = $(data.html);
    e.removeAttr('width');
    e.removeAttr('height');
    e.width($widget.width());
    e.height($widget.height());
    $widget.html(e);
  });
}

// Other players have to use JSONP to talk to APIs on other
// domains, like Twitter. For these, provide a separate namespace
// so we don't invoke them above

jot.widgetJsonp = {};

