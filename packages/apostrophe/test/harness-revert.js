const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// Revert: what door requests changed taken back across every document, as
// the change log recorded it.

describe('Harness: revert', function () {
  this.timeout(t.timeout);

  let apos;

  before(async function () {
    apos = await t.create({
      root: module,
      modules: {
        'revert-article': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              body: { type: 'string' },
              _notices: {
                type: 'relationship',
                withType: 'revert-notice'
              }
            }
          }
        },
        'revert-notice': {
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
        'revert-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {},
                    '@apostrophecms/layout': {}
                  }
                }
              },
              side: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {}
                  }
                }
              }
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
                name: 'revert-page',
                label: 'Page'
              }
            ]
          }
        }
      }
    });
  });

  after(async function () {
    await t.destroy(apos);
  });

  function userReq(user = 'ann') {
    return apos.task.getReq({
      user: {
        _id: `user-${user}`,
        username: user,
        title: user[0].toUpperCase() + user.slice(1),
        role: 'admin'
      },
      mode: 'draft'
    });
  }

  // A request of the assistant's chat
  function door(context = {}) {
    return apos.harness.withDoor(userReq(), {
      door: 'assistant',
      lockId: 'chat-1',
      family: 'tab-1',
      chat: 'chat-1',
      requestId: apos.util.generateId(),
      ...context
    });
  }

  async function write(req, _id, patch) {
    const { written, refused } = await apos.harness.writeDocuments(req, [ {
      _id,
      patch
    } ]);
    assert.deepEqual(refused, []);
    return written[0].doc;
  }

  // Reverts the requests, after a dry run that must say the same
  async function revert(requests, options = {}) {
    const ids = requests.map(req => apos.harness.getDoor(req).requestId);
    for (const req of requests) {
      await apos.harness.endRequest(req);
    }
    const dry = await apos.harness.revertRequests(door({ revert: true }), ids, {
      ...options,
      dryRun: true
    });
    const done = await apos.harness.revertRequests(door({ revert: true }), ids, options);
    assert.deepEqual(dry.map(outcomeOf), done.map(outcomeOf));
    return done;
  }

  function outcomeOf({
    docId, outcome, reason, lockedBy, rows
  }) {
    return {
      docId,
      outcome,
      reason,
      lockedBy,
      rows: rows.map(row => row.outcome)
    };
  }

  function byDoc(results, _id) {
    return results.find(result => result.docId === _id);
  }

  function find(_id) {
    return apos.doc.db.findOne({ _id });
  }

  function insertArticles(count, prefix = 'Article') {
    return Promise.all(Array.from({ length: count }, (item, i) => {
      return apos.modules['revert-article'].insert(userReq(), {
        title: `${prefix} ${i + 1}`,
        body: 'Original'
      });
    }));
  }

  function countVersions(doc) {
    return apos.docVersions.count(userReq(), {
      docId: doc.aposDocId,
      locale: 'en'
    });
  }

  function home() {
    return apos.page.find(userReq(), { level: 0 }).toObject();
  }

  async function createPage(req, title, parent) {
    const { written, refused } = await apos.harness.createDocument(req, {
      type: 'revert-page',
      title,
      parent: parent || await home()
    });
    assert.deepEqual(refused, []);
    return written[0].doc;
  }

  function richText(_id, content) {
    return {
      _id,
      metaType: 'widget',
      type: '@apostrophecms/rich-text',
      content
    };
  }

  function area(_id, items) {
    return {
      _id,
      metaType: 'area',
      items
    };
  }

  // A layout of columns as the layout widget stores it
  function layout(_id, columns) {
    return {
      _id,
      metaType: 'widget',
      type: '@apostrophecms/layout',
      columns: area(`${_id}-columns`, columns)
    };
  }

  function column(_id, colstart, text) {
    return {
      _id,
      metaType: 'widget',
      type: '@apostrophecms/layout-column',
      colstart,
      colspan: 6,
      rowstart: 1,
      rowspan: 1,
      order: 0,
      justify: 'start',
      content: area(`${_id}-content`, [ richText(`${_id}-text`, `<p>${text}</p>`) ])
    };
  }

  it('should put back thirty articles, one new version each', async function () {
    const articles = await insertArticles(30, 'Thirty');
    const req = door();
    for (const article of articles) {
      await write(req, article._id, { body: 'Shorter' });
    }
    const before = await Promise.all(articles.map(countVersions));

    const results = await revert([ req ]);

    assert.equal(results.length, 30);
    assert(results.every(result => result.outcome === 'putBack'));
    for (const [ i, article ] of articles.entries()) {
      assert.equal((await find(article._id)).body, 'Original');
      assert.equal(await countVersions(article), before[i] + 1);
    }
  });

  it('should take back a request and every later one, newest first', async function () {
    const [ article ] = await insertArticles(1);
    const first = door();
    await write(first, article._id, { body: 'First' });
    const second = door();
    await write(second, article._id, {
      body: 'Second',
      title: 'Renamed'
    });

    const [ result ] = await revert([ first, second ]);

    assert.equal(result.outcome, 'putBack');
    assert.deepEqual(result.rows.map(row => row.outcome), [ 'putBack', 'putBack', 'putBack' ]);
    const stored = await find(article._id);
    assert.equal(stored.body, 'Original');
    assert.equal(stored.title, 'Article 1');
    assert.equal(result.title, 'Article 1');
  });

  it('should keep and list a field edited since, and put back the rest', async function () {
    const articles = await insertArticles(2);
    const req = door();
    for (const article of articles) {
      await write(req, article._id, {
        body: 'AI body',
        title: `${article.title} by AI`
      });
    }
    await write(userReq(), articles[0]._id, { body: 'Ann wrote this' });

    const results = await revert([ req ]);

    const edited = byDoc(results, articles[0]._id);
    assert.equal(edited.outcome, 'kept');
    assert.equal(edited.reason, 'edited');
    assert.deepEqual(edited.rows.map(row => row.outcome).sort(), [ 'edited', 'putBack' ]);
    const stored = await find(articles[0]._id);
    assert.equal(stored.body, 'Ann wrote this');
    assert.equal(stored.title, 'Article 1');
    assert.equal(byDoc(results, articles[1]._id).outcome, 'putBack');
    assert.equal((await find(articles[1]._id)).body, 'Original');
  });

  it('should count a change already taken back as reverted, not as a conflict', async function () {
    const [ article ] = await insertArticles(1);
    const req = door();
    await write(req, article._id, { body: 'AI body' });
    // Ctrl+Z on the page saves the older value back
    await write(userReq(), article._id, { body: 'Original' });
    const versions = await countVersions(article);

    const [ result ] = await revert([ req ]);

    assert.equal(result.outcome, 'reverted');
    assert.deepEqual(result.rows.map(row => row.outcome), [ 'reverted' ]);
    assert.equal(await countVersions(article), versions);
  });

  it('should keep a document archived or removed since', async function () {
    const articles = await insertArticles(2);
    const req = door();
    for (const article of articles) {
      await write(req, article._id, { body: 'AI body' });
    }
    await apos.doc.db.updateOne({ _id: articles[0]._id }, { $set: { archived: true } });
    await apos.doc.db.deleteOne({ _id: articles[1]._id });

    const results = await revert([ req ]);

    assert.equal(byDoc(results, articles[0]._id).reason, 'archived');
    assert.equal(byDoc(results, articles[1]._id).reason, 'removed');
    assert.equal(byDoc(results, articles[1]._id).title, 'Article 2');
    assert(results.every(result => result.outcome === 'kept'));
  });

  it('should hold back a document someone has locked, and put it back on retry', async function () {
    const articles = await insertArticles(2);
    const req = door();
    for (const article of articles) {
      await write(req, article._id, { body: 'AI body' });
    }
    const locked = await find(articles[0]._id);
    await apos.doc.lock(userReq('bob'), locked, 'bob-tab');

    const results = await revert([ req ]);

    assert.equal(byDoc(results, locked._id).outcome, 'locked');
    assert.equal(byDoc(results, locked._id).lockedBy, 'Bob');
    assert.equal((await find(locked._id)).body, 'AI body');
    assert.equal(byDoc(results, articles[1]._id).outcome, 'putBack');

    await apos.doc.unlock(userReq('bob'), locked, 'bob-tab');
    const retried = await revert([ req ], { docIds: [ locked._id ] });

    assert.deepEqual(retried.map(result => result.outcome), [ 'putBack' ]);
    assert.equal((await find(locked._id)).body, 'Original');
  });

  it('should not take its own browser tab\'s page lock for someone else\'s', async function () {
    const [ article ] = await insertArticles(1);
    const req = door();
    await write(req, article._id, { body: 'AI body' });
    // The editor's page in edit mode, in the browser tab of the chat
    await apos.doc.lock(userReq(), await find(article._id), 'tab-1');

    const [ result ] = await revert([ req ]);

    assert.equal(result.outcome, 'putBack');
    assert.equal((await find(article._id)).advisoryLock._id, 'tab-1');
  });

  it('should record the revert as the user\'s change, not marked as AI\'s', async function () {
    const [ article ] = await insertArticles(1);
    const req = door();
    await write(req, article._id, { body: 'AI body' });
    const reverting = door({ revert: true });

    await apos.harness.revertRequests(reverting, [ apos.harness.getDoor(req).requestId ]);

    const [ entry ] = await apos.harness.changes
      .find({ requestId: apos.harness.getDoor(reverting).requestId })
      .toArray();
    assert.equal(entry.ai, false);
    assert.equal(entry.revert, true);
    assert.equal(entry.userId, 'user-ann');
    const [ version ] = await apos.docVersions.find(userReq(), {
      docId: article.aposDocId,
      locale: 'en'
    });
    assert.equal(version.ai, false);
  });

  it('should refuse a revert without the door context of a revert', async function () {
    await assert.rejects(
      () => apos.harness.revertRequests(door(), [ 'nothing' ]),
      { name: 'invalid' }
    );
  });

  describe('created documents', function () {
    it('should delete a page nobody published or edited, and keep one published since', async function () {
      const req = door();
      const untouched = await createPage(req, 'Untouched');
      const published = await createPage(req, 'Published');
      await apos.page.publish(userReq(), await find(published._id));

      const results = await revert([ req ]);

      assert.equal(byDoc(results, untouched._id).outcome, 'deleted');
      assert.equal(await find(untouched._id), null);
      assert.equal(byDoc(results, published._id).outcome, 'kept');
      assert.equal(byDoc(results, published._id).reason, 'published');
      assert(await find(published._id));
    });

    it('should keep a page edited or given children since, and delete its children first', async function () {
      const req = door();
      const edited = await createPage(req, 'Edited');
      const parent = await createPage(req, 'Parent');
      const child = await createPage(req, 'Child', parent);
      const adopted = await createPage(req, 'Adopted');
      await write(userReq(), edited._id, { title: 'Edited by Ann' });
      await apos.page.insert(userReq(), adopted._id, 'lastChild', {
        type: 'revert-page',
        title: 'Ann\'s child'
      });

      const results = await revert([ req ]);

      assert.equal(byDoc(results, edited._id).reason, 'edited');
      assert.equal(byDoc(results, child._id).outcome, 'deleted');
      assert.equal(byDoc(results, parent._id).outcome, 'deleted');
      assert.equal(byDoc(results, adopted._id).reason, 'children');
      assert(await find(adopted._id));
    });

    it('should archive a document of a type that publishes on save, its own save not counting as publishing', async function () {
      const req = door();
      const { written } = await apos.harness.createDocument(req, {
        type: 'revert-notice',
        title: 'Live notice'
      });
      const notice = written[0].doc;
      assert((await find(notice._id.replace(':draft', ':published'))));

      const [ result ] = await revert([ req ]);

      assert.equal(result.outcome, 'archived');
      assert.equal((await find(notice._id)).archived, true);
    });

    it('should remove a document after the changes referencing it, and keep one used elsewhere since', async function () {
      const [ article, other ] = await insertArticles(2);
      const req = door();
      const created = [];
      for (const title of [ 'Referenced by AI', 'Used by Ann' ]) {
        const { written } = await apos.harness.createDocument(req, {
          type: 'revert-notice',
          title
        });
        created.push(written[0].doc);
      }
      await write(req, article._id, { _notices: [ created[0] ] });
      await write(userReq(), other._id, { _notices: [ created[1] ] });

      const results = await revert([ req ]);

      assert.equal(byDoc(results, article._id).outcome, 'putBack');
      assert.deepEqual((await find(article._id)).noticesIds, []);
      assert.equal(byDoc(results, created[0]._id).outcome, 'archived');
      assert.equal(byDoc(results, created[1]._id).outcome, 'kept');
      assert.equal(byDoc(results, created[1]._id).reason, 'used');
    });

    it('should count a created document gone since as reverted', async function () {
      const req = door();
      const page = await createPage(req, 'Gone');
      await apos.doc.db.deleteOne({ _id: page._id });

      const [ result ] = await revert([ req ]);

      assert.equal(result.outcome, 'reverted');
    });
  });

  describe('widgets', function () {
    let page;

    beforeEach(async function () {
      page = await apos.page.insert(userReq(), '_home', 'lastChild', {
        type: 'revert-page',
        title: 'Widgets',
        main: {
          metaType: 'area',
          items: [
            richText('w-a', '<p>Alpha</p>'),
            richText('w-b', '<p>Bravo</p>')
          ]
        },
        side: {
          metaType: 'area',
          items: []
        }
      });
    });

    function areaIds(doc, name) {
      return doc[name].items.map(widget => widget._id);
    }

    it('should put back a widget moved between areas and edited since, keeping the edit', async function () {
      const req = door();
      await write(req, page._id, {
        $pullAllById: { [`@${page.main._id}.items`]: [ 'w-a' ] },
        $push: { [`@${page.side._id}.items`]: richText('w-a', '<p>Alpha</p>') },
        _lossless: false
      });
      await write(userReq(), page._id, { '@w-a.content': '<p>Alpha, edited</p>' });

      const [ result ] = await revert([ req ]);

      const stored = await find(page._id);
      assert.equal(result.outcome, 'putBack', JSON.stringify(result.rows));
      assert.deepEqual(areaIds(stored, 'main'), [ 'w-a', 'w-b' ]);
      assert.deepEqual(areaIds(stored, 'side'), []);
      assert.equal(stored.main.items[0].content, '<p>Alpha, edited</p>');
    });

    it('should put back several widgets the request removed, in their order', async function () {
      const req = door();
      await write(req, page._id, {
        $pullAllById: { [`@${page.main._id}.items`]: [ 'w-a', 'w-b' ] }
      });

      const [ result ] = await revert([ req ]);

      assert.equal(result.outcome, 'putBack');
      assert.deepEqual(areaIds(await find(page._id), 'main'), [ 'w-a', 'w-b' ]);
    });

    it('should put back a widget moved into a layout whose columns changed in the same save', async function () {
      await write(userReq(), page._id, {
        main: area(page.main._id, [
          richText('w-a', '<p>Alpha</p>'),
          layout('lay', [ column('one', 1, 'One'), column('two', 7, 'Two') ])
        ])
      });
      const req = door();
      // Alpha into the first column, and the second column gone
      await write(req, page._id, {
        main: area(page.main._id, [
          layout('lay', [ {
            ...column('one', 1, 'One'),
            content: area('one-content', [
              richText('one-text', '<p>One</p>'),
              richText('w-a', '<p>Alpha</p>')
            ])
          } ])
        ]),
        _lossless: false
      });

      const [ result ] = await revert([ req ]);

      assert.equal(result.outcome, 'putBack', JSON.stringify(result.rows));
      assert.deepEqual(result.rows.map(row => row.outcome), [ 'putBack', 'putBack' ]);
      const { main } = await find(page._id);
      assert.deepEqual(areaIds({ main }, 'main'), [ 'w-a', 'lay' ]);
      assert.deepEqual(main.items[1].columns.items.map(item => item._id), [ 'one', 'two' ]);
      assert.deepEqual(
        main.items[1].columns.items[0].content.items.map(item => item._id),
        [ 'one-text' ]
      );
    });

    it('should count a widget it added and someone removed since as reverted', async function () {
      const req = door();
      await write(req, page._id, {
        $push: { [`@${page.main._id}.items`]: richText('w-c', '<p>Charlie</p>') }
      });
      await write(userReq(), page._id, {
        $pullAllById: { [`@${page.main._id}.items`]: [ 'w-c' ] }
      });

      const [ result ] = await revert([ req ]);

      assert.equal(result.outcome, 'reverted');
    });
  });
});
