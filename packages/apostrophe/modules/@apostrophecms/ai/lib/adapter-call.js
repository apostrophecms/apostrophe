// The trust boundary: the retry seam that performs one adapter call, and
// the validators that refuse to believe what comes back. They belong
// together — each validator exists so a malformed answer travels the
// retry path instead of returning as a short success.

const { FINISH_REASONS } = require('./constants');
const { isObject, isAbort } = require('./util');

module.exports = (self) => {
  // A response that broke its contract: `what` names the shape, `detail`
  // says what was wrong. The transient code sends the call back down the
  // retry path.
  function malformed(what, detail) {
    throw self.apos.error('aiRetry', `malformed ${what}: ${detail}`);
  }

  return {
    // Run one adapter call with retries. `req` is the caller's
    // request, enriching the failure records; `record` is an
    // activated entry of `self.providers` (supplies the adapter and
    // its normalizeError); `request` is the normalized adapter
    // request, read only for record context; `call` is an async thunk
    // performing a single adapter call and validating its response.
    // Resolves with the thunk's value; throws normalized apos errors
    // — every throw is routed through the adapter's required
    // normalizeError, the core reacts on codes only, and only the
    // transient code is retried, waiting per retryDelay under the
    // retryAttempts and retryMaxElapsed budgets. `call` is retried
    // whole, so response validation belongs inside it: a truncated
    // body must travel the same retry path.
    //
    // A normalized error may carry hints in `error.data`, the only
    // properties the engine reads — all optional, attached by the
    // adapter's normalizeError:
    // `status` (integer): the provider's HTTP status code;
    // `kind` (string, on the transient code): which transient
    //   failure this is — 'rateLimit', 'overload', 'timeout' or
    //   'network';
    // `retryAfter` (number, in SECONDS): the provider's Retry-After;
    //   replaces the computed backoff delay (see retryDelay);
    // `requestId` (string): the provider's request id, for support.
    // Hints shape the delay and the records, never the routing: the
    // error's code alone decides retry versus stop. All of these
    // are written to the failure and retry log records — treat
    // `error.data` as log-bound and never put sensitive data (keys,
    // credentials, personal data) in it.
    //
    // Every failure and every retry decision emits one structured log
    // record: type `retry` (warn) when the call will be retried, type
    // `failure` (error) when it stops, with { provider, model, code,
    // status, kind, requestId, retryAfter, attempt, elapsed, action,
    // reason?, delay? } — enough to tell a rate limit from an
    // overload, a timeout or bad config from the one record. A
    // `failure` record also carries the stack of the original throw.
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
    // (1-based), after the normalized transient failure `error`: the
    // provider's Retry-After (seconds, in the error's
    // `data.retryAfter`) when it sent one, else exponential backoff
    // with jitter — retryBaseDelay * 2^(attempt - 1), scaled by a
    // random factor in [1, 2) so synchronized clients spread out.
    retryDelay(attempt, error) {
      const retryAfter = error.data?.retryAfter;
      if (Number.isFinite(retryAfter) && retryAfter >= 0) {
        return retryAfter * 1000;
      }
      const curve = self.options.retryBaseDelay * Math.pow(2, attempt - 1);
      return Math.floor(curve * (1 + Math.random()));
    },
    // Wait `ms` before the next attempt; a separate method so tests
    // can observe or skip real waiting
    pause(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },
    // Enforce the assistant-turn contract on `turn`, an adapter chat
    // response { content, finishReason, usage, model? }, and return
    // it unchanged. A missing or unknown finishReason, or malformed
    // content or usage, is a truncated or malformed response: it
    // throws the transient code so the call travels the retry path —
    // never a shorter-than-intended "success".
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
    // Enforce the adapter image contract on `result` ({ images,
    // model?, usage?, size? }) and return it unchanged. A missing or
    // empty image list, or a malformed image, is a malformed
    // response: it throws the transient code so the call travels
    // the retry path — a model whim never returns an empty success.
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
    // adapter has already extracted the final answer into `turn.object`
    // from its provider's structured mode (an adapter concern,
    // since only the dialect knows where the object lives); this
    // validates it against `validate`, the compiled validator for the
    // call's `schema` (normalizeGenerateOptions). The provider's
    // native mode does the real work — this only catches a stray
    // non-conforming or missing response. A missing object or a schema
    // mismatch is a malformed model response: like a malformed turn it
    // throws the transient code so the call travels the retry path.
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
