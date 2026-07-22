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
      await failsToBoot(minimal({ access: 'delete' }), /"access" must be "read" or "write"/);
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
});
