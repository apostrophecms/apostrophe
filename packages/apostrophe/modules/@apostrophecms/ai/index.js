// This module provides `apos.ai`, the provider-agnostic AI engine. Feature
// code talks only to this surface; provider adapters register here and
// translate the normalized shapes to their service dialects.
//
// Providers are opt-in: the module ships no provider and no key. Configure
// each provider under `options.providers[name]` and (with more than one)
// name the default with `options.provider`.

const Ajv = require('ajv/dist/2020').default;
const {
  isObject, isAbort, startupFail
} = require('./lib/util');

module.exports = {
  options: {
    alias: 'ai',
    // providers: { name: { apiKey, envKey, baseUrl, adapter, models,
    //   effort, capabilities } }
    providers: {},
    // provider: the default provider name; inferred when only one is configured
    // effort: { default, levels: { name: { provider, model, reasoning } } }
    // image: { provider, model, aspect, quality }
    // mock: (req, request) => assistant turn, consulted only under
    //   APOS_AI_MOCK
    // mockImage: (req, request) => adapter image result, consulted only
    //   under APOS_AI_MOCK
    // Conservative agent-loop cap; any call may override it
    maxSteps: 5,
    // Transient-failure retry cap, counting calls
    retryAttempts: 5,
    // Base delay in milliseconds for the exponential retry curve
    retryBaseDelay: 1000,
    // Elapsed-time budget in milliseconds for one call including its
    // retry waits; a delay that would land past it stops the call
    retryMaxElapsed: 60000,
    // Seconds an AI job record is kept before the database expires it;
    // 0 keeps records forever. Overridable per call (generateJob's
    // expireAfter). Also the upper bound on a background run's
    // cancellation watcher: a deleted record cancels its own run
    jobExpireAfter: 86400,
    // Milliseconds between checks of the job's cancellation flag while
    // a background run is in flight
    jobPollInterval: 2000
  },
  init(self) {
    self.adapters = {};
    self.providers = {};
    self.effortTable = {};
    self.tools = {};
    // getTools query caches, built once at activation: the registry is
    // static, so they never go stale, and they hold the same
    // definition objects it does, not copies.
    self.toolList = [];
    self.toolsByTag = new Map();
    // Flips once activateTools has validated the registry; the
    // registry is frozen from then on
    self.toolsActive = false;
    // "Is AI operational?" — true once activation has configured at
    // least one provider, or unconditionally under APOS_AI_MOCK, so
    // feature code can ask before calling
    self.active = false;
    // Allowed sub-agent depth (spawned by tools), zero based index
    self.allowedDepth = 1;
    self.validateOptions(self.options);
    self.defaultProvider = self.options.provider ||
      Object.keys(self.options.providers)[0] || null;
    self.effortDefault = self.options.effort?.default || 'medium';
    self.mockMode = process.env.APOS_AI_MOCK === '1';
    self.ajv = new Ajv({ allErrors: true });
    self.apos.http.addError('aiRetry', 503);
    self.apos.http.addError('aiRefusal', 422);
    self.apos.http.addError('aiToolError', 422);
  },
  handlers(self) {
    return {
      'apostrophe:ready': {
        async activate() {
          await self.activateProviders();
          self.activateTools();
        }
      }
    };
  },
  methods(self) {
    return {
      ...require('./lib/startup')(self),
      ...require('./lib/normalize')(self),
      ...require('./lib/request')(self),
      ...require('./lib/adapter-call')(self),
      ...require('./lib/tools')(self),
      ...require('./lib/mock')(self),
      ...require('./lib/aspect')(self),

      // Register a provider adapter. Adapters self-register in their own
      // module's init; re-registering an existing name overrides, so a
      // custom adapter can replace a standard one.
      addAdapter(adapter) {
        if (!adapter || typeof adapter.name !== 'string') {
          startupFail('addAdapter requires an adapter definition with a "name" string');
        }
        self.adapters[adapter.name] = adapter;
      },
      getAdapter(name) {
        return self.adapters[name];
      },
      // Register an AI tool definition. Feature modules call this in
      // their own init; core, project and third-party modules all use
      // the same call. Re-registering an existing name overrides (last
      // wins), so a project can replace a standard tool. Tools are
      // static: only registered tools can participate in AI calls —
      // generate selects them by name, definitions never travel
      // through a call — and the registry is frozen once activated on
      // "apostrophe:ready", so registering later fails. Only the name
      // is checked here; everything else is validated at activation,
      // failing the startup on any problem (see activateTools in
      // lib/startup.js).
      //
      // The definition properties:
      //
      // `name` (required): the unique registry identifier, 1 to 64
      //   letters, digits, "_" or "-", starting with a letter — the
      //   intersection of the provider naming rules;
      // `label`: a human-facing name — what a chat log or an activity
      //   trail shows for the tool; may be an i18n key; defaults from
      //   the name ('find_pages' → 'Find Pages'); never sent to the
      //   model;
      // `description` (required): non-empty text the model chooses
      //   the tool by — treat it as part of the prompt;
      // `tags`: an array of strings to query the registry by, see
      //   getTools;
      // `input` (required): the JSON Schema (draft 2020-12) the
      //   model's arguments must satisfy; sent to the provider; must
      //   declare an object root;
      // `schema` (required): the handler result's shape as Apostrophe
      //   schema fields, like a module's `add` configuration;
      //   internal — never sent to the model — every result is
      //   validated against it via apos.schema.convert;
      // `access`: 'read', 'write' (the default) or 'agent' — not a
      //   permission. Reads run in parallel within one batch of tool
      //   calls; writes and agents follow serially in model order.
      //   'agent' declares that the handler makes its own generate
      //   call (a subagent, with its own budgets). One level of
      //   nesting is allowed: a nested call silently drops agent
      //   tools from its set — a subagent cannot spawn subagents —
      //   and generation below the subagent level fails;
      // `handler` (required): the implementation — an async
      //   (req, args) function or a 'moduleName:methodName'
      //   reference. Runs with the caller's req and the validated
      //   model arguments, plus the core-injected args._context, and
      //   returns an object matching `schema`.
      addTool(tool) {
        if (self.toolsActive) {
          startupFail('tools must be registered before "apostrophe:ready"');
        }
        if (!isObject(tool) || typeof tool.name !== 'string' ||
          !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(tool.name)) {
          startupFail('addTool requires a definition with a "name" of 1 to 64 letters, digits, "_" or "-", starting with a letter');
        }
        self.tools[tool.name] = tool;
      },
      // The activated canonical definition registered under `name`,
      // or undefined. Guarded against prototype-chain names
      // ('constructor', …): lookups here may carry model-provided or
      // browser-provided names, which must only ever select a
      // registered tool
      getTool(name) {
        return self.hasTool(name) ? self.tools[name] : undefined;
      },
      // All activated tool definitions; with `tags`, those carrying
      // at least one of them. A single tag may be passed as a string.
      // Served from caches built at activation, so treat the returned
      // arrays and definitions as read-only.
      getTools({ tags } = {}) {
        if (typeof tags === 'string') {
          tags = [ tags ];
        }
        if (tags !== undefined && !Array.isArray(tags)) {
          throw self.apos.error('invalid', '"tags" must be an array of tag strings');
        }
        if (!tags) {
          return self.toolList;
        }
        // Union of the per-tag lists: a tool matching several of the
        // given tags appears once
        const found = new Set();
        for (const tag of tags) {
          const tools = self.toolsByTag.get(tag);
          if (tools) {
            for (const tool of tools) {
              found.add(tool);
            }
          }
        }
        return [ ...found ];
      },
      // An efficient way of checking (by name) if a tool exists
      hasTool(name) {
        return Object.hasOwn(self.tools, name);
      },
      // Synchronous introspection: the model a call with these options
      // would hit and what it offers. Accepts the same options as
      // `resolve` (lib/request.js) and resolves exactly like a call
      // would, including its "invalid" errors — a call that cannot
      // resolve here would fail the same way for real. An unknown model
      // is different: the call would work, so it yields undefined
      // limits, never an error. Check `self.active` first to ask
      // whether AI is configured at all.
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
      // The AI permission seam: whether this AI action is permitted
      // for `req`. Same signature and semantics as
      // `apos.permission.can(req, action, docOrType, mode)`, and today
      // a pure proxy to it — but tool handlers and AI feature code
      // must call this method, never `apos.permission.can` directly,
      // so that AI-specific policy (actions denied to the AI even for
      // an admin's req) can later be layered here, centrally, without
      // touching a single handler. It can only ever be as restrictive
      // as `apos.permission.can` or more, never looser.
      can(req, ...args) {
        return self.apos.permission.can(req, ...args);
      },
      // The language method: text, multi-turn chat, the tool-calling
      // agent loop and structured output against the routed provider.
      //
      // `req` is the caller's request object, carried into events, the
      // adapter and every tool handler — the core never invents auth.
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
      //   { role, content } as normalizeMessages (lib/normalize.js)
      //   accepts — including a transcript a previous call returned;
      // `tools` (array of registered tool names): what the model may
      //   call — see addTool. The loop validates the model's
      //   arguments, executes the handlers by their `access`
      //   scheduling (reads in parallel first, writes serial in model
      //   order), feeds results back, and asks the model again until
      //   it answers or `maxSteps` is spent;
      // `maxSteps` (positive integer, defaults to the module's
      //   `maxSteps` option): the cap on model turns for this call.
      //   When the last allowed turn still requests tools, the call
      //   finishes as 'maxSteps' and the requests come back unexecuted
      //   on `toolCalls` — so `maxSteps: 1` is manual mode: one turn,
      //   inspect, run them yourself;
      // `schema` (JSON Schema with an object root): request structured
      //   output — the provider's native structured mode is constrained
      //   to it, and the validated result comes back on `object`.
      //   Capability-gated on `structured`. Combines with `tools`: the
      //   schema constrains only the final answer — tool turns run the
      //   loop unchanged, with their own argument and result
      //   validation;
      // `effort` (string): the routing level to resolve, defaulting to
      //   the module's default level;
      // `provider`, `model` (strings, only together): the explicit
      //   target, bypassing the routing table;
      // `reasoning` (string): override the resolved entry's reasoning;
      // `maxTokens` (positive integer): output-token cap, defaulting to
      //   the routed model's declared ceiling when it is known;
      // `cache` (false | 'short' | 'long', default 'short'): the
      //   prompt-cache policy the adapter translates for its provider;
      // `signal` (AbortSignal): cancels the call — see the cancellation
      //   paragraph below; also injected into every handler's
      //   `args._context`;
      // `onMessage` (async function): called with each intermediate
      //   assistant message — a turn whose tool requests the loop goes
      //   on to execute — as { role, content }, awaited before the
      //   tools run. The final answer is not reported here, it is the
      //   return value; a throw stops the call.
      //
      // Returns { text, messages, finishReason, usage, model,
      // provider }, plus `steps` when the call carried tools,
      // `toolCalls` when it stopped with pending requests, and `object`
      // — the validated structured output — when the call passed
      // `schema` and finished 'stop' (a 'length' or 'maxSteps' finish
      // has no complete answer to validate). `text` is the final
      // assistant text (may be ''); `messages` is the full
      // transcript — tool requests and results included — resumable as
      // the next call's `messages`; `steps` lists what the loop
      // executed in model order, { toolCall, result } per success and
      // { toolCall, error } per recoverable failure the model was told
      // about; `toolCalls` are unexecuted requests the caller must run
      // itself; `finishReason` is 'stop', 'length', 'cancel' or —
      // whenever the step budget cut the loop — 'maxSteps', the step
      // budget's counterpart of 'length'; `usage` aggregates
      // { inputTokens, outputTokens } across every model turn; `model` /
      // `provider` name what actually answered.
      //
      // Cancellation: when the call's `signal` fires the loop winds
      // down instead of failing. The in-flight step is waited out — a
      // running handler is never abandoned, its completed work stays
      // recorded — while the aborted provider call is not retried, and
      // the call returns normally with finishReason 'cancel': partial
      // text, steps and usage preserved, unexecuted requests on
      // `toolCalls`. Only abort-shaped throws convert; a genuine
      // failure racing a cancel still throws.
      //
      // Throws normalized apos errors: "invalid" for bad calls,
      // "aiRetry" when transient provider failures outlast the retry
      // budget, "aiRefusal" when the model refuses; a tool handler's
      // standard-coded throw (and any handler bug) stops the call
      // as-is, with no trace of it in any model-bound message. Emits
      // `beforeGenerate` and `afterGenerate` around the call and
      // `beforeToolCall` / `afterToolCall` around each handler
      // execution.
      //
      // Under APOS_AI_MOCK the built-in mock answers every call in
      // place of any adapter — same pipeline, no network; with no
      // providers configured at all, placeholder routing stands in. A
      // scripted mock turn may request tools: the loop then runs the
      // real handlers, so tool code is testable offline.
      async generate(req, stringOrOptions, options) {
        const canonical = self.normalizeGenerateOptions(stringOrOptions, options);
        // Tool handlers receive a req clone stamped with their depth
        // (executeToolCalls in lib/tools.js). One level of nesting is
        // allowed: a handler may run a subagent, whose own tools may
        // not generate further, whatever they carry. At the allowed
        // level, agent tools are dropped rather than rejected — a
        // toolset needs no curating per depth — so a subagent simply
        // cannot spawn subagents.
        const depth = req.aposAiDepth || 0;
        if (depth > self.allowedDepth) {
          throw self.apos.error('invalid', 'AI generation is limited to one level of nesting: the tools of a subagent cannot generate');
        }
        if (depth === self.allowedDepth) {
          canonical.tools = canonical.tools.filter((tool) => tool.access !== 'agent');
        }
        let provider;
        let request;
        if (self.mockMode && !Object.keys(self.providers).length) {
          ({ provider, request } = self.buildMockRequest(canonical));
        } else {
          ({ provider, request } = self.buildRequest(canonical));
          self.checkCapability(provider, 'text');
          if (canonical.tools.length) {
            self.checkCapability(provider, 'tools');
          }
          if (canonical.schema) {
            self.checkCapability(provider, 'structured');
          }
        }
        const record = self.mockMode
          ? self.mockRecord('chat', provider)
          : self.providers[provider];
        const tools = new Map(canonical.tools.map((tool) => [ tool.name, tool ]));
        const handlerContext = request.signal ? { signal: request.signal } : {};
        // One shared, mutable payload for both generate events, so
        // handlers can enrich the request and correlate the two; its
        // messages grow as the loop appends turns
        const context = {
          provider,
          request
        };
        await self.emit('beforeGenerate', req, context);
        const steps = [];
        const usage = {
          inputTokens: 0,
          outputTokens: 0
        };
        let turn = null;
        let pending = null;
        let cancelled = false;
        try {
          for (let turns = 1; ; turns++) {
            turn = await self.callAdapter(req, record, context.request, async () => {
              const answer = self.validateTurn(
                await record.adapter.chat(req, context.request)
              );
              // Only a 'stop' turn is the answer: tool turns run the loop
              // with their own validation, a refusal surfaces as aiRefusal
              // below, and a 'length' turn returns as-is — no object, the
              // finish reason tells the caller why
              if (canonical.schema && answer.finishReason === 'stop') {
                self.validateStructured(answer, canonical.validateObject);
              }
              return answer;
            });
            usage.inputTokens += turn.usage.inputTokens;
            usage.outputTokens += turn.usage.outputTokens;
            if (turn.finishReason === 'refusal') {
              throw self.apos.error('aiRefusal', 'the model refused this request');
            }
            if (turn.finishReason === 'toolCalls' && !tools.size) {
              throw self.apos.error(
                'invalid',
                'the model returned tool calls but the call sent no tools'
              );
            }
            context.request.messages.push({
              role: 'assistant',
              content: turn.content
            });
            if (turn.finishReason !== 'toolCalls') {
              break;
            }
            const calls = turn.content.filter((part) => part.type === 'toolCall');
            if (turns === canonical.maxSteps) {
              pending = calls;
              break;
            }
            // A cancellation observed between steps ends the run before
            // more work starts; the turn's requests stay unexecuted on
            // `toolCalls`
            if (canonical.signal?.aborted) {
              pending = calls;
              cancelled = true;
              break;
            }
            if (canonical.onMessage) {
              await canonical.onMessage({
                role: 'assistant',
                content: turn.content
              });
            }
            const outcomes = await self.executeToolCalls(
              req, tools, calls, handlerContext
            );
            steps.push(...outcomes);
            context.request.messages.push({
              role: 'tool',
              content: outcomes.map((outcome) => ({
                type: 'toolResult',
                toolCallId: outcome.toolCall.id,
                ...(outcome.error !== undefined
                  ? { error: outcome.error }
                  : { output: outcome.result })
              }))
            });
            // The batch was waited out and recorded; wind down before
            // asking the model again
            if (canonical.signal?.aborted) {
              cancelled = true;
              break;
            }
          }
        } catch (e) {
          // Only an abort-shaped throw converts to a cancelled run, and
          // only while this call's signal has fired — a genuine failure
          // racing a cancel still throws
          if (!isAbort(e) || !canonical.signal?.aborted) {
            throw e;
          }
          cancelled = true;
        }
        context.result = self.assembleResult(context, turn, {
          steps,
          usage,
          pending,
          object: turn?.object,
          hadTools: tools.size > 0,
          ...(cancelled && { finishReason: 'cancel' })
        });
        await self.emit('afterGenerate', req, context);
        return context.result;
      },
      // The image method: text → image against the routed image
      // provider, or image(s) + text → image (editing) when `images`
      // sources are passed — `prompt` is then the edit instruction and
      // the images are the source.
      //
      // Options:
      // `count` (positive integer, default 1): how many images;
      // `aspect` ('square' | 'portrait' | 'landscape', or a 'W:H'
      //   ratio): the shape dial, resolved to the nearest aspect the
      //   routed model declares (resolveAspect in lib/aspect.js); the
      //   adapter translates the resolved ratio to its dialect.
      //   Omitted ⇒ not sent, the provider default applies;
      // `quality` ('low' | 'medium' | 'high'): the spend dial, mapped
      //   to the provider's native knob; providers without one ignore
      //   it. Omitted ⇒ not sent;
      // `images` (array of { url } | { data, mediaType } sources):
      //   the presence of sources makes the call an edit;
      // `provider`, `model` (strings, only together): the explicit
      //   target, bypassing the `image` routing entry — the entry's
      //   default dials do not apply then;
      // `signal` (AbortSignal): aborts the in-flight provider call.
      //
      // Routing: the module's `image` option ({ provider, model,
      // aspect, quality }) names the project's image route and its
      // default dials; per-call dials win. Capability-gated on
      // `image`: routing image work to a provider that cannot
      // generate images is a clear error, never a silent re-route.
      //
      // Returns one call-level result object, like generate:
      // { images, provider, model, usage, aspect?, size? }. `images`
      // is [ { type, data } ], `data` base64 and `type` its format;
      // everything else is said once on the envelope — `usage` is the
      // whole call's token total (providers bill the batch, not the
      // image), `aspect` the resolved native ratio when a dial ran,
      // `size` the native pixel size when the provider works in
      // pixels. Throws the same normalized codes as generate, with
      // the same retries, log records and mock behavior (placeholder
      // images, no network — scriptable via the `mockImage` option,
      // see mockImage in lib/mock.js). Emits `beforeGenerateImage` and
      // `afterGenerateImage` around the call, sharing one mutable
      // context.
      async generateImage(req, prompt, options) {
        const canonical = self.normalizeImageOptions(prompt, options);
        // Mock answers unconditionally: real routing still applies
        // under mock when it can resolve — the configuration stays
        // exercised — but a missing image route (an optional entry,
        // unlike the always-present effort table) or missing providers
        // never block a mock call; placeholder routing stands in
        let route;
        if (self.mockMode && (
          !Object.keys(self.providers).length ||
          (!canonical.provider && !self.options.image)
        )) {
          route = {
            provider: canonical.provider ?? 'mock',
            model: canonical.model ?? 'mock'
          };
        } else {
          route = self.resolve({
            provider: canonical.provider,
            model: canonical.model,
            capability: 'image'
          });
          self.checkCapability(route.provider, 'image');
        }
        const {
          provider, model, aspect: routeAspect, quality: routeQuality,
          ...inline
        } = route;
        // The routed model's metadata, inline routing-entry fields
        // winning — its declared aspects ground the nearest-match
        const metadata = {
          ...self.providers[provider]?.models?.[model],
          ...inline
        };
        const aspect = self.resolveAspect(
          canonical.aspect ?? routeAspect,
          metadata.aspects
        );
        const quality = canonical.quality ?? routeQuality;
        const request = {
          prompt: canonical.prompt,
          count: canonical.count,
          ...(aspect !== undefined && { aspect }),
          ...(quality !== undefined && { quality }),
          ...(canonical.images && { images: canonical.images }),
          model,
          ...(canonical.signal && { signal: canonical.signal })
        };
        const record = self.mockMode
          ? self.mockRecord('image', provider)
          : self.providers[provider];
        const context = {
          provider,
          request
        };
        await self.emit('beforeGenerateImage', req, context);
        const result = await self.callAdapter(req, record, context.request, async () =>
          self.validateImageResult(
            await record.adapter.image(req, context.request)
          )
        );
        // The envelope: the adapter's minimal result plus what the
        // core knows — the provider and the resolved aspect it sent;
        // the pixel size only when the adapter reported one
        context.result = {
          images: result.images.map((image) => ({
            type: image.type,
            data: image.data
          })),
          provider: context.provider,
          model: result.model || context.request.model,
          ...(result.usage && { usage: { ...result.usage } }),
          ...(context.request.aspect !== undefined &&
            { aspect: context.request.aspect }),
          ...(result.size !== undefined && { size: result.size })
        };
        await self.emit('afterGenerateImage', req, context);
        return context.result;
      },
      // The non-blocking form of `generate`: the same flow wrapped in a
      // job on `@apostrophecms/job`. The `await` covers job creation
      // only — the method returns { jobId, cancel } as soon as the job
      // record exists, the run continues in the background, and the
      // exact object `generate` would have returned is stored on the
      // record as `results` (a failure stores its error instead),
      // readable via the job module's status route.
      //
      // Accepts everything `generate` accepts, passed through
      // untouched — `onMessage` is called as `(message, { jobId })`
      // here — plus:
      // `onEnd` (async function): called once with `(error, result)`
      //   when the run ends — the error it failed with, or the unified
      //   result (a cancelled run is a result, finishReason 'cancel').
      //   Its own throw is logged, never recorded on the job;
      // `expireAfter` (seconds): how long the job record is kept,
      //   defaulting to the `jobExpireAfter` option; 0 keeps it
      //   forever;
      // `notify` (boolean, default true): publish the run's progress
      //   to the caller's browser (see publishJobEvent) — 'started'
      //   once the record exists, 'message' per intermediate assistant
      //   turn with the turn as `message`, and 'ended' with the
      //   record's terminal `status` plus the result's `finishReason`
      //   or the failure's `error` ({ name, message }). Correlate by
      //   `jobId` and read the stored result from the job's status
      //   route — the record may flip to its terminal status moments
      //   after the event. `false` opts out; the hooks then own the
      //   whole transport, while cancellation stays on the job layer
      //   either way.
      //
      // `cancel()` requests cancellation, in process; the job module's
      // cancel route does the same cross-process, by jobId. Either way
      // the flag travels through the job record, the abort signal
      // reaches the in-flight provider call and every handler, the run
      // winds down per generate's cancellation semantics with the
      // partial result stored, and the job ends 'cancelled'.
      //
      // Invalid options throw here, synchronously — a job record is
      // created only for a run that can start. Tool handlers may not
      // start jobs: a subagent's work is blocking by design.
      async generateJob(req, stringOrOptions, options) {
        if ((req.aposAiDepth || 0) > 0) {
          throw self.apos.error('invalid', 'generateJob cannot be called from a tool handler: a subagent is blocking only');
        }
        const isPrompt = typeof stringOrOptions === 'string';
        let source;
        if (isPrompt && (options === undefined || isObject(options))) {
          source = options || {};
        } else if (!isPrompt && isObject(stringOrOptions) &&
          options === undefined) {
          source = stringOrOptions;
        } else {
          // Malformed argument shapes: the normalizer throws its own
          // message for every one of them
          self.normalizeGenerateOptions(stringOrOptions, options);
        }
        const {
          onEnd, expireAfter, notify = true, ...generateOptions
        } = source;
        if (onEnd !== undefined && typeof onEnd !== 'function') {
          throw self.apos.error('invalid', '"onEnd" must be a function');
        }
        if (typeof notify !== 'boolean') {
          throw self.apos.error('invalid', '"notify" must be a boolean');
        }
        if (expireAfter !== undefined &&
          (!Number.isInteger(expireAfter) || expireAfter < 0)) {
          throw self.apos.error('invalid', '"expireAfter" must be a non-negative integer');
        }
        // Fail bad generate options now, before any record exists
        self.normalizeGenerateOptions(
          isPrompt ? stringOrOptions : generateOptions,
          isPrompt ? generateOptions : undefined
        );
        const jobModule = self.apos.modules['@apostrophecms/job'];
        const controller = new AbortController();
        const signal = generateOptions.signal
          ? AbortSignal.any([ controller.signal, generateOptions.signal ])
          : controller.signal;
        const ttl = expireAfter !== undefined
          ? expireAfter
          : self.options.jobExpireAfter;
        let jobId = null;
        const backgroundOptions = {
          ...generateOptions,
          signal,
          ...((notify || generateOptions.onMessage) && {
            onMessage: async (message) => {
              if (notify) {
                await self.publishJobEvent(req, jobId, 'message', { message });
              }
              if (generateOptions.onMessage) {
                await generateOptions.onMessage(message, { jobId });
              }
            }
          })
        };
        const returned = await jobModule.run(req, doTheWork, {
          notifications: false,
          ...(req.user?._id && { userId: req.user._id }),
          ...(ttl > 0 && { expireAfter: ttl })
        });
        jobId = returned?.jobId;
        if (!jobId) {
          throw self.apos.error('error', 'the job record could not be created');
        }
        return {
          jobId,
          cancel: async () => {
            // The record first, so the status can only end 'cancelled',
            // then the local signal — no waiting for the poll
            await jobModule.requestCancel(jobId);
            controller.abort();
          }
        };

        async function doTheWork(workReq, reporting, info) {
          // Known here before the creating call has even returned, so
          // the started event can only precede every message event
          jobId = info.jobId;
          let running = true;
          watchCancellation();
          if (notify) {
            await self.publishJobEvent(workReq, jobId, 'started');
          }
          try {
            const result = isPrompt
              ? await self.generate(workReq, stringOrOptions, backgroundOptions)
              : await self.generate(workReq, backgroundOptions);
            reporting.setResults(result);
            await report(null, result);
          } catch (error) {
            await report(error, undefined);
            throw error;
          } finally {
            running = false;
          }

          // A cross-process cancel only reaches this process through
          // the job record: watch the flag while the run is live and
          // fire the local signal when it appears. The loop cannot
          // outlive the record: isCanceling also reports true once the
          // record is gone or ended, so even a run stuck forever has
          // its watcher stop — and its signal fired — no later than the
          // record's expiry
          async function watchCancellation() {
            try {
              for (;;) {
                await self.pause(self.options.jobPollInterval);
                if (!running || signal.aborted) {
                  break;
                }
                if (await reporting.isCanceling()) {
                  controller.abort();
                  break;
                }
              }
            } catch (e) {
              self.apos.util.error(e);
            }
          }

          async function report(error, result) {
            if (notify) {
              await self.publishJobEvent(workReq, jobId, 'ended', error
                ? {
                  status: 'failed',
                  error: {
                    name: error.name,
                    message: error.message
                  }
                }
                : {
                  status: result.finishReason === 'cancel'
                    ? 'cancelled'
                    : 'completed',
                  finishReason: result.finishReason
                });
            }
            if (!onEnd) {
              return;
            }
            try {
              await onEnd(error, result);
            } catch (e) {
              self.logError(workReq, 'hook', e.message, {
                jobId,
                hook: 'onEnd',
                stack: e.stack
              });
            }
          }
        }
      },
      // The built-in progress publisher for generateJob: deliver one
      // stage of a background run — 'started', 'message' or 'ended',
      // with `data` as the stage's payload — to the job owner's
      // browser over the notification channel. Each stage is a bus
      // notification — never rendered — whose one-shot browser-bus
      // event "ai-generate-job" is emitted in exactly one tab,
      // carrying { jobId, stage, ...data }:
      // apos.bus.$on('ai-generate-job', (data) => ...) and filter by
      // jobId. Notifications reach logged-in users only, so a req
      // without a user _id is a silent no-op — there is nobody to
      // deliver to. A delivery failure is logged and never fails the
      // run it reports on.
      async publishJobEvent(req, jobId, stage, data = {}) {
        if (!req.user?._id) {
          return;
        }
        try {
          await self.apos.notification.trigger(req, {
            bus: true,
            event: {
              name: 'ai-generate-job',
              data: {
                jobId,
                stage,
                ...data
              }
            }
          });
        } catch (e) {
          self.logError(req, 'notify', e.message, {
            jobId,
            stage,
            stack: e.stack
          });
        }
      }
    };
  }
};
