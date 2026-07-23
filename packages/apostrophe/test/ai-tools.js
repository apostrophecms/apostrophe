const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('AI tools', function() {
  this.timeout(t.timeout);

  let apos;
  // Written by the recording fixture handlers
  const seen = {};

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'tool-handlers': {
          init(self) {
            self.apos.ai.addTool({
              name: 'find_pages',
              description: 'Search pages. Use when the user asks about existing content.',
              tags: [ 'content', 'pages' ],
              access: 'read',
              input: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  limit: { type: 'integer' }
                },
                required: [ 'query' ]
              },
              schema: {
                found: { type: 'boolean' },
                summary: { type: 'string' }
              },
              handler: 'tool-handlers:findPages'
            });
            self.apos.ai.addTool({
              name: 'create_page',
              label: 'Add a page',
              description: 'Create a page.',
              tags: [ 'content' ],
              input: {
                type: 'object',
                properties: {
                  title: { type: 'string' }
                }
              },
              schema: {
                ok: { type: 'boolean' }
              },
              handler: async () => ({ ok: true })
            });
            // Replaced by the tool-overrides module, which inits later
            self.apos.ai.addTool({
              name: 'send_email',
              description: 'First registration, replaced.',
              input: {
                type: 'object',
                properties: {}
              },
              schema: {
                ok: { type: 'boolean' }
              },
              handler: async () => ({ ok: 'original' })
            });
            self.apos.ai.addTool({
              name: 'normalizer',
              description: 'Returns a result needing coercion.',
              input: {
                type: 'object',
                properties: {}
              },
              schema: {
                count: { type: 'integer' }
              },
              handler: async () => ({
                count: '5',
                leaked: 'never'
              })
            });
            self.apos.ai.addTool({
              name: 'tool_trouble',
              description: 'Throws the recoverable code.',
              input: {
                type: 'object',
                properties: {}
              },
              schema: {
                ok: { type: 'boolean' }
              },
              handler: async () => {
                throw self.apos.error('aiToolError', 'the search index is rebuilding');
              }
            });
            self.apos.ai.addTool({
              name: 'forbidden_tool',
              description: 'Throws a standard code.',
              input: {
                type: 'object',
                properties: {}
              },
              schema: {
                ok: { type: 'boolean' }
              },
              handler: async () => {
                throw self.apos.error('forbidden', 'not for you');
              }
            });
            self.apos.ai.addTool({
              name: 'no_object',
              description: 'Returns a non-object result.',
              input: {
                type: 'object',
                properties: {}
              },
              schema: {
                ok: { type: 'boolean' }
              },
              handler: async () => 'not an object'
            });
            self.apos.ai.addTool({
              name: 'wrong_shape',
              description: 'Returns a result its schema rejects.',
              input: {
                type: 'object',
                properties: {}
              },
              schema: {
                count: {
                  type: 'integer',
                  required: true
                }
              },
              handler: async () => ({ wrong: true })
            });
          },
          methods(self) {
            return {
              async findPages(req, args) {
                seen.req = req;
                seen.args = args;
                return {
                  found: 'yes',
                  summary: 'one match'
                };
              }
            };
          }
        },
        'tool-overrides': {
          init(self) {
            self.apos.ai.addTool({
              name: 'send_email',
              label: 'Send an email',
              description: 'Send an email to an editor.',
              input: {
                type: 'object',
                properties: {}
              },
              schema: {
                ok: { type: 'string' }
              },
              handler: async () => ({ ok: 'replaced' })
            });
          }
        }
      }
    });
  });

  after(async function() {
    return t.destroy(apos);
  });

  describe('the registry', function() {
    it('activates canonical definitions', function() {
      const tool = apos.ai.getTool('find_pages');
      assert.deepEqual(Object.keys(tool).sort(), [
        'access', 'description', 'handler', 'input', 'label',
        'name', 'schema', 'tags', 'validateArgs'
      ]);
      assert.equal(tool.label, 'Find Pages');
      assert.deepEqual(tool.tags, [ 'content', 'pages' ]);
      assert.equal(tool.access, 'read');
      assert.equal(typeof tool.handler, 'function');
      assert.equal(typeof tool.validateArgs, 'function');
      assert.deepEqual(
        tool.schema.map(field => [ field.name, field.type ]),
        [ [ 'found', 'boolean' ], [ 'summary', 'string' ] ]
      );
    });

    it('keeps an explicit label, defaults access to write and tags to none', function() {
      const tool = apos.ai.getTool('create_page');
      assert.equal(tool.label, 'Add a page');
      assert.equal(tool.access, 'write');
      const plain = apos.ai.getTool('no_object');
      assert.deepEqual(plain.tags, []);
    });

    it('the last registration of a name wins', async function() {
      const tool = apos.ai.getTool('send_email');
      assert.equal(tool.label, 'Send an email');
      const result = await tool.handler(apos.task.getReq(), {});
      assert.deepEqual(result, { ok: 'replaced' });
    });

    it('queries by name and by tags', function() {
      assert.equal(apos.ai.getTool('ghost'), undefined);
      assert.equal(apos.ai.hasTool('find_pages'), true);
      assert.equal(apos.ai.hasTool('ghost'), false);
      // Prototype-chain names never resolve to anything
      assert.equal(apos.ai.getTool('constructor'), undefined);
      assert.equal(apos.ai.hasTool('toString'), false);
      // The no-criteria list is cached — one array, no per-call
      // allocation
      assert.equal(apos.ai.getTools(), apos.ai.getTools());
      // A tool matching several of the given tags appears once
      assert.deepEqual(
        apos.ai.getTools({ tags: [ 'content', 'pages' ] })
          .map(tool => tool.name).sort(),
        [ 'create_page', 'find_pages' ]
      );
      assert.deepEqual(
        apos.ai.getTools().map(tool => tool.name).sort(),
        [
          'create_page', 'find_pages', 'forbidden_tool', 'no_object',
          'normalizer', 'send_email', 'tool_trouble', 'wrong_shape'
        ]
      );
      assert.deepEqual(
        apos.ai.getTools({ tags: [ 'content' ] }).map(tool => tool.name).sort(),
        [ 'create_page', 'find_pages' ]
      );
      assert.deepEqual(
        apos.ai.getTools({ tags: [ 'pages', 'ghost' ] }).map(tool => tool.name),
        [ 'find_pages' ]
      );
      // A single tag may be a plain string
      assert.deepEqual(
        apos.ai.getTools({ tags: 'pages' }).map(tool => tool.name),
        [ 'find_pages' ]
      );
      assert.deepEqual(apos.ai.getTools({ tags: [] }), []);
      assert.throws(() => apos.ai.getTools({ tags: 42 }), (e) => {
        assert.equal(e.name, 'invalid');
        assert.match(e.message, /"tags" must be an array/);
        return true;
      });
    });

    it('is frozen after startup', function() {
      assert.throws(
        () => apos.ai.addTool({ name: 'too_late' }),
        /tools must be registered before "apostrophe:ready"/
      );
    });
  });

  describe('definition failures', function() {
    // Registration happens in init; validation panics on ready, after
    // every init has run, so the partially booted instance can be
    // captured and destroyed
    const failsToBoot = async (tool, pattern) => {
      let captured;
      try {
        await assert.rejects(t.create({
          root: module,
          exit: 'throw',
          modules: {
            'bad-tools': {
              init(self) {
                captured = self.apos;
                self.apos.ai.addTool(tool);
              }
            }
          }
        }), pattern);
      } finally {
        await t.destroy(captured);
      }
    };

    const minimal = (extras = {}) => ({
      name: 'minimal_tool',
      description: 'A minimal valid tool.',
      input: {
        type: 'object',
        properties: {}
      },
      schema: {
        ok: { type: 'boolean' }
      },
      handler: async () => ({ ok: true }),
      ...extras
    });

    it('panics on a missing or provider-unsafe name', async function() {
      for (const name of [ undefined, 'bad name', 'x'.repeat(65) ]) {
        await failsToBoot(minimal({ name }), /addTool requires a definition with a "name"/);
      }
    });

    it('panics on a missing description or a bad label', async function() {
      await failsToBoot(minimal({ description: '' }), /"description" must be a non-empty string/);
      await failsToBoot(minimal({ label: 42 }), /"label" must be a non-empty string/);
      await failsToBoot(minimal({ tags: [ '' ] }), /"tags" must be an array of tag strings/);
    });

    it('panics on a bad input schema', async function() {
      await failsToBoot(minimal({ input: { type: 'array' } }), /"input" must be a JSON Schema with an object root/);
      await failsToBoot(minimal({
        input: {
          type: 'object',
          propreties: {}
        }
      }), /"input" is not a valid JSON Schema.*propreties/);
    });

    it('panics on a bad result schema', async function() {
      await failsToBoot(minimal({ schema: undefined }), /"schema" must be an object of schema fields/);
      await failsToBoot(minimal({
        schema: {
          found: { type: 'nonsense' }
        }
      }), /Unknown schema field type/);
      await failsToBoot(minimal({
        schema: {
          docs: {
            type: 'array',
            fields: {
              add: {
                title: { type: 'nonsense' }
              }
            }
          }
        }
      }), /Unknown schema field type/);
    });

    it('panics on a bad access value', async function() {
      await failsToBoot(minimal({ access: 'delete' }), /"access" must be "read", "write" or "agent"/);
    });

    it('panics on an unresolvable handler', async function() {
      await failsToBoot(minimal({ handler: 42 }), /"handler" must be a function or a "moduleName:methodName" string/);
      await failsToBoot(minimal({ handler: 'findPages' }), /must name a module and a method/);
      await failsToBoot(minimal({ handler: 'ghost-module:findPages' }), /handler names unknown module "ghost-module"/);
      await failsToBoot(minimal({ handler: 'bad-tools:ghost' }), /handler names unknown method "ghost" of "bad-tools"/);
      // References must not resolve through the prototype chain
      await failsToBoot(minimal({ handler: 'constructor:assign' }), /handler names unknown module "constructor"/);
      await failsToBoot(minimal({ handler: 'bad-tools:toString' }), /handler names unknown method "toString" of "bad-tools"/);
    });
  });

  describe('executing a tool call', function() {
    it('runs the handler with req and validated args, returns the converted result', async function() {
      const req = apos.task.getReq();
      const result = await apos.ai.executeToolCall(req, apos.ai.getTool('find_pages'), {
        id: 'call_1',
        name: 'find_pages',
        input: {
          query: 'pricing',
          limit: 3
        }
      });
      assert.equal(seen.req, req);
      assert.deepEqual(seen.args, {
        query: 'pricing',
        limit: 3,
        _context: {}
      });
      // Converted: laundered to the schema's types, every field present
      assert.deepEqual(result, {
        found: true,
        summary: 'one match'
      });
    });

    it('normalizes the result and drops what the schema does not declare', async function() {
      const req = apos.task.getReq();
      const result = await apos.ai.executeToolCall(req, apos.ai.getTool('normalizer'), {
        id: 'call_1',
        name: 'normalizer',
        input: {}
      });
      assert.deepEqual(result, { count: 5 });
    });

    it('injects _context after validation, replacing any model-provided value', async function() {
      const req = apos.task.getReq();
      const call = {
        id: 'call_1',
        name: 'find_pages',
        input: {
          query: 'pricing',
          _context: 'evil'
        }
      };
      const context = { signal: 'the abort signal' };
      await apos.ai.executeToolCall(req, apos.ai.getTool('find_pages'), call, context);
      assert.deepEqual(seen.args._context, context);
      // The transcript's own part is never mutated
      assert.equal(call.input._context, 'evil');
    });

    it('rejects invalid arguments before the handler runs', async function() {
      const req = apos.task.getReq();
      seen.args = null;
      await assert.rejects(
        apos.ai.executeToolCall(req, apos.ai.getTool('find_pages'), {
          id: 'call_1',
          name: 'find_pages',
          input: { limit: 'many' }
        }),
        (e) => {
          assert.equal(e.name, 'aiToolError');
          assert.match(e.message, /invalid arguments for tool "find_pages"/);
          assert.match(e.message, /query/);
          assert.match(e.message, /limit must be integer/);
          return true;
        }
      );
      assert.equal(seen.args, null);
    });

    it('passes a handler aiToolError through for the model', async function() {
      const req = apos.task.getReq();
      await assert.rejects(
        apos.ai.executeToolCall(req, apos.ai.getTool('tool_trouble'), {
          id: 'call_1',
          name: 'tool_trouble',
          input: {}
        }),
        (e) => {
          assert.equal(e.name, 'aiToolError');
          assert.equal(e.message, 'the search index is rebuilding');
          return true;
        }
      );
    });

    it('passes a standard code through untouched', async function() {
      const req = apos.task.getReq();
      await assert.rejects(
        apos.ai.executeToolCall(req, apos.ai.getTool('forbidden_tool'), {
          id: 'call_1',
          name: 'forbidden_tool',
          input: {}
        }),
        (e) => {
          assert.equal(e.name, 'forbidden');
          assert.equal(e.message, 'not for you');
          return true;
        }
      );
    });

    it('treats a non-object result as a handler bug', async function() {
      const req = apos.task.getReq();
      await assert.rejects(
        apos.ai.executeToolCall(req, apos.ai.getTool('no_object'), {
          id: 'call_1',
          name: 'no_object',
          input: {}
        }),
        (e) => {
          assert.equal(e.name, 'invalid');
          assert.match(e.message, /tool "no_object" must return an object/);
          return true;
        }
      );
    });

    it('treats a result the schema rejects as a handler bug', async function() {
      const req = apos.task.getReq();
      await assert.rejects(
        apos.ai.executeToolCall(req, apos.ai.getTool('wrong_shape'), {
          id: 'call_1',
          name: 'wrong_shape',
          input: {}
        }),
        (e) => {
          assert.equal(e.name, 'invalid');
          assert.match(e.message, /tool "wrong_shape" returned a result that does not match its schema/);
          assert.match(e.message, /count/);
          return true;
        }
      );
    });
  });

  describe('the agent loop', function() {
    // Each test scripts the fake adapter's chat: an array of thunks,
    // one consumed per call
    let chatScript;
    let chatCalls;
    // Handler activity: 'start:<tool>' / 'end:<tool>' entries
    const log = [];
    // [ [ toolName, args._context.depth ] ]
    const depths = [];
    // Set by the scheduling test: reads block until all expected
    // reads have started, proving they overlap
    let readGate = null;
    // [ [ 'before' | 'after', toolName, resultOrError ] ]
    const toolEvents = [];

    const toolCall = (id, name, input = {}) => ({
      type: 'toolCall',
      id,
      name,
      input
    });
    const toolTurn = (...calls) => () => ({
      content: calls,
      finishReason: 'toolCalls',
      usage: {
        inputTokens: 10,
        outputTokens: 5
      },
      model: 'fake-medium'
    });
    const textTurn = (text = 'done') => () => ({
      content: [ {
        type: 'text',
        text
      } ],
      finishReason: 'stop',
      usage: {
        inputTokens: 20,
        outputTokens: 3
      },
      model: 'fake-medium'
    });
    const okSchema = { ok: { type: 'boolean' } };
    const okInput = {
      type: 'object',
      properties: {}
    };

    const track = (name) => async () => {
      log.push(`start:${name}`);
      if (readGate && name.startsWith('read')) {
        readGate.started++;
        if (readGate.started === readGate.expected) {
          readGate.release();
        }
        await readGate.opened;
      }
      log.push(`end:${name}`);
      return { ok: true };
    };

    before(async function() {
      await t.destroy(apos);
      apos = await t.create({
        root: module,
        modules: {
          'fake-adapters': {
            init(self) {
              self.apos.ai.addAdapter({
                name: 'fake',
                label: 'Fake',
                capabilities: {
                  text: true,
                  tools: true,
                  structured: true
                },
                effort: {
                  medium: { model: 'fake-medium' }
                },
                models: {
                  'fake-medium': {
                    contextWindow: 200000,
                    maxOutputTokens: 16000
                  }
                },
                validate() {},
                async chat(req, request) {
                  // Snapshot: the loop keeps growing request.messages
                  chatCalls.push({
                    ...request,
                    messages: [ ...request.messages ]
                  });
                  const step = chatScript.shift();
                  if (step === undefined) {
                    throw new Error('chat called beyond its script');
                  }
                  return step();
                },
                normalizeError(err) {
                  return err;
                }
              });
            }
          },
          'loop-tools': {
            init(self) {
              const add = (tool) => self.apos.ai.addTool({
                description: `The ${tool.name} tool.`,
                input: okInput,
                schema: okSchema,
                ...tool
              });
              add({
                name: 'read_a',
                access: 'read',
                handler: track('read_a')
              });
              add({
                name: 'read_b',
                access: 'read',
                handler: track('read_b')
              });
              add({
                name: 'write_a',
                handler: track('write_a')
              });
              add({
                name: 'write_b',
                handler: track('write_b')
              });
              add({
                name: 'agent_a',
                access: 'agent',
                handler: track('agent_a')
              });
              add({
                name: 'echo',
                input: {
                  type: 'object',
                  properties: {
                    value: { type: 'string' }
                  },
                  required: [ 'value' ]
                },
                schema: {
                  value: { type: 'string' }
                },
                handler: async (req, args) => {
                  log.push('start:echo');
                  depths.push([ 'echo', args._context.depth ]);
                  return { value: args.value };
                }
              });
              add({
                name: 'sub_agent',
                access: 'agent',
                schema: {
                  value: { type: 'string' }
                },
                handler: async (req, args) => {
                  depths.push([ 'sub_agent', args._context.depth ]);
                  const inner = await self.apos.ai.generate(req, 'inner question', {
                    tools: [ 'echo' ]
                  });
                  return { value: inner.text };
                }
              });
              add({
                name: 'sub_sub',
                access: 'agent',
                schema: {
                  value: { type: 'string' }
                },
                handler: async (req) => {
                  const inner = await self.apos.ai.generate(req, 'nested', {
                    tools: [ 'sub_agent', 'echo' ]
                  });
                  return { value: inner.text };
                }
              });
              add({
                name: 'spawner',
                handler: async (req) => {
                  await self.apos.ai.generate(req, 'too deep');
                  return { ok: true };
                }
              });
              add({
                name: 'sub_deep',
                access: 'agent',
                handler: async (req) => {
                  await self.apos.ai.generate(req, 'inner', {
                    tools: [ 'spawner' ]
                  });
                  return { ok: true };
                }
              });
              add({
                name: 'boom_recover',
                handler: async () => {
                  throw self.apos.error('aiToolError', 'the search index is rebuilding');
                }
              });
              add({
                name: 'boom_forbidden',
                handler: async () => {
                  throw self.apos.error('forbidden', 'not for you');
                }
              });
              add({
                name: 'bad_shape',
                schema: {
                  count: {
                    type: 'integer',
                    required: true
                  }
                },
                handler: async () => ({ wrong: true })
              });
            }
          },
          'ai-events': {
            handlers(self) {
              return {
                '@apostrophecms/ai:beforeToolCall': {
                  record(req, payload) {
                    toolEvents.push([ 'before', payload.tool.name ]);
                  }
                },
                '@apostrophecms/ai:afterToolCall': {
                  record(req, payload) {
                    toolEvents.push([ 'after', payload.tool.name, payload.result ?? payload.error ]);
                  }
                }
              };
            }
          },
          '@apostrophecms/ai': {
            options: {
              provider: 'fake',
              providers: {
                fake: { apiKey: 'k1' }
              },
              retryBaseDelay: 1
            }
          }
        }
      });
    });

    beforeEach(function() {
      chatScript = [];
      chatCalls = [];
      log.length = 0;
      depths.length = 0;
      toolEvents.length = 0;
      readGate = null;
    });

    it('runs the loop to completion with transcript, steps and aggregated usage', async function() {
      const req = apos.task.getReq();
      chatScript = [
        toolTurn(toolCall('c1', 'echo', { value: 'pricing' })),
        textTurn('all done')
      ];
      const result = await apos.ai.generate(req, 'find it', { tools: [ 'echo' ] });

      assert.equal(result.text, 'all done');
      assert.equal(result.finishReason, 'stop');
      assert.equal(result.toolCalls, undefined);
      assert.deepEqual(result.steps, [ {
        toolCall: toolCall('c1', 'echo', { value: 'pricing' }),
        result: { value: 'pricing' }
      } ]);
      assert.deepEqual(result.usage, {
        inputTokens: 30,
        outputTokens: 8
      });
      assert.deepEqual(result.messages.map(message => message.role),
        [ 'user', 'assistant', 'tool', 'assistant' ]);
      assert.deepEqual(result.messages[2].content, [ {
        type: 'toolResult',
        toolCallId: 'c1',
        output: { value: 'pricing' }
      } ]);
      // The adapter sees only the model-facing face of a tool
      assert.deepEqual(chatCalls[0].tools, [ {
        name: 'echo',
        description: 'The echo tool.',
        input: apos.ai.getTool('echo').input
      } ]);
      // The second call carried the grown transcript
      assert.equal(chatCalls[1].messages.length, 3);
      assert.deepEqual(toolEvents, [
        [ 'before', 'echo' ],
        [ 'after', 'echo', { value: 'pricing' } ]
      ]);
    });

    it('combines tools and schema: the loop runs free, the final answer validates', async function() {
      const req = apos.task.getReq();
      const object = { found: 'pricing' };
      chatScript = [
        // The tool turn is not the answer and must never reach the
        // backstop — it has no object to offer
        toolTurn(toolCall('c1', 'echo', { value: 'pricing' })),
        // The final answer: the adapter placed the object on the turn
        () => ({
          content: [ {
            type: 'text',
            text: JSON.stringify(object)
          } ],
          object,
          finishReason: 'stop',
          usage: {
            inputTokens: 20,
            outputTokens: 3
          },
          model: 'fake-medium'
        })
      ];
      const result = await apos.ai.generate(req, 'find it', {
        tools: [ 'echo' ],
        schema: {
          type: 'object',
          properties: {
            found: { type: 'string' }
          },
          required: [ 'found' ]
        }
      });

      assert.deepEqual(result.object, object);
      assert.equal(result.finishReason, 'stop');
      assert.equal(result.steps.length, 1);
      // The adapter request carried both faces
      assert.equal(chatCalls[0].tools.length, 1);
      assert.equal(chatCalls[0].schema.type, 'object');
    });

    it('runs reads in parallel first, then writes serially in model order', async function() {
      const req = apos.task.getReq();
      let release;
      const opened = new Promise((resolve) => {
        release = resolve;
      });
      readGate = {
        expected: 2,
        started: 0,
        release,
        opened
      };
      chatScript = [
        toolTurn(
          toolCall('c1', 'read_a'),
          toolCall('c2', 'write_a'),
          toolCall('c3', 'agent_a'),
          toolCall('c4', 'read_b'),
          toolCall('c5', 'write_b')
        ),
        textTurn()
      ];
      const result = await apos.ai.generate(req, 'go', {
        tools: [ 'read_a', 'read_b', 'write_a', 'write_b', 'agent_a' ]
      });

      // Both reads started before either finished; writes and agents
      // followed, one at a time, in the order the model asked
      assert.deepEqual(log.slice(0, 2).sort(), [ 'start:read_a', 'start:read_b' ]);
      assert.deepEqual(log.slice(2, 4).sort(), [ 'end:read_a', 'end:read_b' ]);
      assert.deepEqual(log.slice(4), [
        'start:write_a', 'end:write_a', 'start:agent_a', 'end:agent_a',
        'start:write_b', 'end:write_b'
      ]);
      // Steps stay in model order regardless of scheduling
      assert.deepEqual(
        result.steps.map(step => step.toolCall.name),
        [ 'read_a', 'write_a', 'agent_a', 'read_b', 'write_b' ]
      );
    });

    it('feeds recoverable failures back and leaves siblings unaffected', async function() {
      const req = apos.task.getReq();
      chatScript = [
        toolTurn(
          toolCall('c1', 'boom_recover'),
          toolCall('c2', 'echo', { value: 'still runs' })
        ),
        textTurn()
      ];
      const result = await apos.ai.generate(req, 'go', {
        tools: [ 'boom_recover', 'echo' ]
      });

      assert.deepEqual(result.steps, [
        {
          toolCall: toolCall('c1', 'boom_recover'),
          error: 'the search index is rebuilding'
        },
        {
          toolCall: toolCall('c2', 'echo', { value: 'still runs' }),
          result: { value: 'still runs' }
        }
      ]);
      // The model read the error back
      assert.deepEqual(chatCalls[1].messages.at(-1).content[0], {
        type: 'toolResult',
        toolCallId: 'c1',
        error: 'the search index is rebuilding'
      });
    });

    it('feeds invalid arguments and unknown tools back without running anything', async function() {
      const req = apos.task.getReq();
      chatScript = [
        toolTurn(
          toolCall('c1', 'echo', { value: 42 }),
          toolCall('c2', 'ghost')
        ),
        textTurn()
      ];
      const result = await apos.ai.generate(req, 'go', { tools: [ 'echo' ] });

      assert.match(result.steps[0].error, /invalid arguments for tool "echo"/);
      assert.match(result.steps[0].error, /value must be string/);
      assert.equal(result.steps[1].error, 'unknown tool "ghost"');
      // No handler ran
      assert.deepEqual(log, []);
    });

    it('hard-stops on a standard code with nothing model-bound', async function() {
      const req = apos.task.getReq();
      chatScript = [
        toolTurn(
          toolCall('c1', 'boom_forbidden'),
          toolCall('c2', 'echo', { value: 'never' })
        )
      ];
      await assert.rejects(
        apos.ai.generate(req, 'go', { tools: [ 'boom_forbidden', 'echo' ] }),
        (e) => {
          assert.equal(e.name, 'forbidden');
          assert.equal(e.message, 'not for you');
          return true;
        }
      );
      // The batch aborted: the later write never ran, the model was
      // never called again
      assert.deepEqual(log, []);
      assert.equal(chatCalls.length, 1);
    });

    it('hard-stops on a handler bug', async function() {
      const req = apos.task.getReq();
      chatScript = [
        toolTurn(toolCall('c1', 'bad_shape'))
      ];
      await assert.rejects(
        apos.ai.generate(req, 'go', { tools: [ 'bad_shape' ] }),
        (e) => {
          assert.equal(e.name, 'invalid');
          assert.match(e.message, /does not match its schema/);
          return true;
        }
      );
      assert.equal(chatCalls.length, 1);
    });

    it('returns pending tool calls unexecuted when maxSteps is spent', async function() {
      const req = apos.task.getReq();
      chatScript = [
        toolTurn(toolCall('c1', 'echo', { value: 'first' })),
        toolTurn(toolCall('c2', 'echo', { value: 'second' }))
      ];
      const result = await apos.ai.generate(req, 'go', {
        tools: [ 'echo' ],
        maxSteps: 2
      });

      assert.equal(result.finishReason, 'maxSteps');
      // The first round executed, the second is pending, untouched
      assert.deepEqual(result.steps, [ {
        toolCall: toolCall('c1', 'echo', { value: 'first' }),
        result: { value: 'first' }
      } ]);
      assert.deepEqual(result.toolCalls, [
        toolCall('c2', 'echo', { value: 'second' })
      ]);
      assert.deepEqual(log, [ 'start:echo' ]);
      assert.equal(result.messages.at(-1).role, 'assistant');
    });

    it('maxSteps: 1 is manual mode', async function() {
      const req = apos.task.getReq();
      chatScript = [
        toolTurn(toolCall('c1', 'echo', { value: 'manual' }))
      ];
      const result = await apos.ai.generate(req, 'go', {
        tools: [ 'echo' ],
        maxSteps: 1
      });

      assert.equal(result.finishReason, 'maxSteps');
      assert.deepEqual(result.steps, []);
      assert.deepEqual(result.toolCalls, [
        toolCall('c1', 'echo', { value: 'manual' })
      ]);
      assert.deepEqual(log, []);
    });

    it('resumes from a returned transcript with hand-run tool results', async function() {
      const req = apos.task.getReq();
      chatScript = [
        toolTurn(toolCall('c1', 'echo', { value: 'manual' }))
      ];
      const first = await apos.ai.generate(req, 'go', {
        tools: [ 'echo' ],
        maxSteps: 1
      });

      chatScript = [ textTurn('resumed') ];
      const second = await apos.ai.generate(req, {
        messages: [
          ...first.messages,
          {
            role: 'tool',
            content: [ {
              type: 'toolResult',
              toolCallId: 'c1',
              output: { value: 'ran by hand' }
            } ]
          }
        ],
        tools: [ 'echo' ]
      });

      assert.equal(second.text, 'resumed');
      // The adapter received the full round-tripped transcript
      assert.deepEqual(
        chatCalls.at(-1).messages.map(message => message.role),
        [ 'user', 'assistant', 'tool' ]
      );
    });

    it('an agent tool runs a subagent, one level deep', async function() {
      const req = apos.task.getReq();
      chatScript = [
        // Outer turn: request the agent tool
        toolTurn(toolCall('c1', 'sub_agent')),
        // Inner conversation: request echo, then answer
        toolTurn(toolCall('c2', 'echo', { value: 'from below' })),
        textTurn('inner done'),
        // Outer conversation resumes
        textTurn('outer done')
      ];
      const result = await apos.ai.generate(req, 'go', { tools: [ 'sub_agent' ] });

      assert.equal(result.text, 'outer done');
      assert.deepEqual(result.steps, [ {
        toolCall: toolCall('c1', 'sub_agent'),
        result: { value: 'inner done' }
      } ]);
      // The handler ran at depth 1, the subagent's own handler at 2
      assert.deepEqual(depths, [
        [ 'sub_agent', 1 ],
        [ 'echo', 2 ]
      ]);
      // Handlers run on stamped clones; the caller's req is untouched
      assert.equal(req.aposAiDepth, undefined);
    });

    it('a subagent silently drops agent tools from its set', async function() {
      const req = apos.task.getReq();
      chatScript = [
        toolTurn(toolCall('c1', 'sub_sub')),
        // The nested conversation: only the non-agent tool survived
        toolTurn(toolCall('c2', 'echo', { value: 'kept' })),
        textTurn('inner done'),
        textTurn('outer done')
      ];
      const result = await apos.ai.generate(req, 'go', { tools: [ 'sub_sub' ] });

      assert.equal(result.text, 'outer done');
      assert.deepEqual(result.steps[0].result, { value: 'inner done' });
      // The nested request offered the model only the non-agent tool
      assert.deepEqual(
        chatCalls[1].tools.map(tool => tool.name),
        [ 'echo' ]
      );
    });

    it('limits generation to one level of nesting', async function() {
      const req = apos.task.getReq();
      chatScript = [
        toolTurn(toolCall('c1', 'sub_deep')),
        // The subagent's conversation requests a plain write tool,
        // whose handler tries to generate again
        toolTurn(toolCall('c2', 'spawner'))
      ];
      await assert.rejects(
        apos.ai.generate(req, 'go', { tools: [ 'sub_deep' ] }),
        (e) => {
          assert.equal(e.name, 'invalid');
          assert.match(e.message, /one level of nesting/);
          return true;
        }
      );
      assert.equal(chatCalls.length, 2);
    });

    it('rejects malformed tool turns into the retry path', function() {
      const usage = {
        inputTokens: 1,
        outputTokens: 1
      };
      assert.throws(() => apos.ai.validateTurn({
        content: [ {
          type: 'text',
          text: 'x'
        } ],
        finishReason: 'toolCalls',
        usage
      }), (e) => {
        assert.equal(e.name, 'aiRetry');
        assert.match(e.message, /"toolCalls" finish reason without toolCall parts/);
        return true;
      });
      assert.throws(() => apos.ai.validateTurn({
        content: [ {
          type: 'toolCall',
          name: 'echo',
          input: {}
        } ],
        finishReason: 'toolCalls',
        usage
      }), (e) => {
        assert.equal(e.name, 'aiRetry');
        assert.match(e.message, /toolCall parts must carry/);
        return true;
      });
    });
  });

  describe('the agent loop under APOS_AI_MOCK', function() {
    const log = [];

    before(async function() {
      process.env.APOS_AI_MOCK = '1';
      await t.destroy(apos);
      apos = await t.create({
        root: module,
        modules: {
          'loop-tools': {
            init(self) {
              self.apos.ai.addTool({
                name: 'echo',
                description: 'Echo a value.',
                input: {
                  type: 'object',
                  properties: {
                    value: { type: 'string' }
                  },
                  required: [ 'value' ]
                },
                schema: {
                  value: { type: 'string' }
                },
                handler: async (req, args) => {
                  log.push(args.value);
                  return { value: args.value };
                }
              });
            }
          },
          '@apostrophecms/ai': {
            options: {
              // A scripted model: request a tool once, then answer
              mock(req, request) {
                if (request.messages.at(-1).role !== 'tool') {
                  return {
                    content: [ {
                      type: 'toolCall',
                      id: 'c1',
                      name: 'echo',
                      input: { value: 'offline' }
                    } ],
                    finishReason: 'toolCalls',
                    usage: {
                      inputTokens: 1,
                      outputTokens: 1
                    }
                  };
                }
                return { text: 'offline done' };
              }
            }
          }
        }
      });
    });

    after(async function() {
      delete process.env.APOS_AI_MOCK;
    });

    it('scripted mock tool calls run the real handlers offline', async function() {
      const req = apos.task.getReq();
      const result = await apos.ai.generate(req, 'go', { tools: [ 'echo' ] });
      assert.equal(result.text, 'offline done');
      assert.deepEqual(log, [ 'offline' ]);
      assert.deepEqual(result.steps, [ {
        toolCall: {
          type: 'toolCall',
          id: 'c1',
          name: 'echo',
          input: { value: 'offline' }
        },
        result: { value: 'offline' }
      } ]);
    });
  });
});
