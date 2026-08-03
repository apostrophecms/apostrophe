// The engine's normalized protocol as JSDoc typedefs: the shapes that travel
// between the caller, the core and the adapters. Together they are what an
// adapter author must implement.
//
// No runtime code. The empty export is required all the same: a CommonJS file
// with no import or export is a *script* to the TypeScript language service,
// which would leak these typedefs globally and misresolve the
// `import('./lib/types.js')` references.

/**
 * Token counts for one call, aggregated across every model turn.
 *
 * @typedef {object} AiUsage
 * @property {number} inputTokens
 * @property {number} outputTokens
 */

/**
 * Text in a message. Valid in user and assistant messages.
 *
 * @typedef {object} AiTextPart
 * @property {'text'} type
 * @property {string} text
 */

/**
 * An image the core hands a provider: a public url the adapter fetches
 * server-side, or inline base64 data with its media type. Vetting and
 * authorizing a user-supplied url is the caller's job before it reaches this
 * surface.
 *
 * @typedef {{ url: string }|{ data: string, mediaType: string }} AiImageSource
 */

/**
 * An image in a message. Valid in user and assistant messages.
 *
 * @typedef {object} AiImagePart
 * @property {'image'} type
 * @property {AiImageSource} image
 */

/**
 * A tool the model asked to run. Valid in assistant messages only.
 *
 * @typedef {object} AiToolCallPart
 * @property {'toolCall'} type
 * @property {string} id The provider's id for this call; a toolResult answers
 *   it by id.
 * @property {string} name The registered tool name.
 * @property {object} input The model's arguments, validated against the tool's
 *   `input` schema before any handler sees them.
 */

/**
 * The answer to one tool call, carrying `output` or `error`, never both. Valid
 * in tool messages only.
 *
 * @typedef {object} AiToolResultPart
 * @property {'toolResult'} type
 * @property {string} toolCallId
 * @property {object} [output] The handler's result, converted through the
 *   tool's schema.
 * @property {string} [error] A recoverable failure, in the words the model
 *   reads back.
 */

/**
 * @typedef {AiTextPart|AiImagePart|AiToolCallPart|AiToolResultPart} AiContentPart
 */

/**
 * One turn of a conversation. Each part type is valid in specific roles only,
 * so a returned transcript round-trips as the next call's `messages` and a
 * hand-built one fails clearly.
 *
 * @typedef {object} AiMessage
 * @property {'user'|'assistant'|'tool'} role
 * @property {AiContentPart[]} content
 */

/**
 * A registered tool in its activated form, as getTool returns it. Treat it as
 * read-only: the registry is frozen at activation and hands out the objects it
 * holds, not copies.
 *
 * @typedef {object} AiToolDefinition
 * @property {string} name
 * @property {string} label Human-facing; never sent to the model.
 * @property {string} description What the model chooses the tool by.
 * @property {string[]} tags
 * @property {object} input The JSON Schema the model's arguments must satisfy.
 * @property {(args: object) => boolean} validateArgs The compiled `input`
 *   validator.
 * @property {object} [schema] The result's JSON Schema, as registered.
 *   Internal — never sent to the model.
 * @property {(result: object) => boolean} [validateResult] The compiled
 *   `schema` validator; absent when the tool declares no result schema.
 * @property {'read'|'write'|'agent'} access
 * @property {(req: object, args: object) => Promise<object>} handler
 */

/**
 * The model-facing face of a tool, as placed on an adapter request: handlers
 * and result schemas never reach a provider.
 *
 * @typedef {object} AiWireTool
 * @property {string} name
 * @property {string} description
 * @property {object} input
 */

/**
 * One normalized chat request, as an adapter receives it. Optional fields are
 * present only when they resolved to a value, so an unset dial leaves the
 * provider's own default in place.
 *
 * @typedef {object} AiAdapterRequest
 * @property {string} [system]
 * @property {AiMessage[]} messages
 * @property {AiWireTool[]} [tools]
 * @property {object} [schema] JSON Schema for structured output, for the
 *   adapter to place on its provider's native structured mode.
 * @property {string} model
 * @property {number} [maxTokens]
 * @property {string} [reasoning]
 * @property {false|{ ttl: 'short'|'long' }} cache The prompt-cache policy, for
 *   the adapter to translate.
 * @property {AbortSignal} [signal]
 */

/**
 * One normalized image request, as an adapter receives it. `images` is what
 * makes the call an edit, `prompt` being the instruction then. `aspect` is
 * already resolved against the model's declared ratios and is always 'W:H',
 * never a named token.
 *
 * @typedef {object} AiImageRequest
 * @property {string} prompt
 * @property {number} count
 * @property {string} [aspect]
 * @property {'low'|'medium'|'high'} [quality]
 * @property {AiImageSource[]} [images]
 * @property {string} model
 * @property {AbortSignal} [signal]
 */

/**
 * One assistant turn as an adapter returns it. A missing or unknown
 * finishReason, or malformed content or usage, is treated as a truncated
 * response and retried rather than returned as a short success.
 *
 * @typedef {object} AiTurn
 * @property {AiContentPart[]} content
 * @property {'stop'|'toolCalls'|'length'|'refusal'} finishReason
 * @property {AiUsage} usage
 * @property {string} [model] What actually answered, when the provider reports
 *   it.
 * @property {object} [object] The structured answer, which only the adapter
 *   knows where to find in its provider's response.
 */

/**
 * One generated image: base64 `data` and the format it is in.
 *
 * @typedef {object} AiGeneratedImage
 * @property {string} type
 * @property {string} data
 */

/**
 * One image call's result as an adapter returns it.
 *
 * @typedef {object} AiImageBatch
 * @property {AiGeneratedImage[]} images
 * @property {string} [model]
 * @property {AiUsage} [usage]
 * @property {string} [size] The native pixel size, when the provider works in
 *   pixels.
 */

/**
 * What generateImage resolves with. Everything but the images themselves is
 * said once on the envelope: providers bill the batch, not the image.
 *
 * @typedef {object} AiImageResult
 * @property {AiGeneratedImage[]} images
 * @property {string} provider
 * @property {string} model
 * @property {AiUsage} [usage]
 * @property {string} [aspect] The resolved native ratio, when a dial ran.
 * @property {string} [size]
 */

/**
 * One executed tool call and its outcome, carrying `result` or `error`.
 *
 * @typedef {object} AiStep
 * @property {AiToolCallPart} toolCall
 * @property {object} [result]
 * @property {string} [error] A recoverable failure, in the words the model was
 *   told it.
 */

/**
 * What generate resolves with. Which fields are populated is what tells the
 * caller what happened.
 *
 * @typedef {object} AiResult
 * @property {string} text The final assistant text; may be ''.
 * @property {object} [object] The validated structured output, when the call
 *   passed a `schema` and finished 'stop'.
 * @property {AiMessage[]} messages The full transcript — tool requests and
 *   results included — resumable as the next call's `messages`.
 * @property {AiStep[]} [steps] What the loop executed, in model order; present
 *   when the call carried tools.
 * @property {AiToolCallPart[]} [toolCalls] Unexecuted requests the caller must
 *   run itself.
 * @property {'stop'|'length'|'cancel'|'maxSteps'} finishReason 'maxSteps'
 *   whenever the step budget cut the loop, the step budget's counterpart of
 *   'length'.
 * @property {AiUsage} usage
 * @property {string} model What actually answered.
 * @property {string} provider
 */

/**
 * What a provider declares about one model: the adapter's table and the
 * provider entry's, merged, the entry winning.
 *
 * @typedef {object} AiModelMeta
 * @property {number} [contextWindow]
 * @property {number} [maxOutputTokens]
 * @property {string[]} [aspects] The image ratios the model supports, as 'W:H'.
 */

/**
 * What modelInfo reports for a call's routing options.
 *
 * @typedef {object} AiModelInfo
 * @property {string} provider
 * @property {string} model
 * @property {string} [reasoning]
 * @property {number|undefined} contextWindow Undefined for an unknown model,
 * which is not an error — the call would still work.
 * @property {number|undefined} maxOutputTokens
 * @property {Object<string, boolean>} capabilities
 * @property {string[]} [aspects] Present for an image resolution.
 */

/**
 * A provider adapter: the translation between the normalized protocol above and
 * one service's dialect. Registered with addAdapter and instantiated per
 * provider entry at startup, with `provider`, `apiKey` and `baseUrl` filled in
 * from the entry.
 *
 * @typedef {object} AiAdapter
 * @property {string} name The registry name. A provider entry names it with
 *   `adapter`, or shares its own key with it.
 * @property {string} [envKey] The environment variable the key is read from
 *   unless the entry names its own.
 * @property {string} [baseUrl]
 * @property {Object<string, boolean>} capabilities What the service offers:
 *   'text', 'tools', 'structured', 'image'. A call needing one the routed
 *   provider lacks is a clear error, never a silent re-route.
 * @property {Object<string, AiModelMeta>} models
 * @property {Object<string, { model: string, reasoning?: string }>} effort The
 *   adapter's native routing rows, one per effort level. They do not apply to
 *   an aliased entry, which describes a different service.
 * @property {() => Promise<void>|void} validate Fail startup on a configuration
 *   this adapter cannot work with, a missing key above all. Required.
 * @property {(req: object, request: AiAdapterRequest) => Promise<AiTurn>} [chat]
 * @property {(req: object, request: AiImageRequest) => Promise<AiImageBatch>} [image]
 * @property {(error: Error) => Error} normalizeError Map a provider or client
 *   failure onto an apos error code — the core reacts on codes alone, and only
 *   the transient one is retried. Hints may ride on `error.data`
 *   (`status`, `kind`, `retryAfter` in seconds, `requestId`); they are
 *   log-bound, so never put keys, credentials or personal data there.
 */

module.exports = {};
