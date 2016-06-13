apos.define('apostrophe-video-widgets', {
  extend: 'apostrophe-widgets',
  construct: function(self, options) {
    self.play = function($widget, data, options) {
      return apos.oembed.queryAndPlay($widget.find('[data-apos-video-player]'), data.video);
    };
  }
});
