jQuery.fn.onSafe = function(eventType, selector, ignore, fn) {
  if (arguments.length === 3) {
    fn = ignore;
    ignore = selector;
    selector = undefined;
  }
  var $el = this;
  if (selector === undefined) {
    $el.on(eventType, handleEvent);
  } else {
    $el.on(eventType, selector, handleEvent);
  }
  function handleEvent(event) {
    var $ignore = $el.find(ignore);
    if ($ignore.find(event.target).length) {
      // Leave this event alone
      return;
    }
    return fn.call(this, event);
  }
};
