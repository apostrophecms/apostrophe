// find-by-name: a jQuery plugin that makes it convenient to find an
// element by its name attribute, especially when the name is
// stored in a variable.
//
// Copyright 2013 P'unk Avenue LLC
//
// Please see:
//
// https://github.com/punkave/jquery-find-by-name
//
// For complete documentation.

(function( $ ){
  $.fn.findByName = function(name) {
    return this.find('[name="' + name + '"]');
  };
})( jQuery );
