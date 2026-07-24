// The standard Google (Gemini) adapter for `apos.ai`. It registers
// itself with the AI engine at startup; configure the provider with
// just a key under the engine's `providers.google` entry to use it.
// All knowledge of the Gemini generateContent dialect — request
// translation, response parsing, error mapping — lives here. Image
// generation and editing ride the same surface: an image-capable
// Gemini model returns inline image parts, so one dialect covers
// text and images.
//
// Url-form image parts translate to the dialect's `fileData.fileUri`,
// which the service accepts for its own Files API URIs, not for
// arbitrary web URLs — pass base64 `{ data, mediaType }` parts for
// images the service cannot reach.
//
// The transport is `apos.http`, no SDK. Projects can adjust the dialect
// by extending this module and overriding its methods.

// Gemini forbids a response schema alongside function calling, so
// structured output is delivered through a synthetic tool whose
// parameters are the request's `schema`. The model calls it to
// answer; parseResponse turns that call back into a plain structured
// answer. Its name leads with an underscore, which the engine's
// tool-name rule forbids, so it can never collide with a real tool.
const FINAL_ANSWER = '_final_answer';
const FINAL_ANSWER_DESCRIPTION = 'Provide your final answer by calling this function with the required fields. This is the only way to return your response.';
// The dialect's finish reasons → the normalized vocabulary; the
// whole safety family maps to refusal, which always arrives as an
// error
const FINISH_REASONS = {
  STOP: 'stop',
  MAX_TOKENS: 'length',
  SAFETY: 'refusal',
  RECITATION: 'refusal',
  PROHIBITED_CONTENT: 'refusal',
  BLOCKLIST: 'refusal',
  SPII: 'refusal',
  IMAGE_SAFETY: 'refusal'
};
// The ratio set every current image model takes — what the core's
// nearest-match resolves against
const ASPECTS = [
  '1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'
];
// The normalized quality tiers → the dialect's output resolution
// (the uppercase K is required)
const IMAGE_SIZES = {
  low: '1K',
  medium: '1K',
  high: '2K'
};

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
            },
            'gemini-3.1-flash-image': {
              aspects: ASPECTS
            },
            'gemini-3-pro-image': {
              aspects: ASPECTS
            },
            'gemini-3.1-flash-lite-image': {
              aspects: ASPECTS
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
            return self.parseResponse(response, request);
          },
          // text → image and image(s) + text → image, on the same
          // generateContent surface; the core resolved `aspect` to a
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
                  `${this.baseUrl}/v1beta/models/${request.model}:generateContent`,
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
                self.apos.ai.logError(req, 'imagePartial', error.message, {
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
      // buildRequest) to a generateContent body: the system prompt
      // becomes `systemInstruction`, the assistant role becomes
      // `model`, `maxTokens` and `reasoning` travel in
      // `generationConfig` (as `maxOutputTokens` and the thinking
      // level, verbatim), each omitted when unresolved. A thought
      // signature parseResponse carried on a part is restored at the
      // part level, exactly as received — Gemini requires it back when
      // a function call is replayed. Part types this dialect does not
      // own are skipped. The model is not part of the body — it rides
      // in the request URL. The cache policy places nothing: the
      // provider caches prompt prefixes automatically and the ttl
      // level is not settable per request.
      buildBody(request) {
        const {
          system, messages, maxTokens, reasoning, tools, schema
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
        const functionDeclarations = [
          ...(tools || []).map(toFunctionDeclaration),
          ...(schema
            ? [ {
              name: FINAL_ANSWER,
              description: FINAL_ANSWER_DESCRIPTION,
              parameters: schema
            } ]
            : [])
        ];
        return {
          ...(system !== undefined && {
            systemInstruction: {
              parts: [ { text: system } ]
            }
          }),
          contents: messages.map((message) => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: message.content.map(toPart).filter(Boolean)
          })),
          ...(functionDeclarations.length && {
            tools: [ { functionDeclarations } ]
          }),
          // Force the structured answer only when nothing else needs the
          // turn: a real tool the model must be free to call first, or
          // thinking. Otherwise the description drives it and the
          // engine's backstop retries a miss.
          ...(schema && !(tools && tools.length) && reasoning === undefined && {
            toolConfig: {
              functionCallingConfig: {
                mode: 'ANY',
                allowedFunctionNames: [ FINAL_ANSWER ]
              }
            }
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
          // The thought signature parseResponse carried over, restored
          // at the part level exactly as the service sent it
          const signature = part.thoughtSignature !== undefined &&
            { thoughtSignature: part.thoughtSignature };
          if (part.type === 'text') {
            return {
              text: part.text,
              ...signature
            };
          }
          if (part.type === 'toolCall') {
            return {
              functionCall: {
                name: part.name,
                args: part.input
              },
              ...signature
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
          if (part.type === 'image') {
            // In one of the two normalized forms
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
          // Another dialect's part; not ours to translate
          return null;
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
      // (buildBody recovers the tool name from it). When the request
      // asked for structured output and the model called the synthetic
      // final-answer function, that call is the answer, not a function
      // for the core to run: it becomes a `stop` turn carrying the
      // arguments on `object` (and their JSON in the text, so the
      // transcript round-trips). Anything else — free text, a real
      // function call — parses normally, leaving no `object` for the
      // engine backstop to retry on. Thought summary parts are not
      // conversation content and do not travel, but a part-level
      // thought signature does: it rides the normalized part, and
      // buildBody must send it back exactly as received when the part
      // is replayed. Thinking tokens are billed as output, so they add
      // into outputTokens. An unknown finish reason maps to no
      // finishReason — the engine's turn validation treats that as a
      // malformed (retryable) response, never a truncated success.
      parseResponse(response, request = {}) {
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
        const usageTokens = self.normalizeUsage(response);
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
              usage: usageTokens,
              model: response.modelVersion
            };
          }
        }
        return {
          content,
          finishReason: content.some((part) => part.type === 'toolCall')
            ? 'toolCalls'
            : FINISH_REASONS[candidate?.finishReason],
          usage: usageTokens,
          model: response.modelVersion
        };

        function fromPart(part) {
          // Gemini attaches a thought signature at the part level and
          // requires it back, exactly as received, when the part is
          // replayed — it rides the normalized part for buildBody to
          // restore
          const signature = part.thoughtSignature !== undefined &&
            { thoughtSignature: part.thoughtSignature };
          if (typeof part.text === 'string') {
            return {
              type: 'text',
              text: part.text,
              ...signature
            };
          }
          if (part.functionCall) {
            return {
              type: 'toolCall',
              id: `${part.functionCall.name}-${callIndex++}`,
              name: part.functionCall.name,
              input: part.functionCall.args || {},
              ...signature
            };
          }
          return null;
        }
      },
      // Translate a normalized image request { prompt, aspect,
      // quality, images? } to a generateContent body: one user turn,
      // the prompt first and any edit sources after it. The dials ride
      // `generationConfig.imageConfig` — the resolved aspect verbatim
      // as `aspectRatio`, quality as the `imageSize` resolution — each
      // omitted when unset, so the provider default applies. An
      // image-capable model wants TEXT beside IMAGE in
      // `responseModalities`.
      async buildImageBody(request, baseUrl) {
        const imageConfig = {
          ...(request.aspect !== undefined && { aspectRatio: request.aspect }),
          ...(request.quality !== undefined && {
            imageSize: IMAGE_SIZES[request.quality]
          })
        };
        const sources = request.images
          ? await self.resolveImageSources(request.images, baseUrl, request.signal)
          : [];
        return {
          contents: [ {
            role: 'user',
            parts: [
              { text: request.prompt },
              ...sources
            ]
          } ],
          generationConfig: {
            responseModalities: [ 'TEXT', 'IMAGE' ],
            ...(Object.keys(imageConfig).length && { imageConfig })
          }
        };
      },
      // The normalized source refs → the parts an edit sends. Inline
      // data travels as `inlineData`; a url on the service's own
      // endpoint (a Files API upload) passes through as `fileData`;
      // any other url is fetched and inlined, since the service does
      // not load arbitrary web URLs (built-in fetch — apos.http reads
      // text only). A source that will not load is a caller error, not
      // a provider one — a hard stop, no retry.
      resolveImageSources(images, baseUrl, signal) {
        return Promise.all(images.map(async (source) => {
          if (source.data !== undefined) {
            return {
              inlineData: {
                mimeType: source.mediaType,
                data: source.data
              }
            };
          }
          if (source.url.startsWith(baseUrl)) {
            return {
              fileData: { fileUri: source.url }
            };
          }
          const response = await fetch(source.url, {
            ...(signal && { signal })
          });
          if (!response.ok) {
            throw self.apos.error('invalid', `could not fetch image source "${source.url}": HTTP ${response.status}`);
          }
          return {
            inlineData: {
              mimeType: response.headers.get('content-type') || 'application/octet-stream',
              data: Buffer.from(await response.arrayBuffer()).toString('base64')
            }
          };
        }));
      },
      // Translate the fanned-out generateContent responses to the
      // normalized image result { images, model, usage }: the inline
      // image parts across all responses and candidates, each typed by
      // its mime subtype; commentary text parts are not images and do
      // not travel. Refusals — a blocked prompt, a safety-family
      // finish — throw only when NOTHING was produced: anything that
      // survived is delivered. Token usage sums across the requests.
      // No pixel `size`: this dialect works in ratios, which the core
      // echoes as `aspect`.
      parseImageResponses(responses) {
        const candidates = responses.flatMap(
          (response) => response.candidates || []
        );
        const images = candidates.flatMap((candidate) =>
          (candidate.content?.parts || [])
            .filter((part) => part.inlineData)
            .map((part) => ({
              type: (part.inlineData.mimeType || 'image/png').replace('image/', ''),
              data: part.inlineData.data
            }))
        );
        if (!images.length) {
          const blocked = responses.find(
            (response) => response.promptFeedback?.blockReason
          );
          if (blocked) {
            throw self.apos.error('aiRefusal', `the model blocked this request: ${blocked.promptFeedback.blockReason}`);
          }
          const refusal = candidates.find(
            (candidate) => FINISH_REASONS[candidate.finishReason] === 'refusal'
          );
          if (refusal) {
            throw self.apos.error('aiRefusal', `the model blocked this request: ${refusal.finishReason}`);
          }
        }
        const usages = responses.map((response) => self.normalizeUsage(response));
        return {
          images,
          model: responses[0]?.modelVersion,
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
      // The response's usageMetadata → normalized token counts;
      // thinking tokens are billed as output, so they add into
      // outputTokens
      normalizeUsage(response) {
        const usage = response.usageMetadata;
        return {
          inputTokens: usage?.promptTokenCount,
          outputTokens: usage?.candidatesTokenCount === undefined
            ? undefined
            : usage.candidatesTokenCount + (usage.thoughtsTokenCount || 0)
        };
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
