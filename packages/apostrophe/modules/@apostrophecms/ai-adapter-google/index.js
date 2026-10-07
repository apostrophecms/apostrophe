// The standard Google (Gemini) adapter for `apos.ai`. It registers
// itself with the AI engine at startup; configure the provider with
// just a key under the engine's `providers.google` entry to use it.
// All knowledge of the Gemini Interactions dialect — request
// translation, response parsing, error mapping — lives here.
//
// Requests are stateless (`store: false`, no `previous_interaction_id`)
// since the engine drives its own loop and owns the transcript. Image
// generation and editing ride the same surface: an image-capable
// Gemini model returns inline images in its output, so one dialect
// covers text and images.
//
// Url-form image parts translate to the dialect's `uri`, which the
// service accepts for its own Files API URIs, not for arbitrary web
// URLs — pass base64 `{ data, mediaType }` parts for images the
// service cannot reach.
//
// The transport is `apos.http`, no SDK. Projects can adjust the dialect
// by extending this module and overriding its methods.

// The Interactions API version the adapter speaks: the stable surface
const API_VERSION = 'v1';
// The ratio sets the image models take — what the core's nearest-match
// resolves against; the Flash models add the extreme banner ratios
const ASPECTS = Object.freeze([
  '1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'
]);
const FLASH_ASPECTS = Object.freeze([
  ...ASPECTS, '1:4', '4:1', '1:8', '8:1'
]);
// The `thinking_level` values a text model accepts; Gemini 3.8 Flash
// refuses `minimal`
const THINKING_LEVELS = Object.freeze([
  'minimal', 'low', 'medium', 'high'
]);
const FLASH_THINKING_LEVELS = Object.freeze([
  'low', 'medium', 'high'
]);
// The normalized quality tiers → the dialect's output resolution
// (the uppercase K is required)
const IMAGE_SIZES = {
  low: '1K',
  medium: '1K',
  high: '2K'
};
// The image models that refuse any resolution but 1K
const ONE_K_IMAGE_MODELS = Object.freeze([
  'gemini-3.1-flash-lite-image'
]);
// The thought signature Gemini accepts for a trace another model
// produced
const FOREIGN_THOUGHT_SIGNATURE = 'skip_thought_signature_validator';
// The documented error codes for a generation the service blocked
const BLOCKED_CODES = Object.freeze([
  'safety', 'recitation', 'language', 'prohibited_content', 'spii',
  'blocklist', 'image_safety', 'image_prohibited_content',
  'image_recitation', 'image_other', 'content_blocked'
]);
// The documented error codes for a generation that went wrong in a way
// a new attempt may not repeat
const GENERATION_ERROR_CODES = Object.freeze([
  'malformed_function_call', 'malformed_tool_call', 'unexpected_tool_call',
  'too_many_tool_calls', 'no_image'
]);

module.exports = {
  options: {
    // Per-request timeout in milliseconds; a timed-out call is a
    // transient failure the engine retries
    timeout: 600000,
    // Milliseconds between the starts of the fanned-out image
    // requests a count > 1 spawns, jittered per request, so a burst
    // does not trip the provider's rate limit
    imageStagger: 500
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
            low: { model: 'gemini-3.5-flash-lite' },
            medium: { model: 'gemini-3.8-flash' },
            high: {
              model: 'gemini-3.8-flash',
              reasoning: 'high'
            }
          },
          // `reasoning` is the dialect's `thinking_level` vocabulary
          models: {
            'gemini-3.5-flash-lite': {
              label: 'Gemini 3.5 Flash-Lite',
              contextWindow: 1048576,
              maxOutputTokens: 65536,
              reasoning: THINKING_LEVELS
            },
            'gemini-3.8-flash': {
              label: 'Gemini 3.8 Flash',
              contextWindow: 1048576,
              maxOutputTokens: 65536,
              reasoning: FLASH_THINKING_LEVELS
            },
            'gemini-3.1-flash-image': {
              label: 'Gemini 3.1 Flash Image',
              aspects: FLASH_ASPECTS
            },
            'gemini-3-pro-image': {
              label: 'Gemini 3 Pro Image',
              aspects: ASPECTS
            },
            'gemini-3.1-flash-lite-image': {
              label: 'Gemini 3.1 Flash-Lite Image',
              aspects: FLASH_ASPECTS
            }
          },
          validate() {
            self.apos.ai.requireApiKey(this);
          },
          async chat(req, request) {
            const response = await self.apos.http.post(
              `${this.baseUrl}/${API_VERSION}/interactions`,
              {
                headers: {
                  'x-goog-api-key': this.apiKey
                },
                body: self.buildBody(request),
                timeout: self.options.timeout,
                ...(request.signal && { signal: request.signal })
              }
            );
            return self.parseResponse(response, request);
          },
          // text → image and image(s) + text → image, on the same
          // Interactions surface; the core resolved `aspect` to a
          // declared ratio the dialect takes verbatim. The dialect
          // returns one image per call — no count knob — so `count`
          // fans out as that many concurrent requests, their starts
          // staggered with jitter (imageStagger) so the burst does
          // not trip the rate limit. A partial failure does not scrap
          // the survivors: what generated is delivered (possibly
          // fewer than `count`) and each lost request is logged; only
          // losing every request throws.
          async image(req, request) {
            const body = await self.buildImageBody(request, this.baseUrl);
            const settled = await Promise.allSettled(
              Array.from({ length: request.count }, async (item, index) => {
                if (index) {
                  await self.apos.ai.pause(
                    (index + Math.random()) * self.options.imageStagger
                  );
                }
                return self.apos.http.post(
                  `${this.baseUrl}/${API_VERSION}/interactions`,
                  {
                    headers: {
                      'x-goog-api-key': this.apiKey
                    },
                    body,
                    timeout: self.options.timeout,
                    ...(request.signal && { signal: request.signal })
                  }
                );
              })
            );
            const responses = settled
              .filter((outcome) => outcome.status === 'fulfilled')
              .map((outcome) => outcome.value);
            if (!responses.length) {
              throw settled[0].reason;
            }
            for (const outcome of settled) {
              if (outcome.status === 'rejected') {
                const error = self.normalizeError(outcome.reason);
                self.apos.ai.logError(req, 'image-partial', error.message, {
                  provider: this.provider,
                  model: request.model,
                  code: error.name,
                  status: error.data?.status,
                  kind: error.data?.kind,
                  requested: request.count,
                  delivered: responses.length
                });
              }
            }
            return self.parseImageResponses(responses);
          },
          normalizeError(error) {
            return self.normalizeError(error);
          }
        };
      },
      // Translate a normalized adapter request (see the engine's
      // buildRequest) to an Interactions body. Stateless: `input`
      // replays the whole transcript as steps on every call. The
      // system prompt travels as `system_instruction`, tool definitions
      // become function tools, a structured-output `schema` becomes the
      // JSON text `response_format` (which composes with function
      // tools), and `maxTokens` and `reasoning` ride
      // `generation_config` (as `max_output_tokens` and the thinking
      // level, verbatim), each omitted when unresolved. A user message
      // becomes a `user_input` step. An assistant turn translates part
      // by part, in order: this adapter's own opaque `thought` parts
      // back to the `thought` steps they came from — Gemini requires
      // every one resent exactly as received — each tool request to a
      // `function_call` step, and each run of text and image parts to
      // one `model_output` step. A message with tool requests and no
      // thought part opens with a placeholder thought step. A `tool`
      // message (a batch's results) becomes one `function_result` step
      // per result. Part types this dialect does not own are skipped.
      // The cache policy places nothing: the provider caches prompt
      // prefixes automatically and the ttl level is not settable per
      // request.
      buildBody(request) {
        const {
          system, messages, model, maxTokens, reasoning, tools, schema
        } = request;
        const generationConfig = {
          ...(maxTokens !== undefined && { max_output_tokens: maxTokens }),
          ...(reasoning !== undefined && { thinking_level: reasoning })
        };
        // The service refuses a function result that does not name its
        // function, which the normalized result does not carry: recover
        // it from the call the result answers
        const toolNamesById = new Map();
        for (const message of messages) {
          for (const part of message.content) {
            if (part.type === 'toolCall') {
              toolNamesById.set(part.id, part.name);
            }
          }
        }
        return {
          model,
          // Stateless: the engine drives its own loop and owns the
          // transcript; the service stores interactions unless told not
          // to
          store: false,
          ...(system !== undefined && { system_instruction: system }),
          input: messages.flatMap(toSteps),
          ...(tools && { tools: tools.map(toTool) }),
          ...(schema && {
            response_format: {
              type: 'text',
              mime_type: 'application/json',
              schema
            }
          }),
          ...(Object.keys(generationConfig).length && {
            generation_config: generationConfig
          })
        };

        // One normalized message → its Interactions steps
        function toSteps(message) {
          if (message.role === 'tool') {
            return message.content.map((part) => ({
              type: 'function_result',
              call_id: part.toolCallId,
              name: toolNamesById.get(part.toolCallId),
              ...(part.error !== undefined
                ? {
                  result: { error: part.error },
                  is_error: true
                }
                : { result: part.output })
            }));
          }
          if (message.role === 'assistant') {
            return toAssistantSteps(message.content);
          }
          return [ {
            type: 'user_input',
            content: message.content.map(toContent)
          } ];
        }
        function toAssistantSteps(content) {
          const steps = [];
          // The service refuses a function call no thought step
          // precedes, as in a transcript another model produced, and a
          // turn holding a thought step must open with one: Gemini's
          // documented dummy signature leads such a message, one for
          // all its calls
          if (
            content.some((part) => part.type === 'toolCall') &&
            !content.some((part) => part.type === 'thought')
          ) {
            steps.push({
              type: 'thought',
              signature: FOREIGN_THOUGHT_SIGNATURE
            });
          }
          for (const part of content) {
            if (part.type === 'thought') {
              // The thought step this adapter's parseResponse carried
              // over, replayed verbatim in its place
              steps.push({
                type: 'thought',
                signature: part.signature,
                ...(part.summary !== undefined && { summary: part.summary })
              });
            } else if (part.type === 'toolCall') {
              steps.push({
                type: 'function_call',
                id: part.id,
                name: part.name,
                arguments: part.input
              });
            } else if (part.type === 'text' || part.type === 'image') {
              const last = steps.at(-1);
              if (last?.type === 'model_output') {
                last.content.push(toContent(part));
              } else {
                steps.push({
                  type: 'model_output',
                  content: [ toContent(part) ]
                });
              }
            }
            // Anything else is another dialect's part; not ours to
            // translate
          }
          return steps;
        }
        function toContent(part) {
          if (part.type === 'text') {
            return {
              type: 'text',
              text: part.text
            };
          }
          // part.type === 'image', in one of the two normalized forms
          return part.image.url !== undefined
            ? {
              type: 'image',
              uri: part.image.url
            }
            : {
              type: 'image',
              data: part.image.data,
              mime_type: part.image.mediaType
            };
        }
        // The model-facing tool definition; the JSON Schema travels
        // verbatim as the parameters
        function toTool(tool) {
          return {
            type: 'function',
            name: tool.name,
            description: tool.description,
            parameters: tool.input
          };
        }
      },
      // Translate an Interactions response to the normalized assistant
      // turn { content, finishReason, usage, model }. The steps
      // translate in order — order matters, because buildBody replays
      // them in place: a `thought` step rides along as this adapter's
      // opaque `thought` part (its signature, and its summary when the
      // service sent one), a `function_call` step becomes a toolCall
      // part under the service's own call id, and a `model_output`
      // step's text blocks become text parts. A `failed` interaction
      // throws what its `errors` say: a refusal when any of them is a
      // block, the broken-transcript error when one rejects a thought
      // signature, otherwise a transient failure. Past that, a turn
      // that requested tools finishes as 'toolCalls' whatever its status;
      // otherwise `completed` maps to 'stop' and `incomplete` (the
      // output cap, thinking included) to 'length'. Any other status
      // maps to no finishReason — the engine's turn validation treats
      // that as a malformed (retryable) response, never a truncated
      // success.
      // When the request asked for structured output, the final
      // answer's text is the JSON object: it is parsed onto the turn's
      // `object`, which the engine backstop-validates; malformed JSON
      // is a retryable response.
      parseResponse(response, request = {}) {
        if (response.status === 'failed') {
          throw self.apos.error(...classifyFailure(response));
        }
        const content = (response.steps || []).flatMap(fromStep);
        const finishReason = content.some((part) => part.type === 'toolCall')
          ? 'toolCalls'
          : {
            completed: 'stop',
            incomplete: 'length'
          }[response.status];
        const turn = {
          content,
          finishReason,
          usage: self.normalizeUsage(response),
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

        function fromStep(step) {
          if (step.type === 'thought') {
            return [ {
              type: 'thought',
              signature: step.signature,
              ...(step.summary !== undefined && { summary: step.summary })
            } ];
          }
          if (step.type === 'function_call') {
            // The step's own copy of the preceding thought signature
            // stays behind: the thought part carries it, and the
            // service accepts the call without it
            return [ {
              type: 'toolCall',
              id: step.id,
              name: step.name,
              input: step.arguments || {}
            } ];
          }
          if (step.type === 'model_output') {
            return (step.content || [])
              .filter((block) => block.type === 'text')
              .map((block) => ({
                type: 'text',
                text: block.text
              }));
          }
          return [];
        }
      },
      // Translate a normalized image request { prompt, aspect,
      // quality, images?, model } to a stateless Interactions body: one
      // `user_input` step, the prompt first and any edit sources after
      // it. The image `response_format` asks for an image and carries
      // the dials — the resolved aspect verbatim as `aspect_ratio`,
      // quality as the `image_size` resolution (1K on a model that
      // takes nothing else) — each omitted when unset, so the provider
      // default applies. Images come back inline by default; the
      // stable API rejects the `delivery` field that would say so.
      async buildImageBody(request, baseUrl) {
        const sources = request.images
          ? await self.resolveImageSources(request.images, baseUrl, request.signal)
          : [];
        return {
          model: request.model,
          store: false,
          input: [ {
            type: 'user_input',
            content: [
              {
                type: 'text',
                text: request.prompt
              },
              ...sources
            ]
          } ],
          response_format: {
            type: 'image',
            ...(request.aspect !== undefined && { aspect_ratio: request.aspect }),
            ...(request.quality !== undefined && {
              image_size: ONE_K_IMAGE_MODELS.includes(request.model)
                ? '1K'
                : IMAGE_SIZES[request.quality]
            })
          }
        };
      },
      // The normalized source refs → the image content an edit sends.
      // Inline data travels as `data`; a url on the service's own
      // endpoint (a Files API upload) passes through as `uri`; any
      // other url is fetched and inlined, since the service does not
      // load arbitrary web URLs (built-in fetch — apos.http reads text
      // only). A source that will not load is a caller error, not a
      // provider one — a hard stop, no retry.
      resolveImageSources(images, baseUrl, signal) {
        return Promise.all(images.map(async (source) => {
          if (source.data !== undefined) {
            return {
              type: 'image',
              data: source.data,
              mime_type: source.mediaType
            };
          }
          if (source.url.startsWith(baseUrl)) {
            return {
              type: 'image',
              uri: source.url
            };
          }
          const response = await fetch(source.url, {
            ...(signal && { signal })
          });
          if (!response.ok) {
            throw self.apos.error('invalid', `could not fetch image source "${source.url}": HTTP ${response.status}`);
          }
          return {
            type: 'image',
            data: Buffer.from(await response.arrayBuffer()).toString('base64'),
            mime_type: response.headers.get('content-type') || 'application/octet-stream'
          };
        }));
      },
      // Translate the fanned-out Interactions responses to the
      // normalized image result { images, model, usage }: the inline
      // images of every response's `model_output` steps, each typed by
      // its mime subtype. The `thought` steps hold the model's interim
      // drafts, not results, and commentary text is not an image;
      // neither travels. A `failed` interaction throws what its errors
      // say only when NOTHING was produced: anything that survived is
      // delivered. Token usage sums across the requests. No pixel
      // `size`: this dialect works in ratios, which the core echoes as
      // `aspect`.
      parseImageResponses(responses) {
        const images = responses.flatMap((response) =>
          (response.steps || [])
            .filter((step) => step.type === 'model_output')
            .flatMap((step) => step.content || [])
            .filter((block) => block.type === 'image' && block.data)
            .map((block) => ({
              type: (block.mime_type || 'image/png').replace('image/', ''),
              data: block.data
            }))
        );
        if (!images.length) {
          const failed = responses.find(
            (response) => response.status === 'failed'
          );
          if (failed) {
            throw self.apos.error(...classifyFailure(failed));
          }
        }
        const usages = responses.map((response) => self.normalizeUsage(response));
        return {
          images,
          model: responses[0]?.model,
          usage: {
            inputTokens: total(usages.map((usage) => usage.inputTokens)),
            outputTokens: total(usages.map((usage) => usage.outputTokens))
          }
        };

        function total(values) {
          const defined = values.filter((value) => value !== undefined);
          return defined.length
            ? defined.reduce((sum, value) => sum + value, 0)
            : undefined;
        }
      },
      // The response's usage → normalized token counts; thinking
      // tokens are billed as output, so they add into outputTokens.
      // total_input_tokens already counts the cached share reported
      // beside it; the service reports no cache writes
      normalizeUsage(response) {
        const usage = response.usage;
        const read = usage?.total_cached_tokens;
        return {
          inputTokens: usage?.total_input_tokens,
          outputTokens: usage?.total_output_tokens === undefined
            ? undefined
            : usage.total_output_tokens + (usage.total_thought_tokens || 0),
          ...(Number.isFinite(read) && { cacheReadTokens: read })
        };
      },
      // Map any error the transport produced to a normalized apos
      // error, the only shape the engine reacts to. A blocked
      // generation is a refusal, a generation error a transient
      // failure and a rejected thought signature a broken transcript;
      // everything else takes the engine's shared status ladder. The
      // API gateway in front of the service answers an auth failure in
      // an older error shape, wrapped in an array. No request id header
      // exists on this API.
      normalizeError(error) {
        const body = Array.isArray(error?.body) ? error.body[0] : error?.body;
        const classified = classifyError(body?.error);
        if (classified) {
          return self.apos.error(classified[0], classified[1], {
            status: error.status
          });
        }
        return self.apos.ai.normalizeHttpError(body === error?.body
          ? error
          : {
            ...error,
            message: error.message,
            body
          });
      }
    };
  }
};

// A `failed` interaction → the apos error code and message it throws
// as: a refusal when any of its errors is a block, else the first
// error that classifies, else a transient failure
function classifyFailure(response) {
  const errors = response.errors || [];
  const classified = errors.map(classifyError).filter(Boolean);
  return classified.find(([ name ]) => name === 'aiRefusal') ||
    classified[0] ||
    [ 'aiRetry', errors[0]?.message || 'the interaction failed' ];
}

// A Gemini error { code, message } → the apos error code and message
// it travels as, or undefined when nothing marks it. The live service
// reports blocks and rejected thought signatures as a generic
// `invalid_request` told apart only by its message, so the message is
// matched beside the documented codes.
function classifyError({ code, message } = {}) {
  if (
    BLOCKED_CODES.includes(code) ||
    (code === 'invalid_request' && message?.startsWith('Request blocked due to'))
  ) {
    return [ 'aiRefusal', message || 'the model refused this request' ];
  }
  if (
    code === 'missing_thought_signature' ||
    (code === 'invalid_request' && /thought signature/i.test(message))
  ) {
    const reason = (message || code).replace(/\.$/, '');
    return [
      'invalid',
      `Gemini rejected the replayed conversation: ${reason}. Gemini transcripts must be replayed exactly as returned, "thought" parts unmodified; a transcript edited by hand or recorded by an earlier version of this adapter may not replay.`
    ];
  }
  if (GENERATION_ERROR_CODES.includes(code)) {
    return [ 'aiRetry', message || code ];
  }
}
