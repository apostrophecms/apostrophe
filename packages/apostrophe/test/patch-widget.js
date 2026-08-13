const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// `applyPatch` takes a shortcut when a patch does nothing but replace a single
// widget via the `@_id` syntax: only that widget is converted, and the rest of
// the document is left exactly as it was. These tests cover both the shortcut
// and the many cases that must still fall through to the general code path.

describe('Patch widget shortcut', function() {

  let apos;
  let productId;
  // `true` or `false` for each patch applied, or empty if the shortcut was
  // never consulted at all
  let shortcut;

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'two-column-widget': {
          extend: '@apostrophecms/widget-type',
          fields: {
            add: {
              one: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {}
                  }
                }
              },
              two: {
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
        'strict-widget': {
          extend: '@apostrophecms/widget-type',
          fields: {
            add: {
              value: {
                type: 'string',
                required: true
              }
            }
          }
        },
        '@apostrophecms/home-page': {
          fields: {
            add: {
              main: {
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
                    '@apostrophecms/rich-text': {},
                    'two-column': {},
                    strict: {}
                  }
                }
              },
              locked: {
                type: 'area',
                readOnly: true,
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {}
                  }
                }
              },
              list: {
                type: 'array',
                fields: {
                  add: {
                    inner: {
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
        }
      }
    });

    const superPatchWidgetIfSuitable = apos.schema.patchWidgetIfSuitable;
    apos.schema.patchWidgetIfSuitable = async (...args) => {
      const result = await superPatchWidgetIfSuitable(...args);
      shortcut.push(result);
      return result;
    };

    const req = apos.task.getReq();
    const product = apos.product.newInstance();
    await apos.schema.convert(req, apos.product.schema, {
      title: 'Product',
      main: {
        metaType: 'area',
        items: [
          richText('first'),
          {
            metaType: 'widget',
            type: 'two-column',
            one: {
              metaType: 'area',
              items: [ richText('nested') ]
            },
            two: {
              metaType: 'area',
              items: []
            }
          },
          richText('last'),
          {
            metaType: 'widget',
            type: 'strict',
            value: 'required'
          }
        ]
      },
      list: [
        {
          inner: {
            metaType: 'area',
            items: [ richText('in an array') ]
          }
        }
      ]
    }, product);
    // `convert` skips read only fields, so this one is populated by hand
    product.locked = {
      metaType: 'area',
      _id: apos.util.generateId(),
      items: [
        {
          ...richText('untouchable'),
          _id: apos.util.generateId()
        }
      ]
    };
    await apos.product.insert(req, product);
    productId = product._id;

    const home = await apos.page.findOneForEditing(req, { level: 0 });
    home.main = {
      metaType: 'area',
      _id: apos.util.generateId(),
      items: [
        {
          ...richText('home first'),
          _id: apos.util.generateId()
        },
        {
          ...richText('home last'),
          _id: apos.util.generateId()
        }
      ]
    };
    await apos.page.update(req, home);
  });

  beforeEach(function() {
    shortcut = [];
  });

  function richText(content) {
    return {
      metaType: 'widget',
      type: '@apostrophecms/rich-text',
      content: `<p>${content}</p>`
    };
  }

  // A fresh copy of the piece straight from the database, so that object
  // identity means something in the assertions below
  async function get() {
    const req = apos.task.getReq();
    return apos.product.findOneForEditing(req, { _id: productId });
  }

  async function patch(product, input) {
    return apos.product.applyPatch(apos.task.getReq(), product, input);
  }

  it('takes the shortcut for a patch replacing one top level widget', async function() {
    const product = await get();
    const widget = product.main.items[0];
    const sibling = product.main.items[2];
    await patch(product, {
      [`@${widget._id}`]: {
        ...widget,
        content: '<p>patched</p>'
      }
    });
    assert.deepEqual(shortcut, [ true ]);
    assert.equal(product.main.items[0]._id, widget._id);
    assert.equal(product.main.items[0].content, '<p>patched</p>');
    // The rest of the document is not merely equal, it is untouched. That is
    // the whole point of the shortcut
    assert.equal(product.main.items[2], sibling);
    assert.equal(product.locked, product.locked);
  });

  it('takes the shortcut for a widget of an area nested in another widget', async function() {
    const product = await get();
    const parent = product.main.items[1];
    const widget = parent.one.items[0];
    const sibling = product.main.items[0];
    await patch(product, {
      [`@${widget._id}`]: {
        ...widget,
        content: '<p>patched nested</p>'
      }
    });
    assert.deepEqual(shortcut, [ true ]);
    assert.equal(product.main.items[1].one.items[0]._id, widget._id);
    assert.equal(product.main.items[1].one.items[0].content, '<p>patched nested</p>');
    assert.equal(product.main.items[0], sibling);
  });

  it('takes the shortcut for a widget of an area nested in an array item', async function() {
    const product = await get();
    const widget = product.list[0].inner.items[0];
    const sibling = product.main.items[0];
    await patch(product, {
      [`@${widget._id}`]: {
        ...widget,
        content: '<p>patched in an array</p>'
      }
    });
    assert.deepEqual(shortcut, [ true ]);
    assert.equal(product.list[0].inner.items[0].content, '<p>patched in an array</p>');
    assert.equal(product.main.items[0], sibling);
  });

  it('takes the shortcut when only an advisory lock accompanies the widget', async function() {
    const product = await get();
    const widget = product.main.items[0];
    await patch(product, {
      _advisoryLock: {
        tabId: 'test',
        lock: true
      },
      [`@${widget._id}`]: {
        ...widget,
        content: '<p>patched with a lock</p>'
      }
    });
    assert.deepEqual(shortcut, [ true ]);
    assert.equal(product.main.items[0].content, '<p>patched with a lock</p>');
  });

  it('sanitizes the widget it takes the shortcut for', async function() {
    const product = await get();
    const widget = product.main.items[0];
    await patch(product, {
      [`@${widget._id}`]: {
        ...widget,
        content: '<p>clean</p><script>alert(1)</script>',
        nonsense: 'not in the schema'
      }
    });
    assert.deepEqual(shortcut, [ true ]);
    assert.equal(product.main.items[0].content, '<p>clean</p>');
    assert.equal(product.main.items[0].nonsense, undefined);
  });

  it('falls through for a patch of one property of a widget', async function() {
    const product = await get();
    const widget = product.main.items[0];
    const sibling = product.main.items[2];
    await patch(product, {
      [`@${widget._id}.content`]: '<p>by dot path</p>'
    });
    assert.deepEqual(shortcut, [ false ]);
    assert.equal(product.main.items[0].content, '<p>by dot path</p>');
    // The general code path converts the whole area, so nothing survives
    // by identity
    assert.notEqual(product.main.items[2], sibling);
  });

  it('falls through for a patch by dot path', async function() {
    const product = await get();
    const widget = product.main.items[0];
    await patch(product, {
      'main.items.0': {
        ...widget,
        content: '<p>positional</p>'
      }
    });
    assert.deepEqual(shortcut, [ false ]);
    assert.equal(product.main.items[0].content, '<p>positional</p>');
  });

  it('falls through for a patch that also touches another field', async function() {
    const product = await get();
    const widget = product.main.items[0];
    await patch(product, {
      title: 'Renamed',
      [`@${widget._id}`]: {
        ...widget,
        content: '<p>and a title</p>'
      }
    });
    assert.deepEqual(shortcut, [ false ]);
    assert.equal(product.title, 'Renamed');
    assert.equal(product.main.items[0].content, '<p>and a title</p>');
  });

  it('falls through for a $push', async function() {
    const product = await get();
    await patch(product, {
      $push: {
        'main.items': richText('pushed')
      }
    });
    assert.deepEqual(shortcut, [ false ]);
    assert.equal(product.main.items.length, 5);
    assert.equal(product.main.items[4].content, '<p>pushed</p>');
  });

  it('falls through when the value is not marked as a widget', async function() {
    const product = await get();
    const widget = product.main.items[0];
    await patch(product, {
      [`@${widget._id}`]: {
        ...widget,
        metaType: 'area',
        content: '<p>not a widget</p>'
      }
    });
    assert.deepEqual(shortcut, [ false ]);
  });

  it('falls through when no widget in the document has that _id', async function() {
    const product = await get();
    const sibling = product.main.items[0];
    // The general code path rejects an unresolvable @ reference, as it always
    // has. Getting that error is the point: the shortcut must not swallow it
    await assert.rejects(patch(product, {
      '@nosuchwidgetidatall': {
        ...richText('nowhere'),
        _id: 'nosuchwidgetidatall'
      }
    }), {
      name: 'invalid'
    });
    assert.deepEqual(shortcut, [ false ]);
    assert.equal(product.main.items[0], sibling);
  });

  it('falls through when the _id belongs to something other than a widget', async function() {
    const product = await get();
    await patch(product, {
      [`@${product.main._id}`]: {
        ...richText('an area is not a widget'),
        _id: product.main._id
      }
    });
    assert.deepEqual(shortcut, [ false ]);
  });

  it('falls through for a widget type the area does not accept', async function() {
    const product = await get();
    const widget = product.main.items[1].one.items[0];
    await patch(product, {
      // The `one` area of a two-column widget accepts rich text only
      [`@${widget._id}`]: {
        _id: widget._id,
        metaType: 'widget',
        type: 'two-column'
      }
    });
    assert.deepEqual(shortcut, [ false ]);
    // And the general code path discards it, as it always has
    assert.equal(product.main.items[1].one.items.length, 0);
  });

  it('falls through for a read only area, which is then left alone', async function() {
    const product = await get();
    const widget = product.locked.items[0];
    await patch(product, {
      [`@${widget._id}`]: {
        ...widget,
        content: '<p>should not stick</p>'
      }
    });
    assert.deepEqual(shortcut, [ false ]);
    assert.equal(product.locked.items[0].content, '<p>untouchable</p>');
  });

  // A fresh copy of the home page straight from the database
  async function getHome() {
    return apos.page.findOneForEditing(apos.task.getReq(), { level: 0 });
  }

  // The real route method, so that everything it does to the patch on the way
  // in, notably enforcing parked properties, is part of the test
  async function patchPage(page, body) {
    return apos.page.patch(apos.task.getReq({ body }), page._id);
  }

  it('takes the shortcut for a page too', async function() {
    const home = await getHome();
    const widget = home.main.items[0];
    const result = await patchPage(home, {
      [`@${widget._id}`]: {
        ...widget,
        content: '<p>patched home</p>'
      }
    });
    assert.deepEqual(shortcut, [ true ]);
    assert.equal(result.main.items[0].content, '<p>patched home</p>');
    assert.equal(result.main.items[1].content, '<p>home last</p>');
  });

  // The home page is parked, and parked properties are enforced on the way in.
  // If that enforcement were to add properties the patch never mentioned, the
  // shortcut above would never be taken for any page of a real site
  it('takes the shortcut for a parked page without disturbing its parked properties', async function() {
    const home = await getHome();
    const widget = home.main.items[0];
    assert.deepEqual(home.parked, [ 'slug', 'parkedId' ]);
    const result = await patchPage(home, {
      [`@${widget._id}`]: {
        ...widget,
        content: '<p>still parked</p>'
      }
    });
    assert.deepEqual(shortcut, [ true ]);
    assert.equal(result.main.items[0].content, '<p>still parked</p>');
    assert.equal(result.slug, '/');
    assert.equal(result.parkedId, 'home');
  });

  it('falls through for a page patch that also touches another field', async function() {
    const home = await getHome();
    const widget = home.main.items[0];
    const result = await patchPage(home, {
      title: 'Renamed Home',
      [`@${widget._id}`]: {
        ...widget,
        content: '<p>and a title</p>'
      }
    });
    assert.deepEqual(shortcut, [ false ]);
    assert.equal(result.title, 'Renamed Home');
    assert.equal(result.main.items[0].content, '<p>and a title</p>');
  });

  it('falls through for a page patch that tries to change a parked property, which is still refused', async function() {
    const home = await getHome();
    const widget = home.main.items[0];
    const result = await patchPage(home, {
      slug: '/not-the-home-page',
      [`@${widget._id}`]: {
        ...widget,
        content: '<p>and a slug</p>'
      }
    });
    assert.deepEqual(shortcut, [ false ]);
    assert.equal(result.main.items[0].content, '<p>and a slug</p>');
    assert.equal(result.slug, '/');
  });

  it('falls through when the widget does not validate, reporting the error', async function() {
    const product = await get();
    const widget = product.main.items[3];
    await assert.rejects(patch(product, {
      [`@${widget._id}`]: {
        ...widget,
        value: ''
      }
    }));
    assert.deepEqual(shortcut, [ false ]);
  });
});
