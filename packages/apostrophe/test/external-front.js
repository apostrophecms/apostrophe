const t = require('../test-lib/test.js');
const assert = require('assert');

describe('External Front', function() {

  let apos;
  // Set env var so these tests work even if you have a dev key in your bashrc
  // etc.
  process.env.APOS_EXTERNAL_FRONT_KEY = 'this is a test external front key';

  this.timeout(t.timeout);

  after(function() {
    delete process.env.APOS_EXTERNAL_FRONT_KEY;
    return t.destroy(apos);
  });

  it('apostrophe should initialize normally', async function() {
    apos = await t.create({
      root: module,
      modules: {
        product: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'product'
          },
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
              extra: {
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

    assert(apos.page.__meta.name === '@apostrophecms/page');
  });

  // A doc as it would look in memory, with `extra` simulating an area field
  // added to the schema after the doc was created (so it has no value).
  function productMissingExtra() {
    const doc = apos.product.newInstance();
    doc._id = 'product1:en:published';
    doc.metaType = 'doc';
    doc.title = 'Product 1';
    doc.slug = 'product-1';
    delete doc.extra;
    return doc;
  }

  it('missingSchemaAreas returns unfilled area fields, ignores non-schema objects', function() {
    const missing = apos.template.missingSchemaAreas(productMissingExtra());
    assert.strictEqual(missing.length, 1);
    assert.strictEqual(missing[0].name, 'extra');

    // An area object carries `_edit` but has no schema manager: returns []
    // quietly (getManagerOf called with log: false).
    const area = {
      metaType: 'area',
      _edit: true
    };
    assert.deepStrictEqual(apos.template.missingSchemaAreas(area), []);
  });

  it('annotateDocForExternalFront materializes missing areas on an editable doc', async function() {
    const doc = productMissingExtra();
    doc._edit = true;
    // As loaded for an editor, existing areas carry _edit too
    doc.main._edit = true;

    await apos.template.annotateDocForExternalFront(doc);

    // Existing area still annotated, unchanged behavior
    assert(doc.main.field && doc.main.field.name === 'main');
    assert(doc.main.options);
    // Carries the provenance signal, and is never flagged as orphan
    assert.strictEqual(doc.main._aposAnnotated, true);
    assert.strictEqual(doc.main._isOrphan, undefined);

    // Missing area added as an empty, editable, annotated area
    assert(doc.extra, 'extra area was materialized');
    assert.strictEqual(doc.extra.metaType, 'area');
    assert.deepStrictEqual(doc.extra.items, []);
    assert.strictEqual(doc.extra._edit, true);
    assert.strictEqual(doc.extra._docId, doc._id);
    assert(doc.extra._id, 'has an id');
    assert(doc.extra.field && doc.extra.field.name === 'extra');
    assert(doc.extra.options, 'annotated with options');
    assert(Array.isArray(doc.extra.choices));
    assert.strictEqual(doc.extra._aposAnnotated, true);
    assert.strictEqual(doc.extra._isOrphan, undefined);
  });

  it('flags a genuine orphan area, leaves valid areas alone, and never persists the flag', async function() {
    // Insert a doc with an area whose field is no longer in the schema.
    const docId = 'orphan-test:en:draft';
    await apos.doc.db.deleteOne({ _id: docId });
    await apos.doc.db.insertOne({
      _id: docId,
      type: 'product',
      metaType: 'doc',
      aposMode: 'draft',
      aposDocId: 'orphan-test',
      aposLocale: 'en:draft',
      title: 'Orphan Test',
      slug: 'orphan-test',
      main: {
        metaType: 'area',
        _id: 'orphan-main',
        items: []
      },
      // `ghost` is not a field in the product schema (simulates a removed field)
      ghost: {
        metaType: 'area',
        _id: 'orphan-ghost',
        items: []
      }
    });

    const doc = await apos.doc.db.findOne({ _id: docId });
    doc._edit = true;
    doc.main._edit = true;
    doc.ghost._edit = true;

    await apos.template.annotateDocForExternalFront(doc);

    // The annotator owns the doc, so the orphan is flagged — and has no field.
    // It is NOT marked `_aposAnnotated` (that signals a fully annotated area).
    assert.strictEqual(doc.ghost._isOrphan, true, 'orphan flagged');
    assert.strictEqual(doc.ghost.field, undefined, 'orphan has no schema field');
    assert.strictEqual(doc.ghost._aposAnnotated, undefined, 'orphan is not _aposAnnotated');
    // The valid area is annotated normally and never flagged orphan.
    assert(doc.main.field && doc.main._isOrphan === undefined);
    assert.strictEqual(doc.main._aposAnnotated, true);

    // Neither flag is written to the database.
    const persisted = await apos.doc.db.findOne({ _id: docId });
    assert.strictEqual(persisted.ghost._isOrphan, undefined, 'flag not persisted');
    assert.strictEqual(persisted.main._isOrphan, undefined, 'flag not persisted');
    assert.strictEqual(persisted.main._aposAnnotated, undefined, 'signal not persisted');

    await apos.doc.db.deleteOne({ _id: docId });
  });

  it('annotateDocForExternalFront leaves missing areas alone on a non-editable doc', async function() {
    const doc = productMissingExtra();

    await apos.template.annotateDocForExternalFront(doc);

    assert.strictEqual(doc.extra, undefined, 'extra not added for anonymous');
    // Existing area annotated as before
    assert(doc.main.field && doc.main.field.name === 'main');
  });

  it('annotateDocForExternalFront persists materialized areas at their schema path with the same _id sent to the UI', async function() {
    // Insert a doc directly with only `main`, no `extra`, simulating a field
    // added to the schema after the doc was created.
    const docId = 'persist-test:en:draft';
    await apos.doc.db.deleteOne({ _id: docId });
    await apos.doc.db.insertOne({
      _id: docId,
      type: 'product',
      metaType: 'doc',
      aposMode: 'draft',
      aposDocId: 'persist-test',
      aposLocale: 'en:draft',
      title: 'Persist Test',
      slug: 'persist-test',
      main: {
        metaType: 'area',
        _id: 'main-id-persist',
        items: []
      }
    });

    // Load the doc and mark editable (mirroring what doc-type load does)
    const doc = await apos.doc.db.findOne({ _id: docId });
    doc._edit = true;
    doc.main._edit = true;

    await apos.template.annotateDocForExternalFront(doc);

    // In-memory: extra was materialized and annotated
    assert(doc.extra && doc.extra._id, 'extra has an id in memory');
    const inMemoryId = doc.extra._id;

    // In the DB: extra was written at the schema path with the same _id, so a
    // subsequent editor patch using @<inMemoryId>.items will resolve
    const persisted = await apos.doc.db.findOne({ _id: docId });
    assert(persisted.extra, 'extra was persisted');
    assert.strictEqual(persisted.extra.metaType, 'area');
    assert.deepStrictEqual(persisted.extra.items, []);
    assert.strictEqual(
      persisted.extra._id, inMemoryId,
      'persisted _id matches the one sent to the UI'
    );

    // Idempotent: a second annotate keeps the same persisted _id (the
    // $eq: null condition prevents overwrite)
    const doc2 = await apos.doc.db.findOne({ _id: docId });
    doc2._edit = true;
    delete doc2.extra; // simulate the missing-area branch firing again
    await apos.template.annotateDocForExternalFront(doc2);
    const persistedAgain = await apos.doc.db.findOne({ _id: docId });
    assert.strictEqual(
      persistedAgain.extra._id, inMemoryId,
      'persisted _id is unchanged on re-annotate'
    );

    await apos.doc.db.deleteOne({ _id: docId });
  });

  it('does not write missing areas at an in-memory path when a relationship target needs one (regression)', async function() {
    // The editor's in-memory graph contains loaded relationship data. A widget
    // in the host doc relates to a SEPARATE editable doc that is missing a
    // schema area (added after it was created). The area must be stubbed at the
    // related doc's OWN path — never at a path derived from the host's
    // in-memory traversal, which would write into the wrong document and pad
    // arrays with nulls. This reproduces the production corruption that left
    // null items and stray fragments in published docs.
    const hostId = 'reg-host:en:draft';
    const relatedId = 'reg-related:en:draft';
    await apos.doc.db.deleteMany({ _id: { $in: [ hostId, relatedId ] } });

    // Host has both areas filled (nothing missing of its own) and a single
    // rich-text widget in `main`.
    await apos.doc.db.insertOne({
      _id: hostId,
      type: 'product',
      metaType: 'doc',
      aposMode: 'draft',
      aposDocId: 'reg-host',
      aposLocale: 'en:draft',
      title: 'Host',
      slug: 'reg-host',
      main: {
        metaType: 'area',
        _id: 'reg-host-main',
        items: [
          {
            _id: 'reg-host-widget',
            metaType: 'widget',
            type: '@apostrophecms/rich-text',
            content: '<p>hi</p>'
          }
        ]
      },
      extra: {
        metaType: 'area',
        _id: 'reg-host-extra',
        items: []
      }
    });
    // Related has `main` but no `extra` (field added to the schema later).
    await apos.doc.db.insertOne({
      _id: relatedId,
      type: 'product',
      metaType: 'doc',
      aposMode: 'draft',
      aposDocId: 'reg-related',
      aposLocale: 'en:draft',
      title: 'Related',
      slug: 'reg-related',
      main: {
        metaType: 'area',
        _id: 'reg-related-main',
        items: []
      }
    });

    const hostStored = await apos.doc.db.findOne({ _id: hostId });

    // Build the in-memory graph: the host widget carries a loaded relationship
    // to the related doc, which is editable and missing `extra`.
    const related = await apos.doc.db.findOne({ _id: relatedId });
    related._edit = true;
    related._docId = relatedId;
    related.main._edit = true;
    delete related.extra;

    const host = await apos.doc.db.findOne({ _id: hostId });
    host._edit = true;
    host._docId = hostId;
    host.main._edit = true;
    host.main.items[0]._docId = hostId;
    host.main.items[0]._related = [ related ];

    await apos.template.annotateDocForExternalFront(host);

    // Related doc: `extra` stubbed at its OWN top-level path, clean, and its
    // existing `main` is untouched (no host-relative path leaked in).
    const relatedAfter = await apos.doc.db.findOne({ _id: relatedId });
    assert(relatedAfter.extra, 'extra stubbed on the related doc');
    assert.strictEqual(relatedAfter.extra.metaType, 'area');
    assert.deepStrictEqual(relatedAfter.extra.items, []);
    assert.strictEqual(relatedAfter.extra._id, related.extra._id, 'same _id as in memory');
    assert.strictEqual(relatedAfter.main.items.length, 0, 'related main not padded');
    assert.ok(!Object.prototype.hasOwnProperty.call(relatedAfter, '0'), 'no numeric-key fragment');

    // Host doc: completely untouched in the database.
    const hostAfter = await apos.doc.db.findOne({ _id: hostId });
    assert.strictEqual(hostAfter.main.items.length, 1, 'host main.items not extended');
    assert(
      hostAfter.main.items.every(i => i && i.metaType === 'widget'),
      'no null/typeless items in host'
    );
    assert.deepStrictEqual(hostAfter, hostStored, 'host doc unchanged in the DB');

    await apos.doc.db.deleteMany({ _id: { $in: [ hostId, relatedId ] } });
  });

  it('annotateAreaForExternalFront drops corrupt items so they never reach the front end', function() {
    const field = {
      name: 'main',
      options: {
        widgets: { '@apostrophecms/rich-text': {} }
      }
    };
    const area = {
      metaType: 'area',
      _id: 'guard-area',
      _docId: 'guard-doc:en:published',
      items: [
        {
          _id: 'w1',
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<p>ok</p>'
        },
        // The two shapes the production corruption produced. A `null` left in
        // place would crash the Astro area renderer (`...item._options`).
        null,
        {
          _id: 'frag',
          foo: 'bar'
        }
      ]
    };

    assert.doesNotThrow(() => {
      apos.template.annotateAreaForExternalFront(field, area, { scene: 'apos' });
    });

    // Corrupt items are removed; only the valid, annotated widget remains.
    assert.strictEqual(area.items.length, 1, 'corrupt items dropped');
    assert.strictEqual(area.items[0]._id, 'w1');
    assert(area.items[0]._options, 'valid widget annotated');
    assert.strictEqual(area.items[0]._docId, area._docId, 'valid widget got _docId');
  });

  it('annotateAreaForExternalFront keeps an unknown widget type un-annotated instead of throwing', function() {
    const field = {
      name: 'main',
      options: {
        widgets: { '@apostrophecms/rich-text': {} }
      }
    };
    const area = {
      metaType: 'area',
      _id: 'unknown-area',
      _docId: 'unknown-doc:en:published',
      items: [
        {
          _id: 'w1',
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<p>ok</p>'
        },
        // A real widget whose module is not registered (e.g. `custom-layout`).
        {
          _id: 'w2',
          metaType: 'widget',
          type: 'definitely-not-a-registered-widget'
        }
      ]
    };

    // No throw — a missing widget module must not 500 the whole render.
    assert.doesNotThrow(() => {
      apos.template.annotateAreaForExternalFront(field, area, { scene: 'apos' });
    });

    // The unknown widget is preserved (so its content survives a save) but left
    // un-annotated; the front end skips it.
    assert.strictEqual(area.items.length, 2, 'unknown-type item preserved');
    assert(area.items[0]._options, 'valid widget annotated');
    assert.strictEqual(area.items[1].type, 'definitely-not-a-registered-widget');
    assert.strictEqual(area.items[1]._options, undefined, 'unknown widget not annotated');
  });

  it('addMissingArea honors throwIfNotFound (tag behavior) and defaults to graceful (annotator)', async function() {
    // Doc-backed parent whose document is not in the database (the missing-doc
    // race the `{% area %}` tag historically treated as notfound).
    const ghost = {
      _id: 'ghost:en:published',
      metaType: 'doc',
      type: 'product'
    };

    // Opt-in (tag): throws notfound rather than persisting nothing silently.
    await assert.rejects(
      () => apos.area.addMissingArea(ghost, 'extra', { throwIfNotFound: true }),
      err => err && err.name === 'notfound'
    );
    // The in-memory stub is still attached for the caller.
    assert(ghost.extra && ghost.extra.metaType === 'area');

    // Default (annotator): degrades to an in-memory stub, never throws.
    const ghost2 = {
      _id: 'ghost2:en:published',
      metaType: 'doc',
      type: 'product'
    };
    const area = await apos.area.addMissingArea(ghost2, 'extra');
    assert.strictEqual(area.metaType, 'area');
    assert(area._id, 'in-memory stub has an _id');
    assert.deepStrictEqual(area.items, []);
    assert.strictEqual(ghost2.extra, area, 'stub attached to the parent');

    // A parent with no docId is never an error, even with throwIfNotFound.
    const unsaved = {
      metaType: 'doc',
      type: 'product'
    };
    const unsavedArea = await apos.area.addMissingArea(unsaved, 'extra', { throwIfNotFound: true });
    assert.strictEqual(unsavedArea.metaType, 'area');
  });

  it('fetch home with external front', async function() {
    const data = await await apos.http.get('/', {
      headers: {
        'x-requested-with': 'AposExternalFront',
        'apos-external-front-key': process.env.APOS_EXTERNAL_FRONT_KEY
      }
    });
    assert.strictEqual(typeof data, 'object');
    assert(data.page);
    assert(data.home);
    assert(data.page.slug === data.home.slug);
    assert(data.page.slug === '/');
  });

  it('fetch home normally', async function() {
    const data = await await apos.http.get('/', {});
    assert.strictEqual(typeof data, 'string');
    assert(data.includes('Home Page Template'));
  });
});
