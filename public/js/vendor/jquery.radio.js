// radio: a jQuery plugin that makes it easy to set or get the
// current value of a group of radio buttons.
//
// Copyright 2013 P'unk Avenue LLC
//
// Please see:
//
// https://github.com/punkave/jquery-radio
//
// For complete documentation.

(function( $ ){
  $.fn.radio = function(value) {
    var $els = this;
    if (value === undefined) {
      return $els.filter(':checked').val();
    } else {
      $.each($els, function() {
        $(this).attr('checked', $(this).attr('value') === value);
      });
    }
  };
})( jQuery );
