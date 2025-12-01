const assert = require('assert');
const testUtil = require('apostrophe/test-lib/test');
const range = require('lodash.range');

describe('Apostrophe cache implementation in Redis', function() {
  let apos;

  this.timeout(10000);

  after(async () => {
    testUtil.destroy(apos);
  });

  it('should be a property of the apos object', async () => {
    apos = await testUtil.create({
      shortname: 'test-redis',
      testModule: true,
      modules: {
        '@apostrophecms/express': {
          options: {
            port: 4242,
            session: { secret: 'test-the-redis' }
          }
        },
        '@apostrophecms/cache-redis': {
          options: {
            redisActive: true
          }
        }
      }
    });

    assert(apos.modules['@apostrophecms/cache'].options.redisActive === true);
  });

  it('initializes a redis client', async () => {
    assert(apos.cache.client);
  });

  it('can store 2000 keys in Cache One', async function() {
    const values = range(0, 2000);
    const responses = [];
    for (const val of values) {
      const response = await apos.cache.set('cache-one', val, val);
      responses.push(response);
    }

    assert(responses.length === 2000);
    assert(!responses.find(r => r !== 'OK'));
  });
  it('can store 2000 keys in Cache Two', async function() {
    const values = range(2000, 4000);
    const responses = [];
    for (const val of values) {
      const response = await apos.cache.set('cache-two', val, val);
      responses.push(response);
    }

    assert(responses.length === 2000);
    assert(!responses.find(r => r !== 'OK'));
  });

  it('can retrieve key from cache 1', async function() {
    const val = await apos.cache.get('cache-one', 1000);
    assert(val === 1000);
  });
  it('can retrieve key from cache 2', async function() {
    const val = await apos.cache.get('cache-two', 3000);

    assert(val === 3000);
  });
  it('cannot retrieve Cache Two key from Cache One (namespacing)', async function() {
    const val = await apos.cache.get('cache-one', 3000);

    assert(val === undefined);
  });

  it('can clear a cache', async function() {
    await apos.cache.clear('cache-one');

    const val = await apos.cache.get('cache-one', 1000);
    assert(val === undefined);
  });
  it('can fetch a key from an uncleared cache', async function() {
    const val = await apos.cache.get('cache-two', 3000);

    assert(val === 3000);
  });
  // Timeout
  it('can store a key with a 1-second timeout', async function() {
    const response = await apos.cache.set('cache-one', 'timeout', 'timeout', 1);
    assert(response === 'OK');
  });

  it('can fetch that key within the 1-second timeout', async function() {
    const value = await apos.cache.get('cache-one', 'timeout');
    assert(value === 'timeout');
  });
  it('cannot fetch that key after 2 seconds', async function() {
    this.timeout(5000);

    await pause(2000);

    const value = await apos.cache.get('cache-one', 'timeout');
    assert(!value);
  });
});

async function pause (delay) {
  if (!delay) {
    return;
  }

  return new Promise((resolve) => setTimeout(resolve, delay));
}
