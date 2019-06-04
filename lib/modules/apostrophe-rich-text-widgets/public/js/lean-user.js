// If we're logged in, rich text has a "player"
// to implement the "click to start editing" behavior.
// Provide a "lean" player that just wraps that play method,
// which would not otherwise be invoked in the lean world.
// This file is pushed only for the "user" scene, so there
// is no overhead in the truly lean logged-out world.

(function() {
  apos.utils.widgetPlayers['apostrophe-rich-text'] = function(el, data, options) {
    var richText = apos.modules['apostrophe-rich-text-widgets'];
    return richText.play(window.$(el), data, options);
  };
})();
