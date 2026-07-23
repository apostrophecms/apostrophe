// This module provides `apos.ai`, the provider-agnostic AI engine. Feature
// code talks only to this surface; provider adapters register here and
// translate the normalized shapes to their service dialects.
//
// Providers are opt-in: the module ships no provider and no key. Configure
// each provider under `options.providers[name]` and (with more than one)
// name the default with `options.provider`.

const _ = require('lodash');
const Ajv = require('ajv/dist/2020').default;

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
    self.tools = {};
    // getTools query caches, built once at activation — the registry
    // is static, contains "references" so no memory waste.
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
    function fail(message) {
      throw new Error(`@apostrophecms/ai: ${message}`);
    }
    function isObject(value) {
      return Boolean(value) && typeof value === 'object' &&
        !Array.isArray(value);
    }
    // A 'W:H' aspect string → its [ width, height ] positive numbers, or
    // null when it is not a well-formed ratio. Named tokens are not
    // accepted here.
    function parseAspect(value) {
      if (typeof value !== 'string') {
        return null;
      }
      const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(value);
      if (!match) {
        return null;
      }
      const w = Number(match[1]);
      const h = Number(match[2]);
      return w > 0 && h > 0 ? [ w, h ] : null;
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
          self.validateAspects(name, self.providers[name].models);
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
      // object `{ system, messages, tools, maxSteps, schema,
      // validateObject, effort, provider, model, reasoning, maxTokens,
      // cache, signal }` — the positional prompt string appended to
      // `messages` as the final user turn, message content collapsed to
      // content-part form, `tools` names resolved to their activated
      // definitions, `maxSteps` defaulted from the module option, a
      // structured-output `schema` validated as a JSON Schema and
      // compiled into the `validateObject` backstop, `cache` defaulted
      // to 'short', unset options left undefined. Unknown options are
      // rejected as "invalid".
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
        const known = [
          'system', 'messages', 'tools', 'maxSteps', 'schema', 'effort',
          'provider', 'model', 'reasoning', 'maxTokens', 'cache', 'signal'
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
        const maxSteps = options.maxSteps === undefined
          ? self.options.maxSteps
          : options.maxSteps;
        if (!Number.isInteger(maxSteps) || maxSteps < 1) {
          invalid('"maxSteps" must be a positive integer');
        }
        const tools = toolDefinitions(options.tools);
        const { schema, validateObject } = structuredSchema(options.schema);
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
          tools,
          maxSteps,
          schema,
          validateObject,
          effort,
          provider,
          model,
          reasoning,
          maxTokens,
          cache,
          signal
        };

        // The tools option → the activated definitions it names; every
        // name must be registered, each at most once
        function toolDefinitions(names = []) {
          if (!Array.isArray(names)) {
            invalid('"tools" must be an array of registered tool names');
          }
          const seen = new Set();
          return names.map((toolName) => {
            if (typeof toolName !== 'string') {
              invalid('"tools" must be an array of registered tool names');
            }
            if (seen.has(toolName)) {
              invalid(`"tools" names "${toolName}" twice`);
            }
            seen.add(toolName);
            const tool = self.getTool(toolName);
            if (!tool) {
              invalid(`"tools" names unknown tool "${toolName}"`);
            }
            return tool;
          });
        }

        // The schema option → `{ schema, validateObject }`, or empty
        // when absent. A per-call JSON Schema with an object root (what
        // providers require for structured output), compiled into the
        // AJV backstop here so a malformed schema fails the call before
        // any provider request. The compile is evicted from AJV's cache
        // (a strong-referenced Map keyed by the schema object) so
        // per-call schemas do not accumulate; the returned validator
        // keeps working.
        function structuredSchema(schema) {
          if (schema === undefined) {
            return {};
          }
          if (!isObject(schema) || schema.type !== 'object') {
            invalid('"schema" must be a JSON Schema with an object root');
          }
          let validateObject;
          try {
            validateObject = self.ajv.compile(schema);
          } catch (e) {
            invalid(`"schema" is not a valid JSON Schema: ${e.message}`);
          } finally {
            self.ajv.removeSchema(schema);
          }
          return {
            schema,
            validateObject
          };
        }
      },
      // Validate and normalize an array of chat messages, as accepted
      // by generate's `messages` option (undefined is an empty
      // conversation). Returns a new array of { role, content } with
      // `content` always an array of content parts: string content
      // becomes a single text part. Roles are user, assistant and
      // tool; each part type is valid in specific roles only — text
      // and image in user or assistant messages, toolCall (a model's
      // tool request) in assistant messages, toolResult (its answer)
      // in tool messages — so a returned transcript round-trips and a
      // hand-built one fails clearly. Messages are rebuilt from the
      // recognized properties, so a stored transcript carrying app
      // metadata round-trips.
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
          if (![ 'user', 'assistant', 'tool' ].includes(message.role)) {
            invalid(`${name}.role must be "user", "assistant" or "tool"`);
          }
          return {
            role: message.role,
            content: contentParts(message.content, name, message.role)
          };
        });

        // One message's content → validated content-part array, rebuilt
        // so extra properties never travel. A plain string is shorthand
        // for a single text part. Every part type is checked against
        // the message's role.
        function contentParts(content, name, role) {
          if (typeof content === 'string') {
            content = [ {
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
            const roles = {
              text: [ 'user', 'assistant' ],
              image: [ 'user', 'assistant' ],
              toolCall: [ 'assistant' ],
              toolResult: [ 'tool' ]
            }[part.type];
            if (!roles) {
              throw self.apos.error('invalid', `${partName}.type "${part.type}" is unknown`);
            }
            if (!roles.includes(role)) {
              throw self.apos.error('invalid', `${partName}: a "${part.type}" part is not valid in a "${role}" message`);
            }
            if (part.type === 'toolCall') {
              if (typeof part.id !== 'string' || !part.id ||
                typeof part.name !== 'string' || !isObject(part.input)) {
                throw self.apos.error('invalid', `${partName} must be an object like { type, id, name, input }`);
              }
              return {
                type: 'toolCall',
                id: part.id,
                name: part.name,
                input: part.input
              };
            }
            if (part.type === 'toolResult') {
              if (typeof part.toolCallId !== 'string' || !part.toolCallId) {
                throw self.apos.error('invalid', `${partName}.toolCallId must be a string`);
              }
              if (typeof part.error === 'string' && part.output === undefined) {
                return {
                  type: 'toolResult',
                  toolCallId: part.toolCallId,
                  error: part.error
                };
              }
              if (isObject(part.output) && part.error === undefined) {
                return {
                  type: 'toolResult',
                  toolCallId: part.toolCallId,
                  output: part.output
                };
              }
              throw self.apos.error('invalid', `${partName} must carry an object "output" or a string "error", not both`);
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
            // image, the only remaining type
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
          });
        }
      },
      // Parse and validate generateImage's `(prompt, options)` arguments
      // into one canonical options object `{ prompt, count, aspect,
      // quality, images, provider, model, signal }`. `prompt` is the
      // required instruction — the subject to generate, or the edit to
      // apply when `images` are present. Unknown options are rejected as
      // "invalid"; `aspect` is checked as a recognized dial here (a named
      // token or a 'W:H' ratio) but resolved against the routed model's
      // declared aspects later, at call time. Unset options are left
      // undefined so buildImageRequest omits them and the provider's own
      // default applies.
      normalizeImageOptions(prompt, options) {
        const invalid = (message) => {
          throw self.apos.error('invalid', message);
        };
        if (typeof prompt !== 'string' || !prompt) {
          invalid('the image prompt must be a non-empty string');
        }
        options = options === undefined ? {} : options;
        if (!isObject(options)) {
          invalid('"options" must be an object');
        }
        const known = [
          'count', 'aspect', 'quality', 'images', 'provider', 'model', 'signal'
        ];
        for (const name of Object.keys(options)) {
          if (!known.includes(name)) {
            invalid(`unknown option "${name}"`);
          }
        }
        const {
          count = 1, aspect, quality, provider, model, signal
        } = options;
        if (!Number.isInteger(count) || count < 1) {
          invalid('"count" must be a positive integer');
        }
        if (aspect !== undefined) {
          if (typeof aspect !== 'string') {
            invalid('"aspect" must be a string');
          }
          // Reject a malformed dial now; the nearest-match resolution
          // against the routed model happens at call time
          self.canonicalAspect(aspect);
        }
        if (quality !== undefined &&
          ![ 'low', 'medium', 'high' ].includes(quality)) {
          invalid('"quality" must be "low", "medium" or "high"');
        }
        if ((provider === undefined) !== (model === undefined)) {
          invalid('"provider" and "model" must be given together');
        }
        for (const [ name, value ] of Object.entries({
          provider,
          model
        })) {
          if (value !== undefined && typeof value !== 'string') {
            invalid(`"${name}" must be a string`);
          }
        }
        if (signal !== undefined && !(signal instanceof AbortSignal)) {
          invalid('"signal" must be an AbortSignal');
        }
        return {
          prompt,
          count,
          aspect,
          quality,
          images: imageSources(options.images),
          provider,
          model,
          signal
        };

        // The images option → normalized source refs, or undefined when
        // absent (a plain text→image generation). Its presence is what
        // makes the call an edit. Each source is a public url or
        // inline base64 data with its media type — the same two shapes an
        // image content part accepts (normalizeMessages).
        function imageSources(sources) {
          if (sources === undefined) {
            return undefined;
          }
          if (!Array.isArray(sources) || !sources.length) {
            invalid('"images" must be a non-empty array of image sources');
          }
          return sources.map((source, index) => {
            const name = `images[${index}]`;
            if (isObject(source) && typeof source.url === 'string') {
              return { url: source.url };
            }
            if (isObject(source) && typeof source.data === 'string' &&
              typeof source.mediaType === 'string') {
              return {
                data: source.data,
                mediaType: source.mediaType
              };
            }
            throw self.apos.error(
              'invalid',
              `${name} must be an object like { url } or { data, mediaType }`
            );
          });
        }
      },
      // Normalize an aspect dial to its canonical 'W:H' string. The named
      // tokens square, portrait and landscape ground to the conventional
      // photo ratios (1:1, 3:4, 4:3); an explicit 'W:H' of two positive
      // numbers is returned as given. Throws "invalid" on anything else.
      // Every aspect the core hands an adapter passes through here, so an
      // adapter only ever sees 'W:H', never a named token.
      canonicalAspect(aspect) {
        const named = {
          square: '1:1',
          portrait: '3:4',
          landscape: '4:3'
        };
        if (Object.hasOwn(named, aspect)) {
          return named[aspect];
        }
        if (parseAspect(aspect)) {
          return aspect;
        }
        throw self.apos.error('invalid', `"${aspect}" is not a valid aspect: use "square", "portrait", "landscape" or a "W:H" ratio`);
      },
      // The numeric width/height ratio of an aspect dial.
      aspectRatio(aspect) {
        const [ w, h ] = parseAspect(self.canonicalAspect(aspect));
        return w / h;
      },
      // Resolve a requested aspect dial to the nearest aspect the routed
      // model declares, returning that declared string verbatim — echoed
      // to the caller in metadata and translated to the provider's dialect
      // by the adapter. `requested` is the call's `aspect` option (a named
      // token or 'W:H'), or undefined to leave the dial unset (returns
      // undefined; the provider default applies). `declared` is the
      // model's supported aspect strings (modelInfo). Nearest match
      // minimizes the log-ratio distance to the requested ratio; a tie
      // resolves to the larger ratio, then to declaration order. A model
      // that declares no aspects (an unknown model) is a pass-through: the
      // requested ratio returns as its canonical 'W:H' — never a named
      // token, so the adapter's input is uniform — for the adapter to
      // best-effort, and the provider may reject it.
      resolveAspect(requested, declared) {
        if (requested === undefined) {
          return undefined;
        }
        const target = self.aspectRatio(requested);
        if (!Array.isArray(declared) || !declared.length) {
          return self.canonicalAspect(requested);
        }
        let best = describe(declared[0]);
        for (const aspect of declared) {
          const candidate = describe(aspect);
          if (candidate.distance < best.distance - 1e-9 ||
            (Math.abs(candidate.distance - best.distance) <= 1e-9 &&
              candidate.ratio > best.ratio)) {
            best = candidate;
          }
        }
        return best.aspect;

        // An aspect string with its ratio and its log-ratio distance from
        // the requested target
        function describe(aspect) {
          const ratio = self.aspectRatio(aspect);
          return {
            aspect,
            ratio,
            distance: Math.abs(Math.log(target / ratio))
          };
        }
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
      // failing the startup on any problem (see activateTools).
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
          fail('tools must be registered before "apostrophe:ready"');
        }
        if (!isObject(tool) || typeof tool.name !== 'string' ||
          !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(tool.name)) {
          fail('addTool requires a definition with a "name" of 1 to 64 letters, digits, "_" or "-", starting with a letter');
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
      // An efficient way of checking (by name) if a tool exists
      hasTool(name) {
        return Object.hasOwn(self.tools, name);
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
      // Validate every registered tool definition (the shape is
      // documented on addTool) and replace it in the registry with its
      // activated canonical form: label and access defaulted, `input`
      // compiled into the `validateArgs` argument validator, `schema`
      // composed to the array form apos.schema.convert consumes, and
      // `handler` always a callable — a 'moduleName:methodName'
      // reference is resolved here, which is why activation waits for
      // "apostrophe:ready": every module's init has run by then, so
      // references resolve and overrides are settled regardless of
      // registration order. A bad definition fails the startup. The
      // registry is frozen afterwards.
      activateTools() {
        for (const [ name, tool ] of Object.entries(self.tools)) {
          self.tools[name] = activate(tool, `tool "${name}"`);
        }
        self.toolList = Object.values(self.tools);
        self.toolsByTag = new Map();
        for (const tool of self.toolList) {
          for (const tag of tool.tags) {
            const tools = self.toolsByTag.get(tag);
            if (tools) {
              tools.push(tool);
            } else {
              self.toolsByTag.set(tag, [ tool ]);
            }
          }
        }
        self.toolsActive = true;

        function activate(tool, name) {
          if (typeof tool.description !== 'string' || !tool.description) {
            fail(`${name}: "description" must be a non-empty string`);
          }
          if (tool.label !== undefined &&
            (typeof tool.label !== 'string' || !tool.label)) {
            fail(`${name}: "label" must be a non-empty string`);
          }
          if (tool.tags !== undefined && (!Array.isArray(tool.tags) ||
            tool.tags.some(tag => typeof tag !== 'string' || !tag))) {
            fail(`${name}: "tags" must be an array of tag strings`);
          }
          if (!isObject(tool.input) || tool.input.type !== 'object') {
            fail(`${name}: "input" must be a JSON Schema with an object root`);
          }
          let validateArgs;
          try {
            validateArgs = self.ajv.compile(tool.input);
          } catch (e) {
            fail(`${name}: "input" is not a valid JSON Schema: ${e.message}`);
          }
          if (!isObject(tool.schema)) {
            fail(`${name}: "schema" must be an object of schema fields describing the result`);
          }
          let schema;
          try {
            schema = self.apos.schema.compose({
              addFields: self.apos.schema.fieldsToArray(`AI tool ${tool.name}`, tool.schema)
            });
            self.apos.schema.validate(schema, {
              type: 'AI tool',
              subtype: tool.name
            });
          } catch (e) {
            fail(`${name}: "schema" is not a valid schema: ${e.message}`);
          }
          const access = tool.access === undefined ? 'write' : tool.access;
          if (![ 'read', 'write', 'agent' ].includes(access)) {
            fail(`${name}: "access" must be "read", "write" or "agent"`);
          }
          return {
            name: tool.name,
            label: tool.label || _.startCase(tool.name),
            description: tool.description,
            tags: tool.tags || [],
            input: tool.input,
            validateArgs,
            schema,
            access,
            handler: resolveHandler(tool.handler, name)
          };
        }

        // The handler option → the callable the loop runs: an inline
        // function as given, a 'moduleName:methodName' reference
        // resolved against the named module
        function resolveHandler(value, name) {
          if (typeof value === 'function') {
            return value;
          }
          if (typeof value !== 'string') {
            fail(`${name}: "handler" must be a function or a "moduleName:methodName" string`);
          }
          const [ moduleName, methodName, ...rest ] = value.split(':');
          if (!moduleName || !methodName || rest.length) {
            fail(`${name}: handler "${value}" must name a module and a method, like "moduleName:methodName"`);
          }
          // Own-property checks: a reference must never resolve
          // through the prototype chain ('constructor', 'toString', …)
          if (!Object.hasOwn(self.apos.modules, moduleName)) {
            fail(`${name}: handler names unknown module "${moduleName}"`);
          }
          const module = self.apos.modules[moduleName];
          if (!Object.hasOwn(module, methodName) ||
            typeof module[methodName] !== 'function') {
            fail(`${name}: handler names unknown method "${methodName}" of "${moduleName}"`);
          }
          return (req, args) => module[methodName](req, args);
        }
      },
      // Execute one model-requested tool call `call`, a toolCall
      // content part { id, name, input }, against `tool`, its
      // activated registry definition (getTool). Returns the
      // handler's result converted through the tool's schema — every
      // declared field present in normalized form — ready to be
      // serialized for the model.
      //
      // The model's input is validated against the tool's `input`
      // schema first; invalid arguments never reach the handler — they
      // throw 'aiToolError', the recoverable code, so the loop can
      // feed the validation message back to the model. The handler
      // runs with the caller's `req` and a copy of the validated
      // arguments; `context` is written to `args._context` after
      // validation, so a model-provided property can never pose as
      // core injection.
      //
      // A handler throw passes through untouched: recovery is decided
      // elsewhere, by the error code alone. A handler result the
      // schema rejects is a handler bug, not model misbehaviour: it
      // throws 'invalid' naming the tool — a standard code breaks the
      // AI chain, no retries, no further AI work — and no detail of it
      // is ever fed back to the model.
      async executeToolCall(req, tool, call, context = {}) {
        if (!tool.validateArgs(call.input)) {
          throw self.apos.error('aiToolError', `invalid arguments for tool "${tool.name}": ${self.ajv.errorsText(tool.validateArgs.errors, { dataVar: 'arguments' })}`);
        }
        const args = {
          ...call.input,
          _context: context
        };
        const result = await tool.handler(req, args);
        if (!isObject(result)) {
          throw self.apos.error('invalid', `tool "${tool.name}" must return an object matching its schema`);
        }
        const converted = {};
        try {
          await self.apos.schema.convert(req, tool.schema, result, converted);
        } catch (errors) {
          throw self.apos.error('invalid', `tool "${tool.name}" returned a result that does not match its schema: ${detail(errors)}`);
        }
        return converted;

        // The convert rejection → one readable line naming each field
        function detail(errors) {
          if (!Array.isArray(errors)) {
            return errors.message || String(errors);
          }
          return errors
            .map((error) => `${error.path}: ${error.message || error.name}`)
            .join('; ');
        }
      },
      // Assemble the normalized adapter request from `options`, a
      // canonical object as produced by normalizeGenerateOptions:
      // resolve routing, default maxTokens to the model's declared
      // output ceiling when it is known, translate the cache level to
      // the { ttl } policy. Returns { provider, request }: the resolved
      // provider name and the request handed to its adapter —
      // { system?, messages, tools?, schema?, model, maxTokens?,
      // reasoning?, cache: false | { ttl }, signal? }, optional fields
      // present only when they resolved to a value. Request tools carry
      // only { name, description, input } — handlers and result schemas
      // never reach an adapter; a structured-output `schema` (JSON
      // Schema) passes through for the adapter to place on its
      // provider's native structured mode.
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
            ...(options.tools.length && { tools: self.wireTools(options.tools) }),
            ...(options.schema !== undefined && { schema: options.schema }),
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
            ...(options.tools.length && { tools: self.wireTools(options.tools) }),
            ...(options.schema !== undefined && { schema: options.schema }),
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
      // The model-facing face of activated tool definitions, as placed
      // on the adapter request
      wireTools(tools) {
        return tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input: tool.input
        }));
      },
      // The built-in mock standing in for every adapter chat under
      // APOS_AI_MOCK. Consults the "mock" option first when the module
      // has one: it may return a complete assistant turn, a { text }
      // shorthand filled out into one, or undefined to fall through to
      // the deterministic default. That default is request-aware: for a
      // structured request (`request.schema`) it synthesizes a
      // schema-conforming object and returns it on the turn's `object`,
      // as a real adapter would — the pipeline backstop-validates
      // it like a real one — otherwise canned text echoing the
      // conversation's final message; usage is estimated from the text
      // sizes. Runs inside the same retry and validation seam as a real
      // adapter call, so a mock that throws normalized codes exercises
      // the real error paths.
      async mockChat(req, request) {
        const custom = self.options.mock
          ? await self.options.mock(request)
          : undefined;
        if (custom == null) {
          if (request.schema) {
            const object = sample(request.schema);
            return turn(JSON.stringify(object), object);
          }
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

        // A canned assistant turn. `text` is the answer's text; a
        // structured call passes the synthesized `object` too, which
        // rides the turn. The text stays in the content — for a
        // structured turn it is the object's JSON, so the transcript's
        // assistant message is non-empty and re-normalizes on resume,
        // as a real provider's structured answer would.
        function turn(text, object) {
          const input = [
            request.system,
            ...request.messages.map((message) => textOf(message.content))
          ].filter(Boolean).join(' ');
          return {
            content: [ {
              type: 'text',
              text
            } ],
            ...(object !== undefined && { object }),
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
        // A deterministic value conforming to `schema`, enough to pass
        // the structured-output backstop: `const`/`enum` honored, every
        // declared property of an object filled, arrays sized to
        // minItems, the simplest in-range value for a scalar
        function sample(schema) {
          if (!isObject(schema)) {
            return null;
          }
          if (schema.const !== undefined) {
            return schema.const;
          }
          if (Array.isArray(schema.enum) && schema.enum.length) {
            return schema.enum[0];
          }
          const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
          if (type === 'object') {
            const object = {};
            const properties = isObject(schema.properties) ? schema.properties : {};
            for (const [ key, subschema ] of Object.entries(properties)) {
              object[key] = sample(subschema);
            }
            return object;
          }
          if (type === 'array') {
            const min = Number.isInteger(schema.minItems) ? schema.minItems : 0;
            const items = isObject(schema.items) ? schema.items : {};
            return Array.from({ length: min }, () => sample(items));
          }
          if (type === 'boolean') {
            return false;
          }
          if (type === 'null') {
            return null;
          }
          if (type === 'number' || type === 'integer') {
            return Number.isFinite(schema.minimum) ? schema.minimum : 0;
          }
          // string, and the no-type case (any value validates)
          const min = Number.isInteger(schema.minLength) ? schema.minLength : 0;
          return 'x'.repeat(min);
        }
      },
      // The mock adapter's error normalization: errors pass through
      // untouched, so a mock throwing normalized codes exercises the
      // real error paths
      mockNormalizeError(error) {
        return error;
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
      //   { role, content } as normalizeMessages accepts — including a
      //   transcript a previous call returned;
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
      // `signal` (AbortSignal): aborts the in-flight provider call;
      //   also injected into every handler's `args._context`.
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
      // itself; `finishReason` is 'stop', 'length' or — whenever
      // `toolCalls` is present — 'maxSteps', the step budget's
      // counterpart of 'length'; `usage` aggregates { inputTokens,
      // outputTokens } across every model turn; `model` / `provider`
      // name what actually answered.
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
        // (executeToolCalls). One level of nesting is allowed: a
        // handler may run a subagent, whose own tools may not generate
        // further, whatever they carry. At the allowed level, agent
        // tools are dropped rather than rejected — a toolset needs no
        // curating per depth — so a subagent simply cannot spawn
        // subagents.
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
          ? {
            name: provider,
            adapter: {
              chat: self.mockChat,
              normalizeError: self.mockNormalizeError
            }
          }
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
        let turn;
        let pending = null;
        for (let turns = 1; ; turns++) {
          turn = await self.callAdapter(req, record, context.request, async () => {
            const answer = self.validateTurn(
              await record.adapter.chat(req, context.request)
            );
            // The adapter placed the final answer on `answer.object`;
            // backstop-validate it here so a malformed one travels the
            // same retry path as the turn. Only a 'stop' turn is the
            // answer: tool turns run the loop with their own validation,
            // a refusal surfaces as aiRefusal below, and a 'length'
            // turn returns as-is — no object, the finish reason tells
            // the caller why
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
          const outcomes = await self.executeToolCalls(req, tools, calls, handlerContext);
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
        }
        context.result = self.assembleResult(context, turn, {
          steps,
          usage,
          pending,
          object: turn.object,
          hadTools: tools.size > 0
        });
        await self.emit('afterGenerate', req, context);
        return context.result;
      },
      // Execute one batch of model-requested tool calls — the toolCall
      // parts of a single assistant turn — against `tools`, the call's
      // selected definitions as a Map by name. Reads run first, in
      // parallel; writes follow serially, in the order the model
      // requested them; `context` reaches every handler as
      // `args._context`, extended with `depth` — 1 inside a top-level
      // call's batch, deeper inside a subagent's. Handlers run on a
      // clone of the caller's req stamped with that depth
      // (`aposAiDepth`) — an immutable property of the request each
      // handler received, never shared mutable state — so a generate
      // call a handler makes with its own req knows it is nested, even
      // delayed or from a stashed reference, while the caller's
      // original req is untouched and concurrent calls sharing it are
      // unaffected. Every batch is stamped, not only agent tools, so a
      // handler that spawns without declaring `access: 'agent'` is
      // contained all the same; `_context.depth` is the informational
      // copy a handler may act on. Returns outcomes in model order
      // regardless of
      // scheduling: { toolCall, result } per success, { toolCall,
      // error } per recoverable failure — a call naming a tool outside
      // the selected set, invalid arguments, or a handler's
      // aiToolError; the error message is what the model reads back,
      // and siblings are unaffected. Any other throw is a hard stop:
      // it propagates immediately, before any write runs when thrown
      // by a read, aborting the remaining writes when thrown by one —
      // and no trace of it is ever model-bound. Emits beforeToolCall
      // and afterToolCall around each execution.
      async executeToolCalls(req, tools, calls, context = {}) {
        const outcomes = new Array(calls.length);
        const depth = (req.aposAiDepth || 0) + 1;
        const handlerReq = req.clone({ aposAiDepth: depth });
        const handlerContext = {
          ...context,
          depth
        };
        const run = async (call, index) => {
          const tool = tools.get(call.name);
          if (!tool) {
            outcomes[index] = {
              toolCall: call,
              error: `unknown tool "${call.name}"`
            };
            return;
          }
          const payload = {
            call,
            tool
          };
          await self.emit('beforeToolCall', req, payload);
          try {
            payload.result = await self.executeToolCall(
              handlerReq, tool, call, handlerContext
            );
            outcomes[index] = {
              toolCall: call,
              result: payload.result
            };
          } catch (e) {
            if (e?.name !== 'aiToolError') {
              throw e;
            }
            payload.error = e.message;
            outcomes[index] = {
              toolCall: call,
              error: e.message
            };
          }
          await self.emit('afterToolCall', req, payload);
        };
        const reads = [];
        const writes = [];
        calls.forEach((call, index) => {
          if (tools.get(call.name)?.access === 'read') {
            reads.push([ call, index ]);
          } else {
            writes.push([ call, index ]);
          }
        });
        const settled = await Promise.allSettled(
          reads.map(([ call, index ]) => run(call, index))
        );
        for (const read of settled) {
          if (read.status === 'rejected') {
            throw read.reason;
          }
        }
        for (const [ call, index ] of writes) {
          await run(call, index);
        }
        return outcomes;
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
          if (part.type === 'toolCall' && (
            typeof part.id !== 'string' || !part.id ||
            typeof part.name !== 'string' || !isObject(part.input)
          )) {
            malformed('toolCall parts must carry a string "id" and "name" and an object "input"');
          }
        }
        if (![ 'stop', 'toolCalls', 'length', 'refusal' ].includes(turn.finishReason)) {
          malformed(`"${turn.finishReason}" is not a finish reason`);
        }
        if (turn.finishReason === 'toolCalls' &&
          !turn.content.some(part => part.type === 'toolCall')) {
          malformed('a "toolCalls" finish reason without toolCall parts');
        }
        if (!isObject(turn.usage) ||
          !Number.isFinite(turn.usage.inputTokens) ||
          !Number.isFinite(turn.usage.outputTokens)) {
          malformed('"usage" must carry inputTokens and outputTokens');
        }
        return turn;
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
      },
      // Build generate's unified return object from `context` (the
      // event payload carrying the provider name and the live request,
      // whose messages already include every appended turn), `turn`
      // (the final validated adapter response) and the loop's
      // accumulations: executed `steps`, `usage` aggregated across
      // every model turn, the `pending` tool calls when the step
      // budget cut the loop, the validated structured `object` when the
      // call passed a `schema`, and whether the call had tools at all
      // (`steps` appears only then). Returns { text, messages,
      // finishReason, usage, model, provider } plus `object`, `steps`
      // and `toolCalls` as described on generate; which fields are
      // populated tells the caller what happened. The transcript is
      // resumable as the next call's `messages`.
      assembleResult(context, turn, {
        steps, usage, pending, object, hadTools
      }) {
        const text = turn.content
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join('');
        return {
          text,
          ...(object !== undefined && { object }),
          messages: [ ...context.request.messages ],
          ...(hadTools && { steps }),
          ...(pending && { toolCalls: pending }),
          // The step budget cutting the loop is its own finish reason,
          // like the token budget's 'length'
          finishReason: pending ? 'maxSteps' : turn.finishReason,
          usage,
          model: turn.model || context.request.model,
          provider: context.provider
        };
      },
      // Fail startup when a model's declared image `aspects` are
      // malformed. resolveAspect trusts these to be well-formed 'W:H'
      // strings at call time, so a bad declaration — from an adapter or a
      // provider entry — is caught here, once, with a clear message,
      // rather than surfacing as a caller-facing error on a real call.
      validateAspects(providerName, models) {
        for (const [ model, meta ] of Object.entries(models)) {
          if (meta.aspects === undefined) {
            continue;
          }
          if (!Array.isArray(meta.aspects) || !meta.aspects.length) {
            fail(`"providers.${providerName}" model "${model}": "aspects" must be a non-empty array of "W:H" ratios`);
          }
          for (const aspect of meta.aspects) {
            if (!parseAspect(aspect)) {
              fail(`"providers.${providerName}" model "${model}" declares an invalid aspect "${aspect}"; use a "W:H" ratio`);
            }
          }
        }
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
