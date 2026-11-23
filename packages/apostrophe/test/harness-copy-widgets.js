const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// The harness's `copy_widgets`: widgets copied whole into another document,
// another locale's copy included, or within their own.

describe('Harness: copy_widgets', function () {
  this.timeout(t.timeout);

  let apos;

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {},
              fr: { prefix: '/fr' }
            }
          }
        },
        'copy-topic': {
          extend: '@apostrophecms/piece-type'
        },
        'copy-card-widget': {
          extend: '@apostrophecms/widget-type',
          fields: {
            add: {
              heading: { type: 'string' },
              secret: { type: 'string' },
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
              _topics: {
                type: 'relationship',
                withType: 'copy-topic',
                fields: {
                  add: {
                    note: { type: 'string' }
                  }
                }
              }
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
        'copy-article': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              main: {
                type: 'area',
                options: {
                  widgets: {
                    'copy-card': {},
                    '@apostrophecms/rich-text': {}
                  }
                }
              },
              aside: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {}
                  }
                }
              }
            }
          }
        }
      }
    });
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
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

  function door(req = userReq()) {
    return apos.aposHarness.withDoor(req, {
      door: 'assistant',
      lockId: 'chat-1',
      chat: 'chat-1',
      requestId: apos.util.generateId()
    });
  }

  // Runs the tool as the engine does: arguments validated and defaulted
  function copy(input, req = userReq()) {
    return apos.ai.executeToolCall(req, apos.ai.getTool('copy_widgets'), {
      id: 'call-1',
      name: 'copy_widgets',
      input
    });
  }

  function richText(text) {
    return {
      _id: apos.util.generateId(),
      metaType: 'widget',
      type: '@apostrophecms/rich-text',
      content: `<p>${text}</p>`
    };
  }

  function area(items = []) {
    return {
      _id: apos.util.generateId(),
      metaType: 'area',
      items
    };
  }

  function card(fields = {}) {
    return {
      _id: apos.util.generateId(),
      metaType: 'widget',
      type: 'copy-card',
      heading: 'A card',
      secret: 'Kept away from AI',
      body: area([ richText('Inside') ]),
      links: [ {
        _id: apos.util.generateId(),
        metaType: 'arrayItem',
        label: 'A link'
      } ],
      ...fields
    };
  }

  function insertArticle(fields = {}, req = userReq()) {
    return apos.modules['copy-article'].insert(req, {
      title: 'An article',
      main: area(),
      ...fields
    });
  }

  function insertTopic(title) {
    return apos.modules['copy-topic'].insert(userReq(), { title });
  }

  function localize(type, doc, locale = 'fr') {
    return apos.modules[type].localize(userReq(), doc, locale);
  }

  function findDraft(_id) {
    return apos.doc.db.findOne({ _id });
  }

  it('should be a tool of both doors', function () {
    for (const name of [ 'assistant', 'mcp' ]) {
      const names = apos.aposHarness.getDoorTools(name).map(tool => tool.name);
      assert(names.includes('copy_widgets'), name);
    }
  });

  it('should copy a widget whole into the copy in another locale, its ids kept', async function () {
    const topic = await insertTopic('Pricing');
    await localize('copy-topic', topic);
    const widget = card({
      _topics: [ {
        ...topic,
        _fields: { note: 'See also' }
      } ]
    });
    const first = richText('First');
    const article = await insertArticle({ main: area([ first ]) });
    const french = await localize('copy-article', article);
    await apos.modules['copy-article'].update(userReq(), {
      ...article,
      main: {
        ...article.main,
        items: [ first, widget, richText('Last') ]
      }
    });

    const result = await copy({
      from: article._id,
      widgets: [ widget._id ],
      _id: french._id,
      area: 'main',
      after: first._id
    }, door());

    assert.equal(result.refused, undefined);
    assert.equal(result.written[0].locale, 'fr');
    assert.deepEqual(result.written[0].widgets, [ {
      _id: widget._id,
      type: 'copy-card',
      index: 1,
      copyOf: widget._id
    } ]);
    const draft = await findDraft(french._id);
    assert.equal(draft.main.items.length, 2);
    const copied = draft.main.items[1];
    assert.equal(copied.heading, 'A card');
    assert.equal(copied.secret, 'Kept away from AI');
    assert.equal(copied.body._id, widget.body._id);
    assert.equal(copied.body.items[0]._id, widget.body.items[0]._id);
    assert.equal(copied.body.items[0].content, '<p>Inside</p>');
    assert.equal(copied.links[0]._id, widget.links[0]._id);
    assert.equal(copied.links[0].label, 'A link');
    assert.deepEqual(copied.topicsIds, [ topic.aposDocId ]);
    assert.deepEqual(copied.topicsFields, { [topic.aposDocId]: { note: 'See also' } });
    // The source is left as it was
    const source = await findDraft(article._id);
    assert.equal(source.main.items.length, 3);
  });

  it('should record the copy as a change of the door\'s request, marked as AI\'s', async function () {
    const widget = card();
    const article = await insertArticle({ main: area([ widget ]) });
    const other = await insertArticle({ title: 'Another' });
    const req = door();

    await copy({
      from: article._id,
      widgets: [ widget._id ],
      _id: other._id,
      area: 'main'
    }, req);

    const { requestId } = apos.aposHarness.getDoor(req);
    const entries = await apos.aposHarness.changes.find({ requestId }).toArray();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].docId, other._id);
    assert.equal(entries[0].ai, true);
  });

  it('should refuse the write, naming the relationship, when a related document has no copy in the locale written', async function () {
    const topic = await insertTopic('English only');
    const widget = card({ _topics: [ topic ] });
    const article = await insertArticle({ main: area([ widget ]) });
    const french = await localize('copy-article', article);
    const before = await findDraft(french._id);

    const result = await copy({
      from: article._id,
      widgets: [ widget._id ],
      _id: french._id,
      area: 'aside'
    });

    assert.deepEqual(result.written, []);
    const [ refusal ] = result.refused;
    assert.equal(refusal.reason, 'invalid');
    assert.deepEqual(refusal.fields.map(({ path, reason }) => ({
      path,
      reason
    })), [ {
      path: 'aside.items.0',
      reason: 'notAllowed'
    } ]);
    const again = await copy({
      from: article._id,
      widgets: [ widget._id ],
      _id: french._id,
      area: 'main'
    });
    assert.deepEqual(again.written, []);
    assert.deepEqual(again.refused[0].fields.map(({ path, reason }) => ({
      path,
      reason
    })), [ {
      path: 'main.items.1._topics.0',
      reason: 'notFound'
    } ]);
    assert.deepEqual((await findDraft(french._id)).main, before.main);
  });

  it('should give the copy new ids within its own document, nested ones included', async function () {
    const widget = card();
    const last = richText('Last');
    const article = await insertArticle({ main: area([ widget, last ]) });

    const result = await copy({
      from: article._id,
      widgets: [ widget._id ],
      _id: article._id,
      area: 'main',
      position: 0
    });

    const [ { widgets: [ located ] } ] = result.written;
    assert.notEqual(located._id, widget._id);
    assert.equal(located.copyOf, widget._id);
    assert.equal(located.index, 0);
    const draft = await findDraft(article._id);
    assert.deepEqual(draft.main.items.map(item => item._id), [
      located._id,
      widget._id,
      last._id
    ]);
    const [ copied, original ] = draft.main.items;
    assert.equal(copied.heading, original.heading);
    assert.equal(copied.secret, original.secret);
    assert.notEqual(copied.body._id, original.body._id);
    assert.notEqual(copied.body.items[0]._id, original.body.items[0]._id);
    assert.equal(copied.body.items[0].content, original.body.items[0].content);
    assert.notEqual(copied.links[0]._id, original.links[0]._id);
    const ids = [];
    apos.doc.walk(draft, (object, key, value) => {
      if (key === '_id') {
        ids.push(value);
      }
    });
    assert.equal(new Set(ids).size, ids.length);
  });

  it('should keep an id only while the document written lacks it', async function () {
    const widget = card();
    const article = await insertArticle({ main: area([ widget ]) });
    const other = await insertArticle({ title: 'Another' });
    const input = {
      from: article._id,
      widgets: [ widget._id ],
      _id: other._id,
      area: 'main'
    };

    const first = await copy(input);
    const second = await copy(input);

    assert.equal(first.written[0].widgets[0]._id, widget._id);
    assert.notEqual(second.written[0].widgets[0]._id, widget._id);
    const draft = await findDraft(other._id);
    const [ kept, renewed ] = draft.main.items;
    assert.equal(kept.body.items[0]._id, widget.body.items[0]._id);
    assert.notEqual(renewed.body.items[0]._id, widget.body.items[0]._id);
    assert.notEqual(renewed.links[0]._id, widget.links[0]._id);
  });

  it('should copy several widgets in the order given, before a widget', async function () {
    const one = richText('One');
    const two = richText('Two');
    const article = await insertArticle({ main: area([ one, two ]) });
    const held = richText('Held');
    const other = await insertArticle({
      title: 'Another',
      main: area([ held ])
    });

    const result = await copy({
      from: article._id,
      widgets: [ two._id, one._id ],
      _id: other._id,
      area: 'main',
      before: held._id
    });

    assert.deepEqual(result.written[0].widgets.map(widget => widget.index), [ 0, 1 ]);
    const draft = await findDraft(other._id);
    assert.deepEqual(
      draft.main.items.map(item => item.content),
      [ '<p>Two</p>', '<p>One</p>', '<p>Held</p>' ]
    );
  });

  it('should name a widget the document copied from doesn\'t hold', async function () {
    const article = await insertArticle({ main: area([ richText('One') ]) });
    const other = await insertArticle({ title: 'Another' });

    await assert.rejects(copy({
      from: article._id,
      widgets: [ 'nowhere' ],
      _id: other._id,
      area: 'main'
    }), {
      name: 'aiToolError',
      message: /No widget "nowhere"/
    });
    await assert.rejects(copy({
      from: 'no-such-document',
      widgets: [ 'nowhere' ],
      _id: other._id,
      area: 'main'
    }), { name: 'aiToolError' });
  });

  it('should refuse a place the document written doesn\'t have', async function () {
    const one = richText('One');
    const article = await insertArticle({ main: area([ one ]) });
    const other = await insertArticle({ title: 'Another' });

    const result = await copy({
      from: article._id,
      widgets: [ one._id ],
      _id: other._id,
      area: 'main',
      after: one._id
    });

    assert.deepEqual(result.written, []);
    assert.deepEqual(result.refused[0].fields.map(({ path, reason }) => ({
      path,
      reason
    })), [ {
      path: 'after',
      reason: 'notfound'
    } ]);
  });
});
