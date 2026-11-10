const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// The harness's write tools and `get_changes`.

describe('Harness: write tools and get_changes', function () {
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
                name: 'tools-page',
                label: 'Page'
              }
            ]
          }
        },
        'tools-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {}
                  }
                }
              },
              summary: { type: 'string' }
            }
          }
        },
        'tools-card-widget': {
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
        'tools-article': {
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
                    caption: { type: 'string' }
                  }
                }
              },
              main: {
                type: 'area',
                options: {
                  widgets: {
                    'tools-card': {},
                    '@apostrophecms/rich-text': {}
                  }
                }
              },
              aside: {
                type: 'area',
                options: {
                  widgets: {
                    'tools-card': {},
                    '@apostrophecms/rich-text': {}
                  }
                }
              },
              _related: {
                type: 'relationship',
                withType: 'tools-article'
              }
            }
          }
        },
        'tools-notice': {
          extend: '@apostrophecms/piece-type',
          options: {
            autopublish: true
          }
        },
        // Its doc type is named apart from its module
        'tools-events': {
          extend: '@apostrophecms/piece-type',
          options: {
            name: 'tools-event'
          }
        }
      }
    });
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  function userReq(username = 'ann', extra = {}) {
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
      chat: 'chat-1',
      requestId: 'request-1',
      ...context
    });
  }

  // Runs a tool as the engine does: arguments validated and defaulted,
  // the result held to its budget
  function run(name, input, req = userReq()) {
    return apos.ai.executeToolCall(req, apos.ai.getTool(name), {
      id: 'call-1',
      name,
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

  function card(fields = {}) {
    return {
      _id: apos.util.generateId(),
      metaType: 'widget',
      type: 'tools-card',
      heading: 'A card',
      body: area([ richText('Inside') ]),
      links: [ {
        _id: apos.util.generateId(),
        metaType: 'arrayItem',
        scopedArrayName: 'tools-card.links',
        label: 'A link'
      } ],
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

  function insertArticle(fields = {}, req = userReq()) {
    return apos.modules['tools-article'].insert(req, {
      title: 'An article',
      main: area(),
      ...fields
    });
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

  describe('create_page', function () {
    it('should create a draft page under its parent with the values given', async function () {
      const result = await run('create_page', {
        type: 'tools-page',
        title: 'About us',
        target: '/',
        values: {
          summary: 'Who we are and what we do.',
          main: {
            items: [ {
              _id: 'model-id',
              type: '@apostrophecms/rich-text',
              content: '<p>Who we are.</p>'
            } ]
          }
        }
      });

      assert.equal(result.refused, undefined);
      const [ page ] = result.written;
      assert.equal(page.type, 'tools-page');
      assert.equal(page.title, 'About us');
      assert.equal(page.slug, '/about-us');
      assert.equal(page.locale, 'en');
      assert.equal(page.published, false);
      assert.match(result.notice, /draft/);
      const draft = await findDraft(page._id);
      assert.equal(draft.summary, 'Who we are and what we do.');
      assert.notEqual(draft.main.items[0]._id, 'model-id');
      assert.equal(draft.path.split('/').length, 2);
      assert.equal(await findDraft(page._id.replace(':draft', ':published')), null);
      const [ version ] = await apos.docVersions.find(userReq(), {
        docId: draft.aposDocId
      });
      assert.equal(version.ai, true);
    });

    it('should create a page under a parent named by id, in its locale', async function () {
      const home = await apos.page.find(userReq('ann', { locale: 'fr' }), { level: 0 })
        .toObject();

      const { written } = await run('create_page', {
        type: 'tools-page',
        title: 'À propos',
        target: home._id
      });

      assert.equal(written[0].locale, 'fr');
      assert.match(written[0]._id, /:fr:draft$/);
    });

    it('should place a page before or after another, or first under it', async function () {
      const create = (title, target, position) => run('create_page', {
        type: 'tools-page',
        title,
        target,
        ...(position && { position })
      });
      const one = (await create('One', '/')).written[0];
      const two = (await create('Two', '/')).written[0];

      await create('Between', one._id, 'after');
      await create('Before one', one.slug, 'before');
      await create('First', '/', 'firstChild');
      const child = (await create('Child', two._id, 'firstChild')).written[0];

      const home = await apos.page.find(userReq(), { level: 0 })
        .children({ depth: 1 })
        .toObject();
      const titles = home._children.map(page => page.title)
        .filter(title => [ 'One', 'Two', 'Between', 'Before one', 'First' ].includes(title));
      assert.deepEqual(titles, [ 'First', 'Before one', 'One', 'Between', 'Two' ]);
      assert.equal(home._children[0].title, 'First');
      assert.equal(child.slug, `${two.slug}/child`);
      await assert.rejects(create('Beside home', '/', 'after'), {
        name: 'aiToolError',
        message: /home page/
      });
    });

    it('should refuse a page conversion would drop content of, or with unknown fields', async function () {
      const before = await apos.doc.db.countDocuments({ type: 'tools-page' });

      const dropped = await run('create_page', {
        type: 'tools-page',
        title: 'Dropped',
        target: '/',
        values: {
          main: { items: [ { type: 'tools-card' } ] }
        }
      });
      const unknown = await run('create_page', {
        type: 'tools-page',
        title: 'Unknown',
        target: '/',
        values: { nope: 'x' }
      });

      assert.deepEqual(dropped.written, []);
      assert.equal(dropped.notice, undefined);
      assert.equal(dropped.refused[0].title, 'Dropped');
      assert.equal(dropped.refused[0].reason, 'invalid');
      assert.deepEqual(fieldsOf(dropped.refused[0]), [ {
        path: 'main.items.0',
        reason: 'notAllowed'
      } ]);
      assert.deepEqual(fieldsOf(unknown.refused[0]), [ {
        path: 'nope',
        reason: 'unknown'
      } ]);
      assert(unknown.refused[0].fields[0].message);
      assert.equal(await apos.doc.db.countDocuments({ type: 'tools-page' }), before);
    });

    it('should refuse a parent it can\'t find and a type the parent doesn\'t take', async function () {
      await assert.rejects(run('create_page', {
        type: 'tools-page',
        title: 'Orphan',
        target: '/nowhere'
      }), {
        name: 'aiToolError',
        message: /get_page_tree/
      });
      await assert.rejects(run('create_page', {
        type: 'tools-article',
        title: 'Not a page',
        target: '/'
      }), { name: 'aiToolError' });
    });
  });

  describe('create_piece', function () {
    it('should create a piece, a relationship given by an id of any locale or mode', async function () {
      const related = await insertArticle({ title: 'Related' });

      const { written } = await run('create_piece', {
        type: 'tools-article',
        title: 'New article',
        values: {
          body: 'Body',
          _related: [ related._id.replace(':draft', ':published') ]
        }
      });

      assert.equal(written[0].published, false);
      assert.equal(written[0].slug, 'new-article');
      const draft = await findDraft(written[0]._id);
      assert.equal(draft.body, 'Body');
      assert.deepEqual(draft.relatedIds, [ related.aposDocId ]);
    });

    it('should refuse a related document that does not exist in the locale written', async function () {
      const related = await insertArticle({ title: 'English only' });

      const { written, refused } = await run('create_piece', {
        type: 'tools-article',
        title: 'Article français',
        locale: 'fr',
        values: { _related: [ related._id ] }
      });

      assert.deepEqual(written, []);
      assert.deepEqual(fieldsOf(refused[0]), [ {
        path: '_related.0',
        reason: 'notFound'
      } ]);
    });

    it('should say a piece of a type that publishes on save is live', async function () {
      const { written, notice } = await run('create_piece', {
        type: 'tools-notice',
        title: 'Closed on Monday'
      });

      assert.equal(written[0].published, true);
      assert.match(notice, /live/);
    });

    it('should list only types a piece can be created as', function () {
      const types = apos.ai.getTool('create_piece').input.properties.type.enum;
      assert(types.includes('tools-article'));
      assert(types.includes('tools-event'));
      assert.equal(types.includes('tools-events'), false);
      assert.equal(types.includes('@apostrophecms/image'), false);
      assert.equal(types.includes('@apostrophecms/global'), false);
      assert.equal(types.includes('@apostrophecms/styles'), false);
      assert.equal(types.includes('tools-page'), false);
    });
  });

  describe('update_document', function () {
    it('should write twenty documents and name the two another lock holds', async function () {
      const articles = [];
      for (let i = 1; i <= 20; i++) {
        articles.push(await insertArticle({ title: `Article ${i}` }));
      }
      await apos.doc.lock(userReq('bob'), articles[4], 'bob-tab');
      await apos.doc.lock(userReq('bob'), articles[11], 'bob-tab');

      const { written, refused } = await run('update_document', {
        targets: articles.map(article => ({
          _id: article._id,
          values: { body: 'Updated' }
        }))
      }, door(userReq()));

      assert.equal(written.length, 18);
      assert.deepEqual(refused.map(item => [ item.title, item.reason ]), [
        [ 'Article 5', 'locked' ],
        [ 'Article 12', 'locked' ]
      ]);
      assert.match(refused[0].message, /Bob/);
      const drafts = await apos.doc.db.find({
        _id: { $in: articles.map(article => article._id) }
      }).toArray();
      assert.equal(drafts.filter(draft => draft.body === 'Updated').length, 18);
    });

    it('should set fields by name, dot path and @id path', async function () {
      const widget = card();
      const article = await insertArticle({
        main: area([ widget ]),
        slides: [ {
          _id: 'slide-1',
          caption: 'First'
        } ]
      });

      const { written } = await run('update_document', {
        targets: [ {
          _id: article._id,
          values: {
            title: 'Retitled',
            'details.summary': 'In short',
            [`@${widget._id}.heading`]: 'New heading',
            [`@${widget.links[0]._id}.label`]: 'New label',
            '@slide-1.caption': 'Changed'
          }
        } ]
      });

      assert.equal(written[0].title, 'Retitled');
      const draft = await findDraft(article._id);
      assert.equal(draft.details.summary, 'In short');
      const [ saved ] = draft.main.items;
      assert.equal(saved.heading, 'New heading');
      assert.equal(saved.links[0].label, 'New label');
      assert.equal(saved.body.items[0].content, widget.body.items[0].content);
      assert.equal(draft.slides[0].caption, 'Changed');
    });

    it('should replace a widget whole by @id, keeping its id and assigning the rest', async function () {
      const widget = card({ kicker: 'Events' });
      const article = await insertArticle({ main: area([ widget ]) });

      await run('update_document', {
        targets: [ {
          _id: article._id,
          values: {
            [`@${widget._id}`]: {
              heading: 'Whole',
              links: [ {
                _id: widget.links[0]._id,
                label: 'Again'
              } ]
            }
          }
        } ]
      });

      const [ saved ] = (await findDraft(article._id)).main.items;
      assert.equal(saved._id, widget._id);
      assert.equal(saved.type, 'tools-card');
      assert.equal(saved.heading, 'Whole');
      // Omitted fields are at their default, the model's ids replaced
      assert.equal(saved.kicker, 'News');
      assert.deepEqual(saved.body.items, []);
      assert.equal(saved.links[0].label, 'Again');
      assert.notEqual(saved.links[0]._id, widget.links[0]._id);
    });

    it('should refuse areas, the document and keys outside the AI-facing schema', async function () {
      const widget = card({ secret: 'Kept' });
      const article = await insertArticle({
        main: area([ widget ]),
        slides: [ {
          _id: 'slide-2',
          caption: 'First'
        } ]
      });

      const { written, refused } = await run('update_document', {
        targets: [ {
          _id: article._id,
          values: {
            body: 'Not written',
            main: { items: [] },
            [`@${article.main._id}`]: { items: [] },
            [`@${widget._id}.body`]: { items: [] },
            [`@${widget._id}.secret`]: 'Leaked',
            [`@${article._id}`]: { title: 'Whole' },
            type: 'tools-notice',
            'slides.0.caption': 'By index',
            '@nope.heading': 'Nowhere'
          }
        } ]
      });

      assert.deepEqual(written, []);
      assert.deepEqual(fieldsOf(refused[0]), [
        {
          path: 'main',
          reason: 'area'
        },
        {
          path: `@${article.main._id}`,
          reason: 'area'
        },
        {
          path: `@${widget._id}.body`,
          reason: 'area'
        },
        {
          path: `@${widget._id}.secret`,
          reason: 'unknown'
        },
        {
          path: `@${article._id}`,
          reason: 'notfound'
        },
        {
          path: 'type',
          reason: 'type'
        },
        {
          path: 'slides.0.caption',
          reason: 'index'
        },
        {
          path: '@nope.heading',
          reason: 'notfound'
        }
      ]);
      assert(refused[0].fields.every(field => field.message));
      const draft = await findDraft(article._id);
      assert.equal(draft.body, undefined);
      assert.equal(draft.main.items[0].secret, 'Kept');
    });

    it('should refuse changing the type of a page', async function () {
      const { written } = await run('create_page', {
        type: 'tools-page',
        title: 'Typed',
        target: '/'
      });

      const { refused } = await run('update_document', {
        targets: [ {
          _id: written[0]._id,
          values: { type: '@apostrophecms/home-page' }
        } ]
      });

      assert.deepEqual(fieldsOf(refused[0]), [ {
        path: 'type',
        reason: 'type'
      } ]);
      assert.equal((await findDraft(written[0]._id)).type, 'tools-page');
    });

    it('should refuse archiving a document, writing nothing', async function () {
      const draft = await insertArticle({ title: 'Kept' });
      const archived = await insertArticle({ title: 'Archived' });
      await apos.doc.db.updateOne({ _id: archived._id }, { $set: { archived: true } });

      const { written, refused } = await run('update_document', {
        targets: [
          {
            _id: draft._id,
            values: {
              title: 'Renamed',
              archived: true
            }
          },
          {
            _id: archived._id,
            values: { archived: false }
          }
        ]
      });

      assert.deepEqual(written, []);
      assert.deepEqual(fieldsOf(refused[0]), [ {
        path: 'archived',
        reason: 'archived'
      } ]);
      // An archived document is out of reach, so nothing restores it either
      assert.equal(refused[1].reason, 'notfound');
      const stored = await findDraft(draft._id);
      assert.equal(stored.title, 'Kept');
      assert.equal(stored.archived, false);
      assert.equal((await findDraft(archived._id)).archived, true);
    });

    it('should leave Global Styles to their own tools', async function () {
      const styles = await apos.doc.db.findOne({
        type: '@apostrophecms/styles',
        aposLocale: 'en:draft'
      });

      const { refused } = await run('update_document', {
        targets: [ {
          _id: styles._id,
          values: { title: 'Styles' }
        } ]
      });

      assert.deepEqual(fieldsOf(refused[0]), [ {
        path: '_id',
        reason: 'styles'
      } ]);
    });
  });

  describe('add_widgets', function () {
    it('should insert widgets at a position with new ids, the others untouched', async function () {
      const widgets = [ richText('A'), richText('B'), richText('C') ];
      const article = await insertArticle({ main: area(widgets) });

      const { written } = await run('add_widgets', {
        _id: article._id,
        area: 'main',
        widgets: [
          {
            _id: 'model-1',
            type: '@apostrophecms/rich-text',
            content: '<p>New 1</p>'
          },
          {
            type: 'tools-card',
            heading: 'New card'
          }
        ],
        position: 1
      });

      const added = written[0].widgets;
      assert.equal(written[0].area, 'main');
      assert.deepEqual(added.map(widget => [ widget.type, widget.index ]), [
        [ '@apostrophecms/rich-text', 1 ],
        [ 'tools-card', 2 ]
      ]);
      assert.notEqual(added[0]._id, 'model-1');
      const { items } = (await findDraft(article._id)).main;
      assert.deepEqual(items.map(item => item._id), [
        widgets[0]._id, added[0]._id, added[1]._id, widgets[1]._id, widgets[2]._id
      ]);
      assert.deepEqual(
        [ items[0], items[3], items[4] ].map(item => item.content),
        widgets.map(widget => widget.content)
      );
      assert.equal(items[2].kicker, 'News');
    });

    it('should insert before or after a widget', async function () {
      const widgets = [ richText('A'), richText('B') ];
      const article = await insertArticle({ main: area(widgets) });

      const first = await run('add_widgets', {
        _id: article._id,
        area: 'main',
        widgets: [ { type: '@apostrophecms/rich-text' } ],
        before: widgets[0]._id
      });
      const middle = await run('add_widgets', {
        _id: article._id,
        area: 'main',
        widgets: [ { type: '@apostrophecms/rich-text' } ],
        after: widgets[0]._id
      });

      assert.equal(first.written[0].widgets[0].index, 0);
      assert.equal(middle.written[0].widgets[0].index, 2);
    });

    it('should add into a nested area, and into an area never stored', async function () {
      const widget = card();
      const article = await insertArticle({ main: area([ widget ]) });
      assert.equal('aside' in await findDraft(article._id), false);

      await run('add_widgets', {
        _id: article._id,
        area: `@${widget._id}.body`,
        widgets: [ {
          type: '@apostrophecms/rich-text',
          content: '<p>Nested</p>'
        } ]
      });
      const { written } = await run('add_widgets', {
        _id: article._id,
        area: 'aside',
        widgets: [ { type: '@apostrophecms/rich-text' } ]
      });

      const draft = await findDraft(article._id);
      assert.deepEqual(
        draft.main.items[0].body.items.map(item => item.content),
        [ '<p>Inside</p>', '<p>Nested</p>' ]
      );
      assert.equal(draft.aside.metaType, 'area');
      assert.deepEqual(
        draft.aside.items.map(item => item._id),
        [ written[0].widgets[0]._id ]
      );
    });

    it('should refuse a widget the area doesn\'t take, an unknown area or neighbour', async function () {
      const widget = card();
      const article = await insertArticle({ main: area([ widget ]) });

      const results = [];
      for (const input of [
        {
          area: `@${widget._id}.body`,
          widgets: [ { type: 'tools-card' } ]
        },
        {
          area: 'nope',
          widgets: [ { type: '@apostrophecms/rich-text' } ]
        },
        {
          area: 'main',
          widgets: [ { type: '@apostrophecms/rich-text' } ],
          after: 'nope'
        }
      ]) {
        results.push(await run('add_widgets', {
          _id: article._id,
          ...input
        }));
      }

      assert.deepEqual(results.map(result => fieldsOf(result.refused[0])), [
        [ {
          path: 'main.items.0.body.items.1',
          reason: 'notAllowed'
        } ],
        [ {
          path: 'nope',
          reason: 'unknown'
        } ],
        [ {
          path: 'after',
          reason: 'notfound'
        } ]
      ]);
      const draft = await findDraft(article._id);
      assert.equal(draft.main.items.length, 1);
      assert.equal(draft.main.items[0].body.items.length, 1);
    });

    it('should refuse a place given two ways', async function () {
      await assert.rejects(run('add_widgets', {
        _id: 'any',
        area: 'main',
        widgets: [ { type: '@apostrophecms/rich-text' } ],
        position: 0,
        after: 'any'
      }), {
        name: 'aiToolError',
        message: /"position", "after"/
      });
    });
  });

  describe('move_widgets', function () {
    it('should move a widget to another area with its content and id', async function () {
      const widget = card();
      const stays = richText('Stays');
      const article = await insertArticle({
        main: area([ widget, stays ]),
        aside: area([ richText('Aside') ])
      });

      const { written } = await run('move_widgets', {
        _id: article._id,
        widgets: [ widget._id ],
        area: 'aside',
        position: 0
      });

      assert.deepEqual(written[0].widgets, [ {
        _id: widget._id,
        type: 'tools-card',
        index: 0
      } ]);
      const draft = await findDraft(article._id);
      assert.deepEqual(draft.main.items.map(item => item._id), [ stays._id ]);
      const [ moved ] = draft.aside.items;
      assert.equal(moved._id, widget._id);
      assert.equal(moved.heading, widget.heading);
      assert.equal(moved.body.items[0]._id, widget.body.items[0]._id);
      assert.equal(moved.links[0]._id, widget.links[0]._id);
    });

    it('should reorder widgets within an area, in the order given', async function () {
      const [ a, b, c ] = [ richText('A'), richText('B'), richText('C') ];
      const article = await insertArticle({ main: area([ a, b, c ]) });

      await run('move_widgets', {
        _id: article._id,
        widgets: [ c._id, b._id ],
        area: 'main',
        before: a._id
      });

      const { items } = (await findDraft(article._id)).main;
      assert.deepEqual(items.map(item => item._id), [ c._id, b._id, a._id ]);
    });

    it('should heal stale content inside a widget it moves, as an editor\'s move does', async function () {
      const widget = card();
      const article = await insertArticle({ main: area([ widget ]) });
      // A widget its area no longer takes, stored before the rule changed
      await apos.doc.db.updateOne({ _id: article._id }, {
        $push: { 'main.items.0.body.items': card() }
      });

      const { written } = await run('move_widgets', {
        _id: article._id,
        widgets: [ widget._id ],
        area: 'aside'
      });

      assert.equal(written.length, 1);
      const [ moved ] = (await findDraft(article._id)).aside.items;
      assert.deepEqual(
        moved.body.items.map(item => item._id),
        [ widget.body.items[0]._id ]
      );
    });

    it('should refuse a move into the widget itself', async function () {
      const widget = card();
      const article = await insertArticle({ main: area([ widget ]) });

      const { refused } = await run('move_widgets', {
        _id: article._id,
        widgets: [ widget._id ],
        area: `@${widget._id}.body`
      });

      assert.deepEqual(fieldsOf(refused[0]), [ {
        path: `@${widget._id}.body`,
        reason: 'inside'
      } ]);
    });
  });

  describe('remove_widgets', function () {
    it('should remove widgets by id from any area', async function () {
      const widget = card();
      const [ a, b ] = [ richText('A'), richText('B') ];
      const article = await insertArticle({ main: area([ a, widget, b ]) });

      const { written } = await run('remove_widgets', {
        _id: article._id,
        widgets: [ b._id, widget.body.items[0]._id ]
      });

      assert.deepEqual(written[0].removed, [ b._id, widget.body.items[0]._id ]);
      const { items } = (await findDraft(article._id)).main;
      assert.deepEqual(items.map(item => item._id), [ a._id, widget._id ]);
      assert.deepEqual(items[1].body.items, []);
    });

    it('should refuse an id that is no widget of the document, removing nothing', async function () {
      const a = richText('A');
      const article = await insertArticle({
        main: area([ a ]),
        slides: [ {
          _id: 'slide-3',
          caption: 'A slide'
        } ]
      });

      const { refused } = await run('remove_widgets', {
        _id: article._id,
        widgets: [ a._id, 'slide-3', 'nope' ]
      });

      assert.deepEqual(fieldsOf(refused[0]), [
        {
          path: '@slide-3',
          reason: 'notfound'
        },
        {
          path: '@nope',
          reason: 'notfound'
        }
      ]);
      assert.equal((await findDraft(article._id)).main.items.length, 1);
    });
  });

  describe('get_changes', function () {
    it('should list since publication the changes See Changes lists, as AI reads them', async function () {
      const widget = card();
      const text = richText('Old text');
      const article = await insertArticle({
        title: 'Published',
        main: area([ widget, text ])
      });
      const draft = await apos.modules['tools-article'].findOneForEditing(
        userReq(),
        { _id: article._id }
      );
      await apos.modules['tools-article'].publish(userReq(), draft);
      await run('update_document', {
        targets: [ {
          _id: article._id,
          values: {
            title: 'Changed',
            [`@${widget._id}.heading`]: 'New heading'
          }
        } ]
      });
      // Outside the AI-facing schema, by someone else
      await apos.doc.db.updateOne({ _id: article._id }, {
        $set: {
          'main.items.0.secret': 'Hidden',
          'main.items.1.content': '<p>New text</p>'
        }
      });
      const { written } = await run('add_widgets', {
        _id: article._id,
        area: 'main',
        widgets: [ {
          type: 'tools-card',
          heading: 'Added'
        } ]
      });

      const changes = await run('get_changes', { _id: article._id });
      const seeChanges = await apos.docVersions.getDraftChanges(userReq(), article._id);

      assert.equal(changes.since, 'publication');
      assert(changes.publishedAt);
      const byPath = Object.fromEntries(changes.rows.map(row => [ row.path, row ]));
      assert.deepEqual(Object.keys(byPath).sort(), [
        `@${text._id}.content`,
        `@${widget._id}.heading`,
        `@${written[0].widgets[0]._id}`,
        'title'
      ].sort());
      // See Changes lists the same rows, and the secret one besides
      const seen = seeChanges.rows.map(row => row.patchKey).sort();
      assert.deepEqual(seen, [ ...Object.keys(byPath), `@${widget._id}.secret` ].sort());
      assert.deepEqual(byPath.title, {
        path: 'title',
        change: 'modified',
        before: 'Published',
        after: 'Changed',
        by: 'Ann',
        at: byPath.title.at,
        ai: true
      });
      assert.equal(byPath[`@${text._id}.content`].after, '<p>New text</p>');
      const added = byPath[`@${written[0].widgets[0]._id}`];
      assert.equal(added.change, 'added');
      assert.equal(added.before, undefined);
      assert.equal(added.after.heading, 'Added');
      assert.equal('secret' in added.after, false);
    });

    it('should list since a version only what changed after it', async function () {
      const article = await insertArticle({ title: 'Versioned' });
      await apos.modules['tools-article'].update(userReq('bob'), {
        ...await findDraft(article._id),
        body: 'By Bob'
      });
      const [ bobs ] = await apos.docVersions.find(userReq(), {
        docId: article.aposDocId
      }, { sort: { createdAt: -1 } });
      await run('update_document', {
        targets: [ {
          _id: article._id,
          values: { title: 'By AI' }
        } ]
      });

      const sinceBob = await run('get_changes', {
        _id: article._id,
        since: bobs._id
      });

      assert.equal(sinceBob.since, bobs._id);
      assert.deepEqual(sinceBob.rows.map(row => row.path), [ 'title' ]);
      await assert.rejects(run('get_changes', {
        _id: article._id,
        since: 'nope'
      }), {
        name: 'aiToolError',
        message: /versions/
      });
    });

    it('should list only the changes of one request of the chat', async function () {
      const article = await insertArticle({ title: 'Requested' });
      const first = door(userReq());
      await run('update_document', {
        targets: [ {
          _id: article._id,
          values: { body: 'First' }
        } ]
      }, first);
      await apos.harness.endRequest(first);
      const second = door(userReq(), { requestId: 'request-2' });
      await run('update_document', {
        targets: [ {
          _id: article._id,
          values: { title: 'Second' }
        } ]
      }, second);

      const changes = await run('get_changes', {
        _id: article._id,
        requestId: 'request-1'
      }, second);
      const otherChat = await run('get_changes', {
        _id: article._id,
        requestId: 'request-1'
      }, door(userReq(), {
        chat: 'chat-2',
        lockId: 'chat-2'
      }));

      assert.equal(changes.requestId, 'request-1');
      const rows = changes.rows.map(row => [ row.path, row.before, row.after, row.ai ]);
      assert.deepEqual(rows, [
        [ 'body', '', 'First', true ]
      ]);
      assert.deepEqual(otherChat.rows, []);
      await assert.rejects(run('get_changes', {
        _id: article._id,
        requestId: 'request-1'
      }), { name: 'aiToolError' });
      await assert.rejects(run('get_changes', {
        _id: article._id,
        requestId: 'request-1',
        since: 'other'
      }, second), { name: 'aiToolError' });
    });

    it('should page rows by its budget, and show a value too large for any page by path', async function () {
      const texts = [ richText('One'), richText('Two'), richText('Three') ];
      const article = await insertArticle({ main: area(texts) });
      const draft = await apos.modules['tools-article'].findOneForEditing(
        userReq(),
        { _id: article._id }
      );
      await apos.modules['tools-article'].publish(userReq(), draft);
      const long = length => `<p>${'x'.repeat(length)}</p>`;
      await apos.doc.db.updateOne({ _id: article._id }, {
        $set: {
          'main.items.0.content': long(25000),
          'main.items.1.content': long(25000),
          'main.items.2.content': long(50000)
        }
      });

      const first = await run('get_changes', { _id: article._id });
      const second = await run('get_changes', {
        _id: article._id,
        offset: first.next
      });

      assert.deepEqual(first.rows.map(row => row.path), [ `@${texts[0]._id}.content` ]);
      assert.equal(first.next, 1);
      assert.deepEqual(second.rows.map(row => row.path), [
        `@${texts[1]._id}.content`,
        `@${texts[2]._id}.content`
      ]);
      assert.equal(second.next, undefined);
      assert.equal(second.rows[0].after.length, 25007);
      assert.equal(second.rows[1].before, undefined);
      assert.equal(second.rows[1].after, undefined);
      assert.equal(second.rows[1].change, 'modified');
      assert.match(second.rows[1].note, /get_document/);
    });
  });
});
