// The helpers a provider adapter calls: what every HTTP-shaped adapter needs
// and no two of them should write twice — the Retry-After parse, the status
// ladder that maps a provider failure onto an apos error code, and the api-key
// check. Public API on the same terms as the rest of `apos.ai`: a project or
// third-party adapter uses these exactly as the standard four do, which is why
// this is the one lib file documented in the public JSDoc style.
//
// Nothing dialect-specific belongs here — a request body, a content-part
// mapping or a finish-reason table is what an adapter *is*.

/**
 * @typedef {import('./types.js').AiAdapter} AiAdapter
 */

module.exports = (self) => {
  return {
    /**
     * Parse a `Retry-After` value into seconds. It carries either a count of
     * seconds or an HTTP date, which is measured from now. Anything
     * unparseable yields undefined: the value replaces the computed backoff
     * outright (retryDelay in adapter-call.js), so no hint at all beats a
     * guessed one.
     *
     * An adapter whose provider carries the hint in a differently named header
     * passes that header's value here from its own `retryHint`.
     *
     * @param {string} [value]
     * @returns {number|undefined} Seconds, never negative.
     */
    parseRetryAfter(value) {
      if (value === undefined) {
        return undefined;
      }
      const seconds = Number(value);
      if (Number.isFinite(seconds)) {
        return Math.max(0, seconds);
      }
      const date = Date.parse(value);
      if (Number.isNaN(date)) {
        return undefined;
      }
      return Math.max(0, Math.ceil((date - Date.now()) / 1000));
    },

    /**
     * Map a failed request onto the normalized apos error the engine reacts
     * to, by HTTP status: 429 becomes the transient code with kind
     * 'rateLimit', 5xx the transient code with kind 'overload', 401 and 403
     * 'forbidden', 404 'notfound', anything else 'invalid'. Ahead of the
     * status, two cases never reach it: a caller's own abort passes through
     * untouched, being no provider failure at all, while a timed-out or
     * unreachable request becomes transient with kind 'timeout' or 'network'.
     * The provider's own message wins over the transport's whenever the error
     * body carries one.
     *
     * This is the whole of what a failure means to the engine, so an adapter's
     * normalizeError is usually one call to this. It reads `status`, `headers`
     * and `body` off the error, as apos.http raises them.
     *
     * @param {Error} error Whatever the transport threw.
     * @param {object} [options]
     * @param {string} [options.requestIdHeader] The header carrying the
     *   provider's request id, for services that issue one; its value travels
     *   on `data.requestId` for the failure records.
     * @param {(error: Error) => number|undefined} [options.retryHint] The
     *   provider's retry delay in seconds, consulted only when the
     *   `Retry-After` header is absent or unparseable — for a service that
     *   puts the delay somewhere of its own, in the error body say.
     * @returns {Error} Carrying `status` on `data`, plus whichever of `kind`,
     *   `retryAfter` (seconds) and `requestId` apply.
     */
    normalizeHttpError(error, options = {}) {
      if (error?.name === 'AbortError') {
        return error;
      }
      if (error?.name === 'TimeoutError') {
        return self.apos.error('aiRetry', 'the provider request timed out', {
          kind: 'timeout'
        });
      }
      const status = error?.status;
      if (!Number.isInteger(status)) {
        return self.apos.error('aiRetry', `network failure: ${error?.message}`, {
          kind: 'network'
        });
      }
      const headers = error.headers || {};
      const requestId = options.requestIdHeader
        ? headers[options.requestIdHeader]
        : undefined;
      const retryAfter = self.parseRetryAfter(headers['retry-after']) ??
        options.retryHint?.(error);
      const data = {
        status,
        ...(requestId !== undefined && { requestId }),
        ...(retryAfter !== undefined && { retryAfter })
      };
      const message = error.body?.error?.message || error.message;
      if (status === 429) {
        return self.apos.error('aiRetry', message, {
          ...data,
          kind: 'rateLimit'
        });
      }
      if (status >= 500) {
        return self.apos.error('aiRetry', message, {
          ...data,
          kind: 'overload'
        });
      }
      if (status === 401 || status === 403) {
        return self.apos.error('forbidden', message, data);
      }
      if (status === 404) {
        return self.apos.error('notfound', message, data);
      }
      return self.apos.error('invalid', message, data);
    },

    /**
     * Fail startup unless the provider entry supplied a key — the check nearly
     * every adapter's validate() is. A plain Error, not an apos one: a bad
     * configuration must kill the boot, and nothing is serving yet to catch a
     * coded error.
     *
     * @param {AiAdapter} adapter The instantiated adapter, which is `this`
     *   inside validate(): the entry's `provider` name and its `apiKey`.
     */
    requireApiKey(adapter) {
      if (!adapter.apiKey) {
        throw new Error(`the "${adapter.provider}" provider requires an apiKey`);
      }
    }
  };
};
