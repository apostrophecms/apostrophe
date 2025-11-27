/* global describe, it */
const assert = require('assert');
const fs = require('fs');
const fetch = require('node-fetch');
const uploadfs = require('../uploadfs.js')();
// A JPEG is not a good default because it is exempt from GZIP so
// we get less coverage. -Tom
const srcFile = process.env.AZURE_TEST_FILE || 'test.txt';
const infilePath = 'one/two/three/';
const infile = infilePath + srcFile;
const _ = require('lodash');

/* helper to automate scraping files from blob svc */
const _getOutfile = function(infile, done) {
  const tmpFileName = new Date().getTime() + srcFile;
  const ogFile = fs.readFileSync(srcFile, { encoding: 'utf8' });

  return uploadfs.copyOut(infile, tmpFileName, {}, function (e, res) {
    try {
      assert(!e, 'Azure copy out nominal success');
      const content = fs.readFileSync(tmpFileName, { encoding: 'utf8' });
      assert(content.length, 'copyOut file has length');
      assert(ogFile.length, 'original file body has length');
      // console.log(ogFile, content);
      assert(ogFile === content, 'Azure copy out equal to original text file');
      fs.unlinkSync(tmpFileName);
      done();
    } catch (ae) {
      done(ae);
    }
  });
};

describe('UploadFS Azure', function() {
  this.timeout(40000);

  const tempPath = '../temp';

  const azureOptions = require('../azureTestOptions.js');
  azureOptions.tempPath = tempPath;

  it('Should connect to Azure cloud successfully', function(done) {
    uploadfs.init(azureOptions, function(e) {
      if (e) {
        console.log('error', e);
      }
      try {
        assert(!e, 'Successfully initialize azure service');
        done();
      } catch (ae) {
        done(ae);
      }
    });
  });

  it('getGzipBlackList should return expected defaults if no options provided', function() {
    const types = uploadfs._storage.getGzipBlacklist();
    assert(Array.isArray(types), 'gzip blacklist array is an array');
    assert(types && types.indexOf('zip' >= 0));
  });

  it('getGzipBlacklist should be able to remove a type from the blacklist based on user settings', function() {
    const types = uploadfs._storage.getGzipBlacklist({ zip: true });
    assert(Array.isArray(types), 'gzip blacklist array is an array');
    assert(types && types.indexOf('zip' < 0));
  });

  it('getGzipBlacklist should be able to add a type to the blacklist based on user settings', function() {
    const types = uploadfs._storage.getGzipBlacklist({ foo: false });
    assert(Array.isArray(types), 'gzip blacklist array is an array');
    assert(types && types.indexOf('foo' >= 0));
  });

  it('getGzipBlacklist should quietly ignore `{ ext: false }` in user config if ext is not on default blacklist', function() {
    const types = uploadfs._storage.getGzipBlacklist({ foo: true });
    assert(Array.isArray(types), 'gzip blacklist array is an array');
    assert(types && types.indexOf('foo' <= 0), 'Filetype foo is not added to the blacklist if user wants to gzip it');
  });

  it('getGzipBlacklist should ignore duplicates', function() {
    const types = uploadfs._storage.getGzipBlacklist({
      jpg: false,
      zip: false
    });
    const counts = _.countBy(types);
    assert(counts.jpg === 1, 'No duplicate jpg type is present, despite it all');
  });

  it('Azure test copyIn should work', function(done) {

    uploadfs.copyIn(srcFile, infile, function(e) {
      if (e) {
        console.log('test copyIn ERR', e);
      }
      try {
        assert(!e, 'Azure copy in - nominal success');
        done();
      } catch (ae) {
        done(ae);
      }
    });
  });

  it('Azure test copyOut should work', function(done) {
    _getOutfile(infile, done);
  });

  it('Azure disable should work', function(done) {
    uploadfs.disable(infile, function(e, val) {
      if (e) {
        console.log('error', e);
      }
      try {
        assert(!e, 'Azure disable, nominal success');
        done();
      } catch (ae) {
        done(ae);
      }
    });
  });

  it('Azure test copyOut after disable should fail', function(done) {
    setTimeout(function() {
      uploadfs.copyOut(infile, 'foo.bar', {}, function(e, res) {
        try {
          assert(e);
          assert(e.name === 'RestError');
          assert(e.code === 'BlobNotFound');
          assert(e.statusCode === 404);
          done();
        } catch (ae) {
          done(ae);
        }
      });
    }, 5000);
  });

  it('Azure enable should work', function(done) {
    uploadfs.enable(infile, function(e, val) {
      if (e) {
        console.log('error', e);
      }
      try {
        assert(!e, 'Azure enable , nominal success');
        done();
      } catch (ae) {
        done(ae);
      }
    });
  });

  it('Azure test copyOut after enable should succeed', function(done) {
    _getOutfile(infile, done);
  });

  it('Uploadfs should return valid web-servable url pointing to uploaded file', function() {
    const url = uploadfs.getUrl(infile);
    const ogFile = fs.readFileSync(srcFile);
    assert(ogFile.length);
    assert(url);

    return fetch(url, {
      method: 'GET',
      headers: {
        'Accept-Encoding': 'gzip'
      }
    })
      .then(function (response) {
        assert(response.status < 400, 'Bad response status');
        return response.buffer();
      })
      .then(function (buffer) {
        assert.deepStrictEqual(Buffer.compare(buffer, ogFile), 0, 'Web servable file contents equal original text file contents');
      });
  });

  it('Azure test remove should work', function(done) {
    uploadfs.remove(infile, function(e) {
      if (e) {
        console.log('error', e);
      }
      try {
        assert(!e, 'Azure remove, nominal success');
        done();
      } catch (ae) {
        done(ae);
      }
    });
  });

  it('Azure test copyOut should fail', function(done) {
    const tmpFileName = new Date().getTime() + '_text.txt';

    uploadfs.copyOut(infile, tmpFileName, {}, function (e, res) {
      try {
        assert(e);
        assert(e.name === 'RestError');
        assert(e.code === 'BlobNotFound');
        assert(e.statusCode === 404);
        done();
      } catch (ae) {
        done(ae);
      }
    });
  });
});
