// jsonCall: a jQuery plugin that makes it easy to make an API
// request to a URL with JSON in BOTH directions.
//
// Copyright 2013 P'unk Avenue LLC
//
// Please see:
//
// https://github.com/punkave/jquery-json-call
//
// For complete documentation.

(function( $ ) {
  // This is correct - we're adding a function called directly
  // like $.get or $.ajax, not a function that operates on
  // elements
  $.jsonCall = function(url, data, success, failure) {
    var ajax = $.ajax({
      type: 'POST',
      url: url,
      processData: false,
      contentType: 'application/json',
      data: JSON.stringify(data),
      dataType: 'json',
      success: success
    });
    if (failure) {
      ajax.fail(failure);
    }
  };
})( jQuery );
