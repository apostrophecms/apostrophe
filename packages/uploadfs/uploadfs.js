const _ = require('lodash');
const async = require('async');
const crypto = require('crypto');
const fs = require('fs');
const { rimraf } = require('rimraf');
const delimiter = require('path').delimiter;

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Instantiates Uploadfs.
 * @class Represents an instance of Uploadfs. Usually you only want one.
 */

function Uploadfs() {
  let tempPath, imageSizes;
  let scaledJpegQuality;
  let ensuredTempDir = false;
  const self = this;
  /**
   * Initialize uploadfs. The init method passes options to the backend and
   * invokes a callback when the backend is ready.
   * @param  {Object}   options: backend, imageSizes, orientOriginals, tempPath,
   *                             copyOriginal, scaledJpegQuality, contentType, cdn.
   *                             backend is the only mandatory option. See the
   *                             README and individual methods for details.
   * @param  {Object}   options.cdn               - An object, that defines cdn settings
   * @param  {Boolean}  options.cdn.enabled=true  - Whether the cdn should be enabled
   * @param  {String}   options.cdn.url           - The cdn-url
   * @param  {Function} callback                  - Will receive the usual err argument
   */
  self.init = function (options, callback) {
    self.options = options;
    self.prefix = self.options.prefix || '';
    // bc: support options.backend
    self._storage = options.storage || options.backend;
    if (!self._storage) {
      return callback('Storage backend must be specified');
    }
    // Load standard storage backends, by name. You can also pass an object
    // with your own implementation
    if (typeof self._storage === 'string') {
      let library;
      try {
        library = require('./lib/storage/' + self._storage + '.js');
      } catch (e) {
        console.error(
          'Unable to require the ' +
            self._storage +
            ' storage backend, your node version may be too old for it'
        );
        return callback(e);
      }
      self._storage = library();
    }

    // If you want to deliver your images
    // over a CDN then this could be set in options
    if (options.cdn !== undefined) {
      if (
        !_.isObject(options.cdn) ||
        !_.isString(options.cdn.url) ||
        (options.cdn.enabled !== undefined && !_.isBoolean(options.cdn.enabled))
      ) {
        return callback(
          'CDN must be a valid object: {enabled: boolean, url: string}'
        );
      }
      if (options.cdn.enabled === undefined) {
        options.cdn.enabled = true;
      }
      self.cdn = options.cdn;
    }

    // Load image backend
    self._image = options.image;
    // Throw warnings about deprecated processors or load default
    if (self._image === 'jimp' || self._image === 'imagecrunch') {
      console.error(
        'The specified processor is no longer supported, defaulting to the sharp.js library.'
      );
      self._image = 'sharp';
    }

    let fallback = false;
    // if processor is passed as an string (including 'imagemagick' or 'sharp'),
    // try to load it or fail with warning if undefined try to load sharp and
    // fallback to imagemagick upon fail
    if (typeof self._image === 'string' || self._image === undefined) {
      self._image = self._image === undefined ? 'sharp' : self._image;
      try {
        const requiring = `./lib/image/${self._image}.js`;
        self._image = require(requiring)();
      } catch (e) {
        console.error(e);
        if (self._image === 'sharp') {
          console.error(
            'Sharp not available on this operating system. Trying to fall back to imagemagick.'
          );
          fallback = true;
        } else {
          return callback('The specified processor was not found.');
        }
      }
    }

    if (fallback) {
      // Check for presence of imagemagick - if we fail sharp load it doesn't
      // mean imagemagick is there
      const paths = (process.env.PATH || '').split(delimiter);
      if (
        _.find(paths, function (p) {
          // Allow for Windows and Unix filenames for identify. Silly oversight
          // after getting delimiter right (:
          if (
            fs.existsSync(p + '/identify') ||
            fs.existsSync(p + '/identify.exe')
          ) {
            return true;
          }
        })
      ) {
        self._image = require('./lib/image/imagemagick.js')();
      } else {
        return callback('No supported image processor found.');
      }
    }

    // Reasonable default JPEG quality setting for scaled copies. Imagemagick's default
    // quality is the quality of the original being converted, which is usually a terrible
    // idea when it's a super hi res original. And if that isn't apropos it defaults
    // to 92 which is still sky high and produces very large files
    // sub-comment - I'm not sure about the 92 above, it seems to be 80 below

    scaledJpegQuality = options.scaledJpegQuality || 80;

    imageSizes = options.imageSizes || [];

    tempPath = options.tempPath;

    async.series(
      [
        // create temp folder if needed
        function (callback) {
          if (!imageSizes.length) {
            return callback();
          }

          ensureTempDir();
          return callback(null);
        },

        // invoke storage backend init with options
        function (callback) {
          return self._storage.init(options, callback);
        },

        // invoke image backend init with options
        function (callback) {
          return self._image.init(options, callback);
        }
      ],
      callback
    );
  };

  /**
   * The copyIn method takes a local filename and copies it to a path in uploadfs.
   * Any intermediate folders that do not exist are automatically created if the
   * storage requires such things. Just copy things where you want them to go.
   * @param  {[String]}   localPath   The local filename
   * @param  {[String]}   path    The path in uploadfs, begins with /
   * @param  {[Object]}   options    Options (passed to storage). May be skipped
   * @param  {Function} callback    Will receive the usual err argument
   */
  self.copyIn = function (localPath, path, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    path = prefixPath(path);
    return self._storage.copyIn(localPath, path, options, callback);
  };

  /**
   * Obtain the temporary folder used for intermediate files created by copyImageIn.
   * Can also be useful when doing your own manipulations with copyOut.
   * @see Uploadfs#copyOut
   */
  self.getTempPath = function () {
    return tempPath;
  };

  /**
   * The copyOut method takes a path in uploadfs and a local filename and copies
   * the file back from uploadfs to the local filesystem. This should be used only
   * rarely. Heavy reliance on this method sets you up for poor performance in S3.
   * However it may be necessary at times, for instance when you want to crop an
   * image differently later. Use it only for occasional operations like cropping.
   * @param  {String}   path    Path in uploadfs (begins with /)
   * @param  {String}   localPath    Path in the local filesystem to copy to
   * @param  {Object}   options    Options (passed to backend). May be skipped
   * @param  {Function} callback    Receives the usual err argument
   */
  self.copyOut = function (path, localPath, options, callback) {
    path = prefixPath(path);
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    return self._storage.copyOut(path, localPath, options, callback);
  };

  /**
   * The streamOut method takes a path in uploadfs and a local filename and
   * returns a readable stream. This should be used only rarely.
   * Heavy reliance on this method sets you up for poor performance in S3.
   * However it may be necessary at times, for instance when access to files
   * must be secured on a request-by-request basis.
   * @param  {String}   path    Path in uploadfs (begins with /)
   * @param  {Object}   options    Options (passed to backend). May be skipped
   * @param  {Function} callback    Receives the usual err argument
   */
  self.streamOut = function (path, options) {
    path = prefixPath(path);
    return self._storage.streamOut(path, options);
  };

  /**
   * Copy an image into uploadfs. Scaled versions as defined by the imageSizes option
   * passed at init() time, or as overridden by `options.sizes` on this call,
   * are copied into uploadfs as follows:
   *
   * If 'path' is '/me' and sizes with names 'small', 'medium' and 'large'
   * were defined at init() time, the scaled versions will be:
   *
   * '/me.small.jpg', '/me.medium.jpg', '/me.large.jpg'
   *
   * And the original file will be copied to:
   *
   * '/me.jpg'
   *
   * Note that a file extension is added automatically. If you provide a
   * file extension in 'path' it will be honored when copying the original only.
   * The scaled versions will get appropriate extensions for their format
   * as detected by gm.
   *
   * If there is no error the second argument passed to the callback will
   * be an object with a 'basePath' property containing your original path
   * with the file extension removed and an 'extension' property containing
   * the automatically added file extension, as a convenience for locating the
   * original and scaled versions just by adding .jpg, .small.jpg, .medium.jpg,
   * etc.
   *
   * Scaled versions have the same file format as the original and are no wider
   * or taller than specified by the width and height properties of the
   * corresponding size, with the aspect ratio always being preserved.
   * If options.copyOriginal is explicitly false, the original image is
   * not copied into uploadfs at all.
   *
   * If options.crop is present, the image is cropped according to the
   * top, left, width and height properties of options.crop. All properties
   * must be integers. If cropping is done, it is performed first before scaling.
   *
   * IMPORTANT: if options.crop is present, the uncropped original is
   * NOT copied into uploadfs. The cropped version is what is copied
   * to "path." If you want the uncropped original too, make a separate call
   * to copyIn. A common pattern is to copy the original when an image
   * is first uploaded, and to perform crops and save them under other names
   * later, when a user decides they want cropped versions.
   *
   * Image scaling is performed with imagemagick, which must be installed
   * (note that Heroku provides it). In no case is an image ever scaled to
   * be larger than the original. Scaled versions of images with an orientation
   * hint, such as iPhone photographs, are automatically rotated by gm
   * so that they will display properly in web browsers.
   *
   * @param {String} localPath    Local filesystem path of existing image file
   * @param {String} path    Path in uploadfs to copy original to. Leave off the
   *                         extension to autodetect the true type. Path begins with /
   * @param {Object} options Options: scaledJpegQuality, copyOriginal, crop (see above)
   * @param {Function} callback Receives the usual err argument
   */

  self.copyImageIn = function (localPath, path, options, callback) {
    // We do not call prefixPath here because we rely on copyIn, which does

    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    const sizes = options.sizes || imageSizes;

    ensureTempDir();

    // We'll pass this context to the image processing backend with
    // additional properties
    const context = {
      crop: options.crop,
      sizes
    };

    context.scaledJpegQuality = options.scaledJpegQuality || scaledJpegQuality;

    // Identify the file type, size, etc. Stuff them into context.info and
    // context.extension

    function identify(path, callback) {
      return self.identifyLocalImage(path, function (err, info) {
        if (err) {
          return callback(err);
        }
        context.info = info;
        context.extension = info.extension;
        return callback(null);
      });
    }

    let originalDone = false;
    const copyOriginal = options.copyOriginal !== false;
    let originalPath;

    async.series(
      {
        // Identify the file
        identify: function (callback) {
          return identify(localPath, function (err) {
            if (err) {
              return callback(err);
            }
            return callback(null);
          });
        },
        // make a temporary folder for our work
        temporary: function (callback) {
          // Name the destination folder
          context.tempName = generateId();
          // Create destination folder
          if (sizes.length) {
            context.tempFolder = tempPath + '/' + context.tempName;
            return fs.mkdir(context.tempFolder, callback);
          } else {
            return callback(null);
          }
        },
        // Determine base path in uploadfs, working path for temporary files,
        // and final uploadfs path of the original
        paths: function (callback) {
          context.basePath = path.replace(/\.\w+$/, '');
          context.workingPath = localPath;

          // Indulge their wild claims about the extension the original
          // should have if any, otherwise provide the truth from identify
          if (path.match(/\.\w+$/)) {
            originalPath = path;
          } else {
            originalPath = path + '.' + context.extension;
          }
          return callback(null);
        },
        copyOriginal: function (callback) {
          // If there are no transformations of the original, copy it
          // in directly
          if (
            !copyOriginal ||
            options.orientOriginals !== false ||
            options.crop
          ) {
            return callback(null);
          }
          originalDone = true;
          return self.copyIn(localPath, originalPath, options, callback);
        },

        convert: function (callback) {
          context.copyOriginal = copyOriginal && !originalDone;
          return async.series([ convert, postprocess ], callback);
          function convert(callback) {
            return self._image.convert(context, callback);
          }
          function postprocess(callback) {
            if (!context.tempFolder) {
              // Nowhere to do the work
              return callback(null);
            }
            const filenames = _.map(sizes, function (size) {
              return (
                context.tempFolder + '/' + size.name + '.' + context.extension
              );
            });
            return self.postprocess(filenames, callback);
          }
        },

        reidentify: function (callback) {
          if (!context.adjustedOriginal) {
            return callback(null);
          }
          // Push and pop the original size properties as we determined
          // those on the first identify and don't want to return the values
          // for the cropped and/or reoriented version
          const originalWidth = context.info.originalWidth;
          const originalHeight = context.info.originalHeight;
          return identify(context.adjustedOriginal, function (err) {
            if (err) {
              return callback(err);
            }
            context.info.originalWidth = originalWidth;
            context.info.originalHeight = originalHeight;
            return callback(null);
          });
        },

        copySizes: function (callback) {
          return async.each(
            sizes,
            function (size, callback) {
              const suffix = size.name + '.' + context.extension;
              const tempFile = context.tempFolder + '/' + suffix;
              const permFile = context.basePath + '.' + suffix;
              return self.copyIn(tempFile, permFile, options, callback);
            },
            callback
          );
        },

        copyAdjustedOriginal: function (callback) {
          if (!context.adjustedOriginal) {
            return callback(null);
          }
          return self.copyIn(
            context.adjustedOriginal,
            originalPath,
            options,
            callback
          );
        }
      },
      function (err) {
        // Try to clean up the temp folder. This can fail if its creation
        // failed, in which case there is nothing we can or should do,
        // thus the empty callback
        if (context.tempFolder) {
          rimraf(context.tempFolder).then(() => {}).catch(e => {
            // Ignore, it probably was not created in the first place
          });
        }
        callback(
          err,
          err
            ? null
            : {
              basePath: context.basePath,
              extension: context.extension,
              width: context.info.width,
              height: context.info.height,
              originalWidth: context.info.originalWidth,
              originalHeight: context.info.originalHeight
            }
        );
      }
    );
  };

  self.getUrl = function (options, callback) {
    if (self.cdn && self.cdn.enabled) {
      return self.cdn.url;
    }
    return self._storage.getUrl(options, callback) + self.prefix;
  };

  self.remove = function (path, callback) {
    path = prefixPath(path);
    return self._storage.remove(path, callback);
  };

  /**
   * Re-enable access to the file. By default newly uploaded
   * files ARE web accessible, so you need not call this method
   * unless uploadfs.disable has been previously called.
   *
   * Be aware that you MUST call this method to guarantee access
   * to the file via copyOut, as well as via the web, even though
   * some backends may only disable access via the web. Do not
   * rely on this behavior. (Differences in behavior between
   * local filesystems and S3 require we tolerate this difference.)
   *
   * @param  {string}   path     Path as stored in uploadfs (with extension)
   * @param  {Function} callback Receives error if any, otherwise null
   */

  self.enable = function (path, callback) {
    path = prefixPath(path);
    return self._storage.enable(path, callback);
  };

  /**
   * Disable web access to the file. By default new uploads ARE
   * accessible; however this method is useful when implementing a
   * "recycle bin" or other undo-able delete feature.
   *
   * The implementation MUST block web access to the file. The
   * implementation MAY also block read access via copyOut, so be
   * aware that you MUST call uploadfs.enable to reenable access to
   * the file to guarantee you have access to it again across all
   * storage backends, even if you are using copyOut to access it.
   *
   * @param  {string}   path     Path as stored in uploadfs (with extension)
   * @param  {Function} callback Receives error if any, otherwise null
   */

  self.disable = function (path, callback) {
    path = prefixPath(path);
    return self._storage.disable(path, callback);
  };

  /**
   * Identify a local image file. Normally you don't need to call
   * this yourself, it is mostly used by copyImageIn. But you may find it
   * useful in certain migration situations, so we have exported it.
   *
   * If the file is not an image or is too defective to be identified an error is
   * passed to the callback.
   *
   * Otherwise the second argument to the callback is guaranteed to have extension, width,
   * height, orientation, originalWidth and originalHeight properties. extension will be
   * gif, jpg or png and is detected from the file's true contents, not the original file
   * extension. width and height are automatically rotated to TopLeft orientation while
   * originalWidth and originalHeight are not.
   *
   * If the orientation property is not explicitly set in the file it will be set to
   * 'Undefined'.
   *
   * Alternative backends such as "sip" that do not support orientation detection
   * will not set this property at all.
   *
   * Any other properties returned are dependent on the version of ImageMagick (or
   * other backend) used and are not guaranteed.
   *
   * @param {String} path Local filesystem path to image file
   * @param {Function} callback Receives the usual err argument, followed by an
   * object with extension, width, height, orientation, originalWidth and originalHeight
   * properties. Any other properties depend on the backend in use and are not guaranteed.
   *
   * @see Uploadfs#copyImageIn
   */

  self.identifyLocalImage = function (path, callback) {
    return self._image.identify(path, callback);
  };

  /**
   * Returns the image sizes array with which uploadfs was configured.
   * This may be of use if you must iterate over the various generated
   * images later.
   *
   * However note that a best practice is to retain information about the sizes
   * that were expected when each image was actually uploaded, because you might
   * change your mind and add or remove sizes later.
   * @return {array} [Image size objects]
   */
  self.getImageSizes = function () {
    return imageSizes;
  };

  /**
   * Destroys the uploadfs instance, allowing the backends to release any
   * resources they may be holding, such as file descriptors or interval timers.
   * Backends that hold such resources should implement their own `destroy` method,
   * also accepting a callback. The callback will receive an error if anything
   * goes awry during the cleanup process. This method does NOT remove any
   * content, it just releases system resources.
   * @param {function} callback
   */
  self.destroy = function (callback) {
    const callbacks = [
      self._storage.destroy || noOperation,
      self._image.destroy || noOperation
    ];
    return async.parallel(callbacks, callback);
    function noOperation(callback) {
      return callback(null);
    }
  };

  self.migrateToDisabledFileKey = function (callback) {
    const method = self._storage.migrateToDisabledFileKey;
    if (!method) {
      // Not relevant for this backend
      return callback(null);
    }
    return self._storage.migrateToDisabledFileKey(callback);
  };

  self.migrateFromDisabledFileKey = function (callback) {
    const method = self._storage.migrateFromDisabledFileKey;
    if (!method) {
      // Not relevant for this backend
      return callback(null);
    }
    return self._storage.migrateFromDisabledFileKey(callback);
  };

  // Called by `convert` to postprocess resized/cropped images
  // for optimal file size, etc.

  self.postprocess = function (files, callback) {
    const sample = files[0];
    if (!sample) {
      return callback(null);
    }
    const relevant = _.filter(
      self.options.postprocessors || [],
      function (postprocessor) {
        const matches = sample.match(/\.(\w+)$/);
        if (!matches) {
          return false;
        }
        const extension = matches[1];
        return _.includes(postprocessor.extensions, extension);
      }
    );
    const folder = require('path').dirname(sample);
    return async.eachSeries(
      relevant,
      function (postprocessor, callback) {
        if (postprocessor.length === 4) {
          return postprocessor.postprocessor(
            files,
            folder,
            postprocessor.options,
            callback
          );
        } else {
          return postprocessor
            .postprocessor(files, folder, postprocessor.options)
            .then(function () {
              return callback(null);
            })
            .catch(function (err) {
              return callback(err);
            });
        }
      },
      callback
    );
  };

  function prefixPath(path) {
    // Resolve any double // that results from the prefix
    return (self.prefix + path).replace(/\/\//g, '/');
  }

  function ensureTempDir() {
    if (!ensuredTempDir) {
      if (!fs.existsSync(tempPath)) {
        fs.mkdirSync(tempPath);
      }
      ensuredTempDir = true;
    }
  }
}

module.exports = function () {
  return new Uploadfs();
};
