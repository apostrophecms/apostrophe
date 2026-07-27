// The translation layer between a normalized call and the adapter
// protocol: routing resolution, the adapter request built from a
// canonical options object, and the result envelope on the way back.

module.exports = (self) => {
  function invalid(message) {
    throw self.apos.error('invalid', message);
  }

  // The adapter request literal, from `options` — a canonical options
  // object as produced by normalizeGenerateOptions (normalize.js) —
  // and `info`, the resolved routing it is sent with: { provider,
  // model, reasoning?, maxOutputTokens? } as modelInfo reports it.
  // Optional fields appear only when they resolved to a value, so an
  // unset dial leaves the provider's own default in place.
  function assembleRequest(options, info) {
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
  }

  return {
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
    // Throw "invalid" when the configured provider named by
    // `provider` does not declare `capability` (a key of the
    // capabilities map, e.g. 'text'). A call needing a capability the
    // routed provider lacks is a clear error, never a silent
    // re-route.
    checkCapability(provider, capability) {
      if (!self.providers[provider]?.capabilities?.[capability]) {
        invalid(`provider "${provider}" does not declare the "${capability}" capability`);
      }
    },
    // Assemble the normalized adapter request from `options`, a
    // canonical object as produced by normalizeGenerateOptions
    // (normalize.js): resolve routing, default maxTokens to the model's
    // declared output ceiling when it is known, translate the cache
    // level to the { ttl } policy. Returns { provider, request }: the
    // resolved provider name and the request handed to its adapter —
    // { system?, messages, tools?, schema?, model, maxTokens?,
    // reasoning?, cache: false | { ttl }, signal? }, optional fields
    // present only when they resolved to a value. Request tools carry
    // only { name, description, input } — handlers and result schemas
    // never reach an adapter; a structured-output `schema` (JSON
    // Schema) passes through for the adapter to place on its
    // provider's native structured mode.
    buildRequest(options) {
      return assembleRequest(options, self.modelInfo({
        provider: options.provider,
        model: options.model,
        effort: options.effort,
        reasoning: options.reasoning
      }));
    },
    // Assemble the adapter request without routing, for mock mode
    // with no providers configured. Same input and return shape as
    // buildRequest, with the call's explicit provider and model when
    // given and "mock" placeholders otherwise; no model metadata
    // exists here, so maxTokens appears only when the call sets it.
    buildMockRequest(options) {
      return assembleRequest(options, {
        provider: options.provider ?? 'mock',
        model: options.model ?? 'mock',
        reasoning: options.reasoning,
        maxOutputTokens: undefined
      });
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
      steps, usage, pending, object, hadTools, finishReason
    }) {
      // `turn` is null when a cancellation aborted the first provider
      // call of a step: there is no final assistant turn, only the
      // work recorded so far
      const text = (turn ? turn.content : [])
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
        // like the token budget's 'length'; an explicit override wins
        // (a cancelled run)
        finishReason: finishReason ||
          (pending ? 'maxSteps' : turn.finishReason),
        usage,
        model: turn?.model || context.request.model,
        provider: context.provider
      };
    }
  };
};
