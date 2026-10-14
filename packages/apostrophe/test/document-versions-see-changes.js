const assert = require('assert').strict;
const {
  t,
  moduleName,
  bootstrap,
  destroy,
  getReq,
  addUser,
  login,
  wait
} = require('./utils/document-versions.js');
const { modules, buildDoc } = require('./utils/document-versions-diff.js');

describe('Document Versions draft changes', function () {
  this.timeout(t.timeout);

  let apos;

  before(async function () {
    apos = await bootstrap({
      root: module,
      modules: {
        article: {},
        'default-page': {},
        'module-versions_false': {},
        'module-autopublish_true-versions_true': {},
        'module-localized_false-versions_true': {},
        ...modules
      }
    });
    // The fixture's documents relate to `topic1`, published so that the
    // relationship survives publishing
    const topic = await apos.modules.topic.insert(draftReq(), {
      title: 'Topic',
      aposDocId: 'topic1'
    });
    await apos.modules.topic.publish(draftReq(), topic);
  });

  after(async function () {
    await destroy(apos);
  });

  function draftReq(user = {}) {
    return getReq(apos, {
      mode: 'draft',
      ...user
    });
  }

  function ann() {
    return draftReq({
      _id: 'ann',
      title: 'Ann'
    });
  }

  function bob(extra = {}) {
    return Object.assign(draftReq({
      _id: 'bob',
      title: 'Bob'
    }), extra);
  }

  // A document of the nested fixture type, ready to insert
  function nestedDoc() {
    const {
      _id, aposDocId, aposLocale, aposMode, ...doc
    } = buildDoc();
    return doc;
  }

  function namesOf(row) {
    return row.path.map(segment => segment.name);
  }

  // The row whose path has these names
  function rowAt(rows, ...names) {
    return rows.find(row => namesOf(row).join('/') === names.join('/'));
  }

  // Whether a row is at or below the item with this `_id`
  function isAt(row, _id) {
    return namesOf(row).includes(_id);
  }

  function authorsOf(row) {
    return row.authors.map(author => author._id);
  }

  // Published as loaded, relationships included, as the editor publishes it
  async function insertPublished(manager, doc, req = ann()) {
    const inserted = await manager.insert(req, doc);
    const draft = await manager.find(req, { _id: inserted._id }).toObject();
    await manager.publish(req, draft);
    await wait(5);
    return draft;
  }

  async function saveAs(manager, req, draft) {
    await wait(5);
    return manager.update(req, draft);
  }

  describe('a published document edited in three versions by two authors', function () {
    const row0 = [ 'section', 'rows', 'root.section.rows.0' ];
    const widget0 = [ ...row0, 'content', 'root.section.rows.0.content.0' ];
    const richText = [ ...row0, 'content', 'root.section.rows.0.content.1' ];
    const opaque = [ ...row0, 'content', 'root.section.rows.0.content.2' ];
    let draft;
    let records;

    before(async function () {
      draft = await insertPublished(apos.nested, nestedDoc());
      const items = () => draft.section.rows[0].content.items;

      draft.title = 'Ann title';
      draft.subtitle = 'Changed and changed back';
      draft.section.rows[0].title = 'Row title by Ann';
      draft.section.rows[0].body = '<p>Body by Ann</p>';
      items()[1].content = '<p>Rich text by Ann</p>';
      items().push({
        _id: 'card-new',
        metaType: 'widget',
        type: 'card',
        kind: 'one',
        note: 'Added and deleted'
      });
      draft = await saveAs(apos.nested, ann(), draft);

      draft.title = 'Bob title';
      items()[0].title = 'Widget title by Bob';
      items()[0].section.title = 'Object in widget by Bob';
      items()[2].payload = { n: 2 };
      draft = await saveAs(apos.nested, bob({ aposAi: true }), draft);

      draft.subtitle = '';
      draft.section.title = 'Section title by Ann';
      draft.section.rows.reverse();
      draft.section.rows[1].content.items = draft.section.rows[1].content.items
        .filter(item => ![ opaque.at(-1), 'card-new' ].includes(item._id));
      draft = await saveAs(apos.nested, ann(), draft);

      // Ahead of its newest version
      const skip = ann();
      skip.aposSkipVersion = true;
      draft.count = 42;
      draft = await saveAs(apos.nested, skip, draft);

      const timeline = await apos.docVersions.find(draftReq(), {
        docId: draft.aposDocId,
        locale: 'en'
      }, {
        sort: { createdAt: 1 }
      });
      const publication = timeline.findLastIndex(record => record.mode === 'published');
      records = timeline.slice(publication + 1);
    });

    it('should compare the published document with the draft', async function () {
      const { rows, baseline } = await apos.docVersions.getDraftChanges(ann(), draft._id);
      const published = await apos.doc.db.findOne({
        _id: draft._id.replace(':draft', ':published')
      });

      assert.deepEqual(baseline, {
        kind: 'published',
        at: published.lastPublishedAt
      });
      assert.equal(records.length, 3);
      assert.deepEqual(
        rows.map(row => namesOf(row).join('/')),
        [
          'title',
          'count',
          'section/title',
          'section/rows',
          [ ...row0, 'title' ].join('/'),
          [ ...row0, 'body' ].join('/'),
          [ ...widget0, 'title' ].join('/'),
          [ ...widget0, 'section', 'title' ].join('/'),
          richText.join('/'),
          opaque.join('/')
        ]
      );
      const title = rowAt(rows, 'title');
      assert.equal(title.old, 'Title root');
      assert.equal(title.new, 'Bob title');
    });

    it('should leave out a path changed back, and an item added and deleted', async function () {
      const { rows } = await apos.docVersions.getDraftChanges(ann(), draft._id);

      assert.equal(rowAt(rows, 'subtitle'), undefined);
      assert.equal(rows.some(row => isAt(row, 'card-new')), false);
    });

    it('should credit everyone who changed a path, oldest first, at the newest change', async function () {
      const { rows } = await apos.docVersions.getDraftChanges(ann(), draft._id);
      const title = rowAt(rows, 'title');
      const [ , byBob, last ] = records;

      assert.deepEqual(title.authors, [
        {
          _id: 'ann',
          title: 'Ann'
        },
        {
          _id: 'bob',
          title: 'Bob'
        }
      ]);
      assert.deepEqual(title.changedAt, byBob.updatedAt || byBob.createdAt);
      assert.deepEqual(authorsOf(rowAt(rows, 'section', 'title')), [ 'ann' ]);
      assert.deepEqual(
        rowAt(rows, 'section', 'title').changedAt,
        last.updatedAt || last.createdAt
      );
    });

    it('should carry AI\'s part in each change', async function () {
      const { rows } = await apos.docVersions.getDraftChanges(ann(), draft._id);

      assert.equal(rowAt(rows, 'title').ai, 'changed');
      assert.equal(rowAt(rows, ...widget0, 'title').ai, 'changed');
      assert.deepEqual(authorsOf(rowAt(rows, ...widget0, 'title')), [ 'bob' ]);
      assert.equal(rowAt(rows, 'section', 'title').ai, false);
      const deleted = rowAt(rows, ...opaque);
      assert.equal(deleted.ai, 'assisted');
      assert.deepEqual(authorsOf(deleted), [ 'bob', 'ann' ]);
    });

    it('should credit no one for a change no version explains', async function () {
      const { rows } = await apos.docVersions.getDraftChanges(ann(), draft._id);
      const count = rowAt(rows, 'count');

      assert.deepEqual(count.authors, []);
      assert.equal(count.changedAt, undefined);
      assert.equal(count.new, 42);
    });

    it('should report a deleted widget as one row', async function () {
      const { rows } = await apos.docVersions.getDraftChanges(ann(), draft._id);
      const deleted = rowAt(rows, ...opaque);

      assert.equal(deleted.type, 'deleted');
      assert.equal(deleted.kind, 'widget');
      assert.equal(deleted.patchKey, '@root.section.rows.0.content.2');
      assert.equal(deleted.widgetType, 'opaque');
      assert.equal(rows.filter(row => isAt(row, opaque.at(-1))).length, 1);
    });

    it('should give each row the key a patch sets its value with', async function () {
      const { rows } = await apos.docVersions.getDraftChanges(ann(), draft._id);

      assert.equal(rowAt(rows, 'title').patchKey, 'title');
      assert.equal(rowAt(rows, 'title').fieldId, 'doc.nested.title');
      assert.equal(rowAt(rows, 'section', 'title').patchKey, 'section.title');
      assert.equal(
        rowAt(rows, ...row0, 'title').patchKey,
        '@root.section.rows.0.title'
      );
      assert.equal(
        rowAt(rows, ...widget0, 'title').patchKey,
        '@root.section.rows.0.content.0.title'
      );
      assert.equal(rowAt(rows, ...widget0, 'title').fieldId, 'widget.nested-2.title');
      // The object inside the widget has no `_id`: keyed from the widget
      assert.equal(
        rowAt(rows, ...widget0, 'section', 'title').patchKey,
        '@root.section.rows.0.content.0.section.title'
      );
      const content = rowAt(rows, ...richText);
      assert.equal(content.patchKey, '@root.section.rows.0.content.1.content');
      assert.equal(content.widgetType, '@apostrophecms/rich-text');
      assert.deepEqual(content.widgetOptions, {});
      assert.equal(content.fieldId, 'doc.nested.section.rows.content');
    });

    it('should give no key to the order of an array', async function () {
      const { rows } = await apos.docVersions.getDraftChanges(ann(), draft._id);
      const order = rowAt(rows, 'section', 'rows');

      assert.equal(order.kind, 'array');
      assert.equal(order.patchKey, undefined);
    });

    it('should mark a rich text field and the words of a string', async function () {
      const { rows } = await apos.docVersions.getDraftChanges(ann(), draft._id);
      const body = rowAt(rows, ...row0, 'body');

      assert.match(body.markedHtml, /<ins data-apos-version-change="added">/);
      assert.ok(rowAt(rows, 'title').diff.some(part => part.change === 'added'));
      assert.equal(rowAt(rows, 'title').markedHtml, undefined);
    });

    it('should count the rows as the change list does', async function () {
      const { rows, counts } = await apos.docVersions.getDraftChanges(ann(), draft._id);

      assert.deepEqual(counts, {
        added: 0,
        modified: rows.length - 1,
        deleted: 1,
        ai: rows.filter(row => row.ai).length
      });
    });

    it('should annotate the draft with the changes on request', async function () {
      const plain = await apos.docVersions.getDraftChanges(ann(), draft._id);
      const { doc } = await apos.docVersions.getDraftChanges(ann(), draft._id, {
        annotate: true
      });
      const items = doc.section.rows
        .find(row => row._id === 'root.section.rows.0').content.items;
      const deleted = items.find(item => item._id === opaque.at(-1));

      assert.equal(plain.doc, undefined);
      assert.equal(deleted._deleted, true);
      assert.equal(deleted._changedWithAi, 'assisted');
      assert.equal(doc.aposMeta.title['@apostrophecms/document-versions:ai'], 'changed');
    });
  });

  it('should credit no one when no version was recorded since the publication', async function () {
    let draft = await insertPublished(apos.nested, nestedDoc());
    const skip = bob();
    skip.aposSkipVersion = true;
    draft.title = 'Changed with no version';
    draft = await saveAs(apos.nested, skip, draft);

    const { rows } = await apos.docVersions.getDraftChanges(ann(), draft._id);

    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].authors, []);
    assert.equal(rows[0].changedAt, undefined);
  });

  it('should compare a document never published with a new one of its type', async function () {
    let draft = await apos.nested.insert(ann(), {
      ...apos.nested.newInstance(),
      title: 'Never published'
    });
    draft.subtitle = 'By Bob';
    draft.count = 7;
    draft = await saveAs(apos.nested, bob({ aposAi: true }), draft);

    const { rows, baseline } = await apos.docVersions.getDraftChanges(ann(), draft._id);

    assert.deepEqual(baseline, { kind: 'default' });
    assert.equal(rowAt(rows, 'title').old, '');
    assert.equal(rowAt(rows, 'title').type, 'added');
    assert.deepEqual(authorsOf(rowAt(rows, 'title')), [ 'ann' ]);
    assert.equal(rowAt(rows, 'subtitle').old, '');
    assert.equal(rowAt(rows, 'count').old, apos.nested.newInstance().count);
    assert.equal(rowAt(rows, 'count').ai, 'changed');
    assert.deepEqual(authorsOf(rowAt(rows, 'count')), [ 'bob' ]);
  });

  it('should key a relationship by its field name', async function () {
    const related = await apos.article.insert(ann(), { title: 'Related' });
    let draft = await insertPublished(apos.article, { title: 'Relating' });
    draft._related = [ related ];
    draft = await saveAs(apos.article, ann(), draft);

    const { rows } = await apos.docVersions.getDraftChanges(ann(), draft._id);

    assert.equal(rowAt(rows, '_related').kind, 'relationship');
    assert.equal(rowAt(rows, '_related').patchKey, '_related');
  });

  describe('patch keys', function () {
    function article(extra) {
      return {
        title: 'Keys',
        object: {
          _id: 'obj1',
          metaType: 'objectItem',
          key1: 'One'
        },
        array: [ {
          _id: 'item1',
          metaType: 'arrayItem',
          label: 'Label',
          value: 'One'
        } ],
        ...extra
      };
    }

    function richText(_id, content) {
      return {
        _id,
        metaType: 'widget',
        type: '@apostrophecms/rich-text',
        content
      };
    }

    async function editKeys(doc) {
      let draft = await insertPublished(apos.article, doc);
      draft.object.key1 = 'Two';
      draft.array[0].value = 'Two';
      draft = await saveAs(apos.article, ann(), draft);
      return (await apos.docVersions.getDraftChanges(ann(), draft._id)).rows;
    }

    it('should key a field of an object from the object when its _id is unique', async function () {
      const rows = await editKeys(article());

      assert.equal(rowAt(rows, 'object', 'key1').patchKey, '@obj1.key1');
      assert.equal(rowAt(rows, 'array', 'item1', 'value').patchKey, '@item1.value');
    });

    it('should key a field of an object without an _id from above it', async function () {
      const doc = article();
      delete doc.object._id;
      const rows = await editKeys(doc);

      assert.equal(rowAt(rows, 'object', 'key1').patchKey, 'object.key1');
    });

    it('should not key below an _id the draft holds twice', async function () {
      const doc = article();
      doc.object._id = 'same';
      doc.array[0]._id = 'same';
      const rows = await editKeys(doc);

      assert.equal(rowAt(rows, 'object', 'key1').patchKey, 'object.key1');
      assert.equal(rowAt(rows, 'array', 'same', 'value').patchKey, undefined);
    });

    it('should not key a field of an array item without an _id', async function () {
      const draft = await insertPublished(apos.article, article());
      // Saves give array items an _id: write it as raw data would
      await apos.doc.db.updateOne({ _id: draft._id }, {
        $set: { 'array.0.value': 'Two' },
        $unset: { 'array.0._id': 1 }
      });
      await apos.doc.db.updateOne({ _id: draft._id.replace(':draft', ':published') }, {
        $unset: { 'array.0._id': 1 }
      });

      const { rows } = await apos.docVersions.getDraftChanges(ann(), draft._id);
      const value = rows.find(row => row.path.at(-1).name === 'value');

      assert.equal(value.path.at(-2).name, undefined);
      assert.equal(value.patchKey, undefined);
    });

    it('should not key a widget whose _id the stored draft holds twice', async function () {
      let draft = await insertPublished(apos.article, article({
        main: {
          _id: 'main1',
          metaType: 'area',
          items: [
            richText('w1', '<p>One</p>'),
            richText('w2', '<p>Two</p>')
          ]
        }
      }));
      draft.main.items[0].content = '<p>One, edited</p>';
      draft = await saveAs(apos.article, ann(), draft);
      // Saves replace a reused widget _id: write it as raw data would
      await apos.doc.db.updateOne({ _id: draft._id }, {
        $set: { 'main.items.1._id': 'w1' }
      });

      const { rows } = await apos.docVersions.getDraftChanges(ann(), draft._id);
      const onW1 = rows.filter(row => isAt(row, 'w1'));

      assert.ok(onW1.length);
      assert.equal(onW1.some(row => row.patchKey), false);
      assert.equal(rowAt(rows, 'main', 'w2').type, 'deleted');
      assert.equal(rowAt(rows, 'main', 'w2').patchKey, '@w2');
    });

    it('should not key a deleted item whose _id the draft holds elsewhere', async function () {
      let draft = await insertPublished(apos.article, article());
      draft.array = [];
      draft.object._id = 'item1';
      draft = await saveAs(apos.article, ann(), draft);

      const { rows } = await apos.docVersions.getDraftChanges(ann(), draft._id);

      assert.equal(rowAt(rows, 'array', 'item1').type, 'deleted');
      assert.equal(rowAt(rows, 'array', 'item1').patchKey, undefined);
    });

    it('should key both sides of a widget whose _id differs from the published one', async function () {
      // As an import from an environment whose content diverged leaves it
      let draft = await insertPublished(apos.article, article({
        main: {
          _id: 'main1',
          metaType: 'area',
          items: [ richText('w-published', '<p>Same</p>') ]
        }
      }));
      draft.main.items = [ richText('w-imported', '<p>Same</p>') ];
      draft = await saveAs(apos.article, ann(), draft);

      const { rows } = await apos.docVersions.getDraftChanges(ann(), draft._id);

      assert.equal(rowAt(rows, 'main', 'w-published').type, 'deleted');
      assert.equal(rowAt(rows, 'main', 'w-published').patchKey, '@w-published');
      assert.equal(rowAt(rows, 'main', 'w-imported').type, 'added');
      assert.equal(rowAt(rows, 'main', 'w-imported').patchKey, '@w-imported');
    });
  });

  describe('refusals', function () {
    for (const type of [
      'module-versions_false',
      'module-autopublish_true-versions_true',
      'module-localized_false-versions_true'
    ]) {
      it(`should refuse a ${type} document, which has no draft versions`, async function () {
        const manager = apos.doc.getManager(type);
        const doc = await manager.insert(ann(), {
          ...manager.newInstance(),
          title: type
        });

        await assert.rejects(
          apos.docVersions.getDraftChanges(ann(), doc._id),
          { name: 'notfound' }
        );
      });
    }

    it('should refuse a malformed id', async function () {
      await assert.rejects(
        apos.docVersions.getDraftChanges(ann(), ''),
        { name: 'invalid' }
      );
    });

    it('should refuse a document the request cannot edit', async function () {
      const draft = await insertPublished(apos.article, { title: 'Not yours' });

      await assert.rejects(
        apos.docVersions.getDraftChanges(apos.task.getAnonReq(), draft._id),
        { name: 'notfound' }
      );
    });
  });

  describe('GET /draft-changes', function () {
    let jar;
    let draft;

    before(async function () {
      await addUser(apos, 'admin');
      jar = await login(apos, 'admin');
      draft = await insertPublished(apos.article, { title: 'Over HTTP' });
      draft.title = 'Over HTTP, edited';
      draft = await saveAs(apos.article, ann(), draft);
    });

    it('should return the draft changes', async function () {
      const result = await apos.http.get(`/api/v1/${moduleName}/draft-changes`, {
        qs: { docId: draft._id },
        jar
      });

      assert.equal(result.baseline.kind, 'published');
      assert.equal(result.doc, undefined);
      assert.deepEqual(result.rows.map(row => row.patchKey), [ 'title' ]);
      assert.equal(result.rows[0].oldText, 'Over HTTP');
      assert.deepEqual(result.rows[0].authors, [ {
        _id: 'ann',
        title: 'Ann'
      } ]);
      assert.equal(typeof result.rows[0].changedAt, 'string');
      assert.equal(result.counts.modified, 1);
    });

    it('should return the annotated draft with annotate=1', async function () {
      const result = await apos.http.get(`/api/v1/${moduleName}/draft-changes`, {
        qs: {
          docId: draft._id,
          annotate: 1
        },
        jar
      });

      assert.equal(result.doc.title, 'Over HTTP, edited');
      assert.equal(result.doc.aposMeta.title['@apostrophecms/schema:highlight'], true);
    });

    it('should answer 400 without a docId and 404 to a visitor', async function () {
      await assert.rejects(
        apos.http.get(`/api/v1/${moduleName}/draft-changes`, { jar }),
        { status: 400 }
      );
      await assert.rejects(
        apos.http.get(`/api/v1/${moduleName}/draft-changes`, {
          qs: { docId: draft._id }
        }),
        { status: 404 }
      );
    });
  });

  describe('the page in See Changes', function () {
    let page;

    before(async function () {
      const req = ann();
      const inserted = await apos.page.insert(req, '_home', 'lastChild', {
        title: 'Page in See Changes',
        type: 'default-page',
        main: {
          metaType: 'area',
          items: [ 'kept', 'deleted' ].map(_id => ({
            _id,
            metaType: 'widget',
            type: '@apostrophecms/rich-text',
            content: `<p>The ${_id} paragraph.</p>`
          }))
        }
      });
      page = await apos.page.find(req, { _id: inserted._id }).toObject();
      await apos.page.publish(req, page);
      await wait(5);
      page.main.items = page.main.items.filter(widget => widget._id !== 'deleted');
      page.title = 'Page in See Changes, edited';
      await saveAs(apos.page, req, page);
    });

    // The page as `serve` loads it, after `beforeSend` with `query`
    async function beforeSend(query) {
      const req = draftReq();
      req.query = query;
      req.data.page = await apos.page.find(req, { _id: page._id }).toObject();
      await apos.page.emit('beforeSend', req);
      return req.data.page;
    }

    it('should show the draft marked with its changes, deleted widgets back in place', async function () {
      const shown = await beforeSend({
        aposEdit: '1',
        aposSeeChanges: '1'
      });

      assert.deepEqual(shown.main.items.map(widget => widget._id), [ 'kept', 'deleted' ]);
      assert.equal(shown.main.items[1]._deleted, true);
      assert.equal(shown.main._edit, true);
      assert.equal(shown.title, 'Page in See Changes, edited');
      assert.equal(typeof shown._url, 'string');
    });

    it('should show the draft as it is without edit mode or the flag', async function () {
      for (const query of [ { aposSeeChanges: '1' }, { aposEdit: '1' } ]) {
        const shown = await beforeSend(query);

        assert.deepEqual(shown.main.items.map(widget => widget._id), [ 'kept' ]);
      }
    });
  });
});
