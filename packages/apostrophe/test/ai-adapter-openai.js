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
  // A canned Chat Completions choice and response body
  const choice = (extras = {}) => ({
    index: 0,
    message: {
      role: 'assistant',
      content: 'a haiku',
      refusal: null
    },
    finish_reason: 'stop',
    ...extras
  });
  const fixture = (extras = {}) => ({
    id: 'chatcmpl-1',
    object: 'chat.completion',
    model: 'gpt-5.6-terra-2026-06-26',
    choices: [ choice() ],
    usage: {
      prompt_tokens: 12,
      completion_tokens: 7
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
    it('builds the minimal body, collapsing one text part to a string', function() {
      assert.deepEqual(adapter.buildBody(request()), {
        model: 'gpt-5.6-terra',
        messages: [ {
          role: 'user',
          content: 'write a haiku about cats'
        } ],
        max_completion_tokens: 128000
      });
    });

    it('leads with the system prompt as a system message', function() {
      const body = adapter.buildBody(request({ system: 'You help editors.' }));
      assert.deepEqual(body.messages, [
        {
          role: 'system',
          content: 'You help editors.'
        },
        {
          role: 'user',
          content: 'write a haiku about cats'
        }
      ]);
    });

    it('keeps multi-part content as parts and translates both image forms', function() {
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
      assert.deepEqual(body.messages[0].content, [
        {
          type: 'text',
          text: 'describe these'
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/a.png' }
        },
        {
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,aGk=' }
        }
      ]);
    });

    it('passes reasoning through as reasoning_effort', function() {
      assert.equal(adapter.buildBody(request()).reasoning_effort, undefined);
      assert.equal(
        adapter.buildBody(request({ reasoning: 'high' })).reasoning_effort,
        'high'
      );
    });

    it('omits the token cap when none resolved', function() {
      const body = adapter.buildBody(request({ maxTokens: undefined }));
      assert.equal('max_completion_tokens' in body, false);
    });

    it('places nothing for any cache policy', function() {
      for (const cache of [ { ttl: 'short' }, { ttl: 'long' } ]) {
        assert.deepEqual(
          adapter.buildBody(request({ cache })),
          adapter.buildBody(request())
        );
      }
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

    it('maps the finish reasons', function() {
      for (const [ theirs, ours ] of [
        [ 'stop', 'stop' ],
        [ 'length', 'length' ],
        [ 'tool_calls', 'toolCalls' ],
        // The engine converts the refusal finish reason to the
        // refusal error
        [ 'content_filter', 'refusal' ],
        // Unknown reasons yield none: the engine treats the turn as
        // malformed and retries, never a truncated success
        [ 'weird', undefined ]
      ]) {
        assert.equal(
          adapter.parseResponse(fixture({
            choices: [ choice({ finish_reason: theirs }) ]
          })).finishReason,
          ours
        );
      }
    });

    it('translates tool calls, parsing their arguments', function() {
      const turn = adapter.parseResponse(fixture({
        choices: [ choice({
          message: {
            role: 'assistant',
            content: null,
            refusal: null,
            tool_calls: [ {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'find_pages',
                arguments: '{"title":"Pricing"}'
              }
            } ]
          },
          finish_reason: 'tool_calls'
        }) ]
      }));
      assert.deepEqual(turn.content, [ {
        type: 'toolCall',
        id: 'call_1',
        name: 'find_pages',
        input: { title: 'Pricing' }
      } ]);
      assert.equal(turn.finishReason, 'toolCalls');
    });

    it('throws the refusal error on an in-body refusal', function() {
      assert.throws(
        () => adapter.parseResponse(fixture({
          choices: [ choice({
            message: {
              role: 'assistant',
              content: null,
              refusal: 'I cannot help with that.'
            }
          }) ]
        })),
        (e) => {
          assert.equal(e.name, 'aiRefusal');
          assert.equal(e.message, 'I cannot help with that.');
          return true;
        }
      );
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
      assert.equal(call.url, 'https://api.openai.com/v1/chat/completions');
      assert.equal(call.options.headers.authorization, 'Bearer sk-test');
      assert.equal(call.options.timeout, 600000);
      // The whole body: the default short cache policy adds nothing
      assert.deepEqual(call.options.body, {
        model: 'gpt-5.6-terra',
        messages: [ {
          role: 'user',
          content: 'write a haiku about cats'
        } ],
        max_completion_tokens: 128000
      });
    });

    it('honors an aliased entry: its baseUrl, key and merged model metadata', async function() {
      httpScript = [ () => fixture() ];
      await apos.ai.generate(apos.task.getReq(), 'p', {
        provider: 'gateway',
        model: 'gpt-5.6-terra'
      });
      const [ call ] = httpCalls;
      assert.equal(call.url, 'https://llm-gateway.example.com/openai/v1/chat/completions');
      assert.equal(call.options.headers.authorization, 'Bearer sk-gw');
      assert.equal(call.options.body.max_completion_tokens, 128000);
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

    it('hard-stops a 401 as forbidden', async function() {
      httpScript = [ () => {
        throw httpError(401, { 'x-request-id': 'req_1' }, {
          error: {
            message: 'Incorrect API key provided',
            type: 'invalid_request_error',
            code: 'invalid_api_key'
          }
        });
      } ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.equal(e.name, 'forbidden');
        assert.equal(e.message, 'Incorrect API key provided');
        return true;
      });
      assert.equal(httpCalls.length, 1);
      assert.deepEqual(
        logRecords.map((record) => [ record.type, record.data.code ]),
        [ [ 'failure', 'forbidden' ] ]
      );
    });

    it('surfaces an in-body refusal as the refusal error, without a retry', async function() {
      httpScript = [ () => fixture({
        choices: [ choice({
          message: {
            role: 'assistant',
            content: null,
            refusal: 'I cannot help with that.'
          }
        }) ]
      }) ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.equal(e.name, 'aiRefusal');
        return true;
      });
      assert.equal(httpCalls.length, 1);
    });

    it('retries an unknown finish reason as a malformed turn', async function() {
      httpScript = [
        () => fixture({ choices: [ choice({ finish_reason: 'weird' }) ] }),
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
