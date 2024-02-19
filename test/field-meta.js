const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('Field Meta', function () {
  let apos;

  this.timeout(t.timeout);

  before(async function () {
    apos = await t.create({
      root: module,
      modules: {}
    });
  });

  after(function () {
    return t.destroy(apos);
  });

  it('should validate arguments when getting meta path for a field', function () {
    assert.throws(() => apos.doc.getMetaPath(), {
      name: 'invalid',
      data: {
        cause: 'invalidArguments'
      }
    });
    assert.throws(() => apos.doc.getMetaPath({}), {
      name: 'invalid',
      data: {
        cause: 'subObjectNoId'
      }
    });
    assert.throws(() => apos.doc.getMetaPath('string', 10), {
      name: 'invalid',
      data: {
        cause: 'invalidArguments'
      }
    });
  });

  it('should get meta path for a field', function () {
    assert.equal(apos.doc.getMetaPath('title'), 'title');
    assert.equal(apos.doc.getMetaPath(undefined, 'title'), 'title');
    assert.equal(apos.doc.getMetaPath(null, 'title'), 'title');
    assert.equal(apos.doc.getMetaPath('address.city'), 'address.city');
    assert.equal(apos.doc.getMetaPath('address', 'city'), 'address.aposMeta.city');
    assert.equal(
      apos.doc.getMetaPath('address', 'city', 'name'),
      'address.aposMeta.city.aposMeta.name'
    );
    assert.equal(
      apos.doc.getMetaPath({ _id: 'someid' }),
      '@someid'
    );
    assert.equal(
      apos.doc.getMetaPath({ _id: 'someid' }, 'title'),
      '@someid.aposMeta.title'
    );
    assert.equal(
      apos.doc.getMetaPath({ _id: 'someid' }, 'address', 'city', 'name'),
      '@someid.aposMeta.address.aposMeta.city.aposMeta.name'
    );
    assert.equal(
      apos.doc.getMetaPath(undefined, 'address', null, 'city', undefined, 'name'),
      'address.aposMeta.city.aposMeta.name'
    );
  });

  it('should validate arguments when setting meta value for a field', function () {
    const doc = {};
    const ns = 'a-module';
    assert.throws(() => apos.doc.setMeta(), {
      name: 'invalid',
      data: {
        cause: 'invalidArguments'
      }
    });
    assert.throws(() => apos.doc.setMeta(doc, ns), {
      name: 'invalid',
      data: {
        cause: 'invalidArguments'
      }
    });
    assert.throws(() => apos.doc.setMeta(doc, ns, 'title'), {
      name: 'invalid',
      data: {
        cause: 'invalidArguments'
      }
    });
    assert.throws(() => apos.doc.setMeta(doc, ns, 'title', 'value'), {
      name: 'invalid',
      data: {
        cause: 'invalidArguments'
      }
    });
    assert.throws(() => apos.doc.setMeta(doc, ns, 10, 'key', 'value'), {
      name: 'invalid',
      data: {
        cause: 'invalidArguments'
      }
    });
    assert.throws(() => apos.doc.setMeta(doc, ns, 'title', 10, 'value'), {
      name: 'invalid',
      data: {
        cause: 'invalidArguments'
      }
    });
    assert.throws(() => apos.doc.setMeta(doc, ns, {}), {
      name: 'invalid'
    });
    assert.throws(() => apos.doc.setMeta(doc, ns, {}, 'key', 'value'), {
      name: 'invalid',
      data: {
        cause: 'subObjectNoId'
      }
    });
  });

  it('should set meta value for a field', function () {
    const doc = {};
    const ns = 'my-module';

    apos.doc.setMeta(doc, ns, 'title', 'testKey', 'Hello');
    apos.doc.setMeta(doc, ns, 'address.country', 'testKey', 'France');
    apos.doc.setMeta(doc, ns, 'address', 'city', 'name', 'testKey', 'Paris');
    apos.doc.setMeta(doc, ns, 'address', 'city', 'name', 'testKey.dotPath', 'Dot path ignored');
    apos.doc.setMeta(doc, ns, { _id: 'aWidgetOrArrayItemId' }, 'title', 'testKey', 'World');
    apos.doc.setMeta(doc, ns, { _id: 'aWidgetOrArrayItemId' }, 'testKey', 'World');

    assert.deepEqual(doc, {
      aposMeta: {
        title: { 'my-module:testKey': 'Hello' },
        address: {
          country: { 'my-module:testKey': 'France' },
          aposMeta: {
            city: {
              aposMeta: {
                name: {
                  'my-module:testKey': 'Paris',
                  'my-module:testKey.dotPath': 'Dot path ignored'
                }
              }
            }
          }
        },
        '@aWidgetOrArrayItemId': {
          aposMeta: { title: { 'my-module:testKey': 'World' } },
          'my-module:testKey': 'World'
        }
      }
    });
  });

  it('should validate arguments when getting meta value for a field', function () {
    const doc = {};
    const ns = 'a-module';

    assert.throws(() => apos.doc.getMeta(), {
      name: 'invalid',
      data: {
        cause: 'invalidArguments'
      }
    });
    assert.throws(() => apos.doc.getMeta(doc, ns), {
      name: 'invalid',
      data: {
        cause: 'invalidArguments'
      }
    });
    assert.throws(() => apos.doc.getMeta(doc, ns, 'title'), {
      name: 'invalid',
      data: {
        cause: 'invalidArguments'
      }
    });
    assert.throws(() => apos.doc.getMeta(doc, ns, 10, 'key'), {
      name: 'invalid',
      data: {
        cause: 'invalidArguments'
      }
    });
    assert.throws(() => apos.doc.getMeta(doc, ns, 'title', 10), {
      name: 'invalid',
      data: {
        cause: 'invalidArguments'
      }
    });
    assert.throws(() => apos.doc.getMeta(doc, ns, {}), {
      name: 'invalid',
      data: {
        cause: 'invalidArguments'
      }
    });
    assert.throws(() => apos.doc.getMeta(doc, ns, {}, 'key'), {
      name: 'invalid',
      data: {
        cause: 'subObjectNoId'
      }
    });
  });

  it('should get meta value for a field', function () {
    const doc = {};
    const ns = 'my-module';

    apos.doc.setMeta(doc, ns, 'title', 'testKey', 'Hello');
    assert.equal(apos.doc.getMeta(doc, ns, 'title', 'testKey'), 'Hello');

    apos.doc.setMeta(doc, ns, 'address.country', 'testKey', 'France');
    assert.equal(apos.doc.getMeta(doc, ns, 'address.country', 'testKey'), 'France');

    apos.doc.setMeta(doc, ns, 'address', 'city', 'name', 'testKey', 'Paris');
    assert.equal(apos.doc.getMeta(doc, ns, 'address', 'city', 'name', 'testKey'), 'Paris');

    apos.doc.setMeta(doc, ns, 'address', 'city', 'name', 'testKey.dotPath', 'Dot path ignored');
    assert.equal(apos.doc.getMeta(doc, ns, 'address', 'city', 'name', 'testKey.dotPath'), 'Dot path ignored');

    apos.doc.setMeta(doc, ns, { _id: 'aWidgetOrArrayItemId' }, 'title', 'testKey', 'World');
    assert.equal(apos.doc.getMeta(doc, ns, { _id: 'aWidgetOrArrayItemId' }, 'title', 'testKey'), 'World');

    apos.doc.setMeta(doc, ns, { _id: 'aWidgetOrArrayItemId' }, 'testKey', 'World');
    assert.equal(apos.doc.getMeta(doc, ns, { _id: 'aWidgetOrArrayItemId' }, 'testKey'), 'World');
  });

  it('should remove meta key for a field and cleanup', function () {
    const doc = {
      _id: 'doNotDeleteMe',
      title: 'Do not delete me',
      slug: 'do-not-delete-me'
    };
    const ns = 'my-module';

    apos.doc.setMeta(doc, ns, 'title', 'testKey', 'Hello');
    apos.doc.setMeta(doc, ns, 'address.country', 'testKey', 'France');
    apos.doc.setMeta(doc, ns, 'address', 'city', 'name', 'testKey', 'Paris');
    apos.doc.setMeta(doc, ns, 'address', 'city', 'name', 'testKey.dotPath', 'Dot path ignored');
    apos.doc.setMeta(doc, ns, { _id: 'aWidgetOrArrayItemId' }, 'title', 'testKey', 'World');
    apos.doc.setMeta(doc, ns, { _id: 'aWidgetOrArrayItemId' }, 'testKey', 'World');

    apos.doc.removeMeta(doc, ns, 'title', 'testKey');
    assert.equal(apos.doc.getMeta(doc, ns, 'title', 'testKey'), undefined);

    apos.doc.removeMeta(doc, ns, 'address.country', 'testKey');
    assert.equal(apos.doc.getMeta(doc, ns, 'address.country', 'testKey'), undefined);

    apos.doc.removeMeta(doc, ns, 'address', 'city', 'name', 'testKey');
    assert.equal(apos.doc.getMeta(doc, ns, 'address', 'city', 'name', 'testKey'), undefined);

    apos.doc.removeMeta(doc, ns, 'address', 'city', 'name', 'testKey.dotPath');
    assert.equal(apos.doc.getMeta(doc, ns, 'address', 'city', 'name', 'testKey.dotPath'), undefined);

    apos.doc.removeMeta(doc, ns, 'address', 'city', 'name', 'testKey.dotPath');
    assert.equal(apos.doc.getMeta(doc, ns, 'address', 'city', 'name', 'testKey.dotPath'), undefined);

    apos.doc.removeMeta(doc, ns, { _id: 'aWidgetOrArrayItemId' }, 'title', 'testKey');
    assert.equal(apos.doc.getMeta(doc, ns, { _id: 'aWidgetOrArrayItemId' }, 'title', 'testKey'), undefined);

    apos.doc.removeMeta(doc, ns, { _id: 'aWidgetOrArrayItemId' }, 'testKey');
    assert.equal(apos.doc.getMeta(doc, ns, { _id: 'aWidgetOrArrayItemId' }, 'testKey'), undefined);

    assert.deepEqual(doc, {
      _id: 'doNotDeleteMe',
      title: 'Do not delete me',
      slug: 'do-not-delete-me',
      aposMeta: {}
    });
  });

  it('should be able to retrieve and manipulate meta by path', function () {

    const doc = {};
    const ns = 'my-module';

    const titleMetaPath = apos.doc.getMetaPath('title');
    const addressCountryMetaPath = apos.doc.getMetaPath('address.country');
    const addressCityNameMetaPath = apos.doc.getMetaPath('address', 'city', 'name');
    const addressCityNameDotPathMetaPath = apos.doc.getMetaPath('address', 'city', 'name');
    const widgetMetaPath = apos.doc.getMetaPath({ _id: 'aWidgetOrArrayItemId' }, 'title');
    const widgetTestKeyMetaPath = apos.doc.getMetaPath({ _id: 'aWidgetOrArrayItemId' });

    apos.doc.setMeta(doc, ns, titleMetaPath, 'testKey', 'Hello');
    apos.doc.setMeta(doc, ns, addressCountryMetaPath, 'testKey', 'France');
    apos.doc.setMeta(doc, ns, addressCityNameMetaPath, 'testKey', 'Paris');
    apos.doc.setMeta(doc, ns, addressCityNameDotPathMetaPath, 'testKey.dotPath', 'Dot path ignored');
    apos.doc.setMeta(doc, ns, widgetMetaPath, 'testKey', 'World');
    apos.doc.setMeta(doc, ns, widgetTestKeyMetaPath, 'testKey', 'World');

    assert.equal(apos.doc.getMeta(doc, ns, titleMetaPath, 'testKey'), 'Hello');
    assert.equal(apos.doc.getMeta(doc, ns, addressCountryMetaPath, 'testKey'), 'France');
    assert.equal(apos.doc.getMeta(doc, ns, addressCityNameMetaPath, 'testKey'), 'Paris');
    assert.equal(
      apos.doc.getMeta(doc, ns, addressCityNameDotPathMetaPath, 'testKey.dotPath'),
      'Dot path ignored'
    );
    assert.equal(apos.doc.getMeta(doc, ns, widgetMetaPath, 'testKey'), 'World');
    assert.equal(apos.doc.getMeta(doc, ns, widgetTestKeyMetaPath, 'testKey'), 'World');

    assert.deepEqual(doc, {
      aposMeta: {
        title: { 'my-module:testKey': 'Hello' },
        address: {
          country: { 'my-module:testKey': 'France' },
          aposMeta: {
            city: {
              aposMeta: {
                name: {
                  'my-module:testKey': 'Paris',
                  'my-module:testKey.dotPath': 'Dot path ignored'
                }
              }
            }
          }
        },
        '@aWidgetOrArrayItemId': {
          aposMeta: { title: { 'my-module:testKey': 'World' } },
          'my-module:testKey': 'World'
        }
      }
    });

    apos.doc.removeMeta(doc, ns, titleMetaPath, 'testKey');
    apos.doc.removeMeta(doc, ns, addressCountryMetaPath, 'testKey');
    apos.doc.removeMeta(doc, ns, addressCityNameMetaPath, 'testKey');
    apos.doc.removeMeta(doc, ns, addressCityNameDotPathMetaPath, 'testKey.dotPath');
    apos.doc.removeMeta(doc, ns, widgetMetaPath, 'testKey');
    apos.doc.removeMeta(doc, ns, widgetTestKeyMetaPath, 'testKey');

    assert.deepEqual(doc, {
      aposMeta: {}
    });
  });

  it('should retrieve meta keys for a field', function () {
    const doc = {};
    const ns = 'my-module';
    const ns2 = 'other-module';

    apos.doc.setMeta(doc, ns, 'title', 'testKey', 'Hello');
    apos.doc.setMeta(doc, ns, 'title', 'testKey2', 'Hello');
    apos.doc.setMeta(doc, ns2, 'title', 'testKey3', 'Hello');

    apos.doc.setMeta(doc, ns, 'address.country', 'testKey', 'France');
    apos.doc.setMeta(doc, ns2, 'address.country', 'testKey2', 'France');

    apos.doc.setMeta(doc, ns, 'address', 'city', 'name', 'testKey', 'Paris');
    apos.doc.setMeta(doc, ns2, 'address', 'city', 'name', 'testKey2', 'Paris');

    apos.doc.setMeta(doc, ns, 'address', 'city', 'name', 'testKey.dotPath', 'Dot path ignored');
    apos.doc.setMeta(doc, ns2, 'address', 'city', 'name', 'testKey2.dotPath', 'Dot path ignored');

    apos.doc.setMeta(doc, ns, { _id: 'aWidgetOrArrayItemId' }, 'title', 'testKey', 'World');
    apos.doc.setMeta(doc, ns2, { _id: 'aWidgetOrArrayItemId' }, 'title2', 'testKey', 'World');

    apos.doc.setMeta(doc, ns, { _id: 'aWidgetOrArrayItemId' }, 'testKey', 'World');
    apos.doc.setMeta(doc, ns2, { _id: 'aWidgetOrArrayItemId' }, 'testKey2S', 'World');

    assert.deepEqual(apos.doc.getMetaKeys(doc, ns, 'title'), [ 'testKey', 'testKey2' ]);
    assert.deepEqual(apos.doc.getMetaKeys(doc, ns, 'address.country'), [ 'testKey' ]);
    assert.deepEqual(apos.doc.getMetaKeys(doc, ns, 'address', 'city', 'name'), [ 'testKey', 'testKey.dotPath' ]);
    assert.deepEqual(apos.doc.getMetaKeys(doc, ns, { _id: 'aWidgetOrArrayItemId' }, 'title'), [ 'testKey' ]);
    assert.deepEqual(apos.doc.getMetaKeys(doc, ns, { _id: 'aWidgetOrArrayItemId' }), [ 'testKey' ]);
  });
});
