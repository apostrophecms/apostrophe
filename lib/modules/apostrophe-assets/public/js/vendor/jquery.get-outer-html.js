// get-outer-html: a jQuery plugin that makes it easy to get the
// outer HTML of an element, including the element itself.
//
// Copyright 2013 P'unk Avenue LLC
//
// Please see:
//
// https://github.com/punkave/jquery-get-outer-html
//
// For complete documentation.

(function( $ ){
  $.fn.getOuterHTML = function() {
    var wrapper = $('<div></div>');
    wrapper.append(this.clone());
    return wrapper.html();
  };
})( jQuery );
