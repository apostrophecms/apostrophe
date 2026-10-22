const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('AI adapter: bedrock', function() {
  this.timeout(t.timeout);

  let apos;
  // The adapter module instance, for unit access to its methods
  let adapter;
  let savedLiveKey;
  const usageRecords = [];

  before(async function() {
    // A real key in the environment would override the fixture values
    // below; keep the suite hermetic and restore at the end
    savedLiveKey = process.env.APOS_BEDROCK_KEY;
    delete process.env.APOS_BEDROCK_KEY;
    apos = await t.create({
      root: module,
      modules: {
        // A project extending the vendor catalog with a model Bedrock
        // does not serve yet: the composed definition is built from it
        '@apostrophecms/ai-adapter-anthropic': {
          extendMethods(self) {
            return {
              adapter(_super) {
                const definition = _super();
                definition.models['claude-next'] = {
                  label: 'Next',
                  contextWindow: 1000000,
                  maxOutputTokens: 64000
                };
                return definition;
              }
            };
          }
        },
        'usage-recorder': {
          handlers(self) {
            return {
              '@apostrophecms/ai:usage': {
                record(req, usage) {
                  usageRecords.push(usage);
                }
              }
            };
          }
        },
        '@apostrophecms/ai': {
          options: {
            provider: 'bedrock-anthropic',
            providers: {
              'bedrock-anthropic': {
                apiKey: 'bedrock-test',
                region: 'us-east-1',
                profile: 'us'
              },
              // An aliased entry: another profile behind an egress
              // proxy, with a model the catalog does not know yet
              gateway: {
                adapter: 'bedrock-anthropic',
                apiKey: 'bedrock-gw',
                region: 'eu-west-1',
                profile: 'eu',
                baseUrl: 'https://egress.example.com/bedrock',
                models: {
                  'claude-opus-6': { maxOutputTokens: 32000 }
                }
              },
              'bedrock-openai': {
                apiKey: 'bedrock-test',
                region: 'us-west-2',
                profile: 'global'
              },
              // A vendor with no dialect of its own here, by its
              // Bedrock id
              mistral: {
                adapter: 'bedrock-openai-compatible',
                apiKey: 'bedrock-test',
                region: 'us-east-1',
                models: {
                  'mistral.mistral-large-3-675b-instruct': { maxOutputTokens: 32000 }
                }
              }
            },
            // Keep retried tests fast; the delay engine has its own suite
            retryBaseDelay: 1
          }
        }
      }
    });
    adapter = apos.modules['@apostrophecms/ai-adapter-bedrock'];
  });

  after(async function() {
    if (savedLiveKey !== undefined) {
      process.env.APOS_BEDROCK_KEY = savedLiveKey;
    }
    if (apos) {
      return t.destroy(apos);
    }
  });

  const text = (value) => ({
    type: 'text',
    text: value
  });
  // A canned Messages API response body; Bedrock echoes the bare id
  const fixture = (extras = {}) => ({
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    content: [ text('a haiku') ],
    model: 'claude-sonnet-5-5',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 12,
      output_tokens: 7
    },
    ...extras
  });
  // Bedrock's error body for the Anthropic endpoint, as served live
  const errorBody = (type, message) => ({
    type: 'error',
    error: {
      type,
      message
    }
  });
  // A canned Responses API body; Bedrock echoes the wire id
  const responsesFixture = (extras = {}) => ({
    id: 'resp_1',
    object: 'response',
    status: 'completed',
    output: [ {
      type: 'message',
      role: 'assistant',
      content: [ {
        type: 'output_text',
        text: 'a haiku'
      } ]
    } ],
    model: 'global.openai.gpt-6.1-sol',
    usage: {
      input_tokens: 12,
      output_tokens: 7
    },
    ...extras
  });
  // A canned Chat Completions body
  const completionsFixture = (extras = {}) => ({
    id: 'chatcmpl-1',
    object: 'chat.completion',
    choices: [ {
      index: 0,
      message: {
        role: 'assistant',
        content: 'a haiku'
      },
      finish_reason: 'stop'
    } ],
    model: 'mistral.mistral-large-3-675b-instruct-v1:0',
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

  // Thunks consumed by the stubbed apos.http.post, one per call
  let httpScript;
  let httpCalls;
  let logRecords;
  // Stub the transport, the retry pause and the logs around a block of
  // wire tests
  const stubWire = () => {
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
      logRecords = [];
      usageRecords.length = 0;
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
      apos.ai.pause = async () => {};
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
  };

  describe('bedrock-anthropic', function() {
    it('composes the anthropic adapter\'s lineup, narrowed to what Bedrock serves', function() {
      const vendor = apos.ai.getAdapter('anthropic');
      const definition = apos.ai.getAdapter('bedrock-anthropic');
      assert.equal(definition.label, 'Anthropic (Claude) on Amazon Bedrock');
      assert.equal(definition.envKey, 'APOS_BEDROCK_KEY');
      assert.equal(definition.baseUrl, undefined);
      assert.deepEqual(definition.effort, vendor.effort);
      assert.deepEqual(definition.capabilities, vendor.capabilities);
      // The project's catalog extension is there, but not served
      assert(vendor.models['claude-next']);
      assert.deepEqual(Object.keys(definition.models), [
        'claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'
      ]);
      assert.deepEqual(
        definition.models['claude-opus-5-5'],
        vendor.models['claude-opus-5-5']
      );
    });

    it('lists only the served models in the catalog, plus an entry\'s own', function() {
      const { providers, effort } = apos.ai.modelCatalog();
      assert.deepEqual(Object.keys(providers['bedrock-anthropic'].models), [
        'claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'
      ]);
      assert.deepEqual(Object.keys(providers.gateway.models), [
        'claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-6'
      ]);
      assert.equal(providers['bedrock-anthropic'].capabilities.image, false);
      // The native rows, unchanged
      assert.deepEqual(effort.levels.medium, {
        provider: 'bedrock-anthropic',
        model: 'claude-sonnet-5-5',
        reasoning: 'medium'
      });
    });

    it('derives the wire id from the entry\'s profile', function() {
      const native = apos.ai.providers['bedrock-anthropic'].adapter;
      const gateway = apos.ai.providers.gateway.adapter;
      assert.equal(native.wireModel('claude-opus-5-5'), 'us.anthropic.claude-opus-5-5');
      assert.equal(gateway.wireModel('claude-opus-5-5'), 'eu.anthropic.claude-opus-5-5');
    });

    describe('normalizeError', function() {
      it('reads Bedrock\'s message and request id on the status ladder', function() {
        const error = adapter.normalizeError(httpError(400, {
          'x-amzn-requestid': 'req-1'
        }, errorBody('invalid_request_error', 'max_tokens: Field required')));
        assert.equal(error.name, 'invalid');
        assert.equal(error.message, 'max_tokens: Field required');
        assert.equal(error.data.status, 400);
        assert.equal(error.data.requestId, 'req-1');
        const throttled = adapter.normalizeError(httpError(429, {
          'x-amzn-requestid': 'req-2',
          'retry-after': '3'
        }));
        assert.equal(throttled.name, 'aiRetry');
        assert.equal(throttled.data.kind, 'rateLimit');
        assert.equal(throttled.data.retryAfter, 3);
        assert.equal(throttled.data.requestId, 'req-2');
        const denied = adapter.normalizeError(httpError(403, {
          'x-amzn-requestid': 'req-3'
        }, errorBody('permission_error', 'Invalid API Key format')));
        assert.equal(denied.name, 'forbidden');
        assert.equal(denied.message, 'Invalid API Key format');
      });
    });

    describe('the wire', function() {
      stubWire();

      it('calls the region\'s runtime endpoint with the vendor dialect', async function() {
        httpScript = [ () => fixture() ];
        const result = await apos.ai.generate(
          apos.task.getReq(),
          'write a haiku about cats'
        );
        assert.equal(result.text, 'a haiku');
        assert.equal(result.provider, 'bedrock-anthropic');

        const [ call ] = httpCalls;
        assert.equal(
          call.url,
          'https://bedrock-runtime.us-east-1.amazonaws.com/anthropic/v1/messages'
        );
        assert.deepEqual(call.options.headers, {
          'x-api-key': 'bedrock-test',
          'anthropic-version': '2023-06-01'
        });
        assert.equal(call.options.timeout, 600000);
        assert.equal(call.options.body.model, 'us.anthropic.claude-sonnet-5-5');
        // The dialect saw the catalog id: adaptive thinking on the
        // medium row's level
        assert.deepEqual(call.options.body.thinking, { type: 'adaptive' });
        assert.deepEqual(call.options.body.output_config, { effort: 'medium' });
      });

      it('reports the catalog id, whatever the response echoes', async function() {
        httpScript = [ () => fixture({ model: 'us.anthropic.claude-sonnet-5-5' }) ];
        const result = await apos.ai.generate(apos.task.getReq(), 'p');
        assert.equal(result.model, 'claude-sonnet-5-5');
        assert.equal(usageRecords.length, 1);
        assert.equal(usageRecords[0].model, 'claude-sonnet-5-5');
      });

      it('reports the wire id and the price settings on usage records', async function() {
        httpScript = [ () => fixture() ];
        await apos.ai.generate(apos.task.getReq(), 'p');
        const [ record ] = usageRecords;
        assert.equal(record.provider, 'bedrock-anthropic');
        assert.equal(record.wireModel, 'us.anthropic.claude-sonnet-5-5');
        assert.deepEqual(record.settings, {
          region: 'us-east-1',
          profile: 'us'
        });
      });

      it('honors an aliased entry: its baseUrl, key and profile', async function() {
        httpScript = [ () => fixture({ model: 'claude-opus-6' }) ];
        const result = await apos.ai.generate(apos.task.getReq(), 'p', {
          provider: 'gateway',
          model: 'claude-opus-6'
        });
        assert.equal(result.model, 'claude-opus-6');
        const [ call ] = httpCalls;
        assert.equal(call.url, 'https://egress.example.com/bedrock/anthropic/v1/messages');
        assert.equal(call.options.headers['x-api-key'], 'bedrock-gw');
        assert.equal(call.options.body.model, 'eu.anthropic.claude-opus-6');
        // The entry's own model metadata supplied the cap
        assert.equal(call.options.body.max_tokens, 32000);
        assert.deepEqual(usageRecords[0].settings, {
          region: 'eu-west-1',
          profile: 'eu'
        });
      });

      it('sends a model off the served list as given, with the profile prefix', async function() {
        // Known to the vendor catalog but not served, and known to no
        // catalog at all: no call-time gate, Bedrock has the final word.
        // Neither is in this entry's models, so the caller sets the cap
        httpScript = [
          () => fixture({ model: 'claude-next' }),
          () => fixture({ model: 'claude-opus-6' })
        ];
        for (const model of [ 'claude-next', 'claude-opus-6' ]) {
          await apos.ai.generate(apos.task.getReq(), 'p', {
            provider: 'bedrock-anthropic',
            model,
            maxTokens: 1000
          });
        }
        assert.deepEqual(httpCalls.map((call) => call.options.body.model), [
          'us.anthropic.claude-next', 'us.anthropic.claude-opus-6'
        ]);
      });

      it('reports the wire id on the failure log', async function() {
        httpScript = [ () => {
          throw httpError(400, { 'x-amzn-requestid': 'req-4' }, errorBody(
            'invalid_request_error',
            'The provided model identifier is invalid.'
          ));
        } ];
        await assert.rejects(
          apos.ai.generate(apos.task.getReq(), 'p'),
          (e) => e.name === 'invalid' &&
            e.message === 'The provided model identifier is invalid.'
        );
        const failure = logRecords.find(({ type }) => type === 'failure');
        assert.equal(failure.data.model, 'claude-sonnet-5-5');
        assert.equal(failure.data.wireModel, 'us.anthropic.claude-sonnet-5-5');
        assert.equal(failure.data.requestId, 'req-4');
        // A provider 4xx is never retried
        assert.equal(httpCalls.length, 1);
      });
    });
  });

  describe('bedrock-openai', function() {
    it('composes the openai adapter\'s chat lineup, narrowed to what Bedrock serves', function() {
      const vendor = apos.ai.getAdapter('openai');
      const definition = apos.ai.getAdapter('bedrock-openai');
      assert.equal(definition.label, 'OpenAI on Amazon Bedrock');
      assert.equal(definition.envKey, 'APOS_BEDROCK_KEY');
      assert.equal(definition.baseUrl, undefined);
      assert.deepEqual(definition.effort, vendor.effort);
      assert.deepEqual(definition.capabilities, {
        ...vendor.capabilities,
        image: false
      });
      // The image models are in the vendor catalog, but not served
      assert(vendor.models['gpt-image-2']);
      assert.deepEqual(Object.keys(definition.models), [
        'gpt-6-luna', 'gpt-6.1-sol', 'gpt-6-astra', 'gpt-5.6-terra'
      ]);
      assert.deepEqual(
        definition.models['gpt-6.1-sol'],
        vendor.models['gpt-6.1-sol']
      );
    });

    it('lists only the served chat models in the catalog', function() {
      const { providers } = apos.ai.modelCatalog();
      assert.deepEqual(Object.keys(providers['bedrock-openai'].models), [
        'gpt-6-luna', 'gpt-6.1-sol', 'gpt-6-astra', 'gpt-5.6-terra'
      ]);
      assert.equal(providers['bedrock-openai'].capabilities.image, false);
    });

    it('derives the wire id from the entry\'s profile', function() {
      const native = apos.ai.providers['bedrock-openai'].adapter;
      assert.equal(native.wireModel('gpt-6-astra'), 'global.openai.gpt-6-astra');
    });

    describe('the wire', function() {
      stubWire();

      it('calls the region\'s Responses endpoint with the vendor dialect', async function() {
        httpScript = [ () => responsesFixture() ];
        const result = await apos.ai.generate(apos.task.getReq(), 'write a haiku about cats', {
          provider: 'bedrock-openai',
          model: 'gpt-6.1-sol',
          reasoning: 'high'
        });
        assert.equal(result.text, 'a haiku');
        assert.equal(result.provider, 'bedrock-openai');

        const [ call ] = httpCalls;
        assert.equal(
          call.url,
          'https://bedrock-runtime.us-west-2.amazonaws.com/openai/v1/responses'
        );
        assert.deepEqual(call.options.headers, {
          authorization: 'Bearer bedrock-test'
        });
        assert.equal(call.options.timeout, 600000);
        assert.equal(call.options.body.model, 'global.openai.gpt-6.1-sol');
        assert.equal(call.options.body.store, false);
        assert.deepEqual(call.options.body.reasoning, { effort: 'high' });
      });

      it('reports the catalog id where Bedrock echoes the wire id, and the price settings', async function() {
        httpScript = [ () => responsesFixture() ];
        const result = await apos.ai.generate(apos.task.getReq(), 'p', {
          provider: 'bedrock-openai',
          model: 'gpt-6.1-sol'
        });
        assert.equal(result.model, 'gpt-6.1-sol');
        const [ record ] = usageRecords;
        assert.equal(record.provider, 'bedrock-openai');
        assert.equal(record.model, 'gpt-6.1-sol');
        assert.equal(record.wireModel, 'global.openai.gpt-6.1-sol');
        assert.deepEqual(record.settings, {
          region: 'us-west-2',
          profile: 'global'
        });
      });

      it('sends a model the catalog does not know with the profile prefix', async function() {
        httpScript = [ () => responsesFixture({ model: 'global.openai.gpt-7' }) ];
        const result = await apos.ai.generate(apos.task.getReq(), 'p', {
          provider: 'bedrock-openai',
          model: 'gpt-7'
        });
        assert.equal(result.model, 'gpt-7');
        assert.equal(httpCalls[0].options.body.model, 'global.openai.gpt-7');
      });
    });
  });

  describe('bedrock-openai-compatible', function() {
    it('declares no catalog, effort rows, profile or id mapping', function() {
      const definition = apos.ai.getAdapter('bedrock-openai-compatible');
      assert.equal(definition.label, 'OpenAI Completions on Amazon Bedrock');
      assert.equal(definition.envKey, 'APOS_BEDROCK_KEY');
      assert.equal(definition.baseUrl, undefined);
      assert.equal(definition.models, undefined);
      assert.equal(definition.effort, undefined);
      assert.equal(definition.wireModel, undefined);
      assert.deepEqual(Object.keys(definition.settings), [ 'region' ]);
      assert.equal(definition.capabilities.image, false);
      const { providers } = apos.ai.modelCatalog();
      assert.deepEqual(Object.keys(providers.mistral.models), [
        'mistral.mistral-large-3-675b-instruct'
      ]);
    });

    describe('the wire', function() {
      stubWire();

      it('sends the entry\'s model id as given to the Chat Completions endpoint', async function() {
        httpScript = [ () => completionsFixture() ];
        const result = await apos.ai.generate(apos.task.getReq(), 'p', {
          provider: 'mistral',
          model: 'mistral.mistral-large-3-675b-instruct'
        });
        assert.equal(result.text, 'a haiku');
        // The requested id, whatever the response echoes
        assert.equal(result.model, 'mistral.mistral-large-3-675b-instruct');

        const [ call ] = httpCalls;
        assert.equal(
          call.url,
          'https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1/chat/completions'
        );
        assert.deepEqual(call.options.headers, {
          authorization: 'Bearer bedrock-test'
        });
        assert.equal(call.options.timeout, 600000);
        assert.equal(call.options.body.model, 'mistral.mistral-large-3-675b-instruct');
        // The entry's own model metadata supplied the cap
        assert.equal(call.options.body.max_completion_tokens, 32000);

        const [ record ] = usageRecords;
        assert.equal(record.provider, 'mistral');
        assert.equal(record.model, 'mistral.mistral-large-3-675b-instruct');
        assert.equal(record.wireModel, undefined);
        assert.deepEqual(record.settings, { region: 'us-east-1' });
      });
    });
  });

  describe('boot checks', function() {
    const failsToBoot = async (options, pattern) => {
      let captured;
      try {
        await assert.rejects(t.create({
          root: module,
          exit: 'throw',
          modules: {
            capture: {
              init(self) {
                captured = self.apos;
              }
            },
            ...options
          }
        }), pattern);
      } finally {
        await t.destroy(captured);
      }
    };
    const providers = (entry, name = 'bedrock-anthropic') => ({
      '@apostrophecms/ai': {
        options: {
          providers: {
            [name]: {
              apiKey: 'bedrock-test',
              ...entry
            }
          }
        }
      }
    });

    it('requires a region', async function() {
      await failsToBoot(
        providers({ profile: 'us' }),
        /the "bedrock-anthropic" provider requires a "region"/
      );
    });

    it('rejects a region that is not an AWS region', async function() {
      await failsToBoot(
        providers({
          region: 'evil.example.com/x',
          profile: 'us'
        }),
        /the "bedrock-anthropic" provider's "region" "evil\.example\.com\/x" is not an AWS region/
      );
    });

    it('requires a profile', async function() {
      await failsToBoot(
        providers({ region: 'us-east-1' }),
        /the "bedrock-anthropic" provider requires a "profile"/
      );
    });

    it('rejects an Anthropic workspace, which Bedrock has no use for', async function() {
      await failsToBoot(
        providers({
          region: 'us-east-1',
          profile: 'us',
          workspaceId: 'wrkspc-1'
        }),
        /"providers\.bedrock-anthropic\.workspaceId" is neither a standard entry key nor a setting of adapter "bedrock-anthropic"/
      );
    });

    it('rejects a native effort row naming a model Bedrock does not serve', async function() {
      await failsToBoot({
        '@apostrophecms/ai-adapter-bedrock': {
          options: {
            anthropicModels: [ 'claude-sonnet-5-5', 'claude-opus-5-5' ]
          }
        },
        ...providers({
          region: 'us-east-1',
          profile: 'us'
        })
      }, /the "bedrock-anthropic" provider's "low" effort row names "claude-haiku-5-5", which is not in the "anthropicModels" option of @apostrophecms\/ai-adapter-bedrock/);
    });

    it('requires a profile on bedrock-openai', async function() {
      await failsToBoot(
        providers({ region: 'us-east-1' }, 'bedrock-openai'),
        /the "bedrock-openai" provider requires a "profile"/
      );
    });

    it('rejects a native bedrock-openai effort row naming a model Bedrock does not serve', async function() {
      await failsToBoot({
        '@apostrophecms/ai-adapter-bedrock': {
          options: {
            openaiModels: [ 'gpt-6-luna' ]
          }
        },
        ...providers({
          region: 'us-east-1',
          profile: 'us'
        }, 'bedrock-openai')
      }, /the "bedrock-openai" provider's "medium" effort row names "gpt-6\.1-sol", which is not in the "openaiModels" option of @apostrophecms\/ai-adapter-bedrock/);
    });

    it('requires a region on bedrock-openai-compatible', async function() {
      await failsToBoot(
        providers({}, 'bedrock-openai-compatible'),
        /the "bedrock-openai-compatible" provider requires a "region"/
      );
    });

    it('rejects a profile on bedrock-openai-compatible, which sends ids as given', async function() {
      await failsToBoot(
        providers({
          region: 'us-east-1',
          profile: 'us'
        }, 'bedrock-openai-compatible'),
        /"providers\.bedrock-openai-compatible\.profile" is neither a standard entry key nor a setting of adapter "bedrock-openai-compatible"/
      );
    });

    it('boots an aliased entry on a narrowed list, which gets no native rows', async function() {
      const narrowed = await t.create({
        root: module,
        modules: {
          '@apostrophecms/ai-adapter-bedrock': {
            options: {
              anthropicModels: [ 'claude-opus-5-5' ]
            }
          },
          '@apostrophecms/ai': {
            options: {
              providers: {
                claude: {
                  adapter: 'bedrock-anthropic',
                  apiKey: 'bedrock-test',
                  region: 'us-east-1',
                  profile: 'global',
                  effort: {
                    medium: { model: 'claude-opus-5-5' }
                  }
                }
              }
            }
          }
        }
      });
      try {
        const { providers } = narrowed.ai.modelCatalog();
        assert.deepEqual(Object.keys(providers.claude.models), [ 'claude-opus-5-5' ]);
      } finally {
        await t.destroy(narrowed);
      }
    });
  });

  describe('mock mode', function() {
    let mocked;
    const mockUsage = [];

    before(async function() {
      process.env.APOS_AI_MOCK = '1';
      mocked = await t.create({
        root: module,
        modules: {
          'usage-recorder': {
            handlers(self) {
              return {
                '@apostrophecms/ai:usage': {
                  record(req, usage) {
                    mockUsage.push(usage);
                  }
                }
              };
            }
          },
          '@apostrophecms/ai': {
            options: {
              providers: {
                // No key: validate() is skipped under the mock
                'bedrock-anthropic': {
                  region: 'us-east-1',
                  profile: 'us'
                }
              }
            }
          }
        }
      });
    });

    after(async function() {
      delete process.env.APOS_AI_MOCK;
      if (mocked) {
        await t.destroy(mocked);
      }
    });

    it('answers offline through the routed provider', async function() {
      const result = await mocked.ai.generate(mocked.task.getReq(), 'p');
      assert.equal(result.provider, 'bedrock-anthropic');
      assert.equal(result.model, 'claude-sonnet-5-5');
      assert.equal(mockUsage.length, 1);
      assert.equal(mockUsage[0].mock, true);
      assert.equal(mockUsage[0].wireModel, 'us.anthropic.claude-sonnet-5-5');
    });
  });
});
