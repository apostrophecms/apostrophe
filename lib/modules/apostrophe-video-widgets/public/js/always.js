apos.define('apostrophe-video-widgets', {
  extend: 'apostrophe-widgets',
  construct: function(self, options) {
    self.play = function($widget, data, options) {
      var request = _.assign({}, data.video, { neverOpenGraph: 1 });
      return apos.oembed.queryAndPlay($widget.find('[data-apos-video-player]'), request);
    };
  }
});
