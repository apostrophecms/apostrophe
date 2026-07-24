// The standard OpenAI adapter for `apos.ai`. It registers itself with
// the AI engine at startup; configure the provider with just a key
// under the engine's `providers.openai` entry to use it. All knowledge
// of the OpenAI dialect — request translation, response parsing, error
// mapping — lives here.
//
// Chat uses the Responses API, OpenAI's first-class surface, where
// function tools and reasoning work together; requests are stateless
// (`store: false`) since the engine drives its own loop and owns the
// transcript. Image generation uses the Images API, a separate REST
// surface under the same endpoint — shared with the openai-compatible
// adapter (lib/image.js), as it does not depend on the chat dialect. For
// the OpenAI-compatible ecosystem (Groq, Mistral, Ollama, vLLM, …) use
// the `openai-compatible` adapter, which speaks the Chat Completions
// dialect those hosts implement.
//
// The transport is `apos.http`, no SDK. Projects can adjust the dialect
// by extending this module and overriding its methods.

const image = require('./lib/image');

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
            },
            ...image.models
          },
          validate() {
            if (!this.apiKey) {
              throw new Error(`the "${this.provider}" provider requires an apiKey`);
            }
          },
          async chat(req, request) {
            const response = await self.apos.http.post(`${this.baseUrl}/responses`, {
              headers: {
                authorization: `Bearer ${this.apiKey}`
              },
              body: self.buildBody(request),
              timeout: self.options.timeout,
              ...(request.signal && { signal: request.signal })
            });
            return self.parseResponse(response, request);
          },
          // text → image and image(s) + text → image, via the shared
          // Images API; the core resolved `aspect` to a declared 'W:H'
          // and the lib maps it to the size string
          async image(req, request) {
            return image({
              apos: self.apos,
              apiKey: this.apiKey,
              baseUrl: this.baseUrl,
              timeout: self.options.timeout
            }, request);
          },
          normalizeError(error) {
            return self.normalizeError(error);
          }
        };
      },
      // Translate a normalized adapter request (see the engine's
      // buildRequest) to a Responses API body: the system prompt travels
      // as `instructions`, messages become `input` items, tool
      // definitions become flattened function tools, a structured-output
      // `schema` becomes the `json_schema` text format, `maxTokens`
      // becomes `max_output_tokens` (optional here, so an unresolved cap
      // is omitted) and `reasoning` becomes `{ reasoning: { effort } }`,
      // the level verbatim. An assistant turn translates part by part,
      // in order: text parts to assistant message items, tool requests
      // to `function_call` items, and this adapter's own opaque
      // `reasoning` parts replayed as the raw reasoning items they carry
      // — the Responses API requires a reasoning item to precede its
      // `function_call` when function outputs come back, which is why a
      // tools-and-reasoning request also asks for
      // `reasoning.encrypted_content`. Part types this dialect does not
      // own are skipped. A `tool` message (a batch's results) becomes
      // one `function_call_output` item per result. The cache policy
      // places nothing: the provider caches prompt prefixes
      // automatically and the ttl level is not settable in this
      // dialect.
      buildBody(request) {
        const {
          system, messages, model, maxTokens, reasoning, tools, schema
        } = request;
        return {
          model,
          // Stateless: the engine drives its own loop and owns the
          // transcript; no server-side conversation state
          store: false,
          ...(system !== undefined && { instructions: system }),
          input: messages.flatMap(toItems),
          ...(tools && { tools: tools.map(toTool) }),
          // The portable JSON Schema goes as the text format with
          // `strict` off: strict mode would demand an OpenAI-specific
          // schema subset (every object additionalProperties:false,
          // every property required), which the same schema on Anthropic
          // and Google does not — so the model is schema-guided here and
          // the engine's backstop catches a stray.
          ...(schema && {
            text: {
              format: {
                type: 'json_schema',
                name: 'response',
                schema,
                strict: false
              }
            }
          }),
          ...(maxTokens !== undefined && { max_output_tokens: maxTokens }),
          ...(reasoning !== undefined && { reasoning: { effort: reasoning } }),
          // The encrypted reasoning content makes the reasoning items
          // replayable across the loop's stateless turns; without tools
          // there is no loop and nothing to replay
          ...(reasoning !== undefined && tools && {
            include: [ 'reasoning.encrypted_content' ]
          })
        };

        // One normalized message → one or more Responses input items
        function toItems(message) {
          if (message.role === 'tool') {
            return message.content.map((part) => ({
              type: 'function_call_output',
              call_id: part.toolCallId,
              output: part.error !== undefined
                ? part.error
                : JSON.stringify(part.output)
            }));
          }
          if (message.role === 'assistant') {
            return message.content.flatMap(toAssistantItem);
          }
          return [ {
            role: 'user',
            content: message.content.map(toInputPart)
          } ];
        }
        function toAssistantItem(part) {
          if (part.type === 'text') {
            return [ {
              role: 'assistant',
              content: [ {
                type: 'output_text',
                text: part.text
              } ]
            } ];
          }
          if (part.type === 'toolCall') {
            return [ {
              type: 'function_call',
              call_id: part.id,
              name: part.name,
              arguments: JSON.stringify(part.input)
            } ];
          }
          // The raw reasoning item this adapter's parseResponse carried
          // over, replayed verbatim ahead of its function call
          if (part.type === 'reasoning') {
            return [ part.item ];
          }
          // Another dialect's part; not ours to translate
          return [];
        }
        // The model-facing tool definition, flattened in this dialect;
        // the JSON Schema travels verbatim as the parameters, with
        // `strict` off for the same portability reason as the text
        // format above
        function toTool(tool) {
          return {
            type: 'function',
            name: tool.name,
            description: tool.description,
            parameters: tool.input,
            strict: false
          };
        }
        function toInputPart(part) {
          if (part.type === 'text') {
            return {
              type: 'input_text',
              text: part.text
            };
          }
          // part.type === 'image', in one of the two normalized forms
          return {
            type: 'input_image',
            image_url: part.image.url !== undefined
              ? part.image.url
              : `data:${part.image.mediaType};base64,${part.image.data}`
          };
        }
      },
      // Translate a Responses API response to the normalized assistant
      // turn { content, finishReason, usage, model }. The output items
      // translate in order — order matters, because a reasoning item
      // must be replayed ahead of its function call: a message item's
      // `output_text` parts become text parts (a `refusal` part throws
      // the refusal error, so "refused" always arrives as an error),
      // `function_call` items become toolCall parts with their JSON
      // arguments parsed, and a reasoning item carrying
      // `encrypted_content` rides along as this adapter's opaque
      // `reasoning` part (one without it is not replayable and is
      // dropped). The dialect has no finish reason; it is derived: a
      // completed response finishes as 'toolCalls' when it requested
      // tools, else 'stop'; an incomplete one maps its reason
      // (max_output_tokens → 'length', content_filter → 'refusal');
      // anything else maps to no finishReason — the engine's turn
      // validation treats that as a malformed (retryable) response,
      // never a truncated success. When the request asked for structured
      // output, the final answer's text is the JSON object: it is parsed
      // onto the turn's `object`, which the engine
      // backstop-validates; malformed JSON is a retryable response.
      parseResponse(response, request = {}) {
        const content = [];
        for (const item of response.output || []) {
          if (item.type === 'message') {
            for (const part of item.content || []) {
              if (part.type === 'refusal') {
                throw self.apos.error('aiRefusal', part.refusal);
              }
              if (part.type === 'output_text') {
                content.push({
                  type: 'text',
                  text: part.text
                });
              }
            }
          } else if (item.type === 'function_call') {
            content.push({
              type: 'toolCall',
              id: item.call_id,
              name: item.name,
              input: JSON.parse(item.arguments || '{}')
            });
          } else if (item.type === 'reasoning' &&
            item.encrypted_content != null) {
            content.push({
              type: 'reasoning',
              item
            });
          }
        }
        const finishReason = deriveFinishReason();
        const turn = {
          content,
          finishReason,
          usage: {
            inputTokens: response.usage?.input_tokens,
            outputTokens: response.usage?.output_tokens
          },
          model: response.model
        };
        if (request.schema && finishReason === 'stop') {
          const text = content
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('');
          try {
            turn.object = JSON.parse(text);
          } catch (e) {
            throw self.apos.error('aiRetry', 'the model returned malformed structured JSON');
          }
        }
        return turn;

        function deriveFinishReason() {
          if (response.status === 'completed') {
            return content.some((part) => part.type === 'toolCall')
              ? 'toolCalls'
              : 'stop';
          }
          if (response.status === 'incomplete') {
            return {
              max_output_tokens: 'length',
              content_filter: 'refusal'
            }[response.incomplete_details?.reason];
          }
          return undefined;
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
