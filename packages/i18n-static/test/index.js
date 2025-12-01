const handlers = require('../handlers');
const assert = require('assert').strict;
const t = require('apostrophe/test-lib/util.js');

describe.skip('I18n-static', function() {
  this.timeout(20000);
  let apos;

  after(function () {
    return t.destroy(apos);
  });

  before(async function () {
    apos = await t.create({
      root: module,
      baseUrl: 'http://localhost:3000',
      testModule: true,
      modules: {
        '@apostrophecms/express': {
          options: {
            session: { secret: 'supersecret' }
          }
        },
        '@apostrophecms/i18n-static': {}
      }
    });
  });

  it('should get namespaces', function () {
    const actual = apos.modules['@apostrophecms/i18n-static'].getNamespaces();
    const expected = [
      {
        label: 'default',
        value: 'default'
      },
      {
        label: 'apostrophe',
        value: 'apostrophe'
      },
      {
        label: 'aposI18nStatic',
        value: 'aposI18nStatic'
      }
    ];

    assert.deepEqual(actual, expected);
  });

  it('should exclude namespaces', function () {
    apos.modules['@apostrophecms/i18n-static'].options.excludeNamespaces = [ 'apostrophe' ];
    const actual = apos.modules['@apostrophecms/i18n-static'].getNamespaces();
    const expected = [
      {
        label: 'default',
        value: 'default'
      },
      {
        label: 'aposI18nStatic',
        value: 'aposI18nStatic'
      }
    ];

    assert.deepEqual(actual, expected);
  });

  it('should format pieces', function () {
    const pieces = [
      {
        title: 'test',
        namespace: 'default',
        valueSingular: 'test singular',
        valuePlural: 'test plural',
        valueZero: 'test zero'
      },
      {
        title: 'test 1',
        namespace: 'default',
        valueSingular: 'test singular',
        valuePlural: 'test plural',
        valuePluralFew: 'test few'
      }
    ];
    const actual = apos.modules['@apostrophecms/i18n-static'].formatPieces(pieces);
    const expected = {
      test: 'test singular',
      test_plural: 'test plural',
      test_zero: 'test zero',
      'test 1': 'test singular',
      'test 1_plural': 'test plural',
      'test 1_few': 'test few'
    };

    assert.deepEqual(actual, expected);
  });

  it('should find pieces and group them by namespace', async function () {
    const expected = [
      {
        _id: 'apostrophe',
        pieces: [ {
          title: 'label',
          namespace: 'aposI18nStatic',
          valueSingular: 'I18n Static Phrase',
          type: '@apostrophecms/i18n-static',
          aposLocale: 'en:draft',
          aposMode: 'draft',
          metaType: 'doc',
          slug: 'label'
        } ]
      },
      {
        _id: 'aposI18nStatic',
        pieces: [ {
          title: 'label',
          namespace: 'aposI18nStatic',
          valueSingular: 'I18n Static Phrase',
          type: '@apostrophecms/i18n-static',
          aposLocale: 'en:draft',
          aposMode: 'draft',
          metaType: 'doc',
          slug: 'label'
        } ]
      }
    ];
    const actual = await apos.modules['@apostrophecms/i18n-static'].findPiecesAndGroupByNamespace('en:draft');
    const aposI18nStaticNamespace = actual.find(item => item._id === 'aposI18nStatic');

    assert.equal(actual.length, expected.length);
    assert.equal(aposI18nStaticNamespace._id, 'aposI18nStatic');
  });

  it('should add missing pieces', async function () {
    const self = {
      options: {
        excludeNamespaces: [ 'aposI18nStatic' ]
      },
      apos,
      find: apos.modules['@apostrophecms/i18n-static'].find,
      formatPieces: apos.modules['@apostrophecms/i18n-static'].formatPieces,
      findPiecesAndGroupByNamespace: apos.modules['@apostrophecms/i18n-static'].findPiecesAndGroupByNamespace,
      generateNewGlobalIdAndUpdateCache: apos.modules['@apostrophecms/i18n-static'].generateNewGlobalIdAndUpdateCache
    };
    const expected = true;
    const actual = await handlers(self)['apostrophe:modulesRegistered'].addMissingPieces();

    assert.equal(actual, expected);
  });

  it('should generate a new i18nStaticId when an i18n-static piece is updated', async function () {
    const self = {
      apos,
      schema: [
        {
          name: 'title',
          label: 'aposI18nStatic:key',
          type: 'string',
          required: true
        },
        {
          name: 'namespace',
          label: 'aposI18nStatic:namespace',
          type: 'select',
          choices: 'getNamespaces',
          def: 'default',
          required: true
        },
        {
          name: 'valueSingular',
          label: 'aposI18nStatic:valueSingular',
          type: 'string',
          required: true,
          i18nValue: true
        }
      ],
      findPiecesAndGroupByNamespace: apos.modules['@apostrophecms/i18n-static'].findPiecesAndGroupByNamespace,
      generateNewGlobalIdAndUpdateCache: apos.modules['@apostrophecms/i18n-static'].generateNewGlobalIdAndUpdateCache
    };
    const piece = {
      title: 'label',
      namespace: 'aposI18nStatic',
      valueSingular: 'I18n Static Phrase',
      type: '@apostrophecms/i18n-static',
      aposLocale: 'en:draft',
      aposMode: 'draft',
      metaType: 'doc',
      slug: 'label'
    };
    const req = apos.task.getReq();
    const firstId = await handlers(self).afterSave.handleSave(req, piece);
    const secondId = await handlers(self).afterSave.handleSave(req, piece);

    assert.notEqual(firstId, secondId);
  });

  it('should get initial values from JSON files', async function() {
    const text = await apos.http.get('/');
    assert(text.match(/test 2: test of the second translation key/));
  });

  it('should get updated values from i18n-static', async function() {
    const self = {
      apos,
      schema: [
        {
          name: 'title',
          label: 'aposI18nStatic:key',
          type: 'string',
          required: true
        },
        {
          name: 'namespace',
          label: 'aposI18nStatic:namespace',
          type: 'select',
          choices: 'getNamespaces',
          def: 'default',
          required: true
        },
        {
          name: 'valueSingular',
          label: 'aposI18nStatic:valueSingular',
          type: 'string',
          required: true,
          i18nValue: true
        }
      ],
      findPiecesAndGroupByNamespace: apos.modules['@apostrophecms/i18n-static'].findPiecesAndGroupByNamespace,
      generateNewGlobalIdAndUpdateCache: apos.modules['@apostrophecms/i18n-static'].generateNewGlobalIdAndUpdateCache
    };
    const piece = {
      title: 'test 2',
      namespace: 'apostrophe',
      valueSingular: 'new value for test 2',
      type: '@apostrophecms/i18n-static',
      aposLocale: 'en:draft',
      aposMode: 'draft',
      metaType: 'doc',
      slug: 'test-2'
    };
    const req = apos.task.getReq();
    await handlers(self).afterSave.handleSave(req, piece);
    const text = await apos.http.get('/');

    assert(text.match(/test 2: new value for test 2/));
  });
});
