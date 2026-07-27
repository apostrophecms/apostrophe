// The built-in mocks that stand in for every adapter under APOS_AI_MOCK:
// same pipeline, same retry and validation seam, no network and no keys.

const { isObject } = require('./util');

// A 1×1 transparent PNG, the placeholder pixel mock image calls return
const MOCK_PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// ~4 characters per token, the usual plain-text ballpark
function tokens(text) {
  return Math.max(1, Math.round(text.length / 4));
}

module.exports = (self) => {
  return {
    // The built-in mock standing in for every adapter chat under
    // APOS_AI_MOCK. Consults the "mock" option first when the module
    // has one — called (req, request), req-first like every AI
    // surface, so a mock can answer per current user: it may return
    // a complete assistant turn, a { text } shorthand filled out
    // into one, or undefined to fall through to the deterministic
    // default. That default is request-aware: for a
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
        ? await self.options.mock(req, request)
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
    // The built-in mock standing in for every adapter image call
    // under APOS_AI_MOCK. Consults the "mockImage" option first when
    // the module has one — called (req, request), req-first like
    // every AI surface, so a mock can answer per current user: it
    // may return a complete adapter image result ({ images, model?,
    // usage?, size? }), an images array shorthand filled out into
    // one, or undefined to fall through to the deterministic
    // default — `count` copies of a placeholder pixel, no network
    // or keys. Filled-in usage is the chat mock's
    // text ballpark for the prompt plus a flat per-image output, the
    // order images bill at. Runs inside the same retry and
    // validation seam as a real call.
    async mockImage(req, request) {
      const custom = self.options.mockImage
        ? await self.options.mockImage(req, request)
        : undefined;
      if (custom == null) {
        return result(Array.from({ length: request.count }, () => ({
          type: 'png',
          data: MOCK_PIXEL
        })));
      }
      if (isObject(custom) && Array.isArray(custom.images)) {
        return custom;
      }
      if (Array.isArray(custom)) {
        return result(custom);
      }
      throw self.apos.error(
        'invalid',
        '"mockImage" must return an image result, an images array or undefined'
      );

      // The adapter return shape around `images`, with the model and
      // a plausible usage supplied
      function result(images) {
        return {
          images,
          model: request.model,
          usage: {
            inputTokens: tokens(request.prompt),
            outputTokens: 1000 * images.length
          }
        };
      }
    },
    // The provider record standing in for a real one under
    // APOS_AI_MOCK: a `self.providers` entry in every respect the
    // pipeline reads, named for the provider the call routed to, whose
    // adapter offers the built-in mock for `kind` — 'chat' or 'image',
    // the one entry that kind of call reaches for.
    mockRecord(kind, provider) {
      return {
        name: provider,
        adapter: {
          [kind]: {
            chat: self.mockChat,
            image: self.mockImage
          }[kind],
          normalizeError: self.mockNormalizeError
        }
      };
    },
    // The mock adapter's error normalization: errors pass through
    // untouched, so a mock throwing normalized codes exercises the
    // real error paths
    mockNormalizeError(error) {
      return error;
    }
  };
};
