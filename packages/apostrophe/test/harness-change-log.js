const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// The change log: one entry per document a door's request saves.

describe('Harness: the change log', function () {
  this.timeout(t.timeout);

  let apos;
  const turns = [];

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/ai': {
          options: {
            mock() {
              return turns.shift();
            }
          }
        },
        'log-article': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              body: { type: 'string' }
            }
          }
        },
        'log-notice': {
          extend: '@apostrophecms/piece-type',
          options: {
            autopublish: true
          },
          fields: {
            add: {
              body: { type: 'string' }
            }
          }
        },
        'log-test-tools': {
          init(self) {
            self.apos.ai.addTool({
              name: 'write_bodies',
              tags: [ 'content' ],
              description: 'Write the body of documents.',
              input: {
                type: 'object',
                properties: {
                  ids: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  body: { type: 'string' }
                },
                required: [ 'ids', 'body' ]
              },
              handler: async (req, args) => {
                const { written } = await self.apos.harness.writeDocuments(
                  req,
                  args.ids.map(_id => ({
                    _id,
                    patch: { body: args.body }
                  }))
                );
                return { written: written.length };
              }
            });
          }
        }
      }
    });
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  beforeEach(function () {
    turns.length = 0;
  });

  function userReq(extra = {}) {
    return apos.task.getReq({
      user: {
        _id: 'user-ann',
        username: 'ann',
        title: 'Ann',
        role: 'admin'
      },
      mode: 'draft',
      ...extra
    });
  }

  function door(context = {}) {
    return apos.harness.withDoor(userReq(), {
      door: 'assistant',
      lockId: 'chat-1',
      family: 'tab-1',
      chat: 'chat-1',
      request: apos.util.generateId(),
      model: {
        provider: 'mock',
        model: 'scripted'
      },
      ...context
    });
  }

  function insertArticles(count) {
    return Promise.all(Array.from({ length: count }, (item, i) => {
      return apos.modules['log-article'].insert(userReq(), {
        title: `Article ${i + 1}`
      });
    }));
  }

  function entriesOf(req) {
    return apos.harness.changes
      .find({ request: apos.harness.getDoor(req).request })
      .sort({
        at: 1,
        sequence: 1
      })
      .toArray();
  }

  function write(req, _id, patch) {
    return apos.harness.writeDocuments(req, [ {
      _id,
      patch
    } ]);
  }

  function pathsOf(entry) {
    return entry.rows.map(row => row.path.map(segment => segment.name).join('.'));
  }

  it('should record one entry per document of a request, with its rows, call, model and version', async function () {
    const articles = await insertArticles(30);
    const req = door();
    turns.push({
      content: [ {
        type: 'toolCall',
        id: 'call-1',
        name: 'write_bodies',
        input: {
          ids: articles.map(article => article._id),
          body: 'From the model'
        }
      } ],
      finishReason: 'toolCalls',
      usage: {
        inputTokens: 1,
        outputTokens: 1
      }
    }, { text: 'done' });

    await apos.ai.generate(req, 'go', { tools: [ 'write_bodies' ] });
    await apos.harness.endRequest(req);

    const entries = await entriesOf(req);
    assert.equal(entries.length, 30);
    assert.deepEqual(
      new Set(entries.map(entry => entry.docId)),
      new Set(articles.map(article => article._id))
    );
    for (const entry of entries) {
      assert.deepEqual(pathsOf(entry), [ 'body' ]);
      assert.equal(entry.rows[0].new, 'From the model');
      assert.deepEqual(entry.toolCalls, [ {
        id: 'call-1',
        name: 'write_bodies'
      } ]);
      assert.deepEqual(entry.model, {
        provider: 'mock',
        model: 'scripted'
      });
      assert.equal(entry.door, 'assistant');
      assert.equal(entry.chat, 'chat-1');
      assert.equal(entry.userId, 'user-ann');
      assert.equal(entry.effect, 'update');
      assert.equal(entry.ai, true);
      assert.equal(entry.schemaVersion, 1);
      assert.equal(entry.base, undefined);
      const [ version ] = await apos.docVersions.find(userReq(), {
        docId: entry.aposDocId,
        locale: 'en'
      });
      assert.equal(entry.versionId, version._id);
      assert.equal(version.ai, true);
    }
  });

  it('should fold saves of one document in one request into one entry', async function () {
    const [ article ] = await insertArticles(1);
    const req = door();
    for (const body of [ 'One', 'Two', 'Three' ]) {
      await write(req, article._id, { body });
    }
    await write(req, article._id, { title: 'Renamed' });

    const entries = await entriesOf(req);
    assert.equal(entries.length, 1);
    assert.deepEqual(pathsOf(entries[0]).sort(), [ 'body', 'title' ]);
    const body = entries[0].rows.find(row => row.path[0].name === 'body');
    assert.equal(body.new, 'Three');
    assert.equal(entries[0].title, 'Renamed');
    await apos.harness.endRequest(req);
  });

  it('should start a new entry when someone else saved in between', async function () {
    const [ article ] = await insertArticles(1);
    const req = door();
    await write(req, article._id, { body: 'AI first' });
    // The editor's page, unmarked
    const draft = await apos.modules['log-article'].findOneForEditing(userReq(), {
      _id: article._id
    });
    draft.title = 'Edited by Ann';
    await apos.modules['log-article'].update(userReq(), draft);
    await write(req, article._id, { body: 'AI second' });
    await apos.harness.endRequest(req);

    const entries = await entriesOf(req);
    assert.deepEqual(entries.map(entry => entry.sequence), [ 1, 2 ]);
    assert.deepEqual(entries.map(pathsOf), [ [ 'body' ], [ 'body' ] ]);
    assert.equal(entries[1].rows[0].old, 'AI first');
    assert.equal(entries[1].rows[0].new, 'AI second');
  });

  it('should fold a document the request created, and record its creation', async function () {
    const req = door();
    const marked = req.clone({
      aposSaveMarker: {
        door: 'assistant',
        request: apos.harness.getDoor(req).request
      }
    });
    const article = await apos.modules['log-article'].insert(marked, {
      title: 'Created'
    });
    await write(req, article._id, { body: 'Then written' });
    await apos.harness.endRequest(req);

    const entries = await entriesOf(req);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].effect, 'create');
    assert(pathsOf(entries[0]).includes('body'));
    assert(pathsOf(entries[0]).includes('title'));
  });

  it('should record an archive', async function () {
    const [ article ] = await insertArticles(1);
    await apos.modules['log-article'].publish(userReq(), article);
    const req = door();
    await write(req, article._id, { archived: true });
    await apos.harness.endRequest(req);

    const entries = await entriesOf(req);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].effect, 'archive');
    assert.deepEqual(pathsOf(entries[0]).sort(), [ 'archived', 'slug' ]);
  });

  it('should close the request\'s entries at its end', async function () {
    const [ article ] = await insertArticles(1);
    const req = door();
    await write(req, article._id, { body: 'Before the end' });
    const [ open ] = await entriesOf(req);
    assert(open.head);

    await apos.harness.endRequest(req);

    const [ closed ] = await entriesOf(req);
    assert.equal(closed.base, undefined);
    assert.equal(closed.head, undefined);
    assert.deepEqual(closed.rows, open.rows);
    // A late save of the same request no longer folds
    await write(req, article._id, { body: 'After the end' });
    assert.equal((await entriesOf(req)).length, 2);
  });

  it('should record a document of a type that publishes on save once', async function () {
    const notice = await apos.modules['log-notice'].insert(userReq(), { title: 'Notice' });
    const req = door();
    await write(req, notice._id, { body: 'Live' });
    await apos.harness.endRequest(req);

    const entries = await entriesOf(req);
    assert.deepEqual(entries.map(entry => entry.docId), [ notice._id ]);
    assert.deepEqual(pathsOf(entries[0]), [ 'body' ]);
    // The type keeps no versions
    assert.equal(entries[0].versionId, null);
  });

  it('should record the door of an MCP request', async function () {
    const [ article ] = await insertArticles(1);
    const req = door({
      door: 'mcp',
      lockId: 'connection-1',
      family: undefined,
      chat: undefined
    });
    await write(req, article._id, { body: 'Over MCP' });
    await apos.harness.endRequest(req);

    const [ entry ] = await entriesOf(req);
    assert.equal(entry.door, 'mcp');
    assert.equal(entry.chat, null);
  });

  it('should record a revert as the user\'s own change, without the AI mark', async function () {
    const [ article ] = await insertArticles(1);
    const req = door({ revert: true });
    await write(req, article._id, { body: 'Put back' });
    await apos.harness.endRequest(req);

    const [ entry ] = await entriesOf(req);
    assert.equal(entry.ai, false);
    assert.equal(entry.revert, true);
    const [ version ] = await apos.docVersions.find(userReq(), {
      docId: article.aposDocId,
      locale: 'en'
    });
    assert.equal(version.ai, false);
    assert.equal(entry.versionId, version._id);
  });

  it('should record nothing for a save without a door', async function () {
    const [ article ] = await insertArticles(1);
    await write(userReq(), article._id, { body: 'Plain' });

    assert.equal(await apos.harness.changes.countDocuments({ docId: article._id }), 0);
  });
});
