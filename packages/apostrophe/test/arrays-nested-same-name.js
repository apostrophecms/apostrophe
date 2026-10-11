// Regression test for apostrophecms/apostrophe#4129
// "A3: Server error when nested array has a same slug as its parent array
// while there's also an area in the schema"
//
// A widget whose outer `items` array contains a nested `items` array (same
// slug as the parent) plus an `area` field must render the area on an outer
// array item without throwing. Before the fix, the nested array overwrote the
// parent array's manager, so the `area` field could not be resolved and
// renderAreaTag threw "The doc of type ... has no field named area."
const t = require('../test-lib/test.js');
const assert = require('assert');

describe('nested array with same slug as parent and an area field', function() {
  let apos;

  this.timeout(t.timeout);

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'test-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            label: 'Test widget'
          },
          fields: {
            add: {
              items: {
                label: 'Items',
                type: 'array',
                fields: {
                  add: {
                    title: {
                      label: 'Title',
                      type: 'string'
                    },
                    items: {
                      label: 'Items',
                      type: 'array',
                      inline: true,
                      style: 'table',
                      fields: {
                        add: {
                          title: {
                            label: 'Title',
                            type: 'string'
                          }
                        }
                      }
                    },
                    area: {
                      label: 'Area',
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
          }
        },
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'article',
            name: 'article',
            label: 'Article'
          },
          fields: {
            add: {
              main: {
                type: 'area',
                label: 'Main area',
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
    assert(apos.area);
    apos.argv._ = [];
  });

  after(async function() {
    return t.destroy(apos);
  });

  it('renders an area on an array item whose nested array shares the parent slug', async function() {
    const req = apos.task.getReq({ mode: 'draft' });

    const doc = {
      type: 'article',
      title: 'Repro 4129',
      slug: 'repro-4129',
      metaType: 'doc',
      main: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            type: 'test',
            items: [
              {
                metaType: 'arrayItem',
                title: 'outer item',
                items: [
                  {
                    metaType: 'arrayItem',
                    title: 'inner item'
                  }
                ],
                area: {
                  metaType: 'area',
                  items: [
                    {
                      metaType: 'widget',
                      type: '@apostrophecms/rich-text',
                      content: '<p>hello</p>'
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    };

    const inserted = await apos.article.insert(req, doc);
    const outerItem = inserted.main.items[0].items[0];

    // This is the call the {% area item, 'area' %} tag makes. It must not
    // throw now that the nested array no longer overwrites the parent array's
    // manager.
    let rendered;
    try {
      rendered = await apos.area.renderAreaTag(req, outerItem, 'area');
    } catch (e) {
      assert.fail(`renderAreaTag threw: ${e.message}`);
    }
    assert(rendered);
  });

  it('resolves the manager for an existing stored item with the flat scopedArrayName', function() {
    // Array items already in the database keep the flat scopedArrayName
    // (widget.test.items). The fix must not change that stored value, and the
    // manager looked up by that name must still resolve both the parent
    // array's `area` field and the nested array's fields.
    const manager = apos.schema.getArrayManager('widget.test.items');
    assert(manager, 'expected a manager for the flat scopedArrayName');
    const names = manager.schema.map(f => f.name);
    assert(names.includes('area'), 'parent array area field must be resolvable');
    assert(names.includes('items'), 'nested array field must be resolvable');
    assert(names.includes('title'), 'shared title field must be resolvable');

    // getManagerOf on an item carrying the flat stored name must return the
    // same manager, so rendering and conversion keep working for old data.
    const item = {
      metaType: 'arrayItem',
      scopedArrayName: 'widget.test.items',
      title: 'stored item'
    };
    const resolved = apos.util.getManagerOf(item);
    assert.strictEqual(resolved, manager);
  });
});
