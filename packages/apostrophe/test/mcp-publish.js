const assert = require('assert').strict;
const t = require('../test-lib/test.js');
const {
  MODES, createMcpApos, withClient
} = require('./utils/mcp.js');
const { PUBLISHING } = require('../modules/@apostrophecms/mcp/lib/tools.js');

// An outside AI tool may publish, as far as the connected user may, unless
// the project sets the MCP module's `publish` option to false. That keeps
// the publishing tools off the MCP server alone: the assistant keeps them.

describe('MCP: publishing', function () {
  this.timeout(t.timeout);

  describe('by default', function () {
    let apos;

    before(async function () {
      apos = await createMcpApos(module, {
        role: 'editor',
        modules: {
          'mcp-article': { extend: '@apostrophecms/piece-type' }
        }
      });
    });

    after(async function () {
      await t.destroy(apos);
    });

    // A rename or a new publishing tool must reach the list, or
    // `publish: false` would not hold it back
    it('names every registered tool that publishes', function () {
      const names = apos.ai.getTools().map(tool => tool.name);
      for (const name of PUBLISHING) {
        assert(names.includes(name), `${name} is not a registered tool`);
      }
      for (const name of names.filter(name => /publish/.test(name))) {
        assert(PUBLISHING.has(name), `${name} publishes but is not in PUBLISHING`);
      }
    });

    for (const mode of MODES) {
      it(`lists publish_document as destructive (${mode})`, async function () {
        const { tools } = await withClient(apos, mode, client => client.listTools());
        const publish = tools.find(tool => tool.name === 'publish_document');
        assert(publish);
        assert.deepEqual(publish.annotations, {
          readOnlyHint: false,
          destructiveHint: true,
          openWorldHint: false
        });
      });
    }

    it('publishes a draft the connected user may publish', async function () {
      const article = await apos.modules['mcp-article'].insert(
        apos.task.getReq({ mode: 'draft' }),
        { title: 'From MCP' }
      );
      const result = await withClient(apos, 'auto', client => client.callTool({
        name: 'publish_document',
        arguments: { targets: [ { _id: article._id } ] }
      }));
      assert.equal(result.isError, undefined, result.content?.[0]?.text);
      assert.equal(result.structuredContent.published[0].status, 'published');
      const live = await apos.doc.db.findOne({
        _id: article._id.replace(':draft', ':published')
      });
      assert.equal(live.title, 'From MCP');
    });
  });

  describe('with publish: false', function () {
    let apos;

    before(async function () {
      apos = await createMcpApos(module, {
        role: 'editor',
        options: { publish: false }
      });
    });

    after(async function () {
      await t.destroy(apos);
    });

    for (const mode of MODES) {
      it(`neither lists nor runs a publishing tool (${mode})`, async function () {
        const { tools } = await withClient(apos, mode, client => client.listTools());
        const names = tools.map(tool => tool.name);
        assert(!names.some(name => PUBLISHING.has(name)));
        // Every other write stays
        assert(names.includes('update_document'));

        // The SDK answers a name it has not registered with a protocol error
        await assert.rejects(
          withClient(apos, mode, client => client.callTool({
            name: 'publish_document',
            arguments: { targets: [ { _id: 'any' } ] }
          })),
          { code: -32602 }
        );
      });
    }

    it('leaves the assistant its publishing tools', function () {
      const names = apos.aposHarness.getDoorTools('assistant').map(tool => tool.name);
      for (const name of PUBLISHING) {
        assert(names.includes(name), name);
      }
    });
  });
});
