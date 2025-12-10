const assert = require('assert/strict');

const getWalkLib = async () => import('../modules/@apostrophecms/area/ui/apos/lib/walk-widgets.js');

describe('walkWidgets', function() {

  it('should handle null and undefined inputs gracefully', async function() {
    const { default: walkWidgets } = await getWalkLib();
    const actual = [];

    walkWidgets(null, (widget) => actual.push(widget));
    assert.deepEqual(actual, []);

    walkWidgets(undefined, (widget) => actual.push(widget));
    assert.deepEqual(actual, []);

    walkWidgets({}, (widget) => actual.push(widget));
    assert.deepEqual(actual, []);
  });

  it('should handle invalid iterator gracefully', async function() {
    const { default: walkWidgets } = await getWalkLib();
    const doc = {
      body: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            type: 'test',
            _id: 'widget1'
          }
        ]
      }
    };

    // Should not throw when iterator is not a function
    walkWidgets(doc, null);
    walkWidgets(doc, undefined);
    walkWidgets(doc, 'not a function');
  });

  it('should find widgets in a simple area', async function() {
    const { default: walkWidgets } = await getWalkLib();
    const doc = {
      body: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            type: 'rich-text',
            _id: 'widget1'
          },
          {
            metaType: 'widget',
            type: 'image',
            _id: 'widget2'
          }
        ]
      }
    };

    const actual = [];
    walkWidgets(doc, (widget) => actual.push(widget._id));

    assert.equal(actual.length, 2);
    assert.ok(actual.includes('widget1'));
    assert.ok(actual.includes('widget2'));
  });

  it('should find widgets in multiple areas', async function() {
    const { default: walkWidgets } = await getWalkLib();
    const doc = {
      header: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            type: 'rich-text',
            _id: 'widget1'
          }
        ]
      },
      body: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            type: 'image',
            _id: 'widget2'
          }
        ]
      }
    };

    const actual = [];
    walkWidgets(doc, (widget) => actual.push(widget._id));

    assert.deepEqual(actual, [ 'widget1', 'widget2' ]);
  });

  it('should find deeply nested widgets in array fields', async function() {
    const { default: walkWidgets } = await getWalkLib();
    const doc = {
      body: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            type: 'columns',
            _id: 'widget1',
            columns: [
              {
                content: {
                  metaType: 'area',
                  items: [
                    {
                      metaType: 'widget',
                      type: 'rich-text',
                      _id: 'widget2'
                    }
                  ]
                }
              },
              {
                content: {
                  metaType: 'area',
                  items: [
                    {
                      metaType: 'widget',
                      type: 'image',
                      _id: 'widget3'
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    };

    const actual = [];
    walkWidgets(doc, (widget) => actual.push(widget._id));

    assert.deepEqual(actual, [ 'widget1', 'widget2', 'widget3' ]);
  });

  it('should find widgets in deeply nested structures', async function() {
    const { default: walkWidgets } = await getWalkLib();
    const doc = {
      sections: [
        {
          layout: {
            metaType: 'area',
            items: [
              {
                metaType: 'widget',
                type: 'layout',
                _id: 'widget1',
                items: [
                  {
                    area: {
                      metaType: 'area',
                      items: [
                        {
                          metaType: 'widget',
                          type: 'rich-text',
                          _id: 'widget2'
                        }
                      ]
                    }
                  }
                ]
              }
            ]
          }
        }
      ]
    };

    const actual = [];
    walkWidgets(doc, (widget) => actual.push(widget._id));

    assert.deepEqual(actual, [ 'widget1', 'widget2' ]);
  });

  it('should skip non-widget items in areas', async function() {
    const { default: walkWidgets } = await getWalkLib();
    const doc = {
      body: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            type: 'rich-text',
            _id: 'widget1'
          },
          {
            // Missing metaType
            type: 'image',
            _id: 'notAWidget'
          },
          {
            metaType: 'something-else',
            _id: 'alsoNotAWidget'
          },
          null,
          undefined,
          {
            metaType: 'widget',
            type: 'video',
            _id: 'widget2'
          }
        ]
      }
    };

    const actual = [];
    walkWidgets(doc, (widget) => actual.push(widget._id));

    assert.equal(actual.length, 2);
    assert.ok(actual.includes('widget1'));
    assert.ok(actual.includes('widget2'));
  });

  it('should handle empty areas', async function() {
    const { default: walkWidgets } = await getWalkLib();
    const doc = {
      body: {
        metaType: 'area',
        items: []
      },
      sidebar: {
        metaType: 'area'
        // No items property
      }
    };

    const actual = [];
    walkWidgets(doc, (widget) => actual.push(widget));

    assert.deepEqual(actual, []);
  });

  it('should handle complex real-world document structure', async function() {
    const { default: walkWidgets } = await getWalkLib();
    const doc = {
      _id: 'page1',
      type: 'default-page',
      title: 'Test Page',
      main: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            type: '@apostrophecms/rich-text',
            _id: 'widget1',
            content: '<p>Hello</p>'
          },
          {
            metaType: 'widget',
            type: '@apostrophecms/columns',
            _id: 'widget2',
            columns: [
              {
                _id: 'col1',
                content: {
                  metaType: 'area',
                  items: [
                    {
                      metaType: 'widget',
                      type: '@apostrophecms/image',
                      _id: 'widget3'
                    }
                  ]
                }
              },
              {
                _id: 'col2',
                content: {
                  metaType: 'area',
                  items: [
                    {
                      metaType: 'widget',
                      type: '@apostrophecms/video',
                      _id: 'widget4'
                    }
                  ]
                }
              }
            ]
          }
        ]
      },
      sidebar: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            type: 'navigation',
            _id: 'widget5'
          }
        ]
      }
    };

    const actual = [];
    walkWidgets(doc, (widget) => actual.push(widget._id));

    // Order is not guaranteed due to stack-based traversal
    assert.equal(actual.length, 5);
    assert.ok(actual.includes('widget1'));
    assert.ok(actual.includes('widget2'));
    assert.ok(actual.includes('widget3'));
    assert.ok(actual.includes('widget4'));
    assert.ok(actual.includes('widget5'));
  });

  it('should allow iterator to access widget properties', async function() {
    const { default: walkWidgets } = await getWalkLib();
    const doc = {
      body: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            type: 'rich-text',
            _id: 'widget1',
            content: '<p>Test</p>'
          },
          {
            metaType: 'widget',
            type: 'image',
            _id: 'widget2',
            imageId: 'img123'
          }
        ]
      }
    };

    const types = [];
    const ids = [];
    walkWidgets(doc, (widget) => {
      types.push(widget.type);
      ids.push(widget._id);
    });

    assert.equal(types.length, 2);
    assert.ok(types.includes('rich-text'));
    assert.ok(types.includes('image'));
    assert.equal(ids.length, 2);
    assert.ok(ids.includes('widget1'));
    assert.ok(ids.includes('widget2'));
  });

  it('should handle widgets with no nested areas efficiently', async function() {
    const { default: walkWidgets } = await getWalkLib();
    const doc = {
      body: {
        metaType: 'area',
        items: Array(100).fill(null).map((_, i) => ({
          metaType: 'widget',
          type: 'simple',
          _id: `widget${i}`
        }))
      }
    };

    const actual = [];
    walkWidgets(doc, (widget) => actual.push(widget._id));

    assert.equal(actual.length, 100);
    assert.ok(actual.includes('widget0'));
    assert.ok(actual.includes('widget99'));
  });

  it('should handle very deep nesting without stack overflow', async function() {
    const { default: walkWidgets } = await getWalkLib();

    // Create a deeply nested structure (20 levels)
    let current = {
      metaType: 'area',
      items: [
        {
          metaType: 'widget',
          type: 'final',
          _id: 'deepWidget'
        }
      ]
    };

    for (let i = 0; i < 20; i++) {
      current = {
        nested: {
          items: [
            {
              content: current
            }
          ]
        }
      };
    }

    const doc = { root: current };
    const actual = [];

    // Should not throw stack overflow
    walkWidgets(doc, (widget) => actual.push(widget._id));

    assert.deepEqual(actual, [ 'deepWidget' ]);
  });

  it('should handle circular-like structures with arrays', async function() {
    const { default: walkWidgets } = await getWalkLib();
    const doc = {
      sections: [
        {
          areas: [
            {
              metaType: 'area',
              items: [
                {
                  metaType: 'widget',
                  type: 'test',
                  _id: 'widget1'
                }
              ]
            }
          ]
        }
      ]
    };

    const actual = [];
    walkWidgets(doc, (widget) => actual.push(widget._id));

    assert.deepEqual(actual, [ 'widget1' ]);
  });

  it('should handle widgets in object field types', async function() {
    const { default: walkWidgets } = await getWalkLib();
    const doc = {
      body: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            type: 'custom',
            _id: 'widget1',
            settings: {
              nested: {
                deep: {
                  area: {
                    metaType: 'area',
                    items: [
                      {
                        metaType: 'widget',
                        type: 'nested',
                        _id: 'widget2'
                      }
                    ]
                  }
                }
              }
            }
          }
        ]
      }
    };

    const actual = [];
    walkWidgets(doc, (widget) => actual.push(widget._id));

    assert.deepEqual(actual, [ 'widget1', 'widget2' ]);
  });

  it('should be callable just for side effects', async function() {
    const { default: walkWidgets } = await getWalkLib();
    let count = 0;
    const doc = {
      body: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            type: 'test',
            _id: 'widget1'
          },
          {
            metaType: 'widget',
            type: 'test',
            _id: 'widget2'
          }
        ]
      }
    };

    walkWidgets(doc, () => count++);
    assert.equal(count, 2);
  });

  it('should handle an array of objects', async function() {
    const { default: walkWidgets } = await getWalkLib();

    // Simulate passing area.items directly instead of the whole doc
    const items = [
      {
        metaType: 'widget',
        type: 'rich-text',
        _id: 'widget1',
        content: '<p>Hello</p>'
      },
      {
        metaType: 'widget',
        type: 'columns',
        _id: 'widget2',
        columns: [
          {
            content: {
              metaType: 'area',
              items: [
                {
                  metaType: 'widget',
                  type: 'image',
                  _id: 'widget3'
                }
              ]
            }
          }
        ]
      },
      {
        metaType: 'widget',
        type: 'video',
        _id: 'widget4'
      }
    ];

    const actual = [];
    walkWidgets(items, (widget) => actual.push(widget._id));

    // Should find all widgets including nested ones, regardless of order
    assert.equal(actual.length, 4);
    assert.ok(actual.includes('widget1'));
    assert.ok(actual.includes('widget2'));
    assert.ok(actual.includes('widget3'));
    assert.ok(actual.includes('widget4'));
  });
});
