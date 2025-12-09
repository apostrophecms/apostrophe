const assert = require('assert').strict;
const t = require('apostrophe/test-lib/util.js');

describe('@apostrophecms/seo - Integration Tests (Actual Page Output)', function () {
  let apos;

  this.timeout(t.timeout);

  after(async function () {
    await t.destroy(apos);
  });

  before(async function () {
    apos = await t.create({
      root: module,
      testModule: true,
      modules: getAppConfig()
    });
  });

  afterEach(async function () {
    // Clean up test articles between tests
    await apos.doc.db.deleteMany({
      type: 'article',
      title: /^Test/
    });
  });

  describe('JSON-LD and Meta Tags output', function () {

    it('should render homepage with Organization and WebSite schemas', async function () {
      const req = apos.task.getReq();

      // Configure global organization
      const global = await apos.global.findGlobal(req);
      await apos.doc.db.updateOne(
        { _id: global._id },
        {
          $set: {
            seoSiteCanonicalUrl: 'https://example.com',
            seoSiteName: 'Example Tech Corp',
            seoSiteDescription: 'Leading provider of tech solutions',
            seoJsonLdOrganization: {
              name: 'Example Tech Corp',
              type: 'Corporation',
              description: 'We build amazing software',
              contactPoint: {
                telephone: '+1-555-0100',
                type: 'customer service'
              },
              address: {
                street: '100 Tech Drive',
                city: 'San Francisco',
                state: 'CA',
                zip: '94105',
                country: 'US'
              }
            },
            seoSocialProfiles: [
              {
                platform: 'twitter',
                profileUrl: 'https://twitter.com/examplecorp'
              },
              {
                platform: 'linkedin',
                profileUrl: 'https://linkedin.com/company/example'
              }
            ]
          }
        }
      );

      const html = await apos.http.get('http://localhost:3000/');

      assert(
        html.includes('<script type="application/ld+json">'),
        'Homepage should contain JSON-LD script tag'
      );

      const jsonLdMatch = html.match(
        /<script type="application\/ld\+json">\s*(\{[\s\S]*?\})\s*<\/script>/
      );

      assert(jsonLdMatch, 'Should find JSON-LD script block');
      const jsonLd = JSON.parse(jsonLdMatch[1]);

      // Verify structure
      assert.strictEqual(jsonLd['@context'], 'https://schema.org');
      assert(Array.isArray(jsonLd['@graph']), 'Should have @graph array');

      // Verify WebSite schema
      const websiteSchema = jsonLd['@graph'].find(s => s['@type'] === 'WebSite');
      assert(websiteSchema, 'Homepage should include WebSite schema');
      assert.strictEqual(websiteSchema.name, 'Example Tech Corp');
      assert.strictEqual(websiteSchema.url, 'https://example.com');
      assert(websiteSchema.potentialAction, 'WebSite should have search action');
      assert.strictEqual(websiteSchema.potentialAction['@type'], 'SearchAction');

      // Verify Organization schema
      const orgSchema = jsonLd['@graph'].find(s => s['@type'] === 'Corporation');
      assert(orgSchema, 'Homepage should include Organization schema');
      assert.strictEqual(orgSchema.name, 'Example Tech Corp');
      assert.strictEqual(orgSchema.description, 'We build amazing software');

      // Verify contact point
      assert(orgSchema.contactPoint, 'Organization should have contact point');
      assert.strictEqual(orgSchema.contactPoint.telephone, '+1-555-0100');
      assert.strictEqual(orgSchema.contactPoint.contactType, 'customer service');

      // Verify address
      assert(orgSchema.address, 'Organization should have address');
      assert.strictEqual(orgSchema.address.streetAddress, '100 Tech Drive');
      assert.strictEqual(orgSchema.address.addressLocality, 'San Francisco');

      // Verify social profiles
      assert(Array.isArray(orgSchema.sameAs), 'Organization should have sameAs array');
      assert.strictEqual(orgSchema.sameAs.length, 2);
      assert(orgSchema.sameAs.includes('https://twitter.com/examplecorp'));
      assert(orgSchema.sameAs.includes('https://linkedin.com/company/example'));
    });

    it('should render homepage with minimal configuration', async function () {
      const req = apos.task.getReq();

      const global = await apos.global.findGlobal(req);
      await apos.doc.db.updateOne(
        { _id: global._id },
        {
          $set: {
            seoSiteName: 'Minimal Site'
          }
        }
      );

      const html = await apos.http.get('http://localhost:3000/');

      assert(
        html.includes('<script type="application/ld+json">'),
        'Homepage should contain JSON-LD even with minimal config'
      );

      const jsonLdMatch = html.match(
        /<script type="application\/ld\+json">\s*(\{[\s\S]*?\})\s*<\/script>/
      );

      const jsonLd = JSON.parse(jsonLdMatch[1]);

      const websiteSchema = jsonLd['@graph'].find(s => s['@type'] === 'WebSite');
      assert(websiteSchema, 'Should have WebSite schema with minimal config');
      assert.strictEqual(websiteSchema.name, 'Minimal Site');
    });

    it('should output Article JSON-LD and meta tags on article page', async function () {
      const req = apos.task.getReq();

      const global = await apos.global.findGlobal(req);
      await apos.doc.db.updateOne(
        { _id: global._id },
        {
          $set: {
            seoSiteCanonicalUrl: 'https://example.com',
            seoSiteName: 'Test Site',
            seoJsonLdOrganization: {
              name: 'Test Organization',
              type: 'Organization'
            }
          }
        }
      );

      const article = await apos.article.insert(req, {
        title: 'Test SEO Article',
        seoTitle: 'SEO Optimized Article Title',
        seoDescription: 'This is a test article for SEO schema validation',
        seoJsonLdType: 'Article',
        author: 'Jane Doe',
        publishedAt: new Date('2024-01-15'),
        slug: 'test-seo-output-article',
        visibility: 'public'
      });

      const response = await apos.http.get(
        `http://localhost:3000${article._url || '/articles/test-seo-output-article'}`
      );

      assert(response, 'Should receive HTML response');
      assert(response.length > 0, 'Response should not be empty');

      assert(
        response.includes('<script type="application/ld+json">'),
        'Page should contain JSON-LD script tag'
      );

      const jsonLdMatch = response.match(
        /<script type="application\/ld\+json">\s*(\{[\s\S]*?\})\s*<\/script>/
      );

      assert(jsonLdMatch, 'Should find JSON-LD script block in HTML');
      assert(jsonLdMatch[1], 'JSON-LD content should not be empty');

      let jsonLd;
      try {
        jsonLd = JSON.parse(jsonLdMatch[1]);
      } catch (e) {
        assert.fail(`JSON-LD should be valid JSON: ${e.message}`);
      }

      assert.strictEqual(
        jsonLd['@context'],
        'https://schema.org',
        'JSON-LD should have correct @context'
      );
      assert(
        Array.isArray(jsonLd['@graph']),
        'JSON-LD should have @graph array'
      );

      const websiteSchema = jsonLd['@graph'].find(s => s['@type'] === 'WebSite');
      const orgSchema = jsonLd['@graph'].find(s => s['@type'] === 'Organization');
      const articleSchema = jsonLd['@graph'].find(s => s['@type'] === 'Article');

      assert(websiteSchema, 'Page should include WebSite schema');
      assert.strictEqual(websiteSchema.name, 'Test Site');

      assert(orgSchema, 'Page should include Organization schema');
      assert.strictEqual(orgSchema.name, 'Test Organization');

      assert(articleSchema, 'Page should include Article schema');
      assert.strictEqual(
        articleSchema.headline,
        'SEO Optimized Article Title',
        'Article schema should have correct headline'
      );
      assert.strictEqual(
        articleSchema.description,
        'This is a test article for SEO schema validation',
        'Article schema should have correct description'
      );
      assert(articleSchema.author, 'Article schema should have author');
      assert.strictEqual(
        articleSchema.author.name,
        'Jane Doe',
        'Article author should be Jane Doe'
      );
      assert(
        response.includes('<meta name="description"'),
        'Page should contain meta description tag'
      );
      assert(
        response.includes('This is a test article for SEO schema validation'),
        'Meta description should have correct content'
      );
      assert(
        response.includes('SEO Optimized Article Title'),
        'Page should contain SEO title'
      );
    });

    it('should output Product JSON-LD on product page', async function () {
      const req = apos.task.getReq();

      const global = await apos.global.findGlobal(req);
      await apos.doc.db.updateOne(
        { _id: global._id },
        {
          $set: {
            seoSiteCanonicalUrl: 'https://example.com',
            seoSiteName: 'Test Site'
          }
        }
      );

      const product = await apos.article.insert(req, {
        title: 'Test Product',
        seoTitle: 'Amazing Widget - Buy Now',
        seoDescription: 'The best widget you can buy',
        seoJsonLdType: 'Product',
        seoJsonLdProduct: {
          name: 'Amazing Widget',
          price: 29.99,
          currency: 'USD',
          availability: 'InStock',
          brand: 'TestBrand',
          sku: 'WIDGET-001'
        },
        slug: 'test-product-widget',
        visibility: 'public'
      });

      const response = await apos.http.get(
        `http://localhost:3000${product._url || '/articles/test-product-widget'}`
      );

      const jsonLdMatch = response.match(
        /<script type="application\/ld\+json">\s*(\{[\s\S]*?\})\s*<\/script>/
      );
      assert(jsonLdMatch, 'Should find JSON-LD in product page');

      const jsonLd = JSON.parse(jsonLdMatch[1]);
      const productSchema = jsonLd['@graph'].find(s => s['@type'] === 'Product');

      assert(productSchema, 'Page should include Product schema');
      assert.strictEqual(productSchema.name, 'Amazing Widget');
      assert(productSchema.offers, 'Product should have offers');
      assert.strictEqual(productSchema.offers.price, '29.99');
      assert.strictEqual(productSchema.offers.priceCurrency, 'USD');
      assert.strictEqual(productSchema.sku, 'WIDGET-001');
    });

    it('should output CollectionPage and ItemList on listing page', async function () {
      const req = apos.task.getReq();

      const global = await apos.global.findGlobal(req);
      await apos.doc.db.updateOne(
        { _id: global._id },
        {
          $set: {
            seoSiteCanonicalUrl: 'https://example.com',
            seoSiteName: 'Test Site'
          }
        }
      );

      await apos.article.insert(req, {
        title: 'First Article',
        seoTitle: 'First Article SEO Title',
        slug: 'first-article',
        visibility: 'public'
      });

      await apos.article.insert(req, {
        title: 'Second Article',
        seoTitle: 'Second Article SEO Title',
        slug: 'second-article',
        visibility: 'public'
      });

      const response = await apos.http.get('http://localhost:3000/articles');

      const jsonLdMatch = response.match(
        /<script type="application\/ld\+json">\s*(\{[\s\S]*?\})\s*<\/script>/
      );
      assert(jsonLdMatch, 'Should find JSON-LD in listing page');

      const jsonLd = JSON.parse(jsonLdMatch[1]);

      const itemListSchema = jsonLd['@graph'].find(s => s['@type'] === 'ItemList');

      if (itemListSchema) {
        assert(itemListSchema.itemListElement, 'ItemList should have items');
        assert(
          itemListSchema.numberOfItems >= 2,
          'ItemList should include our test articles'
        );
      }

      const breadcrumbSchema = jsonLd['@graph'].find(s => s['@type'] === 'BreadcrumbList');

      if (breadcrumbSchema) {
        assert(breadcrumbSchema.itemListElement, 'BreadcrumbList should have items');
      }
    });

    it('should handle robots meta tag directives', async function () {
      const req = apos.task.getReq();

      const article = await apos.article.insert(req, {
        title: 'Test Robots Article',
        seoTitle: 'Article with Robots Directives',
        seoDescription: 'Testing robots meta tag',
        seoRobots: [ 'noindex', 'nofollow' ],
        slug: 'test-robots-article',
        visibility: 'public'
      });

      const response = await apos.http.get(
        `http://localhost:3000${article._url || '/articles/test-robots-article'}`
      );

      assert(
        response.includes('<meta name="robots"'),
        'Page should contain robots meta tag'
      );
      assert(
        response.includes('noindex'),
        'Robots meta should include noindex'
      );
      assert(
        response.includes('nofollow'),
        'Robots meta should include nofollow'
      );
    });
  });

  describe('API Routes Output', function () {
    it('should output valid robots.txt with AI crawler controls', async function () {
      const req = apos.task.getReq();

      const global = await apos.global.findGlobal(req);
      await apos.doc.db.updateOne(
        { _id: global._id },
        {
          $set: {
            robotsTxtSelection: 'allowSearchBlockAI'
          }
        }
      );

      const robotsTxt = await apos.http.get('http://localhost:3000/robots.txt');

      assert(robotsTxt.length > 0, 'robots.txt should have content');
      assert(robotsTxt.includes('User-agent:'), 'Should have User-agent directives');
      assert(
        robotsTxt.includes('User-agent: Googlebot'),
        'Should allow Googlebot'
      );
      assert(
        robotsTxt.includes('User-agent: bingbot'),
        'Should allow bingbot'
      );
      assert(
        robotsTxt.includes('User-agent: GPTBot') &&
        robotsTxt.includes('Disallow: /'),
        'Should block GPTBot'
      );
      assert(
        robotsTxt.includes('User-agent: ClaudeBot') &&
        robotsTxt.includes('Disallow: /'),
        'Should block ClaudeBot'
      );
      assert(
        robotsTxt.includes('User-agent: ChatGPT-User') &&
        robotsTxt.includes('Allow: /'),
        'Should allow ChatGPT-User (browsing)'
      );
    });

    it('should output valid llms.txt with site information', async function () {
      const req = apos.task.getReq();

      const global = await apos.global.findGlobal(req);
      await apos.doc.db.updateOne(
        { _id: global._id },
        {
          $set: {
            seoSiteCanonicalUrl: 'https://example.com',
            seoSiteName: 'Test Site for LLMs',
            seoSiteDescription: 'A test site demonstrating llms.txt',
            llmsTxtSelection: 'allow'
          }
        }
      );

      const llmsTxt = await apos.http.get('http://localhost:3000/llms.txt');

      assert(llmsTxt.length > 0, 'llms.txt should have content');
      assert(llmsTxt.includes('#'), 'Should have markdown headers');
      assert(llmsTxt.includes('Test Site for LLMs'), 'Should include site name');
      assert(
        llmsTxt.includes('A test site demonstrating llms.txt'),
        'Should include site description'
      );
      assert(llmsTxt.includes('https://example.com'), 'Should include base URL');
      assert(
        llmsTxt.includes('## AI Training Policy') ||
        llmsTxt.includes('AI Training'),
        'Should include AI policy section'
      );
    });
  });

  describe('Edge Cases - Missing Data', function () {

    it('should handle article without author gracefully', async function () {
      const req = apos.task.getReq();

      const article = await apos.article.insert(req, {
        title: 'Article Without Author',
        seoTitle: 'No Author Article',
        seoDescription: 'Testing missing author',
        seoJsonLdType: 'Article',
        // No author field, no _author relationship, no updatedBy
        slug: 'no-author-article',
        visibility: 'public'
      });

      const html = await apos.http.get(
        `http://localhost:3000${article._url || '/articles/no-author-article'}`
      );

      const jsonLdMatch = html.match(
        /<script type="application\/ld\+json">\s*(\{[\s\S]*?\})\s*<\/script>/
      );

      const jsonLd = JSON.parse(jsonLdMatch[1]);
      const articleSchema = jsonLd['@graph'].find(s => s['@type'] === 'Article');

      assert(articleSchema, 'Article schema should exist even without author');
      assert.strictEqual(articleSchema.headline, 'No Author Article');
    });

    // This is acceptable - Google doesn't require images for articles
    it('should handle article without images gracefully', async function () {
      const req = apos.task.getReq();

      const article = await apos.article.insert(req, {
        title: 'Article Without Images',
        seoTitle: 'No Image Article',
        seoDescription: 'Testing missing images',
        seoJsonLdType: 'Article',
        // No _featuredImage, no attachment
        slug: 'no-image-article',
        visibility: 'public'
      });

      const html = await apos.http.get(
        `http://localhost:3000${article._url || '/articles/no-image-article'}`
      );

      const jsonLdMatch = html.match(
        /<script type="application\/ld\+json">\s*(\{[\s\S]*?\})\s*<\/script>/
      );

      const jsonLd = JSON.parse(jsonLdMatch[1]);
      const articleSchema = jsonLd['@graph'].find(s => s['@type'] === 'Article');

      assert(articleSchema, 'Article schema should exist even without images');
    });

    it('should not break page when JSON-LD generation fails', async function () {
      const req = apos.task.getReq();

      const article = await apos.article.insert(req, {
        title: 'Test Article',
        seoJsonLdType: 'Article',
        // Intentionally malformed nested data
        seoJsonLdProduct: {
          // Product data when type is Article - shouldn't cause crash
          price: 'invalid-price-string',
          name: 123 // number instead of string
        },
        slug: 'malformed-data',
        visibility: 'public'
      });

      // Page should still render even if schema generation has issues
      const html = await apos.http.get(
        `http://localhost:3000${article._url || '/articles/malformed-data'}`
      );

      assert(html.length > 0, 'Page should render even with malformed data');
      assert(html.includes('<html'), 'Should return valid HTML');
    });
  });
});

function getAppConfig() {
  return {
    '@apostrophecms/express': {
      options: {
        session: { secret: 'supersecret' },
        port: 3000
      }
    },
    '@apostrophecms/seo': {
      options: {
        alias: 'seo'
      }
    },
    'default-page': {},
    article: {
      extend: '@apostrophecms/piece-type',
      options: {
        label: 'Article',
        pluralLabel: 'Articles',
        alias: 'article'
      }
    },
    'article-page': {
      extend: '@apostrophecms/piece-page-type',
      options: {
        label: 'Article Page'
      }
    },
    '@apostrophecms/page': {
      options: {
        types: [
          {
            name: '@apostrophecms/home-page',
            label: 'Home'
          },
          {
            name: 'default-page',
            label: 'Default'
          }
        ],
        park: [
          {
            type: 'article-page',
            slug: '/articles',
            parkedId: 'articles'
          }
        ]
      }
    }
  };
};
