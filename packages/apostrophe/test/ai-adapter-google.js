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
    model: 'gemini-3.5-flash',
    maxTokens: 65536,
    cache: false,
    ...extras
  });
  // A canned generateContent candidate and response body
  const candidate = (extras = {}) => ({
    content: {
      role: 'model',
      parts: [ { text: 'a haiku' } ]
    },
    finishReason: 'STOP',
    index: 0,
    ...extras
  });
  const fixture = (extras = {}) => ({
    candidates: [ candidate() ],
    usageMetadata: {
      promptTokenCount: 12,
      candidatesTokenCount: 7,
      totalTokenCount: 19
    },
    modelVersion: 'gemini-3.5-flash-0519',
    responseId: 'resp_1',
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
    assert.equal(info.model, 'gemini-3.5-flash');
    assert.equal(info.contextWindow, 1048576);
    assert.equal(info.maxOutputTokens, 65536);
    assert.equal(apos.ai.modelInfo({ effort: 'low' }).model, 'gemini-3.1-flash-lite');
    const high = apos.ai.modelInfo({ effort: 'high' });
    assert.equal(high.model, 'gemini-3.5-flash');
    assert.equal(high.reasoning, 'high');
  });

  describe('request translation', function() {
    it('builds the minimal body', function() {
      assert.deepEqual(adapter.buildBody(request()), {
        contents: [ {
          role: 'user',
          parts: [ { text: 'write a haiku about cats' } ]
        } ],
        generationConfig: { maxOutputTokens: 65536 }
      });
    });

    it('carries the system prompt as systemInstruction', function() {
      const body = adapter.buildBody(request({ system: 'You help editors.' }));
      assert.deepEqual(body.systemInstruction, {
        parts: [ { text: 'You help editors.' } ]
      });
      assert.equal(body.contents.length, 1);
    });

    it('translates the assistant role to model', function() {
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
      assert.deepEqual(
        body.contents.map((content) => content.role),
        [ 'user', 'model', 'user' ]
      );
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
      assert.deepEqual(body.contents[0].parts.slice(1), [
        {
          fileData: {
            fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/f1'
          }
        },
        {
          inlineData: {
            mimeType: 'image/png',
            data: 'aGk='
          }
        }
      ]);
    });

    it('passes reasoning through as the thinking level', function() {
      assert.equal(
        adapter.buildBody(request()).generationConfig.thinkingConfig,
        undefined
      );
      assert.deepEqual(
        adapter.buildBody(request({ reasoning: 'high' })).generationConfig,
        {
          maxOutputTokens: 65536,
          thinkingConfig: { thinkingLevel: 'high' }
        }
      );
    });

    it('omits generationConfig entirely when nothing resolved', function() {
      const body = adapter.buildBody(request({ maxTokens: undefined }));
      assert.equal('generationConfig' in body, false);
    });

    it('places nothing for any cache policy', function() {
      for (const cache of [ { ttl: 'short' }, { ttl: 'long' } ]) {
        assert.deepEqual(
          adapter.buildBody(request({ cache })),
          adapter.buildBody(request())
        );
      }
    });

    it('translates tool definitions to functionDeclarations', function() {
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
        functionDeclarations: [ {
          name: 'find_pages',
          description: 'Find pages',
          parameters: input
        } ]
      } ]);
    });

    it('carries tool calls and results, recovering the response name from the call id', function() {
      const body = adapter.buildBody(request({
        messages: [
          {
            role: 'assistant',
            content: [
              text('searching'),
              {
                type: 'toolCall',
                id: 'find_pages-0',
                name: 'find_pages',
                input: { title: 'Pricing' }
              }
            ]
          },
          {
            role: 'tool',
            content: [ {
              type: 'toolResult',
              toolCallId: 'find_pages-0',
              output: { id: 'p1' }
            } ]
          }
        ]
      }));
      assert.deepEqual(body.contents, [
        {
          role: 'model',
          parts: [
            { text: 'searching' },
            {
              functionCall: {
                name: 'find_pages',
                args: { title: 'Pricing' }
              }
            }
          ]
        },
        {
          role: 'user',
          parts: [ {
            functionResponse: {
              name: 'find_pages',
              response: { id: 'p1' }
            }
          } ]
        }
      ]);
    });

    it('wraps a tool error result in the functionResponse', function() {
      const body = adapter.buildBody(request({
        messages: [
          {
            role: 'assistant',
            content: [ {
              type: 'toolCall',
              id: 'x-0',
              name: 'x',
              input: {}
            } ]
          },
          {
            role: 'tool',
            content: [ {
              type: 'toolResult',
              toolCallId: 'x-0',
              error: 'boom'
            } ]
          }
        ]
      }));
      assert.deepEqual(body.contents[1].parts[0], {
        functionResponse: {
          name: 'x',
          response: { error: 'boom' }
        }
      });
    });

    it('restores part-level thought signatures exactly as received', function() {
      const body = adapter.buildBody(request({
        messages: [ {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'searching',
              thoughtSignature: 'sig-text'
            },
            {
              type: 'toolCall',
              id: 'find_pages-0',
              name: 'find_pages',
              input: { title: 'Pricing' },
              thoughtSignature: 'sig-call'
            }
          ]
        } ]
      }));
      assert.deepEqual(body.contents[0].parts, [
        {
          text: 'searching',
          thoughtSignature: 'sig-text'
        },
        {
          functionCall: {
            name: 'find_pages',
            args: { title: 'Pricing' }
          },
          thoughtSignature: 'sig-call'
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
              block: {
                type: 'thinking',
                thinking: 'hidden',
                signature: 'x'
              }
            },
            text('visible')
          ]
        } ]
      }));
      assert.deepEqual(body.contents[0].parts, [ { text: 'visible' } ]);
    });

    it('adds the synthetic final-answer function and forces it for a pure structured call', function() {
      const schema = {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: [ 'title' ]
      };
      const body = adapter.buildBody(request({ schema }));
      const [ tool ] = body.tools;
      assert.equal(tool.functionDeclarations.length, 1);
      assert.equal(tool.functionDeclarations[0].name, '_final_answer');
      assert.equal(typeof tool.functionDeclarations[0].description, 'string');
      assert.deepEqual(tool.functionDeclarations[0].parameters, schema);
      assert.deepEqual(body.toolConfig, {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: [ '_final_answer' ]
        }
      });
    });

    it('does not force the final-answer function when thinking is on', function() {
      const body = adapter.buildBody(request({
        schema: { type: 'object' },
        reasoning: 'high'
      }));
      assert.equal(body.tools[0].functionDeclarations[0].name, '_final_answer');
      assert.equal('toolConfig' in body, false);
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
        model: 'gemini-3.5-flash-0519'
      });
    });

    it('maps the finish reasons', function() {
      for (const [ theirs, ours ] of [
        [ 'STOP', 'stop' ],
        [ 'MAX_TOKENS', 'length' ],
        // The engine converts the refusal finish reason to the
        // refusal error
        [ 'SAFETY', 'refusal' ],
        [ 'PROHIBITED_CONTENT', 'refusal' ],
        // Unknown reasons yield none: the engine treats the turn as
        // malformed and retries, never a truncated success
        [ 'MALFORMED_FUNCTION_CALL', undefined ]
      ]) {
        assert.equal(
          adapter.parseResponse(fixture({
            candidates: [ candidate({ finishReason: theirs }) ]
          })).finishReason,
          ours
        );
      }
    });

    it('adds thinking tokens into the output count', function() {
      const turn = adapter.parseResponse(fixture({
        usageMetadata: {
          promptTokenCount: 12,
          candidatesTokenCount: 7,
          thoughtsTokenCount: 5,
          totalTokenCount: 24
        }
      }));
      assert.deepEqual(turn.usage, {
        inputTokens: 12,
        outputTokens: 12
      });
    });

    it('translates function calls, forcing the toolCalls finish reason, and drops thought parts', function() {
      const turn = adapter.parseResponse(fixture({
        candidates: [ candidate({
          content: {
            role: 'model',
            parts: [
              {
                thought: true,
                text: 'let me see'
              },
              { text: 'checking' },
              {
                functionCall: {
                  name: 'find_pages',
                  args: { title: 'Pricing' }
                }
              }
            ]
          },
          // The dialect reports STOP on tool-call turns
          finishReason: 'STOP'
        }) ]
      }));
      assert.deepEqual(turn.content, [
        text('checking'),
        {
          type: 'toolCall',
          // Synthesized: Gemini function calls carry no id
          id: 'find_pages-0',
          name: 'find_pages',
          input: { title: 'Pricing' }
        }
      ]);
      assert.equal(turn.finishReason, 'toolCalls');
    });

    it('synthesizes a distinct id per function call in a turn', function() {
      const turn = adapter.parseResponse(fixture({
        candidates: [ candidate({
          content: {
            role: 'model',
            parts: [
              {
                functionCall: {
                  name: 'search',
                  args: { q: 'a' }
                }
              },
              {
                functionCall: {
                  name: 'search',
                  args: { q: 'b' }
                }
              }
            ]
          },
          finishReason: 'STOP'
        }) ]
      }));
      assert.deepEqual(turn.content.map((part) => part.id), [ 'search-0', 'search-1' ]);
    });

    it('carries part-level thought signatures on the normalized parts', function() {
      const turn = adapter.parseResponse(fixture({
        candidates: [ candidate({
          content: {
            role: 'model',
            parts: [
              {
                text: 'searching',
                thoughtSignature: 'sig-text'
              },
              {
                functionCall: {
                  name: 'find_pages',
                  args: { title: 'Pricing' }
                },
                thoughtSignature: 'sig-call'
              }
            ]
          },
          finishReason: 'STOP'
        }) ]
      }));
      assert.deepEqual(turn.content, [
        {
          type: 'text',
          text: 'searching',
          thoughtSignature: 'sig-text'
        },
        {
          type: 'toolCall',
          id: 'find_pages-0',
          name: 'find_pages',
          input: { title: 'Pricing' },
          thoughtSignature: 'sig-call'
        }
      ]);
    });

    it('throws the refusal error on a blocked prompt', function() {
      assert.throws(
        () => adapter.parseResponse({
          promptFeedback: { blockReason: 'SAFETY' },
          usageMetadata: { promptTokenCount: 12 }
        }),
        (e) => {
          assert.equal(e.name, 'aiRefusal');
          assert.match(e.message, /SAFETY/);
          return true;
        }
      );
    });

    it('turns a final-answer function call into a structured stop turn', function() {
      const object = { title: 'Pricing' };
      const turn = adapter.parseResponse(
        fixture({
          candidates: [ candidate({
            content: {
              role: 'model',
              parts: [ {
                functionCall: {
                  name: '_final_answer',
                  args: object
                }
              } ]
            },
            finishReason: 'STOP'
          }) ]
        }),
        request({ schema: { type: 'object' } })
      );
      assert.deepEqual(turn.object, object);
      assert.equal(turn.finishReason, 'stop');
      assert.deepEqual(turn.content, [ text(JSON.stringify(object)) ]);
    });

    it('leaves a free-text answer without an object for the backstop to retry', function() {
      const turn = adapter.parseResponse(
        fixture(),
        request({ schema: { type: 'object' } })
      );
      assert.equal('object' in turn, false);
      assert.equal(turn.finishReason, 'stop');
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
      // The model the response named, not the routed alias
      assert.equal(result.model, 'gemini-3.5-flash-0519');
      assert.deepEqual(result.usage, {
        inputTokens: 12,
        outputTokens: 7
      });

      const [ call ] = httpCalls;
      assert.equal(
        call.url,
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent'
      );
      assert.equal(call.options.headers['x-goog-api-key'], 'sk-test');
      assert.equal(call.options.timeout, 600000);
      // The whole body: the default short cache policy adds nothing
      assert.deepEqual(call.options.body, {
        contents: [ {
          role: 'user',
          parts: [ { text: 'write a haiku about cats' } ]
        } ],
        generationConfig: { maxOutputTokens: 65536 }
      });
    });

    it('honors an aliased entry: its baseUrl, key and merged model metadata', async function() {
      httpScript = [ () => fixture() ];
      await apos.ai.generate(apos.task.getReq(), 'p', {
        provider: 'gateway',
        model: 'gemini-3.5-flash'
      });
      const [ call ] = httpCalls;
      assert.equal(
        call.url,
        'https://llm-gateway.example.com/google/v1beta/models/gemini-3.5-flash:generateContent'
      );
      assert.equal(call.options.headers['x-goog-api-key'], 'sk-gw');
      assert.equal(call.options.body.generationConfig.maxOutputTokens, 65536);
    });

    it('drives a thinking tool loop end to end, replaying the thought signature', async function() {
      httpScript = [
        () => fixture({
          candidates: [ candidate({
            content: {
              role: 'model',
              parts: [ {
                functionCall: {
                  name: 'echo',
                  args: { value: 'pricing' }
                },
                thoughtSignature: 'sig-call'
              } ]
            },
            finishReason: 'STOP'
          }) ]
        }),
        () => fixture({
          candidates: [ candidate({
            content: {
              role: 'model',
              parts: [ { text: 'done' } ]
            }
          }) ]
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
        assert.deepEqual(
          call.options.body.generationConfig.thinkingConfig,
          { thinkingLevel: 'high' }
        );
      }
      // The second call replays the function call with its thought
      // signature restored, exactly as received, and pairs the
      // function response back by name
      assert.deepEqual(httpCalls[1].options.body.contents.slice(1), [
        {
          role: 'model',
          parts: [ {
            functionCall: {
              name: 'echo',
              args: { value: 'pricing' }
            },
            thoughtSignature: 'sig-call'
          } ]
        },
        {
          role: 'user',
          parts: [ {
            functionResponse: {
              name: 'echo',
              response: { value: 'pricing' }
            }
          } ]
        }
      ]);
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

    it('surfaces a blocked prompt as the refusal error, without a retry', async function() {
      httpScript = [ () => ({
        promptFeedback: { blockReason: 'SAFETY' },
        usageMetadata: { promptTokenCount: 12 }
      }) ];
      await assert.rejects(apos.ai.generate(apos.task.getReq(), 'p'), (e) => {
        assert.equal(e.name, 'aiRefusal');
        return true;
      });
      assert.equal(httpCalls.length, 1);
    });

    it('retries an unknown finish reason as a malformed turn', async function() {
      httpScript = [
        () => fixture({ candidates: [ candidate({ finishReason: 'WEIRD' }) ] }),
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
      assert.equal(record.type, 'imagePartial');
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

  describe('live smoke', function() {
    const liveKey = process.env.APOS_GEMINI_KEY;
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
                google: { apiKey: liveKey }
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

    it('generates against Google for real', async function() {
      const result = await liveApos.ai.generate(
        liveApos.task.getReq(),
        'write a haiku about cats',
        {
          effort: 'low',
          // Room for the model's thinking tokens ahead of the text
          maxTokens: 2000,
          cache: false
        }
      );
      assert(result.text.length > 0);
      assert.equal(result.provider, 'google');
      assert.equal(result.finishReason, 'stop');
      assert(Number.isFinite(result.usage.inputTokens));
      assert(Number.isFinite(result.usage.outputTokens));
    });

    it('generates an image against Google for real', async function() {
      const result = await liveApos.ai.providers.google.adapter.image(
        liveApos.task.getReq(),
        {
          prompt: 'a small watercolor fox',
          count: 1,
          aspect: '1:1',
          quality: 'low',
          model: 'gemini-3.1-flash-image'
        }
      );
      assert.equal(result.images.length, 1);
      assert(result.images[0].data.length > 0);
      assert(Number.isFinite(result.usage.outputTokens));
    });
  });
});
