const t = require('../test-lib/test.js');
const assert = require('node:assert/strict');

// An array nested in an array of the same name, or an object nested in an
// object of the same name, must still be matched to its own schema. See
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

  async function findArticle(_id) {
    return apos.article.find(apos.task.getReq({ mode: 'draft' }), { _id }).toObject();
  }

  function assertAnnotated(doc) {
    const widget = doc.main.items[0];
    for (const outer of widget.items) {
      assert.equal(outer._arrayFieldId, 'widget.test.items');
      assert.equal(outer.items[0]._arrayFieldId, 'widget.test.items.items');
    }
    assert.equal(widget.settings._objectFieldId, 'widget.test.settings');
    assert.equal(widget.settings.settings._objectFieldId, 'widget.test.settings.settings');
  }

  it('annotates array items and objects with the ids of their own fields when loaded', async function() {
    const inserted = await insertArticle('annotated');
    // Sanitized but not yet loaded content, such as a widget preview
    assertAnnotated(inserted);
    assertAnnotated(await findArticle(inserted._id));
  });

  it('stores no field ids or scoped names', async function() {
    const inserted = await insertArticle('not-stored');
    const stored = await apos.doc.db.findOne({ _id: inserted._id });
    const widget = stored.main.items[0];
    const outer = widget.items[0];
    const objects = [ outer, outer.items[0], widget.settings, widget.settings.settings ];
    for (const object of objects) {
      assert.equal(object._arrayFieldId, undefined);
      assert.equal(object._objectFieldId, undefined);
      assert.equal(object.scopedArrayName, undefined);
      assert.equal(object.scopedObjectName, undefined);
    }
  });

  it('finds the right schema for nested array items sharing a name', async function() {
    const { _id } = await insertArticle('arrays');
    const article = await findArticle(_id);
    const outer = article.main.items[0].items[0];
    const inner = outer.items[0];
    assert.equal(fieldOf(outer, 'area').type, 'area');
    assert.equal(fieldOf(inner, 'area').type, 'string');
    const req = apos.task.getReq({ mode: 'draft' });
    const rendered = await apos.area.renderAreaTag(req, outer, 'area');
    assert.match(rendered, /outer area/);
  });

  it('finds the right schema for nested objects sharing a name', async function() {
    const { _id } = await insertArticle('objects');
    const article = await findArticle(_id);
    const outer = article.main.items[0].settings;
    const inner = outer.settings;
    assert.equal(fieldOf(outer, 'body').type, 'area');
    assert.equal(fieldOf(inner, 'body').type, 'string');
    const req = apos.task.getReq({ mode: 'draft' });
    const rendered = await apos.area.renderAreaTag(req, outer, 'body');
    assert.match(rendered, /outer body/);
  });

  it('refuses to guess the schema of an array item or object that was not annotated', async function() {
    // As stored by earlier releases
    const outer = {
      metaType: 'arrayItem',
      scopedArrayName: 'widget.test.items'
    };
    assert.throws(() => apos.util.getManagerOf(outer), /has no field id/);
    const object = {
      metaType: 'object',
      scopedObjectName: 'widget.test.settings'
    };
    assert.throws(() => apos.util.getManagerOf(object), /has no field id/);
  });

  it('annotates content stored by earlier releases when loaded', async function() {
    const { _id } = await insertArticle('earlier-release');
    await apos.doc.db.updateOne({ _id }, {
      $set: {
        'main.items.0.items.0.scopedArrayName': 'widget.test.items',
        'main.items.0.items.0.items.0.scopedArrayName': 'widget.test.items',
        'main.items.0.settings.scopedObjectName': 'widget.test.settings'
      }
    });
    assertAnnotated(await findArticle(_id));
  });

  it('annotates the docs of versions', async function() {
    const article = await insertArticle('versions');
    const versions = await apos.docVersions.find(
      apos.task.getReq(),
      apos.docVersions.getTimelineCriteria(article)
    );
    assert(versions.length);
    for (const version of versions) {
      assertAnnotated(version.doc);
    }
  });

  it('loads a doc whose object field is stored as an array', async function() {
    const { _id } = await insertArticle('object-as-array');
    // As the 2.x content upgrader stores an object field
    await apos.doc.db.updateOne({ _id }, {
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
    const article = await findArticle(_id);
    const outer = article.main.items[0].items[0];
    assert.equal(outer._arrayFieldId, 'widget.test.items');
    assert.equal(outer.items[0]._arrayFieldId, 'widget.test.items.items');
    assert.equal(article.main.items[0].settings[0]._objectFieldId, undefined);
  });
});
