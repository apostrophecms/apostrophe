/* global describe, it */
const Mode = require('stat-mode');
const assert = require('assert');
const path = require('path');

describe('UploadFS Local', function () {
  this.timeout(4500);
  const uploadfs = require('../uploadfs.js')();
  const fs = require('fs');
  const async = require('async');
  const tempPath = path.join(__dirname, '/temp');
  const localOptions = {
    storage: 'local',
    uploadsPath: path.join(__dirname, '/files/'),
    uploadsUrl: 'http://localhost:3000/test/'
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

  localOptions.imageSizes = imageSizes;
  localOptions.tempPath = tempPath;

  it('Should instantiate uploadfs module without errors', done => {
    return uploadfs.init(localOptions, e => {
      assert(!e);
      done();
    });
  });

  it('copyIn should work for local filesystem', done => {
    return uploadfs.copyIn('./test.txt', '/test_copy.txt', e => {
      assert(!e);
      const og = fs.readFileSync('./test.txt', 'utf8');
      const next = fs.readFileSync('./test/files/test_copy.txt', 'utf8');
      assert(og.length, 'lengthy');
      assert(next.length, 'lengthy');
      assert(og === next, 'Copies are equal');
      done();
    });
  });

  it('copyOut should work for local filesystem', done => {
    return uploadfs.copyOut('/test_copy.txt', 'copy-out-test.txt', e => {
      assert(!e);
      const og = fs.readFileSync('./test.txt', 'utf8');
      const next = fs.readFileSync('./copy-out-test.txt', 'utf8');
      assert(og.length, 'lengthy');
      assert(next.length, 'lengthy');
      assert(og === next, 'Copied files are equal');
      done();
    });
  });

  it('streamOut should work for local filesystem', async function() {
    const input = uploadfs.streamOut('/test_copy.txt');
    const chunks = [];
    for await (let chunk of input) {
      chunks.push(chunk);
    }
    const data = Buffer.concat(chunks);
    const og = fs.readFileSync('test.txt');
    assert(data.equals(og));
  });

  it('overwrite with copyIn should work for local filesystem', done => {
    return uploadfs.copyIn('./test2.txt', '/test_copy.txt', e => {
      assert(!e);
      const og = fs.readFileSync('./test2.txt', 'utf8');
      const next = fs.readFileSync('./test/files/test_copy.txt', 'utf8');
      assert(og.length, 'lengthy');
      assert(next.length, 'lengthy');
      assert(og === next, 'Copies are equal');
      done();
    });
  });

  it('copyOut should see update for local filesystem', done => {
    return uploadfs.copyOut('/test_copy.txt', 'copy-out-test.txt', e => {
      assert(!e);
      const og = fs.readFileSync('./test2.txt', 'utf8');
      const next = fs.readFileSync('./copy-out-test.txt', 'utf8');
      assert(og.length, 'lengthy');
      assert(next.length, 'lengthy');
      assert(og === next, 'Copied files are equal');
      done();
    });
  });

  it('Test disable / enable functionality', done => {
    const srcFile = '/test_copy.txt';
    const infile = './test/files/test_copy.txt';

    return async.series({
      disable: cb => {
        assert(fs.existsSync(infile), 'copyIn file exissts');

        uploadfs.disable(srcFile, e => {
          const stats = fs.statSync(infile);
          const mode = new Mode(stats);
          assert(!e, 'uploadfs disable success!');
          assert(mode.toString() === '----------', 'File permissions locked down');
          return cb(null);
        });
      },
      enable: cb => {
        uploadfs.enable(srcFile, e => {
          const stats = fs.statSync(infile);
          const mode = new Mode(stats);
          assert(!e, 'uploadfs disable success!');
          assert(mode.toString() === '-rw-r--r--', 'Enabled file has expected permissions');
          assert(fs.existsSync(infile), 'copyIn visible to fs');
          return cb(null);
        });
      },
      testCopyOut: cb => {
        const outsucceeds = 'copy-out-test.txt';
        uploadfs.copyOut(srcFile, outsucceeds, e => {
          assert(!e, 'node should not be able to copy this file!');
          return cb(null);
        });
      },
      testDelete: cb => {
        uploadfs.remove(srcFile, e => {
          assert(!e, 'Delete file succeeds');
          assert(!fs.existsSync(infile), 'uploadfs delete file is gone from local fs');
          return cb(null);
        });
      }
    }, function (e) {
      fs.unlinkSync('copy-out-test.txt');
      assert(!e);
      done();
    });
  });

  it('Should destroy uploadfs module without errors', done => {
    return uploadfs.destroy(e => {
      assert(!e);
      done();
    });
  });

});
