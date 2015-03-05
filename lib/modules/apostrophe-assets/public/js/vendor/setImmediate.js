// polyfill for setImmediate. Not trying to be wildly performant
if (!window.setImmediate) {
  window.setImmediate = function(fn) {
    return setTimeout(fn, 0);
  };
  window.clearImmediate = function(im) {
    return clearTimeout(im);
  };
}
