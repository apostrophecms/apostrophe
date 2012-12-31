if (!window.jot) {
  window.jot = {};
}

var jot = window.jot;

jot.enablePlayers = function(sel) {
  if (!sel) {
    sel = 'body';
  }
  $(sel).find('.jot-widget[data-widget-type="Video"]').each(function() {
    var $widget = $(this);
    var videoUrl = $widget.attr('data-video-url');
    $.get('/jot/oembed', { url: videoUrl }, function(data) {
      var e = $(data.html);
      e.removeAttr('width');
      e.removeAttr('height');
      e.width($widget.width());
      e.height($widget.height());
      $widget.html(e);
    });
  });
};
