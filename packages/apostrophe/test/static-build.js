const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Static Build Support', function () {
  this.timeout(t.timeout);

  describe('URL helper methods', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/url': {}
        }
      });
    });

    after(async function () {
      await t.destroy(apos);
      apos = null;
    });

    it('should initialize with static: false (default)', async function () {
      assert(apos.url);
      assert.strictEqual(apos.url.options.static, false);
    });

    it('getChoiceFilter returns query string format when static is false', function () {
      assert.strictEqual(
        apos.url.getChoiceFilter('category', 'tech', 1),
        '?category=tech'
      );
    });

    it('getChoiceFilter returns query string with page when static is false', function () {
      assert.strictEqual(
        apos.url.getChoiceFilter('category', 'tech', 2),
        '?category=tech&page=2'
      );
    });

    it('getChoiceFilter returns empty string for null value', function () {
      assert.strictEqual(apos.url.getChoiceFilter('category', null, 1), '');
    });

    it('getChoiceFilter encodes special characters', function () {
      assert.strictEqual(
        apos.url.getChoiceFilter('my filter', 'hello world', 1),
        '?my%20filter=hello%20world'
      );
    });

    it('getPageFilter returns empty string for page 1', function () {
      assert.strictEqual(apos.url.getPageFilter(1), '');
    });

    it('getPageFilter returns query string for page > 1 when static is false', function () {
      assert.strictEqual(apos.url.getPageFilter(2), '?page=2');
    });
  });

  describe('Static mode URL helpers', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/url': {
            options: { static: true }
          }
        }
      });
    });

    after(async function () {
      await t.destroy(apos);
      apos = null;
    });

    it('should initialize with static: true', async function () {
      assert.strictEqual(apos.url.options.static, true);
    });

    it('getChoiceFilter returns path format when static is true', function () {
      assert.strictEqual(
        apos.url.getChoiceFilter('category', 'tech', 1),
        '/category/tech'
      );
    });

    it('getChoiceFilter returns path with page when static is true', function () {
      assert.strictEqual(
        apos.url.getChoiceFilter('category', 'tech', 2),
        '/category/tech/page/2'
      );
    });

    it('getPageFilter returns path format for page > 1 when static is true', function () {
      assert.strictEqual(apos.url.getPageFilter(2), '/page/2');
      assert.strictEqual(apos.url.getPageFilter(3), '/page/3');
    });

    it('getPageFilter still returns empty string for page 1 in static mode', function () {
      assert.strictEqual(apos.url.getPageFilter(1), '');
    });
  });

  describe('getAllUrlMetadata', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/url': {
            options: { static: true }
          },
          article: {
            extend: '@apostrophecms/piece-type',
            options: {
              name: 'article',
              label: 'Article',
              alias: 'article',
              sort: { title: 1 }
            },
            fields: {
              add: {
                category: {
                  type: 'select',
                  label: 'Category',
                  choices: [
                    {
                      label: 'Tech',
                      value: 'tech'
                    },
                    {
                      label: 'Science',
                      value: 'science'
                    },
                    {
                      label: 'Art',
                      value: 'art'
                    }
                  ]
                }
              }
            }
          },
          'article-page': {
            extend: '@apostrophecms/piece-page-type',
            options: {
              name: 'articlePage',
              label: 'Articles',
              alias: 'articlePage',
              perPage: 5,
              piecesFilters: [
                { name: 'category' }
              ]
            }
          },
          '@apostrophecms/page': {
            options: {
              park: [
                {
                  title: 'Articles',
                  type: 'articlePage',
                  slug: '/articles',
                  parkedId: 'articles'
                }
              ]
            }
          }
        }
      });

      // Insert 12 articles across 3 categories
      const req = apos.task.getReq();
      for (let i = 1; i <= 12; i++) {
        const padded = String(i).padStart(3, '0');
        const categories = [ 'tech', 'science', 'art' ];
        const category = categories[(i - 1) % 3];
        await apos.article.insert(req, {
          title: `Article ${padded}`,
          slug: `article-${padded}`,
          visibility: 'public',
          category
        });
      }
    });

    after(async function () {
      await t.destroy(apos);
      apos = null;
    });

    it('should return URL metadata for all documents', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const results = await apos.url.getAllUrlMetadata(req);
      assert(Array.isArray(results));
      assert(results.length > 0);

      const articlesPage = results.find(r => r.url === '/articles');
      assert(articlesPage, 'Should include the articles index page');
      assert.strictEqual(articlesPage.type, 'articlePage');
      assert(articlesPage.aposDocId);
      assert(articlesPage.i18nId);
    });

    it('should include individual article URLs', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const results = await apos.url.getAllUrlMetadata(req);
      const articleUrls = results.filter(r => r.type === 'article');

      assert.strictEqual(articleUrls.length, 12);
      assert(articleUrls.every(a => a.url.startsWith('/articles/article-')));
    });

    it('document entries should not have contentType', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const results = await apos.url.getAllUrlMetadata(req);
      const docEntries = results.filter(r => r.aposDocId);

      assert(docEntries.length > 0, 'Should have document entries');
      for (const entry of docEntries) {
        assert.strictEqual(
          entry.contentType,
          undefined,
          `Document entry ${entry.url} should not have contentType`
        );
        assert.notStrictEqual(
          entry.sitemap,
          false,
          `Document entry ${entry.url} should not set sitemap: false`
        );
      }
    });

    it('should include filter URLs in static mode', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const results = await apos.url.getAllUrlMetadata(req);

      // Should include filter URLs like /articles/category/tech
      const filterUrls = results.filter(
        r => r.url && r.url.match(/\/articles\/category\//)
      );
      assert(filterUrls.length > 0, 'Should include filter URLs');

      // Should have entries for each category with pieces
      const categories = [ 'tech', 'science', 'art' ];
      for (const cat of categories) {
        const catUrl = filterUrls.find(
          r => r.url === `/articles/category/${cat}`
        );
        assert(catUrl, `Should include URL for category: ${cat}`);
      }
    });

    it('should include pagination URLs in static mode', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const results = await apos.url.getAllUrlMetadata(req);

      // 12 articles with perPage=5 means 3 pages.
      // Page 1 is the base URL (/articles), so only /page/2 and /page/3
      // should appear as separate entries.
      const paginationUrls = results.filter(
        r => r.url && r.url.match(/\/articles\/page\/\d+$/)
      );
      assert.strictEqual(
        paginationUrls.length,
        2,
        'Should have exactly 2 pagination URLs'
      );
      assert(
        paginationUrls.some(r => r.url === '/articles/page/2'),
        'Should include page 2'
      );
      assert(
        paginationUrls.some(r => r.url === '/articles/page/3'),
        'Should include page 3'
      );
      assert(
        !paginationUrls.some(r => r.url === '/articles/page/1'),
        'Should not include page 1 (that is the base URL)'
      );
    });

    it('filter URLs should use path format in static mode', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const results = await apos.url.getAllUrlMetadata(req);
      const filterUrls = results.filter(
        r => r.url && r.url.match(/\/articles\/category\//)
      );
      // 3 categories with 4 articles each, perPage=5: 1 page per category,
      // so exactly 3 filter URLs (no paginated filter URLs)
      assert.strictEqual(filterUrls.length, 3, 'Should have exactly 3 filter URLs');
      for (const entry of filterUrls) {
        assert(!entry.url.includes('?'), `URL should not contain query string: ${entry.url}`);
      }
    });

    it('should have consistent i18nId values', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const results = await apos.url.getAllUrlMetadata(req);
      for (const entry of results) {
        assert(entry.i18nId, `Entry with url ${entry.url} should have i18nId`);
      }
      const ids = results.map(r => r.i18nId);
      const unique = new Set(ids);
      assert.strictEqual(
        unique.size,
        ids.length,
        'All i18nId values should be unique'
      );
    });

    it('should include home page URL', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const results = await apos.url.getAllUrlMetadata(req);
      const home = results.find(r => r.url === '/');
      assert(home, 'Should include the home page');
    });

    it('should respect excludeTypes option', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const results = await apos.url.getAllUrlMetadata(req, {
        excludeTypes: [ 'article' ]
      });
      const articles = results.filter(r => r.type === 'article');
      assert.strictEqual(articles.length, 0, 'Should not include excluded types');
    });
  });

  describe('getAllUrlMetadata with literal content entries', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/url': {
            options: { static: true }
          }
        }
      });
      // Simulate a styles stylesheet being present in the global doc
      // by setting it directly in the database
      await apos.doc.db.updateOne(
        {
          type: '@apostrophecms/global',
          aposLocale: 'en:published'
        },
        {
          $set: {
            stylesStylesheet: 'body { color: red; }',
            stylesStylesheetVersion: 'test-version'
          }
        }
      );
    });

    after(async function () {
      await t.destroy(apos);
      apos = null;
    });

    it('should include styles stylesheet as a literal content entry', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const results = await apos.url.getAllUrlMetadata(req);
      const stylesheet = results.find(
        r => r.i18nId === '@apostrophecms/styles:stylesheet'
      );
      assert(stylesheet, 'Should include styles stylesheet entry');
      assert.strictEqual(stylesheet.contentType, 'text/css');
      assert.strictEqual(stylesheet.sitemap, false, 'Literal content entries should have sitemap: false');
      assert(
        stylesheet.url.includes('/api/v1/@apostrophecms/styles/stylesheet'),
        'URL should point to the styles API route'
      );
      assert(
        stylesheet.url.includes('version=test-version'),
        'URL should include the stylesheet version for cache busting'
      );
    });

    it('literal content entries have contentType property', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const results = await apos.url.getAllUrlMetadata(req);
      const literals = results.filter(r => r.contentType);

      for (const entry of literals) {
        assert(typeof entry.contentType === 'string');
        assert(entry.url);
        assert(entry.i18nId);
        assert.strictEqual(entry.sitemap, false, 'Literal content entries should opt out of sitemaps');
        assert(!entry.changefreq, 'Literal content entries should not have changefreq');
        assert(!entry.priority, 'Literal content entries should not have priority');
      }
    });
  });

  describe('REST API endpoint', function () {
    let apos;
    const externalFrontKey = 'test-static-build-key';

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/url': {
            options: { static: true }
          },
          '@apostrophecms/express': {
            options: {
              externalFrontKey
            }
          },
          article: {
            extend: '@apostrophecms/piece-type',
            options: {
              name: 'article',
              label: 'Article',
              alias: 'article'
            }
          },
          'article-page': {
            extend: '@apostrophecms/piece-page-type',
            options: {
              name: 'articlePage',
              label: 'Articles',
              alias: 'articlePage',
              perPage: 10
            }
          },
          '@apostrophecms/page': {
            options: {
              park: [
                {
                  title: 'Articles',
                  type: 'articlePage',
                  slug: '/articles',
                  parkedId: 'articles'
                }
              ]
            }
          }
        }
      });

      const req = apos.task.getReq();
      await apos.article.insert(req, {
        title: 'Test Article',
        visibility: 'public'
      });
    });

    after(async function () {
      await t.destroy(apos);
      apos = null;
    });

    it('should return 403 without external front headers', async function () {
      await assert.rejects(
        apos.http.get('/api/v1/@apostrophecms/url', {}),
        { status: 403 }
      );
    });

    it('should return 403 with wrong external front key', async function () {
      await assert.rejects(
        apos.http.get('/api/v1/@apostrophecms/url', {
          headers: {
            'x-requested-with': 'AposExternalFront',
            'apos-external-front-key': 'wrong-key'
          }
        }),
        { status: 403 }
      );
    });

    it('should return URL metadata with valid external front key', async function () {
      const response = await apos.http.get('/api/v1/@apostrophecms/url', {
        headers: {
          'x-requested-with': 'AposExternalFront',
          'apos-external-front-key': externalFrontKey
        }
      });
      assert(response);
      assert(Array.isArray(response.results));
      assert(response.results.length > 0);
      // Should include at least the home page and articles page
      assert(
        response.results.some(r => r.url === '/'),
        'Should include home page'
      );
      assert(
        response.results.some(r => r.url === '/articles'),
        'Should include articles page'
      );
    });

    it('each result should have url and i18nId', async function () {
      const response = await apos.http.get('/api/v1/@apostrophecms/url', {
        headers: {
          'x-requested-with': 'AposExternalFront',
          'apos-external-front-key': externalFrontKey
        }
      });
      for (const entry of response.results) {
        assert(entry.url, `Entry should have url: ${JSON.stringify(entry)}`);
        assert(entry.i18nId, `Entry should have i18nId: ${JSON.stringify(entry)}`);
      }
    });
  });

  describe('REST API endpoint without static option', function () {
    let apos;
    const externalFrontKey = 'test-no-static-key';

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/express': {
            options: {
              externalFrontKey
            }
          }
        }
      });
    });

    after(async function () {
      await t.destroy(apos);
      apos = null;
    });

    it('should return 400 when static option is not enabled', async function () {
      await assert.rejects(
        () => apos.http.get('/api/v1/@apostrophecms/url', {
          headers: {
            'x-requested-with': 'AposExternalFront',
            'apos-external-front-key': externalFrontKey
          }
        }),
        (err) => {
          assert.strictEqual(err.status, 400);
          assert(
            err.body?.message?.includes('static: true'),
            'Error message should mention the static option'
          );
          return true;
        }
      );
    });
  });

  describe('Piece page dispatch routes in static mode', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/url': {
            options: { static: true }
          },
          article: {
            extend: '@apostrophecms/piece-type',
            options: {
              name: 'article',
              label: 'Article',
              alias: 'article',
              sort: { title: 1 }
            },
            fields: {
              add: {
                category: {
                  type: 'select',
                  label: 'Category',
                  choices: [
                    {
                      label: 'Tech',
                      value: 'tech'
                    },
                    {
                      label: 'Science',
                      value: 'science'
                    }
                  ]
                }
              }
            }
          },
          'article-page': {
            extend: '@apostrophecms/piece-page-type',
            options: {
              name: 'articlePage',
              label: 'Articles',
              alias: 'articlePage',
              perPage: 5,
              piecesFilters: [
                { name: 'category' }
              ]
            }
          },
          '@apostrophecms/page': {
            options: {
              park: [
                {
                  title: 'Articles',
                  type: 'articlePage',
                  slug: '/articles',
                  parkedId: 'articles'
                }
              ]
            }
          }
        }
      });

      const req = apos.task.getReq();
      for (let i = 1; i <= 12; i++) {
        const padded = String(i).padStart(3, '0');
        const category = i <= 6 ? 'tech' : 'science';
        await apos.article.insert(req, {
          title: `Article ${padded}`,
          slug: `article-${padded}`,
          visibility: 'public',
          category
        });
      }
    });

    after(async function () {
      await t.destroy(apos);
      apos = null;
    });

    it('should serve index page at /', async function () {
      const body = await apos.http.get('/articles');
      assert(body.includes('article-001'));
    });

    it('should serve paginated page via path in static mode', async function () {
      const body = await apos.http.get('/articles/page/2');
      // Page 2 with perPage=5 should show articles 6-10
      assert(body.includes('article-006'));
      assert(!body.includes('article-001'));
    });

    it('should serve filter page via path in static mode', async function () {
      const body = await apos.http.get('/articles/category/tech');
      // Should only show tech articles (1-6)
      assert(body.includes('article-001'));
    });

    it('should serve filter + pagination via path in static mode', async function () {
      const body = await apos.http.get('/articles/category/tech/page/2');
      // 6 tech articles with perPage=5 means page 2 has 1 article
      assert(body.includes('article-006'));
      assert(!body.includes('article-001'));
    });

    it('should still serve individual piece show pages', async function () {
      const body = await apos.http.get('/articles/article-001');
      assert(body.includes('Article 001'));
    });
  });

  describe('getAllUrlMetadata event', function () {
    let apos;
    let eventFired = false;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/url': {
            options: { static: true }
          },
          'custom-urls': {
            handlers(self) {
              return {
                '@apostrophecms/url:getAllUrlMetadata': {
                  addCustomUrl(req, results, { excludeTypes }) {
                    eventFired = true;
                    results.push({
                      url: '/custom-resource.txt',
                      contentType: 'text/plain',
                      i18nId: 'custom:resource',
                      sitemap: false
                    });
                  }
                }
              };
            }
          }
        }
      });
    });

    after(async function () {
      await t.destroy(apos);
      apos = null;
    });

    it('should emit getAllUrlMetadata event and include custom URLs', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const results = await apos.url.getAllUrlMetadata(req);

      assert(eventFired, 'Event should have been fired');

      const custom = results.find(r => r.i18nId === 'custom:resource');
      assert(custom, 'Should include custom URL from event handler');
      assert.strictEqual(custom.url, '/custom-resource.txt');
      assert.strictEqual(custom.contentType, 'text/plain');
      assert.strictEqual(custom.sitemap, false);
    });
  });

  describe('getFiltersWithChoices', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/url': {
            options: { static: true }
          },
          article: {
            extend: '@apostrophecms/piece-type',
            options: {
              name: 'article',
              label: 'Article',
              alias: 'article',
              sort: { title: 1 }
            },
            fields: {
              add: {
                category: {
                  type: 'select',
                  label: 'Category',
                  choices: [
                    {
                      label: 'Tech',
                      value: 'tech'
                    },
                    {
                      label: 'Science',
                      value: 'science'
                    }
                  ]
                }
              }
            }
          },
          'article-page': {
            extend: '@apostrophecms/piece-page-type',
            options: {
              name: 'articlePage',
              label: 'Articles',
              alias: 'articlePage',
              perPage: 10,
              piecesFilters: [
                { name: 'category' }
              ]
            }
          },
          '@apostrophecms/page': {
            options: {
              park: [
                {
                  title: 'Articles',
                  type: 'articlePage',
                  slug: '/articles',
                  parkedId: 'articles'
                }
              ]
            }
          }
        }
      });

      const req = apos.task.getReq();
      for (let i = 1; i <= 6; i++) {
        const category = i <= 3 ? 'tech' : 'science';
        await apos.article.insert(req, {
          title: `Article ${i}`,
          visibility: 'public',
          category
        });
      }
    });

    after(async function () {
      await t.destroy(apos);
      apos = null;
    });

    it('should return filter choices with counts when requested', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const query = apos.articlePage.indexQuery(req);
      const filters = await apos.articlePage.getFiltersWithChoices(query, {
        allCounts: true
      });

      assert(Array.isArray(filters));
      assert.strictEqual(filters.length, 1);
      assert.strictEqual(filters[0].name, 'category');
      assert(Array.isArray(filters[0].choices));

      // Should have choices for tech and science
      const techChoice = filters[0].choices.find(c => c.value === 'tech');
      const scienceChoice = filters[0].choices.find(c => c.value === 'science');
      assert(techChoice, 'Should have tech choice');
      assert(scienceChoice, 'Should have science choice');
      assert.strictEqual(techChoice.count, 3);
      assert.strictEqual(scienceChoice.count, 3);
    });

    it('choices should have _url with path format when page context exists', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });

      // Simulate a real page context by fetching the articles page
      const articlesPage = await apos.page.find(req, { slug: '/articles' }).toObject();
      req.data.page = articlesPage;
      const query = apos.articlePage.indexQuery(req);
      const filters = await apos.articlePage.getFiltersWithChoices(query, {
        allCounts: true
      });
      const techChoice = filters[0].choices.find(c => c.value === 'tech');
      const scienceChoice = filters[0].choices.find(c => c.value === 'science');

      // In static mode, _url should use path segments, not query strings
      assert.strictEqual(
        techChoice._url,
        '/articles/category/tech',
        'Tech choice _url should use path format'
      );
      assert.strictEqual(
        scienceChoice._url,
        '/articles/category/science',
        'Science choice _url should use path format'
      );
      assert(
        !techChoice._url.includes('?'),
        'Static mode _url should not contain query string'
      );
    });
  });
});
