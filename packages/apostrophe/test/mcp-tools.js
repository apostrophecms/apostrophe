const assert = require('assert').strict;
const t = require('../test-lib/test.js');
const {
  USERNAME, MODES, createMcpApos, withClient
} = require('./utils/mcp.js');

// The server lists the tools the harness selects for the `mcp` door, and
// runs each call as the connected user through the engine's own path. Each
// test runs on both protocol versions.

const SECRET = 'connection string with a password';

describe('MCP: tools', function () {
  this.timeout(t.timeout);

  let apos;

  before(async function () {
    apos = await createMcpApos(module, {
      modules: {
        'mcp-test-tools': {
          init(self) {
            addTestTools(self.apos);
          }
        }
      }
    });
  });

  after(async function () {
    await t.destroy(apos);
  });

  for (const mode of MODES) {
    describe(`with a ${mode === 'auto' ? '2026-07-28' : '2025-era'} client`, function () {
      it('lists the door\'s tools', async function () {
        const { tools } = await withClient(apos, mode, client => client.listTools());
        const expected = apos.aposHarness.getDoorTools('mcp')
          .filter(tool => tool.kind !== 'agent')
          .map(tool => tool.name);
        assert.deepEqual(tools.map(tool => tool.name), expected);
        assert(expected.includes('mcp_echo'));
        assert(expected.includes('get_document'));
        assert(!expected.includes('assistant_only'));
        assert(!expected.includes('browser_only'));
      });

      // The harness selects it for the door by its tags; the MCP module
      // drops it, so the assistant's selection is untouched
      it('never lists a tool that runs Apostrophe\'s AI, whatever its tags', async function () {
        const { tools } = await withClient(apos, mode, client => client.listTools());
        assert(!tools.some(tool => tool.name === 'content_agent'));
        assert(apos.aposHarness.getDoorTools('mcp').some(tool => tool.name === 'content_agent'));
        assert(apos.aposHarness.getDoorTools('assistant').some(tool => tool.name === 'content_agent'));
      });

      it('describes each tool as the engine holds it', async function () {
        const { tools } = await withClient(apos, mode, client => client.listTools());
        const byName = Object.fromEntries(tools.map(tool => [ tool.name, tool ]));
        for (const definition of apos.modules['@apostrophecms/mcp'].getTools().values()) {
          const tool = byName[definition.name];
          assert.equal(tool.description, definition.description, definition.name);
          // As JSON carries it: a key set to `undefined` drops out
          assert.deepEqual(
            tool.inputSchema,
            JSON.parse(JSON.stringify(definition.input)),
            definition.name
          );
        }
        assert.equal(byName.get_document.title, 'Read a document');
        assert.deepEqual(byName.get_document.annotations, {
          readOnlyHint: true,
          openWorldHint: false
        });
        assert.deepEqual(byName.update_document.annotations, {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false
        });
        assert.equal(byName.remove_widgets.annotations.destructiveHint, true);
      });

      it('runs a call as the connected user, through the mcp door', async function () {
        const result = await call(apos, mode, 'mcp_echo', { text: 'hello' });
        assert.equal(result.isError, undefined);
        const { structuredContent } = result;
        assert.equal(structuredContent.text, 'hello');
        assert.equal(structuredContent.username, USERNAME);
        assert.equal(structuredContent.door.door, 'mcp');
        // One request per call, its id also the lock id and the tool call's
        assert.equal(structuredContent.door.lockId, structuredContent.door.requestId);
        assert.equal(structuredContent.toolCallId, structuredContent.door.requestId);
        assert.deepEqual(JSON.parse(result.content[0].text), structuredContent);
      });

      it('gives each call its own request', async function () {
        const [ one, two ] = await Promise.all([
          call(apos, mode, 'mcp_echo', { text: 'one' }),
          call(apos, mode, 'mcp_echo', { text: 'two' })
        ]);
        assert.notEqual(
          one.structuredContent.door.requestId,
          two.structuredContent.door.requestId
        );
      });

      it('runs a harness read', async function () {
        const result = await call(apos, mode, 'list_types', {});
        assert.equal(result.isError, undefined);
        assert.equal(typeof result.structuredContent, 'object');
      });

      it('answers invalid arguments with the engine\'s message', async function () {
        const result = await call(apos, mode, 'mcp_echo', {});
        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /text/);
      });

      it('answers a result over budget with the engine\'s message', async function () {
        const result = await call(apos, mode, 'mcp_bulky', {});
        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /the result is too large/);
      });

      it('answers a recoverable tool error with its message', async function () {
        const result = await call(apos, mode, 'mcp_refusing', {});
        assert.equal(result.isError, true);
        assert.equal(result.content[0].text, 'Pick another document.');
      });

      // No tool the door selects asks today. One that did gets a final
      // answer, so the model doesn't call it again
      it('answers a call that stops to ask the user', async function () {
        const result = await call(apos, mode, 'mcp_asking', {});
        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /did not run, so nothing was changed/);
        assert.match(result.content[0].text, /Don't call it again with the same arguments/);
      });

      // The SDK answers a name it has not registered, as the spec has it:
      // a protocol error
      it('refuses a tool outside the selection', async function () {
        for (const name of [ 'assistant_only', 'content_agent', 'no_such_tool' ]) {
          const outcome = await callOrError(apos, mode, name, {});
          assert.equal(outcome.error?.code, -32602, name);
        }
      });

      // The SDK turns any throw from a tool into an `isError` result with its
      // message, so the message is the module's own
      it('answers a handler that throws with no detail', async function () {
        const outcome = await callOrError(apos, mode, 'mcp_broken', {});
        assert(!JSON.stringify(outcome).includes(SECRET));
        assert.equal(outcome.isError, true);
        assert.deepEqual(outcome.content, [ {
          type: 'text',
          text: 'Internal error'
        } ]);
      });
    });
  }

  it('ends each call\'s door request', async function () {
    const ended = [];
    const endRequest = apos.aposHarness.endRequest;
    apos.aposHarness.endRequest = async (req) => {
      ended.push(apos.aposHarness.getDoor(req).requestId);
      return endRequest(req);
    };
    try {
      const ok = await call(apos, 'auto', 'mcp_echo', { text: 'x' });
      await callOrError(apos, 'auto', 'mcp_broken', {});
      assert.equal(ended.length, 2);
      assert.equal(ended[0], ok.structuredContent.door.requestId);
    } finally {
      apos.aposHarness.endRequest = endRequest;
    }
  });
});

function call(apos, mode, name, args) {
  return withClient(apos, mode, client => client.callTool({
    name,
    arguments: args
  }));
}

// The result, or `{ error }` for a protocol error
async function callOrError(apos, mode, name, args) {
  try {
    return await call(apos, mode, name, args);
  } catch (e) {
    return {
      error: {
        code: e.code,
        message: e.message
      }
    };
  }
}

function addTestTools(apos) {
  const empty = {
    type: 'object',
    properties: {}
  };
  apos.ai.addTool({
    name: 'mcp_echo',
    label: 'Echo',
    description: 'Echoes its text with who asked, for tests.',
    tags: [ 'mcp' ],
    kind: 'query',
    input: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: [ 'text' ],
      additionalProperties: false
    },
    handler: async (req, { text }) => ({
      text,
      username: req.user?.username,
      door: apos.aposHarness.getDoor(req),
      toolCallId: req.aposAiToolCall?.id
    })
  });
  // Tagged `content`, so both doors select it by its tags; `kind: 'agent'`
  // marks it as running Apostrophe's AI
  apos.ai.addTool({
    name: 'content_agent',
    description: 'Runs the site\'s own AI, for tests.',
    tags: [ 'content' ],
    kind: 'agent',
    input: empty,
    handler: async () => {
      throw new Error('An agent tool ran over MCP.');
    }
  });
  apos.ai.addTool({
    name: 'mcp_bulky',
    description: 'Returns more than its result budget.',
    tags: [ 'mcp' ],
    kind: 'query',
    input: empty,
    maxResultChars: 80,
    handler: async () => ({ blob: 'x'.repeat(200) })
  });
  apos.ai.addTool({
    name: 'mcp_refusing',
    description: 'Throws the recoverable code.',
    tags: [ 'mcp' ],
    kind: 'query',
    input: empty,
    handler: async () => {
      throw apos.error('aiToolError', 'Pick another document.');
    }
  });
  apos.ai.addTool({
    name: 'mcp_broken',
    description: 'Throws a hard error.',
    tags: [ 'mcp' ],
    kind: 'query',
    input: empty,
    handler: async () => {
      throw new Error(SECRET);
    }
  });
  apos.ai.addTool({
    name: 'mcp_asking',
    description: 'Stops to ask the user first.',
    tags: [ 'mcp' ],
    kind: 'action',
    input: empty,
    handler: async () => {
      throw apos.error('aiInput', 'waiting for the user to confirm', {
        kind: 'confirm'
      });
    }
  });
  apos.ai.addTool({
    name: 'assistant_only',
    description: 'For the assistant alone.',
    tags: [ 'content', 'assistant' ],
    input: empty,
    handler: async () => ({ ok: true })
  });
  apos.ai.addTool({
    name: 'browser_only',
    description: 'Acts in the browser.',
    tags: [ 'content', 'browser' ],
    input: empty,
    handler: async () => ({ ok: true })
  });
}
