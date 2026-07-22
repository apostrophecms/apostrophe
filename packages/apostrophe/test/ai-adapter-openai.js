const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('AI adapter: openai', function() {
  this.timeout(t.timeout);

  let apos;
  // The adapter module instance, for unit access to the dialect methods
  let adapter;
  let savedLiveKey;

  before(async function() {
    // A real key in the environment would override the fixture keys
    // below (envKey); keep the suite hermetic and restore at the end
    savedLiveKey = process.env.APOS_OPENAI_KEY;
    delete process.env.APOS_OPENAI_KEY;
    apos = await t.create({
      root: module,
      modules: {
        'tool-fixtures': {
          init(self) {
            self.apos.ai.addTool({
              name: 'echo',
              description: 'Echo the value back',
              access: 'read',
              input: {
                type: 'object',
                properties: { value: { type: 'string' } },
                required: [ 'value' ]
              },
              schema: { value: { type: 'string' } },
              handler: (req, args) => ({ value: args.value })
            });
          }
        },
        '@apostrophecms/ai': {
          options: {
            provider: 'openai',
            providers: {
              openai: { apiKey: 'sk-test' },
              gateway: {
                adapter: 'openai',
                apiKey: 'sk-gw',
                baseUrl: 'https://llm-gateway.example.com/openai/v1'
              }
            },
            // Keep retried tests fast; the delay engine has its own suite
            retryBaseDelay: 1
          }
        }
      }
    });
    adapter = apos.modules['@apostrophecms/ai-adapter-openai'];
  });

  after(async function() {
    if (savedLiveKey !== undefined) {
      process.env.APOS_OPENAI_KEY = savedLiveKey;
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
    model: 'gpt-5.6-terra',
    maxTokens: 128000,
    cache: false,
    ...extras
  });
  // Canned Responses API output items and response body
  const messageItem = (value) => ({
    type: 'message',
    id: 'msg_1',
    role: 'assistant',
    status: 'completed',
    content: [ {
      type: 'output_text',
      text: value,
      annotations: []
    } ]
  });
  const callItem = (extras = {}) => ({
    type: 'function_call',
    id: 'fc_1',
    call_id: 'call_1',
    name: 'find_pages',
    arguments: '{"title":"Pricing"}',
    status: 'completed',
    ...extras
  });
  const reasoningItem = (extras = {}) => ({
    type: 'reasoning',
    id: 'rs_1',
    summary: [],
    encrypted_content: 'gAAAAB-opaque',
    ...extras
  });
  const fixture = (extras = {}) => ({
    id: 'resp_1',
    object: 'response',
    status: 'completed',
    model: 'gpt-5.6-terra-2026-06-26',
    output: [ messageItem('a haiku') ],
    usage: {
      input_tokens: 12,
      output_tokens: 7
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
    assert(apos.ai.getAdapter('openai'));
    assert.equal(apos.ai.getAdapter('openai').envKey, 'APOS_OPENAI_KEY');
    assert.equal(apos.ai.active, true);
    const info = apos.ai.modelInfo();
    assert.equal(info.provider, 'openai');
    assert.equal(info.model, 'gpt-5.6-terra');
    assert.equal(info.contextWindow, 1050000);
    assert.equal(info.maxOutputTokens, 128000);
    const high = apos.ai.modelInfo({ effort: 'high' });
    assert.equal(high.model, 'gpt-5.6-sol');
    assert.equal(high.reasoning, 'high');
  });

  describe('request translation', function() {
    it('builds the minimal stateless body', function() {
      assert.deepEqual(adapter.buildBody(request()), {
        model: 'gpt-5.6-terra',
        store: false,
        input: [ {
          role: 'user',
          content: [ {
            type: 'input_text',
            text: 'write a haiku about cats'
          } ]
        } ],
        max_output_tokens: 128000
      });
    });

    it('sends the system prompt as instructions', function() {
      const body = adapter.buildBody(request({ system: 'You help editors.' }));
      assert.equal(body.instructions, 'You help editors.');
      assert.equal(body.input.length, 1);
      assert.equal(body.input[0].role, 'user');
    });

    it('translates both image forms to input_image parts', function() {
      const body = adapter.buildBody(request({
        messages: [ {
          role: 'user',
          content: [
            text('describe these'),
            {
              type: 'image',
              image: { url: 'https://example.com/a.png' }
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
      assert.deepEqual(body.input[0].content, [
        {
          type: 'input_text',
          text: 'describe these'
        },
        {
          type: 'input_image',
          image_url: 'https://example.com/a.png'
        },
        {
          type: 'input_image',
          image_url: 'data:image/png;base64,aGk='
        }
      ]);
    });

    it('sends reasoning as the effort object', function() {
      assert.equal(adapter.buildBody(request()).reasoning, undefined);
      assert.deepEqual(
        adapter.buildBody(request({ reasoning: 'high' })).reasoning,
        { effort: 'high' }
      );
    });

    it('asks for encrypted reasoning content only when tools ride along', function() {
      const tools = [ {
        name: 'find_pages',
        description: 'Find pages',
        input: { type: 'object' }
      } ];
      assert.equal(
        'include' in adapter.buildBody(request({ reasoning: 'high' })),
        false
      );
      assert.equal(
        'include' in adapter.buildBody(request({ tools })),
        false
      );
      assert.deepEqual(
        adapter.buildBody(request({
          reasoning: 'high',
          tools
        })).include,
        [ 'reasoning.encrypted_content' ]
      );
    });

    it('omits the token cap when none resolved', function() {
      const body = adapter.buildBody(request({ maxTokens: undefined }));
      assert.equal('max_output_tokens' in body, false);
    });

    it('places nothing for any cache policy', function() {
      for (const cache of [ { ttl: 'short' }, { ttl: 'long' } ]) {
        assert.deepEqual(
          adapter.buildBody(request({ cache })),
          adapter.buildBody(request())
        );
      }
    });

    it('translates tool definitions to flattened non-strict function tools', function() {
      const input = {
        type: 'object',
        properties: { title: { type: 'string' } }
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
        parameters: input,
        strict: false
      } ]);
    });

    it('translates an assistant turn part by part, in order', function() {
      const item = reasoningItem();
      const body = adapter.buildBody(request({
        messages: [ {
          role: 'assistant',
          content: [
            {
              type: 'reasoning',
              item
            },
            text('searching'),
            {
              type: 'toolCall',
              id: 'call_1',
              name: 'find_pages',
              input: { title: 'Pricing' }
            }
          ]
        } ]
      }));
      assert.deepEqual(body.input, [
        item,
        {
          role: 'assistant',
          content: [ {
            type: 'output_text',
            text: 'searching'
          } ]
        },
        {
          type: 'function_call',
          call_id: 'call_1',
          name: 'find_pages',
          arguments: JSON.stringify({ title: 'Pricing' })
        }
      ]);
    });

    it('skips assistant parts another dialect owns', function() {
      const body = adapter.buildBody(request({
        messages: [ {
          role: 'assistant',
          content: [
            {
              type: 'thinking',
              thinking: 'hidden',
              signature: 'sig'
            },
            text('visible')
          ]
        } ]
      }));
      assert.deepEqual(body.input, [ {
        role: 'assistant',
        content: [ {
          type: 'output_text',
          text: 'visible'
        } ]
      } ]);
    });

    it('fans a tool batch into one function_call_output item per result', function() {
      const body = adapter.buildBody(request({
        messages: [ {
          role: 'tool',
          content: [
            {
              type: 'toolResult',
              toolCallId: 'call_1',
              output: { id: 'p1' }
            },
            {
              type: 'toolResult',
              toolCallId: 'call_2',
              error: 'not found'
            }
          ]
        } ]
      }));
      assert.deepEqual(body.input, [
        {
          type: 'function_call_output',
          call_id: 'call_1',
          output: JSON.stringify({ id: 'p1' })
        },
        {
          type: 'function_call_output',
          call_id: 'call_2',
          output: 'not found'
        }
      ]);
    });

    it('sends a structured-output schema as the non-strict json_schema text format', function() {
      const schema = {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: [ 'title' ]
      };
      const body = adapter.buildBody(request({ schema }));
      assert.deepEqual(body.text, {
        format: {
          type: 'json_schema',
          name: 'response',
          schema,
          strict: false
        }
      });
    });
  });

  describe('response parsing', function() {
    it('parses a text turn', function() {
      assert.deepEqual(adapter.parseResponse(fixture()), {
        content: [ text('a haiku') ],
        finishReason: 'stop',
        usage: {
          inputTokens: 12,
          outputTokens: 7
        },
        model: 'gpt-5.6-terra-2026-06-26'
      });
    });

    it('derives the finish reason from status and output', function() {
      for (const [ extras, ours ] of [
        [ {}, 'stop' ],
        [ { output: [ callItem() ] }, 'toolCalls' ],
        [ {
          status: 'incomplete',
          incomplete_details: { reason: 'max_output_tokens' }
        }, 'length' ],
        [ {
          status: 'incomplete',
          incomplete_details: { reason: 'content_filter' }
        }, 'refusal' ],
        [ {
          status: 'incomplete',
          incomplete_details: { reason: 'weird' }
        }, undefined ],
        // Unknown statuses yield none: the engine treats the turn as
        // malformed and retries, never a truncated success
        [ { status: 'failed' }, undefined ]
      ]) {
        assert.equal(
          adapter.parseResponse(fixture(extras)).finishReason,
          ours
        );
      }
    });

    it('translates function calls, parsing their arguments', function() {
      const turn = adapter.parseResponse(fixture({
        output: [ callItem() ]
      }));
      assert.deepEqual(turn.content, [ {
        type: 'toolCall',
        id: 'call_1',
        name: 'find_pages',
        input: { title: 'Pricing' }
      } ]);
      assert.equal(turn.finishReason, 'toolCalls');
    });

    it('carries a replayable reasoning item as an opaque part, drops a bare one', function() {
      const item = reasoningItem();
      const turn = adapter.parseResponse(fixture({
        output: [ item, callItem() ]
      }));
      assert.deepEqual(turn.content[0], {
        type: 'reasoning',
        item
      });
      assert.equal(turn.content[1].type, 'toolCall');

      const bare = adapter.parseResponse(fixture({
        output: [
          reasoningItem({ encrypted_content: undefined }),
          messageItem('a haiku')
        ]
      }));
      assert.deepEqual(bare.content, [ text('a haiku') ]);
    });

    it('throws the refusal error on a refusal part', function() {
      assert.throws(
        () => adapter.parseResponse(fixture({
          output: [ {
            type: 'message',
            id: 'msg_1',
            role: 'assistant',
            status: 'completed',
            content: [ {
              type: 'refusal',
              refusal: 'I cannot help with that.'
            } ]
          } ]
        })),
        (e) => {
          assert.equal(e.name, 'aiRefusal');
          assert.equal(e.message, 'I cannot help with that.');
          return true;
        }
      );
    });

    it('parses the structured answer onto the turn object', function() {
      const object = {
        title: 'Pricing',
        description: 'Our plans'
      };
      const turn = adapter.parseResponse(
        fixture({ output: [ messageItem(JSON.stringify(object)) ] }),
        request({ schema: { type: 'object' } })
      );
      assert.deepEqual(turn.object, object);
      // The JSON also stays on the content so the transcript round-trips
      assert.deepEqual(turn.content, [ text(JSON.stringify(object)) ]);
    });

    it('treats malformed structured JSON as a retryable response', function() {
      assert.throws(
        () => adapter.parseResponse(
          fixture({ output: [ messageItem('not json') ] }),
          request({ schema: { type: 'object' } })
        ),
        (e) => {
          assert.equal(e.name, 'aiRetry');
          assert.match(e.message, /malformed structured JSON/);
          return true;
        }
      );
    });

    it('leaves the turn object unset without a schema request', function() {
      const turn = adapter.parseResponse(fixture({
        output: [ messageItem('{"a":1}') ]
      }));
      assert.equal('object' in turn, false);
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

    it('prefers the provider message and carries the request id', function() {
      const error = adapter.normalizeError(httpError(401, {
        'x-request-id': 'req_9'
      }, {
        error: {
          message: 'Incorrect API key provided',
          type: 'invalid_request_error',
          code: 'invalid_api_key'
        }
      }));
      assert.equal(error.message, 'Incorrect API key provided');
      assert.equal(error.data.requestId, 'req_9');
    });

    it('parses Retry-After as seconds and as an HTTP date', function() {
      const seconds = adapter.normalizeError(httpError(429, { 'retry-after': '7' }));
      assert.equal(seconds.data.retryAfter, 7);
      const date = adapter.normalizeError(httpError(429, {
        'retry-after': new Date(Date.now() + 30000).toUTCString()
      }));
      assert(date.data.retryAfter >= 28 && date.data.retryAfter <= 31);
      const garbage = adapter.normalizeError(httpError(429, { 'retry-after': 'soon' }));
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
      assert.equal(result.provider, 'openai');
      // The model the response named, not the routed alias
      assert.equal(result.model, 'gpt-5.6-terra-2026-06-26');
      assert.deepEqual(result.usage, {
        inputTokens: 12,
        outputTokens: 7
      });

      const [ call ] = httpCalls;
      assert.equal(call.url, 'https://api.openai.com/v1/responses');
      assert.equal(call.options.headers.authorization, 'Bearer sk-test');
      assert.equal(call.options.timeout, 600000);
      // The whole body: the default short cache policy adds nothing
      assert.deepEqual(call.options.body, {
        model: 'gpt-5.6-terra',
        store: false,
        input: [ {
          role: 'user',
          content: [ {
            type: 'input_text',
            text: 'write a haiku about cats'
          } ]
        } ],
        max_output_tokens: 128000
      });
    });

    it('honors an aliased entry: its baseUrl, key and merged model metadata', async function() {
      httpScript = [ () => fixture() ];
      await apos.ai.generate(apos.task.getReq(), 'p', {
        provider: 'gateway',
        model: 'gpt-5.6-terra'
      });
      const [ call ] = httpCalls;
      assert.equal(call.url, 'https://llm-gateway.example.com/openai/v1/responses');
      assert.equal(call.options.headers.authorization, 'Bearer sk-gw');
      assert.equal(call.options.body.max_output_tokens, 128000);
    });

    it('drives a reasoning tool loop end to end, replaying the reasoning item', async function() {
      const item = reasoningItem();
      httpScript = [
        () => fixture({
          output: [
            item,
            callItem({
              name: 'echo',
              arguments: JSON.stringify({ value: 'pricing' })
            })
          ]
        }),
        () => fixture({ output: [ messageItem('done') ] })
      ];
      const result = await apos.ai.generate(apos.task.getReq(), 'use the tool', {
        tools: [ 'echo' ],
        reasoning: 'high'
      });
      assert.equal(result.text, 'done');
      assert.equal(result.finishReason, 'stop');
      assert.deepEqual(result.steps, [ {
        toolCall: {
          type: 'toolCall',
          id: 'call_1',
          name: 'echo',
          input: { value: 'pricing' }
        },
        result: { value: 'pricing' }
      } ]);
      assert.equal(httpCalls.length, 2);
      // The first wire call asked for the replayable reasoning content
      assert.deepEqual(
        httpCalls[0].options.body.include,
        [ 'reasoning.encrypted_content' ]
      );
      // The second replays the whole exchange: the reasoning item
      // verbatim ahead of its function call, then the result
      assert.deepEqual(httpCalls[1].options.body.input.slice(1), [
        item,
        {
          type: 'function_call',
          call_id: 'call_1',
          name: 'echo',
          arguments: JSON.stringify({ value: 'pricing' })
        },
        {
          type: 'function_call_output',
          call_id: 'call_1',
          output: JSON.stringify({ value: 'pricing' })
        }
      ]);
    });

    it('returns a validated object for a structured call over the wire', async function() {
      const object = {
        title: 'Pricing',
        description: 'Our plans'
      };
      httpScript = [ () => fixture({
        output: [ messageItem(JSON.stringify(object)) ]
      }) ];
      const result = await apos.ai.generate(apos.task.getReq(), {
        messages: [ {
          role: 'user',
          content: 'write the metadata'
        } ],
        schema: {
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
        }
      });
      assert.deepEqual(result.object, object);
      // The schema went out as the json_schema text format
      const { body } = httpCalls[0].options;
      assert.equal(body.text.format.type, 'json_schema');
      assert.deepEqual(
        body.text.format.schema.required,
        [ 'title', 'description' ]
      );
    });

    it('retries a 429 at the Retry-After delay', async function() {
      httpScript = [
        () => {
          throw httpError(429, {
            'retry-after': '2',
            'x-request-id': 'req_9'
          }, {
            error: {
              message: 'Rate limit reached',
              type: 'tokens',
              code: 'rate_limit_exceeded'
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
      assert.equal(record.message, 'Rate limit reached');
      assert.equal(record.data.kind, 'rateLimit');
      assert.equal(record.data.status, 429);
      assert.equal(record.data.retryAfter, 2);
      assert.equal(record.data.requestId, 'req_9');
    });

    it('surfaces a refusal part as the refusal error, without a retry', async function() {
      httpScript = [ () => fixture({
        output: [ {
          type: 'message',
          id: 'msg_1',
          role: 'assistant',
          status: 'completed',
          content: [ {
            type: 'refusal',
            refusal: 'I cannot help with that.'
          } ]
        } ]
      }) ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.equal(e.name, 'aiRefusal');
        return true;
      });
      assert.equal(httpCalls.length, 1);
    });
  });

  describe('live smoke', function() {
    const liveKey = process.env.APOS_OPENAI_KEY;
    let liveApos;

    before(async function() {
      if (!liveKey) {
        this.skip();
      }
      await t.destroy(apos);
      apos = null;
      liveApos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/ai': {
            options: {
              providers: {
                openai: { apiKey: liveKey }
              }
            }
          }
        }
      });
    });

    after(async function() {
      if (liveApos) {
        return t.destroy(liveApos);
      }
    });

    it('generates against OpenAI for real', async function() {
      const result = await liveApos.ai.generate(
        liveApos.task.getReq(),
        'write a haiku about cats',
        {
          effort: 'low',
          // Room for the model's reasoning tokens ahead of the text
          maxTokens: 2000,
          cache: false
        }
      );
      assert(result.text.length > 0);
      assert.equal(result.provider, 'openai');
      assert.equal(result.finishReason, 'stop');
      assert(Number.isFinite(result.usage.inputTokens));
      assert(Number.isFinite(result.usage.outputTokens));
    });
  });
});
