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
        var checked = ($(this).attr('value') === value);
        // The attribute should be set or unset...
        if (checked) {
          this.setAttribute('checked', 'checked');
        } else {
          this.removeAttribute('checked');
        }
        // And also the property
        this.checked = checked;
      });
    }
  };
})( jQuery );
