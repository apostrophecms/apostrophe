/* jshint node:true */
// Use Aaron Heckmann's graphicsmagick interface in its imagemagick-compatible
// configuration so our system requirements don't change and everything still
// works in Heroku. It's a good thing we can do this, since node-imagemagick
// has been abandoned. We also use our own custom command lines for
// drastically better performance and memory usage.
const childProcess = require('child_process');
const _ = require('lodash');
const async = require('async');
const util = require('util');
const execFile = util.promisify(childProcess.execFile);

module.exports = function() {
  let options;
  const self = {
    /**
     * Initialize the module. If _options.gifsicle is true, use gifsicle to manipulate
     * animated GIFs
     */
    init: function(_options, callback) {
      options = _options;
      return callback(null);
    },

    destroy: function(callback) {
      // No file descriptors or timeouts held
      return callback(null);
    },

    /**
     * Identify a local image file.
     *
     * If the file is not an image or is too defective to be identified an error is
     * passed to the callback.
     *
     * Otherwise the second argument to the callback is guaranteed to have extension,
     * width, height, orientation, originalWidth and originalHeight properties.
     * extension will be gif, jpg or png and is detected from the file's true contents,
     * not the original file extension. With the imagemagick backend, width and height
     * are automatically rotated to TopLeft orientation while originalWidth and
     * originalHeight are not.
     *
     * If the orientation property is not explicitly set in the file it will be set to
     * 'Undefined'.
     *
     * Any other properties returned are dependent on the version of ImageMagick used
     * and are not guaranteed.
     *
     * @param {String} path Local filesystem path to image file
     * @param {Function} callback Receives the usual err argument, followed by an
     * object with extension, width, height, orientation, originalWidth,
     * originalHeight and animated properties. Any other properties depend on the backend
     * in use and are not guaranteed
     *
     * @see Uploadfs#copyImageIn
     */

    async identify(path, callback) {
      try {
        const info = await getProperties(path);
        if (info.extension === 'gif') {
          info.animated = await getAnimated(path);
        } else {
          info.animated = false;
        }
        return callback(null, info);
      } catch (e) {
        return callback(e);
      }

      async function getProperties() {
        // Parse identify output ourselves to avoid using unmaintained third party wrappers. -Tom
        const { stdout } = await execFile('identify', [ '-verbose', path ], { encoding: 'utf8' });
        const parsed = Object.fromEntries(stdout.split('\n').filter(line => line.trim().includes(': ')).map(line => {
          const cat = line.indexOf(':');
          return [ line.substring(0, cat).trim(), line.substring(cat + 1).trim() ];
        }));
        const format = parsed.Format.toLowerCase().split(' ')[0];
        const geometry = parsed.Geometry.match(/^(\d+)x(\d+)/);
        const info = {
          originalWidth: parseInt(geometry[1]),
          originalHeight: parseInt(geometry[2]),
          orientation: parsed.Orientation
        };
        if (format === 'jpeg') {
          info.extension = 'jpg';
        } else {
          info.extension = format;
        }
        const o = info.orientation;
        if ((o === 'LeftTop') || (o === 'RightTop') || (o === 'RightBottom') || (o === 'LeftBottom')) {
          info.width = info.originalHeight;
          info.height = info.originalWidth;
        } else {
          info.width = info.originalWidth;
          info.height = info.originalHeight;
        }
        return info;
      }

      async function getAnimated(path) {
        const { stdout } = await execFile('identify', [ '-format', '%n', path ], { encoding: 'utf8' });
        const frames = parseInt(stdout, 10);
        return frames > 1;
      }
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
     * info.width, info.height: should be provided as other backends may require
     * them, however the imagemagick backend does not need to consult them.
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
     * you get whatever default was compiled into imagemagick)
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

    convert: function(context, callback) {
      if (context.info.animated) {
        if (options.gifsicle) {
          return convertAnimatedGifsicle(context, callback);
        } else {
          return convertAnimated(context, callback);
        }
      } else {
        return convertStandard(context, callback);
      }

      // Animated GIF strategy based on gifsicle. gifsicle doesn't hit RAM limits
      // when confronted with huge animated GIFs, but it does tend to make files
      // bigger and doesn't resize quite as well. Tradeoffs are part of life

      function convertAnimatedGifsicle(context, callback) {
        const crop = context.crop;
        const imageSizes = context.sizes;
        const baseArgs = [];
        if (crop) {
          baseArgs.push('--crop');
          baseArgs.push(crop.left + ',' + crop.top + '+' + crop.width + 'x' + crop.height);
        }
        baseArgs.push(context.workingPath);
        return async.series([ convertOriginal, convertSizes ], callback);
        function convertOriginal(callback) {
          if (!context.copyOriginal) {
            return setImmediate(callback);
          }
          const path = context.tempFolder + '/original.' + context.extension;
          context.adjustedOriginal = path;
          const args = baseArgs.slice();
          args.push('--optimize');
          args.push('-o');
          args.push(path);
          return spawnThen('gifsicle', args, callback);
        }
        function convertSizes(callback) {
          return async.eachSeries(imageSizes, convertSize, callback);
        }
        function convertSize(size, callback) {
          const args = baseArgs.slice();
          args.push('--resize');
          // "Largest that fits in the box" is not a built-in feature of gifsicle, so we do the math
          const originalWidth = (crop && crop.width) || context.info.width;
          const originalHeight = (crop && crop.height) || context.info.height;
          let width = originalWidth;
          let height = Math.round(size.width * originalHeight / originalWidth);
          if (height > originalHeight) {
            height = size.height;
            width = Math.round(size.height * originalWidth / originalHeight);
          }
          args.push(width + 'x' + height);
          args.push('--optimize');
          args.push('-o');
          const suffix = size.name + '.' + context.extension;
          const tempFile = context.tempFolder + '/' + suffix;
          args.push(tempFile);
          return spawnThen('gifsicle', args, callback);
        }
      }

      // Separate animated GIF strategy is back because of tests in which (1) we
      // suffered image damage (which could possibly be addressed with -coalesce)
      // and (2) imagemagick inexplicably took 4x longer in some cases with the
      // single pipeline (which couldn't be addressed without a new approach).
      // This is why we don't just rely on -clone 0--1 and a single pipeline. -Tom

      function convertAnimated(context, callback) {
        const crop = context.crop;
        const imageSizes = context.sizes;
        const baseArgs = [];
        baseArgs.push(context.workingPath);
        // Convert to filmstrip so cropping and resizing
        // don't behave strangely
        baseArgs.push('-coalesce');
        baseArgs.push('-auto-orient');
        if (crop) {
          baseArgs.push('-crop');
          baseArgs.push(crop.width + 'x' + crop.height + '+' + crop.left + '+' + crop.top);
          baseArgs.push('+repage');
        }
        return async.series([ convertOriginal, convertSizes ], callback);
        function convertOriginal(callback) {
          if (!context.copyOriginal) {
            return setImmediate(callback);
          }
          const path = context.tempFolder + '/original.' + context.extension;
          context.adjustedOriginal = path;
          const args = baseArgs.slice();
          args.push('-layers');
          args.push('Optimize');
          args.push(path);
          return spawnThen('convert', args, callback);
        }
        function convertSizes(callback) {
          return async.eachSeries(imageSizes, convertSize, callback);
        }
        function convertSize(size, callback) {
          const args = baseArgs.slice();
          args.push('-resize');
          args.push(size.width + 'x' + size.height + '>');
          args.push('-layers');
          args.push('Optimize');
          const suffix = size.name + '.' + context.extension;
          const tempFile = context.tempFolder + '/' + suffix;
          args.push(tempFile);
          return spawnThen('convert', args, callback);
        }
      }

      function convertStandard(context, callback) {
        // For performance we build our own imagemagick command which tackles all the
        // sizes in one run, avoiding redundant loads. We also scale to the largest
        // size we really want first and use that as a basis for all others, without
        // any lossy intermediate files, which is an even bigger win.
        //
        const args = [];
        const crop = context.crop;
        const imageSizes = context.sizes;
        args.push(context.workingPath);
        args.push('-auto-orient');
        if (crop) {
          args.push('-crop');
          args.push(crop.width + 'x' + crop.height + '+' + crop.left + '+' + crop.top);
          args.push('+repage');
        }
        if (context.extension === 'jpg') {
          // Always convert to a colorspace all browsers understand.
          // CMYK will flat out fail in IE8 for instance
          args.push('-colorspace');
          args.push('sRGB');
        }

        if (context.copyOriginal) {
          context.adjustedOriginal = context.tempFolder + '/original.' + context.extension;
          args.push('(');
          args.push('-clone');
          args.push('0--1');
          args.push('-write');
          args.push(context.adjustedOriginal);
          args.push('+delete');
          args.push(')');
        }

        // Make sure we strip metadata before we get to scaled versions as
        // some files have ridiculously huge metadata
        args.push('-strip');

        // After testing this with several sets of developer eyeballs, we've
        // decided it is kosher to resample to the largest size we're
        // interested in keeping, then sample down from there. Since we
        // do it all inside imagemagick without creating any intermediate
        // lossy files, there is no quality loss, and the speed benefit is
        // yet another 2x win! Hooray!
        let maxWidth = 0;
        let maxHeight = 0;
        _.each(imageSizes, function(size) {
          if (size.width > maxWidth) {
            maxWidth = size.width;
          }
          if (size.height > maxHeight) {
            maxHeight = size.height;
          }
        });
        if (maxWidth && maxHeight) {
          args.push('-resize');
          args.push(maxWidth + 'x' + maxHeight + '>');
        }

        const resizedPaths = [];

        _.each(imageSizes, function(size) {
          args.push('(');
          args.push('-clone');
          args.push('0--1');
          args.push('-resize');
          args.push(size.width + 'x' + size.height + '>');
          if (context.scaledJpegQuality && (context.extension === 'jpg')) {
            args.push('-quality');
            args.push(context.scaledJpegQuality);
          }
          args.push('-write');
          const suffix = size.name + '.' + context.extension;
          const tempFile = context.tempFolder + '/' + suffix;
          resizedPaths.push(tempFile);
          args.push(tempFile);
          args.push('+delete');
          args.push(')');
        });

        // We don't care about the official output, which would be the
        // intermediate scaled version of the image. Use imagemagick's
        // official null format

        args.push('null:');

        return spawnThen('convert', args, callback);
      }

      function spawnThen(cmd, args, callback) {
        // console.log(cmd + ' ' + args.join(' ').replace(/[^\w\-\ ]/g, function(c) {
        //   return '\\' + c;
        // }));
        return childProcess.execFile(cmd, args, function(err) {
          if (err) {
            return callback(err);
          }
          return callback(null);
        });
      }
    }
  };
  return self;
};
