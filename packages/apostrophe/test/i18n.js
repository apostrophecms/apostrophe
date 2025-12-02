const cheerio = require('cheerio');
const assert = require('node:assert/strict');

const t = require('../test-lib/test.js');

describe('static i18n', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {},
              fr: {
                prefix: '/fr'
              }
            }
          }
        },
        'i18n-test-page': {},
        example: {
          options: {
            i18n: {}
          }
        },
        'apos-fr': {
          options: {
            i18n: {
              // Legacy technique must work
              ns: 'apostrophe'
            }
          }
        },
        // A base class that contributes some namespaced phrases in the new
        // style way (subdirs)
        'base-type': {
          instantiate: false
        },
        // Also contributes namespaced phrases in the new style way (subdirs)
        // plus default locale phrases in the root i18n folder
        subtype: {
          extend: 'base-type'
        }
      }
    });
  });

  after(async function() {
    this.timeout(t.timeout);
    return t.destroy(apos);
  });

  it('should should exist on the apos object', async function() {
    assert(apos.i18n);
    assert(apos.i18n.i18next);
  });

  it('should set the lang attribute to "en" by default', async function() {
    const req = apos.task.getReq();
    const result = await apos.modules['i18n-test-page'].renderPage(req, 'page');

    const $ = cheerio.load(result);
    const $html = $('html');
    const lang = $html.attr('lang');

    assert.equal(lang, 'en');
  });

  it('should set the lang attribute to the current locale', async function() {
    const req = apos.task.getReq({
      locale: 'fr'
    });
    const result = await apos.modules['i18n-test-page'].renderPage(req, 'page');

    const $ = cheerio.load(result);
    const $html = $('html');
    const lang = $html.attr('lang');

    assert.equal(lang, 'fr');
  });

  it('should localize apostrophe namespace phrases in the default locale', function() {
    assert.strictEqual(apos.task.getReq().t('apostrophe:notFoundPageTitle'), '404 - Page not found');
  });

  it('should localize default namespace phrases contributed by a project level module', function() {
    assert.strictEqual(apos.task.getReq().t('projectLevelPhrase'), 'Project Level Phrase');
  });

  it('should merge translations in different languages of the same phrases from @apostrophecms/i18n and a different module', function() {
    assert.strictEqual(apos.task.getReq().t('apostrophe:richTextAlignCenter'), 'Align Center');
  });

  it('should merge translations in different languages of the same phrases from @apostrophecms/i18n and a different module (fr)', function() {
    // je suis désolé re: Google Translate-powered French test, feel free to PR
    // better example
    assert.strictEqual(apos.task.getReq({ locale: 'fr' }).t('apostrophe:richTextAlignCenter'), 'Aligner Le Centre');
  });

  it('should fetch default locale phrases from main i18n dir with no i18n option necessary', function() {
    assert.strictEqual(apos.task.getReq().t('defaultTestOne'), 'Default Test One');
  });

  it('should fetch custom locale phrases from corresponding subdir', function() {
    assert.strictEqual(apos.task.getReq().t('custom:customTestTwo'), 'Custom Test Two From Base Type');
    assert.strictEqual(apos.task.getReq().t('custom:customTestThree'), 'Custom Test Three From Subtype');
  });

  it('last appearance in inheritance + configuration order wins', function() {
    assert.strictEqual(apos.task.getReq().t('custom:customTestOne'), 'Custom Test One From Subtype');
  });

  it('should honor the browser: true flag in the i18n section of an index.js file', function() {
    const browserData = apos.i18n.getBrowserData(apos.task.getReq());
    assert.strictEqual(browserData.i18n.en.custom.customTestOne, 'Custom Test One From Subtype');
  });

  it('should not offer adminLocale by default', function () {
    assert.deepStrictEqual(apos.i18n.adminLocales, []);
    assert.strictEqual(apos.i18n.defaultAdminLocale, null);
    assert.strictEqual(
      apos.user.schema.some((field) => field.name === 'adminLocale'),
      false
    );
    const browserData = apos.i18n.getBrowserData(apos.task.getReq());
    assert.strictEqual(browserData.locale, 'en');
    assert.strictEqual(browserData.adminLocale, 'en');
  });

  it('should add user.adminLocale when configured', async function () {
    await t.destroy(apos);
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {},
              fr: {
                prefix: '/fr'
              }
            },
            adminLocales: [
              {
                label: 'English',
                value: 'en'
              },
              {
                label: 'French',
                value: 'fr'
              }
            ]
          }
        }
      }
    });

    assert.deepStrictEqual(
      apos.i18n.adminLocales,
      [
        {
          label: 'English',
          value: 'en'
        },
        {
          label: 'French',
          value: 'fr'
        }
      ]
    );
    assert.strictEqual(apos.i18n.defaultAdminLocale, null);
    const field = apos.user.schema.find((field) => field.name === 'adminLocale');
    assert(field);
    assert.strictEqual(field.type, 'select');
    assert.strictEqual(field.choices.length, 3);
    assert.strictEqual(field.choices[0].value, '');
    assert.strictEqual(field.choices[1].value, 'en');
    assert.strictEqual(field.choices[2].value, 'fr');
    assert.strictEqual(field.def, '');

    {
      const browserData = apos.i18n.getBrowserData(apos.task.getReq({
        locale: 'en',
        user: {
          adminLocale: 'fr'
        }
      }));
      assert.strictEqual(browserData.locale, 'en');
      assert.strictEqual(browserData.adminLocale, 'fr');
    }
    {
      const browserData = apos.i18n.getBrowserData(apos.task.getReq({
        locale: 'fr',
        user: {
          adminLocale: 'en'
        }
      }));
      assert.strictEqual(browserData.locale, 'fr');
      assert.strictEqual(browserData.adminLocale, 'en');
    }

    {
      // When user sets Same as Website
      const browserData = apos.i18n.getBrowserData(apos.task.getReq({
        locale: 'fr',
        user: {
          adminLocale: ''
        }
      }));
      assert.strictEqual(browserData.locale, 'fr');
      assert.strictEqual(browserData.adminLocale, 'fr');
    }
  });

  it('should respect defaultAdminLocale when adminLocales are configured', async function () {
    await t.destroy(apos);
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            adminLocales: [
              {
                label: 'English',
                value: 'en'
              },
              {
                label: 'French',
                value: 'fr'
              }
            ],
            defaultAdminLocale: 'fr'
          }
        }
      }
    });

    // Correct default value
    assert.strictEqual(apos.i18n.defaultAdminLocale, 'fr');
    const field = apos.user.schema.find((field) => field.name === 'adminLocale');
    assert(field);
    assert.strictEqual(field.def, 'fr');

    {
      // adminLocale is defaultAdminLocale even if user.adminLocale is not
      // present
      const browserData = apos.i18n.getBrowserData(apos.task.getReq());
      assert.strictEqual(browserData.locale, 'en');
      assert.strictEqual(browserData.adminLocale, 'fr');
    }

    {
      // adminLocale is set to Same as Website
      const browserData = apos.i18n.getBrowserData(apos.task.getReq({
        locale: 'en',
        user: {
          adminLocale: ''
        }
      }));
      assert.strictEqual(browserData.locale, 'en');
      assert.strictEqual(browserData.adminLocale, 'en');
    }
  });

  it('should respect defaultAdminLocale when adminLocales are NOT configured', async function () {
    await t.destroy(apos);
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            defaultAdminLocale: 'fr'
          }
        }
      }
    });

    assert.strictEqual(apos.i18n.defaultAdminLocale, 'fr');
    assert.strictEqual(apos.user.schema.some((field) => field.name === 'adminLocale'), false);

    // adminLocale is defaultAdminLocale even if user.adminLocale is not present
    const browserData = apos.i18n.getBrowserData(apos.task.getReq());
    assert.strictEqual(browserData.locale, 'en');
    assert.strictEqual(browserData.adminLocale, 'fr');
  });

  it('should replace accented characters in slugs and attachment names when configured', async function () {
    await t.destroy(apos);
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            stripUrlAccents: true,
            locales: {
              en: {},
              fr: {
                prefix: '/fr'
              }
            }
          }
        },
        'default-page': {
          extend: '@apostrophecms/page-type'
        },
        'test-piece': {
          extend: '@apostrophecms/piece-type'
        }
      }
    });
    await apos.doc.db.deleteMany({
      type: {
        $in: [
          'default-page',
          'test-piece'
        ]
      }
    });
    // Create content while accents are NOT stripped so we have accented slugs
    apos.i18n.options.stripUrlAccents = false;

    const req = apos.task.getReq();

    // Add a page with accented characters in its title so slug preserves accents
    await apos.doc.insert(req, {
      type: 'default-page',
      visibility: 'public',
      title: 'C\'est déjà l\'été'
    });

    // Also add a page that already uses the non-accented slug to verify
    // that the accent-stripping task de-duplicates slugs appropriately
    const nonAccentedExisting = await apos.doc.insert(req, {
      type: 'default-page',
      visibility: 'public',
      title: 'C\'est deja l\'ete',
      slug: '/c-est-deja-l-ete'
    });

    // Add a piece with accented characters in its title so slug preserves accents
    await apos.doc.insert(req, {
      type: 'test-piece',
      visibility: 'public',
      title: 'Café au lait'
    });

    // Sanity check: created content has accented slugs/names
    const pageBefore = await apos.doc.db.findOne({
      type: 'default-page',
      title: 'C\'est déjà l\'été'
    });
    assert(pageBefore);
    assert.equal(pageBefore.slug, '/c-est-déjà-l-été');

    const nonAccentedPageBefore = await apos.doc.db.findOne({
      _id: nonAccentedExisting._id
    });
    assert(nonAccentedPageBefore);
    assert.equal(nonAccentedPageBefore.slug, '/c-est-deja-l-ete');

    const pieceBefore = await apos.doc.db.findOne({
      type: 'test-piece',
      title: 'Café au lait'
    });
    assert(pieceBefore);
    assert.equal(pieceBefore.slug, 'café-au-lait');

    // Now enable accent stripping and run the task to update existing content
    apos.i18n.options.stripUrlAccents = true;
    await apos.task.invoke('@apostrophecms/i18n:strip-slug-accents');

    // Verify that the slugs and attachment names have been updated correctly
    const pageAfter = await apos.doc.db.findOne({ _id: pageBefore._id });
    assert(pageAfter);
    // After stripping accents, this page's slug would conflict with the
    // existing non-accented page. Ensure de-duplication added a suffix.
    assert(pageAfter.slug.startsWith('/c-est-deja-l-ete'));
    assert.notEqual(pageAfter.slug, '/c-est-deja-l-ete');
    assert(/\/c-est-deja-l-ete\d+$/.test(pageAfter.slug));

    // Verify the pre-existing non-accented page kept its slug unchanged
    const nonAccentedPageAfter = await apos.doc.db.findOne({
      _id: nonAccentedPageBefore._id
    });
    assert(nonAccentedPageAfter);
    assert.equal(nonAccentedPageAfter.slug, '/c-est-deja-l-ete');

    const pieceAfter = await apos.doc.db.findOne({ _id: pieceBefore._id });
    assert(pieceAfter);
    assert.equal(pieceAfter.slug, 'cafe-au-lait');

    // Restore default for other tests
    apos.i18n.options.stripUrlAccents = false;
  });

  it('should redirect accent-preserving URLs to their stripped versions after running the accent task', async function () {
    await t.destroy(apos);
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            stripUrlAccents: true,
            locales: {
              en: {},
              fr: {
                prefix: '/fr'
              }
            }
          }
        },
        'default-page': {
          extend: '@apostrophecms/page-type'
        },
        'test-piece': {
          extend: '@apostrophecms/piece-type'
        },
        'test-piece-page': {
          extend: '@apostrophecms/piece-page-type',
          options: {
            pieceType: 'test-piece'
          }
        }
      }
    });
    await apos.doc.db.deleteMany({
      type: {
        $in: [
          'default-page',
          'test-piece',
          'test-piece-page'
        ]
      }
    });

    apos.i18n.options.stripUrlAccents = false;

    const req = apos.task.getReq();
    const jar = apos.http.jar();
    const parentId = '_home';

    const accentedPage = await apos.page.insert(req, parentId, 'lastChild', {
      type: 'default-page',
      visibility: 'public',
      title: 'C\'est déjà l\'été'
    });

    const pieceIndexPage = await apos.page.insert(req, parentId, 'lastChild', {
      type: 'test-piece-page',
      visibility: 'public',
      title: 'Test Piece Page',
      slug: '/test-piece'
    });

    const piece = await apos.doc.insert(req, {
      type: 'test-piece',
      visibility: 'public',
      title: 'Café au lait'
    });

    const encodedOldPageUrl = encodeURI(accentedPage.slug);
    const oldPieceSlug = piece.slug;
    const pieceIndexSlug = pieceIndexPage.slug;
    const encodedOldPieceUrl = encodeURI(`${pieceIndexSlug}/${oldPieceSlug}`);

    // Visit the legacy URLs before stripping accents so historic
    // redirects exist.
    await apos.http.get(encodedOldPageUrl, {
      followRedirect: false,
      fullResponse: true,
      redirect: 'manual',
      jar
    });
    await apos.http.get(encodedOldPieceUrl, {
      followRedirect: false,
      fullResponse: true,
      redirect: 'manual',
      jar
    });

    apos.i18n.options.stripUrlAccents = true;
    await apos.task.invoke('@apostrophecms/i18n:strip-slug-accents');

    const updatedPage = await apos.doc.db.findOne({ _id: accentedPage._id });
    const updatedPiece = await apos.doc.db.findOne({ _id: piece._id });
    assert(updatedPage);
    assert(updatedPiece);

    const pageResponse = await apos.http.get(encodedOldPageUrl, {
      followRedirect: false,
      fullResponse: true,
      redirect: 'manual',
      jar
    });
    assert.strictEqual(pageResponse.status, 302);
    assert.strictEqual(pageResponse.headers.location, `${apos.http.getBase()}${updatedPage.slug}`);

    const pieceResponse = await apos.http.get(encodedOldPieceUrl, {
      followRedirect: false,
      fullResponse: true,
      redirect: 'manual',
      jar
    });
    assert.strictEqual(pieceResponse.status, 302);
    assert.strictEqual(
      pieceResponse.headers.location,
      `${apos.http.getBase()}${pieceIndexSlug}/${updatedPiece.slug}`
    );
    apos.i18n.options.stripUrlAccents = false;
  });
});

describe('private locales', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    apos = await t.create({
      root: module,
      baseUrl: 'http://localhost:3000',
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {},
              sk: {
                prefix: '/sk',
                private: true
              }
            }
          }
        }
      }
    });
  });

  after(async function() {
    this.timeout(t.timeout);
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  it('should return a 404 HTTP error code when a logged out user tries to access to a content in a private locale', async function() {
    try {
      await apos.http.get('/sk');
    } catch (error) {
      assert(error.status === 404);
      return;
    }
    throw new Error('should have thrown 404 error');
  });
});

describe('redirection to first locale', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    apos = await t.create({
      root: module,
      baseUrl: 'http://localhost:3000',
      modules: {
        '@apostrophecms/page': {
          options: {
            park: [
              {
                parkedId: 'child',
                title: 'Child',
                slug: '/child',
                type: 'default-page'
              }
            ]
          }
        },
        'default-page': {},
        '@apostrophecms/i18n': {
          options: {
            redirectToFirstLocale: true,
            locales: {
              en: {
                label: 'English',
                hostname: 'en.localhost:3000',
                prefix: '/en'
              },
              'en-CA': {
                label: 'Canada',
                hostname: 'ca.localhost:3000',
                prefix: '/en-ca'
              },
              'fr-CA': {
                label: 'French Canada',
                hostname: 'ca.localhost:3000',
                prefix: '/fr-ca'
              },
              es: {
                label: 'Spain',
                prefix: '/es'
              },
              it: {
                label: 'Italy',
                prefix: '/it'
              }
            }
          }
        }
      }
    });
  });

  after(async function() {
    this.timeout(t.timeout);
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  it('should not redirect to the first prefixed locale when the page requested is not the homepage', async function() {
    const response = await apos.http.get('/child', {
      followRedirect: false,
      fullResponse: true,
      redirect: 'manual'
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.location, undefined);
  });

  it('should redirect to the first prefixed locale', async function() {
    const response = await apos.http.get('/', {
      followRedirect: false,
      fullResponse: true,
      redirect: 'manual'
    });

    assert.strictEqual(response.headers.location, `${apos.http.getBase()}/es/`);
  });

  it('should redirect to the first prefixed locale that matches the requested hostname', async function() {
    const server = apos.modules['@apostrophecms/express'].server;

    const response = await apos.http.get(`http://ca.localhost:${server.address().port}`, {
      followRedirect: false,
      fullResponse: true,
      redirect: 'manual'
    });

    assert.strictEqual(response.headers.location, `http://ca.localhost:${server.address().port}/en-ca/`);
  });
});

describe('no redirection to first locale', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    apos = await t.create({
      root: module,
      baseUrl: 'http://localhost:3000',
      modules: {
        '@apostrophecms/i18n': {
          options: {
            redirectToFirstLocale: true,
            locales: {
              en: {
                label: 'English',
                hostname: 'en.localhost:3000',
                prefix: '/en'
              },
              'en-CA': {
                label: 'Canada',
                hostname: 'ca.localhost:3000',
                prefix: '/en-ca'
              },
              'fr-CA': {
                label: 'French Canada',
                hostname: 'ca.localhost:3000'
                // no prefix
              },
              es: {
                label: 'Spain',
                prefix: '/es'
              },
              it: {
                label: 'Italy'
                // no prefix
              }
            }
          }
        }
      }
    });
  });

  after(async function() {
    this.timeout(t.timeout);
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  it('should not redirect to the first prefixed locale when at least one locale has no prefix', async function() {
    const response = await apos.http.get('/', {
      followRedirect: false,
      fullResponse: true,
      redirect: 'manual'
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.location, undefined);
  });

  it('should not redirect to the first prefixed locale that matches the requested hostname when at least one locale has no prefix', async function() {
    const server = apos.modules['@apostrophecms/express'].server;

    const response = await apos.http.get(`http://ca.localhost:${server.address().port}`, {
      followRedirect: false,
      fullResponse: true,
      redirect: 'manual'
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.location, undefined);
  });
});
