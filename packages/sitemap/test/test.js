
const assert = require('assert');
const t = require('apostrophe/test-lib/util');

describe('Apostrophe Sitemap', function() {
  let apos;
  let testDraftProduct;

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  it('should be a property of the apos object', async function() {
    const appConfig = getAppConfig();

    await t.create({
      root: module,
      baseUrl: 'http://localhost:7780',
      testModule: true,
      modules: {
        ...appConfig,
        testRunner: {
          handlers(self) {
            return {
              'apostrophe:afterInit': {
                checkSitemap () {
                  apos = self.apos;
                  assert(self.apos.modules['@apostrophecms/sitemap']);
                }
              }
            };
          }
        }
      }
    });
  });

  it('insert a product for test purposes', async function() {
    testDraftProduct = apos.product.newInstance();
    testDraftProduct.title = 'Cheese';
    testDraftProduct.slug = 'cheese';

    const inserted = await apos.product.insert(apos.task.getReq(), testDraftProduct);

    assert(inserted._id);
    assert(inserted.slug === 'cheese');
  });

  it('insert an unpublished product for test purposes', async function() {
    const rockProduct = apos.product.newInstance();
    rockProduct.title = 'Rocks';
    rockProduct.slug = 'rocks';
    rockProduct.published = false;

    const inserted = await apos.product.insert(apos.task.getReq({
      mode: 'draft'
    }), rockProduct);

    assert(inserted.aposMode === 'draft');
    assert(inserted.published === false);
    assert(inserted.slug === 'rocks');
  });

  it('should generate a suitable sitemap', async function() {
    try {
      const xml = await apos.http.get('/sitemap.xml');

      assert(xml);
      assert(xml.indexOf('<loc>http://localhost:7780/</loc>') !== -1);
      assert(xml.indexOf('<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/" />') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/tab-one</loc>') !== -1);
      assert(xml.indexOf('<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/tab-one" />') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/tab-two</loc>') !== -1);
      assert(xml.indexOf('<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/tab-two" />') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/tab-one/child-one</loc>') !== -1);
      assert(xml.indexOf('<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/tab-one/child-one" />') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/products</loc>') !== -1);
      assert(xml.indexOf('<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/products" />') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/products/cheese</loc>') !== -1);
      assert(xml.indexOf('<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/products/cheese" />') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/products/rocks</loc>') === -1);
      assert(xml.indexOf('<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/products/rocks" />') === -1);
    } catch (error) {
      assert(!error);
    }
  });

  it('should destroy the app', async function () {
    return t.destroy(apos);
  });

  it('should be a property of the 🆕 apos object that excludes products', async function() {
    const appConfig = getAppConfig({
      excludeTypes: [ 'product-page', 'product' ]
    });

    apos = await t.create({
      root: module,
      baseUrl: 'http://localhost:7780',
      testModule: true,
      modules: {
        ...appConfig,
        testRunner: {
          handlers(self) {
            return {
              'apostrophe:afterInit': {
                checkSitemap () {
                  apos = self.apos;
                  assert(self.apos.modules['@apostrophecms/sitemap']);
                }
              }
            };
          }
        }
      }
    });
  });

  it('insert 🧀 again', async function() {
    testDraftProduct = apos.product.newInstance();
    testDraftProduct.title = 'Cheese';
    testDraftProduct.slug = 'cheese';

    const inserted = await apos.product.insert(apos.task.getReq(), testDraftProduct);

    assert(inserted._id);
    assert(inserted.slug === 'cheese');
  });

  it('should generate a sitemap without products or product pages', async function() {
    try {
      const xml = await apos.http.get('/sitemap.xml');

      assert(xml);
      assert(xml.indexOf('<loc>http://localhost:7780/</loc>') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/tab-one</loc>') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/tab-two</loc>') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/tab-one/child-one</loc>') !== -1);

      assert(xml.indexOf('<loc>http://localhost:7780/products</loc>') === -1);
      assert(xml.indexOf('<loc>http://localhost:7780/products/cheese</loc>') === -1);
      assert(xml.indexOf('<loc>http://localhost:7780/products/rocks</loc>') === -1);
    } catch (error) {
      assert(!error);
    }
  });

  it('should create new multi-language app', async function () {
    await t.destroy(apos);

    const appConfig = getAppConfig({
      multilanguage: true
    });
    apos = await t.create({
      root: module,
      baseUrl: 'http://localhost:7780',
      testModule: true,
      modules: appConfig
    });

    assert.deepEqual(Object.keys(apos.i18n.getLocales()), [ 'en', 'es', 'fr' ]);

    {
      const rockProduct = apos.product.newInstance();
      rockProduct.title = 'Rocks';
      rockProduct.slug = 'rocks';
      rockProduct.published = false;

      const inserted = await apos.product.insert(apos.task.getReq({
        mode: 'draft'
      }), rockProduct);

      assert(inserted.aposMode === 'draft');
      assert(inserted.published === false);
      assert(inserted.slug === 'rocks');
    }

    {
      const cheeseProduct = apos.product.newInstance();
      cheeseProduct.title = 'Cheese';
      cheeseProduct.slug = 'cheese';

      const inserted = await apos.product.insert(apos.task.getReq(), cheeseProduct);
      await apos.product.publish(apos.task.getReq(), inserted);
      inserted.slug = 'cheese-es';
      const localized = await apos.product.localize(apos.task.getReq(), inserted, 'es');
      await apos.product.publish(apos.task.getReq(), localized);

      assert(inserted._id);
      assert(inserted._id !== localized._id);
      assert(localized.slug === 'cheese-es');
    }
  });

  it('should generate a multi-language sitemap', async function () {
    const xml = await apos.http.get('/sitemap.xml');

    assert(xml);
    // Home
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/" />\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/" />\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/" />\n'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/es/</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/" />\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/" />\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/" />\n'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://fr.example.com/</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/" />\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/" />\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/" />\n'
      ) !== -1
    );
    // Child One
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/tab-one/child-one</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/tab-one/child-one" />\n'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/es/tab-one/child-one</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/tab-one/child-one" />\n'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://fr.example.com/tab-one/child-one</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/tab-one/child-one" />\n'
      ) !== -1
    );
    // Product Cheese
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/products/cheese</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/products/cheese" />\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/products/cheese-es" />'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/es/products/cheese-es</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/products/cheese-es" />\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/products/cheese" />\n'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://fr.example.com/products/cheese</loc>'
      ) === -1
    );
    assert(
      xml.indexOf(
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/products/cheese" />'
      ) === -1
    );
  });

  it('should create new multi-language app', async function () {
    await t.destroy(apos);

    const appConfig = getAppConfig({
      multilanguage: true
    });
    apos = await t.create({
      root: module,
      baseUrl: 'http://localhost:7780',
      testModule: true,
      modules: appConfig
    });

    assert.deepEqual(Object.keys(apos.i18n.getLocales()), [ 'en', 'es', 'fr' ]);

    {
      const rockProduct = apos.product.newInstance();
      rockProduct.title = 'Rocks';
      rockProduct.slug = 'rocks';
      rockProduct.published = false;

      const inserted = await apos.product.insert(apos.task.getReq({
        mode: 'draft'
      }), rockProduct);

      assert(inserted.aposMode === 'draft');
      assert(inserted.published === false);
      assert(inserted.slug === 'rocks');
    }

    {
      const cheeseProduct = apos.product.newInstance();
      cheeseProduct.title = 'Cheese';
      cheeseProduct.slug = 'cheese';

      const inserted = await apos.product.insert(apos.task.getReq(), cheeseProduct);
      await apos.product.publish(apos.task.getReq(), inserted);
      inserted.slug = 'cheese-es';
      const localized = await apos.product.localize(apos.task.getReq(), inserted, 'es');
      await apos.product.publish(apos.task.getReq(), localized);

      assert(inserted._id);
      assert(inserted._id !== localized._id);
      assert(localized.slug === 'cheese-es');
    }
  });

  it('should generate a multi-language sitemap', async function () {
    const xml = await apos.http.get('/sitemap.xml');

    assert(xml);
    // Home
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/" />\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/" />\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/" />\n'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/es/</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/" />\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/" />\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/" />\n'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://fr.example.com/</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/" />\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/" />\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/" />\n'
      ) !== -1
    );
    // Child One
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/tab-one/child-one</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/tab-one/child-one" />\n'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/es/tab-one/child-one</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/tab-one/child-one" />\n'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://fr.example.com/tab-one/child-one</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/tab-one/child-one" />\n'
      ) !== -1
    );
    // Product Cheese
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/products/cheese</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/products/cheese" />\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/products/cheese-es" />'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/es/products/cheese-es</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/products/cheese-es" />\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/products/cheese" />\n'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://fr.example.com/products/cheese</loc>'
      ) === -1
    );
    assert(
      xml.indexOf(
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/products/cheese" />'
      ) === -1
    );
  });

  it('should create app with perLocale option enabled', async function () {
    await t.destroy(apos);

    const appConfig = getAppConfig({
      multilanguage: true,
      perLocale: true
    });

    apos = await t.create({
      root: module,
      baseUrl: 'http://localhost:7780',
      testModule: true,
      modules: appConfig
    });

    assert.deepEqual(Object.keys(apos.i18n.getLocales()), [ 'en', 'es', 'fr' ]);

    // Add test content
    {
      const rockProduct = apos.product.newInstance();
      rockProduct.title = 'Rocks';
      rockProduct.slug = 'rocks';
      rockProduct.published = false;

      const inserted = await apos.product.insert(apos.task.getReq({
        mode: 'draft'
      }), rockProduct);

      assert(inserted.aposMode === 'draft');
      assert(inserted.published === false);
      assert(inserted.slug === 'rocks');
    }

    {
      const cheeseProduct = apos.product.newInstance();
      cheeseProduct.title = 'Cheese';
      cheeseProduct.slug = 'cheese';

      const inserted = await apos.product.insert(apos.task.getReq(), cheeseProduct);
      await apos.product.publish(apos.task.getReq(), inserted);
      inserted.slug = 'cheese-es';
      const localized = await apos.product.localize(apos.task.getReq(), inserted, 'es');
      await apos.product.publish(apos.task.getReq(), localized);

      assert(inserted._id);
      assert(inserted._id !== localized._id);
      assert(localized.slug === 'cheese-es');
    }
  });

  it('should generate sitemap index when perLocale is true without crashing', async function () {
    try {
      // Test that sitemap index is accessible
      const indexXml = await apos.http.get('/sitemaps/index.xml');

      assert(indexXml);
      assert(indexXml.indexOf('<sitemapindex') !== -1);
      assert(indexXml.indexOf('<sitemap>') !== -1);
      assert(indexXml.indexOf('<loc>http://localhost:7780/sitemaps/en.xml</loc>') !== -1);
      assert(indexXml.indexOf('<loc>http://localhost:7780/sitemaps/es.xml</loc>') !== -1);
      assert(indexXml.indexOf('<loc>http://localhost:7780/sitemaps/fr.xml</loc>') !== -1);
      assert(indexXml.indexOf('<lastmod>') !== -1);

      // Test that individual locale sitemaps are accessible
      const enXml = await apos.http.get('/sitemaps/en.xml');
      assert(enXml);
      assert(enXml.indexOf('<urlset') !== -1);
      assert(enXml.indexOf('<loc>http://localhost:7780/</loc>') !== -1);
      assert(enXml.indexOf('<loc>http://localhost:7780/products/cheese</loc>') !== -1);

      const esXml = await apos.http.get('/sitemaps/es.xml');
      assert(esXml);
      assert(esXml.indexOf('<urlset') !== -1);
      assert(esXml.indexOf('<loc>http://localhost:7780/es/</loc>') !== -1);

      const frXml = await apos.http.get('/sitemaps/fr.xml');
      assert(frXml);
      assert(frXml.indexOf('<urlset') !== -1);
      assert(frXml.indexOf('<loc>http://fr.example.com/</loc>') !== -1);

    } catch (error) {
      // If this fails, it means the perLocale option is causing crashes
      assert(!error, `perLocale sitemap generation failed: ${error.message}`);
    }
  });

  it('should verify sitemap.xml does not crash site when perLocale is true', async function () {
    try {
      // When perLocale is true, the main sitemap.xml should not exist
      // and should return a 404 or redirect to the index
      const response = await apos.http.get('/sitemap.xml');

      // This might be a 404 or might redirect to index - either is acceptable
      // The important thing is that it doesn't crash the application
      assert(response !== undefined);

    } catch (error) {
      // A 404 is expected behavior when perLocale is true
      // We just want to make sure the application doesn't crash
      assert(error.status === 404 || error.message.includes('404'));
    }
  });
});

describe('Sitemap – getAllUrlMetadata integration (static: true)', function () {
  this.timeout(t.timeout);

  describe('filter and pagination URLs', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        baseUrl: 'http://localhost:7780',
        testModule: true,
        modules: getProductAppConfig({
          perPage: 3,
          staticUrls: true
        })
      });

      const req = apos.task.getReq();
      // 6 electronics, 2 books → 8 total
      for (let i = 1; i <= 8; i++) {
        await apos.product.insert(req, {
          title: `Product ${String(i).padStart(2, '0')}`,
          slug: `product-${String(i).padStart(2, '0')}`,
          visibility: 'public',
          category: i <= 6 ? 'electronics' : 'books'
        });
      }
    });

    after(async function () {
      await t.destroy(apos);
    });

    it('should include filter URLs in the sitemap', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      assert(xml.indexOf('<loc>http://localhost:7780/products/category/electronics</loc>') !== -1,
        'Should include electronics filter URL');
      assert(xml.indexOf('<loc>http://localhost:7780/products/category/books</loc>') !== -1,
        'Should include books filter URL');
    });

    it('should include pagination URLs for the main index', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      // 8 products with perPage=3 → pages 2 and 3
      assert(xml.indexOf('<loc>http://localhost:7780/products/page/2</loc>') !== -1,
        'Should include page 2');
      assert(xml.indexOf('<loc>http://localhost:7780/products/page/3</loc>') !== -1,
        'Should include page 3');
      // Page 1 is the base /products URL, no separate /page/1
      assert(xml.indexOf('<loc>http://localhost:7780/products/page/1</loc>') === -1,
        'Should NOT include page 1 separately');
    });

    it('should include paginated filter URLs when needed', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      // 6 electronics with perPage=3 → 2 pages for the electronics filter
      assert(xml.indexOf('<loc>http://localhost:7780/products/category/electronics/page/2</loc>') !== -1,
        'Should include electronics page 2');
      // 2 books with perPage=3 → only 1 page, no separate pagination entry
      assert(xml.indexOf('<loc>http://localhost:7780/products/category/books/page/2</loc>') === -1,
        'Should NOT include books page 2 (only 2 items)');
    });

    it('should still include individual piece URLs', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      assert(xml.indexOf('<loc>http://localhost:7780/products/product-01</loc>') !== -1,
        'Should include individual product URL');
      assert(xml.indexOf('<loc>http://localhost:7780/products/product-08</loc>') !== -1,
        'Should include last product URL');
    });

    it('should include the base index page URL', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      assert(xml.indexOf('<loc>http://localhost:7780/products</loc>') !== -1,
        'Should include the products index page');
    });
  });

  describe('literal content and sitemap:false exclusion', function () {
    let apos;

    before(async function () {
      const appConfig = getAppConfig({
        extraModules: {
          'custom-urls': {
            handlers(self) {
              return {
                '@apostrophecms/url:getAllUrlMetadata': {
                  addCustomEntries(req, results) {
                    // A literal content entry — should be excluded
                    results.push({
                      url: '/custom-styles.css',
                      contentType: 'text/css',
                      i18nId: 'custom:styles',
                      sitemap: false
                    });
                    // A sitemap:false entry without contentType — should be excluded
                    results.push({
                      url: '/internal-only',
                      i18nId: 'custom:internal',
                      sitemap: false
                    });
                    // A normal entry — should be included
                    results.push({
                      url: '/custom-page',
                      i18nId: 'custom:page',
                      changefreq: 'weekly',
                      priority: 0.5
                    });
                  }
                }
              };
            }
          }
        }
      });

      apos = await t.create({
        root: module,
        baseUrl: 'http://localhost:7780',
        testModule: true,
        modules: appConfig
      });
    });

    after(async function () {
      await t.destroy(apos);
    });

    it('should exclude literal content entries from the sitemap', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      assert(xml.indexOf('/custom-styles.css') === -1,
        'Literal content entry should not appear in sitemap');
    });

    it('should exclude sitemap:false entries from the sitemap', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      assert(xml.indexOf('/internal-only') === -1,
        'sitemap:false entry should not appear in sitemap');
    });

    it('should include normal event-contributed entries in the sitemap', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      assert(xml.indexOf('<loc>http://localhost:7780/custom-page</loc>') !== -1,
        'Normal event-contributed entry should appear in sitemap');
    });

    it('should use custom changefreq and priority from event entries', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      // Find the block containing /custom-page and verify changefreq/priority
      const idx = xml.indexOf('<loc>http://localhost:7780/custom-page</loc>');
      assert(idx !== -1);
      // Extract the surrounding <url> block
      const urlStart = xml.lastIndexOf('<url>', idx);
      const urlEnd = xml.indexOf('</url>', idx);
      const urlBlock = xml.slice(urlStart, urlEnd);
      assert(urlBlock.indexOf('<changefreq>weekly</changefreq>') !== -1,
        'Should use the custom changefreq');
      assert(urlBlock.indexOf('<priority>0.5</priority>') !== -1,
        'Should use the custom priority');
    });
  });

  describe('multi-language filter and pagination URLs', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        baseUrl: 'http://localhost:7780',
        testModule: true,
        modules: getProductAppConfig({
          perPage: 5,
          staticUrls: true,
          multilanguage: true
        })
      });

      const req = apos.task.getReq();
      for (let i = 1; i <= 4; i++) {
        const product = await apos.product.insert(req, {
          title: `Product ${i}`,
          visibility: 'public',
          category: i <= 2 ? 'electronics' : 'books'
        });
        await apos.product.publish(req, product);
        // Localize to Spanish
        const localized = await apos.product.localize(req, product, 'es');
        await apos.product.publish(req, localized);
      }
    });

    after(async function () {
      await t.destroy(apos);
    });

    it('should include filter URLs for each locale', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      // English
      assert(xml.indexOf('<loc>http://localhost:7780/products/category/electronics</loc>') !== -1,
        'Should include en electronics filter');
      assert(xml.indexOf('<loc>http://localhost:7780/products/category/books</loc>') !== -1,
        'Should include en books filter');
      // Spanish
      assert(xml.indexOf('<loc>http://localhost:7780/es/products/category/electronics</loc>') !== -1,
        'Should include es electronics filter');
      assert(xml.indexOf('<loc>http://localhost:7780/es/products/category/books</loc>') !== -1,
        'Should include es books filter');
    });

    it('should cross-reference filter URLs with hreflang across locales', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      // The electronics filter URL in en should have hreflang pointing to es
      const enIdx = xml.indexOf('<loc>http://localhost:7780/products/category/electronics</loc>');
      assert(enIdx !== -1);
      const urlStart = xml.lastIndexOf('<url>', enIdx);
      const urlEnd = xml.indexOf('</url>', enIdx);
      const urlBlock = xml.slice(urlStart, urlEnd);
      assert(
        urlBlock.indexOf('hreflang="es" href="http://localhost:7780/es/products/category/electronics"') !== -1,
        'en electronics filter should have hreflang pointing to es equivalent'
      );
    });
  });
});

describe('Sitemap – query string URLs (static: false)', function () {
  this.timeout(t.timeout);

  describe('filter and pagination URLs', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        baseUrl: 'http://localhost:7780',
        testModule: true,
        modules: getProductAppConfig({ perPage: 3 })
      });

      const req = apos.task.getReq();
      // 6 electronics, 2 books → 8 total
      for (let i = 1; i <= 8; i++) {
        await apos.product.insert(req, {
          title: `Product ${String(i).padStart(2, '0')}`,
          slug: `product-${String(i).padStart(2, '0')}`,
          visibility: 'public',
          category: i <= 6 ? 'electronics' : 'books'
        });
      }
    });

    after(async function () {
      await t.destroy(apos);
    });

    it('should include filter URLs with query string format', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      assert(xml.indexOf('<loc>http://localhost:7780/products?category=electronics</loc>') !== -1,
        'Should include electronics filter URL as query string');
      assert(xml.indexOf('<loc>http://localhost:7780/products?category=books</loc>') !== -1,
        'Should include books filter URL as query string');
    });

    it('should include pagination URLs with query string format', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      // 8 products with perPage=3 → pages 2 and 3
      assert(xml.indexOf('http://localhost:7780/products?page=2') !== -1,
        'Should include page 2 as query string');
      assert(xml.indexOf('http://localhost:7780/products?page=3') !== -1,
        'Should include page 3 as query string');
      // Page 1 is the base /products URL
      assert(xml.indexOf('http://localhost:7780/products?page=1') === -1,
        'Should NOT include page 1 separately');
    });

    it('should include paginated filter URLs with query string format', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      // 6 electronics with perPage=3 → 2 pages for the electronics filter
      // Query strings use &amp; in XML
      assert(xml.indexOf('http://localhost:7780/products?category=electronics&amp;page=2') !== -1,
        'Should include electronics page 2 with proper XML escaping');
      // 2 books with perPage=3 → only 1 page
      assert(xml.indexOf('http://localhost:7780/products?category=books&amp;page=2') === -1,
        'Should NOT include books page 2 (only 2 items)');
    });

    it('should NOT use path-based filter URLs', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      // These are the static: true format — should not appear
      assert(xml.indexOf('/products/category/electronics') === -1,
        'Should not use path-based filter format');
      assert(xml.indexOf('/products/page/2') === -1,
        'Should not use path-based pagination format');
    });

    it('should still include individual piece URLs and index page', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      assert(xml.indexOf('<loc>http://localhost:7780/products</loc>') !== -1,
        'Should include the products index page');
      assert(xml.indexOf('<loc>http://localhost:7780/products/product-01</loc>') !== -1,
        'Should include individual product URL');
      assert(xml.indexOf('<loc>http://localhost:7780/products/product-08</loc>') !== -1,
        'Should include last product URL');
    });
  });

  describe('multi-language filter URLs', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        baseUrl: 'http://localhost:7780',
        testModule: true,
        modules: getProductAppConfig({
          perPage: 5,
          multilanguage: true
        })
      });

      const req = apos.task.getReq();
      for (let i = 1; i <= 4; i++) {
        const product = await apos.product.insert(req, {
          title: `Product ${i}`,
          visibility: 'public',
          category: i <= 2 ? 'electronics' : 'books'
        });
        await apos.product.publish(req, product);
        const localized = await apos.product.localize(req, product, 'es');
        await apos.product.publish(req, localized);
      }
    });

    after(async function () {
      await t.destroy(apos);
    });

    it('should include query string filter URLs for each locale', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      // English
      assert(xml.indexOf('<loc>http://localhost:7780/products?category=electronics</loc>') !== -1,
        'Should include en electronics filter');
      assert(xml.indexOf('<loc>http://localhost:7780/products?category=books</loc>') !== -1,
        'Should include en books filter');
      // Spanish
      assert(xml.indexOf('<loc>http://localhost:7780/es/products?category=electronics</loc>') !== -1,
        'Should include es electronics filter');
      assert(xml.indexOf('<loc>http://localhost:7780/es/products?category=books</loc>') !== -1,
        'Should include es books filter');
    });

    it('should cross-reference query string filter URLs with hreflang', async function () {
      const xml = await apos.http.get('/sitemap.xml');

      const enIdx = xml.indexOf('<loc>http://localhost:7780/products?category=electronics</loc>');
      assert(enIdx !== -1);
      const urlStart = xml.lastIndexOf('<url>', enIdx);
      const urlEnd = xml.indexOf('</url>', enIdx);
      const urlBlock = xml.slice(urlStart, urlEnd);
      assert(
        urlBlock.indexOf('hreflang="es" href="http://localhost:7780/es/products?category=electronics"') !== -1,
        'en electronics filter should have hreflang pointing to es equivalent'
      );
    });
  });
});

describe('Sitemap – static build URL generation', function () {
  this.timeout(t.timeout);

  describe('single-language', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        baseUrl: 'http://localhost:7780',
        staticBaseUrl: 'https://example.com',
        testModule: true,
        modules: getAppConfig({
          externalFrontKey: 'test-key'
        })
      });
    });

    after(async function () {
      await t.destroy(apos);
    });

    it('should use staticBaseUrl in sitemap when static build headers are sent', async function () {
      const xml = await apos.http.get('/sitemap.xml', {
        headers: {
          'x-requested-with': 'AposExternalFront',
          'apos-external-front-key': 'test-key',
          'x-apos-static-base-url': '1'
        }
      });

      assert(xml);
      assert(xml.indexOf('<loc>https://example.com/</loc>') !== -1,
        'Should use staticBaseUrl for home page');
      assert(xml.indexOf('http://localhost:7780') === -1,
        'Should NOT contain localhost baseUrl');
    });

    it('should use regular baseUrl when no static build headers are sent', async function () {
      // Clear cache first so it regenerates
      await apos.cache.clear('apos-sitemap');

      const xml = await apos.http.get('/sitemap.xml');

      assert(xml);
      assert(xml.indexOf('<loc>http://localhost:7780/</loc>') !== -1,
        'Should use regular baseUrl');
      assert(xml.indexOf('https://example.com') === -1,
        'Should NOT contain staticBaseUrl');
    });

    it('should not poison the cache with static build URLs', async function () {
      // Clear cache
      await apos.cache.clear('apos-sitemap');

      // Request with static build headers (should NOT cache)
      await apos.http.get('/sitemap.xml', {
        headers: {
          'x-requested-with': 'AposExternalFront',
          'apos-external-front-key': 'test-key',
          'x-apos-static-base-url': '1'
        }
      });

      // Now request without static build headers — should still get
      // regular baseUrl (cache was not poisoned)
      const xml = await apos.http.get('/sitemap.xml');

      assert(xml);
      assert(xml.indexOf('<loc>http://localhost:7780/</loc>') !== -1,
        'Cache should not be poisoned with staticBaseUrl');
      assert(xml.indexOf('https://example.com') === -1,
        'Static build URLs should not appear in cached result');
    });
  });

  describe('multi-language', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        baseUrl: 'http://localhost:7780',
        staticBaseUrl: 'https://example.com',
        testModule: true,
        modules: getAppConfig({
          multilanguage: true,
          externalFrontKey: 'test-key'
        })
      });
    });

    after(async function () {
      await t.destroy(apos);
    });

    it('should use staticBaseUrl for all locales in static build', async function () {
      const xml = await apos.http.get('/sitemap.xml', {
        headers: {
          'x-requested-with': 'AposExternalFront',
          'apos-external-front-key': 'test-key',
          'x-apos-static-base-url': '1'
        }
      });

      assert(xml);
      // English home
      assert(xml.indexOf('<loc>https://example.com/</loc>') !== -1,
        'English home should use staticBaseUrl');
      // Spanish home (prefix locale)
      assert(xml.indexOf('<loc>https://example.com/es/</loc>') !== -1,
        'Spanish home should use staticBaseUrl with locale prefix');
      // French home (hostname locale) — hostname override takes priority
      assert(xml.indexOf('<loc>http://fr.example.com/</loc>') !== -1,
        'French home should use hostname override, not staticBaseUrl');
      // Verify no localhost URLs for en/es
      assert(xml.indexOf('<loc>http://localhost:7780/</loc>') === -1,
        'Should NOT have localhost for English');
      assert(xml.indexOf('<loc>http://localhost:7780/es/</loc>') === -1,
        'Should NOT have localhost for Spanish');
    });

    it('should use staticBaseUrl in hreflang links for static build', async function () {
      const xml = await apos.http.get('/sitemap.xml', {
        headers: {
          'x-requested-with': 'AposExternalFront',
          'apos-external-front-key': 'test-key',
          'x-apos-static-base-url': '1'
        }
      });

      // English home should have hreflang pointing to es with staticBaseUrl
      assert(
        xml.indexOf('hreflang="es" href="https://example.com/es/"') !== -1,
        'English hreflang for es should use staticBaseUrl'
      );
      // French hostname should still be used in hreflang
      assert(
        xml.indexOf('hreflang="fr" href="http://fr.example.com/"') !== -1,
        'French hreflang should use hostname override'
      );
    });
  });

  describe('strict fallback (no staticBaseUrl)', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        baseUrl: 'http://localhost:7780',
        testModule: true,
        modules: getAppConfig({
          externalFrontKey: 'test-key'
        })
      });
    });

    after(async function () {
      await t.destroy(apos);
    });

    it('should fall back to baseUrl when staticBaseUrl is not configured', async function () {
      const xml = await apos.http.get('/sitemap.xml', {
        headers: {
          'x-requested-with': 'AposExternalFront',
          'apos-external-front-key': 'test-key',
          'x-apos-static-base-url': '1'
        }
      });

      assert(xml);
      // With strict: true and no staticBaseUrl, should fall back to baseUrl
      assert(xml.indexOf('<loc>http://localhost:7780/</loc>') !== -1,
        'Should fall back to baseUrl when staticBaseUrl is not set');
    });
  });
});

function getProductAppConfig({
  perPage = 3, staticUrls = false, multilanguage = false
} = {}) {
  return getAppConfig({
    multilanguage,
    park: [
      {
        title: 'Products',
        type: 'product-page',
        slug: '/products',
        parkedId: 'products'
      }
    ],
    types: [
      {
        name: '@apostrophecms/home-page',
        label: 'Home'
      },
      {
        name: 'product-page',
        label: 'Products'
      }
    ],
    extraModules: {
      ...(staticUrls
        ? {
          '@apostrophecms/url': {
            options: { static: true }
          }
        }
        : {}
      ),
      product: {
        extend: '@apostrophecms/piece-type',
        options: {
          alias: 'product',
          sort: { title: 1 }
        },
        fields: {
          add: {
            category: {
              type: 'select',
              label: 'Category',
              choices: [
                {
                  label: 'Electronics',
                  value: 'electronics'
                },
                {
                  label: 'Books',
                  value: 'books'
                }
              ]
            }
          }
        }
      },
      'product-page': {
        extend: '@apostrophecms/piece-page-type',
        options: {
          perPage,
          piecesFilters: [
            { name: 'category' }
          ]
        }
      }
    }
  });
}

const parkedPages = [
  {
    title: 'Tab One',
    type: 'default-page',
    slug: '/tab-one',
    parkedId: 'tabOne',
    _children: [
      {
        title: 'Tab One Child One',
        type: 'default-page',
        slug: '/tab-one/child-one',
        parkedId: 'tabOneChildOne'
      },
      {
        title: 'Tab One Child Two',
        type: 'default-page',
        slug: '/tab-one/child-two',
        parkedId: 'tabOneChildTwo'
      }
    ]
  },
  {
    title: 'Tab Two',
    type: 'default-page',
    slug: '/tab-two',
    parkedId: 'tabTwo',
    _children: [
      {
        title: 'Tab Two Child One',
        type: 'default-page',
        slug: '/tab-two/child-one',
        parkedId: 'tabTwoChildOne'
      },
      {
        title: 'Tab Two Child Two',
        type: 'default-page',
        slug: '/tab-two/child-two',
        parkedId: 'tabTwoChildTwo'
      }
    ]
  },
  {
    title: 'Products',
    type: 'product-page',
    slug: '/products',
    parkedId: 'products'
  }
];

const pageTypes = [
  {
    name: '@apostrophecms/home-page',
    label: 'Home'
  },
  {
    name: 'default-page',
    label: 'Default'
  },
  {
    name: 'product-page',
    label: 'Products'
  }
];

function getAppConfig(options = {}) {
  return {
    '@apostrophecms/express': {
      options: {
        session: { secret: 'supersecret' },
        ...(options.externalFrontKey
          ? { externalFrontKey: options.externalFrontKey }
          : {})
      }
    },
    ...(options.multilanguage
      ? {
        '@apostrophecms/i18n': {
          options: {
            defaultLocale: 'en',
            locales: {
              en: {
                label: 'English'
              },
              es: {
                label: 'Español',
                prefix: '/es'
              },
              fr: {
                label: 'Français',
                hostname: 'fr.example.com'
              }
            }
          }
        }
      }
      : {}
    ),
    '@apostrophecms/sitemap': {
      options: {
        excludeTypes: options.excludeTypes,
        perLocale: options.perLocale || false
      }
    },
    '@apostrophecms/page': {
      options: {
        park: options.park || parkedPages,
        types: options.types || pageTypes
      }
    },
    'default-page': {
      extend: '@apostrophecms/page-type'
    },
    product: {
      extend: '@apostrophecms/piece-type',
      options: {
        alias: 'product'
      }
    },
    'product-page': {
      extend: '@apostrophecms/piece-page-type'
    },
    ...(options.extraModules || {})
  };
}
