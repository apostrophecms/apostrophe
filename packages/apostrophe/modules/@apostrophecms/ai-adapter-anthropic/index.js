// The standard Anthropic (Claude) adapter for `apos.ai`. It registers
// itself with the AI engine at startup; configure the provider with just
// a key under the engine's `providers.anthropic` entry to use it. All
// knowledge of the Anthropic Messages dialect — request translation,
// prompt-cache markers, response parsing, error mapping - lives here.
//
// The transport is `apos.http`, no SDK. Projects can adjust the dialect
// by extending this module and overriding its methods.

module.exports = {
  options: {
    // The anthropic-version request header
    version: '2023-06-01',
    // Per-request timeout in milliseconds; a timed-out call is a
    // transient failure the engine retries
    timeout: 600000,
    // reasoning level - extended-thinking budget_tokens (Anthropic's
    // floor for a budget is 1024).
    thinkingBudgets: {
      low: 1024,
      medium: 4096,
      high: 16384
    }
  },
  init(self) {
    self.apos.ai.addAdapter(self.adapter());
  },
  methods(self) {
    // Anthropic has no response-schema mode, so structured output is
    // delivered through tool use: a synthetic tool whose input schema is
    // the request's `schema`. The model calls it to answer; parseResponse
    // turns that call back into a plain structured answer. Its name leads
    // with an underscore, which the engine's tool-name rule forbids, so
    // it can never collide with a real tool.
    const FINAL_ANSWER = '_final_answer';
    const FINAL_ANSWER_DESCRIPTION = 'Provide your final answer by calling this tool with the required fields. This is the only way to return your response.';
    return {
      // The adapter definition registered with `apos.ai`. The engine
      // instantiates it per configured provider entry, assigning
      // `provider`, `apiKey` and `baseUrl` — which is why `chat` and
      // `validate` read config from `this` while the dialect work
      // delegates to the module's methods.
      adapter() {
        return {
          name: 'anthropic',
          label: 'Anthropic (Claude)',
          baseUrl: 'https://api.anthropic.com',
          envKey: 'APOS_ANTHROPIC_KEY',
          capabilities: {
            text: true,
            tools: true,
            structured: true,
            stream: true,
            imageInput: true,
            image: false,
            caching: true
          },
          effort: {
            low: { model: 'claude-haiku-4-5' },
            medium: { model: 'claude-sonnet-4-6' },
            high: {
              model: 'claude-opus-4-8',
              reasoning: 'high'
            }
          },
          models: {
            'claude-haiku-4-5': {
              contextWindow: 200000,
              maxOutputTokens: 32000
            },
            'claude-sonnet-4-6': {
              contextWindow: 200000,
              maxOutputTokens: 64000
            },
            'claude-opus-4-8': {
              contextWindow: 200000,
              maxOutputTokens: 64000
            }
          },
          validate() {
            if (!this.apiKey) {
              throw new Error(`the "${this.provider}" provider requires an apiKey`);
            }
          },
          async chat(req, request) {
            const response = await self.apos.http.post(`${this.baseUrl}/v1/messages`, {
              headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': self.options.version
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
      // buildRequest) to an Anthropic Messages API body: content parts
      // become Anthropic blocks, tool definitions become `tools`,
      // `reasoning` becomes a thinking budget, and the cache policy is
      // placed as `cache_control` markers — one on the system tail (the
      // static prefix) and a rolling one on the last message, so the
      // next call in a conversation reads what this one wrote. Tool
      // requests and results ride the conversation as `tool_use` and
      // `tool_result` blocks; the dialect has no tool role, so a
      // normalized `tool` message becomes a `user` message of
      // `tool_result` blocks. A structured-output `schema` adds the
      // synthetic final-answer tool, forced when nothing competes for
      // the turn. Throws "invalid" on requests the dialect cannot
      // express.
      buildBody(request) {
        const invalid = (message) => {
          throw self.apos.error('invalid', message);
        };
        const {
          system, messages, model, maxTokens, reasoning, cache, tools, schema
        } = request;
        if (!Number.isInteger(maxTokens)) {
          invalid(`"maxTokens" is required: model "${model}" declares no maxOutputTokens to default to`);
        }
        const wireTools = [
          ...(tools || []).map(toTool),
          ...(schema
            ? [ {
              name: FINAL_ANSWER,
              description: FINAL_ANSWER_DESCRIPTION,
              input_schema: schema
            } ]
            : [])
        ];
        const body = {
          model,
          max_tokens: maxTokens,
          ...(system !== undefined && { system }),
          ...(wireTools.length && { tools: wireTools }),
          // Force the structured answer only when nothing else needs the
          // turn: a real tool the model must be free to call first, or
          // extended thinking, which Anthropic forbids alongside a forced
          // tool. Otherwise the tool's description drives it and the
          // engine's backstop retries a miss.
          ...(schema && !(tools && tools.length) && reasoning === undefined && {
            tool_choice: {
              type: 'tool',
              name: FINAL_ANSWER
            }
          }),
          messages: messages.map((message) => ({
            role: message.role === 'tool' ? 'user' : message.role,
            content: message.content.map(toBlock)
          }))
        };
        if (reasoning !== undefined) {
          body.thinking = toThinking(reasoning);
        }
        if (cache) {
          const marker = {
            type: 'ephemeral',
            ...(cache.ttl === 'long' && { ttl: '1h' })
          };
          if (body.system !== undefined) {
            body.system = [ {
              type: 'text',
              text: body.system,
              cache_control: marker
            } ];
          }
          const parts = body.messages.at(-1).content;
          parts[parts.length - 1].cache_control = marker;
        }
        return body;

        // The model-facing tool definition; the JSON Schema travels
        // verbatim as input_schema
        function toTool(tool) {
          return {
            name: tool.name,
            description: tool.description,
            input_schema: tool.input
          };
        }
        function toBlock(part) {
          if (part.type === 'text') {
            return {
              type: 'text',
              text: part.text
            };
          }
          if (part.type === 'toolCall') {
            return {
              type: 'tool_use',
              id: part.id,
              name: part.name,
              input: part.input
            };
          }
          if (part.type === 'toolResult') {
            // Anthropic carries the result as a string; an object output
            // is serialized, an error is flagged
            return {
              type: 'tool_result',
              tool_use_id: part.toolCallId,
              ...(part.error !== undefined
                ? {
                  content: part.error,
                  is_error: true
                }
                : { content: JSON.stringify(part.output) })
            };
          }
          // part.type === 'image', in one of the two normalized forms
          return {
            type: 'image',
            source: part.image.url !== undefined
              ? {
                type: 'url',
                url: part.image.url
              }
              : {
                type: 'base64',
                media_type: part.image.mediaType,
                data: part.image.data
              }
          };
        }
        // Anthropic wants an absolute token budget, mapped by the
        // thinkingBudgets option; the budget must leave max_tokens
        // room for the answer
        function toThinking(reasoning) {
          const budget = self.options.thinkingBudgets[reasoning];
          if (!budget) {
            invalid(`no thinking budget is configured for reasoning "${reasoning}"`);
          }
          if (maxTokens <= budget) {
            invalid(`"maxTokens" (${maxTokens}) must exceed the "${reasoning}" thinking budget (${budget})`);
          }
          return {
            type: 'enabled',
            budget_tokens: budget
          };
        }
      },
      // Translate an Anthropic Messages response to the normalized
      // assistant turn { content, finishReason, usage, model }. Thinking
      // blocks are not conversation content and do not travel. A
      // `refusal` stop reason throws the refusal error here, so
      // "refused" always arrives as an error. When the request asked for
      // structured output and the model called the synthetic
      // final-answer tool, that call is the answer, not a tool for the
      // core to run: it becomes a `stop` turn carrying the arguments on
      // `object` (and their JSON in the text, so the transcript
      // round-trips). Anything else — free text, a real tool call —
      // parses normally, leaving no `object` for the engine backstop to
      // retry on. An unknown stop reason maps to no finishReason — the
      // engine's turn validation treats that as a malformed (retryable)
      // response, never a truncated success.
      parseResponse(response, request = {}) {
        if (response.stop_reason === 'refusal') {
          throw self.apos.error('aiRefusal', 'the model refused this request');
        }
        const usage = {
          inputTokens: response.usage?.input_tokens,
          outputTokens: response.usage?.output_tokens
        };
        const content = (response.content || [])
          .map(fromBlock)
          .filter(Boolean);
        if (request.schema) {
          const answer = content.find(
            (part) => part.type === 'toolCall' && part.name === FINAL_ANSWER
          );
          if (answer) {
            return {
              content: [ {
                type: 'text',
                text: JSON.stringify(answer.input)
              } ],
              object: answer.input,
              finishReason: 'stop',
              usage,
              model: response.model
            };
          }
        }
        return {
          content,
          finishReason: {
            end_turn: 'stop',
            stop_sequence: 'stop',
            max_tokens: 'length',
            tool_use: 'toolCalls'
          }[response.stop_reason],
          usage,
          model: response.model
        };

        function fromBlock(block) {
          if (block.type === 'text') {
            return {
              type: 'text',
              text: block.text
            };
          }
          if (block.type === 'tool_use') {
            return {
              type: 'toolCall',
              id: block.id,
              name: block.name,
              input: block.input
            };
          }
          return null;
        }
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
          ...(headers['request-id'] !== undefined && { requestId: headers['request-id'] }),
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
