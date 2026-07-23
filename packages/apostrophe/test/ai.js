const t = require('../test-lib/test.js');
const assert = require('assert/strict');
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
    assert.equal(apos.ai.options.maxSteps, 5);
    assert.deepEqual(apos.ai.options.providers, {});
    assert.equal(apos.ai.defaultProvider, null);
    assert.equal(apos.ai.active, false);
    assert.equal(apos.ai.options.retryAttempts, 5);
    assert.equal(apos.ai.options.retryBaseDelay, 1000);
    assert.equal(apos.ai.options.retryMaxElapsed, 60000);
    // Unconfigured: a call falls through to an empty routing table
    assert.throws(() => apos.ai.modelInfo(), (e) => {
      assert.equal(e.name, 'invalid');
      assert.match(e.message, /effort level "medium" resolves to no routing entry/);
      return true;
    });
  });

  describe('options validation', function() {
    // A valid baseline the cases below mutate
    const valid = () => ({
      providers: {},
      maxSteps: 5,
      retryAttempts: 5,
      retryBaseDelay: 1000,
      retryMaxElapsed: 60000
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
      for (const aspect of [ 16, 'wide', '16x9' ]) {
        rejects({
          ...valid(),
          image: {
            provider: 'openai',
            model: 'gpt-image-1-mini',
            aspect
          }
        }, /"image\.aspect" must be "square", "portrait", "landscape" or a "W:H" ratio/);
      }
      rejects({
        ...valid(),
        image: {
          provider: 'openai',
          model: 'gpt-image-1-mini',
          quality: 'ultra'
        }
      }, /"image\.quality" must be "low", "medium" or "high"/);
      // Inline aspects on the entry get the declared-model vetting
      for (const aspects of [ [], [ '1:1', 'wide' ], '1:1' ]) {
        rejects({
          ...valid(),
          image: {
            provider: 'openai',
            model: 'gpt-image-1-mini',
            aspects
          }
        }, /"image\.aspects" must be a non-empty array of "W:H" ratios/);
      }
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

    it('rejects malformed retry options', function() {
      rejects({
        ...valid(),
        retryAttempts: 0
      }, /"retryAttempts" must be a positive integer/);
      rejects({
        ...valid(),
        retryAttempts: 'many'
      }, /"retryAttempts" must be a positive integer/);
      rejects({
        ...valid(),
        retryBaseDelay: -1
      }, /"retryBaseDelay" must be a positive integer/);
      rejects({
        ...valid(),
        retryMaxElapsed: 1.5
      }, /"retryMaxElapsed" must be a positive integer/);
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
      assert.equal(apos.ai.active, true);
    });

    it('instantiates adapters with the entry config', function() {
      const { fake, custom } = apos.ai.providers;
      assert.equal(fake.adapterName, 'fake');
      assert.equal(fake.adapter.apiKey, 'k1');
      assert.equal(custom.adapterName, 'fake');
      assert.equal(custom.adapter.provider, 'custom');
      assert.equal(custom.adapter.apiKey, 'k3');
      assert.equal(custom.adapter.baseUrl, 'https://custom.example/v1');
    });

    it('merges the entry service description over the adapter data', function() {
      const { fake, custom } = apos.ai.providers;
      // Native entry: adapter rows with entry overrides, level by level
      assert.deepEqual(fake.effort, {
        low: { model: 'fake-small' },
        medium: { model: 'fake-medium-2' },
        high: {
          model: 'fake-large',
          reasoning: 'high'
        }
      });
      // Aliased entry: its own rows only, the native table does not apply
      assert.deepEqual(custom.effort, {
        low: { model: 'custom-small' },
        medium: { model: 'custom-large' }
      });
      assert.equal(custom.capabilities.imageInput, false);
      assert.equal(custom.capabilities.text, true);
      assert.deepEqual(custom.models['custom-small'], {
        contextWindow: 32000,
        maxOutputTokens: 4000
      });
      // Per-model metadata merge, entry fields winning
      assert.deepEqual(custom.models['fake-small'], {
        contextWindow: 100000,
        maxOutputTokens: 1234
      });
    });

    it('builds the effort routing table from the default provider plus level overrides', function() {
      assert.equal(apos.ai.defaultProvider, 'fake');
      assert.equal(apos.ai.effortDefault, 'medium');
      assert.deepEqual(apos.ai.effortTable, {
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

    it('panics on activation when providers exist but no default resolves', async function() {
      const saved = apos.ai.defaultProvider;
      try {
        apos.ai.defaultProvider = null;
        await assert.rejects(
          apos.ai.activateProviders(),
          /@apostrophecms\/ai: no default provider is available/
        );
        // A failed activation leaves the engine inactive
        assert.equal(apos.ai.active, false);
      } finally {
        apos.ai.defaultProvider = saved;
        await apos.ai.activateProviders();
        assert.equal(apos.ai.active, true);
      }
    });

    it('rejects an image resolution when no image route is configured', function() {
      assert.throws(() => apos.ai.modelInfo({ capability: 'image' }), (e) => {
        assert.equal(e.name, 'invalid');
        assert.match(e.message, /no "image" route is configured/);
        return true;
      });
    });

    it('overrides an adapter on re-registration and requires a name', function() {
      assert.equal(apos.ai.getAdapter('fake').label, 'Fake (fake)');
      apos.ai.addAdapter(fakeAdapter('fake', { label: 'Replaced' }));
      assert.equal(apos.ai.getAdapter('fake').label, 'Replaced');
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
        assert.equal(mockApos.ai.defaultProvider, 'fake');
        assert.equal(mockApos.ai.active, true);
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

      it('fails on an image route to a provider without the image capability', async function() {
        await failsToActivate({
          providers: { fake: { apiKey: 'k' } },
          image: {
            provider: 'fake',
            model: 'fake-image'
          }
        }, /@apostrophecms\/ai: "image" references provider "fake" which does not declare the "image" capability/);
      });

      it('fails on a malformed declared aspect', async function() {
        await failsToActivate({
          providers: {
            fake: {
              apiKey: 'k',
              models: { 'fake-medium': { aspects: [ '1:1', 'wide' ] } }
            }
          }
        }, /@apostrophecms\/ai: "providers\.fake" model "fake-medium" declares an invalid aspect "wide"/);
        await failsToActivate({
          providers: {
            fake: {
              apiKey: 'k',
              models: { 'fake-medium': { aspects: '1:1' } }
            }
          }
        }, /@apostrophecms\/ai: "providers\.fake" model "fake-medium": "aspects" must be a non-empty array/);
        await failsToActivate({
          providers: {
            fake: {
              apiKey: 'k',
              models: { 'fake-medium': { aspects: [] } }
            }
          }
        }, /@apostrophecms\/ai: "providers\.fake" model "fake-medium": "aspects" must be a non-empty array/);
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

  describe('resolution and modelInfo', function() {
    // The fake adapter's declared capabilities, unchanged by the entries
    const capabilities = {
      text: true,
      tools: true,
      structured: true,
      imageInput: true,
      image: false,
      caching: true
    };
    // The "other" entry overrides image on, so the image route it
    // hosts passes the activation capability check
    const imageCapable = {
      ...capabilities,
      image: true
    };

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
                fake: { apiKey: 'k1' },
                other: {
                  apiKey: 'k2',
                  capabilities: { image: true },
                  models: {
                    'other-image': { aspects: [ '1:1', '16:9' ] }
                  }
                }
              },
              effort: {
                levels: {
                  high: {
                    provider: 'other',
                    model: 'other-large'
                  },
                  ultra: {
                    provider: 'other',
                    model: 'other-ultra',
                    reasoning: 'max',
                    contextWindow: 1000000,
                    maxOutputTokens: 64000
                  }
                }
              },
              image: {
                provider: 'other',
                model: 'other-image',
                aspect: 'square',
                quality: 'medium'
              }
            }
          }
        }
      });
    });

    after(async function() {
      return t.destroy(apos);
    });

    it('resolves the default effort level', function() {
      assert.deepEqual(apos.ai.modelInfo(), {
        provider: 'fake',
        model: 'fake-medium',
        contextWindow: 200000,
        maxOutputTokens: 16000,
        capabilities
      });
    });

    it('resolves a call effort level', function() {
      assert.deepEqual(apos.ai.modelInfo({ effort: 'low' }), {
        provider: 'fake',
        model: 'fake-small',
        contextWindow: 100000,
        maxOutputTokens: 8000,
        capabilities
      });
    });

    it('resolves an overridden level routed to another provider', function() {
      assert.deepEqual(apos.ai.modelInfo({ effort: 'high' }), {
        provider: 'other',
        model: 'other-large',
        contextWindow: 400000,
        maxOutputTokens: 32000,
        capabilities: imageCapable
      });
    });

    it('merges inline routing-entry metadata over the model maps', function() {
      assert.deepEqual(apos.ai.modelInfo({ effort: 'ultra' }), {
        provider: 'other',
        model: 'other-ultra',
        reasoning: 'max',
        contextWindow: 1000000,
        maxOutputTokens: 64000,
        capabilities: imageCapable
      });
    });

    it('resolves an explicit provider and model directly', function() {
      assert.deepEqual(apos.ai.modelInfo({
        provider: 'other',
        model: 'other-medium'
      }), {
        provider: 'other',
        model: 'other-medium',
        contextWindow: 200000,
        maxOutputTokens: 16000,
        capabilities: imageCapable
      });
    });

    it('yields undefined limits for an unknown model, never an error', function() {
      assert.deepEqual(apos.ai.modelInfo({
        provider: 'fake',
        model: 'mystery'
      }), {
        provider: 'fake',
        model: 'mystery',
        contextWindow: undefined,
        maxOutputTokens: undefined,
        capabilities
      });
    });

    it('resolves the image route via capability', function() {
      assert.deepEqual(apos.ai.modelInfo({ capability: 'image' }), {
        provider: 'other',
        model: 'other-image',
        contextWindow: undefined,
        maxOutputTokens: undefined,
        capabilities: imageCapable,
        aspects: [ '1:1', '16:9' ]
      });
    });

    it('reports aspects for an explicit image model too', function() {
      assert.deepEqual(apos.ai.modelInfo({
        capability: 'image',
        provider: 'other',
        model: 'other-image'
      }), {
        provider: 'other',
        model: 'other-image',
        contextWindow: undefined,
        maxOutputTokens: undefined,
        capabilities: imageCapable,
        aspects: [ '1:1', '16:9' ]
      });
    });

    it('applies a call-level reasoning override', function() {
      assert.equal(
        apos.ai.modelInfo({
          effort: 'ultra',
          reasoning: 'low'
        }).reasoning,
        'low'
      );
      assert.equal(
        apos.ai.modelInfo({
          provider: 'fake',
          model: 'fake-large',
          reasoning: 'high'
        }).reasoning,
        'high'
      );
    });

    it('rejects unresolvable calls with "invalid"', function() {
      const rejects = (options, pattern) => {
        assert.throws(() => apos.ai.modelInfo(options), (e) => {
          assert.equal(e.name, 'invalid');
          assert.match(e.message, pattern);
          return true;
        });
      };
      rejects({
        provider: 'nope',
        model: 'some-model'
      }, /"nope" is not a configured provider/);
      rejects({ provider: 'fake' }, /"provider" and "model" must be given together/);
      rejects({ model: 'fake-small' }, /"provider" and "model" must be given together/);
      rejects({ effort: 'unknown' }, /effort level "unknown" resolves to no routing entry/);
      rejects({ capability: 'tools' }, /unknown capability "tools"/);
    });
  });

  describe('the permission seam', function() {
    it('answers exactly as apos.permission.can does', function() {
      const admin = apos.task.getReq();
      const anon = apos.task.getAnonReq();
      for (const [ req, action, docOrType ] of [
        [ admin, 'edit', '@apostrophecms/any-page-type' ],
        [ anon, 'edit', '@apostrophecms/any-page-type' ],
        [ anon, 'view', '@apostrophecms/any-page-type' ]
      ]) {
        assert.equal(
          apos.ai.can(req, action, docOrType),
          apos.permission.can(req, action, docOrType)
        );
      }
      // Sanity that the tuples above exercise both outcomes
      assert.equal(apos.ai.can(admin, 'edit', '@apostrophecms/any-page-type'), true);
      assert.equal(apos.ai.can(anon, 'edit', '@apostrophecms/any-page-type'), false);
    });

    it('proxies every argument and the return value verbatim', function() {
      const original = apos.permission.can;
      const calls = [];
      const sentinel = Symbol('answer');
      try {
        apos.permission.can = (...args) => {
          calls.push(args);
          return sentinel;
        };
        const req = apos.task.getReq();
        const doc = { _id: 'd1' };
        assert.equal(apos.ai.can(req, 'edit', doc, 'draft'), sentinel);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].length, 4);
        assert.equal(calls[0][0], req);
        assert.equal(calls[0][1], 'edit');
        assert.equal(calls[0][2], doc);
        assert.equal(calls[0][3], 'draft');
      } finally {
        apos.permission.can = original;
      }
    });
  });

  it('fails fast at startup on a malformed configuration', function(done) {
    const child = spawn('node', [ './test/ai-children/ai-malformed-child.js' ]);
    let stderr = '';

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      assert.equal(code, 1);
      assert.match(stderr, /@apostrophecms\/ai: "providers\.openai" must be an object/);
      done();
    });
  });
});
