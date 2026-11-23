const assert = require('assert').strict;
const t = require('../test-lib/test.js');
const {
  USERNAME, MODES, createMcpApos, withClient
} = require('./utils/mcp.js');

// A write over MCP goes through the assistant's write path as the connected
// user: a draft (live for a type that publishes on save), marked as AI's,
// recorded in the change log under the user, refused where the user may not
// edit or someone has the document open. Each test runs on both protocol
// versions.

describe('MCP: writes and the change log', function () {
  this.timeout(t.timeout);

  let apos;
  let editor;
  let bob;

  before(async function () {
    apos = await createMcpApos(module, {
      role: 'editor',
      modules: {
        'mcp-article': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              body: { type: 'string' }
            }
          }
        },
        'mcp-notice': {
          extend: '@apostrophecms/piece-type',
          options: {
            autopublish: true
          }
        },
        'mcp-restricted': {
          extend: '@apostrophecms/piece-type',
          options: {
            editRole: 'admin',
            publishRole: 'admin'
          },
          fields: {
            add: {
              body: { type: 'string' }
            }
          }
        }
      }
    });
    editor = await apos.user.find(apos.task.getReq(), { username: USERNAME }).toObject();
    bob = await t.createUser(apos, 'editor', {
      username: 'bob',
      title: 'Bob'
    });
  });

  after(async function () {
    await t.destroy(apos);
  });

  for (const mode of MODES) {
    describe(`with a ${mode === 'auto' ? '2026-07-28' : '2025-era'} client`, function () {
      it('writes a draft, marked as AI\'s, the published copy untouched', async function () {
        const article = await insertPublished('mcp-article', { body: 'Original' });
        const result = await update(mode, article._id, { body: 'Over MCP' });

        assert.equal(result.isError, undefined);
        const {
          written, refused, requestId
        } = result.structuredContent;
        assert.equal(refused, undefined);
        assert.equal(written.length, 1);
        assert.equal(written[0]._id, article._id);
        assert.equal(written[0].published, false);
        assert.equal(typeof requestId, 'string');
        assert.equal((await findDraft(article._id)).body, 'Over MCP');
        assert.equal((await findPublished(article._id)).body, 'Original');
        const [ version ] = await apos.docVersions.find(apos.task.getReq(), {
          docId: article.aposDocId
        });
        assert.equal(version.ai, true);
      });

      it('records the write in the change log under the user, through the mcp door', async function () {
        const article = await insertPublished('mcp-article', { body: 'Original' });
        const { requestId } = (await update(mode, article._id, { body: 'Logged' }))
          .structuredContent;

        const entries = await apos.aposHarness.changes.find({ requestId }).toArray();
        assert.equal(entries.length, 1);
        const [ entry ] = entries;
        assert.equal(entry.docId, article._id);
        assert.equal(entry.door, 'mcp');
        assert.equal(entry.chat, null);
        assert.equal(entry.ai, true);
        assert.equal(entry.userId, editor._id);
        assert.equal(entry.userTitle, 'Ed Itor');
        assert.equal(entry.effect, 'update');
        assert.deepEqual(entry.toolCalls, [ {
          id: requestId,
          name: 'update_document'
        } ]);
        // The request ended with the call
        assert.equal(entry.head, undefined);
      });

      it('reads back what a write changed by its request id', async function () {
        const article = await insertPublished('mcp-article', { body: 'Original' });
        const { requestId } = (await update(mode, article._id, { body: 'Changed' }))
          .structuredContent;

        const result = await call(mode, 'get_changes', {
          _id: article._id,
          requestId
        });
        assert.equal(result.isError, undefined);
        const text = result.content[0].text;
        assert.match(text, /Changed/);
        assert.match(text, /Original/);
      });

      it('creates a piece of a type that publishes on save, live', async function () {
        const title = `Notice ${mode}`;
        const result = await call(mode, 'create_piece', {
          type: 'mcp-notice',
          title
        });

        assert.equal(result.isError, undefined);
        const { written, requestId } = result.structuredContent;
        assert.equal(written[0].published, true);
        assert.match(result.structuredContent.notice, /live/);
        const live = await apos.doc.db.findOne({
          type: 'mcp-notice',
          title,
          aposMode: 'published'
        });
        assert(live);
        const [ entry ] = await apos.aposHarness.changes.find({ requestId }).toArray();
        assert.equal(entry.effect, 'create');
        assert.equal(entry.door, 'mcp');
      });

      it('refuses a write the user may not make, saving nothing', async function () {
        const restricted = await insertPublished('mcp-restricted', { body: 'Original' });
        const result = await update(mode, restricted._id, { body: 'Not allowed' });

        const {
          written, refused, requestId
        } = result.structuredContent;
        assert.deepEqual(written, []);
        assert.equal(refused[0].reason, 'forbidden');
        assert.equal((await findDraft(restricted._id)).body, 'Original');
        assert.equal(await apos.aposHarness.changes.countDocuments({ requestId }), 0);
      });

      it('refuses a document someone has open, and says who', async function () {
        const article = await insertPublished('mcp-article', { body: 'Original' });
        const draft = await findDraft(article._id);
        await apos.doc.lock(userReq(bob), draft, 'bob-tab');

        const { written, refused } = (await update(mode, article._id, { body: 'Over MCP' }))
          .structuredContent;

        assert.deepEqual(written, []);
        assert.equal(refused[0].reason, 'locked');
        assert.match(refused[0].message, /Bob/);
        assert.equal((await findDraft(article._id)).body, 'Original');
      });

      it('refuses a document the same user has open in edit mode', async function () {
        const article = await insertPublished('mcp-article', { body: 'Original' });
        const draft = await findDraft(article._id);
        await apos.doc.lock(userReq(editor), draft, 'editor-tab');

        const { written, refused } = (await update(mode, article._id, { body: 'Over MCP' }))
          .structuredContent;

        assert.deepEqual(written, []);
        assert.equal(refused[0].reason, 'locked');
        assert.match(refused[0].message, /same user/);
        assert.equal((await findDraft(article._id)).body, 'Original');
      });
    });
  }

  function userReq(user) {
    return apos.task.getReq({
      user,
      mode: 'draft'
    });
  }

  // A published document with its draft; resolves to the draft
  async function insertPublished(type, values) {
    const req = apos.task.getReq({ mode: 'draft' });
    const draft = await apos.modules[type].insert(req, {
      title: `A ${type}`,
      ...values
    });
    await apos.modules[type].publish(req, draft);
    return draft;
  }

  function findDraft(_id) {
    return apos.doc.db.findOne({ _id });
  }

  function findPublished(_id) {
    return apos.doc.db.findOne({ _id: _id.replace(':draft', ':published') });
  }

  function call(mode, name, args) {
    return withClient(apos, mode, client => client.callTool({
      name,
      arguments: args
    }));
  }

  function update(mode, _id, values) {
    return call(mode, 'update_document', {
      targets: [ {
        _id,
        values
      } ]
    });
  }
});

// Users and permission groups are denied to AI whatever the user's
// permissions (`apos.ai.getDeniedTypes`). Connected as an admin, who may edit
// users, so that only the AI's own block stands in the way.
describe('MCP: users are out of reach, even for an admin', function () {
  this.timeout(t.timeout);

  let apos;
  let bob;

  before(async function () {
    apos = await createMcpApos(module, { role: 'admin' });
    bob = await t.createUser(apos, 'editor', {
      username: 'bob',
      title: 'Bob'
    });
  });

  after(async function () {
    await t.destroy(apos);
  });

  for (const mode of MODES) {
    describe(`with a ${mode === 'auto' ? '2026-07-28' : '2025-era'} client`, function () {
      it('offers no user type in any tool', async function () {
        const { tools } = await withClient(apos, mode, client => client.listTools());
        assert(tools.length);
        assert(!JSON.stringify(tools).includes('@apostrophecms/user'));
      });

      it('refuses a change to a user, their role included', async function () {
        const result = await call(mode, 'update_document', {
          targets: [ {
            _id: bob._id,
            values: {
              title: 'Renamed',
              role: 'admin'
            }
          } ]
        });

        const { written, refused } = result.structuredContent;
        assert.deepEqual(written, []);
        assert.equal(refused[0].reason, 'forbidden');
        const stored = await apos.doc.db.findOne({ _id: bob._id });
        assert.equal(stored.title, 'Bob');
        assert.equal(stored.role, 'editor');
      });

      // As if there were no such document: the refusal doesn't confirm a
      // user exists
      it('refuses to read a user', async function () {
        const result = await call(mode, 'get_document', { _id: bob._id });
        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /^No document ".+" the user can read/);
        assert(!result.content[0].text.includes('Bob'));
      });
    });
  }

  function call(mode, name, args) {
    return withClient(apos, mode, client => client.callTool({
      name,
      arguments: args
    }));
  }
});
