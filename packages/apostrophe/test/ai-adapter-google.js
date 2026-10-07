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
      assert.deepEqual(body.input[1], {
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

    it('groups each run of text and image parts into one model_output step', function() {
      const body = adapter.buildBody(request({
        messages: [ {
          role: 'assistant',
          content: [
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
          code: 400,
          message: 'API key not valid. Please pass a valid API key.',
          status: 'INVALID_ARGUMENT'
        }
      }));
      assert.equal(error.name, 'invalid');
      assert.equal(error.message, 'API key not valid. Please pass a valid API key.');
    });

    it('reads the retry hint from the header or the RetryInfo detail', function() {
      const header = adapter.normalizeError(httpError(429, { 'retry-after': '7' }));
      assert.equal(header.data.retryAfter, 7);
      const detail = adapter.normalizeError(httpError(429, {}, {
        error: {
          code: 429,
          message: 'Resource has been exhausted (e.g. check quota).',
          status: 'RESOURCE_EXHAUSTED',
          details: [ {
            '@type': 'type.googleapis.com/google.rpc.RetryInfo',
            retryDelay: '37s'
          } ]
        }
      }));
      assert.equal(detail.data.retryAfter, 37);
      const garbage = adapter.normalizeError(httpError(429, {}, {
        error: {
          code: 429,
          message: 'Resource has been exhausted (e.g. check quota).',
          status: 'RESOURCE_EXHAUSTED',
          details: [ {
            '@type': 'type.googleapis.com/google.rpc.RetryInfo',
            retryDelay: 'soon'
          } ]
        }
      }));
      assert.equal(garbage.data.retryAfter, undefined);
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

    it('retries a 429 at the RetryInfo delay', async function() {
      httpScript = [
        () => {
          throw httpError(429, {}, {
            error: {
              code: 429,
              message: 'Resource has been exhausted (e.g. check quota).',
              status: 'RESOURCE_EXHAUSTED',
              details: [ {
                '@type': 'type.googleapis.com/google.rpc.RetryInfo',
                retryDelay: '2s'
              } ]
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
      assert.equal(record.message, 'Resource has been exhausted (e.g. check quota).');
      assert.equal(record.data.kind, 'rateLimit');
      assert.equal(record.data.status, 429);
      assert.equal(record.data.retryAfter, 2);
    });

    it('hard-stops an invalid API key, arriving as the 400 quirk', async function() {
      httpScript = [ () => {
        throw httpError(400, {}, {
          error: {
            code: 400,
            message: 'API key not valid. Please pass a valid API key.',
            status: 'INVALID_ARGUMENT'
          }
        });
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
    const imagePart = (extras = {}) => ({
      inlineData: {
        mimeType: 'image/png',
        data: 'aW1n'
      },
      ...extras
    });
    const imageResponse = (extras = {}) => ({
      candidates: [ {
        content: {
          role: 'model',
          parts: [ imagePart() ]
        },
        finishReason: 'STOP',
        index: 0
      } ],
      usageMetadata: {
        promptTokenCount: 9,
        candidatesTokenCount: 1290
      },
      modelVersion: 'gemini-3.1-flash-image',
      ...extras
    });

    it('declares the current image models and their shared ratio set', function() {
      const { models } = apos.ai.getAdapter('google');
      const aspects = [
        '1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'
      ];
      assert.deepEqual(models['gemini-3.1-flash-image'].aspects, aspects);
      assert.deepEqual(models['gemini-3-pro-image'].aspects, aspects);
      assert.deepEqual(models['gemini-3.1-flash-lite-image'].aspects, aspects);
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
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent'
      );
      assert.equal(call.options.headers['x-goog-api-key'], 'sk-test');
      assert.equal(call.options.timeout, 600000);
      assert.deepEqual(call.options.body, {
        contents: [ {
          role: 'user',
          parts: [ { text: 'a watercolor fox' } ]
        } ],
        generationConfig: {
          responseModalities: [ 'TEXT', 'IMAGE' ],
          imageConfig: {
            aspectRatio: '16:9',
            imageSize: '2K'
          }
        }
      });
      assert.deepEqual(result, {
        images: [ {
          type: 'png',
          data: 'aW1n'
        } ],
        model: 'gemini-3.1-flash-image',
        usage: {
          inputTokens: 9,
          outputTokens: 1290
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
      assert.deepEqual(httpCalls[0].options.body.generationConfig.imageConfig, {
        imageSize: '1K'
      });
    });

    it('fans a count out as concurrent requests, summing usage', async function() {
      httpScript = [
        () => imageResponse(),
        () => imageResponse({
          candidates: [ {
            content: {
              role: 'model',
              parts: [
                { text: 'here is your fox' },
                imagePart({
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: 'aW1nMg=='
                  }
                })
              ]
            },
            finishReason: 'STOP',
            index: 0
          } ],
          usageMetadata: {
            promptTokenCount: 9,
            candidatesTokenCount: 1300
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
      // text parts do not travel
      assert.deepEqual(httpCalls[0].options.body, httpCalls[1].options.body);
      assert.deepEqual(result.images, [
        {
          type: 'png',
          data: 'aW1n'
        },
        {
          type: 'jpeg',
          data: 'aW1nMg=='
        }
      ]);
      assert.deepEqual(result.usage, {
        inputTokens: 18,
        outputTokens: 2590
      });
      assert.deepEqual(logRecords, []);
    });

    it('delivers the survivors of a partial fan-out, logging the losses', async function() {
      httpScript = [
        () => imageResponse(),
        () => {
          throw httpError(500, {}, {
            error: { message: 'internal error' }
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
        inputTokens: 18,
        outputTokens: 2580
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
      httpScript = [ () => imageResponse({ usageMetadata: undefined }) ];
      const result = await instance().image(apos.task.getReq(), {
        prompt: 'a fox',
        count: 1,
        model: 'gemini-3-pro-image'
      });
      assert.deepEqual(httpCalls[0].options.body.generationConfig, {
        responseModalities: [ 'TEXT', 'IMAGE' ]
      });
      assert.deepEqual(result.usage, {
        inputTokens: undefined,
        outputTokens: undefined
      });
    });

    it('edits with inline and service-hosted sources as parts after the prompt', async function() {
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
      assert.deepEqual(httpCalls[0].options.body.contents, [ {
        role: 'user',
        parts: [
          { text: 'make the fox wear a red scarf' },
          {
            inlineData: {
              mimeType: 'image/png',
              data: 'aGk='
            }
          },
          {
            fileData: { fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/f1' }
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
      assert.deepEqual(httpCalls[0].options.body.contents[0].parts[1], {
        inlineData: {
          mimeType: 'image/jpeg',
          data: 'AQID'
        }
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

    it('throws the refusal error on a blocked prompt', async function() {
      httpScript = [ () => ({
        promptFeedback: { blockReason: 'SAFETY' },
        usageMetadata: { promptTokenCount: 9 }
      }) ];
      await assert.rejects(instance().image(apos.task.getReq(), {
        prompt: 'p',
        count: 1,
        model: 'gemini-3.1-flash-image'
      }), (e) => e.name === 'aiRefusal');
    });

    it('throws the refusal error on a safety finish that produced no image', async function() {
      httpScript = [ () => imageResponse({
        candidates: [ {
          content: {
            role: 'model',
            parts: []
          },
          finishReason: 'IMAGE_SAFETY',
          index: 0
        } ]
      }) ];
      await assert.rejects(instance().image(apos.task.getReq(), {
        prompt: 'p',
        count: 1,
        model: 'gemini-3.1-flash-image'
      }), (e) => e.name === 'aiRefusal');
    });
  });
});
