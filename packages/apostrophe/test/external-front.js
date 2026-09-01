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
        'test-widget': {
          extend: '@apostrophecms/widget-type',
          fields: {
            add: {
              heading: {
                type: 'string',
                label: 'Heading',
                wysiwyg: true
              }
            }
          }
        },
        product: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'product',
            // `title` comes from the base doc type, so there is no definition
            // of it here to put `wysiwyg: true` on
            wysiwygFields: [ 'title' ]
          },
          fields: {
            add: {
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {},
                    test: {}
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
              },
              body: {
                type: 'richText',
                label: 'Body',
                wysiwyg: true
              },
              blurb: {
                type: 'string',
                label: 'Blurb',
                wysiwyg: true
              },
              // A field type with an on-page editor, but the front end never
              // renders this one in place, so it is not opted in
              subtitle: {
                type: 'string',
                label: 'Subtitle'
              },
              wordCount: {
                type: 'integer',
                label: 'Word Count',
                wysiwyg: true
              },
              sections: {
                type: 'array',
                label: 'Sections',
                fields: {
                  add: {
                    caption: {
                      type: 'string',
                      label: 'Caption',
                      wysiwyg: true
                    }
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

  // A doc with something in every kind of field an external front might
  // render in place
  function productWithFields() {
    const doc = productMissingExtra();
    doc.body = '<p>the body</p>';
    doc.blurb = 'A blurb';
    doc.subtitle = 'A subtitle';
    doc.wordCount = 12;
    doc.sections = [
      {
        metaType: 'arrayItem',
        scopedArrayName: 'doc.product.sections',
        _id: 'section1',
        caption: 'The first caption'
      }
    ];
    return doc;
  }

  it('annotateDocForExternalFront renders the value of each opted in field', async function() {
    const doc = productWithFields();
    const req = apos.task.getAnonReq();

    await apos.template.annotateDocForExternalFront(doc, { req });

    const body = doc._wysiwygFields.body;
    assert(body, 'the body field is annotated');
    // Rendered on the server, because only the server can resolve the
    // permalinks of rich text, and only the server knows what a field type
    // added by a module makes of its value
    assert.strictEqual(body.rendered, '<p>the body</p>');
    assert.strictEqual(body.tag, 'div');
    assert(body.classes.includes('apos-wysiwyg-field--richText'));

    // A single line string is inline, and escaped, as it is on a page
    const blurb = doc._wysiwygFields.blurb;
    assert.strictEqual(blurb.tag, 'span');
    assert.strictEqual(blurb.rendered, 'A blurb');

    // Nobody is editing, so nothing to edit with: an anonymous visitor is
    // sent what it takes to display the field and not a byte more
    for (const field of [ body, blurb ]) {
      assert.deepStrictEqual(
        Object.keys(field).sort(),
        [ 'classes', 'rendered', 'tag' ]
      );
    }

    // Opting in a field type that has no on-page editor does nothing
    assert.strictEqual(doc._wysiwygFields.wordCount, undefined);
    assert.strictEqual(doc._wysiwygFields.main, undefined);
  });

  it('annotateDocForExternalFront annotates only the fields that opted in', async function() {
    const doc = productWithFields();
    const req = apos.task.getAnonReq();

    await apos.template.annotateDocForExternalFront(doc, { req });

    // A page of a real site has dozens of fields an external front will never
    // render in place — every SEO and Open Graph field, every slug. Annotating
    // them all costs more bytes than the page itself, so a field says so
    assert.strictEqual(doc._wysiwygFields.subtitle, undefined);
    assert.strictEqual(doc._wysiwygFields.slug, undefined);
    // And the value is still right there to be displayed either way
    assert.strictEqual(doc.subtitle, 'A subtitle');

    // A field the module opted in by name is annotated even though nothing
    // added a definition for it here
    assert.strictEqual(doc._wysiwygFields.title.rendered, 'Product 1');
    // ...without disturbing what it inherited
    const title = apos.product.schema.find(field => field.name === 'title');
    assert.strictEqual(title.required, true);
  });

  it('the wysiwygFields option rejects a name that is not in the schema', function() {
    // A typo here would otherwise be silent: the field simply would not be
    // editable in place, with nothing to say why
    assert.throws(
      () => apos.schema.compose(
        {
          addFields: [
            {
              name: 'real',
              type: 'string',
              label: 'Real'
            }
          ]
        },
        {
          __meta: { name: 'nonsense' },
          options: { wysiwygFields: [ 'noSuchField' ] }
        }
      ),
      {
        message: 'Module nonsense: the wysiwygFields option names noSuchField, which is not in the schema.'
      }
    );
  });

  it('annotateDocForExternalFront hands the editor what it needs when editing', async function() {
    const doc = productWithFields();
    doc._edit = true;
    doc.sections[0]._edit = true;
    doc.sections[0]._docId = doc._id;
    const req = apos.task.getReq({ query: { aposEdit: '1' } });

    await apos.template.annotateDocForExternalFront(doc, { req });

    const body = doc._wysiwygFields.body;
    assert.strictEqual(body.canEdit, true);
    // Named, not shipped: the schema travels once, in aposBodyData
    assert.strictEqual(body.fieldId, 'doc.product.body');
    assert.strictEqual(body.field, undefined);
    assert.strictEqual(body.component, 'AposWysiwygInputRichText');
    assert.strictEqual(body.icon, 'format-text-icon');
    assert.strictEqual(body.docId, doc._id);
    assert.strictEqual(body.patchKey, 'body');

    // A field of an array item is patched by its own key, so editing one
    // caption leaves the rest of the document alone
    const caption = doc.sections[0]._wysiwygFields.caption;
    assert.strictEqual(caption.fieldId, 'doc.product.sections.caption');
    assert.strictEqual(caption.patchKey, '@section1.caption');
    assert.strictEqual(caption.docId, doc._id);
    assert.strictEqual(caption.rendered, 'The first caption');
    assert.strictEqual(caption.canEdit, true);
  });

  it('annotateDocForExternalFront sends the editor only for the document the page is about', async function() {
    const context = productWithFields();
    context._edit = true;
    const other = productWithFields();
    other._id = 'product2';
    other._edit = true;

    const req = apos.task.getReq({ query: { aposEdit: '1' } });
    // Exactly one document is edited on a page. An index page renders fifty
    // pieces and the user edits none of them there; each is edited on its own
    // show page, where it is the context in its turn
    req.data.piece = context;

    await apos.template.annotateDocForExternalFront(context, { req });
    await apos.template.annotateDocForExternalFront(other, { req });

    assert.strictEqual(context._wysiwygFields.body.canEdit, true);
    assert.strictEqual(context._wysiwygFields.body.patchKey, 'body');

    // The value is still rendered for display, in the tag and with the classes
    // the field type asked for, because only the server can resolve the
    // permalinks of rich text. What the other forty nine pieces carry is that
    // and nothing else
    const body = other._wysiwygFields.body;
    assert.strictEqual(body.rendered, '<p>the body</p>');
    assert.deepStrictEqual(
      Object.keys(body).sort(),
      [ 'classes', 'rendered', 'tag' ]
    );
  });

  it('annotateDocForExternalFront annotates the fields of a widget in an area', async function() {
    const doc = productWithFields();
    doc._edit = true;
    doc.main.items = [
      {
        _id: 'testwidget1',
        metaType: 'widget',
        type: 'test',
        heading: 'In a widget',
        _edit: true,
        _docId: doc._id
      }
    ];
    const req = apos.task.getReq({ query: { aposEdit: '1' } });

    await apos.template.annotateDocForExternalFront(doc, { req });

    const heading = doc.main.items[0]._wysiwygFields.heading;
    assert(heading, 'the widget field is annotated');
    assert.strictEqual(heading.fieldId, 'widget.test.heading');
    // A field of a widget is patched by its own key too, so editing it
    // leaves the rest of the area alone
    assert.strictEqual(heading.patchKey, '@testwidget1.heading');
    assert.strictEqual(heading.docId, doc._id);
    assert.strictEqual(heading.rendered, 'In a widget');
  });

  it('annotateDocForExternalFront leaves fields alone without a req', async function() {
    const doc = productWithFields();

    // The rendering of a value is a request-time question: rich text
    // permalinks are resolved for the visitor asking. No req, no fields
    await apos.template.annotateDocForExternalFront(doc);

    assert.strictEqual(doc._wysiwygFields, undefined);
    // Areas are annotated as they always were
    assert(doc.main.field && doc.main.field.name === 'main');
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
