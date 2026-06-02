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
