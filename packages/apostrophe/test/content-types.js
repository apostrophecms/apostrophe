const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// `apos.doc.getContentTypes`: the page and piece types documents are of,
// without the virtual types that own none.

describe('Content types', function () {
  this.timeout(t.timeout);

  let apos;

  before(async function () {
    apos = await t.create({
      root: module,
      modules: {
        article: {
          extend: '@apostrophecms/piece-type'
        },
        notice: {
          extend: '@apostrophecms/piece-type',
          options: {
            autopublish: true
          }
        },
        setting: {
          extend: '@apostrophecms/piece-type',
          options: {
            localized: false
          }
        },
        listing: {
          extend: '@apostrophecms/piece-type',
          options: {
            virtual: true
          }
        },
        'default-page': {
          extend: '@apostrophecms/page-type'
        }
      }
    });
  });

  after(function () {
    return t.destroy(apos);
  });

  const VIRTUAL = [
    'listing',
    '@apostrophecms/recently-edited',
    '@apostrophecms/submitted-draft',
    '@apostrophecms/archive-page',
    '@apostrophecms/any-doc-type',
    '@apostrophecms/any-page-type',
    '@apostrophecms/polymorphic-type'
  ];

  function names(managers) {
    return managers.map(manager => manager.__meta.name);
  }

  it('should list the page and piece types, without the virtual ones', function () {
    const types = names(apos.doc.getContentTypes());

    for (const name of [
      'article', 'notice', 'setting', 'default-page', '@apostrophecms/home-page',
      '@apostrophecms/image', '@apostrophecms/global', '@apostrophecms/user'
    ]) {
      assert(types.includes(name), name);
    }
    for (const name of VIRTUAL) {
      assert.equal(types.includes(name), false, name);
    }
  });

  it('should list one kind', function () {
    const pages = names(apos.doc.getContentTypes({ kind: 'page' }));
    const pieces = names(apos.doc.getContentTypes({ kind: 'piece' }));

    assert(pages.includes('default-page'));
    assert.equal(pages.includes('article'), false);
    assert(pieces.includes('article'));
    assert.equal(pieces.includes('default-page'), false);
    assert.deepEqual(
      [ ...pages, ...pieces ].sort(),
      names(apos.doc.getContentTypes()).sort()
    );
    assert.throws(() => apos.doc.getContentTypes({ kind: 'pages' }), { name: 'invalid' });
  });

  it('should leave out the placeholder of a type without a module', function () {
    // As the page module registers one for documents of an unknown type
    apos.doc.managers.ghost = {
      orphan: true,
      schema: [],
      options: {}
    };
    try {
      assert.equal(apos.doc.getContentTypes().includes(apos.doc.managers.ghost), false);
    } finally {
      delete apos.doc.managers.ghost;
    }
  });

  it('should offer the content types with drafts to submit in the submitted drafts filter', function () {
    const { choices } = apos.modules['@apostrophecms/submitted-draft'].schema
      .find(field => field.name === '_type');
    const values = choices.map(choice => choice.value);

    assert(values.includes('article'));
    assert(values.includes('default-page'));
    // Published on save, or without drafts
    assert.equal(values.includes('notice'), false);
    assert.equal(values.includes('setting'), false);
    for (const name of VIRTUAL) {
      assert.equal(values.includes(name), false, name);
    }
  });
});
