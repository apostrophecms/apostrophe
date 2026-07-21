const http = require('http');
const t = require('../test-lib/test.js');
const assert = require('assert/strict');

// The provider ecosystem story, end to end: a free-named provider entry
// over the openai adapter runs against any host speaking the Chat
// Completions dialect — here a real local HTTP server standing in for
// Groq, Ollama, vLLM or an internal gateway — with zero adapter code.
// Unlike the adapter suites, nothing is stubbed: the request travels
// the real transport.
describe('AI: named providers and baseUrl', function() {
  this.timeout(t.timeout);

  let apos;
  let server;
  let baseUrl;
  // The requests the stub host captured, one per adapter call
  let hits;
  let savedOpenaiKey;
  let savedAnthropicKey;

  before(async function() {
    // The adapters' default envKey variables would override the
    // fixture keys below; keep the suite hermetic and restore at the end
    savedOpenaiKey = process.env.APOS_OPENAI_KEY;
    savedAnthropicKey = process.env.APOS_ANTHROPIC_KEY;
    delete process.env.APOS_OPENAI_KEY;
    delete process.env.APOS_ANTHROPIC_KEY;

    // A minimal host speaking the Chat Completions dialect, echoing
    // the requested model like a real vendor would
    hits = [];
    server = http.createServer((request, response) => {
      let raw = '';
      request.on('data', (chunk) => {
        raw += chunk;
      });
      request.on('end', () => {
        const body = JSON.parse(raw);
        hits.push({
          method: request.method,
          url: request.url,
          headers: request.headers,
          body
        });
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({
          id: 'chatcmpl-1',
          object: 'chat.completion',
          model: body.model,
          choices: [ {
            index: 0,
            message: {
              role: 'assistant',
              content: 'a llama haiku',
              refusal: null
            },
            finish_reason: 'stop'
          } ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 7
          }
        }));
      });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/v1`;

    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/ai': {
          options: {
            provider: 'groq',
            providers: {
              // The named-provider recipe: the entry describes the
              // actual service, the adapter supplies the dialect
              groq: {
                adapter: 'openai',
                baseUrl,
                apiKey: 'gsk-test',
                models: {
                  'llama-3.1-8b-instant': {
                    contextWindow: 131072,
                    maxOutputTokens: 8192
                  },
                  'llama-3.3-70b-versatile': {
                    contextWindow: 131072,
                    maxOutputTokens: 32768
                  }
                },
                effort: {
                  low: { model: 'llama-3.1-8b-instant' },
                  medium: { model: 'llama-3.3-70b-versatile' },
                  high: { model: 'llama-3.3-70b-versatile' }
                },
                capabilities: { image: false }
              },
              anthropic: { apiKey: 'sk-test' }
            }
          }
        }
      }
    });
  });

  after(async function() {
    if (savedOpenaiKey !== undefined) {
      process.env.APOS_OPENAI_KEY = savedOpenaiKey;
    }
    if (savedAnthropicKey !== undefined) {
      process.env.APOS_ANTHROPIC_KEY = savedAnthropicKey;
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (apos) {
      return t.destroy(apos);
    }
  });

  beforeEach(function() {
    hits.length = 0;
  });

  it('activates the free-named entry over the openai adapter', function() {
    assert.equal(apos.ai.active, true);
    assert.equal(apos.ai.providers.groq.adapterName, 'openai');
    assert.equal(apos.ai.providers.groq.adapter.apiKey, 'gsk-test');
  });

  it('resolves modelInfo from the entry\'s effort rows and models', function() {
    const info = apos.ai.modelInfo();
    assert.equal(info.provider, 'groq');
    assert.equal(info.model, 'llama-3.3-70b-versatile');
    assert.equal(info.contextWindow, 131072);
    assert.equal(info.maxOutputTokens, 32768);
    const low = apos.ai.modelInfo({ effort: 'low' });
    assert.equal(low.model, 'llama-3.1-8b-instant');
    assert.equal(low.maxOutputTokens, 8192);
  });

  it('overrides the adapter\'s capabilities with the entry\'s', function() {
    assert.equal(apos.ai.providers.groq.capabilities.image, false);
    assert.equal(apos.ai.providers.groq.capabilities.text, true);
    assert.equal(apos.ai.modelInfo().capabilities.image, false);
  });

  it('throws the clear capability error, never a silent degrade', function() {
    const throwsCapability = (provider, capability) => {
      assert.throws(() => apos.ai.checkCapability(provider, capability), (e) => {
        assert.equal(e.name, 'invalid');
        assert.match(
          e.message,
          new RegExp(`"${provider}" does not declare the "${capability}"`)
        );
        return true;
      });
    };
    // The entry's own override, and anthropic's native declaration
    throwsCapability('groq', 'image');
    throwsCapability('anthropic', 'image');
    apos.ai.checkCapability('groq', 'text');
    apos.ai.checkCapability('anthropic', 'text');
  });

  describe('the wire, for real', function() {
    it('generates through the stub host with zero adapter code', async function() {
      const result = await apos.ai.generate(
        apos.task.getReq(),
        'write a haiku about llamas',
        { effort: 'low' }
      );
      assert.equal(result.text, 'a llama haiku');
      assert.equal(result.provider, 'groq');
      assert.equal(result.model, 'llama-3.1-8b-instant');
      assert.equal(result.finishReason, 'stop');
      assert.deepEqual(result.usage, {
        inputTokens: 12,
        outputTokens: 7
      });

      const [ hit ] = hits;
      assert.equal(hit.method, 'POST');
      assert.equal(hit.url, '/v1/chat/completions');
      assert.equal(hit.headers.authorization, 'Bearer gsk-test');
      assert.match(hit.headers['content-type'], /application\/json/);
      // The entry's model metadata sized the request
      assert.deepEqual(hit.body, {
        model: 'llama-3.1-8b-instant',
        messages: [ {
          role: 'user',
          content: 'write a haiku about llamas'
        } ],
        max_completion_tokens: 8192
      });
    });

    it('routes a per-call override by the free provider name', async function() {
      const result = await apos.ai.generate(apos.task.getReq(), 'p', {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile'
      });
      assert.equal(result.model, 'llama-3.3-70b-versatile');
      const [ hit ] = hits;
      assert.equal(hit.body.model, 'llama-3.3-70b-versatile');
      assert.equal(hit.body.max_completion_tokens, 32768);
    });
  });

  describe('a native entry through a gateway baseUrl', function() {
    before(async function() {
      await t.destroy(apos);
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/ai': {
            options: {
              providers: {
                // Same service, different door: only the endpoint moves
                openai: {
                  apiKey: 'sk-test',
                  baseUrl
                }
              }
            }
          }
        }
      });
    });

    it('keeps the native defaults: effort table and model metadata', function() {
      const info = apos.ai.modelInfo();
      assert.equal(info.provider, 'openai');
      assert.equal(info.model, 'gpt-5.6-terra');
      assert.equal(info.contextWindow, 1050000);
      assert.equal(info.maxOutputTokens, 128000);
      assert.equal(info.capabilities.image, true);
    });

    it('sends the native-routed call through the gateway door', async function() {
      const result = await apos.ai.generate(apos.task.getReq(), 'p');
      assert.equal(result.provider, 'openai');
      assert.equal(result.model, 'gpt-5.6-terra');
      const [ hit ] = hits;
      assert.equal(hit.url, '/v1/chat/completions');
      assert.equal(hit.headers.authorization, 'Bearer sk-test');
      assert.equal(hit.body.model, 'gpt-5.6-terra');
      assert.equal(hit.body.max_completion_tokens, 128000);
    });
  });
});
