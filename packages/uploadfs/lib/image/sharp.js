const Sharp = require('sharp');

module.exports = function () {
  return {
    /**
     * Initialize the module.
     */
    init: function (options, callback) {
      return callback(null);
    },

    destroy: function (callback) {
      return callback(null);
    },

    /**
     * Identify a local image file.
     *
     * If the file is not an image or is too defective to be identified an error is
     * passed to the callback.
     *
     * @param {String} path Local filesystem path to image file
     * @param {Function} callback Receives the usual err argument, followed by an
     * object with extension, width, height, orientation, originalWidth and
     * originalHeight properties.
     *
     * @see Uploadfs#copyImageIn
     */

    identify: function (path, callback) {
      // Identify the file type, size, etc. Stuff them into context.info and
      // context.extension. Also sets context.info.animated to true if
      // an animated GIF is found.

      const info = {};
      return Sharp(path).metadata(function (err, metadata) {
        if (err) {
          return callback(err);
        }

        info.originalWidth = metadata.width;
        info.originalHeight = metadata.height;
        // if exif header data isn't present, default to current orientation being correct
        info.orientation = metadata.orientation || 1;
        info.width = info.orientation < 5 ? metadata.width : metadata.height;
        info.height = info.orientation < 5 ? metadata.height : metadata.width;
        info.extension = metadata.format === 'jpeg' ? 'jpg' : metadata.format;
        info.animation = metadata.pages > 1;
        return callback(null, info);
      });
    },

    /**
     * Generate one or more scaled versions of an image file.
     *
     * INPUT
     *
     * The options that may be passed in the context object are:
     *
     * workingPath: path to the original file (required)
     *
     * extension: true file extension of original file as
     * determined by a previous call to identify (required).
     *
     * info.width, info.height: the width and height of the rotated image
     *
     * sizes (required): array of objects with width and height
     * properties which are treated as maximums for each axis; the resulting image
     * will never exceed the original size, and will otherwise be scaled to
     * fill as much of the requested size as possible without changing the aspect
     * ratio. Files are generated in the temp folder with a filename made up of the
     * name property of the size, a '.', and the extension property of the
     * context object.
     *
     * tempFolder: folder where the scaled versions should be written
     * (required)
     *
     * crop: optional object with top, left, width and height properties
     *
     * scaledJpegQuality: quality setting for JPEGs (optional; otherwise
     * you get whatever default was compiled into sharp)
     *
     * copyOriginal: if true, copy the "original" image to the tempFolder too,
     * but do auto-orient it so that iPhone photos etc. work on the web
     *
     * All images, including the "original" if copyOriginal is set, are
     * auto-rotated to the orientation expected by web browsers.
     *
     * OUTPUT
     *
     * After the operation is complete, the following property of the
     * context object will be set if the copyOriginal option was set:
     *
     * adjustedOriginal: will contain the local filesystem path where the
     * original was copied (and rotated, if needed).
     *
     * @param  {[type]}   context  [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */

    convert: function (context, callback) {
      // This is for a non-animated image
      const _info = context.info;
      const isAnimated = _info.animation;
      const noCrop = {
        left: 0,
        top: 0,
        width: _info.width,
        height: _info.height
      };
      const crop = context.crop ? context.crop : noCrop;

      const pipeline = Sharp(context.workingPath, { animated: isAnimated })
        .rotate()
        .extract({
          left: crop.left,
          top: crop.top,
          width: crop.width,
          height: crop.height
        });

      const promises = [];

      if (context.copyOriginal) {
        const copyPath = `${context.tempFolder}/original.${context.extension}`;
        context.adjustedOriginal = copyPath;
        promises.push(pipeline.clone().withMetadata().toFile(copyPath));
      }

      promises.push(sizeOperation());

      Promise.all(promises)
        .then((res) => {
          return callback(null);
        })
        .catch((err) => {
          console.error(err);
          return callback(err);
        });

      async function sizeOperation() {
        await Promise.all(
          context.sizes.map(async (size) => {
            const sizePath = `${context.tempFolder}/${size.name}.${context.extension}`;
            const width = Math.min(size.width, context.info.width);
            const height = Math.min(size.height, context.info.height);
            const sizePipeline = pipeline.clone();
            sizePipeline.resize({
              width,
              height,
              fit: 'inside'
            });
            if (context.extension === 'jpg') {
              const quality = context.scaledJpegQuality
                ? context.scaledJpegQuality
                : 80;
              sizePipeline.jpeg({ quality });
            }
            await sizePipeline.toFile(sizePath);
          })
        );
      }
    }
  };
};
