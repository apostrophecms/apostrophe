const t = require('../test-lib/test.js');
const assert = require('assert');

const park2 = [
  {
    slug: '/',
    parkedId: 'home',
    _defaults: {
      title: 'Home',
      type: 'default-page'
    },
    _children: [
      {
        slug: '/default1',
        parkedId: 'default1',
        _defaults: {
          type: 'default-page',
          title: 'Default 1'
        }
      },
      {
        slug: '/default2',
        parkedId: 'default2',
        _defaults: {
          type: 'default-page',
          title: 'Default 2'
        }
      }
    ]
  }
];

describe('Parked Pages', function() {

  let apos, apos2, apos3, apos4, apos5, apos6;

  this.timeout(t.timeout);

  after(async function() {
    await t.destroy(apos);
    await t.destroy(apos2);
    await t.destroy(apos3);
    await t.destroy(apos4);
    await t.destroy(apos5);
    await t.destroy(apos6);
  });

  it('standard and custom parked pages should be as expected', async function() {
    this.timeout(20000);
    apos = await t.create({
      root: module,
      modules: {
        'default-page': {
          extend: '@apostrophecms/page-type'
        }
      }
    });
    const req = apos.task.getReq();
    const home = await apos.page.find(req, { slug: '/' }).toObject();
    assert(home);
    assert(home.parkedId === 'home');
    assert(home.type === '@apostrophecms/home-page');
    const archive = await apos.page.find(req, { slug: '/archive' }).archived(true).toObject();
    assert(archive);
    assert(archive.parkedId === 'archive');
    assert(archive.type === '@apostrophecms/archive-page');
  });

  it('overridden home page should work without disturbing archive', async function() {
    this.timeout(20000);
    apos2 = await t.create({
      root: module,
      modules: {
        '@apostrophecms/page': {
          options: {
            park: park2
          }
        },
        'default-page': {}
      }
    });
    const req = apos2.task.getAnonReq();
    const home = await apos2.page.find(req, { slug: '/' }).toObject();
    assert(home);
    assert(home.parkedId === 'home');
    assert(home.type === 'default-page');
    const archive = await apos2.page.find(req, { slug: '/archive' }).archived(true).toObject();
    assert(archive);
    assert(archive.parkedId === 'archive');
    assert(archive.type === '@apostrophecms/archive-page');
    await apos2.db.collection('verify').insertOne({
      checkSameDb: true
    });
  });

  it('all pages should have consistent aposDocId across draft and published', async function() {
    this.timeout(20000);
    await validate(apos2, [ '/', '/archive', '/default1', '/default2' ]);
  });

  it('third apos object should park a third child correctly when spinning up later on existing db', async function() {
    this.timeout(20000);
    apos3 = await t.create({
      root: module,
      modules: {
        '@apostrophecms/page': {
          options: {
            park: [
              ...park2,
              {
                slug: '/default3',
                parkedId: 'default3',
                _defaults: {
                  type: 'default-page',
                  title: 'Default 3'
                }
              }
            ]
          }
        },
        'default-page': {}
      },
      shortName: apos2.options.shortName
    });
    // prove apos2 and apos3 are talking to the same db and it hasn't been erased
    assert(await apos3.db.collection('verify').findOne({
      checkSameDb: true
    }));
  });

  it('all pages should have consistent aposDocId across draft and published (2)', async function() {
    await validate(apos3, [ '/', '/archive', '/default1', '/default2', '/default3' ]);
    // Should be same db, make sure of that
    await validate(apos2, [ '/', '/archive', '/default1', '/default2', '/default3' ]);
  });

  it('nested parked children work', async function() {
    this.timeout(20000);
    apos4 = await t.create({
      root: module,
      modules: {
        '@apostrophecms/page': {
          options: {
            park: [
              ...park2,
              {
                slug: '/default3',
                parkedId: 'default3',
                _defaults: {
                  type: 'default-page',
                  title: 'Default 3'
                },
                _children: [
                  {
                    slug: '/default3/child1',
                    parkedId: 'default3child1',
                    _defaults: {
                      type: 'default-page',
                      title: 'Default 3 Child 1'
                    }
                  }
                ]
              }
            ]
          }
        },
        'default-page': {}
      },
      shortName: apos2.options.shortName
    });
    await validate(apos4, [ '/', '/archive', '/default1', '/default2', '/default3', '/default3/child1' ]);
  });

  it('nested parked children work across locales if locales are added later', async function() {
    this.timeout(20000);
    apos5 = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {
                label: 'English',
                hostname: 'en'
              },
              fr: {
                label: 'French',
                hostname: 'fr'
              }
            }
          }
        },
        '@apostrophecms/page': {
          options: {
            park: [
              ...park2,
              {
                slug: '/default3',
                parkedId: 'default3',
                _defaults: {
                  type: 'default-page',
                  title: 'Default 3'
                },
                _children: [
                  {
                    slug: '/default3/child1',
                    parkedId: 'default3child1',
                    _defaults: {
                      type: 'default-page',
                      title: 'Default 3 Child 1'
                    }
                  }
                ]
              }
            ]
          }
        },
        'default-page': {}
      },
      shortName: apos4.options.shortName
    });
    await validate(apos5, [ '/', '/archive', '/default1', '/default2', '/default3', '/default3/child1' ]);
  });

  it('nested parked children work across locales if locales are present from the start', async function() {
    this.timeout(20000);
    apos6 = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {
                label: 'English',
                hostname: 'en'
              },
              fr: {
                label: 'French',
                hostname: 'fr'
              }
            }
          }
        },
        '@apostrophecms/page': {
          options: {
            park: [
              ...park2,
              {
                slug: '/default3',
                parkedId: 'default3',
                _defaults: {
                  type: 'default-page',
                  title: 'Default 3'
                },
                _children: [
                  {
                    slug: '/default3/child1',
                    parkedId: 'default3child1',
                    _defaults: {
                      type: 'default-page',
                      title: 'Default 3 Child 1'
                    }
                  }
                ]
              }
            ]
          }
        },
        'default-page': {}
      }
    });
    await validate(apos6, [ '/', '/archive', '/default1', '/default2', '/default3', '/default3/child1' ]);
  });

  it('field override on save is possible only when it is configured as default', async function () {
    this.timeout(20000);
    await t.destroy(apos6);
    apos6 = await t.create({
      root: module,
      modules: {
        '@apostrophecms/page': {
          options: {
            park: [
              ...park2,
              {
                parkedId: 'default3',
                type: 'default-page',
                title: 'Default 3',
                slug: '/default3'
              },
              {
                parkedId: 'default4',
                type: 'default-page',
                title: 'Default 4',
                _defaults: {
                  slug: '/default4'
                }
              }
            ]
          }
        },
        'default-page': {}
      }
    });
    const manager = apos6.doc.getManager('default-page');
    const req = apos.task.getReq({ mode: 'draft' });

    // slug override not possible, slug is NOT configured in defaults
    {
      const page = await manager.find(req, {
        parkedId: 'default3',
        aposMode: 'draft'
      }).toObject();
      assert.strictEqual(page.slug, '/default3');
      assert.deepStrictEqual(page.parked, [ 'parkedId', 'type', 'title', 'slug' ]);

      page.slug = '/default3-overridden';
      await manager.update(req, page);
      const updated = await manager.find(req, {
        parkedId: 'default3',
        aposMode: 'draft'
      }).toObject();

      assert.strictEqual(updated.slug, '/default3');
    }

    // slug override is possible because slug is configured in defaults
    {
      const page = await manager.find(req, {
        parkedId: 'default4',
        aposMode: 'draft'
      }).toObject();
      assert.strictEqual(page.slug, '/default4');
      assert.deepStrictEqual(page.parked, [ 'parkedId', 'type', 'title' ]);

      page.slug = '/default4-overridden';
      await manager.update(req, page);
      const updated = await manager.find(req, {
        parkedId: 'default4',
        aposMode: 'draft'
      }).toObject();

      assert.strictEqual(updated.slug, '/default4-overridden');
    }

    await t.destroy(apos6);
    apos6 = null;
  });
});

async function validate(apos, expected) {
  const locales = Object.keys(apos.i18n.locales);
  const slugs = await apos.doc.db.distinct('slug', {
    slug: /^\//
  });
  slugs.sort();
  assert.deepStrictEqual(slugs, expected);
  const pages = await apos.doc.db.find({
    slug: /^\//
  }).toArray();
  assert(pages.length === slugs.length * 2 * locales.length);
  for (const slug of slugs) {
    const matches = pages.filter(page => page.slug === slug);
    matches.sort((p1, p2) => {
      if (p1.aposLocale < p2.aposLocale) {
        return -1;
      } else if (p1.aposLocale > p2.aposLocale) {
        return 1;
      } else {
        return 0;
      }
    });
    assert.strictEqual(matches.length, 2 * locales.length);
    let i = 0;
    let aposDocId;
    for (const locale of locales) {
      const draft = i;
      const published = i + 1;
      assert.strictEqual(matches[draft].aposLocale, `${locale}:draft`);
      assert.strictEqual(matches[published].aposLocale, `${locale}:published`);
      assert(matches[draft].aposDocId);
      assert.strictEqual(matches[draft].aposDocId, matches[published].aposDocId);
      if (!aposDocId) {
        aposDocId = matches[draft].aposDocId;
      } else {
        assert.strictEqual(matches[draft].aposDocId, aposDocId);
      }
      assert.strictEqual(matches[draft]._id, `${aposDocId}:${locale}:draft`);
      assert.strictEqual(matches[published]._id, `${aposDocId}:${locale}:published`);
      i += 2;
    }
  }
  const home = await apos.page.find(apos.task.getReq(), {
    slug: '/'
  }).children({
    depth: 2
  }).toObject();
  const children = expected.filter(slug => slug.startsWith('/default') && !slug.match(/\/.*\//));
  assert.deepStrictEqual(home._children.map(child => child.slug), children);
  const grandkids = expected.filter(slug => slug.match(/\/.*\//));
  for (const grandkid of grandkids) {
    const parentSlug = grandkid.replace(/\/[^/]+$/, '');
    const parent = home._children.find(child => child.slug === parentSlug);
    assert(parent);
    assert(parent._children);
    assert(parent._children.find(child => child.slug === grandkid));
  }
}
