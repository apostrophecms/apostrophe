const t = require('../test-lib/test.js');
const assert = require('assert');
const { spawn } = require('child_process');

// A registrable fake adapter following the adapter contract, minus
// anything that would talk to a network
const fakeAdapter = (name, extras = {}) => ({
  name,
  label: `Fake (${name})`,
  capabilities: {
    text: true,
    tools: true,
    structured: true,
    imageInput: true,
    image: false,
    caching: true
  },
  effort: {
    low: { model: `${name}-small` },
    medium: { model: `${name}-medium` },
    high: {
      model: `${name}-large`,
      reasoning: 'high'
    }
  },
  models: {
    [`${name}-small`]: {
      contextWindow: 100000,
      maxOutputTokens: 8000
    },
    [`${name}-medium`]: {
      contextWindow: 200000,
      maxOutputTokens: 16000
    },
    [`${name}-large`]: {
      contextWindow: 400000,
      maxOutputTokens: 32000
    }
  },
  validate() {
    if (!this.apiKey) {
      throw new Error(`${name}: apiKey missing`);
    }
  },
  normalizeError(err) {
    return err;
  },
  ...extras
});

describe('AI engine', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    apos = await t.create({
      root: module
    });
  });

  after(async function() {
    return t.destroy(apos);
  });

  it('boots with no AI configuration and exposes apos.ai', function() {
    assert(apos.ai);
    assert.strictEqual(apos.ai.options.maxSteps, 5);
    assert.deepStrictEqual(apos.ai.options.providers, {});
    assert.strictEqual(apos.ai.defaultProvider, null);
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
        assert.match(e.message, /@apostrophecms\/ai: /);
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

    it('rejects several providers without a named default', function() {
      rejects({
        ...valid(),
        providers: {
          anthropic: { apiKey: 'k1' },
          openai: { apiKey: 'k2' }
        }
      }, /"provider" must name the default provider when several providers are configured/);
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

  describe('registry and activation', function() {
    before(async function() {
      await t.destroy(apos);
      apos = await t.create({
        root: module,
        modules: {
          'fake-adapters': {
            init(self) {
              self.apos.ai.addAdapter(fakeAdapter('fake'));
              self.apos.ai.addAdapter(fakeAdapter('other'));
            }
          },
          '@apostrophecms/ai': {
            options: {
              provider: 'fake',
              providers: {
                fake: {
                  apiKey: 'k1',
                  effort: {
                    medium: { model: 'fake-medium-2' }
                  }
                },
                other: { apiKey: 'k2' },
                custom: {
                  adapter: 'fake',
                  apiKey: 'k3',
                  baseUrl: 'https://custom.example/v1',
                  models: {
                    'custom-small': {
                      contextWindow: 32000,
                      maxOutputTokens: 4000
                    },
                    'fake-small': { maxOutputTokens: 1234 }
                  },
                  effort: {
                    low: { model: 'custom-small' },
                    medium: { model: 'custom-large' }
                  },
                  capabilities: { imageInput: false }
                }
              },
              effort: {
                levels: {
                  high: {
                    provider: 'other',
                    model: 'other-large'
                  }
                }
              }
            }
          }
        }
      });
    });

    after(async function() {
      return t.destroy(apos);
    });

    it('activates configured providers on ready', function() {
      assert(apos.ai.providers.fake);
      assert(apos.ai.providers.other);
      assert(apos.ai.providers.custom);
    });

    it('instantiates adapters with the entry config', function() {
      const { fake, custom } = apos.ai.providers;
      assert.strictEqual(fake.adapterName, 'fake');
      assert.strictEqual(fake.adapter.apiKey, 'k1');
      assert.strictEqual(custom.adapterName, 'fake');
      assert.strictEqual(custom.adapter.provider, 'custom');
      assert.strictEqual(custom.adapter.apiKey, 'k3');
      assert.strictEqual(custom.adapter.baseUrl, 'https://custom.example/v1');
    });

    it('merges the entry service description over the adapter data', function() {
      const { fake, custom } = apos.ai.providers;
      // Native entry: adapter rows with entry overrides, level by level
      assert.deepStrictEqual(fake.effort, {
        low: { model: 'fake-small' },
        medium: { model: 'fake-medium-2' },
        high: {
          model: 'fake-large',
          reasoning: 'high'
        }
      });
      // Aliased entry: its own rows only, the native table does not apply
      assert.deepStrictEqual(custom.effort, {
        low: { model: 'custom-small' },
        medium: { model: 'custom-large' }
      });
      assert.strictEqual(custom.capabilities.imageInput, false);
      assert.strictEqual(custom.capabilities.text, true);
      assert.deepStrictEqual(custom.models['custom-small'], {
        contextWindow: 32000,
        maxOutputTokens: 4000
      });
      // Per-model metadata merge, entry fields winning
      assert.deepStrictEqual(custom.models['fake-small'], {
        contextWindow: 100000,
        maxOutputTokens: 1234
      });
    });

    it('builds the effort routing table from the default provider plus level overrides', function() {
      assert.strictEqual(apos.ai.defaultProvider, 'fake');
      assert.strictEqual(apos.ai.effortDefault, 'medium');
      assert.deepStrictEqual(apos.ai.effortTable, {
        low: {
          provider: 'fake',
          model: 'fake-small'
        },
        medium: {
          provider: 'fake',
          model: 'fake-medium-2'
        },
        high: {
          provider: 'other',
          model: 'other-large'
        }
      });
    });

    it('overrides an adapter on re-registration and requires a name', function() {
      assert.strictEqual(apos.ai.getAdapter('fake').label, 'Fake (fake)');
      apos.ai.addAdapter(fakeAdapter('fake', { label: 'Replaced' }));
      assert.strictEqual(apos.ai.getAdapter('fake').label, 'Replaced');
      assert.throws(
        () => apos.ai.addAdapter({ label: 'anonymous' }),
        /requires an adapter definition with a "name" string/
      );
    });

    it('skips adapter validate() under APOS_AI_MOCK', async function() {
      process.env.APOS_AI_MOCK = '1';
      let mockApos;
      try {
        mockApos = await t.create({
          root: module,
          modules: {
            'fake-adapters': {
              init(self) {
                self.apos.ai.addAdapter(fakeAdapter('fake'));
              }
            },
            '@apostrophecms/ai': {
              options: {
                // No apiKey: validate() would throw outside mock mode
                providers: { fake: {} }
              }
            }
          }
        });
        assert(mockApos.ai.providers.fake);
        // The sole configured provider is inferred as the default
        assert.strictEqual(mockApos.ai.defaultProvider, 'fake');
      } finally {
        delete process.env.APOS_AI_MOCK;
        await t.destroy(mockApos);
      }
    });

    describe('activation failures', function() {
      // Activation throws on ready, after every init has run, so the
      // partially booted instance can be captured and destroyed
      const failsToActivate = async (
        aiOptions,
        pattern,
        setup = (apos) => apos.ai.addAdapter(fakeAdapter('fake'))
      ) => {
        let captured;
        try {
          await assert.rejects(t.create({
            root: module,
            exit: 'throw',
            modules: {
              'fake-adapters': {
                init(self) {
                  captured = self.apos;
                  setup(self.apos);
                }
              },
              '@apostrophecms/ai': {
                options: aiOptions
              }
            }
          }), pattern);
        } finally {
          await t.destroy(captured);
        }
      };

      it('fails on an unknown adapter name', async function() {
        await failsToActivate({
          providers: { nope: { apiKey: 'k' } }
        }, /@apostrophecms\/ai: "providers\.nope" names unknown adapter "nope"/);
        await failsToActivate({
          providers: {
            groq: {
              adapter: 'missing',
              apiKey: 'k'
            }
          }
        }, /@apostrophecms\/ai: "providers\.groq" names unknown adapter "missing"/);
      });

      it('fails when the adapter validate() throws', async function() {
        await failsToActivate({
          providers: { fake: {} }
        }, /fake: apiKey missing/);
      });

      it('fails on an adapter without validate()', async function() {
        await failsToActivate({
          providers: { noval: { apiKey: 'k' } }
        }, /@apostrophecms\/ai: adapter "noval" does not implement validate\(\)/,
        (apos) => apos.ai.addAdapter({ name: 'noval' }));
      });

      it('fails on a routing entry referencing an unconfigured provider', async function() {
        await failsToActivate({
          providers: { fake: { apiKey: 'k' } },
          effort: {
            levels: {
              high: {
                provider: 'openai',
                model: 'gpt-5.1'
              }
            }
          }
        }, /@apostrophecms\/ai: "effort\.levels\.high" references unconfigured provider "openai"/);
      });

      it('fails on an image route referencing an unconfigured provider', async function() {
        await failsToActivate({
          providers: { fake: { apiKey: 'k' } },
          image: {
            provider: 'openai',
            model: 'gpt-image-1'
          }
        }, /@apostrophecms\/ai: "image" references unconfigured provider "openai"/);
      });

      it('fails when the default effort level resolves to no row', async function() {
        await failsToActivate({
          providers: { fake: { apiKey: 'k' } },
          effort: { default: 'ultra' }
        }, /@apostrophecms\/ai: the default effort level "ultra" resolves to no routing entry/);
        // An aliased sole provider supplies no rows of its own
        await failsToActivate({
          providers: {
            custom: {
              adapter: 'fake',
              apiKey: 'k'
            }
          }
        }, /@apostrophecms\/ai: the default effort level "medium" resolves to no routing entry/);
      });
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
