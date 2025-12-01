/* eslint-disable no-console */
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

function getAppConfig (options = {}) {
  return {
    '@apostrophecms/express': {
      options: {
        port: 7780,
        session: { secret: 'supersecret' }
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
        park: parkedPages,
        types: pageTypes
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
    }
  };
}
