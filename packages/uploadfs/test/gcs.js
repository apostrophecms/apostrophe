/* global describe, it */
const assert = require('assert');
const fetch = require('node-fetch');

describe('UploadFS GCS', function () {
  this.timeout(20000);
  const uploadfs = require('../uploadfs.js')();
  const fs = require('fs');
  const async = require('async');
  const tempPath = '../temp';
  const dstPath = '/one/two/three/test.txt';
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

  const gcsOptions = require('../gcsTestOptions.js');

  gcsOptions.imageSizes = imageSizes;
  gcsOptions.tempPath = tempPath;
  gcsOptions.params = {
    Bucket: gcsOptions.bucket
  };

  it('uploadfs should init gcs connection without error', function(done) {
    return uploadfs.init(gcsOptions, function(e) {
      if (e) {
        console.log('=======E', e);
      }
      assert(!e, 'gcs init without error');
      uploadfs.copyIn('test.txt', dstPath, function(e) {
        if (e) {
          console.log('=======EE', e);
        }
        assert(!e, 'gcs copyIn without error');
        done();
      });
    });
  });

  it('CopyIn should work', function (done) {
    return uploadfs.copyIn('test.txt', dstPath, function(e) {
      assert(!e, 'gcs copyIn without error');
      done();
    });
  });

  it('CopyIn file should be available via gcs', function () {
    const url = uploadfs.getUrl() + '/one/two/three/test.txt';
    const og = fs.readFileSync('test.txt', 'utf8');

    return fetch(url, {
      method: 'GET',
      headers: {
        'Accept-Encoding': 'gzip',
        'Content-type': 'text/plain; charset=utf-8'
      }
    })
      .then(function (response) {
        assert(response.status === 200, `Request status 200 != ${response.status}`);
        return response.text();

      })
      .then(function (content) {
        assert.strictEqual(content, og, 'Res body equals uploaded file');
      });
  });

  it('CopyOut should work', done => {
    const cpOutPath = 'copy-out-test.txt';
    return uploadfs.copyOut(dstPath, cpOutPath, e => {
      assert(!e, 'gcs copyOut without error');
      const dl = fs.readFileSync(cpOutPath, 'utf8');
      const og = fs.readFileSync('test.txt', 'utf8');
      assert(dl === og, 'Downloaded file is equal to previous upload');
      done();
    });
  });

  it('disable / enable should work as expected', done => {
    return async.series({
      disable: cb => {
        uploadfs.disable(dstPath, e => {
          assert(!e, 'uploadfs disable no err');
          cb(null);
        });
      },
      webShouldFail: cb => {
        const url = uploadfs.getUrl() + dstPath;
        return fetch(url, {
          method: 'GET'
        })
          .then(function (response) {
            assert(response.status >= 400, 'Request on disabled resource should fail: expected 40x, got ' + response.status);
            cb(null);
          })
          .catch(cb);
      },
      enable: cb => {
        uploadfs.enable(dstPath, e => {
          assert(!e, 'uploadfs enable should not fail');
          cb(null);
        });
      },
      webShouldSucceed: cb => {
        const url = uploadfs.getUrl() + dstPath;
        const og = fs.readFileSync('test.txt', 'utf8');

        return fetch(url, {
          method: 'GET'
        })
          .then(function (res) {
            assert(res.status < 400, 'Request for enabled resource should not fail');
            // Don't get fussed about presence or absence of UTF-8 in this header
            assert(res.headers.get('content-type').match(/text\/plain/),
            `Check content-type header expected "text/plain" but got "${res.headers.get('content-type')}"`);
            return res.text();
          })
          .then(function (content) {
            assert.strictEqual(og, content, 'Downloaded content should be equal to previous upload');
            cb(null);
          })
          .catch(cb);
      }
    }, e => {
      assert(!e, 'Series should succeed');
      done();
    });
  });

  it('remove should work', done => {
    return uploadfs.remove(dstPath, e => {
      assert(!e, 'Remove should succeed');

      setTimeout(() => {
        const url = uploadfs.getUrl() + dstPath;
        fetch(url, {
          method: 'GET'
        })
          .then(function (res) {
            assert(res.status >= 400, 'Removed file is gone from gcs');
            done();
          })
          .catch(done);
      }, 5000);
    });
  });

  it('copyImageIn should work', done => {
    const imgDstPath = '/images/profiles/me';

    uploadfs.copyImageIn('test.jpg', imgDstPath, (e, info) => {
      assert(!e, 'gcs copyImageIn works');

      const url = uploadfs.getUrl();
      const paths = [ info.basePath + '.jpg' ];

      paths.push(info.basePath + '.small.jpg');
      paths.push(info.basePath + '.medium.jpg');
      paths.push(info.basePath + '.large.jpg');

      async.map(paths, (path, cb) => {
        const imgPath = url + path;

        fetch(imgPath, {
          method: 'GET'
        })
          .then(function(res) {
            assert(res.status === 200, `Request status 200 != ${res.status}`);
            return res.text();
          }).then(function(res) {
            /* @@TODO we should test the correctness of uploaded images */

            // clean up
            uploadfs.remove(path, e => {
              assert(!e, 'Remove uploaded file after testing');
              return cb();
            });
          })
          .catch(cb);
      }, e => {
        assert(!e, 'Can request all copyImageInned images');
        done();
      });
    });
  });
});
