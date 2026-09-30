#!/usr/bin/env node

const fs = require('fs');
const { join } = require('path');
const async = require('async');
const Promise = require('bluebird');
const { each, find } = require('lodash');
const uploadfs = require('./uploadfs.js')();

// colored output
const color = (input, num = 255) => `\x1b[38;5;${num}m${input}\x1b[0m`;
const red = input => color(input, 1);
const grn = input => color(input, 2);
const blu = input => color(input, 6);

// status msg
const check = (num, msg) => console.log(`(${num})${' '.repeat(13)}${msg}`);
const pass = (num, msg = '') =>
  console.log(`${grn(`(${num})`)}${' '.repeat(13)}${grn('OK')} ${msg}\n`);
const fail = (num, msg = '') => {
  console.log(`${red(`(${num})`)}${' '.repeat(13)}${red('ERROR')} ${msg}\n`);
  process.exit(1);
};

// time
const elapsed = () => (performance.nodeTiming.duration / 1000).toFixed(2);

// settings
const img = 'test.webp';
const ext = 'webp';
const basePath = '/images/profiles/me';
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
const config = {
  backend: 'local',
  image: 'sharp',
  uploadsPath: join(__dirname, '/test'),
  uploadsUrl: 'http://localhost:3000/test',
  tempPath: join(__dirname, '/temp'),
  imageSizes
};

// TEST: crop
const testCopyImageInCrop = cb => {
  check(6, `uploadfs.copyImageIn('${blu(img)}') with cropping`);
  uploadfs.copyImageIn(
    img,
    '/images/profiles/me-cropped',
    {
      crop: {
        top: 830,
        left: 890,
        width: 500,
        height: 500
      }
    },
    (e, info) => {
      if (e) {
        fail(6, e);
      }
      if (info.basePath !== '/images/profiles/me-cropped') {
        fail(6, 'info.basePath is incorrect');
      }
      pass(6);

      check(7, 'returned image dimensions are reoriented');
      if (info.width !== 500 || info.height !== 500) {
        fail(7, 'reported size does not match crop');
      }

      if (!fs.statSync(`test/images/profiles/me-cropped.${ext}`).size) {
        fail(7, 'cannot stat copied image');
      }
      pass(7);

      check(8, 'removing files');
      uploadfs.remove(`${basePath}-cropped.${ext}`, e => {
        async.each(
          imageSizes,
          (size, cb) => {
            const name = `${info.basePath}.${size.name}.${ext}`;
            if (!fs.statSync(`test${name}`).size) {
              fail(8, 'cannot stat scaled/copied image');
            }
            uploadfs.remove(name, e => cb(e));
          },
          e => {
            if (e) {
              fail(8, e);
            }
            pass(8);

            // done, return
            cb();
          }
        );
      });
    }
  );
};

// TEST: copy
const testCopyImageIn = cb => {
  check(2, `uploadfs.copyImageIn('${blu(img)}')`);
  uploadfs.copyImageIn(img, basePath, (e, info) => {
    if (e) {
      fail(2, e);
    }
    if (info.basePath !== '/images/profiles/me') {
      fail(2, 'info.basePath is incorrect');
    }
    pass(2);

    // check(3, 'returned image dimensions are reoriented');
    // if (info.width !== 1936 || info.height !== 2592) {
    //   fail(3, 'Width and height missing or not reoriented for web use');
    // }
    // if (info.originalWidth !== 2592 || info.originalHeight !== 1936) {
    //   fail(3, 'Original width and height missing or incorrect');
    // }
    // pass(3);

    check(4, 'locate copied image');
    if (!fs.statSync(`test/images/profiles/me.${ext}`).size) {
      fail(4, 'cannot stat copied image');
    }
    pass(4);

    check(5, 'removing files');
    uploadfs.remove(`/images/profiles/me.${ext}`, e =>
      async.each(
        imageSizes,
        (size, cb) => {
          const name = `${info.basePath}.${size.name}.${ext}`;
          if (!fs.statSync(`test${name}`).size) {
            fail(5, 'cannot stat scaled/copied image');
          }
          uploadfs.remove(name, () => cb());
        },
        e => {
          if (e) {
            fail(5, e);
          }
          pass(5);

          // done, test crop next
          testCopyImageInCrop(cb);
        }
      )
    );
  });
};

const run = (cb, msg = 'Running tests', opts = config) => {
  console.log(`${msg}\n`);
  check(1, 'init');
  uploadfs.init(opts, e => {
    if (e) {
      fail(1, e);
    }
    pass(1);

    // done, test copy next
    testCopyImageIn(cb);
  });
};

// initial msg
console.log(`
+ ${blu('Config')} 

{ 
  ${blu('processor')}: '${grn(config.image)}',
  ${blu('storage')}: '${grn(config.backend)}' 
}
`);

// first run
run(() => {
  let filesSeen = false;

  config.postprocessors = [
    {
      postprocessor: (files, folder, options = { test: false }) => {
        console.log(`${' '.repeat(16)}(${blu('using postprocessor')})\n`);

        if (!options.test) {
          fail('Postprocessor', 'postprocessor did not receive options');
        }
        if (!files) {
          fail('Postprocessor', 'did not receive files array');
        }
        if (!files.length) {
          return Promise.resolve(true);
        }
        if (!files[0].match(/\.(gif|jpg|png|webp)$/)) {
          fail('Postprocessor', `invalid file extension: ${files[0]}`);
        }
        if (!fs.existsSync(files[0])) {
          fail('Postprocessor', `cannot locate file: ${files[0]}`);
        }
        if (require('path').dirname(files[0]) !== folder) {
          fail('Postprocessor', 'received incorrect folder path');
        }
        each(config.imageSizes, size => {
          if (!find(files, f => f.match(size.name))) {
            fail('Postprocessor', `cannot stat resized file (${size.name})`);
          }
        });
        filesSeen = true;
        return Promise.resolve(true);
      },
      extensions: [ 'gif', 'jpg', 'png', 'webp' ],
      options: { test: true }
    }
  ];

  // second run (postprocessing)
  run(() => {
    if (!filesSeen) {
      fail(0, 'postprocessor saw no files');
    }

    // All tests passed!
    console.log(`+ ${blu('Completed')} in ${grn(elapsed())} seconds\n`);
    process.exit(0);
  },

    `+ ${blu('Postprocessors')}`
  );
}, `+ ${blu('Methods')}`);
