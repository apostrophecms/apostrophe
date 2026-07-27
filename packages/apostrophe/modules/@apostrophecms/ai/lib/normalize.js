// The caller-input boundary: what a developer passed to apos.ai.* is
// parsed and validated here, throwing "invalid" before any provider is
// touched.

const {
  QUALITIES, CACHE_POLICIES, MESSAGE_ROLES, PART_ROLES,
  GENERATE_OPTIONS, IMAGE_OPTIONS
} = require('./constants');
const { isObject } = require('./util');

module.exports = (self) => {
  function invalid(message) {
    throw self.apos.error('invalid', message);
  }

  return {
    // Parse and validate generate's `(stringOrOptions, options)`
    // arguments, exactly as passed to it, into one canonical options
    // object `{ system, messages, tools, maxSteps, schema,
    // validateObject, effort, provider, model, reasoning, maxTokens,
    // cache, signal, onMessage }` — the positional prompt string appended to
    // `messages` as the final user turn, message content collapsed to
    // content-part form, `tools` names resolved to their activated
    // definitions, `maxSteps` defaulted from the module option, a
    // structured-output `schema` validated as a JSON Schema and
    // compiled into the `validateObject` backstop, `cache` defaulted
    // to 'short', unset options left undefined. Unknown options are
    // rejected as "invalid".
    normalizeGenerateOptions(stringOrOptions, options) {
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
      for (const name of Object.keys(options)) {
        if (!GENERATE_OPTIONS.includes(name)) {
          invalid(`unknown option "${name}"`);
        }
      }
      const {
        system, effort, provider, model, reasoning,
        maxTokens, cache = 'short', signal, onMessage
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
      if (cache !== false && !CACHE_POLICIES.includes(cache)) {
        invalid('"cache" must be false, "short" or "long"');
      }
      if (signal !== undefined && !(signal instanceof AbortSignal)) {
        invalid('"signal" must be an AbortSignal');
      }
      if (onMessage !== undefined && typeof onMessage !== 'function') {
        invalid('"onMessage" must be a function');
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
        signal,
        onMessage
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
      if (!Array.isArray(messages)) {
        invalid('"messages" must be an array');
      }
      return messages.map((message, index) => {
        const name = `messages[${index}]`;
        if (!isObject(message)) {
          invalid(`${name} must be an object like { role, content }`);
        }
        if (!MESSAGE_ROLES.includes(message.role)) {
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
          invalid(`${name}.content must be a string or a non-empty array of content parts`);
        }
        return content.map((part, index) => {
          const partName = `${name}.content[${index}]`;
          if (!isObject(part)) {
            invalid(`${partName} must be an object like { type }`);
          }
          const roles = PART_ROLES[part.type];
          if (!roles) {
            invalid(`${partName}.type "${part.type}" is unknown`);
          }
          if (!roles.includes(role)) {
            invalid(`${partName}: a "${part.type}" part is not valid in a "${role}" message`);
          }
          if (part.type === 'toolCall') {
            if (typeof part.id !== 'string' || !part.id ||
              typeof part.name !== 'string' || !isObject(part.input)) {
              invalid(`${partName} must be an object like { type, id, name, input }`);
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
              invalid(`${partName}.toolCallId must be a string`);
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
            invalid(`${partName} must carry an object "output" or a string "error", not both`);
          }
          if (part.type === 'text') {
            if (typeof part.text !== 'string') {
              invalid(`${partName}.text must be a string`);
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
          return invalid(`${partName}.image must be an object like { url } or { data, mediaType }`);
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
    // undefined so the image request omits them and the provider's own
    // default applies.
    normalizeImageOptions(prompt, options) {
      if (typeof prompt !== 'string' || !prompt) {
        invalid('the image prompt must be a non-empty string');
      }
      options = options === undefined ? {} : options;
      if (!isObject(options)) {
        invalid('"options" must be an object');
      }
      for (const name of Object.keys(options)) {
        if (!IMAGE_OPTIONS.includes(name)) {
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
      if (quality !== undefined && !QUALITIES.includes(quality)) {
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
            // The adapter fetches this server-side, so only web urls
            // pass — no data:, file: or relative forms. Vetting and
            // authorizing a user-supplied url is the caller's job
            // before it reaches this surface.
            if (![ 'http:', 'https:' ].includes(urlProtocol(source.url))) {
              invalid(`${name}.url must be an absolute http(s) url`);
            }
            return { url: source.url };
          }
          if (isObject(source) && typeof source.data === 'string' &&
            typeof source.mediaType === 'string') {
            return {
              data: source.data,
              mediaType: source.mediaType
            };
          }
          return invalid(`${name} must be an object like { url } or { data, mediaType }`);
        });
      }

      // The parsed protocol of an absolute url, or undefined
      function urlProtocol(url) {
        try {
          return new URL(url).protocol;
        } catch (e) {
          return undefined;
        }
      }
    }
  };
};
