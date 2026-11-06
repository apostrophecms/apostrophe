/* global describe, it, before, after */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// `orientOriginals` and `copyOriginal` are documented as `init` options, so
// setting them there must affect `copyImageIn` without repeating them on
// every call.
describe('UploadFS original image options passed to init', function () {
  this.timeout(20000);
  const source = path.join(__dirname, '..', 'test.jpg');
  const uploadsPath = path.join(__dirname, 'original-options-files');
  const tempPath = path.join(__dirname, 'original-options-temp');
  const imageSizes = [
    {
      name: 'small',
      width: 320,
      height: 320
    }
  ];

  function init(uploadfs, extra) {
    return new Promise((resolve, reject) => {
      uploadfs.init({
        storage: 'local',
        image: 'sharp',
        uploadsPath,
        uploadsUrl: 'http://localhost:3000/test/',
        tempPath,
        imageSizes,
        ...extra
      }, err => (err ? reject(err) : resolve()));
    });
  }

  function copyImageIn(uploadfs, name, options = {}) {
    return new Promise((resolve, reject) => {
      uploadfs.copyImageIn(source, `/${name}`, options, (err, info) => {
        return err ? reject(err) : resolve(info);
      });
    });
  }

  function destroy(uploadfs) {
    return new Promise(resolve => uploadfs.destroy(() => resolve()));
  }

  before(function () {
    fs.mkdirSync(uploadsPath, { recursive: true });
  });

  after(function () {
    fs.rmSync(uploadsPath, {
      recursive: true,
      force: true
    });
    fs.rmSync(tempPath, {
      recursive: true,
      force: true
    });
  });

  it('stores the original byte for byte when init has orientOriginals: false', async function () {
    const uploadfs = require('../uploadfs.js')();
    await init(uploadfs, { orientOriginals: false });
    await copyImageIn(uploadfs, 'orient-false');
    await destroy(uploadfs);
    const stored = fs.readFileSync(path.join(uploadsPath, 'orient-false.jpg'));
    assert(stored.equals(fs.readFileSync(source)));
    assert(fs.existsSync(path.join(uploadsPath, 'orient-false.small.jpg')));
  });

  it('lets a per-call orientOriginals option override init', async function () {
    const uploadfs = require('../uploadfs.js')();
    await init(uploadfs, { orientOriginals: true });
    await copyImageIn(uploadfs, 'orient-call', { orientOriginals: false });
    await destroy(uploadfs);
    const stored = fs.readFileSync(path.join(uploadsPath, 'orient-call.jpg'));
    assert(stored.equals(fs.readFileSync(source)));
  });

  it('does not store the original when init has copyOriginal: false', async function () {
    const uploadfs = require('../uploadfs.js')();
    await init(uploadfs, { copyOriginal: false });
    await copyImageIn(uploadfs, 'no-original');
    await destroy(uploadfs);
    assert(!fs.existsSync(path.join(uploadsPath, 'no-original.jpg')));
    assert(fs.existsSync(path.join(uploadsPath, 'no-original.small.jpg')));
  });
});
