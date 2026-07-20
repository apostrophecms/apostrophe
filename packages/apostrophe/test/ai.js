const t = require('../test-lib/test.js');
const assert = require('assert');
const { spawn } = require('child_process');

describe('AI engine', function() {
  this.timeout(t.timeout);

  let apos;

  after(async function() {
    return t.destroy(apos);
  });

  it('boots with no AI configuration and exposes apos.ai', async function() {
    apos = await t.create({
      root: module
    });
    assert(apos.ai);
    assert.strictEqual(apos.ai.options.maxSteps, 5);
    assert.deepStrictEqual(apos.ai.options.providers, {});
  });

  describe('options validation', function() {
    // A valid baseline the cases below mutate
    const valid = () => ({
      providers: {},
      maxSteps: 5
    });

    it('accepts the minimal single-provider configuration', function() {
      apos.ai.validateOptions({
        ...valid(),
        providers: {
          anthropic: { apiKey: 'k' }
        }
      });
    });

    it('accepts a multi-provider configuration with partial override', function() {
      apos.ai.validateOptions({
        ...valid(),
        provider: 'anthropic',
        providers: {
          anthropic: { apiKey: 'k1' },
          openai: { apiKey: 'k2' },
          google: { apiKey: 'k3' }
        },
        effort: {
          default: 'medium',
          levels: {
            high: {
              provider: 'openai',
              model: 'gpt-5.1',
              reasoning: 'high'
            }
          }
        },
        image: {
          provider: 'openai',
          model: 'gpt-image-1-mini',
          aspect: 'square',
          quality: 'medium'
        },
        maxSteps: 25
      });
    });

    it('accepts an aliased provider entry describing its own service', function() {
      apos.ai.validateOptions({
        ...valid(),
        providers: {
          openai: { apiKey: 'k1' },
          groq: {
            adapter: 'openai',
            baseUrl: 'https://api.groq.com/openai/v1',
            apiKey: 'k2',
            models: {
              'llama-3.1-8b-instant': {
                contextWindow: 131072,
                maxOutputTokens: 8192
              }
            },
            effort: {
              low: { model: 'llama-3.1-8b-instant' },
              medium: { model: 'llama-3.3-70b-versatile' },
              high: { model: 'llama-3.3-70b-versatile' }
            },
            capabilities: { image: false }
          }
        },
        provider: 'openai'
      });
    });

    const rejects = (options, pattern) => {
      assert.throws(() => apos.ai.validateOptions(options), (e) => {
        assert.match(e.message, /^@apostrophecms\/ai: /);
        assert.match(e.message, pattern);
        return true;
      });
    };

    it('rejects providers that are not an object of entries', function() {
      rejects({
        ...valid(),
        providers: []
      }, /"providers" must be an object/);
      rejects({
        ...valid(),
        providers: { openai: 'key' }
      }, /"providers\.openai" must be an object/);
    });

    it('rejects malformed provider entry fields', function() {
      rejects({
        ...valid(),
        providers: { openai: { apiKey: 42 } }
      }, /"providers\.openai\.apiKey" must be a string/);
      rejects({
        ...valid(),
        providers: {
          groq: {
            effort: { low: { reasoning: 'high' } }
          }
        }
      }, /"providers\.groq\.effort\.low\.model" must be a string/);
      rejects({
        ...valid(),
        providers: {
          groq: {
            capabilities: { image: 'no' }
          }
        }
      }, /"providers\.groq\.capabilities\.image" must be a boolean/);
      rejects({
        ...valid(),
        providers: {
          groq: {
            models: { 'llama-3.1-8b-instant': 131072 }
          }
        }
      }, /"providers\.groq\.models\.llama-3\.1-8b-instant" must be an object/);
    });

    it('rejects a default provider that is not configured', function() {
      rejects({
        ...valid(),
        provider: 'anthropic'
      }, /"provider" names "anthropic" which is not a configured provider/);
    });

    it('rejects malformed effort configuration', function() {
      rejects({
        ...valid(),
        effort: 'high'
      }, /"effort" must be an object/);
      // No string alias: routing entries are canonical objects
      rejects({
        ...valid(),
        effort: {
          levels: { high: 'openai/gpt-5.1' }
        }
      }, /"effort\.levels\.high" must be an object like \{ provider, model \}/);
      rejects({
        ...valid(),
        effort: {
          levels: { high: { model: 'gpt-5.1' } }
        }
      }, /"effort\.levels\.high\.provider" must be a string/);
      rejects({
        ...valid(),
        effort: {
          levels: {
            high: {
              provider: 'openai',
              reasoning: 'high'
            }
          }
        }
      }, /"effort\.levels\.high\.model" must be a string/);
    });

    it('rejects a malformed image route', function() {
      rejects({
        ...valid(),
        image: { provider: 'openai' }
      }, /"image\.model" must be a string/);
      rejects({
        ...valid(),
        image: {
          provider: 'openai',
          model: 'gpt-image-1-mini',
          aspect: 16
        }
      }, /"image\.aspect" must be a string/);
    });

    it('rejects malformed maxSteps and mock', function() {
      rejects({
        ...valid(),
        maxSteps: 0
      }, /"maxSteps" must be a positive integer/);
      rejects({
        ...valid(),
        mock: 'fixture reply'
      }, /"mock" must be a function/);
    });
  });

  it('fails fast at startup on a malformed configuration', function(done) {
    const child = spawn('node', [ './test/ai-children/ai-malformed-child.js' ]);
    let stderr = '';

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      assert.strictEqual(code, 1);
      assert.match(stderr, /@apostrophecms\/ai: "providers\.openai" must be an object/);
      done();
    });
  });
});
