const t = require('../test-lib/test.js');
const assert = require('node:assert/strict');

// An array nested in an array of the same name, and an object nested in an
// object of the same name, share a flat scopedArrayName or scopedObjectName.
// Array items and objects must be matched to their own schemas anyway. See
// https://github.com/apostrophecms/apostrophe/issues/4129

describe('Nested array and object fields sharing a name', function() {
  let apos;

  this.timeout(t.timeout);

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'test-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            label: 'Test'
          },
          fields: {
            add: {
              items: {
                type: 'array',
                label: 'Items',
                fields: {
                  add: {
                    title: {
                      type: 'string',
                      label: 'Title'
                    },
                    items: {
                      type: 'array',
                      label: 'Items',
                      fields: {
                        add: {
                          title: {
                            type: 'string',
                            label: 'Title'
                          },
                          // Same name as the outer area, different type
                          area: {
                            type: 'string',
                            label: 'Area'
                          }
                        }
                      }
                    },
                    area: {
                      type: 'area',
                      label: 'Area',
                      options: {
                        widgets: {
                          '@apostrophecms/rich-text': {}
                        }
                      }
                    }
                  }
                }
              },
              settings: {
                type: 'object',
                label: 'Settings',
                fields: {
                  add: {
                    body: {
                      type: 'area',
                      label: 'Body',
                      options: {
                        widgets: {
                          '@apostrophecms/rich-text': {}
                        }
                      }
                    },
                    settings: {
                      type: 'object',
                      label: 'Settings',
                      fields: {
                        add: {
                          // Same name as the outer area, different type
                          body: {
                            type: 'string',
                            label: 'Body'
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'article'
          },
          fields: {
            add: {
              main: {
                type: 'area',
                label: 'Main',
                options: {
                  widgets: {
                    test: {}
                  }
                }
              }
            }
          }
        }
      }
    });
  });

  after(async function() {
    return t.destroy(apos);
  });

  async function insertArticle(slug, outerTitles = [ 'outer' ]) {
    const req = apos.task.getReq({ mode: 'draft' });
    return apos.article.insert(req, {
      title: slug,
      slug,
      main: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            type: 'test',
            items: outerTitles.map(title => ({
              title,
              items: [
                {
                  title: 'inner',
                  area: 'just a string'
                }
              ],
              area: {
                metaType: 'area',
                items: [
                  {
                    metaType: 'widget',
                    type: '@apostrophecms/rich-text',
                    content: '<p>outer area</p>'
                  }
                ]
              }
            })),
            settings: {
              body: {
                metaType: 'area',
                items: [
                  {
                    metaType: 'widget',
                    type: '@apostrophecms/rich-text',
                    content: '<p>outer body</p>'
                  }
                ]
              },
              settings: {
                body: 'just a string'
              }
            }
          }
        ]
      }
    });
  }

  function fieldOf(object, name) {
    return apos.util.getManagerOf(object).schema.find(field => field.name === name);
  }

  it('stamps array items and objects with the ids of their own fields', async function() {
    const article = await insertArticle('stamps');
    const widget = article.main.items[0];
    const outer = widget.items[0];
    const inner = outer.items[0];
    assert.equal(outer.arrayFieldId, 'widget.test.items');
    assert.equal(inner.arrayFieldId, 'widget.test.items.items');
    assert.equal(widget.settings.objectFieldId, 'widget.test.settings');
    assert.equal(widget.settings.settings.objectFieldId, 'widget.test.settings.settings');
    // Still written for the benefit of processes running older code during a
    // rolling deployment
    assert.equal(outer.scopedArrayName, 'widget.test.items');
    assert.equal(inner.scopedArrayName, 'widget.test.items');
    assert.equal(widget.settings.scopedObjectName, 'widget.test.settings');
  });

  it('finds the right schema for nested array items sharing a name', async function() {
    const article = await insertArticle('arrays');
    const outer = article.main.items[0].items[0];
    const inner = outer.items[0];
    assert.equal(fieldOf(outer, 'area').type, 'area');
    assert.equal(fieldOf(inner, 'area').type, 'string');
    const req = apos.task.getReq({ mode: 'draft' });
    const rendered = await apos.area.renderAreaTag(req, outer, 'area');
    assert.match(rendered, /outer area/);
  });

  it('finds the right schema for nested objects sharing a name', async function() {
    const article = await insertArticle('objects');
    const outer = article.main.items[0].settings;
    const inner = outer.settings;
    assert.equal(fieldOf(outer, 'body').type, 'area');
    assert.equal(fieldOf(inner, 'body').type, 'string');
    const req = apos.task.getReq({ mode: 'draft' });
    const rendered = await apos.area.renderAreaTag(req, outer, 'body');
    assert.match(rendered, /outer body/);
  });

  it('falls back to the flat name for items stored before field ids', async function() {
    const outer = {
      metaType: 'arrayItem',
      scopedArrayName: 'widget.test.items'
    };
    assert(apos.util.getManagerOf(outer));
    const object = {
      metaType: 'object',
      scopedObjectName: 'widget.test.settings'
    };
    assert(apos.util.getManagerOf(object));
  });

  // Strip the new properties directly in the database, leaving the doc as
  // older code would have stored it
  async function makeLegacy(_id) {
    const doc = await apos.doc.db.findOne({ _id });
    const widget = doc.main.items[0];
    const $unset = {
      'main.items.0.settings.objectFieldId': 1,
      'main.items.0.settings.settings.objectFieldId': 1
    };
    widget.items.forEach((item, i) => {
      $unset[`main.items.0.items.${i}.arrayFieldId`] = 1;
      $unset[`main.items.0.items.${i}.items.0.arrayFieldId`] = 1;
    });
    await apos.doc.db.updateOne({ _id }, { $unset });
    const legacy = await apos.doc.db.findOne({ _id });
    assert.equal(legacy.main.items[0].items[0].arrayFieldId, undefined);
    assert.equal(legacy.main.items[0].settings.objectFieldId, undefined);
    return legacy;
  }

  function assertMigrated(doc, outerTitles) {
    const widget = doc.main.items[0];
    assert.deepEqual(widget.items.map(item => item.title), outerTitles);
    for (const outer of widget.items) {
      assert.equal(outer.arrayFieldId, 'widget.test.items');
      assert.equal(outer.items[0].arrayFieldId, 'widget.test.items.items');
      assert.equal(outer.items[0].area, 'just a string');
      assert.match(outer.area.items[0].content, /outer area/);
    }
    assert.equal(widget.settings.objectFieldId, 'widget.test.settings');
    assert.equal(widget.settings.settings.objectFieldId, 'widget.test.settings.settings');
    assert.equal(widget.settings.settings.body, 'just a string');
  }

  it('adds field ids to legacy docs via a migration', async function() {
    const article = await insertArticle('migrate', [ 'one', 'two' ]);
    await makeLegacy(article._id);
    const migration = apos.migration.migrations
      .find(migration => migration.name === 'add-array-and-object-field-ids');
    assert(migration);
    await migration.fn();
    assertMigrated(await apos.doc.db.findOne({ _id: article._id }), [ 'one', 'two' ]);
  });

  it('migrates the rest of a doc whose object field is stored as an array', async function() {
    const article = await insertArticle('object-as-array');
    await makeLegacy(article._id);
    // As the 2.x content upgrader stores an object field
    await apos.doc.db.updateOne({ _id: article._id }, {
      $set: {
        'main.items.0.settings': [
          {
            _id: 'upgraded',
            metaType: 'arrayItem',
            scopedArrayName: 'widget.test.settings',
            settings: { body: 'just a string' }
          }
        ]
      }
    });
    await apos.doc.addFieldIdsToDoc(await apos.doc.db.findOne({ _id: article._id }));
    const doc = await apos.doc.db.findOne({ _id: article._id });
    const outer = doc.main.items[0].items[0];
    assert.equal(outer.arrayFieldId, 'widget.test.items');
    assert.equal(outer.items[0].arrayFieldId, 'widget.test.items.items');
    assert.equal(doc.main.items[0].settings[0]._id, 'upgraded');
  });

  it('does not write through stale array indexes when a doc changes mid-migration', async function() {
    const article = await insertArticle('stale', [ 'one', 'two', 'three' ]);
    const stale = await makeLegacy(article._id);
    // Another process removes the first outer item after the migration read
    // the doc but before it wrote
    await apos.doc.db.updateOne({ _id: article._id }, {
      $set: {
        'main.items.0.items': stale.main.items[0].items.slice(1)
      }
    });
    await apos.doc.addFieldIdsToDoc(stale);
    assertMigrated(await apos.doc.db.findOne({ _id: article._id }), [ 'two', 'three' ]);
  });
  // Remove the new properties everywhere in `value`, as older code stored it
  function stripFieldIds(value) {
    if (Array.isArray(value)) {
      value.forEach(stripFieldIds);
    } else if (value && ((typeof value) === 'object')) {
      delete value.arrayFieldId;
      delete value.objectFieldId;
      Object.values(value).forEach(stripFieldIds);
    }
    return value;
  }

  async function versionsOf(article) {
    return apos.docVersions.db
      .find(apos.docVersions.getTimelineCriteria(article))
      .toArray();
  }

  it('adds field ids to legacy version records when converting them', async function() {
    const article = await insertArticle('legacy-versions');
    const records = await versionsOf(article);
    assert(records.length);
    // The shape the legacy versions module stored: no mode, a plain doc
    for (const {
      mode, locale, authorId, ai, ...record
    } of records) {
      const doc = stripFieldIds(await apos.docVersions.unpack(record.doc));
      await apos.docVersions.db.replaceOne({ _id: record._id }, {
        ...record,
        docId: doc._id,
        doc
      });
    }
    await apos.docVersions.convertLegacyVersions();
    for (const record of await versionsOf(article)) {
      assertMigrated(await apos.docVersions.unpack(record.doc), [ 'outer' ]);
    }
  });

  it('adds field ids to versions recorded before they existed', async function() {
    const article = await insertArticle('old-versions');
    const records = await versionsOf(article);
    assert(records.length);
    for (const record of records) {
      const doc = stripFieldIds(await apos.docVersions.unpack(record.doc));
      await apos.docVersions.db.updateOne({ _id: record._id }, {
        $set: { doc: await apos.docVersions.pack(doc) }
      });
    }
    assert(await apos.docVersions.addFieldIdsToVersions() >= records.length);
    for (const record of await versionsOf(article)) {
      assertMigrated(await apos.docVersions.unpack(record.doc), [ 'outer' ]);
    }
    // Nothing left to do on a rerun
    assert.equal(await apos.docVersions.addFieldIdsToVersions(), 0);
  });
});
