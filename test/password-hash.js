const assert = require('assert');
const passwordHash = require('../modules/@apostrophecms/user/lib/password-hash.js');

const legacyHash = '{"hashMethod":"pbkdf2-sha512","salt":"JEB7TX4iOky4kWy+1xsGlN0u7GpEtEoUxmRzaf0Oi35A5j9ynYZfT1Lk4JofBz5nbAHD4HoMqQnevltTLd4Hbw==","hash":"aFM6axOnaPiwNGly7NsfYEvFHEv1ML4lNyi2nEz95tudK1/M1PUlMbtxujZ+W1Gv8Q2mHh7KnL6Ql94OOL8S0g==","keyLength":64,"iterations":4449149,"credentials3":true}';

describe('password-hash', function() {
  it('can hash a password', async function() {
    const instance = getInstance();
    const hash = await instance.hash('test one');
    assert(hash);
  });
  it('can verify a correct password', async function() {
    const instance = getInstance();
    const hash = await instance.hash('test one');
    assert(await instance.verify(hash, 'test one'));
  });
  it('cannot verify an incorrect password', async function() {
    const instance = getInstance();
    const hash = await instance.hash('test one');
    assert(!await instance.verify(hash, 'test two'));
  });
  it('hash does not contain password and uses scrypt with parameters', async function() {
    const instance = getInstance();
    const hash = JSON.parse(await instance.hash('test one'));
    assert(!JSON.stringify(hash).includes('test one'));
    assert.strictEqual(hash.hashMethod, 'scrypt');
    assert(hash.scrypt);
    assert.strictEqual(hash.scrypt.cost, 131072);
    assert.strictEqual(hash.scrypt.blockSize, 8);
    assert.strictEqual(hash.scrypt.parallelization, 1);
  });
  it('can verify and modernize a legacy pbkdf2 password hash', async function() {
    this.timeout(10000);
    const instance = getInstance();
    const hash = await instance.verify(legacyHash, 'test-password');
    assert(hash);
    assert.strictEqual(typeof hash, 'string');
    const data = JSON.parse(hash);
    assert.strictEqual(data.hashMethod, 'scrypt');
    assert.strictEqual(await instance.verify(hash, 'test-password'), true);
    assert.strictEqual(await instance.verify(hash, 'bogus-password'), false);
  });
  it('can reject a bad password for a legacy pbkdf2 hash', async function() {
    this.timeout(10000);
    const instance = getInstance();
    assert(!await instance.verify(legacyHash, 'bad-password'));
  });
});

function getInstance() {
  return passwordHash({
    error(s) {
      return new Error(s);
    }
  });
}
