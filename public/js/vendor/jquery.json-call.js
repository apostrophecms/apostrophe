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
  $.jsonCall = function(url, options, data, success, failure) {
    if (typeof(data) === 'function') {
      // No options argument passed, shift the others over
      failure = success;
      success = data;
      data = options;
      options = undefined;
    }
    options = options || {};
    var ajax = $.ajax({
      type: 'POST',
      url: url,
      processData: false,
      contentType: 'application/json',
      data: JSON.stringify(data),
      dataType: options.dataType || 'json',
      success: success,
      async: options.async
    });
    if (failure) {
      ajax.fail(failure);
    }
  };
})( jQuery );
