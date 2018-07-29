apos.define('apostrophe-confirm', {
  construct: function(self, options) {
    // Display a confirmation prompt. If no callback is passed,
    // a promise is returned. The promise will resolve to
    // `true` (confirmed) or `false` (not confirmed). If an implementation
    // error occurs the promise is rejected. This is the easiest
    // way to use this method.
    //
    // Alternatively you may pass a callback. The
    // callback receives `(null, confirmed)` where `confirmed` is
    // either `true` or `false`. If an implementation error occurs
    // it is passed as the first argument.
    //
    // The `options` object may be omitted entirely. If present it may
    // contain `confirm`, `cancel` and `description` properties. `confirm` is
    // the label of the "Confirm" button, `cancel` is the label
    // of the "Cancel" button, and `description` is a longer
    // description displayed below the title in a smaller font.

    self.trigger = function(prompt, options, callback) {

    };
  }
});
