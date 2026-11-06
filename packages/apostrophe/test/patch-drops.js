const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// Conversion quietly drops a widget its area refuses, a relationship entry
// that does not resolve and array items past the field's limit, and ignores
// input for a read only field or a relationship the user can't view. The save
// reports success. That leniency heals stale content, but it also loses what
// a patch has just written.

describe('Patch drops', function() {

  let apos;
  let articleId;
  let jar;

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
                    '@apostrophecms/rich-text': {},
                    stamp: {}
                  }
                }
              }
            }
          }
        },
        'stamp-widget': {
          extend: '@apostrophecms/widget-type',
          fields: {
            add: {
              label: {
                type: 'string'
              },
              stamp: {
                type: 'string',
                readOnly: true
              },
              secret: {
                type: 'string',
                editPermission: {
                  action: 'edit',
                  type: '@apostrophecms/user'
                }
              }
            }
          }
        },
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'article'
          }
        },
        product: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'product'
          },
          fields: {
            add: {
              summary: {
                type: 'string',
                required: true
              },
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {},
                    'two-column': {},
                    stamp: {}
                  }
                }
              },
              _articles: {
                type: 'relationship',
                withType: 'article'
              },
              code: {
                type: 'string',
                readOnly: true
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
                limit: 2,
                fields: {
                  add: {
                    label: {
                      type: 'string'
                    }
                  }
                }
              },
              _owners: {
                type: 'relationship',
                withType: '@apostrophecms/user'
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
                    '@apostrophecms/rich-text': {},
                    'two-column': {}
                  }
                }
              }
            }
          }
        }
      }
    });
    const article = await apos.article.insert(apos.task.getReq(), {
      title: 'Article'
    });
    articleId = article._id;
    await t.createAdmin(apos);
    jar = await t.loginAs(apos, 'admin');
    // Sets the CSRF cookie
    await apos.http.get('/', { jar });
  });

  function richText(content) {
    return {
      _id: apos.util.generateId(),
      metaType: 'widget',
      type: '@apostrophecms/rich-text',
      content: `<p>${content}</p>`
    };
  }

  function html(code) {
    return {
      _id: apos.util.generateId(),
      metaType: 'widget',
      type: '@apostrophecms/html',
      code
    };
  }

  function twoColumn(items) {
    return {
      _id: apos.util.generateId(),
      metaType: 'widget',
      type: 'two-column',
      one: {
        metaType: 'area',
        items
      }
    };
  }

  function stamp(label) {
    return {
      _id: apos.util.generateId(),
      metaType: 'widget',
      type: 'stamp',
      label,
      stamp: 'KEEP',
      secret: 'SECRET'
    };
  }

  function listItem(label) {
    return {
      _id: apos.util.generateId(),
      metaType: 'arrayItem',
      label
    };
  }

  // A product whose `main` area holds `items` and whose other fields hold
  // `stored`, bypassing conversion, so stale content can be planted
  async function insertProduct(
    items = [ richText('first') ],
    {
      summary = 'Summary',
      ...stored
    } = {}
  ) {
    const req = apos.task.getReq();
    const product = await apos.product.insert(req, {
      title: 'Product',
      summary
    });
    await apos.doc.db.updateOne({ _id: product._id }, {
      $set: {
        main: {
          _id: apos.util.generateId(),
          metaType: 'area',
          items
        },
        ...stored
      }
    });
    return product._id;
  }

  async function patchProduct(_id, input, req = apos.task.getReq()) {
    return apos.product.convertPatchAndRefresh(req, input, _id);
  }

  // Resolves to the error `promise` rejects with
  async function refusal(promise) {
    try {
      await promise;
    } catch (e) {
      return e;
    }
    assert.fail('The patch was not refused');
  }

  async function getProduct(_id) {
    return apos.product.findOneForEditing(apos.task.getReq(), { _id });
  }

  describe('without a flag', function() {

    it('drops a pushed widget the area does not allow and reports success', async function() {
      const _id = await insertProduct();
      await patchProduct(_id, {
        $push: {
          'main.items': html('<b>refused</b>')
        }
      });
      const product = await getProduct(_id);
      assert.deepEqual(
        product.main.items.map(item => item.type),
        [ '@apostrophecms/rich-text' ]
      );
    });

    it('drops a disallowed widget nested inside a pushed widget and reports success', async function() {
      const _id = await insertProduct();
      const pushed = twoColumn([ richText('kept'), html('<b>refused</b>') ]);
      await patchProduct(_id, {
        $push: {
          'main.items': pushed
        }
      });
      const product = await getProduct(_id);
      const [ , column ] = product.main.items;
      assert.equal(column._id, pushed._id);
      assert.deepEqual(
        column.one.items.map(item => item.type),
        [ '@apostrophecms/rich-text' ]
      );
    });

    it('drops a pushed relationship id that does not resolve and reports success', async function() {
      const _id = await insertProduct();
      await patchProduct(_id, {
        $push: {
          _articles: { _id: articleId }
        }
      });
      await patchProduct(_id, {
        $push: {
          _articles: { _id: 'no-such-article' }
        }
      });
      const product = await getProduct(_id);
      assert.deepEqual(product._articles.map(article => article._id), [ articleId ]);
    });

    it('heals a stored widget the area no longer allows when a patch touches the area', async function() {
      const _id = await insertProduct([ richText('first'), html('<b>stale</b>') ]);
      await patchProduct(_id, {
        $push: {
          'main.items': richText('pushed')
        }
      });
      const product = await getProduct(_id);
      assert.deepEqual(
        product.main.items.map(item => item.content),
        [ '<p>first</p>', '<p>pushed</p>' ]
      );
    });

    it('heals a stored widget whose type no longer exists when a patch touches the area', async function() {
      const _id = await insertProduct([
        richText('first'),
        {
          _id: apos.util.generateId(),
          metaType: 'widget',
          type: 'removed'
        }
      ]);
      await patchProduct(_id, {
        $push: {
          'main.items': richText('pushed')
        }
      });
      const product = await getProduct(_id);
      assert.deepEqual(
        product.main.items.map(item => item.content),
        [ '<p>first</p>', '<p>pushed</p>' ]
      );
    });

    it('drops a disallowed widget pushed into a page and reports success', async function() {
      const req = apos.task.getReq();
      const home = await apos.page.find(req, { level: 0 }).toObject();
      req.body = {
        $push: {
          'main.items': html('<b>refused</b>')
        }
      };
      await apos.page.patch(req, home._id);
      const patched = await apos.page.findOneForEditing(req, { _id: home._id });
      assert.deepEqual(patched.main.items, []);
    });

  });

  describe('without a flag, beyond conversion drops', function() {

    it('ignores a write to a read only field and reports success', async function() {
      const _id = await insertProduct(undefined, { code: 'A' });
      await patchProduct(_id, { code: 'B' });
      const product = await getProduct(_id);
      assert.equal(product.code, 'A');
    });

    it('cuts pushed items past an array limit and reports success', async function() {
      const _id = await insertProduct(undefined, {
        list: [ listItem('a'), listItem('b') ]
      });
      await patchProduct(_id, {
        $push: {
          list: listItem('c')
        }
      });
      const product = await getProduct(_id);
      assert.deepEqual(product.list.map(item => item.label), [ 'a', 'b' ]);
    });

    it('cuts a stored item when a push at the front passes the limit', async function() {
      const _id = await insertProduct(undefined, {
        list: [ listItem('a'), listItem('b') ]
      });
      await patchProduct(_id, {
        $push: {
          list: {
            $each: [ listItem('c') ],
            $position: 0
          }
        }
      });
      const product = await getProduct(_id);
      assert.deepEqual(product.list.map(item => item.label), [ 'c', 'a' ]);
    });

    it('ignores a push to a relationship the user cannot view and reports success', async function() {
      const _id = await insertProduct();
      const admin = await apos.user.find(apos.task.getReq(), { username: 'admin' }).toObject();
      await patchProduct(_id, {
        $push: {
          _owners: { _id: admin._id }
        }
      }, apos.task.getReq({ role: 'editor' }));
      const product = await getProduct(_id);
      assert.deepEqual(product._owners, []);
    });

  });

  describe('with the lossless flag', function() {

    it('refuses a pushed widget the area does not allow, naming it', async function() {
      const _id = await insertProduct();
      const pushed = html('<b>refused</b>');
      const e = await refusal(patchProduct(_id, {
        $push: {
          'main.items': pushed
        },
        _lossless: true
      }));
      assert.equal(e.name, 'invalid');
      assert.match(e.message, /main\.items\.1 \(notAllowed\)/);
      assert.deepEqual(e.data.drops, [
        {
          path: 'main.items.1',
          reason: 'notAllowed',
          type: '@apostrophecms/html',
          _id: pushed._id
        }
      ]);
      const product = await getProduct(_id);
      assert.deepEqual(
        product.main.items.map(item => item.content),
        [ '<p>first</p>' ]
      );
    });

    it('refuses a disallowed widget nested inside a pushed widget', async function() {
      const _id = await insertProduct();
      const nested = html('<b>refused</b>');
      const e = await refusal(patchProduct(_id, {
        $push: {
          'main.items': twoColumn([ richText('kept'), nested ])
        },
        _lossless: true
      }));
      assert.equal(e.name, 'invalid');
      assert.deepEqual(e.data.drops, [
        {
          path: 'main.items.1.one.items.1',
          reason: 'notAllowed',
          type: '@apostrophecms/html',
          _id: nested._id
        }
      ]);
      const product = await getProduct(_id);
      assert.equal(product.main.items.length, 1);
    });

    it('refuses a widget pushed with $each and $position', async function() {
      const _id = await insertProduct([ richText('first'), richText('last') ]);
      const e = await refusal(patchProduct(_id, {
        $push: {
          'main.items': {
            $each: [ richText('kept'), html('<b>refused</b>') ],
            $position: 1
          }
        },
        _lossless: true
      }));
      assert.equal(e.name, 'invalid');
      assert.deepEqual(e.data.drops.map(drop => drop.path), [ 'main.items.2' ]);
    });

    it('refuses a pushed relationship id that does not resolve, naming it', async function() {
      const _id = await insertProduct();
      await patchProduct(_id, {
        $push: {
          _articles: { _id: articleId }
        },
        _lossless: true
      });
      const e = await refusal(patchProduct(_id, {
        $push: {
          _articles: { _id: 'no-such-article' }
        },
        _lossless: true
      }));
      assert.equal(e.name, 'invalid');
      assert.match(e.message, /_articles\.1 \(notFound\)/);
      assert.deepEqual(e.data.drops, [
        {
          path: '_articles.1',
          reason: 'notFound',
          _id: 'no-such-article'
        }
      ]);
      const product = await getProduct(_id);
      assert.deepEqual(product._articles.map(article => article._id), [ articleId ]);
    });

    it('refuses a widget replaced by @ reference that the area does not allow', async function() {
      const first = richText('first');
      const _id = await insertProduct([ first ]);
      const e = await refusal(patchProduct(_id, {
        [`@${first._id}`]: html('<b>refused</b>'),
        _lossless: true
      }));
      assert.equal(e.name, 'invalid');
      assert.deepEqual(e.data.drops.map(drop => drop.path), [ 'main.items.0' ]);
    });

    it('refuses a disallowed widget inside a widget replaced by @ reference', async function() {
      const column = twoColumn([ richText('first') ]);
      const _id = await insertProduct([ column ]);
      let shortcut;
      const superPatchWidgetIfSuitable = apos.schema.patchWidgetIfSuitable;
      apos.schema.patchWidgetIfSuitable = async (...args) => {
        shortcut = await superPatchWidgetIfSuitable(...args);
        return shortcut;
      };
      try {
        const e = await refusal(patchProduct(_id, {
          [`@${column._id}`]: {
            ...column,
            one: {
              metaType: 'area',
              items: [ richText('kept'), html('<b>refused</b>') ]
            }
          },
          _lossless: true
        }));
        assert.equal(shortcut, true);
        assert.equal(e.name, 'invalid');
        assert.deepEqual(
          e.data.drops.map(drop => drop.path),
          [ 'main.items.0.one.items.1' ]
        );
      } finally {
        apos.schema.patchWidgetIfSuitable = superPatchWidgetIfSuitable;
      }
    });

    it('refuses a disallowed widget in an area set by dot path', async function() {
      const column = twoColumn([ richText('first') ]);
      const _id = await insertProduct([ column ]);
      const e = await refusal(patchProduct(_id, {
        'main.items.0.one': {
          metaType: 'area',
          items: [ html('<b>refused</b>') ]
        },
        _lossless: true
      }));
      assert.equal(e.name, 'invalid');
      assert.deepEqual(
        e.data.drops.map(drop => drop.path),
        [ 'main.items.0.one.items.0' ]
      );
    });

    it('heals a stored widget the area no longer allows and records the drop', async function() {
      const stale = html('<b>stale</b>');
      const _id = await insertProduct([ richText('first'), stale ]);
      const req = apos.task.getReq();
      await patchProduct(_id, {
        $push: {
          'main.items': richText('pushed')
        },
        _lossless: true
      }, req);
      const product = await getProduct(_id);
      assert.deepEqual(
        product.main.items.map(item => item.content),
        [ '<p>first</p>', '<p>pushed</p>' ]
      );
      assert.deepEqual(req.aposHealedDrops, {
        [_id]: [
          {
            path: 'main.items.1',
            reason: 'notAllowed',
            type: '@apostrophecms/html',
            _id: stale._id
          }
        ]
      });
    });

    it('heals a stored widget whose type no longer exists and records the drop', async function() {
      const stale = {
        _id: apos.util.generateId(),
        metaType: 'widget',
        type: 'removed'
      };
      const _id = await insertProduct([ stale, richText('last') ]);
      const req = apos.task.getReq();
      await patchProduct(_id, {
        $push: {
          'main.items': {
            $each: [ richText('pushed') ],
            $position: 0
          }
        },
        _lossless: true
      }, req);
      const product = await getProduct(_id);
      assert.deepEqual(
        product.main.items.map(item => item.content),
        [ '<p>pushed</p>', '<p>last</p>' ]
      );
      assert.deepEqual(req.aposHealedDrops[_id], [
        {
          path: 'main.items.1',
          reason: 'unknownType',
          type: 'removed',
          _id: stale._id
        }
      ]);
    });

    it('saves a headline beside an unrelated empty required field', async function() {
      const _id = await insertProduct(undefined, { summary: '' });
      const req = apos.task.getReq();
      await patchProduct(_id, {
        title: 'New headline',
        _lossless: true
      }, req);
      const product = await getProduct(_id);
      assert.equal(product.title, 'New headline');
      assert.equal(product.summary, '');
      assert.equal(req.aposHealedDrops, undefined);
    });

    it('refuses a disallowed widget pushed into a page', async function() {
      const req = apos.task.getReq();
      const home = await apos.page.find(req, { level: 0 }).toObject();
      req.body = {
        $push: {
          'main.items': html('<b>refused</b>')
        },
        _lossless: true
      };
      const e = await refusal(apos.page.patch(req, home._id));
      assert.equal(e.name, 'invalid');
      assert.deepEqual(e.data.drops.map(drop => drop.path), [ 'main.items.0' ]);
    });

    it('is accepted by the REST API', async function() {
      const _id = await insertProduct();
      const e = await refusal(apos.http.patch(`/api/v1/product/${_id}`, {
        body: {
          $push: {
            'main.items': html('<b>refused</b>')
          },
          _lossless: true
        },
        jar
      }));
      assert.equal(e.status, 400);
      assert.equal(e.body.name, 'invalid');
      assert.deepEqual(e.body.data.drops.map(drop => drop.path), [ 'main.items.1' ]);
    });

    it('refuses a write to a read only field', async function() {
      const _id = await insertProduct(undefined, { code: 'A' });
      const e = await refusal(patchProduct(_id, {
        code: 'B',
        _lossless: true
      }));
      assert.equal(e.name, 'invalid');
      assert.deepEqual(e.data.drops, [
        {
          path: 'code',
          reason: 'readOnly'
        }
      ]);
    });

    it('refuses a push into a read only area', async function() {
      const _id = await insertProduct(undefined, {
        locked: {
          _id: apos.util.generateId(),
          metaType: 'area',
          items: []
        }
      });
      const e = await refusal(patchProduct(_id, {
        $push: {
          'locked.items': richText('refused')
        },
        _lossless: true
      }));
      assert.equal(e.name, 'invalid');
      assert.deepEqual(e.data.drops, [
        {
          path: 'locked',
          reason: 'readOnly'
        }
      ]);
    });

    it('saves a read only field passed back as stored', async function() {
      const _id = await insertProduct(undefined, { code: 'A' });
      const req = apos.task.getReq();
      await patchProduct(_id, {
        title: 'Renamed',
        code: 'A',
        _lossless: true
      }, req);
      const product = await getProduct(_id);
      assert.equal(product.title, 'Renamed');
      assert.equal(req.aposHealedDrops, undefined);
    });

    it('refuses a push past an array limit', async function() {
      const _id = await insertProduct(undefined, {
        list: [ listItem('a'), listItem('b') ]
      });
      const e = await refusal(patchProduct(_id, {
        $push: {
          list: listItem('c')
        },
        _lossless: true
      }));
      assert.equal(e.name, 'invalid');
      assert.deepEqual(e.data.drops, [
        {
          path: 'list',
          reason: 'limit'
        }
      ]);
    });

    it('refuses a push at the front that would cut a stored item', async function() {
      const _id = await insertProduct(undefined, {
        list: [ listItem('a'), listItem('b') ]
      });
      const e = await refusal(patchProduct(_id, {
        $push: {
          list: {
            $each: [ listItem('c') ],
            $position: 0
          }
        },
        _lossless: true
      }));
      assert.equal(e.name, 'invalid');
      assert.deepEqual(e.data.drops.map(drop => drop.path), [ 'list' ]);
      const product = await getProduct(_id);
      assert.deepEqual(product.list.map(item => item.label), [ 'a', 'b' ]);
    });

    it('heals the items of an array already past its limit and records them', async function() {
      const extra = listItem('c');
      const _id = await insertProduct(undefined, {
        list: [ listItem('a'), listItem('b'), extra ]
      });
      const req = apos.task.getReq();
      await patchProduct(_id, {
        'list.0.label': 'A',
        _lossless: true
      }, req);
      const product = await getProduct(_id);
      assert.deepEqual(product.list.map(item => item.label), [ 'A', 'b' ]);
      assert.deepEqual(req.aposHealedDrops[_id], [
        {
          path: 'list.2',
          reason: 'limit',
          _id: extra._id
        }
      ]);
    });

    it('refuses a push to a relationship the user cannot view', async function() {
      const _id = await insertProduct();
      const admin = await apos.user.find(apos.task.getReq(), { username: 'admin' }).toObject();
      const e = await refusal(patchProduct(_id, {
        $push: {
          _owners: { _id: admin._id }
        },
        _lossless: true
      }, apos.task.getReq({ role: 'editor' })));
      assert.equal(e.name, 'invalid');
      assert.deepEqual(e.data.drops, [
        {
          path: '_owners',
          reason: 'forbidden'
        }
      ]);
    });

  });

  describe('read only widget fields', function() {

    it('keep their stored value when a patch pushes into the area', async function() {
      const _id = await insertProduct([ stamp('first') ]);
      await patchProduct(_id, {
        $push: {
          'main.items': richText('pushed')
        }
      });
      const product = await getProduct(_id);
      assert.equal(product.main.items[0].stamp, 'KEEP');
    });

    it('keep their stored value under the lossless flag, with nothing recorded', async function() {
      const _id = await insertProduct([ stamp('first') ]);
      const req = apos.task.getReq();
      await patchProduct(_id, {
        $push: {
          'main.items': richText('pushed')
        },
        _lossless: true
      }, req);
      const product = await getProduct(_id);
      assert.equal(product.main.items[0].stamp, 'KEEP');
      assert.equal(req.aposHealedDrops, undefined);
    });

    it('keep their stored value in a widget nested in another widget', async function() {
      const _id = await insertProduct([ twoColumn([ stamp('nested') ]) ]);
      await patchProduct(_id, {
        $push: {
          'main.items': richText('pushed')
        }
      });
      const product = await getProduct(_id);
      assert.equal(product.main.items[0].one.items[0].stamp, 'KEEP');
    });

    it('allow a lossless @ reference replacement carrying the stored value', async function() {
      const widget = stamp('first');
      const _id = await insertProduct([ widget ]);
      await patchProduct(_id, {
        [`@${widget._id}`]: {
          ...widget,
          label: 'changed'
        },
        _lossless: true
      });
      const product = await getProduct(_id);
      assert.equal(product.main.items[0].label, 'changed');
      assert.equal(product.main.items[0].stamp, 'KEEP');
    });

    it('never take a value from the input', async function() {
      const widget = stamp('first');
      const _id = await insertProduct([ widget ]);
      await patchProduct(_id, {
        [`@${widget._id}`]: {
          ...widget,
          stamp: 'CHANGED'
        }
      });
      const product = await getProduct(_id);
      assert.equal(product.main.items[0].stamp, 'KEEP');
      const e = await refusal(patchProduct(_id, {
        [`@${widget._id}`]: {
          ...widget,
          stamp: 'CHANGED'
        },
        _lossless: true
      }));
      assert.equal(e.name, 'invalid');
      assert.deepEqual(e.data.drops, [
        {
          path: 'main.items.0.stamp',
          reason: 'readOnly'
        }
      ]);
    });

    it('keep a field beyond the user\'s permissions as stored', async function() {
      const _id = await insertProduct([ stamp('first') ]);
      await patchProduct(_id, {
        $push: {
          'main.items': richText('pushed')
        }
      }, apos.task.getReq({ role: 'editor' }));
      const product = await getProduct(_id);
      assert.equal(product.main.items[0].secret, 'SECRET');
    });

  });

});
