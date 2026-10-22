const t = require('../test-lib/test.js');
const assert = require('assert/strict');

// The adapter-facing helpers on `apos.ai`, exercised directly rather than
// through any one dialect: these are the parts every HTTP-shaped adapter
// shares, so a third-party adapter gets exactly what the standard four do.
// The per-adapter suites still cover each one's own configuration of them.
describe('AI: adapter API', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    // No providers: the helpers are pure and need nothing configured
    apos = await t.create({
      root: module
    });
  });

  after(async function() {
    return t.destroy(apos);
  });

  // An apos.http >= 400 throw: Error with status, headers, body
  const httpError = (status, headers = {}, body) => Object.assign(
    new Error(`HTTP error ${status}`),
    {
      status,
      headers,
      body
    }
  );

  describe('parseRetryAfter', function() {
    it('reads the delta-seconds form', function() {
      assert.equal(apos.ai.parseRetryAfter('7'), 7);
      assert.equal(apos.ai.parseRetryAfter('0'), 0);
      // Fractional seconds are not the spec's form but cost nothing to accept
      assert.equal(apos.ai.parseRetryAfter('1.5'), 1.5);
      // Number('') is 0, so an empty header reads as "retry now"
      assert.equal(apos.ai.parseRetryAfter(''), 0);
    });

    it('reads the HTTP-date form, measured from now', function() {
      const seconds = apos.ai.parseRetryAfter(
        new Date(Date.now() + 30000).toUTCString()
      );
      assert(seconds >= 28 && seconds <= 31);
    });

    it('never returns a negative wait', function() {
      // A date already past, and a server clock running ahead of ours:
      // both mean "retry now", not "retry in the past"
      assert.equal(
        apos.ai.parseRetryAfter(new Date(Date.now() - 60000).toUTCString()),
        0
      );
      assert.equal(apos.ai.parseRetryAfter('-5'), 0);
    });

    it('treats an absent or unparseable value as no hint', function() {
      // Undefined rather than a guess: the value replaces the computed
      // backoff outright, so a wrong number is worse than none
      assert.equal(apos.ai.parseRetryAfter(undefined), undefined);
      assert.equal(apos.ai.parseRetryAfter('soon'), undefined);
    });
  });

  describe('normalizeHttpError', function() {
    it('maps the statuses to the normalized codes', function() {
      for (const [ status, code, kind ] of [
        [ 429, 'aiRetry', 'rateLimit' ],
        [ 500, 'aiRetry', 'overload' ],
        [ 503, 'aiRetry', 'overload' ],
        [ 401, 'forbidden', undefined ],
        [ 403, 'forbidden', undefined ],
        [ 404, 'notfound', undefined ],
        [ 400, 'invalid', undefined ],
        [ 422, 'invalid', undefined ]
      ]) {
        const error = apos.ai.normalizeHttpError(httpError(status));
        assert.equal(error.name, code);
        assert.equal(error.data.status, status);
        assert.equal(error.data.kind, kind);
      }
    });

    it('prefers the provider message over the transport one', function() {
      const provider = apos.ai.normalizeHttpError(httpError(400, {}, {
        error: { message: 'that model does not exist' }
      }));
      assert.equal(provider.message, 'that model does not exist');
      // Nothing usable in the body: the transport's own message stands
      const transport = apos.ai.normalizeHttpError(httpError(400, {}, {
        detail: 'no message here'
      }));
      assert.equal(transport.message, 'HTTP error 400');
    });

    it('carries the request id from the named header only', function() {
      const headers = {
        'request-id': 'req_9',
        'x-request-id': 'req_x'
      };
      assert.equal(
        apos.ai.normalizeHttpError(httpError(401, headers), {
          requestIdHeader: 'request-id'
        }).data.requestId,
        'req_9'
      );
      // An adapter naming no header carries no id, whatever arrived
      assert.equal(
        apos.ai.normalizeHttpError(httpError(401, headers)).data.requestId,
        undefined
      );
      // Named but not sent: the key stays off the data entirely
      const missing = apos.ai.normalizeHttpError(httpError(401), {
        requestIdHeader: 'request-id'
      });
      assert.equal('requestId' in missing.data, false);
    });

    it('reads the retry hint from the Retry-After header', function() {
      const error = apos.ai.normalizeHttpError(
        httpError(429, { 'retry-after': '7' })
      );
      assert.equal(error.data.retryAfter, 7);
      assert.equal(
        'retryAfter' in apos.ai.normalizeHttpError(httpError(429)).data,
        false
      );
    });

    it('falls back to the adapter retryHint, the header winning', function() {
      const options = { retryHint: (error) => error.body?.retryIn };
      // Header present: the hint is not consulted at all
      const calls = [];
      const header = apos.ai.normalizeHttpError(
        httpError(429, { 'retry-after': '7' }, { retryIn: 60 }),
        {
          retryHint: (error) => {
            calls.push(error);
            return error.body?.retryIn;
          }
        }
      );
      assert.equal(header.data.retryAfter, 7);
      assert.equal(calls.length, 0);
      // No header, and an unparseable one, both fall through to the hint
      assert.equal(
        apos.ai.normalizeHttpError(httpError(429, {}, { retryIn: 60 }), options)
          .data.retryAfter,
        60
      );
      assert.equal(
        apos.ai.normalizeHttpError(
          httpError(429, { 'retry-after': 'soon' }, { retryIn: 60 }),
          options
        ).data.retryAfter,
        60
      );
      // A hint with nothing to offer leaves the backoff curve in charge
      assert.equal(
        'retryAfter' in
          apos.ai.normalizeHttpError(httpError(429, {}, {}), options).data,
        false
      );
    });

    it('maps timeouts and network failures to the transient code', function() {
      const timeout = apos.ai.normalizeHttpError(
        new DOMException('The operation timed out', 'TimeoutError')
      );
      assert.equal(timeout.name, 'aiRetry');
      assert.equal(timeout.data.kind, 'timeout');
      // No status at all — not a reply, so nothing to map
      const network = apos.ai.normalizeHttpError(new TypeError('fetch failed'));
      assert.equal(network.name, 'aiRetry');
      assert.equal(network.data.kind, 'network');
      assert.match(network.message, /fetch failed/);
      // A non-integer status is no status: the same network case
      assert.equal(
        apos.ai.normalizeHttpError(httpError('502')).data.kind,
        'network'
      );
    });

    it('passes a caller abort through untouched', function() {
      // Not a provider failure: the same object comes back, so the engine
      // sees the abort it is watching for
      const abort = new DOMException('The operation was aborted', 'AbortError');
      assert.equal(apos.ai.normalizeHttpError(abort), abort);
    });
  });

  describe('requireApiKey', function() {
    it('names the provider entry that has no key', function() {
      assert.throws(
        () => apos.ai.requireApiKey({
          provider: 'gateway',
          apiKey: undefined
        }),
        /the "gateway" provider requires an apiKey/
      );
    });

    it('throws a plain Error, to kill the boot', function() {
      // A coded apos error would be caught and reported somewhere; a bad
      // configuration must stop the process instead
      assert.throws(
        () => apos.ai.requireApiKey({ provider: 'gateway' }),
        (e) => e.name === 'Error' && e.aposError === undefined
      );
    });

    it('accepts a configured key', function() {
      apos.ai.requireApiKey({
        provider: 'gateway',
        apiKey: 'sk-test'
      });
    });
  });
});
