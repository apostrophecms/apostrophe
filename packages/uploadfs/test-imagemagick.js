const uploadfs = require('./uploadfs.js')();
const fs = require('fs');
const async = require('async');
const Promise = require('bluebird');
const _ = require('lodash');
const path = require('path');

// Test the imagecrunch image backend, written specifically for Macs

const localOptions = {
  storage: 'local',
  image: 'imagemagick',
  uploadsPath: path.join(__dirname, '/test'),
  uploadsUrl: 'http://localhost:3000/test'
};

const imageSizes = [
  {
    name: 'small',
    width: 320,
    height: 320
  },
  {
    name: 'medium',
    width: 640,
    height: 640
  },
  {
    name: 'large',
    width: 1140,
    height: 1140
  }
];

const tempPath = path.join(__dirname, '/temp');
const basePath = '/images/profiles/me';

localOptions.imageSizes = imageSizes;
localOptions.tempPath = tempPath;
localOptions.backend = 'local';

localTestStart(function () {
  let filesSeen = false;
  console.log('RERUN TESTS WITH TEST OF POSTPROCESSORS');
  localOptions.postprocessors = [
    {
      postprocessor: function(files, folder, options) {
        console.log('in a postprocessor');
        if (!(options && options.test)) {
          console.error('postprocessor did not receive options');
          process.exit(1);
        }
        if (!files) {
          console.error('No files array passed to postprocessor');
          process.exit(1);
        }
        if (!files.length) {
          return Promise.resolve(true);
        }
        if (!files[0].match(/\.(gif|jpg|png)$/)) {
          console.error('postprocessor invoked for inappropriate file extension');
          process.exit(1);
        }
        if (!fs.existsSync(files[0])) {
          console.error('postprocessor invoked for nonexistent file');
          process.exit(1);
        }
        if (require('path').dirname(files[0]) !== folder) {
          console.error('folder parameter to postprocessor is incorrect');
        }
        _.each(localOptions.imageSizes, function(size) {
          if (!_.find(files, function(file) {
            return file.match(size.name);
          })) {
            console.error('postprocessor saw no file for the size ' + size.name);
            process.exit(1);
          }
        });
        filesSeen = true;
        return Promise.resolve(true);
      },
      extensions: [ 'gif', 'jpg', 'png' ],
      options: {
        test: true
      }
    }
  ];
  localTestStart(function () {
    if (!filesSeen) {
      console.error('postprocessor saw no files');
      process.exit(1);
    }
    console.log('Tests, done');
    process.exit(0);
  });
});

function localTestStart(cb) {
  const options = localOptions;
  console.log('Initializing uploadfs for the ' + options.backend + ' storage backend with the imagecrunch image backend');
  uploadfs.init(options, function(e) {
    if (e) {
      console.log('uploadfs.init failed:');
      console.log(e);
      process.exit(1);
    }
    console.log('uploadfs.init', this.options);
    testCopyImageIn();
  });

  function testCopyImageIn() {
    console.log('testing copyImageIn');

    // Note copyImageIn adds an extension for us
    uploadfs.copyImageIn('test.jpg', basePath, function(e, info) {
      if (e) {
        console.log('testCopyImageIn failed:');
        console.log(e);
        process.exit(1);
      }

      if (info.basePath !== '/images/profiles/me') {
        console.log('info.basePath is incorrect');
        process.exit(1);
      }

      console.log('Testing that returned image dimensions are reoriented');

      if ((info.width !== 1936) || (info.height !== 2592)) {
        console.log('Width and height missing or not reoriented for web use');
        console.log(info);
        process.exit(1);
      }

      if ((info.originalWidth !== 2592) || (info.originalHeight !== 1936)) {
        console.log('Original width and height missing or incorrect');
        console.log(info);
        process.exit(1);
      }

      const stats = fs.statSync('test/images/profiles/me.jpg');

      if (!stats.size) {
        console.log('Copied image is empty or missing');
        process.exit(1);
      }

      // We already tested remove, just do it to mop up
      console.log('Removing files...');
      uploadfs.remove('/images/profiles/me.jpg', function(e) {
        async.each(imageSizes, function(size, callback) {
          const name = info.basePath + '.' + size.name + '.jpg';
          const stats = fs.statSync('test' + name);
          if (!stats.size) {
            console.log('Scaled and copied image is empty or missing (2)');
            process.exit(1);
          }

          // We already tested remove, just do it to mop up
          uploadfs.remove(info.basePath + '.' + size.name + '.jpg', function(e) {
            callback();
          });
        }, function(err) {
          if (err) {
            console.log('Test failed', err);
            process.exit(1);
          }
          testCopyImageInCrop(cb);
        });
      }); // remove me.jpg
    });
  }

  function testCopyImageInCrop(cb) {
    console.log('testing copyImageIn with cropping');

    // Note copyImageIn adds an extension for us
    // Should grab the flowers
    uploadfs.copyImageIn('test.jpg', '/images/profiles/me-cropped', {
      crop: {
        top: 830,
        left: 890,
        width: 500,
        height: 500
      }
    }, function(e, info) {
      if (e) {
        console.log('testCopyImageIn failed:');
        console.log(e);
        process.exit(1);
      }

      if (info.basePath !== '/images/profiles/me-cropped') {
        console.log('info.basePath is incorrect');
        process.exit(1);
      }

      console.log('Testing that returned image dimensions are reoriented');

      if ((info.width !== 500) || (info.height !== 500)) {
        console.log('Reported size does not match crop');
        console.log(info);
        process.exit(1);
      }

      const stats = fs.statSync('test/images/profiles/me-cropped.jpg');

      if (!stats.size) {
        console.log('Copied image is empty or missing');
        process.exit(1);
      }

      // We already tested remove, just do it to mop up
      console.log('Removing files...');
      uploadfs.remove(`${basePath}-cropped.jpg`, function(e) {
        async.each(imageSizes, function(size, callback) {
          const name = info.basePath + '.' + size.name + '.jpg';
          const stats = fs.statSync('test' + name);
          if (!stats.size) {
            console.log('Scaled and copied image is empty or missing (2)');
            process.exit(1);
          }
          // We already tested remove, just do it to mop up
          uploadfs.remove(info.basePath + '.' + size.name + '.jpg', function(e) {
            callback(e);
          });
        }, function (err) {
          if (err) {
            console.log('Remove file fails', err);
            process.exit(1);
          }
          console.log('Files removed');
          cb();
        });
      });
    });
  }
}
