const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// What AI Localize gives the AI doors: `get_localization`, one document
// against its copy in another locale.

describe('AI Localize: get_localization', function () {
  this.timeout(t.timeout);

  let apos;
  const users = {};

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {},
              fr: { prefix: '/fr' },
              de: { prefix: '/de' }
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
                name: 'loc-page',
                label: 'Page'
              }
            ]
          }
        },
        'loc-page': {
          extend: '@apostrophecms/page-type'
        },
        'loc-card-widget': {
          extend: '@apostrophecms/widget-type',
          fields: {
            add: {
              heading: { type: 'string' },
              secret: { type: 'string' },
              links: {
                type: 'array',
                fields: {
                  add: {
                    label: { type: 'string' }
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
        'loc-article': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              summary: { type: 'string' },
              main: {
                type: 'area',
                options: {
                  widgets: {
                    'loc-card': {},
                    '@apostrophecms/rich-text': {}
                  }
                }
              }
            }
          }
        },
        // Only an admin may edit one
        'loc-notice': {
          extend: '@apostrophecms/piece-type',
          options: {
            editRole: 'admin'
          }
        },
        'loc-setting': {
          extend: '@apostrophecms/piece-type',
          options: {
            localized: false
          }
        }
      }
    });
    for (const [ name, role ] of [ [ 'ann', 'admin' ], [ 'bob', 'admin' ], [ 'eve', 'editor' ] ]) {
      users[name] = await apos.user.insert(apos.task.getReq(), {
        username: name,
        title: name[0].toUpperCase() + name.slice(1),
        password: 'test-password',
        role
      });
    }
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  function userReq(username = 'ann', extra = {}) {
    return apos.task.getReq({
      user: users[username],
      mode: 'draft',
      ...extra
    });
  }

  function door(req = userReq()) {
    return apos.harness.withDoor(req, {
      door: 'assistant',
      lockId: 'chat-1',
      chat: 'chat-1',
      requestId: apos.util.generateId()
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

  function read(input, req) {
    return run('get_localization', input, req);
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
      type: 'loc-card',
      heading: 'A card',
      links: [ {
        _id: apos.util.generateId(),
        metaType: 'arrayItem',
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

  const articles = () => apos.modules['loc-article'];

  // An article in English with an intro and a card, copied into French by
  // core's Localize
  async function seed() {
    const intro = richText('Intro');
    const widget = card();
    const article = await articles().insert(userReq(), {
      title: 'An article',
      summary: 'In short',
      main: area([ intro, widget ])
    });
    const french = await articles().localize(userReq(), article, 'fr');
    return {
      article,
      french,
      intro,
      widget
    };
  }

  // Saves a copy as `username` after `change(draft)`
  async function edit(_id, change, username = 'ann') {
    const req = userReq(username, { locale: _id.split(':')[1] });
    const draft = await articles().findOneForEditing(req, { _id });
    change(draft);
    return articles().update(req, draft);
  }

  function widgetOf(draft, _id) {
    return draft.main.items.find(item => item._id === _id);
  }

  function forget(aposDocId) {
    return apos.aiLocalize.recordsDb.deleteMany({ aposDocId });
  }

  function paths(rows) {
    return rows.map(row => row.path);
  }

  it('should be a tool of both doors', function () {
    for (const name of [ 'assistant', 'mcp' ]) {
      const names = apos.harness.getDoorTools(name).map(tool => tool.name);
      assert(names.includes('get_localization'), name);
    }
    // Several locales, but no assistant enabled: no Localize in widget menus
    assert.deepEqual(apos.area.widgetOperations, []);
  });

  it('should say a document has no copy in a locale', async function () {
    const { article } = await seed();

    const result = await read({
      _id: article._id,
      locale: 'de'
    });

    assert.deepEqual(result, {
      _id: article._id,
      type: 'loc-article',
      title: 'An article',
      locale: 'en',
      state: 'missing'
    });
  });

  it('should say when a page\'s parent has no copy there either', async function () {
    const home = await apos.page.find(userReq(), { level: 0 }).toObject();
    const parent = await apos.page.insert(userReq(), home._id, 'lastChild', {
      type: 'loc-page',
      title: 'Parent'
    });
    const child = await apos.page.insert(userReq(), parent._id, 'lastChild', {
      type: 'loc-page',
      title: 'Child'
    });

    const orphan = await read({
      _id: child._id,
      locale: 'de'
    });
    const top = await read({
      _id: parent._id,
      locale: 'de'
    });
    await apos.page.localize(userReq(), parent, 'de');
    const ready = await read({
      _id: child._id,
      locale: 'de'
    });

    assert.equal(orphan.state, 'missing');
    assert.equal(orphan.parentMissing, true);
    assert.equal(top.state, 'missing');
    assert.equal(top.parentMissing, undefined);
    assert.equal(ready.state, 'missing');
    assert.equal(ready.parentMissing, undefined);
  });

  it('should find a fresh copy up to date, with who localized and when', async function () {
    const { article, french } = await seed();

    const result = await read({
      _id: article._id,
      locale: 'fr'
    });

    assert.equal(result.state, 'upToDate');
    assert.equal(result.basis, 'record');
    assert.equal(result.by, 'Ann');
    assert.equal(result.ai, undefined);
    assert(result.since instanceof Date);
    assert.deepEqual(result.target, {
      _id: french._id,
      title: 'An article',
      locale: 'fr'
    });
    assert.deepEqual(result.sourceChanges, []);
    assert.deepEqual(result.targetChanges, []);
    assert.equal(result.next, undefined);
    assert.equal(result.note, undefined);
  });

  it('should list what the source changed since, each row usable in the target by its id', async function () {
    const {
      article, widget, intro
    } = await seed();
    await edit(article._id, draft => {
      draft.summary = 'In brief';
      widgetOf(draft, widget._id).heading = 'A new heading';
      widgetOf(draft, widget._id).links[0].label = 'A new label';
      widgetOf(draft, intro._id).content = '<p>A new intro</p>';
    });

    const result = await read({
      _id: article._id,
      locale: 'fr'
    });

    assert.equal(result.state, 'behind');
    assert.deepEqual(result.targetChanges, []);
    const byPath = Object.fromEntries(result.sourceChanges.map(row => [ row.path, row ]));
    assert.deepEqual(Object.keys(byPath).sort(), [
      'summary',
      `@${intro._id}.content`,
      `@${widget._id}.heading`,
      `@${widget.links[0]._id}.label`
    ].sort());
    const heading = byPath[`@${widget._id}.heading`];
    assert.equal(heading.change, 'modified');
    assert.equal(heading.before, 'A card');
    assert.equal(heading.after, 'A new heading');
    assert.equal(heading.counterpart, true);
    assert.equal(heading.changedInTarget, undefined);
    // The save replaced the version the localization found: still credited
    assert.equal(heading.by, 'Ann');
    assert(heading.at instanceof Date);
    assert.equal(byPath[`@${widget.links[0]._id}.label`].counterpart, true);
    assert.equal(byPath[`@${intro._id}.content`].after, '<p>A new intro</p>');
    // A field of the document itself is at the same path in every copy
    assert.equal(byPath.summary.counterpart, undefined);
  });

  it('should list what each copy changed, who did and whether AI did', async function () {
    const {
      article, french, widget, intro
    } = await seed();
    await edit(article._id, draft => {
      widgetOf(draft, widget._id).heading = 'A new heading';
    }, 'bob');
    await run('update_document', {
      targets: [ {
        _id: french._id,
        values: { [`@${intro._id}.content`]: '<p>Une intro</p>' }
      } ]
    }, door(userReq('bob')));

    const result = await read({
      _id: article._id,
      locale: 'fr'
    });

    assert.equal(result.state, 'behind');
    assert.deepEqual(paths(result.sourceChanges), [ `@${widget._id}.heading` ]);
    assert.equal(result.sourceChanges[0].by, 'Bob');
    assert.equal(result.sourceChanges[0].ai, undefined);
    assert.equal(result.sourceChanges[0].changedInTarget, undefined);
    assert.deepEqual(paths(result.targetChanges), [ `@${intro._id}.content` ]);
    const [ row ] = result.targetChanges;
    assert.equal(row.after, '<p>Une intro</p>');
    assert.equal(row.by, 'Bob');
    assert.equal(row.ai, true);
    assert.equal(row.counterpart, true);
  });

  it('should mark a source change whose spot the target changed too', async function () {
    const {
      article, french, widget, intro
    } = await seed();
    await edit(article._id, draft => {
      draft.summary = 'In brief';
      widgetOf(draft, widget._id).heading = 'A new heading';
      widgetOf(draft, intro._id).content = '<p>A new intro</p>';
    });
    await edit(french._id, draft => {
      draft.summary = 'En bref';
      widgetOf(draft, widget._id).heading = 'Un titre';
    });

    const result = await read({
      _id: article._id,
      locale: 'fr'
    });

    const byPath = Object.fromEntries(result.sourceChanges.map(row => [ row.path, row ]));
    assert.equal(byPath.summary.changedInTarget, true);
    assert.equal(byPath[`@${widget._id}.heading`].changedInTarget, true);
    assert.equal(byPath[`@${intro._id}.content`].changedInTarget, undefined);
    assert.deepEqual(paths(result.targetChanges).sort(), [
      'summary',
      `@${widget._id}.heading`
    ].sort());
  });

  it('should mark a source change inside a widget the target removed', async function () {
    const {
      article, french, widget
    } = await seed();
    await edit(article._id, draft => {
      widgetOf(draft, widget._id).links[0].label = 'A new label';
    });
    await edit(french._id, draft => {
      draft.main.items = draft.main.items.filter(item => item._id !== widget._id);
    });

    const result = await read({
      _id: article._id,
      locale: 'fr'
    });

    assert.deepEqual(result.sourceChanges.map(row => ({
      path: row.path,
      counterpart: row.counterpart,
      changedInTarget: row.changedInTarget
    })), [ {
      path: `@${widget.links[0]._id}.label`,
      counterpart: false,
      changedInTarget: true
    } ]);
    assert.deepEqual(result.targetChanges.map(row => [ row.path, row.change ]), [
      [ `@${widget._id}`, 'removed' ]
    ]);
    // The source still holds what the target removed
    assert.equal(result.targetChanges[0].counterpart, true);
  });

  it('should give an added widget\'s place and whether the target has it', async function () {
    const {
      article, french, widget, intro
    } = await seed();
    const added = richText('Added');
    const second = richText('Second');
    await edit(french._id, draft => {
      draft.main.items = draft.main.items.filter(item => item._id !== widget._id);
    });
    await edit(article._id, draft => {
      const [ first, last ] = draft.main.items;
      draft.main.items = [ first, added, last, second ];
    });

    const result = await read({
      _id: article._id,
      locale: 'fr'
    });

    const rows = result.sourceChanges.filter(row => row.change === 'added');
    assert.deepEqual(rows.map(row => ({
      path: row.path,
      counterpart: row.counterpart,
      place: row.place
    })), [
      {
        path: `@${added._id}`,
        counterpart: false,
        place: {
          area: 'main',
          after: intro._id,
          counterpart: true
        }
      },
      {
        path: `@${second._id}`,
        counterpart: false,
        place: {
          area: 'main',
          after: widget._id,
          counterpart: false
        }
      }
    ]);
    assert.equal(rows[0].after.content, '<p>Added</p>');
  });

  it('should say a widget the source removed is still in the target', async function () {
    const {
      article, widget
    } = await seed();
    await edit(article._id, draft => {
      draft.main.items = draft.main.items.filter(item => item._id !== widget._id);
    });

    const result = await read({
      _id: article._id,
      locale: 'fr'
    });

    assert.deepEqual(result.sourceChanges.map(row => ({
      path: row.path,
      change: row.change,
      counterpart: row.counterpart
    })), [ {
      path: `@${widget._id}`,
      change: 'removed',
      counterpart: true
    } ]);
  });

  it('should find no counterpart in a target rebuilt with widgets of its own', async function () {
    const {
      article, french, widget, intro
    } = await seed();
    await edit(french._id, draft => {
      draft.main.items = [ richText('Une intro'), card({ heading: 'Une carte' }) ];
    });
    await edit(article._id, draft => {
      widgetOf(draft, widget._id).heading = 'A new heading';
    });

    const result = await read({
      _id: article._id,
      locale: 'fr',
      widgets: [ intro._id, widget._id ]
    });

    assert.equal(result.state, 'behind');
    assert.deepEqual(result.widgets, [
      {
        _id: intro._id,
        type: '@apostrophecms/rich-text',
        counterpart: false,
        changed: false,
        changedInTarget: true,
        place: {
          area: 'main',
          position: 0,
          counterpart: true
        }
      },
      {
        _id: widget._id,
        type: 'loc-card',
        counterpart: false,
        changed: true,
        changedInTarget: true,
        place: {
          area: 'main',
          after: intro._id,
          counterpart: false
        }
      }
    ]);
    assert.deepEqual(result.sourceChanges.map(row => [ row.path, row.counterpart ]), [
      [ `@${widget._id}.heading`, false ]
    ]);
    // The target's change to both: it removed them
    assert.deepEqual(result.targetChanges.map(row => [ row.path, row.change ]), [
      [ `@${intro._id}`, 'removed' ],
      [ `@${widget._id}`, 'removed' ]
    ]);
  });

  it('should find no counterpart in a copy whose ids were all regenerated', async function () {
    const {
      article, french, widget
    } = await seed();
    const stored = await apos.doc.db.findOne({ _id: french._id });
    apos.schema.regenerateIds(userReq(), articles().schema, stored);
    await apos.doc.db.replaceOne({ _id: french._id }, stored);
    await edit(article._id, draft => {
      widgetOf(draft, widget._id).heading = 'A new heading';
    });

    const result = await read({
      _id: article._id,
      locale: 'fr',
      widgets: [ widget._id ]
    });

    assert.equal(result.widgets[0].counterpart, false);
    assert.equal(result.widgets[0].changed, true);
    assert.deepEqual(result.sourceChanges.map(row => [ row.path, row.counterpart ]), [
      [ `@${widget._id}.heading`, false ]
    ]);
  });

  it('should list a widget asked for though nothing changed in it, and only the rows of those asked for', async function () {
    const {
      article, french, widget, intro
    } = await seed();
    await edit(article._id, draft => {
      draft.summary = 'In brief';
      widgetOf(draft, intro._id).content = '<p>A new intro</p>';
    });
    await edit(french._id, draft => {
      widgetOf(draft, widget._id).heading = 'Un titre';
      widgetOf(draft, intro._id).content = '<p>Une intro</p>';
    });

    const result = await read({
      _id: article._id,
      locale: 'fr',
      widgets: [ widget._id ]
    });

    assert.equal(result.state, 'behind');
    assert.deepEqual(result.widgets, [ {
      _id: widget._id,
      type: 'loc-card',
      counterpart: true,
      changed: false,
      changedInTarget: true,
      place: {
        area: 'main',
        after: intro._id,
        counterpart: true
      }
    } ]);
    assert.deepEqual(result.sourceChanges, []);
    assert.deepEqual(paths(result.targetChanges), [ `@${widget._id}.heading` ]);
  });

  it('should name a widget the source doesn\'t hold', async function () {
    const { article } = await seed();

    await assert.rejects(read({
      _id: article._id,
      locale: 'fr',
      widgets: [ 'nowhere' ]
    }), {
      name: 'aiToolError',
      message: /No widget "nowhere"/
    });
  });

  it('should not count a change AI doesn\'t read', async function () {
    const { article, widget } = await seed();
    await edit(article._id, draft => {
      widgetOf(draft, widget._id).secret = 'Kept away from AI';
    });

    const result = await read({
      _id: article._id,
      locale: 'fr'
    });

    assert.equal(result.state, 'upToDate');
    assert.deepEqual(result.sourceChanges, []);
  });

  it('should compare from the version history when no record says, and say so', async function () {
    const {
      article, widget
    } = await seed();
    await forget(article.aposDocId);
    await edit(article._id, draft => {
      widgetOf(draft, widget._id).heading = 'A new heading';
    }, 'bob');

    const result = await read({
      _id: article._id,
      locale: 'fr'
    });

    assert.equal(result.state, 'behind');
    assert.equal(result.basis, 'versions');
    assert.equal(result.by, undefined);
    assert.match(result.note, /version history/);
    assert.deepEqual(paths(result.sourceChanges), [ `@${widget._id}.heading` ]);
  });

  it('should say when nothing tells where the copies were last in line', async function () {
    const {
      article, widget
    } = await seed();
    await forget(article.aposDocId);
    await apos.docVersions.removeVersions(userReq(), { docId: article.aposDocId });

    const result = await read({
      _id: article._id,
      locale: 'fr',
      widgets: [ widget._id ]
    });

    assert.equal(result.state, 'noBaseline');
    assert.equal(result.since, undefined);
    assert.equal(result.basis, undefined);
    assert.deepEqual(result.sourceChanges, []);
    assert.deepEqual(result.targetChanges, []);
    assert.equal(result.widgets[0].counterpart, true);
    assert.equal('changed' in result.widgets[0], false);
  });

  it('should say a copy an unfinished localization left is untranslated, with the changes since it', async function () {
    const intro = richText('Intro');
    const article = await articles().insert(userReq(), {
      title: 'An article',
      main: area([ intro ])
    });
    await articles().localize(userReq('ann', { aposAiLocalizeCopy: true }), article, 'fr');
    const targetId = article._id.replace(':en:', ':fr:');
    await apos.aiLocalize.insertRecord(userReq(), {
      aposDocId: article.aposDocId,
      from: 'en',
      to: 'fr',
      via: 'copy',
      source: await apos.aiLocalize.storedDraft(article._id),
      target: await apos.aiLocalize.storedDraft(targetId)
    });
    await edit(targetId, draft => {
      draft.title = 'Un article';
    });

    const result = await read({
      _id: article._id,
      locale: 'fr'
    });

    assert.equal(result.state, 'untranslated');
    assert.equal(result.basis, 'record');
    assert.match(result.note, /never finished/);
    assert.deepEqual(result.sourceChanges, []);
    assert.deepEqual(paths(result.targetChanges), [ 'title' ]);
  });

  it('should compare from a localization made the other way', async function () {
    const {
      article, french, widget
    } = await seed();
    await edit(french._id, draft => {
      widgetOf(draft, widget._id).heading = 'Un titre';
    });

    const result = await read({
      _id: french._id,
      locale: 'en'
    });

    assert.equal(result.locale, 'fr');
    assert.equal(result.target._id, article._id);
    assert.equal(result.state, 'behind');
    assert.deepEqual(paths(result.sourceChanges), [ `@${widget._id}.heading` ]);
    assert.deepEqual(result.targetChanges, []);
  });

  it('should read long lists in pages, the source\'s share first', async function () {
    const widgets = [ 1, 2, 3, 4 ].map(n => richText(`Paragraph ${n}`));
    const article = await articles().insert(userReq(), {
      title: 'A long article',
      main: area(widgets)
    });
    const french = await articles().localize(userReq(), article, 'fr');
    const long = (word, n) => `<p>${`${word} ${n} `.repeat(700)}</p>`;
    await edit(article._id, draft => {
      draft.main.items.forEach((item, i) => {
        item.content = long('source', i);
      });
    });
    await edit(french._id, draft => {
      draft.main.items.forEach((item, i) => {
        item.content = long('cible', i);
      });
    });

    const pages = [];
    let offset;
    do {
      const page = await read({
        _id: article._id,
        locale: 'fr',
        ...(offset && { offset })
      });
      pages.push(page);
      offset = page.next;
    } while (offset && (pages.length < 10));

    assert(pages.length > 1);
    assert(pages[0].sourceChanges.length > 0);
    assert(pages[0].targetChanges.length > 0);
    assert.match(pages[0].next, /^\d+:\d+$/);
    for (const side of [ 'sourceChanges', 'targetChanges' ]) {
      assert.deepEqual(
        pages.flatMap(page => paths(page[side])),
        widgets.map(widget => `@${widget._id}.content`)
      );
    }
    for (const page of pages) {
      assert(JSON.stringify(page).length <= apos.ai.getTool('get_localization').maxResultChars);
    }
  });

  it('should make a door\'s later write to either copy answer to this read', async function () {
    const { article, french } = await seed();
    const req = door();

    await read({
      _id: article._id,
      locale: 'fr'
    }, req);

    const { seen } = apos.harness.getDoor(req);
    assert(seen.has(article._id));
    assert(seen.has(french._id));
  });

  it('should refuse the changes of a copy the user may not edit', async function () {
    const notice = await apos.modules['loc-notice'].insert(userReq(), { title: 'A notice' });
    await apos.modules['loc-notice'].localize(userReq(), notice, 'fr');

    await assert.rejects(read({
      _id: notice._id,
      locale: 'fr'
    }, userReq('eve')), {
      name: 'aiToolError',
      message: /may not see the changes/
    });
  });

  it('should refuse the document\'s own locale and a type that exists once', async function () {
    const { article } = await seed();
    const setting = await apos.modules['loc-setting'].insert(userReq(), { title: 'A setting' });

    await assert.rejects(read({
      _id: article._id,
      locale: 'en'
    }), {
      name: 'aiToolError',
      message: /name another locale/
    });
    await assert.rejects(read({
      _id: setting._id,
      locale: 'fr'
    }), {
      name: 'aiToolError',
      message: /exist once/
    });
  });
});

describe('AI Localize: get_localization in a project with one locale', function () {
  this.timeout(t.timeout);

  let apos;

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    apos = await t.create({
      root: module
    });
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  it('should not be registered, while the harness\'s tools are', function () {
    const names = apos.ai.getTools().map(tool => tool.name);

    assert(names.includes('copy_widgets'));
    for (const name of [ 'get_localization', 'localize_document', 'record_localization' ]) {
      assert.equal(names.includes(name), false, name);
    }
  });
});
