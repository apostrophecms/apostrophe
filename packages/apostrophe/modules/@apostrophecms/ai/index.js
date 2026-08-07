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

// The protocol shapes this surface hands out or takes in, named once so the
// blocks below can use them bare. lib/types.js declares them and nothing else.
/**
 * @typedef {import('./lib/types.js').AiAdapter} AiAdapter
 * @typedef {import('./lib/types.js').AiToolDefinition} AiToolDefinition
 * @typedef {import('./lib/types.js').AiMessage} AiMessage
 * @typedef {import('./lib/types.js').AiResult} AiResult
 * @typedef {import('./lib/types.js').AiImageSource} AiImageSource
 * @typedef {import('./lib/types.js').AiImageResult} AiImageResult
 * @typedef {import('./lib/types.js').AiModelInfo} AiModelInfo
 */

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
    // Tool input schemas only: declared "default" values are written
    // into the arguments a handler receives. Results and structured
    // output stay on the plain instance — those are never mutated
    self.ajvArgs = new Ajv({
      allErrors: true,
      useDefaults: true
    });
    self.apos.http.addError('aiRetry', 503);
    self.apos.http.addError('aiRefusal', 422);
    self.apos.http.addError('aiToolError', 422);
    self.apos.http.addError('aiInput', 422);
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
      ...require('./lib/adapter-api')(self),
      ...require('./lib/tools')(self),
      ...require('./lib/mock')(self),
      ...require('./lib/aspect')(self),

      /**
       * Register a provider adapter. Adapters self-register in their own
       * module's init; re-registering an existing name overrides, so a custom
       * adapter can replace a standard one.
       *
       * @param {AiAdapter} adapter
       */
      addAdapter(adapter) {
        if (!adapter || typeof adapter.name !== 'string') {
          startupFail('addAdapter requires an adapter definition with a "name" string');
        }
        self.adapters[adapter.name] = adapter;
      },

      /**
       * The adapter registered under `name`, or undefined.
       *
       * @param {string} name
       * @returns {AiAdapter|undefined}
       */
      getAdapter(name) {
        return self.adapters[name];
      },

      /**
       * A tool definition as addTool accepts it. Only the name is checked on
       * registration; everything else is validated at activation, failing the
       * startup on any problem (see activateTools in lib/startup.js).
       *
       * @typedef {object} AiToolRegistration
       * @property {string} name The unique registry identifier, 1 to 64
       *   letters, digits, "_" or "-", starting with a letter — the
       *   intersection of the provider naming rules.
       * @property {string} description Non-empty text the model chooses the
       *   tool by; treat it as part of the prompt.
       * @property {object} input The JSON Schema (draft 2020-12) the model's
       *   arguments must satisfy. Sent to the provider; must declare an object
       *   root. Declared "default" values are written into the arguments the
       *   handler receives when the model omits them; the conversation
       *   transcript keeps the call as the model made it.
       * @property {object} [schema] The handler result's shape as a JSON
       *   Schema (draft 2020-12) with an object root — the same format as
       *   `input`, but internal: never sent to the model. When present, every
       *   result is validated against it and a mismatch is a handler bug that
       *   fails the call; when absent, the result only has to be an object.
       *   Either way the handler's object is serialized for the model as-is,
       *   never coerced or normalized.
       * @property {((req: object, args: object) => Promise<object>)|string}
       *   handler The implementation: an async (req, args) function, or a
       *   'moduleName:methodName' reference resolved at activation. Runs with
       *   the caller's req and the validated model arguments, plus the
       *   core-injected args._context, and returns an object matching `schema`
       *   when one is declared.
       * @property {number} [maxResultChars] The result-size budget: the
       *   JSON-serialized result may not exceed this many characters. An
       *   oversized result is withheld and a recoverable tool error naming
       *   the actual size, the budget and the largest properties is fed back
       *   to the model instead. Absent means unlimited.
       * @property {string} [label] A human-facing name — what a chat log or an
       *   activity trail shows for the tool; may be an i18n key. Defaults from
       *   the name ('find_pages' → 'Find Pages'). Never sent to the model.
       * @property {string[]} [tags] Strings to query the registry by, see
       *   getTools.
       * @property {'query'|'action'|'agent'} [kind] The tool's consequence
       *   class; 'action' by default. A query is effect-free: queries run in
       *   parallel within one batch of tool calls. An action has effects:
       *   actions and agents follow serially in model order, and are never
       *   re-run or reordered. 'agent' declares that the handler makes its own
       *   generate call (a subagent, with its own budgets). One level of
       *   nesting is allowed: a nested call silently drops agent tools from
       *   its set — a subagent cannot spawn subagents — and generation below
       *   the subagent level fails.
       */

      /**
       * Register an AI tool definition. Feature modules call this in their own
       * init; core, project and third-party modules all use the same call.
       * Re-registering an existing name overrides (last wins), so a project can
       * replace a standard tool.
       *
       * Tools are static: only registered tools can participate in AI calls —
       * generate selects them by name, definitions never travel through a
       * call — and the registry is frozen once activated on "apostrophe:ready",
       * so registering later fails.
       *
       * @param {AiToolRegistration} tool
       */
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

      /**
       * The activated canonical definition registered under `name`, or
       * undefined. Guarded against prototype-chain names ('constructor', …):
       * lookups here may carry model-provided or browser-provided names, which
       * must only ever select a registered tool.
       *
       * @param {string} name
       * @returns {AiToolDefinition|undefined}
       */
      getTool(name) {
        return self.hasTool(name) ? self.tools[name] : undefined;
      },

      /**
       * All activated tool definitions; with `tags`, those carrying at least
       * one of them. Served from caches built at activation, so treat the
       * returned array and its definitions as read-only.
       *
       * @param {object} [options]
       * @param {string|string[]} [options.tags] A single tag may be passed as a
       *   string.
       * @returns {AiToolDefinition[]}
       */
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

      /**
       * An efficient way of checking (by name) if a tool exists.
       *
       * @param {string} name
       * @returns {boolean}
       */
      hasTool(name) {
        return Object.hasOwn(self.tools, name);
      },

      /**
       * Synchronous introspection: the model a call with these options would
       * hit and what it offers. Resolves exactly as a call would, including its
       * "invalid" errors — a call that cannot resolve here would fail the same
       * way for real. An unknown model is different: the call would work, so it
       * yields undefined limits, never an error. Check `self.active` first to
       * ask whether AI is configured at all.
       *
       * Model metadata merges the provider's model maps with any fields carried
       * inline on the routing entry.
       *
       * @param {object} [options] The routing options, which `resolve`
       *   (lib/request.js) applies to a call as it does here.
       * @param {string} [options.provider] With `model`, the explicit target,
       *   bypassing the routing table.
       * @param {string} [options.model]
       * @param {string} [options.effort] The routing level to resolve.
       * @param {'image'} [options.capability] Resolve the image route instead
       *   of the effort table.
       * @param {string} [options.reasoning] Override the resolved entry's
       *   reasoning.
       * @returns {AiModelInfo}
       */
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

      /**
       * Synchronous introspection of the whole routing configuration, shaped
       * for building pickers: the resolved effort table with its default
       * level, and every configured provider with its adapter's label,
       * capabilities and merged per-model metadata. A model's optional
       * `reasoning` array lists the values a call may pass as `reasoning`
       * for it, in the provider's own vocabulary — declared by the adapter,
       * extendable per model on the provider entry, and never enforced: the
       * adapter keeps its own rejections, and a model without a declaration
       * still answers. Everything returned is a copy, safe to serialize or
       * amend, and nothing here reaches the browser unless the caller sends
       * it there. Under mock mode with no providers the catalog is empty —
       * `self.active` answers "is AI usable", this method answers "what is
       * configured".
       *
       * @returns {AiModelCatalog}
       */
      modelCatalog() {
        const providers = {};
        for (const [ name, record ] of Object.entries(self.providers)) {
          const models = {};
          for (const [ id, meta ] of Object.entries(record.models)) {
            models[id] = {
              ...meta,
              ...(meta.reasoning && { reasoning: [ ...meta.reasoning ] }),
              ...(meta.aspects && { aspects: [ ...meta.aspects ] })
            };
          }
          providers[name] = {
            label: record.adapter.label,
            capabilities: { ...record.capabilities },
            models
          };
        }
        const levels = {};
        for (const [ level, row ] of Object.entries(self.effortTable)) {
          levels[level] = { ...row };
        }
        return {
          effort: {
            default: self.effortDefault,
            levels
          },
          providers
        };
      },

      /**
       * The AI permission seam: whether this AI action is permitted for `req`.
       * Same signature and semantics as
       * `apos.permission.can(req, action, docOrType, mode)`, and today a pure
       * proxy to it — but tool handlers and AI feature code must call this
       * method, never `apos.permission.can` directly, so that AI-specific
       * policy (actions denied to the AI even for an admin's req) can later be
       * layered here, centrally, without touching a single handler. It can only
       * ever be as restrictive as `apos.permission.can` or more, never looser.
       *
       * @param {object} req
       * @param {...*} args As `apos.permission.can`: action, docOrType, mode.
       * @returns {boolean}
       */
      can(req, ...args) {
        return self.apos.permission.can(req, ...args);
      },

      /**
       * Options accepted by generate. Unset options are left to the routed
       * model's own defaults.
       *
       * @typedef {object} AiGenerateOptions
       * @property {string} [system] The system prompt — a top-level option,
       *   never a message.
       * @property {AiMessage[]} [messages] The
       *   conversation so far, including a transcript a previous call returned.
       *   A message's content may also be given as a plain string, shorthand
       *   for a single text part.
       * @property {string[]} [tools] Registered tool names the model may
       *   call — see addTool. The loop validates the model's arguments,
       *   executes the handlers by their `kind` scheduling (queries in parallel
       *   first, actions serial in model order), feeds results back, and asks
       *   the model again until it answers or `maxSteps` is spent.
       * @property {number} [maxSteps] The cap on model turns for this call, a
       *   positive integer defaulting to the module's `maxSteps` option. When
       *   the last allowed turn still requests tools, the call finishes as
       *   'maxSteps' and the requests come back unexecuted on `toolCalls` — so
       *   `maxSteps: 1` is manual mode: one turn, inspect, run them yourself.
       * @property {object} [schema] Request structured output: a JSON Schema
       *   with an object root, which the provider's native structured mode is
       *   constrained to, the validated result coming back on `object`.
       *   Capability-gated on `structured`. Combines with `tools`: the schema
       *   constrains only the final answer — tool turns run the loop unchanged,
       *   with their own argument and result validation.
       * @property {string} [effort] The routing level to resolve, defaulting to
       *   the module's default level.
       * @property {string} [provider] With `model`, the explicit target,
       *   bypassing the routing table.
       * @property {string} [model]
       * @property {string} [reasoning] Override the resolved entry's reasoning.
       * @property {number} [maxTokens] Output-token cap, defaulting to the
       *   routed model's declared ceiling when it is known.
       * @property {false|'short'|'long'} [cache] The prompt-cache policy the
       *   adapter translates for its provider; 'short' by default.
       * @property {AbortSignal} [signal] Cancels the call, as below; also
       *   injected into every handler's `args._context`.
       * @property {(message: AiMessage, meta: { step: number }) => Promise<void>}
       *   [onMessage] Called with each intermediate assistant message — a turn
       *   whose tool requests the loop goes on to execute — and awaited before
       *   those tools run, with the model turn it came from. The final answer
       *   is not reported here, it is the return value; a throw stops the call.
       * @property {(event: AiToolCallEvent) => Promise<void>} [onToolCall]
       *   Called twice around every tool handler the loop runs — `phase`
       *   'start' before it, 'end' after it — and awaited, so the tool round
       *   reports itself while it happens rather than when it is over. A call
       *   naming no registered tool never starts and is not reported. A throw
       *   stops the call, except from the end report of a handler whose own
       *   failure is already stopping it.
       */

      /**
       * The language method: text, multi-turn chat, the tool-calling agent loop
       * and structured output against the routed provider.
       *
       * Cancellation: when the call's `signal` fires the loop winds down
       * instead of failing. The in-flight step is waited out — a running
       * handler is never abandoned, its completed work stays recorded — while
       * the aborted provider call is not retried, and the call returns normally
       * with finishReason 'cancel': partial text, steps and usage preserved,
       * unexecuted requests on `toolCalls`. Only abort-shaped throws convert; a
       * genuine failure racing a cancel still throws.
       *
       * Suspension: a tool handler that cannot answer without outside input
       * throws "aiInput", the ask riding the throw's `data`. The loop stops
       * the batch at that call — queries all complete together, so several
       * may suspend at once; no action past the earliest suspended call in
       * model order ever starts — and the run returns normally with
       * finishReason 'input': executed outcomes on `steps` and appended to
       * the transcript as a partial tool message, the suspended calls and
       * unstarted actions unexecuted on `toolCalls`, and the asks on
       * `suspended`, in model order. In a nested run the throw converts to
       * "aiToolError" instead — a delegated run cannot wait for input. A
       * cancellation observed at the suspension wins: the run ends 'cancel'
       * and no ask is surfaced.
       *
       * Under APOS_AI_MOCK the built-in mock answers every call in place of any
       * adapter — same pipeline, no network; with no providers configured at
       * all, placeholder routing stands in. A scripted mock turn may request
       * tools: the loop then runs the real handlers, so tool code is testable
       * offline.
       *
       * Emits `beforeGenerate` and `afterGenerate` around the call and
       * `beforeToolCall` / `afterToolCall` around each handler execution.
       *
       * @param {object} req The caller's request object, carried into events,
       *   the adapter and every tool handler — the core never invents auth.
       * @param {string|AiGenerateOptions} stringOrOptions The user prompt, or
       *   the options object alone (a third argument is not accepted then). A
       *   prompt string is the final user turn: the sole message alone,
       *   appended as the latest turn when `messages` is present.
       * @param {AiGenerateOptions} [options] Only alongside a prompt string.
       * @returns {Promise<AiResult>}
       * @throws Normalized apos errors: "invalid" for bad calls, "aiRetry" when
       *   transient provider failures outlast the retry budget, "aiRefusal"
       *   when the model refuses. A tool handler's standard-coded throw (and
       *   any handler bug) stops the call as-is, with no trace of it in any
       *   model-bound message.
       */
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
          canonical.tools = canonical.tools.filter((tool) => tool.kind !== 'agent');
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
        let suspended = null;
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
              }, { step: turns });
            }
            // The loop owns step numbering, so the executor never has to
            // know which turn it is running for
            const onToolCall = canonical.onToolCall &&
              ((event) => canonical.onToolCall({
                ...event,
                step: turns
              }));
            const outcomes = await self.executeToolCalls(
              req, tools, calls, handlerContext, onToolCall
            );
            const executed = outcomes.filter(
              (outcome) => outcome && outcome.suspended === undefined
            );
            steps.push(...executed);
            if (executed.length) {
              context.request.messages.push({
                role: 'tool',
                content: executed.map((outcome) => ({
                  type: 'toolResult',
                  toolCallId: outcome.toolCall.id,
                  ...(outcome.error !== undefined
                    ? { error: outcome.error }
                    : { output: outcome.result })
                }))
              });
            }
            if (executed.length < calls.length) {
              // A handler suspended and the batch stopped at that call.
              // The executed outcomes just became a partial tool
              // message, so the transcript is the run's complete state;
              // the suspended calls and the unstarted actions come back
              // unexecuted. A cancellation observed here wins: the run
              // ends 'cancel' and no ask is surfaced
              pending = calls.filter((call, index) => !outcomes[index] ||
                outcomes[index].suspended !== undefined);
              if (canonical.signal?.aborted) {
                cancelled = true;
              } else {
                suspended = outcomes
                  .filter((outcome) => outcome &&
                    outcome.suspended !== undefined)
                  .map((outcome) => ({
                    callId: outcome.toolCall.id,
                    name: outcome.toolCall.name,
                    payload: outcome.suspended
                  }));
              }
              break;
            }
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
          suspended,
          object: turn?.object,
          hadTools: tools.size > 0,
          ...(suspended && { finishReason: 'input' }),
          ...(cancelled && { finishReason: 'cancel' })
        });
        await self.emit('afterGenerate', req, context);
        return context.result;
      },

      /**
       * Options accepted by generateImage. An omitted dial is not sent at all,
       * leaving the provider's own default in place.
       *
       * @typedef {object} AiImageOptions
       * @property {number} [count] How many images; 1 by default.
       * @property {string} [aspect] The shape dial — 'square', 'portrait',
       *   'landscape' or a 'W:H' ratio — resolved to the nearest aspect the
       *   routed model declares (resolveAspect in lib/aspect.js); the adapter
       *   translates the resolved ratio to its dialect.
       * @property {'low'|'medium'|'high'} [quality] The spend dial, mapped to
       *   the provider's native knob; providers without one ignore it.
       * @property {AiImageSource[]} [images] The
       *   presence of sources is what makes the call an edit.
       * @property {string} [provider] With `model`, the explicit target,
       *   bypassing the `image` routing entry — the entry's default dials do
       *   not apply then.
       * @property {string} [model]
       * @property {AbortSignal} [signal] Aborts the in-flight provider call.
       */

      /**
       * The image method: text → image against the routed image provider, or
       * image(s) + text → image (editing) when `images` sources are passed.
       *
       * Routing: the module's `image` option ({ provider, model, aspect,
       * quality }) names the project's image route and its default dials;
       * per-call dials win. Capability-gated on `image`: routing image work to
       * a provider that cannot generate images is a clear error, never a silent
       * re-route.
       *
       * Throws the same normalized codes as generate, with the same retries,
       * log records and mock behavior (placeholder images, no network —
       * scriptable via the `mockImage` option, see mockImage in lib/mock.js).
       * Emits `beforeGenerateImage` and `afterGenerateImage` around the call,
       * sharing one mutable context.
       *
       * @param {object} req
       * @param {string} prompt The subject to generate, or the edit to apply
       *   when `images` are present.
       * @param {AiImageOptions} [options]
       * @returns {Promise<AiImageResult>} One
       *   call-level envelope, like generate's.
       */
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

      /**
       * What generateJob accepts on top of everything generate accepts, which
       * is passed through untouched — `onMessage` and `onToolCall` are called
       * with `{ jobId }` merged into their meta here.
       *
       * @typedef {object} AiJobOptions
       * @property {(error: Error|null, result: AiResult|undefined) => Promise<void>}
       *   [onEnd] Called once when the run ends, with the error it failed with
       *   or the unified result (a cancelled run is a result, finishReason
       *   'cancel'). Its own throw is logged, never recorded on the job.
       * @property {number} [expireAfter] Seconds the job record is kept,
       *   defaulting to the `jobExpireAfter` option; 0 keeps it forever.
       * @property {boolean} [notify] Publish the run's progress to the caller's
       *   browser (see publishJobEvent); true by default. 'started' once the
       *   record exists, 'message' per intermediate assistant turn with the
       *   turn as `message`, 'tool' as each tool call starts and ends —
       *   summarized, never the result itself, which the transcript carries —
       *   and 'ended' with the record's terminal `status`
       *   plus the result's `finishReason` or the failure's `error`
       *   ({ name, message }). Correlate by `jobId` and read the stored result
       *   from the job's status route — the record may flip to its terminal
       *   status moments after the event. `false` opts out; the hooks then own
       *   the whole transport, while cancellation stays on the job layer either
       *   way.
       */

      /**
       * The non-blocking form of generate: the same flow wrapped in a job on
       * `@apostrophecms/job`. The `await` covers job creation only — the method
       * returns as soon as the job record exists, the run continues in the
       * background, and the exact object generate would have returned is stored
       * on the record as `results` (a failure stores its error instead),
       * readable via the job module's status route.
       *
       * Invalid options throw here, synchronously — a job record is created
       * only for a run that can start. Tool handlers may not start jobs: a
       * subagent's work is blocking by design.
       *
       * @param {object} req
       * @param {string|(AiGenerateOptions & AiJobOptions)} stringOrOptions
       * @param {(AiGenerateOptions & AiJobOptions)} [options]
       * @returns {Promise<{ jobId: string, cancel: () => Promise<void> }>}
       *   `cancel()` requests cancellation in process; the job module's cancel
       *   route does the same cross-process, by jobId. Either way the flag
       *   travels through the job record, the abort signal reaches the
       *   in-flight provider call and every handler, the run winds down per
       *   generate's cancellation semantics with the partial result stored, and
       *   the job ends 'cancelled'.
       */
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
            onMessage: async (message, meta) => {
              if (notify) {
                await self.publishJobEvent(req, jobId, 'message', {
                  message,
                  step: meta.step
                });
              }
              if (generateOptions.onMessage) {
                await generateOptions.onMessage(message, {
                  ...meta,
                  jobId
                });
              }
            }
          }),
          ...((notify || generateOptions.onToolCall) && {
            onToolCall: async (event) => {
              if (notify) {
                await self.publishJobEvent(
                  req, jobId, 'tool', toolEventSummary(event)
                );
              }
              if (generateOptions.onToolCall) {
                await generateOptions.onToolCall(event, { jobId });
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

        // What a tool call puts on the wire: a progress line, not the
        // work itself. A result runs to the tool's own size budget and
        // the transcript carries it when the run ends, so only its size
        // travels here
        function toolEventSummary({
          phase, call, step, result, error
        }) {
          return {
            phase,
            id: call.id,
            name: call.name,
            step,
            ...(result !== undefined && {
              chars: JSON.stringify(result).length
            }),
            ...(error !== undefined && { error })
          };
        }
      },

      /**
       * The built-in progress publisher for generateJob: deliver one stage of a
       * background run to the job owner's browser over the notification
       * channel. Each stage is a bus notification — never rendered — whose
       * one-shot browser-bus event "ai-generate-job" is emitted in exactly one
       * tab, carrying { jobId, stage, ...data }:
       * `apos.bus.$on('ai-generate-job', (data) => ...)`, filtered by jobId.
       *
       * Notifications reach logged-in users only, so a req without a user _id
       * is a silent no-op — there is nobody to deliver to. A delivery failure
       * is logged and never fails the run it reports on.
       *
       * @param {object} req
       * @param {string} jobId
       * @param {'started'|'message'|'tool'|'ended'} stage
       * @param {object} [data] The stage's payload.
       * @returns {Promise<void>}
       */
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
