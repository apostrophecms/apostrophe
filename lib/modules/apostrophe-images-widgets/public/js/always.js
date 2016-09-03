// example of a widget manager with a play method.
// You don't need this file at all if you
// don't need a player.

apos.define('apostrophe-images-widgets', {
  extend: 'apostrophe-pieces-widgets',
  construct: function(self, options) {
    self.play = function($widget, data, options) {
      $widget.projector(options);
    };
  }
});
