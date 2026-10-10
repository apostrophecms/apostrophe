const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('AI adapter: google', function() {
  this.timeout(t.timeout);

  let apos;
  // The adapter module instance, for unit access to the dialect methods
  let adapter;
  let savedLiveKey;

  before(async function() {
    // A real key in the environment would override the fixture keys
    // below (envKey); keep the suite hermetic and restore at the end
    savedLiveKey = process.env.APOS_GEMINI_KEY;
    delete process.env.APOS_GEMINI_KEY;
    apos = await t.create({
      root: module,
      modules: {
        'tool-fixtures': {
          init(self) {
            self.apos.ai.addTool({
              name: 'echo',
              description: 'Echo the value back',
              kind: 'query',
              input: {
                type: 'object',
                properties: { value: { type: 'string' } },
                required: [ 'value' ]
              },
              handler: (req, args) => ({ value: args.value })
            });
          }
        },
        '@apostrophecms/ai': {
          options: {
            provider: 'google',
            providers: {
              google: { apiKey: 'sk-test' },
              gateway: {
                adapter: 'google',
                apiKey: 'sk-gw',
                baseUrl: 'https://llm-gateway.example.com/google'
              }
            },
            // Keep retried tests fast; the delay engine has its own suite
            retryBaseDelay: 1
          }
        }
      }
    });
    adapter = apos.modules['@apostrophecms/ai-adapter-google'];
  });

  after(async function() {
    if (savedLiveKey !== undefined) {
      process.env.APOS_GEMINI_KEY = savedLiveKey;
    }
    if (apos) {
      return t.destroy(apos);
    }
  });

  const text = (value) => ({
    type: 'text',
    text: value
  });
  const userMessage = (value) => ({
    role: 'user',
    content: [ text(value) ]
  });
  // A minimal normalized adapter request, as the engine assembles it
  const request = (extras = {}) => ({
    messages: [ userMessage('write a haiku about cats') ],
    model: 'gemini-3.8-flash',
    maxTokens: 65536,
    cache: false,
    ...extras
  });
  const userStep = (value) => ({
    type: 'user_input',
    content: [ text(value) ]
  });
  // Every real response leads with a signed thought step, even when
  // no thought tokens were spent
  const thoughtStep = (signature = 'sig-1') => ({
    type: 'thought',
    signature
  });
  const outputStep = (value) => ({
    type: 'model_output',
    content: [ text(value) ]
  });
  // A canned Interactions response body
  const fixture = (extras = {}) => ({
    object: 'interaction',
    status: 'completed',
    model: 'gemini-3.8-flash',
    steps: [ thoughtStep(), outputStep('a haiku') ],
    usage: {
      total_input_tokens: 12,
      total_output_tokens: 7,
      total_thought_tokens: 0,
      total_cached_tokens: 0,
      total_tool_use_tokens: 0,
      total_tokens: 19
    },
    ...extras
  });
  // An apos.http >= 400 throw: Error with status, headers, body
  const httpError = (status, headers = {}, body) => Object.assign(
    new Error(`HTTP error ${status}`),
    {
      status,
      headers,
      body
    }
  );

  it('registers the adapter and activates the provider', function() {
    assert(apos.ai.getAdapter('google'));
    assert.equal(apos.ai.getAdapter('google').envKey, 'APOS_GEMINI_KEY');
    assert.equal(apos.ai.active, true);
    const info = apos.ai.modelInfo();
    assert.equal(info.provider, 'google');
    assert.equal(info.model, 'gemini-3.8-flash');
    assert.equal(info.contextWindow, 1048576);
    assert.equal(info.maxOutputTokens, 65536);
    assert.equal(apos.ai.modelInfo({ effort: 'low' }).model, 'gemini-3.5-flash-lite');
    const high = apos.ai.modelInfo({ effort: 'high' });
    assert.equal(high.model, 'gemini-3.8-flash');
    assert.equal(high.reasoning, 'high');
  });

  it('declares the thinking levels each text model accepts', function() {
    const { models } = apos.ai.getAdapter('google');
    assert.deepEqual(
      models['gemini-3.5-flash-lite'].reasoning,
      [ 'minimal', 'low', 'medium', 'high' ]
    );
    assert.deepEqual(
      models['gemini-3.8-flash'].reasoning,
      [ 'low', 'medium', 'high' ]
    );
  });

  describe('request translation', function() {
    it('builds the minimal body', function() {
      assert.deepEqual(adapter.buildBody(request()), {
        model: 'gemini-3.8-flash',
        store: false,
        input: [ userStep('write a haiku about cats') ],
        generation_config: { max_output_tokens: 65536 }
      });
    });

    it('carries the system prompt as system_instruction', function() {
      const body = adapter.buildBody(request({ system: 'You help editors.' }));
      assert.equal(body.system_instruction, 'You help editors.');
      assert.equal(body.input.length, 1);
    });

    it('translates a conversation to steps, in order', function() {
      const body = adapter.buildBody(request({
        messages: [
          userMessage('Do we have a pricing page?'),
          {
            role: 'assistant',
            content: [ text('No, I did not find one.') ]
          },
          userMessage('Create one.')
        ]
      }));
      assert.deepEqual(body.input, [
        userStep('Do we have a pricing page?'),
        outputStep('No, I did not find one.'),
        userStep('Create one.')
      ]);
    });

    it('translates both image part forms', function() {
      const body = adapter.buildBody(request({
        messages: [ {
          role: 'user',
          content: [
            text('describe these'),
            {
              type: 'image',
              image: { url: 'https://generativelanguage.googleapis.com/v1beta/files/f1' }
            },
            {
              type: 'image',
              image: {
                data: 'aGk=',
                mediaType: 'image/png'
              }
            }
          ]
        } ]
      }));
      assert.deepEqual(body.input[0].content.slice(1), [
        {
          type: 'image',
          uri: 'https://generativelanguage.googleapis.com/v1beta/files/f1'
        },
        {
          type: 'image',
          data: 'aGk=',
          mime_type: 'image/png'
        }
      ]);
    });

    it('passes reasoning through as the thinking level', function() {
      assert.equal(
        adapter.buildBody(request()).generation_config.thinking_level,
        undefined
      );
      assert.deepEqual(
        adapter.buildBody(request({ reasoning: 'high' })).generation_config,
        {
          max_output_tokens: 65536,
          thinking_level: 'high'
        }
      );
    });

    it('omits generation_config entirely when nothing resolved', function() {
      const body = adapter.buildBody(request({ maxTokens: undefined }));
      assert.equal('generation_config' in body, false);
    });

    it('places nothing for any cache policy', function() {
      for (const cache of [ { ttl: 'short' }, { ttl: 'long' } ]) {
        assert.deepEqual(
          adapter.buildBody(request({ cache })),
          adapter.buildBody(request())
        );
      }
    });

    it('translates tool definitions to function tools, as JSON Schema', function() {
      const input = {
        type: 'object',
        properties: { title: { type: 'string' } },
        additionalProperties: false
      };
      const body = adapter.buildBody(request({
        tools: [ {
          name: 'find_pages',
          description: 'Find pages',
          input
        } ]
      }));
      assert.deepEqual(body.tools, [ {
        type: 'function',
        name: 'find_pages',
        description: 'Find pages',
        parameters: input
      } ]);
    });

    it('carries tool calls and results, naming each result after its call', function() {
      const body = adapter.buildBody(request({
        messages: [
          userMessage('Find the pricing page.'),
          {
            role: 'assistant',
            content: [
              {
                type: 'thought',
                signature: 'sig-1'
              },
              text('searching'),
              {
                type: 'toolCall',
                id: 'call_1',
                name: 'find_pages',
                input: { title: 'Pricing' }
              }
            ]
          },
          {
            role: 'tool',
            content: [ {
              type: 'toolResult',
              toolCallId: 'call_1',
              output: { id: 'p1' }
            } ]
          }
        ]
      }));
      assert.deepEqual(body.input.slice(1), [
        thoughtStep('sig-1'),
        outputStep('searching'),
        {
          type: 'function_call',
          id: 'call_1',
          name: 'find_pages',
          arguments: { title: 'Pricing' }
        },
        {
          type: 'function_result',
          call_id: 'call_1',
          name: 'find_pages',
          result: { id: 'p1' }
        }
      ]);
    });

    it('flags a tool error result', function() {
      const body = adapter.buildBody(request({
        messages: [
          {
            role: 'assistant',
            content: [ {
              type: 'toolCall',
              id: 'call_1',
              name: 'x',
              input: {}
            } ]
          },
          {
            role: 'tool',
            content: [ {
              type: 'toolResult',
              toolCallId: 'call_1',
              error: 'boom'
            } ]
          }
        ]
      }));
      assert.deepEqual(body.input[2], {
        type: 'function_result',
        call_id: 'call_1',
        name: 'x',
        result: { error: 'boom' },
        is_error: true
      });
    });

    it('replays thought parts as thought steps, in place and verbatim', function() {
      const summary = [ text('Looking for the page.') ];
      const body = adapter.buildBody(request({
        messages: [ {
          role: 'assistant',
          content: [
            {
              type: 'thought',
              signature: 'sig-1',
              summary
            },
            text('done')
          ]
        } ]
      }));
      assert.deepEqual(body.input, [
        {
          type: 'thought',
          signature: 'sig-1',
          summary
        },
        outputStep('done')
      ]);
    });

    it('replays several thought parts and a trailing one, each in its place', function() {
      const body = adapter.buildBody(request({
        messages: [ {
          role: 'assistant',
          content: [
            {
              type: 'thought',
              signature: 'sig-1'
            },
            {
              type: 'thought',
              signature: 'sig-2'
            },
            text('done'),
            {
              type: 'thought',
              signature: 'sig-3'
            }
          ]
        } ]
      }));
      assert.deepEqual(body.input, [
        thoughtStep('sig-1'),
        thoughtStep('sig-2'),
        outputStep('done'),
        thoughtStep('sig-3')
      ]);
    });

    it('opens a message with a tool call another model made with the placeholder', function() {
      // An Anthropic turn: its thinking part is not a Gemini thought
      const body = adapter.buildBody(request({
        messages: [
          userMessage('Find the pricing page.'),
          {
            role: 'assistant',
            content: [
              {
                type: 'thinking',
                block: {
                  type: 'thinking',
                  thinking: 'hidden',
                  signature: 'x'
                }
              },
              text('Searching.'),
              {
                type: 'toolCall',
                id: 'toolu_1',
                name: 'find_pages',
                input: { title: 'Pricing' }
              }
            ]
          }
        ]
      }));
      // The placeholder leads: a turn holding a thought step must open
      // with one
      assert.deepEqual(body.input.slice(1), [
        thoughtStep('skip_thought_signature_validator'),
        outputStep('Searching.'),
        {
          type: 'function_call',
          id: 'toolu_1',
          name: 'find_pages',
          arguments: { title: 'Pricing' }
        }
      ]);
    });

    it('covers parallel foreign tool calls with one placeholder', function() {
      const body = adapter.buildBody(request({
        messages: [ {
          role: 'assistant',
          content: [
            {
              type: 'toolCall',
              id: 'call_a',
              name: 'x',
              input: {}
            },
            {
              type: 'toolCall',
              id: 'call_b',
              name: 'x',
              input: {}
            }
          ]
        } ]
      }));
      assert.deepEqual(body.input.map((step) => step.signature ?? step.id), [
        'skip_thought_signature_validator',
        'call_a',
        'call_b'
      ]);
    });

    it('judges each assistant message on its own thought parts', function() {
      const call = (id) => ({
        type: 'toolCall',
        id,
        name: 'echo',
        input: { value: id }
      });
      const result = (id) => ({
        role: 'tool',
        content: [ {
          type: 'toolResult',
          toolCallId: id,
          output: { value: id }
        } ]
      });
      const body = adapter.buildBody(request({
        messages: [
          userMessage('echo one'),
          {
            role: 'assistant',
            content: [
              {
                type: 'thought',
                signature: 'sig-1'
              },
              call('call_1')
            ]
          },
          result('call_1'),
          userMessage('echo two'),
          {
            role: 'assistant',
            content: [ call('toolu_2') ]
          },
          result('toolu_2'),
          {
            role: 'assistant',
            content: [ text('both echoed') ]
          }
        ]
      }));
      assert.deepEqual(
        body.input
          .filter((step) => step.type === 'thought')
          .map((step) => step.signature),
        [ 'sig-1', 'skip_thought_signature_validator' ]
      );
      assert.deepEqual(body.input[5], thoughtStep('skip_thought_signature_validator'));
      assert.equal(body.input[6].id, 'toolu_2');
    });

    it('groups each run of text and image parts into one model_output step', function() {
      const body = adapter.buildBody(request({
        messages: [ {
          role: 'assistant',
          content: [
            {
              type: 'thought',
              signature: 'sig-1'
            },
            text('here it is'),
            {
              type: 'image',
              image: {
                data: 'aGk=',
                mediaType: 'image/png'
              }
            },
            {
              type: 'toolCall',
              id: 'call_1',
              name: 'x',
              input: {}
            },
            text('and more')
          ]
        } ]
      }));
      assert.deepEqual(body.input, [
        thoughtStep('sig-1'),
        {
          type: 'model_output',
          content: [
            text('here it is'),
            {
              type: 'image',
              data: 'aGk=',
              mime_type: 'image/png'
            }
          ]
        },
        {
          type: 'function_call',
          id: 'call_1',
          name: 'x',
          arguments: {}
        },
        outputStep('and more')
      ]);
    });

    it('skips assistant parts and part properties another dialect owns', function() {
      const body = adapter.buildBody(request({
        messages: [ {
          role: 'assistant',
          content: [
            {
              type: 'thinking',
              block: {
                type: 'thinking',
                thinking: 'hidden',
                signature: 'x'
              }
            },
            {
              type: 'reasoning',
              item: {
                type: 'reasoning',
                encrypted_content: 'opaque'
              }
            },
            {
              type: 'text',
              text: 'visible',
              thoughtSignature: 'legacy'
            }
          ]
        } ]
      }));
      assert.deepEqual(body.input, [ outputStep('visible') ]);
    });

    it('sends a structured-output schema as the JSON text response format', function() {
      const schema = {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: [ 'title' ],
        additionalProperties: false
      };
      const body = adapter.buildBody(request({ schema }));
      assert.deepEqual(body.response_format, {
        type: 'text',
        mime_type: 'application/json',
        schema
      });
      assert.equal('tools' in body, false);
    });

    it('sends the schema beside function tools', function() {
      const input = { type: 'object' };
      const schema = {
        type: 'object',
        properties: { title: { type: 'string' } }
      };
      const body = adapter.buildBody(request({
        tools: [ {
          name: 'find_pages',
          description: 'Find pages',
          input
        } ],
        schema
      }));
      assert.equal(body.tools.length, 1);
      assert.deepEqual(body.response_format.schema, schema);
    });
  });

  describe('response parsing', function() {
    it('parses a text turn, carrying the thought step as a thought part', function() {
      assert.deepEqual(adapter.parseResponse(fixture()), {
        content: [
          {
            type: 'thought',
            signature: 'sig-1'
          },
          text('a haiku')
        ],
        finishReason: 'stop',
        usage: {
          inputTokens: 12,
          outputTokens: 7,
          cacheReadTokens: 0
        },
        model: 'gemini-3.8-flash'
      });
    });

    it('maps the statuses', function() {
      for (const [ theirs, ours ] of [
        [ 'completed', 'stop' ],
        [ 'incomplete', 'length' ],
        // Unsettled or unknown statuses yield none: the engine treats
        // the turn as malformed and retries, never a truncated success
        [ 'in_progress', undefined ],
        [ 'queued', undefined ],
        [ 'cancelled', undefined ],
        [ 'weird', undefined ]
      ]) {
        assert.equal(
          adapter.parseResponse(fixture({ status: theirs })).finishReason,
          ours
        );
      }
    });

    it('throws a failed interaction as its errors say', function() {
      const failed = (errors, steps) => () => adapter.parseResponse(fixture({
        status: 'failed',
        errors,
        ...(steps && { steps })
      }));
      const throwsAs = (thunk, name, message) => assert.throws(thunk, (e) => {
        assert.equal(e.name, name);
        assert.match(e.message, message);
        return true;
      });
      // Any block wins, whatever else failed beside it
      throwsAs(failed([
        { code: 'no_image' },
        {
          code: 'safety',
          message: 'Blocked for safety.'
        }
      ]), 'aiRefusal', /^Blocked for safety\.$/);
      throwsAs(failed([ {
        code: 'missing_thought_signature',
        message: 'The response is missing a required thought signature.'
      } ]), 'invalid', /^Gemini rejected the replayed conversation: The response is missing/);
      throwsAs(failed([ { code: 'malformed_function_call' } ]), 'aiRetry', /^malformed_function_call$/);
      throwsAs(failed([ {
        code: 'api_error',
        message: 'Internal error.'
      } ]), 'aiRetry', /^Internal error\.$/);
      throwsAs(failed(), 'aiRetry', /^the interaction failed$/);
      // A function call on a failed interaction is not a request to act
      throwsAs(failed([ { code: 'unexpected_tool_call' } ], [
        thoughtStep(),
        {
          type: 'function_call',
          id: 'call_1',
          name: 'x',
          arguments: {}
        }
      ]), 'aiRetry', /^unexpected_tool_call$/);
    });

    it('adds thinking tokens into the output count', function() {
      const turn = adapter.parseResponse(fixture({
        usage: {
          total_input_tokens: 12,
          total_output_tokens: 7,
          total_thought_tokens: 5,
          total_tokens: 24
        }
      }));
      assert.deepEqual(turn.usage, {
        inputTokens: 12,
        outputTokens: 12
      });
    });

    it('carries the cached share of the input', function() {
      const turn = adapter.parseResponse(fixture({
        usage: {
          total_input_tokens: 12,
          total_cached_tokens: 5,
          total_output_tokens: 7,
          total_tokens: 19
        }
      }));
      assert.deepEqual(turn.usage, {
        inputTokens: 12,
        outputTokens: 7,
        cacheReadTokens: 5
      });
    });

    it('carries the image shares the modality lists report', function() {
      const turn = adapter.parseResponse(fixture({
        usage: {
          total_input_tokens: 268,
          input_tokens_by_modality: [
            {
              modality: 'text',
              tokens: 10
            },
            {
              modality: 'image',
              tokens: 258
            }
          ],
          total_output_tokens: 7,
          output_tokens_by_modality: [ {
            modality: 'text',
            tokens: 7
          } ],
          total_tokens: 275
        }
      }));
      // No image entry in the output list: unknown, so absent
      assert.deepEqual(turn.usage, {
        inputTokens: 268,
        outputTokens: 7,
        imageInputTokens: 258
      });
    });

    it('translates function calls under the service ids, whatever the status', function() {
      const steps = [
        thoughtStep('sig-call'),
        {
          type: 'function_call',
          id: 'call_1',
          name: 'search',
          arguments: { q: 'a' },
          // The service's copy of the thought signature
          signature: 'sig-call'
        },
        {
          type: 'function_call',
          id: 'call_2',
          name: 'search',
          arguments: { q: 'b' },
          signature: 'sig-call'
        }
      ];
      for (const status of [ 'requires_action', 'incomplete' ]) {
        const turn = adapter.parseResponse(fixture({
          status,
          steps
        }));
        assert.deepEqual(turn.content, [
          {
            type: 'thought',
            signature: 'sig-call'
          },
          {
            type: 'toolCall',
            id: 'call_1',
            name: 'search',
            input: { q: 'a' }
          },
          {
            type: 'toolCall',
            id: 'call_2',
            name: 'search',
            input: { q: 'b' }
          }
        ]);
        assert.equal(turn.finishReason, 'toolCalls');
      }
    });

    it('carries a thought summary on the thought part', function() {
      const summary = [ text('Looking for the page.') ];
      const turn = adapter.parseResponse(fixture({
        steps: [
          {
            type: 'thought',
            signature: 'sig-1',
            summary
          },
          outputStep('found it')
        ]
      }));
      assert.deepEqual(turn.content[0], {
        type: 'thought',
        signature: 'sig-1',
        summary
      });
    });

    it('carries several thought steps and a trailing one, in order', function() {
      const turn = adapter.parseResponse(fixture({
        steps: [
          thoughtStep('sig-1'),
          thoughtStep('sig-2'),
          outputStep('done'),
          thoughtStep('sig-3')
        ]
      }));
      assert.deepEqual(turn.content, [
        thoughtStep('sig-1'),
        thoughtStep('sig-2'),
        text('done'),
        thoughtStep('sig-3')
      ]);
      assert.equal(turn.finishReason, 'stop');
    });

    it('keeps the output text blocks, in order, and skips what it does not own', function() {
      const turn = adapter.parseResponse(fixture({
        steps: [
          userStep('echoed input'),
          thoughtStep(),
          {
            type: 'model_output',
            content: [
              text('one'),
              {
                type: 'image',
                data: 'aW1n',
                mime_type: 'image/png'
              },
              text('two')
            ]
          }
        ]
      }));
      assert.deepEqual(turn.content.slice(1), [ text('one'), text('two') ]);
    });

    it('parses the structured answer onto the turn object', function() {
      const object = {
        title: 'Pricing',
        description: 'Our plans'
      };
      // The service pretty-prints the JSON, trailing whitespace and all
      const json = `${JSON.stringify(object, null, 2)} `;
      const turn = adapter.parseResponse(
        fixture({ steps: [ thoughtStep(), outputStep(json) ] }),
        request({ schema: { type: 'object' } })
      );
      assert.deepEqual(turn.object, object);
      assert.equal(turn.finishReason, 'stop');
      // The JSON also stays on the content so the transcript round-trips
      assert.deepEqual(turn.content.slice(1), [ text(json) ]);
    });

    it('treats malformed structured JSON as a retryable response', function() {
      assert.throws(
        () => adapter.parseResponse(
          fixture({ steps: [ thoughtStep(), outputStep('not json') ] }),
          request({ schema: { type: 'object' } })
        ),
        (e) => {
          assert.equal(e.name, 'aiRetry');
          assert.match(e.message, /malformed structured JSON/);
          return true;
        }
      );
    });

    it('parses no object from a tool-call or truncated turn, or without a schema request', function() {
      const schema = { type: 'object' };
      const call = adapter.parseResponse(fixture({
        status: 'requires_action',
        steps: [
          thoughtStep(),
          {
            type: 'function_call',
            id: 'call_1',
            name: 'echo',
            arguments: { value: 'hi' }
          }
        ]
      }), request({ schema }));
      assert.equal('object' in call, false);
      const truncated = adapter.parseResponse(fixture({
        status: 'incomplete',
        steps: [ thoughtStep(), outputStep('{"title": "Pri') ]
      }), request({ schema }));
      assert.equal(truncated.finishReason, 'length');
      assert.equal('object' in truncated, false);
      const plain = adapter.parseResponse(fixture({
        steps: [ thoughtStep(), outputStep('{"a":1}') ]
      }));
      assert.equal('object' in plain, false);
    });
  });

  describe('error normalization', function() {
    it('maps the statuses to the normalized codes', function() {
      for (const [ status, code, kind ] of [
        [ 429, 'aiRetry', 'rateLimit' ],
        [ 500, 'aiRetry', 'overload' ],
        [ 503, 'aiRetry', 'overload' ],
        [ 401, 'forbidden', undefined ],
        [ 403, 'forbidden', undefined ],
        [ 404, 'notfound', undefined ],
        [ 400, 'invalid', undefined ]
      ]) {
        const error = adapter.normalizeError(httpError(status));
        assert.equal(error.name, code);
        assert.equal(error.data.status, status);
        assert.equal(error.data.kind, kind);
      }
    });

    it('prefers the provider message', function() {
      const error = adapter.normalizeError(httpError(400, {}, {
        error: {
          code: 'invalid_request',
          message: 'Thinking level THINKING_LEVEL_MINIMAL is not supported for this model.'
        }
      }));
      assert.equal(error.name, 'invalid');
      assert.equal(error.data.status, 400);
      assert.equal(
        error.message,
        'Thinking level THINKING_LEVEL_MINIMAL is not supported for this model.'
      );
    });

    it('reads the gateway\'s array-wrapped auth errors', function() {
      const invalidKey = adapter.normalizeError(httpError(400, {}, [ {
        error: {
          code: 400,
          message: 'API key not valid. Please pass a valid API key.',
          status: 'INVALID_ARGUMENT'
        }
      } ]));
      assert.equal(invalidKey.name, 'invalid');
      assert.equal(invalidKey.message, 'API key not valid. Please pass a valid API key.');
      const noKey = adapter.normalizeError(httpError(403, {}, [ {
        error: {
          code: 403,
          message: 'Method doesn\'t allow unregistered callers.',
          status: 'PERMISSION_DENIED'
        }
      } ]));
      assert.equal(noKey.name, 'forbidden');
      assert.equal(noKey.data.status, 403);
      assert.equal(noKey.message, 'Method doesn\'t allow unregistered callers.');
    });

    it('reads the retry delay from the Retry-After header only', function() {
      const header = adapter.normalizeError(httpError(429, { 'retry-after': '7' }, {
        error: {
          code: 'rate_limit_exceeded',
          message: 'Rate limit exceeded.'
        }
      }));
      assert.equal(header.name, 'aiRetry');
      assert.equal(header.data.kind, 'rateLimit');
      assert.equal(header.data.retryAfter, 7);
      assert.equal(header.message, 'Rate limit exceeded.');
      const bare = adapter.normalizeError(httpError(429, {}, {
        error: {
          code: 'quota_exceeded',
          message: 'Daily quota exceeded.'
        }
      }));
      assert.equal(bare.name, 'aiRetry');
      assert.equal(bare.data.retryAfter, undefined);
    });

    it('maps a blocked generation to a refusal, by its message or its code', function() {
      const observed = adapter.normalizeError(httpError(400, {}, {
        error: {
          code: 'invalid_request',
          message: 'Request blocked due to prohibited content guidelines. Please modify your input and retry.'
        }
      }));
      assert.equal(observed.name, 'aiRefusal');
      assert.equal(observed.data.status, 400);
      assert.equal(
        observed.message,
        'Request blocked due to prohibited content guidelines. Please modify your input and retry.'
      );
      for (const code of [ 'safety', 'prohibited_content', 'image_safety', 'content_blocked' ]) {
        const documented = adapter.normalizeError(httpError(400, {}, {
          error: {
            code,
            message: 'Blocked.'
          }
        }));
        assert.equal(documented.name, 'aiRefusal');
        assert.equal(documented.message, 'Blocked.');
      }
    });

    it('maps the documented generation errors to the transient code', function() {
      for (const code of [
        'malformed_function_call', 'malformed_tool_call', 'unexpected_tool_call',
        'too_many_tool_calls', 'no_image'
      ]) {
        const error = adapter.normalizeError(httpError(400, {}, {
          error: { code }
        }));
        assert.equal(error.name, 'aiRetry');
        assert.equal(error.message, code);
      }
    });

    it('explains a rejected thought signature, by its message or its code', function() {
      const hint = 'Gemini transcripts must be replayed exactly as returned, "thought" parts unmodified; a transcript edited by hand or recorded by an earlier version of this adapter may not replay.';
      const observed = adapter.normalizeError(httpError(400, {}, {
        error: {
          code: 'invalid_request',
          message: 'Corrupted thought signature.'
        }
      }));
      assert.equal(observed.name, 'invalid');
      assert.equal(observed.data.status, 400);
      assert.equal(
        observed.message,
        `Gemini rejected the replayed conversation: Corrupted thought signature. ${hint}`
      );
      const documented = adapter.normalizeError(httpError(400, {}, {
        error: {
          code: 'missing_thought_signature',
          message: 'The response is missing a required thought signature.'
        }
      }));
      assert.equal(documented.name, 'invalid');
      assert.equal(
        documented.message,
        `Gemini rejected the replayed conversation: The response is missing a required thought signature. ${hint}`
      );
    });

    it('maps timeouts and network failures to the transient code', function() {
      const timeout = adapter.normalizeError(
        new DOMException('The operation timed out', 'TimeoutError')
      );
      assert.equal(timeout.name, 'aiRetry');
      assert.equal(timeout.data.kind, 'timeout');
      const network = adapter.normalizeError(new TypeError('fetch failed'));
      assert.equal(network.name, 'aiRetry');
      assert.equal(network.data.kind, 'network');
      assert.match(network.message, /fetch failed/);
    });

    it('passes a caller abort through untouched', function() {
      const abort = new DOMException('The operation was aborted', 'AbortError');
      assert.equal(adapter.normalizeError(abort), abort);
    });
  });

  describe('the wire', function() {
    // Thunks consumed by the stubbed apos.http.post, one per call
    let httpScript;
    let httpCalls;
    let logRecords;
    let waits;
    let originalPost;

    // A schema the engine validates the structured answer against
    const metadataSchema = {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          maxLength: 60
        },
        description: {
          type: 'string',
          maxLength: 160
        }
      },
      required: [ 'title', 'description' ]
    };

    before(function() {
      originalPost = apos.http.post;
    });

    after(function() {
      apos.http.post = originalPost;
    });

    beforeEach(function() {
      httpScript = [];
      httpCalls = [];
      waits = [];
      logRecords = [];
      apos.http.post = async (url, options) => {
        httpCalls.push({
          url,
          options
        });
        const step = httpScript.shift();
        if (step === undefined) {
          throw new Error('post called beyond its script');
        }
        return step();
      };
      apos.ai.pause = async (ms) => {
        waits.push(ms);
      };
      for (const severity of [ 'Warn', 'Error' ]) {
        apos.ai[`log${severity}`] = (req, type, message, data) => {
          logRecords.push({
            severity: severity.toLowerCase(),
            type,
            message,
            data
          });
        };
      }
    });

    it('generates end to end against the dialect', async function() {
      httpScript = [ () => fixture() ];
      const result = await apos.ai.generate(
        apos.task.getReq(),
        'write a haiku about cats'
      );
      assert.equal(result.text, 'a haiku');
      assert.equal(result.finishReason, 'stop');
      assert.equal(result.provider, 'google');
      assert.equal(result.model, 'gemini-3.8-flash');
      assert.deepEqual(result.usage, {
        inputTokens: 12,
        outputTokens: 7,
        cacheReadTokens: 0
      });

      const [ call ] = httpCalls;
      assert.equal(
        call.url,
        'https://generativelanguage.googleapis.com/v1/interactions'
      );
      assert.equal(call.options.headers['x-goog-api-key'], 'sk-test');
      assert.equal(call.options.timeout, 600000);
      // The whole body: the default short cache policy adds nothing
      assert.deepEqual(call.options.body, {
        model: 'gemini-3.8-flash',
        store: false,
        input: [ userStep('write a haiku about cats') ],
        generation_config: { max_output_tokens: 65536 }
      });
    });

    it('honors an aliased entry: its baseUrl, key and merged model metadata', async function() {
      httpScript = [ () => fixture() ];
      await apos.ai.generate(apos.task.getReq(), 'p', {
        provider: 'gateway',
        model: 'gemini-3.8-flash'
      });
      const [ call ] = httpCalls;
      assert.equal(
        call.url,
        'https://llm-gateway.example.com/google/v1/interactions'
      );
      assert.equal(call.options.headers['x-goog-api-key'], 'sk-gw');
      assert.equal(call.options.body.model, 'gemini-3.8-flash');
      assert.equal(call.options.body.generation_config.max_output_tokens, 65536);
    });

    it('drives a thinking tool loop end to end, replaying the thought step', async function() {
      httpScript = [
        () => fixture({
          status: 'requires_action',
          steps: [
            thoughtStep('sig-call'),
            {
              type: 'function_call',
              id: 'call_1',
              name: 'echo',
              arguments: { value: 'pricing' },
              signature: 'sig-call'
            }
          ]
        }),
        () => fixture({
          steps: [ thoughtStep('sig-done'), outputStep('done') ]
        })
      ];
      const result = await apos.ai.generate(apos.task.getReq(), 'use the tool', {
        tools: [ 'echo' ],
        reasoning: 'high'
      });
      assert.equal(result.text, 'done');
      assert.equal(result.finishReason, 'stop');
      assert.equal(httpCalls.length, 2);
      // Thinking was on for both turns of the loop
      for (const call of httpCalls) {
        assert.equal(call.options.body.generation_config.thinking_level, 'high');
      }
      // The second call replays the thought step in its place, the
      // call under the service's id, and the result naming its function
      assert.deepEqual(httpCalls[1].options.body.input.slice(1), [
        thoughtStep('sig-call'),
        {
          type: 'function_call',
          id: 'call_1',
          name: 'echo',
          arguments: { value: 'pricing' }
        },
        {
          type: 'function_result',
          call_id: 'call_1',
          name: 'echo',
          result: { value: 'pricing' }
        }
      ]);
    });

    it('continues a tool transcript another provider produced', async function() {
      httpScript = [
        () => fixture({
          steps: [ thoughtStep('sig-done'), outputStep('done') ]
        })
      ];
      const result = await apos.ai.generate(apos.task.getReq(), {
        messages: [
          userMessage('use the tool'),
          {
            role: 'assistant',
            content: [
              {
                type: 'thinking',
                block: {
                  type: 'thinking',
                  thinking: 'hidden',
                  signature: 'x'
                }
              },
              {
                type: 'toolCall',
                id: 'toolu_1',
                name: 'echo',
                input: { value: 'pricing' }
              }
            ]
          },
          {
            role: 'tool',
            content: [ {
              type: 'toolResult',
              toolCallId: 'toolu_1',
              output: { value: 'pricing' }
            } ]
          }
        ],
        tools: [ 'echo' ]
      });
      assert.equal(result.text, 'done');
      assert.deepEqual(httpCalls[0].options.body.input.slice(1), [
        thoughtStep('skip_thought_signature_validator'),
        {
          type: 'function_call',
          id: 'toolu_1',
          name: 'echo',
          arguments: { value: 'pricing' }
        },
        {
          type: 'function_result',
          call_id: 'toolu_1',
          name: 'echo',
          result: { value: 'pricing' }
        }
      ]);
    });

    it('returns a validated object for a structured call over the wire', async function() {
      const object = {
        title: 'Pricing',
        description: 'Our plans'
      };
      httpScript = [ () => fixture({
        steps: [ thoughtStep(), outputStep(JSON.stringify(object)) ]
      }) ];
      const result = await apos.ai.generate(apos.task.getReq(), {
        messages: [ {
          role: 'user',
          content: 'write the metadata'
        } ],
        schema: metadataSchema
      });
      assert.deepEqual(result.object, object);
      const { body } = httpCalls[0].options;
      assert.equal(body.response_format.mime_type, 'application/json');
      assert.deepEqual(
        body.response_format.schema.required,
        [ 'title', 'description' ]
      );
    });

    it('retries a structured answer the schema rejects', async function() {
      const object = {
        title: 'Pricing',
        description: 'Our plans'
      };
      httpScript = [
        () => fixture({
          steps: [ thoughtStep(), outputStep('{"title":"Pricing"}') ]
        }),
        () => fixture({
          steps: [ thoughtStep(), outputStep(JSON.stringify(object)) ]
        })
      ];
      const result = await apos.ai.generate(apos.task.getReq(), {
        messages: [ {
          role: 'user',
          content: 'write the metadata'
        } ],
        schema: metadataSchema
      });
      assert.deepEqual(result.object, object);
      assert.equal(httpCalls.length, 2);
      assert.equal(logRecords[0].type, 'retry');
    });

    it('runs a tool loop to a structured answer, the schema beside the tools', async function() {
      const object = {
        title: 'Pricing',
        description: 'Our plans'
      };
      httpScript = [
        () => fixture({
          status: 'requires_action',
          steps: [
            thoughtStep('sig-call'),
            {
              type: 'function_call',
              id: 'call_1',
              name: 'echo',
              arguments: { value: 'pricing' },
              signature: 'sig-call'
            }
          ]
        }),
        () => fixture({
          steps: [ thoughtStep('sig-done'), outputStep(JSON.stringify(object)) ]
        })
      ];
      const result = await apos.ai.generate(apos.task.getReq(), {
        messages: [ {
          role: 'user',
          content: 'look up the page, then write its metadata'
        } ],
        tools: [ 'echo' ],
        schema: metadataSchema
      });
      assert.deepEqual(result.object, object);
      assert.equal(httpCalls.length, 2);
      for (const call of httpCalls) {
        assert.equal(call.options.body.tools[0].name, 'echo');
        assert.equal(call.options.body.response_format.type, 'text');
      }
    });

    it('retries a 429 at the Retry-After delay', async function() {
      httpScript = [
        () => {
          throw httpError(429, { 'retry-after': '2' }, {
            error: {
              code: 'rate_limit_exceeded',
              message: 'Rate limit exceeded.'
            }
          });
        },
        () => fixture()
      ];
      const result = await apos.ai.generate(apos.task.getReq(), 'p');
      assert.equal(result.text, 'a haiku');
      assert.equal(httpCalls.length, 2);
      assert.deepEqual(waits, [ 2000 ]);
      const [ record ] = logRecords;
      assert.equal(record.type, 'retry');
      assert.equal(record.message, 'Rate limit exceeded.');
      assert.equal(record.data.kind, 'rateLimit');
      assert.equal(record.data.status, 429);
      assert.equal(record.data.retryAfter, 2);
    });

    it('hard-stops an invalid API key, arriving as the gateway\'s 400', async function() {
      httpScript = [ () => {
        throw httpError(400, {}, [ {
          error: {
            code: 400,
            message: 'API key not valid. Please pass a valid API key.',
            status: 'INVALID_ARGUMENT'
          }
        } ]);
      } ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.equal(e.name, 'invalid');
        assert.equal(e.message, 'API key not valid. Please pass a valid API key.');
        return true;
      });
      assert.equal(httpCalls.length, 1);
      assert.deepEqual(
        logRecords.map((record) => [ record.type, record.data.code ]),
        [ [ 'failure', 'invalid' ] ]
      );
    });

    it('stops on a blocked request without retrying', async function() {
      httpScript = [ () => {
        throw httpError(400, {}, {
          error: {
            code: 'invalid_request',
            message: 'Request blocked due to prohibited content guidelines. Please modify your input and retry.'
          }
        });
      } ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.equal(e.name, 'aiRefusal');
        return true;
      });
      assert.equal(httpCalls.length, 1);
      assert.deepEqual(
        logRecords.map((record) => [ record.type, record.data.code, record.data.status ]),
        [ [ 'failure', 'aiRefusal', 400 ] ]
      );
    });

    it('retries a failed interaction', async function() {
      httpScript = [
        () => fixture({
          status: 'failed',
          steps: [],
          errors: [ { code: 'malformed_function_call' } ]
        }),
        () => fixture()
      ];
      const result = await apos.ai.generate(apos.task.getReq(), 'p');
      assert.equal(result.text, 'a haiku');
      assert.equal(httpCalls.length, 2);
      assert.deepEqual(
        logRecords.map((record) => [ record.type, record.data.code ]),
        [ [ 'retry', 'aiRetry' ] ]
      );
    });

    it('retries an unsettled status as a malformed turn', async function() {
      httpScript = [
        () => fixture({ status: 'in_progress' }),
        () => fixture()
      ];
      const result = await apos.ai.generate(apos.task.getReq(), 'p');
      assert.equal(result.text, 'a haiku');
      assert.equal(httpCalls.length, 2);
    });

    it('lets a caller abort surface as its own error', async function() {
      httpScript = [ () => {
        throw new DOMException('The operation was aborted', 'AbortError');
      } ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.equal(e.name, 'AbortError');
        return true;
      });
      assert.equal(httpCalls.length, 1);
    });
  });

  describe('image', function() {
    let httpScript;
    let httpCalls;
    let logRecords;
    let waits;
    let originalPost;
    let originalFetch;
    let fetchCalls;

    before(function() {
      originalPost = apos.http.post;
      originalFetch = global.fetch;
    });

    after(function() {
      apos.http.post = originalPost;
      global.fetch = originalFetch;
    });

    beforeEach(function() {
      httpScript = [];
      httpCalls = [];
      fetchCalls = [];
      logRecords = [];
      waits = [];
      apos.http.post = async (url, options) => {
        httpCalls.push({
          url,
          options
        });
        const step = httpScript.shift();
        if (step === undefined) {
          throw new Error('post called beyond its script');
        }
        return step();
      };
      apos.ai.pause = async (ms) => {
        waits.push(ms);
      };
      for (const severity of [ 'Warn', 'Error' ]) {
        apos.ai[`log${severity}`] = (req, type, message, data) => {
          logRecords.push({
            severity: severity.toLowerCase(),
            type,
            message,
            data
          });
        };
      }
    });

    // The provider instance the engine bound with this suite's config
    const instance = () => apos.ai.providers.google.adapter;
    const imageBlock = (extras = {}) => ({
      type: 'image',
      mime_type: 'image/jpeg',
      data: 'aW1n',
      ...extras
    });
    // A canned image interaction: the signed thought step that holds
    // the interim drafts, then the image itself
    const imageResponse = (extras = {}) => ({
      object: 'interaction',
      status: 'completed',
      model: 'gemini-3.1-flash-image',
      steps: [
        thoughtStep('sig-img'),
        {
          type: 'model_output',
          content: [ imageBlock() ]
        }
      ],
      usage: {
        total_input_tokens: 14,
        total_output_tokens: 1487,
        total_thought_tokens: 0,
        total_cached_tokens: 0,
        total_tokens: 1501
      },
      ...extras
    });

    it('declares the current image models and their ratio sets', function() {
      const { models } = apos.ai.getAdapter('google');
      const aspects = [
        '1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'
      ];
      const flashAspects = [ ...aspects, '1:4', '4:1', '1:8', '8:1' ];
      assert.deepEqual(models['gemini-3.1-flash-image'].aspects, flashAspects);
      assert.deepEqual(models['gemini-3-pro-image'].aspects, aspects);
      assert.deepEqual(models['gemini-3.1-flash-lite-image'].aspects, flashAspects);
    });

    it('generates from a prompt, mapping aspect and quality to the dialect', async function() {
      httpScript = [ () => imageResponse() ];
      const result = await instance().image(apos.task.getReq(), {
        prompt: 'a watercolor fox',
        count: 1,
        // The core resolved the requested aspect to a declared ratio
        aspect: '16:9',
        quality: 'high',
        model: 'gemini-3.1-flash-image'
      });
      const [ call ] = httpCalls;
      assert.equal(
        call.url,
        'https://generativelanguage.googleapis.com/v1/interactions'
      );
      assert.equal(call.options.headers['x-goog-api-key'], 'sk-test');
      assert.equal(call.options.timeout, 600000);
      assert.deepEqual(call.options.body, {
        model: 'gemini-3.1-flash-image',
        store: false,
        input: [ {
          type: 'user_input',
          content: [ text('a watercolor fox') ]
        } ],
        response_format: {
          type: 'image',
          aspect_ratio: '16:9',
          image_size: '2K'
        }
      });
      assert.deepEqual(result, {
        images: [ {
          type: 'jpeg',
          data: 'aW1n'
        } ],
        model: 'gemini-3.1-flash-image',
        usage: {
          inputTokens: 14,
          outputTokens: 1487
        }
      });
    });

    it('maps the lower quality tiers to the 1K resolution', async function() {
      httpScript = [ () => imageResponse() ];
      await instance().image(apos.task.getReq(), {
        prompt: 'a fox',
        count: 1,
        quality: 'medium',
        model: 'gemini-3.1-flash-image'
      });
      assert.deepEqual(httpCalls[0].options.body.response_format, {
        type: 'image',
        image_size: '1K'
      });
    });

    it('asks a 1K-only model for 1K whatever the quality', async function() {
      httpScript = [ () => imageResponse() ];
      await instance().image(apos.task.getReq(), {
        prompt: 'a fox',
        count: 1,
        aspect: '4:1',
        quality: 'high',
        model: 'gemini-3.1-flash-lite-image'
      });
      assert.deepEqual(httpCalls[0].options.body.response_format, {
        type: 'image',
        aspect_ratio: '4:1',
        image_size: '1K'
      });
    });

    it('fans a count out as concurrent requests, summing usage', async function() {
      httpScript = [
        () => imageResponse(),
        () => imageResponse({
          steps: [
            thoughtStep('sig-img'),
            {
              type: 'model_output',
              content: [
                text('here is your fox'),
                imageBlock({
                  mime_type: 'image/png',
                  data: 'aW1nMg=='
                })
              ]
            }
          ],
          usage: {
            total_input_tokens: 14,
            total_output_tokens: 1300,
            total_thought_tokens: 20
          }
        })
      ];
      const result = await instance().image(apos.task.getReq(), {
        prompt: 'a fox',
        count: 2,
        model: 'gemini-3.1-flash-image'
      });
      assert.equal(httpCalls.length, 2);
      // The second request start is staggered with jitter into its
      // own imageStagger slot; the first fires immediately
      assert.equal(waits.length, 1);
      assert(waits[0] >= 500 && waits[0] < 1000);
      // One image per request, the same body each time; commentary
      // text does not travel
      assert.deepEqual(httpCalls[0].options.body, httpCalls[1].options.body);
      assert.deepEqual(result.images, [
        {
          type: 'jpeg',
          data: 'aW1n'
        },
        {
          type: 'png',
          data: 'aW1nMg=='
        }
      ]);
      // Thinking tokens count as output
      assert.deepEqual(result.usage, {
        inputTokens: 28,
        outputTokens: 2807
      });
      assert.deepEqual(logRecords, []);
    });

    it('sums the image shares across fanned-out requests', async function() {
      // A generation's and an edit's usage as the service reports
      // them: the output lists name only the image tokens, the rest of
      // the output being text and thinking
      httpScript = [
        () => imageResponse({
          usage: {
            total_input_tokens: 14,
            input_tokens_by_modality: [ {
              modality: 'text',
              tokens: 14
            } ],
            total_output_tokens: 1463,
            output_tokens_by_modality: [ {
              modality: 'image',
              tokens: 1120
            } ],
            total_thought_tokens: 0,
            total_cached_tokens: 0,
            total_tokens: 1477
          }
        }),
        () => imageResponse({
          usage: {
            total_input_tokens: 1132,
            input_tokens_by_modality: [
              {
                modality: 'image',
                tokens: 1120
              },
              {
                modality: 'text',
                tokens: 12
              }
            ],
            total_output_tokens: 1287,
            output_tokens_by_modality: [ {
              modality: 'image',
              tokens: 1120
            } ],
            total_thought_tokens: 0,
            total_cached_tokens: 0,
            total_tokens: 2419
          }
        })
      ];
      const result = await instance().image(apos.task.getReq(), {
        prompt: 'a fox',
        count: 2,
        model: 'gemini-3.1-flash-image'
      });
      assert.deepEqual(result.usage, {
        inputTokens: 1146,
        outputTokens: 2750,
        imageInputTokens: 1120,
        imageOutputTokens: 2240
      });
    });

    it('delivers only the model_output images, never a thought step\'s', async function() {
      httpScript = [ () => imageResponse({
        steps: [
          {
            type: 'thought',
            signature: 'sig-img',
            summary: [ imageBlock({ data: 'ZHJhZnQ=' }) ]
          },
          {
            type: 'model_output',
            content: [ imageBlock() ]
          }
        ]
      }) ];
      const result = await instance().image(apos.task.getReq(), {
        prompt: 'a fox',
        count: 1,
        model: 'gemini-3.1-flash-image'
      });
      assert.deepEqual(result.images, [ {
        type: 'jpeg',
        data: 'aW1n'
      } ]);
    });

    it('delivers the survivors of a partial fan-out, logging the losses', async function() {
      httpScript = [
        () => imageResponse(),
        () => {
          throw httpError(500, {}, {
            error: {
              code: 'internal_error',
              message: 'internal error'
            }
          });
        },
        () => imageResponse()
      ];
      const result = await instance().image(apos.task.getReq(), {
        prompt: 'a fox',
        count: 3,
        model: 'gemini-3.1-flash-image'
      });
      assert.equal(result.images.length, 2);
      // Usage sums over the surviving requests only
      assert.deepEqual(result.usage, {
        inputTokens: 28,
        outputTokens: 2974
      });
      const [ record ] = logRecords;
      assert.equal(logRecords.length, 1);
      assert.equal(record.severity, 'error');
      assert.equal(record.type, 'image-partial');
      assert.equal(record.message, 'internal error');
      assert.equal(record.data.provider, 'google');
      assert.equal(record.data.model, 'gemini-3.1-flash-image');
      assert.equal(record.data.code, 'aiRetry');
      assert.equal(record.data.kind, 'overload');
      assert.equal(record.data.requested, 3);
      assert.equal(record.data.delivered, 2);
    });

    it('throws when every fanned-out request fails, leaving the engine to react', async function() {
      httpScript = [
        () => {
          throw httpError(500);
        },
        () => {
          throw httpError(500);
        }
      ];
      await assert.rejects(instance().image(apos.task.getReq(), {
        prompt: 'a fox',
        count: 2,
        model: 'gemini-3.1-flash-image'
      }), (e) => {
        // Raw, not normalized — the engine's retry wrapper owns that
        assert.equal(e.status, 500);
        return true;
      });
      assert.deepEqual(logRecords, []);
    });

    it('omits unset dials, and leaves usage the service never reported unset', async function() {
      httpScript = [ () => imageResponse({ usage: undefined }) ];
      const result = await instance().image(apos.task.getReq(), {
        prompt: 'a fox',
        count: 1,
        model: 'gemini-3-pro-image'
      });
      assert.deepEqual(httpCalls[0].options.body.response_format, {
        type: 'image'
      });
      assert.deepEqual(result.usage, {
        inputTokens: undefined,
        outputTokens: undefined
      });
    });

    it('edits with inline and service-hosted sources after the prompt', async function() {
      httpScript = [ () => imageResponse() ];
      await instance().image(apos.task.getReq(), {
        prompt: 'make the fox wear a red scarf',
        count: 1,
        aspect: '1:1',
        model: 'gemini-3.1-flash-image',
        images: [
          {
            data: 'aGk=',
            mediaType: 'image/png'
          },
          { url: 'https://generativelanguage.googleapis.com/v1beta/files/f1' }
        ]
      });
      assert.deepEqual(httpCalls[0].options.body.input, [ {
        type: 'user_input',
        content: [
          text('make the fox wear a red scarf'),
          {
            type: 'image',
            data: 'aGk=',
            mime_type: 'image/png'
          },
          {
            type: 'image',
            uri: 'https://generativelanguage.googleapis.com/v1beta/files/f1'
          }
        ]
      } ]);
    });

    it('fetches an external url source and inlines it', async function() {
      global.fetch = async (url, options) => {
        fetchCalls.push({
          url,
          options
        });
        return {
          ok: true,
          status: 200,
          headers: { get: (name) => (name === 'content-type' ? 'image/jpeg' : null) },
          arrayBuffer: async () => new Uint8Array([ 1, 2, 3 ]).buffer
        };
      };
      httpScript = [ () => imageResponse() ];
      await instance().image(apos.task.getReq(), {
        prompt: 'edit',
        count: 1,
        model: 'gemini-3.1-flash-image',
        images: [ { url: 'https://example.com/fox.jpg' } ]
      });
      assert.equal(fetchCalls[0].url, 'https://example.com/fox.jpg');
      assert.deepEqual(httpCalls[0].options.body.input[0].content[1], {
        type: 'image',
        data: 'AQID',
        mime_type: 'image/jpeg'
      });
    });

    it('rejects a url source that will not load', async function() {
      global.fetch = async () => ({
        ok: false,
        status: 404,
        headers: { get: () => null }
      });
      await assert.rejects(instance().image(apos.task.getReq(), {
        prompt: 'edit',
        count: 1,
        model: 'gemini-3.1-flash-image',
        images: [ { url: 'https://example.com/missing.png' } ]
      }), (e) => e.name === 'invalid');
      assert.equal(httpCalls.length, 0);
    });

    it('leaves a prompt blocked over HTTP to the engine, which reads a refusal', async function() {
      httpScript = [ () => {
        throw httpError(400, {}, {
          error: {
            code: 'invalid_request',
            message: 'Request blocked due to prohibited content guidelines. Please modify your input and retry.'
          }
        });
      } ];
      const error = await instance().image(apos.task.getReq(), {
        prompt: 'p',
        count: 1,
        model: 'gemini-3.1-flash-image'
      }).catch((e) => e);
      assert.equal(error.status, 400);
      assert.equal(instance().normalizeError(error).name, 'aiRefusal');
    });

    it('throws a failed interaction that produced no image as its errors say', async function() {
      httpScript = [ () => imageResponse({
        status: 'failed',
        steps: [],
        errors: [ {
          code: 'image_safety',
          message: 'blocked'
        } ]
      }) ];
      await assert.rejects(instance().image(apos.task.getReq(), {
        prompt: 'p',
        count: 1,
        model: 'gemini-3.1-flash-image'
      }), (e) => e.name === 'aiRefusal');
      httpScript = [ () => imageResponse({
        status: 'failed',
        steps: [],
        errors: [ {
          code: 'no_image',
          message: 'no image'
        } ]
      }) ];
      await assert.rejects(instance().image(apos.task.getReq(), {
        prompt: 'p',
        count: 1,
        model: 'gemini-3.1-flash-image'
      }), (e) => e.name === 'aiRetry');
    });

    it('delivers the images beside a failed interaction in a fan-out', async function() {
      httpScript = [
        () => imageResponse({
          status: 'failed',
          steps: [],
          errors: [ {
            code: 'image_safety',
            message: 'blocked'
          } ]
        }),
        () => imageResponse()
      ];
      const result = await instance().image(apos.task.getReq(), {
        prompt: 'p',
        count: 2,
        model: 'gemini-3.1-flash-image'
      });
      assert.deepEqual(result.images, [ {
        type: 'jpeg',
        data: 'aW1n'
      } ]);
    });
  });
});
