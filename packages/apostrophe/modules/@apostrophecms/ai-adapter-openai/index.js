// The standard OpenAI adapter for `apos.ai`. It registers itself with
// the AI engine at startup; configure the provider with just a key
// under the engine's `providers.openai` entry to use it. All knowledge
// of the OpenAI dialect — request translation, response parsing, error
// mapping — lives here.
//
// The adapter speaks the Chat Completions dialect only, the de facto
// wire standard of the ecosystem: an aliased provider entry
// (`adapter: 'openai'`) pointing `baseUrl` at any compatible vendor or
// local runtime (Groq, Mistral, OpenRouter, Ollama, vLLM, …) is a
// custom provider with zero adapter code — the entry's own `models`,
// `effort` and `capabilities` describe the actual service.
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
          name: 'openai',
          label: 'OpenAI',
          baseUrl: 'https://api.openai.com/v1',
          envKey: 'APOS_OPENAI_KEY',
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
            low: { model: 'gpt-5.6-luna' },
            medium: { model: 'gpt-5.6-terra' },
            high: {
              model: 'gpt-5.6-sol',
              reasoning: 'high'
            }
          },
          models: {
            'gpt-5.6-luna': {
              contextWindow: 1050000,
              maxOutputTokens: 128000
            },
            'gpt-5.6-terra': {
              contextWindow: 1050000,
              maxOutputTokens: 128000
            },
            'gpt-5.6-sol': {
              contextWindow: 1050000,
              maxOutputTokens: 128000
            }
          },
          validate() {
            if (!this.apiKey) {
              throw new Error(`the "${this.provider}" provider requires an apiKey`);
            }
          },
          async chat(req, request) {
            const response = await self.apos.http.post(`${this.baseUrl}/chat/completions`, {
              headers: {
                authorization: `Bearer ${this.apiKey}`
              },
              body: self.buildBody(request),
              timeout: self.options.timeout,
              ...(request.signal && { signal: request.signal })
            });
            return self.parseResponse(response, request);
          },
          normalizeError(error) {
            return self.normalizeError(error);
          }
        };
      },
      // Translate a normalized adapter request (see the engine's
      // buildRequest) to a Chat Completions body: the system prompt
      // leads the messages as a `system` turn, tool definitions become
      // `tools`, a structured-output `schema` becomes a `json_schema`
      // response format, `maxTokens` becomes `max_completion_tokens`
      // (optional here, so an unresolved cap is omitted) and `reasoning`
      // travels as `reasoning_effort`, verbatim. A message whose content
      // is a single text part collapses to the plain-string form every
      // compatible host accepts; anything else stays a parts array. Tool
      // requests ride an assistant message's `tool_calls`; the dialect
      // wants one `tool` message per result, so a normalized `tool`
      // message (all of a batch's results) fans out into several. The
      // cache policy places nothing: the provider caches prompt prefixes
      // automatically and the ttl level is not settable in this
      // dialect.
      buildBody(request) {
        const {
          system, messages, model, maxTokens, reasoning, tools, schema
        } = request;
        return {
          model,
          messages: [
            ...(system !== undefined
              ? [ {
                role: 'system',
                content: system
              } ]
              : []),
            ...messages.flatMap(toMessages)
          ],
          ...(tools && { tools: tools.map(toTool) }),
          // The portable JSON Schema goes as the response format without
          // `strict`: strict mode would demand an OpenAI-specific schema
          // subset (every object additionalProperties:false, every
          // property required), which the same schema on Anthropic and
          // Google does not — so the model is schema-guided here and the
          // engine's backstop catches a stray.
          ...(schema && {
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'response',
                schema
              }
            }
          }),
          ...(maxTokens !== undefined && { max_completion_tokens: maxTokens }),
          ...(reasoning !== undefined && { reasoning_effort: reasoning })
        };

        // One normalized message → one or more Chat Completions
        // messages. An assistant turn carries its tool requests as
        // `tool_calls` beside any text; a `tool` batch splits into one
        // `tool` message per result
        function toMessages(message) {
          if (message.role === 'tool') {
            return message.content.map((part) => ({
              role: 'tool',
              tool_call_id: part.toolCallId,
              content: part.error !== undefined
                ? part.error
                : JSON.stringify(part.output)
            }));
          }
          if (message.role === 'assistant') {
            const calls = message.content.filter((part) => part.type === 'toolCall');
            const rest = message.content.filter((part) => part.type !== 'toolCall');
            return [ {
              role: 'assistant',
              content: rest.length ? toContent(rest) : null,
              ...(calls.length && { tool_calls: calls.map(toToolCall) })
            } ];
          }
          return [ {
            role: 'user',
            content: toContent(message.content)
          } ];
        }
        function toToolCall(call) {
          return {
            id: call.id,
            type: 'function',
            function: {
              name: call.name,
              arguments: JSON.stringify(call.input)
            }
          };
        }
        // The model-facing tool definition; the JSON Schema travels
        // verbatim as the function parameters
        function toTool(tool) {
          return {
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.input
            }
          };
        }
        function toContent(parts) {
          if (parts.length === 1 && parts[0].type === 'text') {
            return parts[0].text;
          }
          return parts.map(toPart);
        }
        function toPart(part) {
          if (part.type === 'text') {
            return {
              type: 'text',
              text: part.text
            };
          }
          // part.type === 'image', in one of the two normalized forms
          return {
            type: 'image_url',
            image_url: {
              url: part.image.url !== undefined
                ? part.image.url
                : `data:${part.image.mediaType};base64,${part.image.data}`
            }
          };
        }
      },
      // Translate a Chat Completions response to the normalized
      // assistant turn { content, finishReason, usage, model }. An
      // in-body `refusal` message throws the refusal error here, and a
      // `content_filter` finish reason maps to the refusal finish
      // reason — "refused" always arrives as an error, never a silent
      // empty turn. Tool calls carry their arguments as a JSON string,
      // parsed into the normalized input object. When the request asked
      // for structured output, the final answer's text is the JSON
      // object: it is parsed onto the turn's `object` ([D35]), which the
      // engine backstop-validates; malformed JSON is a retryable
      // response. An unknown finish reason maps to no finishReason — the
      // engine's turn validation treats that as a malformed (retryable)
      // response, never a truncated success.
      parseResponse(response, request = {}) {
        const [ choice ] = response.choices || [];
        const message = choice?.message || {};
        if (message.refusal) {
          throw self.apos.error('aiRefusal', message.refusal);
        }
        const content = [];
        if (typeof message.content === 'string' && message.content !== '') {
          content.push({
            type: 'text',
            text: message.content
          });
        }
        for (const call of message.tool_calls || []) {
          content.push({
            type: 'toolCall',
            id: call.id,
            name: call.function?.name,
            input: JSON.parse(call.function?.arguments || '{}')
          });
        }
        const finishReason = {
          stop: 'stop',
          length: 'length',
          tool_calls: 'toolCalls',
          content_filter: 'refusal'
        }[choice?.finish_reason];
        const turn = {
          content,
          finishReason,
          usage: {
            inputTokens: response.usage?.prompt_tokens,
            outputTokens: response.usage?.completion_tokens
          },
          model: response.model
        };
        if (request.schema && finishReason === 'stop') {
          try {
            turn.object = JSON.parse(message.content);
          } catch (e) {
            throw self.apos.error('aiRetry', 'the model returned malformed structured JSON');
          }
        }
        return turn;
      },
      // Map any error the transport produced to a normalized apos
      // error, the only shape the engine reacts to. Transient failures
      // — 429, 5xx, network trouble, our own timeout — become the
      // retryable code with a `kind` hint; the provider's Retry-After
      // (seconds or an HTTP date) is parsed into `retryAfter` seconds
      // and its request id is carried for the failure records. A
      // caller's own abort is not a provider failure and passes
      // through untouched.
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
        const headers = error.headers || {};
        const retryAfter = retryAfterSeconds(headers['retry-after']);
        const data = {
          status,
          ...(headers['x-request-id'] !== undefined && { requestId: headers['x-request-id'] }),
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
      }
    };
  }
};
