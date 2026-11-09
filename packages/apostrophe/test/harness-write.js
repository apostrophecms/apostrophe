const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// The harness's door selections, door context, write path and guards.

describe('Harness: doors, the write path and guards', function () {
  this.timeout(t.timeout);

  let apos;
  const saves = [];
  const locksDuringSave = [];
  const settled = [];
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
          },
          extendMethods() {
            return {
              getDeniedTypes(_super) {
                return [ ..._super(), 'harness-secret' ];
              }
            };
          }
        },
        'harness-secret': {
          extend: '@apostrophecms/piece-type'
        },
        'harness-card-widget': {
          extend: '@apostrophecms/widget-type',
          fields: {
            add: {
              heading: { type: 'string' },
              kicker: {
                type: 'string',
                def: 'News'
              },
              body: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {}
                  }
                }
              },
              links: {
                type: 'array',
                fields: {
                  add: {
                    label: { type: 'string' }
                  }
                }
              },
              _related: {
                type: 'relationship',
                withType: 'harness-article'
              },
              secret: { type: 'string' }
            }
          },
          methods(self) {
            return {
              getAiSchema(req) {
                return self.schema.filter(field => field.name !== 'secret');
              }
            };
          }
        },
        'harness-article': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              body: { type: 'string' },
              main: {
                type: 'area',
                options: {
                  widgets: {
                    'harness-card': {},
                    '@apostrophecms/rich-text': {}
                  }
                }
              },
              _related: {
                type: 'relationship',
                withType: 'harness-article'
              }
            }
          },
          handlers(self) {
            return {
              afterSave: {
                async count(req, doc) {
                  saves.push(doc._id);
                  const { advisoryLock } = await self.apos.doc.db
                    .findOne({ _id: doc._id });
                  locksDuringSave.push(advisoryLock);
                }
              },
              afterSaveSettled: {
                record(req, doc, event) {
                  settled.push(event);
                }
              }
            };
          }
        },
        'harness-notice': {
          extend: '@apostrophecms/piece-type',
          options: {
            autopublish: true
          }
        },
        'harness-setting': {
          extend: '@apostrophecms/piece-type',
          options: {
            localized: false
          }
        },
        'harness-test-tools': {
          init(self) {
            const tool = (name, tags, extra = {}) => self.apos.ai.addTool({
              name,
              tags,
              description: `The ${name} tool.`,
              input: {
                type: 'object',
                properties: {}
              },
              handler: async () => ({}),
              ...extra
            });
            tool('t_content', [ 'content' ], {
              input: () => ({
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: self.apos.harness.getDocTypeNames()
                  }
                }
              })
            });
            tool('t_assistant', [ 'assistant' ]);
            tool('t_browser', [ 'assistant', 'browser' ]);
            tool('t_mcp', [ 'mcp' ]);
            tool('t_mcp_browser', [ 'mcp', 'browser' ]);
            tool('t_removed', [ 'content' ]);
            self.apos.ai.removeTool('t_removed');
            tool('t_write', [ 'content' ], {
              input: {
                type: 'object',
                properties: {
                  _id: { type: 'string' },
                  body: { type: 'string' }
                },
                required: [ '_id', 'body' ]
              },
              handler: async (req, args) => {
                const { harness } = self.apos;
                const { written, refused } = await harness.writeDocuments(req, [ {
                  _id: args._id,
                  patch: { body: args.body }
                } ]);
                return {
                  written: written.map(({ doc, ...result }) => result),
                  refused
                };
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
    saves.length = 0;
    locksDuringSave.length = 0;
    settled.length = 0;
    turns.length = 0;
  });

  function userReq(username, extra = {}) {
    return apos.task.getReq({
      user: {
        _id: `user-${username}`,
        username,
        title: username[0].toUpperCase() + username.slice(1),
        role: 'admin'
      },
      mode: 'draft',
      ...extra
    });
  }

  function door(req, context = {}) {
    return apos.harness.withDoor(req, {
      door: 'assistant',
      lockId: 'chat-1',
      family: 'tab-1',
      request: 'request-1',
      ...context
    });
  }

  async function insertArticle(fields = {}) {
    return apos.modules['harness-article'].insert(userReq('ann'), {
      title: 'An article',
      main: {
        _id: apos.util.generateId(),
        metaType: 'area',
        items: []
      },
      ...fields
    });
  }

  function findDraft(_id) {
    return apos.doc.db.findOne({ _id });
  }

  describe('doors', function () {
    it('should select the harness tools for both doors, and each door its own', function () {
      const names = door => apos.harness.getDoorTools(door).map(tool => tool.name);
      const test = door => names(door).filter(name => name.startsWith('t_'));
      const harness = door => names(door).filter(name => !name.startsWith('t_'));

      assert.deepEqual(test('assistant'), [
        't_assistant', 't_browser', 't_content', 't_write'
      ]);
      assert.deepEqual(test('mcp'), [ 't_content', 't_mcp', 't_write' ]);
      assert(harness('mcp').includes('search_content'));
      assert.deepEqual(harness('assistant'), harness('mcp'));
    });

    it('should leave out a removed tool everywhere', function () {
      for (const door of apos.harness.getDoorNames()) {
        assert.equal(
          apos.harness.getDoorTools(door).some(tool => tool.name === 't_removed'),
          false
        );
      }
      assert.equal(apos.ai.hasTool('t_removed'), false);
    });

    it('should refuse an unknown door', function () {
      assert.throws(() => apos.harness.getDoorTools('nope'), { name: 'invalid' });
    });

    it('should list the values an argument takes, in its definition and list-tools', async function () {
      const types = apos.harness.getDocTypeNames();
      assert(types.includes('harness-article'));
      assert(types.includes('@apostrophecms/home-page'));
      assert.equal(types.includes('@apostrophecms/user'), false);
      assert.equal(types.some(type => type.startsWith('@apostrophecms/any-')), false);
      // Denied by the project
      assert.equal(types.includes('harness-secret'), false);

      const listed = apos.harness.getDoorTools('mcp')
        .find(tool => tool.name === 't_content');
      assert.deepEqual(listed.input.properties.type.enum, types);

      const printed = await captureLog(() => apos.task.invoke(
        '@apostrophecms/harness:list-tools',
        { door: 'mcp' }
      ));
      assert.match(printed, /^# mcp: \d+ tools, definitions \d+ characters/);
      assert.match(printed, /## t_content \[action\] content, definition \d+ characters/);
      assert.match(printed, /- type: string \(one of [^)]*harness-article/);
      assert.equal(printed.includes('t_browser'), false);
      assert.equal(printed.includes('token'), false);
    });
  });

  describe('the door context', function () {
    it('should ride on a clone of the request', function () {
      const req = userReq('ann');
      const doorReq = door(req, {
        chat: 'chat-1',
        model: {
          provider: 'p',
          model: 'm'
        }
      });

      assert.equal(apos.harness.getDoor(req), null);
      assert.deepEqual(apos.harness.getDoor(doorReq), {
        door: 'assistant',
        lockId: 'chat-1',
        family: 'tab-1',
        request: 'request-1',
        chat: 'chat-1',
        model: {
          provider: 'p',
          model: 'm'
        }
      });
      assert.equal(doorReq.user, req.user);
    });

    it('should refuse an incomplete or unknown context', function () {
      const req = userReq('ann');
      assert.throws(() => door(req, { lockId: '' }), { name: 'invalid' });
      assert.throws(() => door(req, { request: undefined }), { name: 'invalid' });
      assert.throws(() => door(req, { family: 'chat-1' }), { name: 'invalid' });
      assert.throws(() => door(req, { model: 'm' }), { name: 'invalid' });
      assert.throws(() => door(req, { tab: 'x' }), { name: 'invalid' });
    });

    it('should reach every handler of a generate call, and mark its saves', async function () {
      const article = await insertArticle();
      const req = door(userReq('ann'), {
        chat: 'chat-1',
        model: {
          provider: 'p',
          model: 'm'
        }
      });
      turns.push(toolTurn('t_write', {
        _id: article._id,
        body: 'From the model'
      }), { text: 'done' });

      const result = await apos.ai.generate(req, 'go', { tools: [ 't_write' ] });

      assert.equal(result.steps[0].result.written[0]._id, article._id);
      assert.equal(settled.length, 1);
      assert.deepEqual(settled[0].marker, {
        door: 'assistant',
        request: 'request-1',
        chat: 'chat-1',
        model: {
          provider: 'p',
          model: 'm'
        }
      });
      assert.equal(settled[0].toolCall.name, 't_write');
      assert.equal(settled[0].after.body, 'From the model');
      assert.equal(locksDuringSave.at(-1).member._id, 'chat-1');
      assert.equal((await findDraft(article._id)).advisoryLock, undefined);
    });

    it('should lock a plain call only while it writes, and record nothing', async function () {
      const article = await insertArticle();
      turns.push(toolTurn('t_write', {
        _id: article._id,
        body: 'Plain'
      }), { text: 'done' });

      await apos.ai.generate(userReq('ann'), 'go', { tools: [ 't_write' ] });

      const stored = await findDraft(article._id);
      assert.equal(stored.body, 'Plain');
      assert(locksDuringSave.at(-1)._id);
      assert.equal(stored.advisoryLock, undefined);
      assert.equal(settled.length, 0);
    });
  });

  describe('the write path', function () {
    it('should write the draft, marked as AI in Document Versions', async function () {
      const article = await insertArticle();
      const { written, refused } = await apos.harness.writeDocuments(userReq('ann'), [ {
        _id: article._id,
        patch: { body: 'Written' }
      } ]);

      assert.deepEqual(refused, []);
      assert.equal(written[0]._id, article._id);
      assert.equal(written[0].title, 'An article');
      assert.equal(written[0].locale, 'en');
      assert.equal(written[0].published, false);
      assert.match(written[0].notice, /draft/);
      assert.equal((await findDraft(article._id)).body, 'Written');
      const [ version ] = await apos.docVersions.find(userReq('ann'), {
        docId: article.aposDocId
      });
      assert.equal(version.ai, true);
    });

    it('should find a document by its aposDocId or in its published mode', async function () {
      const article = await insertArticle();
      for (const _id of [ article.aposDocId, article._id.replace(':draft', ':published') ]) {
        const { written } = await apos.harness.writeDocuments(userReq('ann'), [ {
          _id,
          patch: { body: _id }
        } ]);
        assert.equal(written[0]._id, article._id);
      }
    });

    it('should say a write is live for a type that publishes on save or has no drafts', async function () {
      const req = userReq('ann');
      const notice = await apos.modules['harness-notice'].insert(req, { title: 'Notice' });
      const setting = await apos.modules['harness-setting'].insert(req, { title: 'Setting' });
      const { written } = await apos.harness.writeDocuments(req, [
        {
          _id: notice._id,
          patch: { title: 'Notice 2' }
        },
        {
          _id: setting._id,
          patch: { title: 'Setting 2' }
        }
      ]);

      assert.deepEqual(written.map(result => result.published), [ true, true ]);
      assert.match(written[0].notice, /live/);
      assert.equal(written[1].locale, null);
    });

    it('should refuse a document the user may not see or edit, and save nothing', async function () {
      const article = await insertArticle();
      const guest = apos.task.getReq({
        role: 'guest',
        mode: 'draft'
      });
      const user = await apos.user.insert(userReq('ann'), {
        title: 'Someone',
        username: 'someone',
        password: 'someone-password',
        role: 'editor'
      });

      const asGuest = await apos.harness.writeDocuments(guest, [ {
        _id: article._id,
        patch: { body: 'Guest' }
      } ]);
      const asAdmin = await apos.harness.writeDocuments(userReq('ann'), [ {
        _id: user._id,
        patch: { title: 'Renamed' }
      } ]);

      const secret = await apos.modules['harness-secret'].insert(userReq('ann'), {
        title: 'Secret'
      });
      const denied = await apos.harness.writeDocuments(userReq('ann'), [ {
        _id: secret._id,
        patch: { title: 'Revealed' }
      } ]);

      assert.equal(denied.refused[0].reason, 'forbidden');
      assert.deepEqual(asGuest.written, []);
      assert.equal(asGuest.refused[0].reason, 'notfound');
      assert.equal(asAdmin.refused[0].reason, 'forbidden');
      assert.equal(asAdmin.refused[0].title, 'Someone');
      assert.equal((await findDraft(article._id)).body, undefined);
      assert.equal((await apos.doc.db.findOne({ _id: user._id })).title, 'Someone');
      assert.deepEqual(saves, [ article._id ]);
    });

    it('should write the patches of one document in one save', async function () {
      const article = await insertArticle();
      saves.length = 0;
      const { written } = await apos.harness.writeDocuments(userReq('ann'), [
        {
          _id: article._id,
          patch: { body: 'One' }
        },
        {
          _id: article._id,
          patch: async (doc) => ({ title: `${doc.title} two` })
        }
      ]);

      assert.equal(written.length, 1);
      assert.deepEqual(saves, [ article._id ]);
      const stored = await findDraft(article._id);
      assert.equal(stored.body, 'One');
      assert.equal(stored.title, 'An article two');
    });

    it('should name the fields a validation refuses, and save nothing', async function () {
      const article = await insertArticle();
      saves.length = 0;
      const { refused } = await apos.harness.writeDocuments(userReq('ann'), [
        {
          _id: article._id,
          patch: { title: '' }
        }
      ]);
      const pushed = await apos.harness.writeDocuments(userReq('ann'), [
        {
          _id: article._id,
          patch: {
            $push: {
              'main.items': {
                _id: 'not-allowed',
                metaType: 'widget',
                type: '@apostrophecms/image'
              }
            }
          }
        }
      ]);

      assert.equal(refused[0].reason, 'invalid');
      assert.deepEqual(refused[0].fields, [ {
        path: 'title',
        reason: 'required'
      } ]);
      assert.equal(pushed.refused[0].reason, 'invalid');
      assert.equal(pushed.refused[0].fields.length, 1);
      assert.equal(pushed.refused[0].fields[0].reason, 'notAllowed');
      assert.deepEqual(saves, []);
    });
  });

  describe('locks', function () {
    it('should lock a door\'s write in the family\'s slot only while it writes', async function () {
      const article = await insertArticle();
      const req = door(userReq('ann'));
      await apos.harness.writeDocuments(req, [ {
        _id: article._id,
        patch: { body: 'Locked' }
      } ]);

      assert.equal(locksDuringSave.at(-1)._id, 'tab-1');
      assert.equal(locksDuringSave.at(-1).member._id, 'chat-1');
      assert.equal((await findDraft(article._id)).advisoryLock, undefined);
    });

    it('should keep a saved write when the lock can\'t be released', async function () {
      const article = await insertArticle();
      const { unlock } = apos.doc;
      const { logError } = apos.harness;
      const logged = [];
      apos.doc.unlock = async () => {
        throw new Error('database gone');
      };
      apos.harness.logError = (req, type) => logged.push(type);
      try {
        const { written, refused } = await apos.harness.writeDocuments(door(userReq('ann')), [ {
          _id: article._id,
          patch: { body: 'Saved' }
        } ]);

        assert.equal(written.length, 1);
        assert.deepEqual(refused, []);
        assert.deepEqual(logged, [ 'lock-release-failed' ]);
      } finally {
        apos.doc.unlock = unlock;
        apos.harness.logError = logError;
      }
      assert.equal((await findDraft(article._id)).body, 'Saved');
    });

    it('should refuse a document another lock holds, naming the holder, and write the rest', async function () {
      const [ one, two, three ] = await Promise.all([
        insertArticle({ title: 'One' }),
        insertArticle({ title: 'Two' }),
        insertArticle({ title: 'Three' })
      ]);
      const req = door(userReq('ann'));
      await apos.doc.lock(userReq('bob'), two, 'bob-tab');

      const { written, refused } = await apos.harness.writeDocuments(req, [
        one, two, three
      ].map(doc => ({
        _id: doc._id,
        patch: { body: 'All' }
      })));

      assert.deepEqual(written.map(result => result.title), [ 'One', 'Three' ]);
      assert.deepEqual(refused.map(result => [ result.title, result.reason ]), [
        [ 'Two', 'locked' ]
      ]);
      assert.match(refused[0].message, /Bob/);
      assert.equal((await findDraft(two._id)).body, undefined);
    });

    it('should share the page\'s lock of the family and hand it back', async function () {
      const article = await insertArticle();
      // The page in edit mode
      await apos.doc.lock(userReq('ann'), article, 'tab-1');

      const { written } = await apos.harness.writeDocuments(door(userReq('ann')), [ {
        _id: article._id,
        patch: { body: 'Chat one' }
      } ]);

      assert.equal(written.length, 1);
      assert.equal(locksDuringSave.at(-1).member._id, 'chat-1');
      const lock = (await findDraft(article._id)).advisoryLock;
      assert.equal(lock._id, 'tab-1');
      assert.equal(lock.member, undefined);
    });

    it('should refuse a document another chat of the same user is writing', async function () {
      const article = await insertArticle();
      // The other chat's write in flight
      await apos.doc.lock(userReq('ann'), article, 'chat-2', { family: 'tab-1' });

      const { written, refused } = await apos.harness.writeDocuments(door(userReq('ann')), [ {
        _id: article._id,
        patch: { body: 'Chat one' }
      } ]);

      assert.deepEqual(written, []);
      assert.equal(refused[0].reason, 'locked');
      assert.match(refused[0].message, /another browser tab or chat/);
      assert.equal((await findDraft(article._id)).advisoryLock.member._id, 'chat-2');
    });
  });

  describe('guards', function () {
    it('should author a new widget whole and replace every id the model sent', function () {
      const { widget, ids } = apos.harness.authorWidget(userReq('ann'), {
        _id: 'model-widget',
        type: 'harness-card',
        heading: 'Heading',
        body: {
          _id: 'model-area',
          items: [ {
            _id: 'model-rich-text',
            type: '@apostrophecms/rich-text',
            content: '<p>Text</p>'
          } ]
        },
        links: [ {
          _id: 'model-link',
          label: 'Link'
        } ],
        _related: [ { _id: 'related-id' } ]
      });

      const sent = [ 'model-widget', 'model-area', 'model-rich-text', 'model-link' ];
      assert.equal(sent.some(_id => JSON.stringify(widget).includes(_id)), false);
      assert.deepEqual(ids, [
        {
          _id: widget._id,
          type: 'harness-card'
        },
        {
          _id: widget.body.items[0]._id,
          type: '@apostrophecms/rich-text'
        }
      ]);
      assert.equal(widget.kicker, 'News');
      assert.equal(widget.metaType, 'widget');
      assert.equal(widget.body.metaType, 'area');
      assert.deepEqual(widget._related, [ { _id: 'related-id' } ]);
      assert.equal('secret' in widget, false);
    });

    it('should keep the own id of a widget replaced in place', function () {
      const { widget } = apos.harness.authorWidget(userReq('ann'), {
        _id: 'model-widget',
        type: 'harness-card'
      }, { _id: 'kept' });
      assert.equal(widget._id, 'kept');
    });

    it('should refuse a widget type without a module', function () {
      assert.throws(
        () => apos.harness.authorWidget(userReq('ann'), { type: 'nope' }),
        { name: 'invalid' }
      );
    });

    it('should save the ids it assigned', async function () {
      const article = await insertArticle();
      const { widget, ids } = apos.harness.authorWidget(userReq('ann'), {
        type: 'harness-card',
        heading: 'Pushed',
        body: {
          items: [ {
            type: '@apostrophecms/rich-text',
            content: '<p>Nested</p>'
          } ]
        }
      });
      await apos.harness.writeDocuments(userReq('ann'), [ {
        _id: article._id,
        patch: { $push: { 'main.items': widget } }
      } ]);

      const [ saved ] = (await findDraft(article._id)).main.items;
      assert.equal(saved._id, ids[0]._id);
      assert.equal(saved.body.items[0]._id, ids[1]._id);
      assert.equal(saved.kicker, 'News');
    });

    it('should show nothing outside the AI-facing schema', async function () {
      const related = await insertArticle({ title: 'Related' });
      const article = await insertArticle({
        title: 'Projected',
        body: 'Body',
        main: {
          metaType: 'area',
          items: [
            {
              _id: 'card-1',
              metaType: 'widget',
              type: 'harness-card',
              heading: 'Card',
              secret: 'Hidden'
            },
            {
              _id: 'text-1',
              metaType: 'widget',
              type: '@apostrophecms/rich-text',
              content: '<p>Text</p>'
            }
          ]
        },
        _related: [ related ]
      });
      // Stored before a widget type and a field were removed from the project
      await apos.doc.db.updateOne({ _id: article._id }, {
        $set: {
          oldField: 'Removed',
          'main.items.0.stale': 'Removed'
        }
      });
      await apos.doc.db.updateOne({ _id: article._id }, {
        $push: {
          'main.items': {
            _id: 'gone-1',
            metaType: 'widget',
            type: 'harness-gone',
            text: 'Retired'
          }
        }
      });
      const doc = await apos.doc.find(userReq('ann'), { _id: article._id }).toObject();

      const projected = apos.harness.projectDocument(userReq('ann'), doc);

      assert.equal('oldField' in projected, false);
      assert.equal(projected.body, 'Body');
      assert.deepEqual(
        projected.main.items.map(item => item._id),
        [ 'card-1', 'text-1' ]
      );
      const card = projected.main.items[0];
      assert.equal(card.heading, 'Card');
      assert.equal('secret' in card, false);
      assert.equal('stale' in card, false);
      assert.deepEqual(projected._related, [ {
        _id: related._id,
        title: 'Related'
      } ]);
      assert.equal(JSON.stringify(projected).includes('Retired'), false);
    });
  });

  describe('rows', function () {
    it('should target the same item with a row\'s path used as a patch key', async function () {
      const req = userReq('ann');
      const article = await insertArticle({
        main: {
          metaType: 'area',
          items: [
            {
              _id: 'card-a',
              metaType: 'widget',
              type: 'harness-card',
              heading: 'A'
            },
            {
              _id: 'card-b',
              metaType: 'widget',
              type: 'harness-card',
              heading: 'B'
            }
          ]
        }
      });
      await apos.modules['harness-article'].publish(req, article);
      await apos.harness.writeDocuments(req, [ {
        _id: article._id,
        patch: { '@card-b.heading': 'B changed' }
      } ]);

      const { rows } = await apos.docVersions.getDraftChanges(req, article._id);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].patchKey, '@card-b.heading');
      await apos.harness.writeDocuments(req, [ {
        _id: article._id,
        patch: { [rows[0].patchKey]: 'B again' }
      } ]);

      const items = (await findDraft(article._id)).main.items;
      assert.deepEqual(items.map(item => item.heading), [ 'A', 'B again' ]);
    });
  });

  function toolTurn(name, input) {
    return {
      content: [ {
        type: 'toolCall',
        id: `call-${name}`,
        name,
        input
      } ],
      finishReason: 'toolCalls',
      usage: {
        inputTokens: 1,
        outputTokens: 1
      }
    };
  }

  async function captureLog(fn) {
    /* eslint-disable no-console */
    const lines = [];
    const log = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try {
      await fn();
    } finally {
      console.log = log;
    }
    /* eslint-enable no-console */
    return lines.join('\n');
  }
});
