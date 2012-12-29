function jotWiki() {
  var self = this;
  self.enableVideoPlayers = function() {
    $('[data-widget-type="video"]').click(function() {
      var $widget = $(this);
      var videoUrl = $widget.attr('data-video-url');
      $.get('/oembed', { url: videoUrl }, function(data) {
        var e = $(data.html);
        e.removeAttr('width');
        e.removeAttr('height');
        e.css('width', $widget.width());
        e.css('height', $widget.height());
        e.addClass($widget.attr('data-size'));
        e.addClass($widget.attr('data-position'));
        var src = e.attr('src');
        // This is crude, I should check if it's already there
        if (src) {
          if (src.indexOf('?') !== -1) {
            src += '&autoplay=1';
          } else {
            src += '?autoplay=1';
          }
          e.attr('src', src);
        }
        $widget.replaceWith(e);
      });
    });
  };
  self.log = function(s) {
    if (console && console.log) {
      console.log(s);
    }
  };
};

window.jotWiki = new jotWiki();
