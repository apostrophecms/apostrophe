// This module provides `apos.ai`, the provider-agnostic AI engine. Feature
// code talks only to this surface; provider adapters register here and
// translate the normalized shapes to their service dialects.
//
// Providers are opt-in: the module ships no provider and no key. Configure
// each provider under `options.providers[name]` and (with more than one)
// name the default with `options.provider`.

module.exports = {
  options: {
    alias: 'ai',
    // providers: { name: { apiKey, envKey, baseUrl, adapter, models,
    //   effort, capabilities } }
    providers: {},
    // provider: the default provider name; inferred when only one is configured
    // effort: { default, levels: { name: { provider, model, reasoning } } }
    // image: { provider, model, aspect, quality }
    // mock: (request) => assistant turn, consulted only under APOS_AI_MOCK
    // Conservative agent-loop cap; any call may override it
    maxSteps: 5,
    // Transient-failure retry cap, counting calls
    retryAttempts: 5,
    // Base delay in milliseconds for the exponential retry curve
    retryBaseDelay: 1000,
    // Elapsed-time budget in milliseconds for one call including its
    // retry waits; a delay that would land past it stops the call
    retryMaxElapsed: 60000
  },
  init(self) {
    self.adapters = {};
    self.providers = {};
    self.effortTable = {};
    // "Is AI operational?" — true once activation has configured at
    // least one provider, or unconditionally under APOS_AI_MOCK, so
    // feature code can ask before calling
    self.active = false;
    self.validateOptions(self.options);
    self.defaultProvider = self.options.provider ||
      Object.keys(self.options.providers)[0] || null;
    self.effortDefault = self.options.effort?.default || 'medium';
    self.mockMode = process.env.APOS_AI_MOCK === '1';
    self.apos.http.addError('aiRetry', 503);
    self.apos.http.addError('aiRefusal', 422);
  },
  handlers(self) {
    return {
      'apostrophe:ready': {
        async activate() {
          await self.activateProviders();
        }
      }
    };
  },
  methods(self) {
    function fail(message) {
      throw new Error(`@apostrophecms/ai: ${message}`);
    }
    function isObject(value) {
      return Boolean(value) && typeof value === 'object' &&
        !Array.isArray(value);
    }

    return {
      // Register a provider adapter. Adapters self-register in their own
      // module's init; re-registering an existing name overrides, so a
      // custom adapter can replace a standard one.
      addAdapter(adapter) {
        if (!adapter || typeof adapter.name !== 'string') {
          fail('addAdapter requires an adapter definition with a "name" string');
        }
        self.adapters[adapter.name] = adapter;
      },
      getAdapter(name) {
        return self.adapters[name];
      },
      // Activate every configured provider entry: instantiate the adapter
      // it names with the entry's config, validate it, merge the entry's
      // service description (models, effort rows, capabilities) over the
      // adapter's declared data, then build the effort routing table.
      // Misconfigurations fail the startup. An entry's key prefers the
      // environment: the variable named by its envKey (the entry's own
      // over the adapter's default) overrides the configured apiKey.
      async activateProviders() {
        const {
          providers = {}, effort = {}, image
        } = self.options;

        self.active = false;

        for (const [ name, entry ] of Object.entries(providers)) {
          const adapterName = entry.adapter || name;
          const adapter = self.getAdapter(adapterName);
          if (!adapter) {
            fail(`"providers.${name}" names unknown adapter "${adapterName}"`);
          }
          if (typeof adapter.validate !== 'function') {
            fail(`adapter "${adapterName}" does not implement validate()`);
          }
          const aliased = adapterName !== name;
          const envKey = entry.envKey || adapter.envKey;
          const envApiKey = envKey && process.env[envKey];
          const instance = {
            ...adapter,
            provider: name,
            apiKey: envApiKey || entry.apiKey,
            baseUrl: entry.baseUrl || adapter.baseUrl
          };
          if (!self.mockMode) {
            await instance.validate();
          }
          self.providers[name] = {
            name,
            adapterName,
            adapter: instance,
            capabilities: {
              ...adapter.capabilities,
              ...entry.capabilities
            },
            models: self.mergeModels(adapter.models, entry.models),
            // An aliased entry describes a different service than the
            // adapter's native one, so the native effort rows do not apply
            effort: aliased
              ? { ...entry.effort }
              : {
                ...adapter.effort,
                ...entry.effort
              }
          };
        }

        if (Object.keys(providers).length &&
          !self.providers[self.defaultProvider]) {
          fail('no default provider is available; name one with the "provider" option');
        }

        for (const [ level, row ] of Object.entries(effort.levels || {})) {
          if (!self.providers[row.provider]) {
            fail(`"effort.levels.${level}" references unconfigured provider "${row.provider}"`);
          }
        }
        if (image && !self.providers[image.provider]) {
          fail(`"image" references unconfigured provider "${image.provider}"`);
        }

        self.effortTable = self.buildEffortTable();
        if (self.defaultProvider && !self.effortTable[self.effortDefault]) {
          fail(`the default effort level "${self.effortDefault}" resolves to no routing entry; add it to "effort.levels" or configure a default provider whose adapter declares it`);
        }

        self.active = Object.keys(self.providers).length > 0 ||
          self.mockMode;
      },
      // The routing table: the default provider's rows are the base,
      // the project's "effort.levels" replace it level by level
      buildEffortTable() {
        const table = {};
        const base = self.providers[self.defaultProvider];
        if (base) {
          for (const [ level, row ] of Object.entries(base.effort)) {
            table[level] = {
              ...row,
              provider: base.name
            };
          }
        }
        for (const [ level, row ] of Object.entries(self.options.effort?.levels || {})) {
          table[level] = { ...row };
        }
        return table;
      },
      // Resolve a call's routing options to a concrete routing entry,
      // with the same precedence generate will use: explicit
      // provider+model, else the call's effort level, else the default
      // level. Throws "invalid" on unresolvable calls; unknown models
      // are not an error.
      //
      // Options:
      // `provider`, `model` (strings, only together): the explicit
      //   target, bypassing the routing table;
      // `effort` (string): the routing level to resolve;
      // `capability` (only 'image'): resolve the image route instead of
      //   the effort table;
      // `reasoning` (string): override the resolved entry's reasoning.
      resolve(options = {}) {
        const invalid = (message) => {
          throw self.apos.error('invalid', message);
        };
        const {
          provider, model, effort, capability, reasoning
        } = options;

        if (capability !== undefined && capability !== 'image') {
          invalid(`unknown capability "${capability}"`);
        }
        if (provider || model) {
          if (!provider || !model) {
            invalid('"provider" and "model" must be given together');
          }
          if (!self.providers[provider]) {
            invalid(`"${provider}" is not a configured provider`);
          }
          return {
            provider,
            model,
            ...(reasoning !== undefined && { reasoning })
          };
        }
        let row;
        if (capability === 'image') {
          if (!self.options.image) {
            invalid('no "image" route is configured');
          }
          row = self.options.image;
        } else {
          const level = effort || self.effortDefault;
          row = self.effortTable[level];
          if (!row) {
            invalid(`effort level "${level}" resolves to no routing entry`);
          }
        }
        return {
          ...row,
          ...(reasoning !== undefined && { reasoning })
        };
      },
      // Synchronous introspection: the model a call with these options
      // would hit and what it offers. Accepts the same options as
      // `resolve` and resolves exactly like a call would, including
      // its "invalid" errors — a call that cannot resolve here would
      // fail the same way for real. An unknown model is different: the
      // call would work, so it yields undefined limits, never an error.
      // Check `self.active` first to ask whether AI is configured at
      // all.
      //
      // Returns `{ provider, model, reasoning?, contextWindow,
      // maxOutputTokens, capabilities }`, plus the model's declared
      // `aspects` for an image resolution. Model metadata merges the
      // provider's model maps with any fields carried inline on the
      // routing entry.
      modelInfo(options = {}) {
        const {
          provider, model, reasoning, aspect, quality, ...inline
        } = self.resolve(options);
        const record = self.providers[provider];
        const metadata = {
          ...record.models[model],
          ...inline
        };
        const info = {
          provider,
          model,
          ...(reasoning !== undefined && { reasoning }),
          contextWindow: metadata.contextWindow,
          maxOutputTokens: metadata.maxOutputTokens,
          capabilities: { ...record.capabilities }
        };
        if (options.capability === 'image') {
          info.aspects = metadata.aspects;
        }
        return info;
      },
      // Parse and validate generate's `(stringOrOptions, options)`
      // arguments, exactly as passed to it, into one canonical options
      // object `{ system, messages, effort, provider, model, reasoning,
      // maxTokens, cache, signal }` — the positional prompt string
      // appended to `messages` as the final user turn, message content
      // collapsed to content-part form, `cache` defaulted to 'short',
      // unset options left undefined. Unknown options are rejected as
      // "invalid".
      normalizeGenerateOptions(stringOrOptions, options) {
        const invalid = (message) => {
          throw self.apos.error('invalid', message);
        };
        let prompt = null;
        if (typeof stringOrOptions === 'string') {
          if (!stringOrOptions) {
            invalid('the prompt string must not be empty');
          }
          prompt = stringOrOptions;
          options = options === undefined ? {} : options;
          if (!isObject(options)) {
            invalid('"options" must be an object');
          }
        } else if (isObject(stringOrOptions)) {
          if (options !== undefined) {
            invalid('a second argument is not accepted when the first is an options object');
          }
          options = stringOrOptions;
        } else {
          invalid('a prompt string or an options object is required');
        }
        for (const name of [ 'tools', 'schema', 'maxSteps' ]) {
          if (options[name] !== undefined) {
            throw self.apos.error('unimplemented', `"${name}" is not yet supported`);
          }
        }
        const known = [
          'system', 'messages', 'effort', 'provider', 'model',
          'reasoning', 'maxTokens', 'cache', 'signal'
        ];
        for (const name of Object.keys(options)) {
          if (!known.includes(name)) {
            invalid(`unknown option "${name}"`);
          }
        }
        const {
          system, effort, provider, model, reasoning,
          maxTokens, cache = 'short', signal
        } = options;
        for (const [ name, value ] of Object.entries({
          system,
          effort,
          provider,
          model,
          reasoning
        })) {
          if (value !== undefined && typeof value !== 'string') {
            invalid(`"${name}" must be a string`);
          }
        }
        if (maxTokens !== undefined &&
          (!Number.isInteger(maxTokens) || maxTokens < 1)) {
          invalid('"maxTokens" must be a positive integer');
        }
        if (cache !== false && cache !== 'short' && cache !== 'long') {
          invalid('"cache" must be false, "short" or "long"');
        }
        if (signal !== undefined && !(signal instanceof AbortSignal)) {
          invalid('"signal" must be an AbortSignal');
        }
        const messages = self.normalizeMessages(options.messages);
        if (prompt !== null) {
          messages.push({
            role: 'user',
            content: [ {
              type: 'text',
              text: prompt
            } ]
          });
        }
        if (!messages.length) {
          invalid('a prompt string or "messages" is required');
        }
        return {
          system,
          messages,
          effort,
          provider,
          model,
          reasoning,
          maxTokens,
          cache,
          signal
        };
      },
      // Validate and normalize an array of chat messages, as accepted
      // by generate's `messages` option (undefined is an empty
      // conversation). Returns a new array of { role, content } with
      // `content` always an array of content parts: roles user or
      // assistant, string content becomes a single text part. Messages
      // are rebuilt from the recognized properties, so a stored
      // transcript carrying app metadata round-trips.
      normalizeMessages(messages = []) {
        const invalid = (message) => {
          throw self.apos.error('invalid', message);
        };
        if (!Array.isArray(messages)) {
          invalid('"messages" must be an array');
        }
        return messages.map((message, index) => {
          const name = `messages[${index}]`;
          if (!isObject(message)) {
            invalid(`${name} must be an object like { role, content }`);
          }
          if (message.role === 'tool') {
            throw self.apos.error('unimplemented', `${name}: "tool" messages are not yet supported`);
          }
          if (message.role !== 'user' && message.role !== 'assistant') {
            invalid(`${name}.role must be "user" or "assistant"`);
          }
          return {
            role: message.role,
            content: contentParts(message.content, name)
          };
        });

        // One message's content → validated content-part array, rebuilt
        // so extra properties never travel. A plain string is shorthand
        // for a single text part.
        function contentParts(content, name) {
          if (typeof content === 'string') {
            return [ {
              type: 'text',
              text: content
            } ];
          }
          if (!Array.isArray(content) || !content.length) {
            throw self.apos.error('invalid', `${name}.content must be a string or a non-empty array of content parts`);
          }
          return content.map((part, index) => {
            const partName = `${name}.content[${index}]`;
            if (!isObject(part)) {
              throw self.apos.error('invalid', `${partName} must be an object like { type }`);
            }
            if (part.type === 'toolCall' || part.type === 'toolResult') {
              throw self.apos.error('unimplemented', `${partName}: "${part.type}" parts are not yet supported`);
            }
            if (part.type === 'text') {
              if (typeof part.text !== 'string') {
                throw self.apos.error('invalid', `${partName}.text must be a string`);
              }
              return {
                type: 'text',
                text: part.text
              };
            }
            if (part.type === 'image') {
              const image = part.image;
              if (isObject(image) && typeof image.url === 'string') {
                return {
                  type: 'image',
                  image: { url: image.url }
                };
              }
              if (isObject(image) && typeof image.data === 'string' &&
                typeof image.mediaType === 'string') {
                return {
                  type: 'image',
                  image: {
                    data: image.data,
                    mediaType: image.mediaType
                  }
                };
              }
              throw self.apos.error('invalid', `${partName}.image must be an object like { url } or { data, mediaType }`);
            }
            throw self.apos.error('invalid', `${partName}.type "${part.type}" is unknown`);
          });
        }
      },
      // Assemble the normalized adapter request from `options`, a
      // canonical object as produced by normalizeGenerateOptions:
      // resolve routing, default maxTokens to the model's declared
      // output ceiling when it is known, translate the cache level to
      // the { ttl } policy. Returns { provider, request }: the resolved
      // provider name and the request handed to its adapter —
      // { system?, messages, model, maxTokens?, reasoning?,
      // cache: false | { ttl }, signal? }, optional fields present only
      // when they resolved to a value.
      buildRequest(options) {
        const info = self.modelInfo({
          provider: options.provider,
          model: options.model,
          effort: options.effort,
          reasoning: options.reasoning
        });
        const maxTokens = options.maxTokens ?? info.maxOutputTokens;
        return {
          provider: info.provider,
          request: {
            ...(options.system !== undefined && { system: options.system }),
            messages: options.messages,
            model: info.model,
            ...(maxTokens !== undefined && { maxTokens }),
            ...(info.reasoning !== undefined && { reasoning: info.reasoning }),
            cache: options.cache === false
              ? false
              : { ttl: options.cache },
            ...(options.signal !== undefined && { signal: options.signal })
          }
        };
      },
      // Assemble the adapter request without routing, for mock mode
      // with no providers configured. Same input and return shape as
      // buildRequest, with the call's explicit provider and model when
      // given and "mock" placeholders otherwise; no model metadata
      // exists here, so maxTokens appears only when the call sets it.
      buildMockRequest(options) {
        return {
          provider: options.provider ?? 'mock',
          request: {
            ...(options.system !== undefined && { system: options.system }),
            messages: options.messages,
            model: options.model ?? 'mock',
            ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
            ...(options.reasoning !== undefined && { reasoning: options.reasoning }),
            cache: options.cache === false
              ? false
              : { ttl: options.cache },
            ...(options.signal !== undefined && { signal: options.signal })
          }
        };
      },
      // The built-in mock standing in for every adapter chat under
      // APOS_AI_MOCK. Consults the "mock" option first when the module
      // has one: it may return a complete assistant turn, a { text }
      // shorthand filled out into one, or undefined to fall through to
      // the deterministic default — canned text echoing the
      // conversation's final message, usage estimated from the text
      // sizes. Runs inside the same retry and validation seam as a
      // real adapter call, so a mock that throws normalized codes
      // exercises the real error paths.
      async mockChat(req, request) {
        const custom = self.options.mock
          ? await self.options.mock(request)
          : undefined;
        if (custom == null) {
          const tail = textOf(request.messages.at(-1).content);
          return turn(`[mock] ${tail}`);
        }
        if (isObject(custom) && Array.isArray(custom.content)) {
          return custom;
        }
        if (isObject(custom) && typeof custom.text === 'string') {
          return turn(custom.text);
        }
        throw self.apos.error(
          'invalid',
          '"mock" must return an assistant turn, a { text } object or undefined'
        );

        function turn(text) {
          const input = [
            request.system,
            ...request.messages.map((message) => textOf(message.content))
          ].filter(Boolean).join(' ');
          return {
            content: [ {
              type: 'text',
              text
            } ],
            finishReason: 'stop',
            usage: {
              inputTokens: tokens(input),
              outputTokens: tokens(text)
            }
          };
        }
        function textOf(content) {
          return content
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join(' ');
        }
        // ~4 characters per token, the usual plain-text ballpark
        function tokens(text) {
          return Math.max(1, Math.round(text.length / 4));
        }
      },
      // The mock adapter's error normalization: errors pass through
      // untouched, so a mock throwing normalized codes exercises the
      // real error paths
      mockNormalizeError(error) {
        return error;
      },
      // The language method: plain text and multi-turn chat against the
      // routed provider.
      //
      // `req` is the caller's request object, carried into events, the
      // adapter and (later) tool handlers — the core never invents auth.
      //
      // `stringOrOptions` is either the user prompt string, optionally
      // followed by an `options` object, or one options object alone
      // (then a third argument is not accepted). A prompt string is the
      // final user turn: the sole message alone, appended as the latest
      // turn when `messages` is present.
      //
      // Options:
      // `system` (string): the system prompt — a top-level option,
      //   never a message;
      // `messages` (array): the conversation so far, each entry
      //   { role: 'user' | 'assistant', content } with content a string
      //   or an array of `text` / `image` content parts;
      // `effort` (string): the routing level to resolve, defaulting to
      //   the module's default level;
      // `provider`, `model` (strings, only together): the explicit
      //   target, bypassing the routing table;
      // `reasoning` (string): override the resolved entry's reasoning;
      // `maxTokens` (positive integer): output-token cap, defaulting to
      //   the routed model's declared ceiling when it is known;
      // `cache` (false | 'short' | 'long', default 'short'): the
      //   prompt-cache policy the adapter translates for its provider;
      // `signal` (AbortSignal): aborts the in-flight provider call.
      //
      // Returns { text, messages, finishReason, usage, model, provider }:
      // `text` is the assistant's text (may be ''), `messages` the full
      // transcript ending with the assistant turn — pass it back as
      // `messages` to continue the conversation — `finishReason` is
      // 'stop' or 'length', `usage` counts { inputTokens, outputTokens }
      // and `model` / `provider` name what actually answered.
      //
      // Throws normalized apos errors only: "invalid"
      // for bad calls, "aiRetry" when transient provider failures
      // outlast the retry budget, "aiRefusal" when the model refuses.
      // Emits `beforeGenerate` and `afterGenerate` around the call.
      //
      // Under APOS_AI_MOCK the built-in mock answers every call in
      // place of any adapter — same pipeline, no network; with no
      // providers configured at all, placeholder routing stands in.
      async generate(req, stringOrOptions, options) {
        const canonical = self.normalizeGenerateOptions(stringOrOptions, options);
        let provider;
        let request;
        if (self.mockMode && !Object.keys(self.providers).length) {
          ({ provider, request } = self.buildMockRequest(canonical));
        } else {
          ({ provider, request } = self.buildRequest(canonical));
          self.checkCapability(provider, 'text');
        }
        const record = self.mockMode
          ? {
            name: provider,
            adapter: {
              chat: self.mockChat,
              normalizeError: self.mockNormalizeError
            }
          }
          : self.providers[provider];
        // One shared, mutable payload for both events, so handlers can
        // enrich the request and correlate the two
        const context = {
          provider,
          request
        };
        await self.emit('beforeGenerate', req, context);
        const turn = await self.callAdapter(req, record, context.request, async () => {
          return self.validateTurn(await record.adapter.chat(req, context.request));
        });
        if (turn.finishReason === 'refusal') {
          throw self.apos.error('aiRefusal', 'the model refused this request');
        }
        if (turn.finishReason === 'toolCalls') {
          throw self.apos.error(
            'invalid',
            'the model returned tool calls but the call sent no tools'
          );
        }
        context.result = self.assembleResult(context, turn);
        await self.emit('afterGenerate', req, context);
        return context.result;
      },
      // Throw "invalid" when the configured provider named by
      // `provider` does not declare `capability` (a key of the
      // capabilities map, e.g. 'text'). A call needing a capability the
      // routed provider lacks is a clear error, never a silent
      // re-route.
      checkCapability(provider, capability) {
        if (!self.providers[provider]?.capabilities?.[capability]) {
          throw self.apos.error(
            'invalid',
            `provider "${provider}" does not declare the "${capability}" capability`
          );
        }
      },
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
        return Math.round(curve * (1 + Math.random()));
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
        const malformed = (detail) => {
          throw self.apos.error('aiRetry', `malformed assistant turn: ${detail}`);
        };
        if (!isObject(turn)) {
          malformed('not an object');
        }
        if (!Array.isArray(turn.content)) {
          malformed('"content" must be an array of content parts');
        }
        for (const part of turn.content) {
          if (!isObject(part) || typeof part.type !== 'string') {
            malformed('content parts must be objects with a "type"');
          }
          if (part.type === 'text' && typeof part.text !== 'string') {
            malformed('text parts must carry a string "text"');
          }
        }
        if (![ 'stop', 'toolCalls', 'length', 'refusal' ].includes(turn.finishReason)) {
          malformed(`"${turn.finishReason}" is not a finish reason`);
        }
        if (!isObject(turn.usage) ||
          !Number.isFinite(turn.usage.inputTokens) ||
          !Number.isFinite(turn.usage.outputTokens)) {
          malformed('"usage" must carry inputTokens and outputTokens');
        }
        return turn;
      },
      // Build generate's unified return object from `context` (the
      // event payload carrying the provider name and the request) and
      // `turn` (the validated adapter response). Returns { text,
      // messages, finishReason, usage, model, provider }; which fields
      // are populated tells the caller what happened. The transcript
      // includes the assistant turn, so it is resumable as the next
      // call's `messages`.
      assembleResult(context, turn) {
        const text = turn.content
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join('');
        return {
          text,
          messages: [
            ...context.request.messages,
            {
              role: 'assistant',
              content: turn.content
            }
          ],
          finishReason: turn.finishReason,
          usage: turn.usage,
          model: turn.model || context.request.model,
          provider: context.provider
        };
      },
      // Union of the adapter's and the entry's model metadata,
      // merged per model id with the entry's fields winning
      mergeModels(adapterModels = {}, entryModels = {}) {
        const models = {};
        for (const id of Object.keys({
          ...adapterModels,
          ...entryModels
        })) {
          models[id] = {
            ...adapterModels[id],
            ...entryModels[id]
          };
        }
        return models;
      },
      // Validate the shape of the module options, throwing a clear error
      // naming the offending entry. Checks that need the adapter registry
      // (unknown adapters, dangling routing references, effort levels with
      // no row) happen later, at activation.
      validateOptions(options) {
        const checkString = (value, name) => {
          if (value !== undefined && typeof value !== 'string') {
            fail(`"${name}" must be a string`);
          }
        };
        const checkEffortRow = (row, name, { provider = false } = {}) => {
          if (!isObject(row)) {
            fail(`"${name}" must be an object like { provider, model }`);
          }
          if (provider && typeof row.provider !== 'string') {
            fail(`"${name}.provider" must be a string`);
          }
          if (typeof row.model !== 'string') {
            fail(`"${name}.model" must be a string`);
          }
          checkString(row.reasoning, `${name}.reasoning`);
        };

        const {
          providers, provider, effort, image, maxSteps, mock,
          retryAttempts, retryBaseDelay, retryMaxElapsed
        } = options;

        if (!isObject(providers)) {
          fail('"providers" must be an object of provider entries');
        }
        for (const [ name, entry ] of Object.entries(providers)) {
          if (!isObject(entry)) {
            fail(`"providers.${name}" must be an object`);
          }
          checkString(entry.apiKey, `providers.${name}.apiKey`);
          checkString(entry.envKey, `providers.${name}.envKey`);
          checkString(entry.baseUrl, `providers.${name}.baseUrl`);
          checkString(entry.adapter, `providers.${name}.adapter`);
          if (entry.models !== undefined) {
            if (!isObject(entry.models)) {
              fail(`"providers.${name}.models" must be an object of model entries`);
            }
            for (const [ model, info ] of Object.entries(entry.models)) {
              if (!isObject(info)) {
                fail(`"providers.${name}.models.${model}" must be an object`);
              }
            }
          }
          if (entry.effort !== undefined) {
            if (!isObject(entry.effort)) {
              fail(`"providers.${name}.effort" must be an object of effort rows`);
            }
            for (const [ level, row ] of Object.entries(entry.effort)) {
              // The provider is implicit (the entry itself), rows carry model
              checkEffortRow(row, `providers.${name}.effort.${level}`);
            }
          }
          if (entry.capabilities !== undefined) {
            if (!isObject(entry.capabilities)) {
              fail(`"providers.${name}.capabilities" must be an object`);
            }
            for (const [ capability, value ] of Object.entries(entry.capabilities)) {
              if (typeof value !== 'boolean') {
                fail(`"providers.${name}.capabilities.${capability}" must be a boolean`);
              }
            }
          }
        }

        checkString(provider, 'provider');
        if (provider && !providers[provider]) {
          fail(`"provider" names "${provider}" which is not a configured provider`);
        }
        if (!provider && Object.keys(providers).length > 1) {
          fail('"provider" must name the default provider when several providers are configured');
        }

        if (effort !== undefined) {
          if (!isObject(effort)) {
            fail('"effort" must be an object like { default, levels }');
          }
          checkString(effort.default, 'effort.default');
          if (effort.levels !== undefined) {
            if (!isObject(effort.levels)) {
              fail('"effort.levels" must be an object of routing entries');
            }
            for (const [ level, row ] of Object.entries(effort.levels)) {
              checkEffortRow(row, `effort.levels.${level}`, { provider: true });
            }
          }
        }

        if (image !== undefined) {
          checkEffortRow(image, 'image', { provider: true });
          checkString(image.aspect, 'image.aspect');
          checkString(image.quality, 'image.quality');
        }

        if (!Number.isInteger(maxSteps) || maxSteps < 1) {
          fail('"maxSteps" must be a positive integer');
        }

        if (mock !== undefined && typeof mock !== 'function') {
          fail('"mock" must be a function');
        }

        for (const [ name, value ] of Object.entries({
          retryAttempts,
          retryBaseDelay,
          retryMaxElapsed
        })) {
          if (!Number.isInteger(value) || value < 1) {
            fail(`"${name}" must be a positive integer`);
          }
        }
      }
    };
  }
};
