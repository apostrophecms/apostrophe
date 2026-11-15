const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// The harness reading and changing what an open editor holds, in memory:
// a document, a widget or an array item.

describe('Harness: content in an open editor', function () {
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
        '@apostrophecms/page': {
          options: {
            types: [
              {
                name: '@apostrophecms/home-page',
                label: 'Home'
              },
              {
                name: 'open-page',
                label: 'Page'
              }
            ]
          }
        },
        'open-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {},
                    'open-card': {}
                  }
                }
              }
            }
          }
        },
        'open-topic': {
          extend: '@apostrophecms/piece-type'
        },
        'open-card-widget': {
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
              _topics: {
                type: 'relationship',
                withType: 'open-topic'
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
        'open-article': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              body: { type: 'string' },
              details: {
                type: 'object',
                fields: {
                  add: {
                    summary: { type: 'string' }
                  }
                }
              },
              slides: {
                type: 'array',
                fields: {
                  add: {
                    caption: { type: 'string' },
                    internal: { type: 'string' }
                  }
                }
              },
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {},
                    'open-card': {}
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
              },
              _related: {
                type: 'relationship',
                withType: 'open-topic'
              }
            }
          },
          methods(self) {
            return {
              // A slide's `internal` is kept away from AI
              getAiSchema(req) {
                return self.schema.map(field => ((field.name === 'slides')
                  ? {
                    ...field,
                    schema: field.schema.filter(field => field.name !== 'internal')
                  }
                  : field));
              }
            };
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

  function richText(text) {
    return {
      _id: apos.util.generateId(),
      metaType: 'widget',
      type: '@apostrophecms/rich-text',
      content: `<p>${text}</p>`
    };
  }

  function card(fields = {}) {
    return {
      _id: apos.util.generateId(),
      metaType: 'widget',
      type: 'open-card',
      heading: 'A card',
      kicker: 'Events',
      body: area([ richText('Inside') ]),
      links: [ {
        _id: apos.util.generateId(),
        metaType: 'arrayItem',
        scopedArrayName: 'open-card.links',
        label: 'A link'
      } ],
      _topics: [],
      secret: 'Kept',
      ...fields
    };
  }

  function area(items = []) {
    return {
      _id: apos.util.generateId(),
      metaType: 'area',
      items
    };
  }

  // An article as its editor holds it, loaded as the editor loads it
  async function openArticle(fields = {}) {
    const manager = apos.modules['open-article'];
    const inserted = await manager.insert(userReq(), {
      title: 'An article',
      main: area(),
      ...fields
    });
    return manager.findOneForEditing(userReq(), { _id: inserted._id });
  }

  function documentRoot(data, extra = {}) {
    return {
      kind: 'document',
      data,
      ...extra
    };
  }

  function widgetRoot(data, extra = {}) {
    return {
      kind: 'widget',
      data,
      areaFieldId: fieldOf('open-article', 'main')._id,
      ...extra
    };
  }

  function fieldOf(type, name) {
    return apos.doc.getManager(type).schema.find(field => field.name === name);
  }

  function findDraft(_id) {
    return apos.doc.db.findOne({ _id });
  }

  // The `{ path, reason }` of every field a refusal names
  function fieldsOf(refusal) {
    return refusal.fields.map(({ path, reason }) => ({
      path,
      reason
    }));
  }

  describe('a document', function () {
    it('should read what the editor holds, unsaved values included', async function () {
      const widget = card();
      const article = await openArticle({ main: area([ widget ]) });
      article.title = 'Unsaved';
      article.details = { summary: 'Typed' };

      const outline = apos.harness.readContent(userReq(), documentRoot(article));
      assert.equal(outline._id, article._id);
      assert.equal(outline.type, 'open-article');
      assert.equal(outline.title, 'Unsaved');
      assert.equal(outline.locale, 'en');
      assert.equal(outline.fields.find(field => field.name === 'title').value, 'Unsaved');
      assert.deepEqual(outline.areas.find(item => item.path === 'main').widgets
        .map(item => item._id), [ widget._id ]);

      const { properties } = apos.harness.readContent(userReq(), documentRoot(article), {
        view: 'properties',
        paths: [ 'details.summary', `@${widget._id}.heading`, `@${widget._id}.secret` ]
      });
      assert.deepEqual(properties.slice(0, 2), [
        {
          path: 'details.summary',
          value: 'Typed'
        },
        {
          path: `@${widget._id}.heading`,
          value: 'A card'
        }
      ]);
      assert.equal(properties[2].missing, true);
    });

    it('should change fields in memory and give back the whole top-level values, saving nothing', async function () {
      const widget = card();
      const article = await openArticle({ main: area([ widget ]) });

      const {
        values, touched, removed, result
      } = await apos.harness.editContent(userReq(), documentRoot(article), {
        action: 'update_document',
        values: {
          title: 'New title',
          'details.summary': 'New summary',
          [`@${widget._id}.heading`]: 'New heading'
        }
      });

      assert.deepEqual(Object.keys(values).sort(), [ 'details', 'main', 'title' ]);
      assert.equal(values.title, 'New title');
      assert.equal(values.details.summary, 'New summary');
      const [ changed ] = values.main.items;
      assert.equal(changed._id, widget._id);
      assert.equal(changed.heading, 'New heading');
      // What AI doesn't see stays as the editor holds it
      assert.equal(changed.secret, 'Kept');
      assert.deepEqual(touched, [ 'title', 'details.summary', `@${widget._id}.heading` ]);
      assert.deepEqual(removed, []);
      assert.equal(result.saved, false);
      assert.equal(result.written[0]._id, article._id);
      assert.match(result.notice, /not saved/);
      // The editor's own copy and the database are left as they are
      assert.equal(article.title, 'An article');
      const draft = await findDraft(article._id);
      assert.equal(draft.title, 'An article');
      assert.equal(draft.main.items[0].heading, 'A card');
    });

    it('should add, move and remove widgets, as the document tools do', async function () {
      const first = richText('First');
      const widget = card();
      const article = await openArticle({ main: area([ first, widget ]) });

      const added = await apos.harness.editContent(userReq(), documentRoot(article), {
        action: 'add_widgets',
        area: 'main',
        widgets: [ {
          type: '@apostrophecms/rich-text',
          content: '<p>New</p>'
        } ],
        position: 1
      });
      const [ landed ] = added.result.written[0].widgets;
      assert.equal(landed.index, 1);
      assert.deepEqual(added.values.main.items.map(item => item._id), [
        first._id,
        landed._id,
        widget._id
      ]);
      assert.deepEqual(added.touched, [ `@${landed._id}` ]);

      article.main = added.values.main;
      const moved = await apos.harness.editContent(userReq(), documentRoot(article), {
        action: 'move_widgets',
        widgets: [ first._id ],
        area: `@${widget._id}.body`
      });
      assert.deepEqual(Object.keys(moved.values), [ 'main' ]);
      assert.deepEqual(moved.values.main.items.map(item => item._id), [
        landed._id,
        widget._id
      ]);
      assert.deepEqual(moved.values.main.items[1].body.items.map(item => item._id), [
        widget.body.items[0]._id,
        first._id
      ]);
      assert.deepEqual(moved.touched, [ `@${first._id}` ]);
      assert.equal(moved.result.written[0].widgets[0].index, 1);

      article.main = moved.values.main;
      const gone = await apos.harness.editContent(userReq(), documentRoot(article), {
        action: 'remove_widgets',
        widgets: [ landed._id ]
      });
      assert.deepEqual(gone.values.main.items.map(item => item._id), [ widget._id ]);
      assert.deepEqual(gone.touched, []);
      assert.deepEqual(gone.removed, [ landed._id ]);
      assert.deepEqual(gone.result.written[0].removed, [ landed._id ]);
    });

    it('should change a never-saved piece and page', async function () {
      const piece = apos.modules['open-article'].newInstance();
      const { values: pieceValues, result: pieceResult } = await apos.harness.editContent(
        userReq(),
        documentRoot({
          ...piece,
          title: 'Draft piece'
        }),
        {
          action: 'add_widgets',
          area: 'main',
          widgets: [ {
            type: '@apostrophecms/rich-text',
            content: '<p>Hello</p>'
          } ]
        }
      );
      assert.equal(pieceResult.written[0]._id, undefined);
      assert.equal(pieceValues.main.items[0].content, '<p>Hello</p>');

      const page = apos.modules['open-page'].newInstance();
      const { values, result } = await apos.harness.editContent(
        userReq(),
        documentRoot(page),
        {
          action: 'update_document',
          values: { title: 'Draft page' }
        }
      );
      assert.equal(result.saved, false);
      assert.equal(result.refused, undefined);
      assert.deepEqual(values, { title: 'Draft page' });
    });

    it('should refuse what conversion would drop, changing nothing', async function () {
      const article = await openArticle();

      const {
        values, touched, result
      } = await apos.harness.editContent(
        userReq(),
        documentRoot(article),
        {
          action: 'add_widgets',
          area: 'aside',
          widgets: [ {
            type: 'open-card',
            heading: 'Not here'
          } ]
        }
      );
      assert.deepEqual(values, {});
      assert.deepEqual(touched, []);
      assert.equal(result.written, undefined);
      assert.equal(result.saved, false);
      assert.equal(result.refused[0].reason, 'invalid');
      assert.equal(result.refused[0]._id, article._id);
      assert.deepEqual(fieldsOf(result.refused[0]).map(field => field.reason), [ 'notAllowed' ]);

      const missing = await apos.harness.editContent(userReq(), documentRoot(article), {
        action: 'update_document',
        values: { _related: [ 'nope' ] }
      });
      assert.equal(missing.result.refused[0].reason, 'invalid');
      assert.deepEqual(fieldsOf(missing.result.refused[0]).map(field => field.path), [
        '_related.0'
      ]);
    });

    it('should give relationships back with titles, in the editor\'s locale', async function () {
      const topics = apos.modules['open-topic'];
      const topic = await topics.insert(userReq(), { title: 'Topic' });
      const localized = await topics.localize(userReq(), topic, 'fr');
      await topics.update(userReq({ locale: 'fr' }), {
        ...localized,
        title: 'Sujet'
      });
      const article = await openArticle();
      const fr = await apos.modules['open-article'].localize(userReq(), article, 'fr');

      // An id read in English names the French topic
      const { values } = await apos.harness.editContent(userReq(), documentRoot(fr, {
        locale: 'fr'
      }), {
        action: 'update_document',
        values: { _related: [ topic._id ] }
      });
      assert.equal(values._related.length, 1);
      assert.equal(values._related[0].title, 'Sujet');
      assert.equal(values._related[0].aposLocale, 'fr:draft');
    });
  });

  describe('a widget', function () {
    it('should read the widget only, its own fields bare or through its id', async function () {
      const widget = card();

      const outline = apos.harness.readContent(userReq(), widgetRoot(widget));
      assert.equal(outline._id, widget._id);
      assert.equal(outline.type, 'open-card');
      assert.deepEqual(outline.fields.map(field => field.name), [
        'heading',
        'kicker',
        'links',
        '_topics'
      ]);
      assert.deepEqual(outline.areas.map(item => item.path), [ 'body' ]);

      const { properties } = apos.harness.readContent(userReq(), widgetRoot(widget), {
        view: 'properties',
        paths: [ 'heading', `@${widget._id}.kicker`, 'secret' ]
      });
      assert.deepEqual(properties.slice(0, 2), [
        {
          path: 'heading',
          value: 'A card'
        },
        {
          path: `@${widget._id}.kicker`,
          value: 'Events'
        }
      ]);
      assert.equal(properties[2].missing, true);
    });

    it('should change the widget\'s fields and areas, by bare keys or through its id', async function () {
      const widget = card();

      const updated = await apos.harness.editContent(userReq(), widgetRoot(widget), {
        action: 'update_document',
        values: {
          heading: 'Bare',
          [`@${widget._id}.kicker`]: 'Through',
          [`@${widget.links[0]._id}.label`]: 'Item'
        }
      });
      assert.deepEqual(Object.keys(updated.values), [ 'heading', 'kicker', 'links' ]);
      assert.equal(updated.values.heading, 'Bare');
      assert.equal(updated.values.kicker, 'Through');
      assert.equal(updated.values.links[0]._id, widget.links[0]._id);
      assert.equal(updated.values.links[0].label, 'Item');
      assert.deepEqual(updated.touched, [
        'heading',
        'kicker',
        `@${widget.links[0]._id}.label`
      ]);
      assert.equal(updated.result.written[0]._id, widget._id);

      const added = await apos.harness.editContent(userReq(), widgetRoot(widget), {
        action: 'add_widgets',
        area: `@${widget._id}.body`,
        widgets: [ {
          type: '@apostrophecms/rich-text',
          content: '<p>Second</p>'
        } ]
      });
      assert.deepEqual(Object.keys(added.values), [ 'body' ]);
      assert.equal(added.values.body.items.length, 2);
      assert.equal(added.result.written[0].widgets[0].index, 1);

      // An area the widget never stored
      const bare = await apos.harness.editContent(userReq(), widgetRoot({
        ...widget,
        body: undefined
      }), {
        action: 'add_widgets',
        area: 'body',
        widgets: [ {
          type: '@apostrophecms/rich-text',
          content: '<p>Only</p>'
        } ]
      });
      assert.equal(bare.values.body.items[0].content, '<p>Only</p>');
    });

    it('should replace the widget whole by its id, keeping what AI doesn\'t see', async function () {
      const widget = card();

      const { values, touched } = await apos.harness.editContent(
        userReq(),
        widgetRoot(widget),
        {
          action: 'update_document',
          values: { [`@${widget._id}`]: { heading: 'Whole' } }
        }
      );
      assert.deepEqual(touched, [ 'heading', 'kicker', 'body', 'links', '_topics' ]);
      assert.equal(values.heading, 'Whole');
      assert.equal(values.kicker, 'News');
      assert.deepEqual(values.body.items, []);
      assert.deepEqual(values.links, []);
      assert.equal(values.secret, undefined);
    });

    it('should refuse what lies outside the widget, and the widget itself', async function () {
      const widget = card();
      const other = card();

      const { result } = await apos.harness.editContent(userReq(), widgetRoot(widget), {
        action: 'update_document',
        values: {
          title: 'The document\'s',
          [`@${other._id}.heading`]: 'Another widget\'s',
          secret: 'Hidden'
        }
      });
      assert.deepEqual(fieldsOf(result.refused[0]), [
        {
          path: 'title',
          reason: 'unknown'
        },
        {
          path: `@${other._id}.heading`,
          reason: 'notfound'
        },
        {
          path: 'secret',
          reason: 'unknown'
        }
      ]);
      assert(result.refused[0].fields.every(field => /until its editor closes/.test(field.message)));

      const removed = await apos.harness.editContent(userReq(), widgetRoot(widget), {
        action: 'remove_widgets',
        widgets: [ widget._id ]
      });
      assert.deepEqual(fieldsOf(removed.result.refused[0]), [ {
        path: `@${widget._id}`,
        reason: 'self'
      } ]);
    });

    it('should convert the widget with its area\'s options, refusing a type it doesn\'t take', async function () {
      const widget = card();

      const { result } = await apos.harness.editContent(userReq(), widgetRoot(widget), {
        action: 'add_widgets',
        area: 'body',
        widgets: [ {
          type: 'open-card',
          heading: 'Nested'
        } ]
      });
      // Named as the widget names it
      assert.deepEqual(fieldsOf(result.refused[0]), [ {
        path: 'body.items.1',
        reason: 'notAllowed'
      } ]);
      const missing = await apos.harness.editContent(userReq(), widgetRoot(widget), {
        action: 'update_document',
        values: { _topics: [ 'nope' ] }
      });
      assert.deepEqual(fieldsOf(missing.result.refused[0]), [ {
        path: '_topics.0',
        reason: 'notFound'
      } ]);

      assert.throws(() => apos.harness.getContentRoot(userReq(), widgetRoot(widget, {
        areaFieldId: fieldOf('open-article', 'aside')._id
      })), { name: 'invalid' });
    });

    it('should give a relationship back with titles', async function () {
      const topic = await apos.modules['open-topic'].insert(userReq(), { title: 'Widget topic' });
      const widget = card();

      const { values } = await apos.harness.editContent(userReq(), widgetRoot(widget), {
        action: 'update_document',
        values: { _topics: [ topic._id ] }
      });
      assert.deepEqual(Object.keys(values), [ '_topics' ]);
      assert.equal(values._topics[0].title, 'Widget topic');
    });
  });

  describe('an array item', function () {
    function itemRoot(data) {
      return {
        kind: 'item',
        data,
        fieldId: fieldOf('open-article', 'slides')._id
      };
    }

    it('should read and change the item through the AI-facing schema', async function () {
      const item = {
        _id: apos.util.generateId(),
        metaType: 'arrayItem',
        scopedArrayName: 'open-article.slides',
        caption: 'Before',
        internal: 'Kept'
      };

      const outline = apos.harness.readContent(userReq(), itemRoot(item));
      assert.equal(outline.field, 'slides');
      assert.deepEqual(outline.fields.map(field => field.name), [ 'caption' ]);

      const { values, touched } = await apos.harness.editContent(
        userReq(),
        itemRoot(item),
        {
          action: 'update_document',
          values: { [`@${item._id}.caption`]: 'After' }
        }
      );
      assert.deepEqual(values, { caption: 'After' });
      assert.deepEqual(touched, [ 'caption' ]);

      const { result } = await apos.harness.editContent(userReq(), itemRoot(item), {
        action: 'update_document',
        values: {
          internal: 'Hidden',
          title: 'The document\'s'
        }
      });
      assert.deepEqual(fieldsOf(result.refused[0]), [
        {
          path: 'internal',
          reason: 'unknown'
        },
        {
          path: 'title',
          reason: 'unknown'
        }
      ]);
      assert(result.refused[0].fields.every(field => /until its dialog closes/.test(field.message)));
    });

    it('should not place an item of an array AI doesn\'t read', function () {
      assert.throws(() => apos.harness.getContentRoot(userReq(), {
        kind: 'item',
        data: { _id: 'item-1' },
        fieldId: 'doc.open-article.nope'
      }), { name: 'invalid' });
    });
  });
});
