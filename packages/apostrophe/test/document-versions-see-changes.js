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
        ...modules,
        blank: {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              flag: { type: 'boolean' },
              tags: {
                type: 'checkboxes',
                choices: [ {
                  label: 'One',
                  value: 'one'
                } ]
              },
              items: {
                type: 'array',
                fields: {
                  add: {
                    label: { type: 'string' }
                  }
                }
              },
              code: {
                type: 'string',
                required: true
              },
              meta: {
                type: 'object',
                fields: {
                  add: {
                    ref: {
                      type: 'string',
                      required: true
                    },
                    on: { type: 'boolean' }
                  }
                }
              },
              note: {
                type: 'string',
                required: true,
                if: { flag: true }
              }
            }
          }
        },
        // Relates to stories from inside a widget
        'story-link-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            label: 'Story link'
          },
          fields: {
            add: {
              caption: { type: 'string' },
              // Kept out of every editor
              token: {
                type: 'string',
                hidden: true
              },
              // Not an editor's to change
              secret: {
                type: 'string',
                editPermission: {
                  action: 'edit',
                  type: '@apostrophecms/user'
                }
              },
              inner: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {},
                    embed: {}
                  }
                }
              },
              _stories: {
                type: 'relationship',
                withType: 'story',
                fields: {
                  add: {
                    note: { type: 'string' }
                  }
                }
              }
            }
          }
        },
        // Stores its code outside its schema, and keeps it through a save with
        // its own `sanitize`
        'embed-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            label: 'Embed'
          },
          fields: {
            add: {
              caption: { type: 'string' }
            }
          },
          extendMethods(self) {
            return {
              async sanitize(_super, req, input, ...rest) {
                const output = await _super(req, input, ...rest);
                output.code = self.apos.launder.string(input.code);
                return output;
              }
            };
          }
        },
        // Edited on the page by its own editor, its styles in a form
        'headline-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            label: 'Headline',
            contextual: true
          },
          fields: {
            add: {
              heading: { type: 'string' }
            }
          },
          styles: {
            add: {
              alignment: 'alignment'
            }
          }
        },
        story: {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {},
                    'story-link': {},
                    opaque: {},
                    embed: {},
                    headline: {},
                    '@apostrophecms/layout': {}
                  }
                }
              },
              items: {
                type: 'array',
                fields: {
                  add: {
                    label: { type: 'string' },
                    secret: {
                      type: 'string',
                      editPermission: {
                        action: 'edit',
                        type: '@apostrophecms/user'
                      }
                    },
                    stamp: {
                      type: 'string',
                      hidden: true
                    }
                  }
                }
              },
              // Kept out of every editor
              stamp: {
                type: 'string',
                hidden: true
              },
              _stories: {
                type: 'relationship',
                withType: 'story',
                fields: {
                  add: {
                    note: { type: 'string' }
                  }
                }
              },
              flag: { type: 'boolean' },
              note: {
                type: 'string',
                required: true,
                if: { flag: true }
              },
              locked: {
                type: 'string',
                readOnly: true
              }
            }
          }
        }
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

    it('should key the order of an array as the array itself', async function () {
      const { rows } = await apos.docVersions.getDraftChanges(ann(), draft._id);
      const order = rowAt(rows, 'section', 'rows');

      assert.equal(order.kind, 'array');
      assert.equal(order.patchKey, 'section.rows');
      assert.equal(order.fieldId, 'doc.nested.section.rows');
      assert.equal(order.listKey, undefined);
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

  it('should compare a document never published with a new one as a save stores it', async function () {
    const req = ann();
    const doc = apos.modules.blank.newInstance();
    await apos.modules.blank.convert(req, {
      title: 'Saved with no input',
      code: 'C1',
      meta: { ref: 'R1' }
    }, doc);
    const draft = await apos.modules.blank.insert(req, doc);

    const { rows } = await apos.docVersions.getDraftChanges(req, draft._id);

    assert.deepEqual(rows.map(row => namesOf(row).join('/')).sort(), [ 'code', 'meta/ref', 'slug', 'title' ]);
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

  describe('restore', function () {
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

    function storyLink(_id, stories) {
      return {
        _id,
        metaType: 'widget',
        type: 'story-link',
        caption: 'Caption',
        secret: '',
        token: '',
        _stories: stories
      };
    }

    // Applies `patch` to the draft as the PATCH route does
    async function patchDraft(_id, patch) {
      return apos.modules.story.convertPatchAndRefresh(ann(), {
        _patches: [ patch ]
      }, _id);
    }

    // Saves a patch of a row's `restore` as the browser sends it
    async function apply(_id, patch) {
      return patchDraft(_id, JSON.parse(JSON.stringify(patch)));
    }

    async function rowsOf(_id) {
      return (await apos.docVersions.getDraftChanges(ann(), _id)).rows;
    }

    async function stored(_id) {
      return apos.doc.db.findOne({ _id });
    }

    function idsOf(area) {
      return area.items.map(item => item._id);
    }

    // A published story whose draft `edit` changes, its rows computed
    async function edited(doc, edit) {
      let draft = await insertPublished(apos.modules.story, {
        title: 'Story',
        ...doc
      });
      edit(draft);
      draft = await saveAs(apos.modules.story, ann(), draft);
      return {
        draft,
        rows: await rowsOf(draft._id)
      };
    }

    function storiesStorage(manager) {
      return manager.schema.find(field => field.name === '_stories');
    }

    it('should put a value back and keep the other changes', async function () {
      const { draft, rows } = await edited({
        items: [ {
          _id: 'item1',
          label: 'One'
        } ]
      }, draft => {
        draft.title = 'Story, edited';
        draft.items[0].label = 'Uno';
      });
      const title = rowAt(rows, 'title');

      assert.deepEqual(title.restore, {
        patch: { title: 'Story' },
        inverse: { title: 'Story, edited' }
      });
      await apply(draft._id, title.restore.patch);

      const after = await rowsOf(draft._id);
      assert.equal((await stored(draft._id)).title, 'Story');
      assert.equal(rowAt(after, 'title'), undefined);
      assert.equal(rowAt(after, 'items', 'item1', 'label').new, 'Uno');

      await apply(draft._id, title.restore.inverse);
      assert.equal(rowAt(await rowsOf(draft._id), 'title').new, 'Story, edited');
    });

    it('should put a deleted widget back before the next one the draft still has, its relationship with it', async function () {
      const other = await apos.modules.story.insert(ann(), { title: 'Linked' });
      const { draft, rows } = await edited({
        main: area('main1', [
          richText('a', '<p>A</p>'),
          storyLink('link', [ {
            ...other,
            _fields: { note: 'Pinned' }
          } ]),
          richText('c', '<p>C</p>')
        ])
      }, draft => {
        draft.main.items = draft.main.items.filter(item => item._id !== 'link');
      });
      const { restore } = rowAt(rows, 'main', 'link');

      const { idsStorage, fieldsStorage } = storiesStorage(apos.modules['story-link-widget']);
      const pushed = restore.patch.$push['@main1.items'];
      assert.equal(pushed.$before, 'c');
      // The related document by `_id` and fields only, as a save reads it
      assert.deepEqual(pushed.$each[0]._stories, [ {
        _id: other._id,
        _fields: { note: 'Pinned' }
      } ]);
      assert.equal(idsStorage in pushed.$each[0], false);
      assert.deepEqual(restore.inverse, { $pullAllById: { '@main1.items': [ 'link' ] } });
      await apply(draft._id, restore.patch);

      const link = (await stored(draft._id)).main.items[1];
      assert.deepEqual(idsOf((await stored(draft._id)).main), [ 'a', 'link', 'c' ]);
      assert.deepEqual(link[idsStorage], [ other.aposDocId ]);
      assert.deepEqual(link[fieldsStorage], { [other.aposDocId]: { note: 'Pinned' } });
      assert.equal(rowAt(await rowsOf(draft._id), 'main', 'link'), undefined);

      await apply(draft._id, restore.inverse);
      assert.deepEqual(idsOf((await stored(draft._id)).main), [ 'a', 'c' ]);
    });

    it('should take an added widget out, and its inverse put it back where it was', async function () {
      const { draft, rows } = await edited({
        main: area('main1', [ richText('a', '<p>A</p>'), richText('c', '<p>C</p>') ])
      }, draft => {
        draft.main.items.splice(1, 0, richText('added', '<p>Added</p>'));
      });
      const { restore } = rowAt(rows, 'main', 'added');

      assert.deepEqual(restore.patch, { $pullAllById: { '@main1.items': [ 'added' ] } });
      await apply(draft._id, restore.patch);
      assert.deepEqual(idsOf((await stored(draft._id)).main), [ 'a', 'c' ]);
      assert.equal((await rowsOf(draft._id)).length, 0);

      assert.equal(restore.inverse.$push['@main1.items'].$before, 'c');
      await apply(draft._id, restore.inverse);
      assert.deepEqual(idsOf((await stored(draft._id)).main), [ 'a', 'added', 'c' ]);
    });

    it('should restore in an area nested in a widget, and in an array', async function () {
      const link = storyLink('link', []);
      link.inner = area('inner1', [ 'x', 'y', 'z' ].map(id => richText(id, `<p>${id}</p>`)));
      const { draft, rows } = await edited({
        main: area('main1', [ link ]),
        items: [ 'one', 'two' ].map(_id => ({
          _id,
          label: _id,
          secret: '',
          stamp: ''
        }))
      }, draft => {
        const { inner } = draft.main.items[0];
        inner.items = [ inner.items[0], inner.items[2] ];
        inner.items[0].content = '<p>x, edited</p>';
        draft.items = [ draft.items[1], {
          _id: 'three',
          label: 'three'
        } ];
      });
      const restores = [
        [ 'main', 'link', 'inner', 'y' ],
        [ 'main', 'link', 'inner', 'x' ],
        [ 'items', 'one' ],
        [ 'items', 'three' ]
      ].map(names => rowAt(rows, ...names).restore);

      assert.equal(restores[0].patch.$push['@inner1.items'].$before, 'z');
      assert.deepEqual(restores[1].patch, { '@x.content': '<p>x</p>' });
      assert.equal(restores[2].patch.$push.items.$before, 'two');
      assert.deepEqual(restores[3].patch, { $pullAllById: { items: [ 'three' ] } });
      for (const restore of restores) {
        await apply(draft._id, restore.patch);
      }

      const after = await stored(draft._id);
      assert.deepEqual(after.main.items[0].inner.items.map(item => item.content), [ '<p>x</p>', '<p>y</p>', '<p>z</p>' ]);
      assert.deepEqual(after.items.map(item => item._id), [ 'one', 'two' ]);
      assert.equal((await rowsOf(draft._id)).length, 0);
    });

    it('should put deleted widgets back in their order, one restore after the other', async function () {
      const { draft } = await edited({
        main: area('main1', [ 'a', 'b', 'c' ].map(id => richText(id, `<p>${id}</p>`)))
      }, draft => {
        draft.main.items = draft.main.items.filter(item => item._id === 'c');
      });

      for (const id of [ 'b', 'a' ]) {
        const { restore } = rowAt(await rowsOf(draft._id), 'main', id);
        await apply(draft._id, restore.patch);
      }

      assert.deepEqual(idsOf((await stored(draft._id)).main), [ 'a', 'b', 'c' ]);
    });

    it('should put a deleted widget back after the previous one, else at its index', async function () {
      const last = await edited({
        main: area('main1', [ richText('a', '<p>A</p>'), richText('b', '<p>B</p>') ])
      }, draft => {
        draft.main.items = draft.main.items.slice(0, 1);
      });
      const replaced = await edited({
        main: area('main2', [ richText('a', '<p>A</p>') ])
      }, draft => {
        draft.main.items = [ richText('x', '<p>X</p>') ];
      });

      const afterA = rowAt(last.rows, 'main', 'b').restore.patch.$push['@main1.items'];
      const atIndex = rowAt(replaced.rows, 'main', 'a').restore.patch.$push['@main2.items'];
      assert.equal(afterA.$after, 'a');
      assert.equal(atIndex.$position, 0);
      await apply(last.draft._id, { $push: { '@main1.items': afterA } });
      await apply(replaced.draft._id, { $push: { '@main2.items': atIndex } });

      assert.deepEqual(idsOf((await stored(last.draft._id)).main), [ 'a', 'b' ]);
      assert.deepEqual(idsOf((await stored(replaced.draft._id)).main), [ 'a', 'x' ]);
    });

    it('should restore the published content of a draft whose widget _ids diverged', async function () {
      // As an import from an environment whose content diverged leaves it
      const { draft } = await edited({
        main: area('main1', [ richText('p1', '<p>One</p>'), richText('p2', '<p>Two</p>') ])
      }, draft => {
        draft.main.items = [ richText('i1', '<p>One</p>'), richText('i2', '<p>Two</p>') ];
      });

      for (const id of [ 'p1', 'p2', 'i1', 'i2' ]) {
        const { restore } = rowAt(await rowsOf(draft._id), 'main', id);
        await apply(draft._id, restore.patch);
      }

      const { main } = await stored(draft._id);
      assert.deepEqual(idsOf(main), [ 'p1', 'p2' ]);
      assert.deepEqual(main.items.map(item => item.content), [ '<p>One</p>', '<p>Two</p>' ]);
      assert.equal((await rowsOf(draft._id)).length, 0);
    });

    it('should refuse a restore of a widget gone since the list was computed, writing nothing', async function () {
      let { draft, rows } = await edited({
        main: area('main1', [ richText('a', '<p>A</p>') ])
      }, draft => {
        draft.main.items[0].content = '<p>A, edited</p>';
      });
      const { restore } = rowAt(rows, 'main', 'a');
      draft.main.items = [];
      draft = await saveAs(apos.modules.story, ann(), draft);

      assert.deepEqual(restore.patch, { '@a.content': '<p>A</p>' });
      await assert.rejects(apply(draft._id, restore.patch), { name: 'invalid' });
      assert.deepEqual((await stored(draft._id)).main.items, []);
    });

    it('should put a relationship back with its fields', async function () {
      const pinned = await apos.modules.story.insert(ann(), { title: 'Pinned' });
      const other = await apos.modules.story.insert(ann(), { title: 'Other' });
      const { draft, rows } = await edited({
        _stories: [ {
          ...pinned,
          _fields: { note: 'Pinned' }
        } ]
      }, draft => {
        draft._stories = [ other ];
      });

      const { restore } = rowAt(rows, '_stories');
      assert.deepEqual(restore.patch, {
        _stories: [ {
          _id: pinned._id,
          _fields: { note: 'Pinned' }
        } ]
      });
      assert.deepEqual(restore.inverse, {
        _stories: [ {
          _id: other._id,
          _fields: {}
        } ]
      });
      await apply(draft._id, restore.patch);

      const { idsStorage, fieldsStorage } = storiesStorage(apos.modules.story);
      const after = await stored(draft._id);
      assert.deepEqual(after[idsStorage], [ pinned.aposDocId ]);
      assert.deepEqual(after[fieldsStorage], { [pinned.aposDocId]: { note: 'Pinned' } });
      assert.equal(rowAt(await rowsOf(draft._id), '_stories'), undefined);
    });

    it('should not restore a relationship to a document deleted since, nor a widget holding one', async function () {
      const gone = await apos.modules.story.insert(ann(), { title: 'Gone' });
      const { draft } = await edited({
        _stories: [ gone ],
        main: area('main1', [ storyLink('link', [ gone ]) ])
      }, draft => {
        draft._stories = [];
        draft.main.items = [];
      });
      await apos.doc.db.deleteMany({ aposDocId: gone.aposDocId });

      const rows = await rowsOf(draft._id);
      assert.equal(rowAt(rows, '_stories').type, 'deleted');
      assert.equal(rowAt(rows, '_stories').restore, undefined);
      assert.equal(rowAt(rows, 'main', 'link').type, 'deleted');
      assert.equal(rowAt(rows, 'main', 'link').restore, undefined);
    });

    it('should neither restore nor edit a read only field, and edit the order of an array whole, never restore it', async function () {
      const { draft } = await edited({
        items: [ 'one', 'two' ].map(_id => ({
          _id,
          label: _id
        }))
      }, draft => {
        draft.items.reverse();
      });
      // A save skips a read only field: write it as raw data would
      await apos.doc.db.updateOne({ _id: draft._id }, { $set: { locked: 'Changed' } });

      const rows = await rowsOf(draft._id);
      assert.equal(rowAt(rows, 'locked').patchKey, 'locked');
      assert.equal(rowAt(rows, 'locked').restore, undefined);
      assert.equal(rowAt(rows, 'locked').editable, undefined);
      assert.equal(rowAt(rows, 'items').kind, 'array');
      assert.equal(rowAt(rows, 'items').patchKey, 'items');
      assert.equal(rowAt(rows, 'items').editable, true);
      assert.equal(rowAt(rows, 'items').restore, undefined);
    });

    it('should neither restore nor edit for an editor a field the editor may not edit, and not restore a widget holding one', async function () {
      const link = storyLink('link', []);
      link.secret = 'Secret';
      const { draft } = await edited({
        main: area('main1', [ storyLink('kept', []), link ]),
        items: [ {
          _id: 'item1',
          label: 'One',
          secret: 'Secret'
        } ]
      }, draft => {
        const [ kept ] = draft.main.items;
        kept.caption = 'Caption, edited';
        kept.secret = 'Secret, edited';
        draft.main.items = [ kept ];
        draft.items[0].secret = 'Secret, edited';
      });
      const editor = draftReq({
        role: 'editor',
        _id: 'eve',
        title: 'Eve'
      });

      const { rows } = await apos.docVersions.getDraftChanges(editor, draft._id);
      const admins = await rowsOf(draft._id);
      const paths = [
        [ 'main', 'kept', 'secret' ],
        [ 'main', 'link' ],
        [ 'items', 'item1', 'secret' ]
      ];
      for (const names of paths) {
        assert.equal(rowAt(rows, ...names).restore, undefined, names.join('/'));
        assert.ok(rowAt(admins, ...names).restore, names.join('/'));
        assert.equal(rowAt(admins, ...names).editable, true, names.join('/'));
      }
      assert.ok(rowAt(rows, 'main', 'kept', 'caption').restore);
      // Edited where the path allows it, whatever the value holds
      assert.equal(rowAt(rows, 'main', 'kept', 'secret').editable, undefined);
      assert.equal(rowAt(rows, 'items', 'item1', 'secret').editable, undefined);
      assert.equal(rowAt(rows, 'main', 'link').editable, true);
      assert.equal(rowAt(rows, 'main', 'kept', 'caption').editable, true);
    });

    it('should put the default back in a document never published', async function () {
      const draft = await apos.modules.story.insert(ann(), {
        title: 'Story',
        items: [ {
          _id: 'item1',
          label: 'One'
        } ]
      });

      const rows = await rowsOf(draft._id);
      await apply(draft._id, rowAt(rows, 'items', 'item1').restore.patch);

      assert.deepEqual((await stored(draft._id)).items, []);
      assert.equal(rowAt(await rowsOf(draft._id), 'items', 'item1'), undefined);
    });

    function embed(_id, code, caption = '') {
      return {
        _id,
        metaType: 'widget',
        type: 'embed',
        caption,
        code
      };
    }

    it('should put back what a widget modified whole stores outside its schema, its fields as they are', async function () {
      const { draft, rows } = await edited({
        main: area('main1', [ embed('changed', 'One', 'Caption'), richText('c', '<p>C</p>') ])
      }, draft => {
        draft.main.items[0].code = 'Two';
        draft.main.items[0].caption = 'Edited';
      });
      const { restore } = rowAt(rows, 'main', 'changed');

      assert.equal(restore.patch['@changed'].code, 'One');
      assert.equal(restore.patch['@changed'].caption, 'Edited');
      assert.equal(restore.inverse['@changed'].code, 'Two');
      await apply(draft._id, restore.patch);

      const widget = (await stored(draft._id)).main.items[0];
      assert.equal(widget.code, 'One');
      assert.equal(widget.caption, 'Edited');
      const after = await rowsOf(draft._id);
      assert.equal(rowAt(after, 'main', 'changed'), undefined);
      assert.equal(rowAt(after, 'main', 'changed', 'caption').new, 'Edited');

      await apply(draft._id, restore.inverse);
      assert.equal((await stored(draft._id)).main.items[0].code, 'Two');
    });

    it('should put back a deleted widget and take out an added one with what they store outside their schema', async function () {
      const { draft, rows } = await edited({
        main: area('main1', [ embed('deleted', 'Held'), richText('c', '<p>C</p>') ])
      }, draft => {
        draft.main.items = [ draft.main.items[1], embed('added', 'New') ];
      });
      const deleted = rowAt(rows, 'main', 'deleted').restore;
      const added = rowAt(rows, 'main', 'added').restore;

      await apply(draft._id, deleted.patch);
      assert.deepEqual(idsOf((await stored(draft._id)).main), [ 'deleted', 'c', 'added' ]);
      assert.equal((await stored(draft._id)).main.items[0].code, 'Held');

      await apply(draft._id, added.patch);
      assert.deepEqual(idsOf((await stored(draft._id)).main), [ 'deleted', 'c' ]);
      await apply(draft._id, added.inverse);
      assert.equal((await stored(draft._id)).main.items[2].code, 'New');
    });

    it('should not restore a widget of a type its area does not allow, nor one holding such a widget', async function () {
      const card = _id => ({
        _id,
        metaType: 'widget',
        type: 'card'
      });
      const link = (_id, inner) => ({
        ...storyLink(_id, []),
        inner: area(`${_id}-inner`, [ inner ])
      });
      const { draft } = await edited({
        main: area('main1', [
          link('holding', embed('embed1', 'Kept')),
          link('keeping', embed('embed2', 'Kept')),
          richText('c', '<p>C</p>')
        ])
      }, draft => {
        draft.main.items = draft.main.items.slice(2);
      });
      // Allowed by the areas' options when they were written
      await apos.doc.db.updateOne({ _id: draft._id.replace(':draft', ':published') }, {
        $set: {
          'main.items.0.inner.items.0': card('card1'),
          'main.items.3': card('card2')
        }
      });

      const rows = await rowsOf(draft._id);
      assert.equal(rowAt(rows, 'main', 'holding').restore, undefined);
      assert.equal(rowAt(rows, 'main', 'card2').type, 'deleted');
      assert.equal(rowAt(rows, 'main', 'card2').restore, undefined);
      await apply(draft._id, rowAt(rows, 'main', 'keeping').restore.patch);
      assert.equal((await stored(draft._id)).main.items[0].inner.items[0].code, 'Kept');
    });

    it('should neither restore nor edit a field of a widget its area does not allow', async function () {
      const { draft } = await edited({
        main: area('main1', [ storyLink('link', []) ])
      }, () => {});
      // Allowed by the area's options when it was written
      const nested = caption => ({
        ...storyLink('nested', []),
        caption
      });
      await apos.doc.db.updateOne({ _id: draft._id.replace(':draft', ':published') }, {
        $set: { 'main.items.0.inner': area('link-inner', [ nested('One') ]) }
      });
      await apos.doc.db.updateOne({ _id: draft._id }, {
        $set: { 'main.items.0.inner': area('link-inner', [ nested('Two') ]) }
      });

      const rows = await rowsOf(draft._id);
      const row = rowAt(rows, 'main', 'link', 'inner', 'nested', 'caption');
      assert.equal(row.patchKey, '@nested.caption');
      assert.equal(row.editable, undefined);
      assert.equal(row.restore, undefined);
    });

    it('should leave out a widget of a type the site no longer has, and never anchor on it', async function () {
      const gone = _id => ({
        _id,
        metaType: 'widget',
        type: 'gone'
      });
      const link = (_id, inner) => ({
        ...storyLink(_id, []),
        inner: area(`${_id}-inner`, [ inner ])
      });
      const { draft } = await edited({
        main: area('main1', [
          richText('a', '<p>A</p>'),
          richText('deleted', '<p>Deleted</p>'),
          link('holding', embed('embed1', 'Kept')),
          richText('c', '<p>C</p>')
        ])
      }, draft => {
        draft.main.items = [ draft.main.items[0], draft.main.items[3] ];
      });
      // Left by a widget type removed from the project
      await apos.doc.db.updateOne({ _id: draft._id.replace(':draft', ':published') }, {
        $set: { 'main.items.2.inner.items.1': gone('gone1') }
      });
      await apos.doc.db.updateOne({ _id: draft._id }, {
        $set: {
          'main.items': [
            gone('gone2'),
            richText('a', '<p>A</p>'),
            richText('c', '<p>C</p>'),
            gone('gone3')
          ]
        }
      });

      const { rows, doc } = await apos.docVersions.getDraftChanges(ann(), draft._id, {
        annotate: true
      });
      assert.deepEqual(rows.map(row => namesOf(row).join('/')), [
        'main/deleted',
        'main/holding'
      ]);
      assert.deepEqual(rows.map(row => row.path.at(-1).ordinal), [ 2, 3 ]);
      // Back in place among the widgets the page shows
      const shown = doc.main.items.filter(item => item.type !== 'gone');
      assert.deepEqual(shown.map(item => item._id), [ 'a', 'deleted', 'holding', 'c' ]);

      const deleted = rowAt(rows, 'main', 'deleted').restore;
      assert.equal(deleted.patch.$push['@main1.items'].$before, 'c');
      await apply(draft._id, deleted.patch);
      await apply(draft._id, rowAt(rows, 'main', 'holding').restore.patch);
      const { main } = await stored(draft._id);
      assert.deepEqual(idsOf(main), [ 'a', 'deleted', 'holding', 'c' ]);
      assert.deepEqual(idsOf(main.items[2].inner), [ 'embed1' ]);
      assert.equal((await rowsOf(draft._id)).length, 0);
    });

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

    it('should show no change of what the system manages, and a holder changed only there as modified with nothing to restore or edit', async function () {
      const { draft: saved, rows } = await edited({
        stamp: 'old',
        items: [ 'a', 'b' ].map(_id => ({
          _id,
          label: _id,
          secret: '',
          stamp: 'old'
        })),
        main: area('main', [
          layout('lay', [ column('one', 1, 'One'), column('two', 7, 'Two') ]),
          {
            ...storyLink('link', []),
            token: 'old'
          },
          {
            ...storyLink('quiet', []),
            token: 'old'
          }
        ])
      }, draft => {
        const [ lay, link, quiet ] = draft.main.items;
        const [ one, two ] = lay.columns.items;
        one.colstart = 3;
        one.justify = 'center';
        one.content.items[0].content = '<p>One, edited</p>';
        two.colstart = 5;
        link.token = 'new';
        link.caption = 'Edited';
        quiet.token = 'new';
        draft.items[0].stamp = 'new';
        draft.items[1].stamp = 'new';
        draft.items[1].label = 'b, edited';
        draft.stamp = 'new';
      });

      assert.deepEqual(rows.map(row => namesOf(row).join('/')).sort(), [
        'items/a',
        'items/b/label',
        'main/lay/columns/one/content/one-text',
        'main/lay/columns/one/justify',
        'main/lay/columns/two',
        'main/link/caption',
        'main/quiet'
      ]);
      const { counts } = await apos.docVersions.getDraftChanges(ann(), saved._id);
      assert.equal(counts.modified, rows.length);
      for (const names of [
        [ 'items', 'a' ],
        [ 'main', 'lay', 'columns', 'two' ],
        [ 'main', 'quiet' ]
      ]) {
        const row = rowAt(rows, ...names);
        assert.equal(row.system, true);
        assert.equal(row.editable, undefined);
        assert.equal(row.restore, undefined);
        assert.equal(row.oldText, row.newText);
      }
      for (const names of [
        [ 'items', 'b', 'label' ],
        [ 'main', 'lay', 'columns', 'one', 'justify' ],
        [ 'main', 'lay', 'columns', 'one', 'content', 'one-text' ],
        [ 'main', 'link', 'caption' ]
      ]) {
        const row = rowAt(rows, ...names);
        assert.equal(row.system, undefined);
        assert.equal(row.editable, true);
        assert(row.restore);
      }
    });

    it('should not restore a column added or deleted alone, and restore a whole layout', async function () {
      const { rows } = await edited({
        main: area('main', [
          layout('lay', [ column('one', 1, 'One'), column('two', 7, 'Two') ])
        ])
      }, draft => {
        const [ lay ] = draft.main.items;
        lay.columns.items = [ lay.columns.items[0], column('three', 7, 'Three') ];
        draft.main.items.push(layout('more', [ column('four', 1, 'Four') ]));
      });

      for (const _id of [ 'two', 'three' ]) {
        const row = rowAt(rows, 'main', 'lay', 'columns', _id);
        assert.equal(row.kind, 'widget');
        assert.equal(row.editable, true);
        assert.equal(row.restore, undefined);
      }
      const more = rowAt(rows, 'main', 'more');
      assert.equal(more.type, 'added');
      assert(more.restore);
    });

    it('should give the rows a contextual widget edits the widget, its styles aside', async function () {
      const headline = (_id, heading) => ({
        _id,
        metaType: 'widget',
        type: 'headline',
        heading,
        alignment: 'left'
      });
      const { rows } = await edited({
        main: area('main', [
          headline('head', 'Old'),
          headline('gone', 'Gone'),
          richText('text', '<p>Old</p>'),
          storyLink('link', []),
          layout('lay', [ column('one', 1, 'One') ])
        ])
      }, draft => {
        const [ head, , text, link, lay ] = draft.main.items;
        head.heading = 'New';
        head.alignment = 'center';
        text.content = '<p>New</p>';
        link.caption = 'Edited';
        lay.columns.items[0].justify = 'center';
        lay.columns.items[0].content.items[0].content = '<p>One, edited</p>';
        draft.main.items = [ head, text, link, lay, headline('more', 'More') ];
      });

      const contextual = (_id, type) => ({
        patchKey: `@${_id}`,
        widgetType: type,
        widgetOptions: {}
      });
      assert.deepEqual(
        rowAt(rows, 'main', 'head', 'heading').contextual,
        contextual('head', 'headline')
      );
      assert.deepEqual(rowAt(rows, 'main', 'more').contextual, contextual('more', 'headline'));
      assert.deepEqual(
        rowAt(rows, 'main', 'text').contextual,
        contextual('text', '@apostrophecms/rich-text')
      );
      assert.deepEqual(
        rowAt(rows, 'main', 'lay', 'columns', 'one', 'content', 'one-text').contextual,
        contextual('one-text', '@apostrophecms/rich-text')
      );
      for (const names of [
        [ 'main', 'head', 'alignment' ],
        [ 'main', 'gone' ],
        [ 'main', 'link', 'caption' ],
        [ 'main', 'lay', 'columns', 'one', 'justify' ]
      ]) {
        assert.equal(rowAt(rows, ...names).contextual, undefined, names.join('/'));
      }
    });

    describe('over HTTP', function () {
      let jar;

      before(async function () {
        await addUser(apos, 'admin', { username: 'restorer' });
        jar = await login(apos, 'admin', { username: 'restorer' });
        // The CSRF cookie a write needs
        await apos.http.get('/', { jar });
      });

      it('should answer invalid with the field errors for a value the other fields forbid', async function () {
        // The note is required while the flag is on
        const { draft, rows } = await edited({}, draft => {
          draft.flag = true;
          draft.note = 'Noted';
        });
        const { restore } = rowAt(rows, 'note');

        const error = await apos.http.patch(`/api/v1/story/${draft._id}`, {
          body: { _patches: [ restore.patch ] },
          jar
        }).catch(error => error);

        assert.equal(error.status, 400);
        assert.equal(error.body.name, 'invalid');
        assert.equal(error.body.data.errors[0].path, 'note');
        assert.equal((await stored(draft._id)).note, 'Noted');
      });

      it('should refuse a strict patch that leaves the whole document invalid', async function () {
        // Valid in the draft: the note is required while the flag is on only
        const { draft, rows } = await edited({
          flag: true,
          note: 'Noted'
        }, draft => {
          draft.flag = false;
          draft.note = '';
        });
        const { restore } = rowAt(rows, 'flag');

        const error = await apos.http.patch(`/api/v1/story/${draft._id}`, {
          body: {
            _patches: [ {
              ...restore.patch,
              _strict: true
            } ]
          },
          jar
        }).catch(error => error);

        assert.equal(error.status, 400);
        assert.equal(error.body.name, 'invalid');
        assert.equal(error.body.data.errors[0].path, 'note');
        assert.equal((await stored(draft._id)).flag, false);

        // Not strict, the patch is checked for the flag alone and saves
        await apos.http.patch(`/api/v1/story/${draft._id}`, {
          body: { _patches: [ restore.patch ] },
          jar
        });
        const saved = await stored(draft._id);
        assert.equal(saved.flag, true);
        assert.equal(saved.note, '');
      });
    });
  });
});
