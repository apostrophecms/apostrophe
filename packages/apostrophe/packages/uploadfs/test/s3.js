/* global describe, it */
const assert = require('assert');
const fetch = require('node-fetch');
const exec = require('child_process').execSync;
const util = require('util');
const fs = require('fs');

describe('UploadFS S3', function () {
  this.timeout(50000);
  const uploadfs = require('../uploadfs.js')();
  const init = util.promisify(uploadfs.init);
  const remove = util.promisify(uploadfs.remove);
  const copyIn = util.promisify(uploadfs.copyIn);
  const copyImageIn = util.promisify(uploadfs.copyImageIn);
  const copyOut = util.promisify(uploadfs.copyOut);
  const enable = util.promisify(uploadfs.enable);
  const disable = util.promisify(uploadfs.disable);

  const fs = require('fs');
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

  const s3Options = {
    storage: 's3',
    // Usually not set so we get sharp, with imagemagick fallback (the default behavior)
    image: process.env.UPLOADFS_TEST_IMAGE,
    bucket: process.env.UPLOADFS_TEST_S3_BUCKET,
    key: process.env.UPLOADFS_TEST_S3_KEY,
    secret: process.env.UPLOADFS_TEST_S3_SECRET,
    region: process.env.UPLOADFS_TEST_S3_REGION
  };

  s3Options.imageSizes = imageSizes;
  s3Options.tempPath = tempPath;

  before(async function() {
    await init(s3Options);
  });

  it('S3 should store and retrieve a .tar.gz file without double-gzipping it', async function() {
    await copyIn(`${__dirname}/test.tar.gz`, '/test.tar.gz');
    // Is it returned in identical form using copyOut?
    await copyOut('/test.tar.gz', `${__dirname}/test2.tar.gz`);
    identical(`${__dirname}/test.tar.gz`, `${__dirname}/test2.tar.gz`);
    fs.unlinkSync(`${__dirname}/test2.tar.gz`);
    // Is it returned in identical form using fetch and the public URL of the file?
    const url = uploadfs.getUrl() + '/test.tar.gz';
    // curl and the browser exhibit the same confused behavior
    // unless .gz has a content type in contentTypes.js and
    // is also declared in noGzipContentTypes.js. For whatever
    // reason node-fetch doesn't get confused so we test with curl
    exec(`curl ${url} --output ${__dirname}/test3.tar.gz`);
    identical(`${__dirname}/test.tar.gz`, `${__dirname}/test3.tar.gz`);
    fs.unlinkSync(`${__dirname}/test3.tar.gz`);
    await remove('/test.tar.gz');
  });

  it('CopyIn should work', async function() {
    await copyIn('test.txt', dstPath);
  });

  it('CopyIn file should be available via s3', async function () {
    const url = uploadfs.getUrl() + '/one/two/three/test.txt';
    const og = fs.readFileSync('test.txt', 'utf8');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept-Encoding': 'gzip',
        'Content-type': 'text/plain; charset=utf-8'
      }
    });
    assert(response.status === 200, `Request status 200 != ${response.status}`);
    const body = await response.text();
    assert(body === og, 'Res body equals uploaded file');
  });

  it('S3 streamOut should work', async function() {
    const input = uploadfs.streamOut(dstPath);
    const chunks = [];
    for await (const chunk of input) {
      chunks.push(chunk);
    }
    const data = Buffer.concat(chunks);
    const og = fs.readFileSync('test.txt');
    assert(data.equals(og), 'Streamed file is equal to previous upload');
  });

  it('S3 streamOut should handle an error status code from S3 sensibly', async function() {
    const input = uploadfs.streamOut('made/up/path');
    try {
      // This should fail
      const chunks = [];
      for await (const chunk of input) {
        chunks.push(chunk);
      }
      assert(false, 'Should not get here');
    } catch (e) {
      assert.equal(e.name, 'NoSuchKey');
      assert(e.statusCode >= 400, 'Should be a 4xx or 5xx status code');
    }
  });

  it('S3 CopyOut should work', async function() {
    const cpOutPath = 'copy-out-test.txt';
    await copyOut(dstPath, cpOutPath);
    const dl = fs.readFileSync(cpOutPath, 'utf8');
    const og = fs.readFileSync('test.txt', 'utf8');
    assert(dl === og, 'Downloaded file is equal to previous upload');
  });

  it('S3 Disable / Enable should work as expected', async function() {
    await disable(dstPath);
    assert.rejects(testWeb());
    await enable(dstPath);
    await testWeb();

    async function testWeb() {
      const og = fs.readFileSync('test.txt', 'utf8');
      const url = uploadfs.getUrl() + dstPath;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept-Encoding': 'gzip'
        }
      });
      if (res.status >= 400) {
        throw res;
      }
      const body = await res.text();
      assert(res.headers.get('content-type') === 'text/plain', 'Check content-type header');
      assert(og === body, 'Downloaded content should be equal to previous upload');
    }
  });

  it('S3 uploadfs Remove should work', async function() {
    await remove(dstPath);
    const url = uploadfs.getUrl() + dstPath;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept-Encoding': 'gzip'
      }
    });
    assert(res.status >= 400, 'Removed file is gone from s3');
  });

  it('S3 uploadfs copyImageIn should work', async function() {
    const imgDstPath = '/images/profiles/me';

    const info = await copyImageIn('test.jpg', imgDstPath);
    const url = uploadfs.getUrl();
    const paths = [ info.basePath + '.jpg' ];

    paths.push(info.basePath + '.small.jpg');
    paths.push(info.basePath + '.medium.jpg');
    paths.push(info.basePath + '.large.jpg');

    for (const path of paths) {
      const imgPath = url + path;
      const res = await fetch(imgPath, {
        method: 'GET',
        headers: {
          'Accept-Encoding': 'gzip'
        }
      });
      assert(res.status === 200);
      // Not suitable for images, make sure we didn't force it
      assert(res.headers.get('content-encoding') !== 'gzip');
      const buffer = await res.buffer();
      // JPEG magic number check
      assert(buffer[0] === 0xFF);
      assert(buffer[1] === 0xD8);
      await remove(path);
    }
  });

  it('S3 uploadfs copyImageIn should work with custom sizes', async function() {
    const imgDstPath = '/images/profiles/me';

    const customSizes = [
      {
        name: 'tiny',
        width: 80,
        height: 80
      },
      {
        name: 'nice',
        width: 120,
        height: 120
      }
    ];

    const info = await copyImageIn('test.jpg', imgDstPath, { sizes: customSizes });

    const url = uploadfs.getUrl();
    // Default should be https
    assert(url.startsWith('https://'));
    const paths = [ info.basePath + '.jpg' ];

    paths.push(info.basePath + '.tiny.jpg');
    paths.push(info.basePath + '.nice.jpg');

    for (const path of paths) {
      const imgPath = url + path;
      const res = await fetch(imgPath, {
        method: 'GET',
        headers: {
          'Accept-Encoding': 'gzip'
        }
      });
      assert(res.status === 200);
      // Not suitable for images, make sure we didn't force it
      assert(res.headers.get('content-encoding') !== 'gzip');
      const buffer = await res.buffer();
      // JPEG magic number check
      assert(buffer[0] === 0xFF);
      assert(buffer[1] === 0xD8);
      await remove(path);
    }
  });
});

describe('UploadFS S3 with private ACL', async function () {
  this.timeout(50000);
  const uploadfs = require('../uploadfs.js')();
  const init = util.promisify(uploadfs.init);
  const remove = util.promisify(uploadfs.remove);
  const copyIn = util.promisify(uploadfs.copyIn);
  const copyOut = util.promisify(uploadfs.copyOut);
  const enable = util.promisify(uploadfs.enable);
  const disable = util.promisify(uploadfs.disable);

  const fs = require('fs');
  const tempPath = '../temp';
  const dstPath = '/one/two/three/test2.txt';

  const s3Options = {
    storage: 's3',
    // Usually not set so we get sharp, with imagemagick fallback (the default behavior)
    image: process.env.UPLOADFS_TEST_IMAGE,
    bucket: process.env.UPLOADFS_TEST_S3_BUCKET,
    key: process.env.UPLOADFS_TEST_S3_KEY,
    secret: process.env.UPLOADFS_TEST_S3_SECRET,
    region: process.env.UPLOADFS_TEST_S3_REGION,
    bucketObjectsACL: 'private',
    disabledBucketObjectsACL: 'private',
    tempPath
  };

  before(async function() {
    await init(s3Options);
  });

  it('test with alternate ACLs', async function() {
    await copyIn('test.txt', dstPath);
    await testCopyOut();
    await assert.rejects(testWeb);
    await disable(dstPath);
    await assert.rejects(testWeb);
    await testCopyOut();
    await enable(dstPath);
    await assert.rejects(testWeb);
    await testCopyOut();
    await remove(dstPath);
  });

  async function testCopyOut() {
    await copyOut(dstPath, `${tempPath}/test2.txt`);
    identical('test.txt', `${tempPath}/test2.txt`);
    fs.unlinkSync(`${tempPath}/test2.txt`);
  }

  async function testWeb() {
    const url = uploadfs.getUrl() + '/test.tar.gz';
    const response = await fetch(url);
    if (response.status >= 400) {
      throw response;
    }
  }
});

function identical(f1, f2) {
  const data1 = fs.readFileSync(f1);
  const data2 = fs.readFileSync(f2);
  if (data1.compare(data2) !== 0) {
    throw new Error(`${f1} and ${f2} are not identical.`);
  }
}
