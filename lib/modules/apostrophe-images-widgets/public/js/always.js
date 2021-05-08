// example of a widget manager with a play method.
// You don't need this file at all if you
// don't need a player.

apos.define('apostrophe-images-widgets', {
  extend: 'apostrophe-pieces-widgets',
  construct: function(self, options) {
    self.play = function($widget, data, options) {
      // If we initialize projector with no images, height is set to 0px so no messages can be shown
      // To avoid this, only initalize projector when at least one image is selected
      if (data.pieceIds.length > 0) {
        $widget.projector(options);
      }
    };
  }
});
