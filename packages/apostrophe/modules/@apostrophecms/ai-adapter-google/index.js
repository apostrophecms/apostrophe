// The standard Google (Gemini) adapter for `apos.ai`. It registers
// itself with the AI engine at startup; configure the provider with
// just a key under the engine's `providers.google` entry to use it.
// All knowledge of the Gemini generateContent dialect — request
// translation, response parsing, error mapping — lives here.
//
// Url-form image parts translate to the dialect's `fileData.fileUri`,
// which the service accepts for its own Files API URIs, not for
// arbitrary web URLs — pass base64 `{ data, mediaType }` parts for
// images the service cannot reach.
//
// The transport is `apos.http`, no SDK. Projects can adjust the dialect
// by extending this module and overriding its methods.

module.exports = {
  options: {
    // Per-request timeout in milliseconds; a timed-out call is a
    // transient failure the engine retries
    timeout: 600000
  },
  init(self) {
    self.apos.ai.addAdapter(self.adapter());
  },
  methods(self) {
    return {
      // The adapter definition registered with `apos.ai`. The engine
      // instantiates it per configured provider entry, assigning
      // `provider`, `apiKey` and `baseUrl` — which is why `chat` and
      // `validate` read config from `this` while the dialect work
      // delegates to the module's methods.
      adapter() {
        return {
          name: 'google',
          label: 'Google (Gemini)',
          baseUrl: 'https://generativelanguage.googleapis.com',
          envKey: 'APOS_GEMINI_KEY',
          capabilities: {
            text: true,
            tools: true,
            structured: true,
            stream: true,
            imageInput: true,
            image: true,
            caching: true
          },
          effort: {
            low: { model: 'gemini-3.1-flash-lite' },
            medium: { model: 'gemini-3.5-flash' },
            high: {
              model: 'gemini-3.5-flash',
              reasoning: 'high'
            }
          },
          models: {
            'gemini-3.1-flash-lite': {
              contextWindow: 1048576,
              maxOutputTokens: 65536
            },
            'gemini-3.5-flash': {
              contextWindow: 1048576,
              maxOutputTokens: 65536
            }
          },
          validate() {
            if (!this.apiKey) {
              throw new Error(`the "${this.provider}" provider requires an apiKey`);
            }
          },
          async chat(req, request) {
            const response = await self.apos.http.post(
              `${this.baseUrl}/v1beta/models/${request.model}:generateContent`,
              {
                headers: {
                  'x-goog-api-key': this.apiKey
                },
                body: self.buildBody(request),
                timeout: self.options.timeout,
                ...(request.signal && { signal: request.signal })
              }
            );
            return self.parseResponse(response);
          },
          normalizeError(error) {
            return self.normalizeError(error);
          }
        };
      },
      // Translate a normalized adapter request (see the engine's
      // buildRequest) to a generateContent body: the system prompt
      // becomes `systemInstruction`, the assistant role becomes
      // `model`, `maxTokens` and `reasoning` travel in
      // `generationConfig` (as `maxOutputTokens` and the thinking
      // level, verbatim), each omitted when unresolved. The model is
      // not part of the body — it rides in the request URL. The cache
      // policy places nothing: the provider caches prompt prefixes
      // automatically and the ttl level is not settable per request.
      buildBody(request) {
        const {
          system, messages, maxTokens, reasoning, tools
        } = request;
        const generationConfig = {
          ...(maxTokens !== undefined && { maxOutputTokens: maxTokens }),
          ...(reasoning !== undefined && {
            thinkingConfig: { thinkingLevel: reasoning }
          })
        };
        // Gemini pairs a function response to its call by name, not id,
        // so recover the name of the call the engine's synthesized id
        // refers to (parseResponse mints those ids)
        const toolNamesById = new Map();
        for (const message of messages) {
          for (const part of message.content) {
            if (part.type === 'toolCall') {
              toolNamesById.set(part.id, part.name);
            }
          }
        }
        return {
          ...(system !== undefined && {
            systemInstruction: {
              parts: [ { text: system } ]
            }
          }),
          contents: messages.map((message) => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: message.content.map(toPart)
          })),
          ...(tools && {
            tools: [ { functionDeclarations: tools.map(toFunctionDeclaration) } ]
          }),
          ...(Object.keys(generationConfig).length && { generationConfig })
        };

        // The model-facing tool definition; the JSON Schema travels
        // verbatim as the OpenAPI-subset parameters (the service polices
        // any keyword it does not accept)
        function toFunctionDeclaration(tool) {
          return {
            name: tool.name,
            description: tool.description,
            parameters: tool.input
          };
        }
        function toPart(part) {
          if (part.type === 'text') {
            return { text: part.text };
          }
          if (part.type === 'toolCall') {
            return {
              functionCall: {
                name: part.name,
                args: part.input
              }
            };
          }
          if (part.type === 'toolResult') {
            return {
              functionResponse: {
                name: toolNamesById.get(part.toolCallId),
                response: part.error !== undefined
                  ? { error: part.error }
                  : part.output
              }
            };
          }
          // part.type === 'image', in one of the two normalized forms
          return part.image.url !== undefined
            ? {
              fileData: { fileUri: part.image.url }
            }
            : {
              inlineData: {
                mimeType: part.image.mediaType,
                data: part.image.data
              }
            };
        }
      },
      // Translate a generateContent response to the normalized
      // assistant turn { content, finishReason, usage, model }. A
      // blocked prompt arrives with no candidates and throws the
      // refusal error here; a safety-family finish reason maps to the
      // refusal finish reason — "refused" always arrives as an error.
      // The dialect reports STOP on tool-call turns, so functionCall
      // parts force the toolCalls finish reason. Gemini function calls
      // carry no id, but the normalized shape needs one to pair a
      // result back to its call: the adapter synthesizes a per-turn id
      // (buildBody recovers the tool name from it). Thought parts are
      // not conversation content and do not travel. Thinking tokens are
      // billed as output, so they add into outputTokens. An unknown
      // finish reason maps to no finishReason — the engine's turn
      // validation treats that as a malformed (retryable) response,
      // never a truncated success.
      parseResponse(response) {
        const blockReason = response.promptFeedback?.blockReason;
        if (blockReason) {
          throw self.apos.error('aiRefusal', `the model blocked this request: ${blockReason}`);
        }
        const [ candidate ] = response.candidates || [];
        let callIndex = 0;
        const content = (candidate?.content?.parts || [])
          .filter((part) => !part.thought)
          .map(fromPart)
          .filter(Boolean);
        const usage = response.usageMetadata;
        return {
          content,
          finishReason: content.some((part) => part.type === 'toolCall')
            ? 'toolCalls'
            : {
              STOP: 'stop',
              MAX_TOKENS: 'length',
              SAFETY: 'refusal',
              RECITATION: 'refusal',
              PROHIBITED_CONTENT: 'refusal',
              BLOCKLIST: 'refusal',
              SPII: 'refusal',
              IMAGE_SAFETY: 'refusal'
            }[candidate?.finishReason],
          usage: {
            inputTokens: usage?.promptTokenCount,
            outputTokens: usage?.candidatesTokenCount === undefined
              ? undefined
              : usage.candidatesTokenCount + (usage.thoughtsTokenCount || 0)
          },
          model: response.modelVersion
        };

        function fromPart(part) {
          if (typeof part.text === 'string') {
            return {
              type: 'text',
              text: part.text
            };
          }
          if (part.functionCall) {
            return {
              type: 'toolCall',
              id: `${part.functionCall.name}-${callIndex++}`,
              name: part.functionCall.name,
              input: part.functionCall.args || {}
            };
          }
          return null;
        }
      },
      // Map any error the transport produced to a normalized apos
      // error, the only shape the engine reacts to. Transient failures
      // — 429, 5xx, network trouble, our own timeout — become the
      // retryable code with a `kind` hint. The provider's retry hint
      // is read from the Retry-After header or, failing that, from
      // the RetryInfo detail Gemini puts in the error body, into
      // `retryAfter` seconds. No request id header exists on this
      // API. A caller's own abort is not a provider failure and
      // passes through untouched.
      normalizeError(error) {
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
        const retryAfter = retryAfterSeconds(error.headers?.['retry-after']) ??
          retryInfoSeconds(error.body?.error?.details);
        const data = {
          status,
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

        function retryAfterSeconds(value) {
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
        }
        // The google.rpc.RetryInfo detail carries a protobuf Duration
        // like "37s"
        function retryInfoSeconds(details) {
          const info = (details || []).find((detail) =>
            detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
          const match = /^(\d+(?:\.\d+)?)s$/.exec(info?.retryDelay || '');
          return match ? Math.ceil(Number(match[1])) : undefined;
        }
      }
    };
  }
};
