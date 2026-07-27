// The trust boundary: the retry seam that performs one adapter call, and
// the validators that refuse to believe what comes back. They belong
// together — each validator exists so a malformed answer travels the
// retry path instead of returning as a short success.

const { FINISH_REASONS } = require('./constants');
const { isObject, isAbort } = require('./util');

module.exports = (self) => {
  // A response that broke its contract. The transient code sends the
  // call back down the retry path.
  function malformed(what, detail) {
    throw self.apos.error('aiRetry', `malformed ${what}: ${detail}`);
  }

  return {
    // Run one adapter call with retries, resolving with the value of
    // `call`, an async thunk performing a single adapter call and
    // validating its response. `call` is retried whole, so response
    // validation belongs inside it: a truncated body must travel the
    // same retry path. Every throw is routed through the adapter's
    // required normalizeError, and only the transient code is retried —
    // the core reacts on codes alone — under the retryAttempts and
    // retryMaxElapsed budgets.
    //
    // A normalized error's `error.data` carries the only adapter hints
    // the engine reads, all optional: `status` (the provider's HTTP
    // status code), `kind` ('rateLimit', 'overload', 'timeout' or
    // 'network', on the transient code), `retryAfter` (in SECONDS,
    // replacing the computed backoff delay) and `requestId` (for
    // support). They shape the delay and the records, never the
    // routing: the error's code alone decides retry versus stop. All of
    // them are written to the log records, so treat `error.data` as
    // log-bound and never put keys, credentials or personal data in it.
    //
    // Every failure and every retry decision emits one structured log
    // record — type `retry` (warn) or `failure` (error, also carrying
    // the stack of the original throw) — with enough context to tell a
    // rate limit from an overload, a timeout or bad config from the one
    // record.
    async callAdapter(req, record, request, call) {
      const started = Date.now();
      for (let attempt = 1; ; attempt++) {
        try {
          return await call();
        } catch (e) {
          // A fired abort signal is the caller's own doing, not a
          // provider failure: no failure record, no retry
          if (isAbort(e)) {
            throw e;
          }
          const error = (e?.aposError ? e : record.adapter.normalizeError(e)) || e;
          const elapsed = Date.now() - started;
          const data = {
            provider: record.name,
            model: request.model,
            code: error.name,
            status: error.data?.status,
            kind: error.data?.kind,
            requestId: error.data?.requestId,
            retryAfter: error.data?.retryAfter,
            attempt,
            elapsed
          };
          // The original throw site is the useful trace when the
          // adapter wrapped a client error
          const stack = e?.stack || error.stack;
          if (error.name !== 'aiRetry') {
            self.logError(req, 'failure', error.message, {
              ...data,
              action: 'stop',
              stack
            });
            throw error;
          }
          if (attempt >= self.options.retryAttempts) {
            self.logError(req, 'failure', error.message, {
              ...data,
              action: 'stop',
              reason: 'attempts',
              stack
            });
            throw error;
          }
          const delay = self.retryDelay(attempt, error);
          if (elapsed + delay > self.options.retryMaxElapsed) {
            self.logError(req, 'failure', error.message, {
              ...data,
              action: 'stop',
              reason: 'budget',
              delay,
              stack
            });
            throw error;
          }
          self.logWarn(req, 'retry', error.message, {
            ...data,
            action: 'retry',
            delay
          });
          await self.pause(delay);
        }
      }
    },
    // The wait in milliseconds before the attempt following `attempt`
    // (1-based): the provider's Retry-After when it sent one, else
    // exponential backoff scaled by a random factor in [1, 2) so
    // synchronized clients spread out.
    retryDelay(attempt, error) {
      const retryAfter = error.data?.retryAfter;
      if (Number.isFinite(retryAfter) && retryAfter >= 0) {
        return retryAfter * 1000;
      }
      const curve = self.options.retryBaseDelay * Math.pow(2, attempt - 1);
      return Math.floor(curve * (1 + Math.random()));
    },
    // A method rather than a plain function so tests can substitute it
    // and skip the real waiting
    pause(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },
    // Enforce the assistant-turn contract on an adapter chat response
    // ({ content, finishReason, usage, model? }) and return it
    // unchanged. A truncated or malformed response throws the transient
    // code so the call travels the retry path — never a
    // shorter-than-intended "success".
    validateTurn(turn) {
      if (!isObject(turn)) {
        malformed('assistant turn', 'not an object');
      }
      if (!Array.isArray(turn.content)) {
        malformed('assistant turn', '"content" must be an array of content parts');
      }
      for (const part of turn.content) {
        if (!isObject(part) || typeof part.type !== 'string') {
          malformed('assistant turn', 'content parts must be objects with a "type"');
        }
        if (part.type === 'text' && typeof part.text !== 'string') {
          malformed('assistant turn', 'text parts must carry a string "text"');
        }
        if (part.type === 'toolCall' && (
          typeof part.id !== 'string' || !part.id ||
          typeof part.name !== 'string' || !isObject(part.input)
        )) {
          malformed('assistant turn', 'toolCall parts must carry a string "id" and "name" and an object "input"');
        }
      }
      if (!FINISH_REASONS.includes(turn.finishReason)) {
        malformed('assistant turn', `"${turn.finishReason}" is not a finish reason`);
      }
      if (turn.finishReason === 'toolCalls' &&
        !turn.content.some(part => part.type === 'toolCall')) {
        malformed('assistant turn', 'a "toolCalls" finish reason without toolCall parts');
      }
      if (!isObject(turn.usage) ||
        !Number.isFinite(turn.usage.inputTokens) ||
        !Number.isFinite(turn.usage.outputTokens)) {
        malformed('assistant turn', '"usage" must carry inputTokens and outputTokens');
      }
      return turn;
    },
    // Enforce the adapter image contract on an image result
    // ({ images, model?, usage?, size? }) and return it unchanged. A
    // missing, empty or malformed image list travels the retry path
    // too: a model whim never returns an empty success.
    validateImageResult(result) {
      if (!isObject(result)) {
        malformed('image result', 'not an object');
      }
      if (!Array.isArray(result.images) || !result.images.length) {
        malformed('image result', '"images" must be a non-empty array');
      }
      for (const image of result.images) {
        if (!isObject(image) || typeof image.type !== 'string' ||
          typeof image.data !== 'string' || !image.data) {
          malformed('image result', 'images must carry a string "type" and a non-empty "data"');
        }
      }
      if (result.usage !== undefined && !isObject(result.usage)) {
        malformed('image result', '"usage" must be an object');
      }
      return result;
    },
    // The anti-hallucination backstop for structured output. The
    // adapter has already extracted the final answer onto `turn.object`
    // from its provider's structured mode — only the dialect knows
    // where the object lives — and that native mode does the real work,
    // so this only catches a stray missing or non-conforming response,
    // on the retry path like a malformed turn. `validate` is the
    // compiled validator for the call's `schema`
    // (normalizeGenerateOptions in normalize.js).
    validateStructured(turn, validate) {
      if (turn.object === undefined) {
        throw self.apos.error('aiRetry', 'the provider returned no structured output');
      }
      if (!validate(turn.object)) {
        throw self.apos.error('aiRetry', `structured output does not match the schema: ${self.ajv.errorsText(validate.errors, { dataVar: 'object' })}`);
      }
    }
  };
};
