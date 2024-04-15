const assert = require('assert');
const passwordHash = require('../modules/@apostrophecms/user/lib/password-hash.js');

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
});

function getInstance() {
  return passwordHash({
    error(s) {
      return new Error(s);
    }
  });
}
