/* global describe, it, before, after */
// Azure backend tests that do not require an Azure account. The real
// @azure/storage-blob clients are constructed, but the few calls that
// init() makes over the network are stubbed.

const assert = require('assert');
const { promisify } = require('util');
const {
  BlobServiceClient,
  ContainerClient
} = require('@azure/storage-blob');

const sasToken = 'sv=2021-06-08&ss=b&srt=co&sp=rwdlac&se=2099-01-01&sig=FAKESIGNATURE';
// Shared keys are base64
const sharedKey = Buffer.from('not a real key').toString('base64');

describe('UploadFS Azure (offline)', function () {
  const stubs = [
    [ ContainerClient.prototype, 'createIfNotExists', async () => ({}) ],
    [ ContainerClient.prototype, 'setAccessPolicy', async () => ({}) ],
    [ BlobServiceClient.prototype, 'getProperties', async () => ({}) ],
    [ BlobServiceClient.prototype, 'setProperties', async () => ({}) ]
  ];
  const originals = [];

  before(function () {
    for (const [ object, name, fn ] of stubs) {
      originals.push([ object, name, object[name] ]);
      object[name] = fn;
    }
  });

  after(function () {
    for (const [ object, name, fn ] of originals) {
      object[name] = fn;
    }
  });

  async function init(options) {
    const uploadfs = require('../uploadfs.js')();
    await promisify(uploadfs.init)({
      storage: 'azure',
      disabledFileKey: 'test-disabled-file-key',
      tempPath: `${__dirname}/temp`,
      ...options
    });
    return uploadfs;
  }

  function assertNoSecret(url) {
    assert(!url.includes('?'), `URL must not have a query string: ${url}`);
    assert(!url.includes('FAKESIGNATURE'), `URL must not contain the SAS signature: ${url}`);
    assert(!url.includes(sasToken), `URL must not contain the SAS token: ${url}`);
  }

  describe('with a SAS token in replicateClusters', function () {
    let uploadfs;
    before(async function () {
      uploadfs = await init({
        replicateClusters: [
          {
            account: 'myaccount',
            container: 'uploads-container',
            sas: true,
            key: sasToken
          }
        ]
      });
    });

    it('still authenticates requests with the SAS token', function () {
      assert(uploadfs._storage.blobSvcs[0].svc.url.includes('sig=FAKESIGNATURE'));
    });

    it('does not reveal the SAS token in the public base URL', function () {
      const url = uploadfs.getUrl();
      assertNoSecret(url);
      assert.strictEqual(url, 'https://myaccount.blob.core.windows.net/uploads-container');
    });

    it('produces well formed public URLs for files', function () {
      const url = uploadfs.getUrl() + '/attachments/abc123-photo.jpg';
      assertNoSecret(url);
      assert.strictEqual(url, 'https://myaccount.blob.core.windows.net/uploads-container/attachments/abc123-photo.jpg');
      assert.strictEqual(new URL(url).pathname, '/uploads-container/attachments/abc123-photo.jpg');
    });

    it('does not reveal the SAS token when the backend builds a file URL', function () {
      const url = uploadfs._storage.getUrl('/attachments/abc123-photo.jpg');
      assertNoSecret(url);
      assert.strictEqual(url, 'https://myaccount.blob.core.windows.net/uploads-container/attachments/abc123-photo.jpg');
    });
  });

  describe('with a SAS token in the top level options', function () {
    let uploadfs;
    before(async function () {
      uploadfs = await init({
        account: 'myaccount',
        container: 'uploads-container',
        sas: true,
        key: sasToken
      });
    });

    it('authenticates requests with the SAS token', function () {
      assert(uploadfs._storage.blobSvcs[0].svc.url.includes('sig=FAKESIGNATURE'));
    });

    it('does not reveal the SAS token in the public base URL', function () {
      const url = uploadfs.getUrl();
      assertNoSecret(url);
      assert.strictEqual(url, 'https://myaccount.blob.core.windows.net/uploads-container');
    });
  });

  describe('with a shared key', function () {
    let uploadfs;
    before(async function () {
      uploadfs = await init({
        account: 'myaccount',
        container: 'uploads-container',
        key: sharedKey
      });
    });

    it('produces the usual public base URL', function () {
      assert.strictEqual(uploadfs.getUrl(), 'https://myaccount.blob.core.windows.net/uploads-container');
    });
  });
});
