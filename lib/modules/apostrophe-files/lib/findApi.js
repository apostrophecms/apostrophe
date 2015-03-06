var _ = require('lodash');

module.exports = function(self, options) { 
  self.find = {
    // Find an image referenced within an area, such as an image in a slideshow widget.
    // Returns the first image matching the criteria. Only GIF, JPEG and PNG images
    // will ever be returned.
    //
    // EASY SYNTAX:
    //
    // apos.files.find.imageInArea(page, 'body')
    //
    // You may also add options, such as "extension" to force the results to
    // include JPEGs only:
    //
    // apos.files.find.imageInArea(page, 'body', { extension: 'jpg' })
    //
    // (Note Apostrophe always uses .jpg for JPEGs.)
    //
    // CLASSIC SYNTAX (this is the hard way):
    //
    // apos.files.find.imageInArea({ area: page.body })
    //
    // OPTIONS:
    //
    // You may specify `extension` or `extensions` (an array of extensions)
    // to filter the results.

    imageInArea: function(_options /* or page, name, options */) {
      var options = {};
      if (arguments.length > 1) {
        options.area = arguments[0] && arguments[0][arguments[1]];
        _.extend(options, arguments[2]);
      } else {
        _.extend(options, _options);
      }
      options.group = 'images';
      return self.find.fileInArea(options);
    },

    // Find images referenced within an area, such as images in a slideshow widget.
    // Returns all the files matching the criteria unless the "limit" option is used.
    //
    // EASY SYNTAX:
    //
    // apos.areaImages(page, 'body')
    //
    // Now you can loop over them with "for".
    //
    // You may also add options:
    //
    // apos.areaImages(page, 'body', { extension: 'jpg', limit: 2 })
    //
    // Note that Apostrophe always uses three-letter lowercase extensions.
    //
    // CLASSIC SYNTAX:
    //
    // apos.areaImage({ area: page.body })
    //
    // OPTIONS:
    //
    // You may specify `extension`, or `extensions` (an array of extensions).
    //
    // The `limit` option limits the number of results returned. Note that
    // `areaImage` is more convenient than `apos.areaImages` if limit is 1.
    //
    // See also apos.areaFiles.

    imagesInArea: function(_options /* or page, name, options */) {
      var options = {};
      if (arguments.length > 1) {

        options.area = arguments[0] && arguments[0][arguments[1]];
        extend(true, options, arguments[2]);
      } else {
        extend(true, options, _options);
      }
      options.group = 'images';
      return self.areaFiles(options);
    },

    // Find a file referenced within an area, such as an image in a slideshow widget,
    // or a PDF in a file widget.
    //
    // Returns the first file matching the criteria.
    //
    // EASY SYNTAX:
    //
    // apos.areaFile(page, 'body')
    //
    // You may also add options:
    //
    // apos.areaFile(page, 'body', { extension: 'jpg' })
    //
    // CLASSIC SYNTAX:
    //
    // apos.areaFile({ area: page.body })
    //
    // OPTIONS:
    //
    // You may specify `extension`, `extensions` (an array of extensions)
    // or `group` to filter the results. By default the `images` and `office` groups
    // are available.
    //
    // If you are using `group: "images"` consider calling apos.areaImage instead.
    // This is convenient and protects you from accidentally getting a PDF file.

    fileInArea: function(_options /* or page, name, options */) {
      var options = {};
      if (arguments.length > 1) {

        options.area = arguments[0] && arguments[0][arguments[1]];
        _.extend(options, arguments[2]);
      } else {
        _.extend(options, _options);
      }
      options.limit = 1;
      var files = self.areaFiles(options);
      return files[0];
    },

    // Find files referenced within an area, such as an image in a slideshow widget.
    // Returns all the files matching the criteria unless the "limit" option is used.
    //
    // EASY SYNTAX:
    //
    // apos.areaFiles(page, 'body')
    //
    // You may also add options:
    //
    // apos.areaFiles(page, 'body', { extension: 'jpg', limit: 2 })
    //
    // CLASSIC SYNTAX:
    //
    // apos.areaFile({ area: page.body })
    //
    // OPTIONS:
    //
    // You may specify `extension`, `extensions` (an array of extensions)
    // or `group` to filter the results. By default the `images` and `office` groups
    // are available.
    //
    // The `limit` option limits the number of results returned. Note that
    // `areaFile` is more convenient than `apos.areaFiles`.

    filesInArea: function(_options /* or page, name, options */) {
      var options = {};
      if (arguments.length > 1) {

        options.area = arguments[0] && arguments[0][arguments[1]];
        _.extend(options, arguments[2]);
      } else {
        _.extend(options, _options);
      }

      function testFile(file) {
        if (file.extension === undefined) {
          // Probably not a file
          return false;
        }
        if (options.extension) {
          if (file.extension !== options.extension) {
            return false;
          }
        }
        if (options.group) {
          if (file.group !== options.group) {
            return false;
          }
        }
        if (options.extensions) {
          if (!_.contains(options.extensions, file.extension)) {
            return false;
          }
        }
        return true;
      }

      if (!options) {
        options = {};
      }
      var area = options.area;
      var winningFiles = [];
      if (!(area && area.items)) {
        return [];
      }
      var i, j;
      for (i = 0; (i < area.items.length); i++) {
        var item = area.items[i];
        // The slideshow, files and similar widgets use an 'items' array
        // to store files. Let's look there, and also allow for '_items' to
        // support future widgets that pull in files dynamically. However
        // we also must make sure the items are actually files by making
        // sure they have an `extension` property. (TODO: this is a hack,
        // think about having widgets register to participate in this.)
        if (!item._items) {
          continue;
        }
        for (j = 0; (j < item._items.length); j++) {
          if ((options.limit !== undefined) && (winningFiles.length >= options.limit)) {
            return winningFiles;
          }
          var file = item._items[j];
          var good = testFile(file);

          if (good) {
            winningFiles.push(file);
          } else {
          }
        }
      }
      return winningFiles;
    }
  };
};
