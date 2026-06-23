const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Oembed', function() {
  this.timeout(t.timeout);

  let apos;

  after(function () {
    return t.destroy(apos);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should initialize', async function() {
    apos = await t.create({
      root: module
    });

    assert(apos.modules['@apostrophecms/oembed']);
    assert(apos.oembed.__meta.name === '@apostrophecms/oembed');
  });

  // TODO: test this with mocks. Travis CI erratically times out
  // when we test against real YouTube, which produces false
  // failures that lead us to ignore CI results.
  //
  // let youtube = 'https://www.youtube.com/watch?v=us00G8oILCM&feature=related';

  // it('YouTube still has the video we like to use for testing', async
  // function() { try { const response = await request({ method: 'GET', uri:
  // youtube, resolveWithFullResponse: true });

  //     assert(response.statusCode === 200);
  //   } catch (e) {
  //     assert(false);
  //   }
  // });

  // it('Should deliver an oembed response for YouTube', async function() {
  //   const queryString = qs.stringify({ url: youtube });
  //   const uri = `/modules/@apostrophecms/oembed/query?${queryString}`;

  //   const response = await request({
  //     uri,
  //     method: 'GET',
  //     resolveWithFullResponse: true
  //   });

  //   assert(response.statusCode === 200);
  //   const data = JSON.parse(response.body);
  //   assert(data.type === 'video');
  // });

  it('should cache successful responses and not re-fetch them', async function() {
    const req = apos.task.getReq();
    const url = 'https://example.com/good-video';
    let calls = 0;
    const original = apos.oembed.oembetter.fetch;
    apos.oembed.oembetter.fetch = (fetchUrl, options, cb) => {
      calls++;
      return cb(null, {
        type: 'video',
        title: 'Success',
        html: '<iframe src="//example.com/embed"></iframe>'
      });
    };

    try {
      const first = await apos.oembed.query(req, url);
      assert.strictEqual(first.title, 'Success');
      assert.strictEqual(calls, 1);

      // Second call must be served from the cache, not re-fetched
      const second = await apos.oembed.query(req, url);
      assert.strictEqual(second.title, 'Success');
      assert.strictEqual(calls, 1);
    } finally {
      apos.oembed.oembetter.fetch = original;
    }
  });

  it('should cache failures so a bad URL is not requested repeatedly, and log the original error', async function() {
    const req = apos.task.getReq();
    const url = 'https://example.com/bad-video';
    let calls = 0;
    const original = apos.oembed.oembetter.fetch;
    apos.oembed.oembetter.fetch = (fetchUrl, options, cb) => {
      calls++;
      return cb(new Error('simulated provider failure'));
    };

    // Capture structured log output to confirm the original error is logged
    const originalLogError = apos.oembed.logError;
    const logged = [];
    apos.oembed.logError = (...args) => logged.push(args);

    try {
      await assert.rejects(
        () => apos.oembed.query(req, url),
        { name: 'invalid' }
      );
      assert.strictEqual(calls, 1);

      // The underlying cause is logged before the higher-level error is thrown
      assert.strictEqual(logged.length, 1);
      const [ loggedReq, eventType, message ] = logged[0];
      assert.strictEqual(loggedReq, req);
      assert.strictEqual(eventType, 'query-failed');
      assert.strictEqual(message, 'simulated provider failure');

      // Second call must be served from the cached failure, not re-fetched
      await assert.rejects(
        () => apos.oembed.query(req, url),
        { name: 'invalid' }
      );
      assert.strictEqual(calls, 1);
    } finally {
      apos.oembed.oembetter.fetch = original;
      apos.oembed.logError = originalLogError;
    }
  });

  it('should tolerate legacy (unwrapped) cache entries without crashing', async function() {
    const req = apos.task.getReq();
    const url = 'https://example.com/legacy-video';
    const legacyResponse = {
      type: 'video',
      title: 'Legacy',
      html: '<iframe src="//example.com/legacy"></iframe>'
    };

    // Simulate a raw response cached by an older version of this module
    const originalGet = apos.cache.get;
    apos.cache.get = async () => legacyResponse;

    // Fetching must not happen when the cache already has data
    const originalFetch = apos.oembed.oembetter.fetch;
    apos.oembed.oembetter.fetch = (fetchUrl, options, cb) => {
      return cb(new Error('should not be called for a cache hit'));
    };

    try {
      const result = await apos.oembed.query(req, url);
      assert.strictEqual(result.title, 'Legacy');
      assert.strictEqual(result.type, 'video');
    } finally {
      apos.cache.get = originalGet;
      apos.oembed.oembetter.fetch = originalFetch;
    }
  });
});
