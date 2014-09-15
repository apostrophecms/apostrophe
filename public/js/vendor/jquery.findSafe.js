$.fn.findSafe = function(selector, ignore) {
  var $self = $(this);
  return $self.find(selector).filter(function() {
    var $parents = $(this).parents();
    var i;
    for (i = 0; (i < $parents.length); i++) {
      if ($parents[i] === $self[0]) {
        return true;
      }
      if ($($parents[i]).is(ignore)) {
        return false;
      }
    }
  });
};