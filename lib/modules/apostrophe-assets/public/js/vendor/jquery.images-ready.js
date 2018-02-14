// imagesReady: a jQuery plugin that waits for image sizes to be
// known, then reports max width, max height and max aspect ratio
//
// Copyright 2013 P'unk Avenue LLC
//
// Please see:
//
// https://github.com/punkave/jquery-images-ready
//
// For complete documentation.

(function( $ ){
  $.fn.imagesReady = function(callback) {
    var countlogs = 0;
    // Both descendant images and images directly matched
    // are welcome here
    var $el = this;
    var $images = $el.filter('img').add($el.find('img'));
    var tmps = [];
    var tmpsLoaded = 0;

    $images.each(function(i, item) {
      // Great, the image loaded, but CSS may have scaled it and we need
      // to know its true dimensions. So jam it into a temporary image
      // element and wait for that to be ready. Note that the original
      // and the temporary copy may become ready at different times
      // (yes we've seen that happen), so we wait for the copy to be
      // ready.

      if (!tmps[i]) {
        tmps[i] = new Image();
        $(tmps[i]).on('load', function() {
          tmpsLoaded++;
        });
        tmps[i].src = item.src;
      }
    });

    function wait() {
      // Wait for all temporary images to be loaded according to
      // jQuery's load event
      if (tmpsLoaded === tmps.length) {
        return finish();
      }
      setTimeout(wait, 50);
    }

    function finish() {
      // Now we can compute overall stats
      var maxWidth = 0;
      var maxHeightToWidth = 0 ;
      var maxHeight = 0;

      $.each(tmps, function(i, tmp) {
        var width = tmp.width;
        var height = tmp.height;
        if (width > maxWidth) {
          maxWidth = width;
        }
        if (height > maxHeight) {
          maxHeight = height;
        }
        if (width && height) {
          var heightToWidth = height / width;
          if (heightToWidth > maxHeightToWidth) {
            maxHeightToWidth = heightToWidth;
          }
        }
      });
      return callback(maxWidth, maxHeight, maxHeightToWidth);
    }

    wait();
  };
})( jQuery );
