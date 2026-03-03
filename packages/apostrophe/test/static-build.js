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
      const { pages: results } = await apos.url.getAllUrlMetadata(req);
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
      const { pages: results } = await apos.url.getAllUrlMetadata(req);
      const articleUrls = results.filter(r => r.type === 'article');

      assert.strictEqual(articleUrls.length, 12);
      assert(articleUrls.every(a => a.url.startsWith('/articles/article-')));
    });

    it('document entries should not have contentType', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const { pages: results } = await apos.url.getAllUrlMetadata(req);
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
      const { pages: results } = await apos.url.getAllUrlMetadata(req);

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
      const { pages: results } = await apos.url.getAllUrlMetadata(req);

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
      const { pages: results } = await apos.url.getAllUrlMetadata(req);
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
      const { pages: results } = await apos.url.getAllUrlMetadata(req);
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
      const { pages: results } = await apos.url.getAllUrlMetadata(req);
      const home = results.find(r => r.url === '/');
      assert(home, 'Should include the home page');
    });

    it('should respect excludeTypes option', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const { pages: results } = await apos.url.getAllUrlMetadata(req, {
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
      const { pages: results } = await apos.url.getAllUrlMetadata(req);
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
      const { pages: results } = await apos.url.getAllUrlMetadata(req);
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

  describe('getAllUrlMetadata with attachments', function () {
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
              alias: 'article'
            },
            fields: {
              add: {
                _image: {
                  type: 'relationship',
                  withType: '@apostrophecms/image',
                  label: 'Image',
                  max: 1
                },
                _file: {
                  type: 'relationship',
                  withType: '@apostrophecms/file',
                  label: 'File',
                  max: 1
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

      // Insert an article so we have a document with a known _id
      const article = await apos.article.insert(req, {
        title: 'Attachment Test Article',
        visibility: 'public'
      });

      // Update the article raw record to reference image and file
      // docs via idsStorage fields, as if a user had chosen media
      // through the CMS UI.
      await apos.doc.db.updateMany(
        { aposDocId: article.aposDocId },
        {
          $set: {
            imageIds: [ 'img-1' ],
            fileIds: [ 'file-1' ]
          }
        }
      );

      // Seed attachment records directly into the DB to avoid
      // needing real uploaded files.  Attachment `docIds` reference
      // the image/file doc IDs (not the article), matching how the
      // core attachment module stores references.
      const imgDocId = 'img-1:en:published';
      const fileDocId = 'file-1:en:published';

      await apos.attachment.db.insertMany([
        {
          _id: 'att-jpg-1',
          name: 'photo',
          extension: 'jpg',
          group: 'images',
          width: 800,
          height: 600,
          archived: false,
          docIds: [ imgDocId ],
          crops: [],
          used: true,
          utilized: true
        },
        {
          _id: 'att-pdf-1',
          name: 'document',
          extension: 'pdf',
          group: 'office',
          archived: false,
          docIds: [ fileDocId ],
          crops: [],
          used: true,
          utilized: true
        },
        {
          _id: 'att-orphan-1',
          name: 'orphan',
          extension: 'png',
          group: 'images',
          width: 100,
          height: 100,
          archived: false,
          docIds: [ 'img-orphan:en:published' ],
          crops: [],
          used: false,
          utilized: false
        },
        {
          _id: 'att-archived-1',
          name: 'archived-photo',
          extension: 'jpg',
          group: 'images',
          width: 200,
          height: 200,
          archived: true,
          docIds: [ imgDocId ],
          crops: [],
          used: true,
          utilized: true
        },
        {
          _id: 'att-cropped-1',
          name: 'cropped-photo',
          extension: 'jpg',
          group: 'images',
          width: 1000,
          height: 800,
          archived: false,
          docIds: [ imgDocId ],
          crops: [
            {
              top: 10,
              left: 20,
              width: 300,
              height: 400
            }
          ],
          used: true,
          utilized: true
        }
      ]);
    });

    after(async function () {
      await t.destroy(apos);
      apos = null;
    });

    it('should return attachments as null when not requested', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const result = await apos.url.getAllUrlMetadata(req);
      assert.strictEqual(result.attachments, null);
      assert(Array.isArray(result.pages));
    });

    it('should return attachment metadata when requested', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const result = await apos.url.getAllUrlMetadata(req, {
        attachments: { scope: 'used' }
      });
      assert(result.attachments);
      assert(typeof result.attachments.uploadsUrl === 'string');
      assert(Array.isArray(result.attachments.results));
      assert(result.attachments.results.length > 0);
    });

    it('used scope should only include attachments referenced by content docs', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const result = await apos.url.getAllUrlMetadata(req, {
        attachments: { scope: 'used' }
      });
      const ids = result.attachments.results.map(a => a._id);
      assert(ids.includes('att-jpg-1'), 'Should include attachment referenced via image relationship');
      assert(ids.includes('att-pdf-1'), 'Should include attachment referenced via file relationship');
      assert(!ids.includes('att-orphan-1'), 'Should not include attachment whose image doc is unreferenced by content');
    });

    it('all scope should include all attachments', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const result = await apos.url.getAllUrlMetadata(req, {
        attachments: { scope: 'all' }
      });
      const ids = result.attachments.results.map(a => a._id);
      assert(ids.includes('att-jpg-1'));
      assert(ids.includes('att-pdf-1'));
      assert(ids.includes('att-orphan-1'), 'all scope should include attachments not referenced by content docs');
    });

    it('sized attachment should have multiple size variants', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const result = await apos.url.getAllUrlMetadata(req, {
        attachments: { scope: 'used' }
      });
      const jpgAtt = result.attachments.results.find(a => a._id === 'att-jpg-1');
      assert(jpgAtt, 'Should find the jpg attachment');
      assert(jpgAtt.urls.length > 1, 'Sized attachment should have multiple URL entries');
      const sizeNames = jpgAtt.urls.map(u => u.size);
      assert(sizeNames.includes('full'), 'Should include full size');
      assert(sizeNames.includes('one-half'), 'Should include one-half size');
      assert(sizeNames.includes('original'), 'Should include original size');
      for (const entry of jpgAtt.urls) {
        assert(typeof entry.path === 'string');
        assert(entry.path.startsWith('/attachments/'));
      }
    });

    it('non-sized attachment should have only a path', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const result = await apos.url.getAllUrlMetadata(req, {
        attachments: { scope: 'used' }
      });
      const pdfAtt = result.attachments.results.find(a => a._id === 'att-pdf-1');
      assert(pdfAtt, 'Should find the pdf attachment');
      assert.strictEqual(pdfAtt.urls.length, 1, 'Non-sized attachment should have one entry');
      assert.strictEqual(
        pdfAtt.urls[0].size,
        undefined,
        'Non-sized attachment should not have a size property'
      );
      assert(pdfAtt.urls[0].path.includes('.pdf'));
    });

    it('skipSizes should exclude specified sizes', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const result = await apos.url.getAllUrlMetadata(req, {
        attachments: {
          scope: 'used',
          skipSizes: [ 'original', 'max' ]
        }
      });
      const jpgAtt = result.attachments.results.find(a => a._id === 'att-jpg-1');
      const sizeNames = jpgAtt.urls.map(u => u.size);
      assert(!sizeNames.includes('original'), 'original should be skipped');
      assert(!sizeNames.includes('max'), 'max should be skipped');
      assert(sizeNames.includes('full'), 'full should still be present');
    });

    it('sizes should include only specified sizes', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const result = await apos.url.getAllUrlMetadata(req, {
        attachments: {
          scope: 'used',
          sizes: [ 'full', 'one-half' ]
        }
      });
      const jpgAtt = result.attachments.results.find(a => a._id === 'att-jpg-1');
      const sizeNames = jpgAtt.urls.map(u => u.size);
      assert(sizeNames.includes('full'));
      assert(sizeNames.includes('one-half'));
      assert(!sizeNames.includes('original'), 'original should not be included when sizes is explicit');
      assert(!sizeNames.includes('max'), 'max should not be included when sizes is explicit');
    });

    it('uploadsUrl should match the uploadfs base URL', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const result = await apos.url.getAllUrlMetadata(req, {
        attachments: { scope: 'used' }
      });
      assert.strictEqual(
        result.attachments.uploadsUrl,
        apos.attachment.uploadfs.getUrl()
      );
    });

    it('should exclude archived attachments even if they have docIds', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const result = await apos.url.getAllUrlMetadata(req, {
        attachments: { scope: 'used' }
      });
      const ids = result.attachments.results.map(a => a._id);
      assert(!ids.includes('att-archived-1'), 'Archived attachments should be excluded');
      assert(ids.includes('att-jpg-1'), 'Non-archived attachments should be included');
    });

    it('should exclude archived attachments in all scope too', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const result = await apos.url.getAllUrlMetadata(req, {
        attachments: { scope: 'all' }
      });
      const ids = result.attachments.results.map(a => a._id);
      assert(!ids.includes('att-archived-1'), 'Archived attachments should be excluded in all scope');
    });

    it('crop variants should include all sizes by default', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const result = await apos.url.getAllUrlMetadata(req, {
        attachments: { scope: 'used' }
      });
      const att = result.attachments.results.find(a => a._id === 'att-cropped-1');
      assert(att, 'Should find the cropped attachment');
      // Should have all regular sizes + all crop sizes
      const cropUrls = att.urls.filter(u => u.path.includes('.20.'));
      assert(cropUrls.length > 0, 'Should have crop variant URLs');
      const cropSizes = cropUrls.map(u => u.size);
      assert(cropSizes.includes('full'), 'Crop should include full size');
      assert(cropSizes.includes('original'), 'Crop should include original size');
    });

    it('crop variants should respect skipSizes', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const result = await apos.url.getAllUrlMetadata(req, {
        attachments: {
          scope: 'used',
          skipSizes: [ 'original', 'max' ]
        }
      });
      const att = result.attachments.results.find(a => a._id === 'att-cropped-1');
      const cropUrls = att.urls.filter(u => u.path.includes('.20.'));
      const cropSizes = cropUrls.map(u => u.size);
      assert(!cropSizes.includes('original'), 'Crop should skip original when told to');
      assert(!cropSizes.includes('max'), 'Crop should skip max when told to');
      assert(cropSizes.includes('full'), 'Crop should still include full');
    });

    it('crop variants should respect sizes filter', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const result = await apos.url.getAllUrlMetadata(req, {
        attachments: {
          scope: 'used',
          sizes: [ 'full', 'one-half' ]
        }
      });
      const att = result.attachments.results.find(a => a._id === 'att-cropped-1');
      const cropUrls = att.urls.filter(u => u.path.includes('.20.'));
      const cropSizes = cropUrls.map(u => u.size);
      assert.strictEqual(cropSizes.length, 2, 'Crop should only have the 2 requested sizes');
      assert(cropSizes.includes('full'));
      assert(cropSizes.includes('one-half'));
      assert(!cropSizes.includes('original'));
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
            },
            fields: {
              add: {
                _image: {
                  type: 'relationship',
                  withType: '@apostrophecms/image',
                  label: 'Image',
                  max: 1
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
      const article = await apos.article.insert(req, {
        title: 'Test Article',
        visibility: 'public'
      });

      // Set up idsStorage so the article references an image doc
      await apos.doc.db.updateMany(
        { aposDocId: article.aposDocId },
        { $set: { imageIds: [ 'api-img-1' ] } }
      );
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
      assert(Array.isArray(response.pages));
      assert(response.pages.length > 0);
      // Should include at least the home page and articles page
      assert(
        response.pages.some(r => r.url === '/'),
        'Should include home page'
      );
      assert(
        response.pages.some(r => r.url === '/articles'),
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
      for (const entry of response.pages) {
        assert(entry.url, `Entry should have url: ${JSON.stringify(entry)}`);
        assert(entry.i18nId, `Entry should have i18nId: ${JSON.stringify(entry)}`);
      }
    });

    it('should return attachments as null without query param', async function () {
      const response = await apos.http.get('/api/v1/@apostrophecms/url', {
        headers: {
          'x-requested-with': 'AposExternalFront',
          'apos-external-front-key': externalFrontKey
        }
      });
      assert.strictEqual(response.attachments, null);
    });

    it('should return attachment metadata with attachments=1', async function () {
      // Seed an attachment referencing an image doc ID that
      // the article doc points to via imageIds idsStorage
      await apos.attachment.db.insertOne({
        _id: 'att-api-jpg',
        name: 'api-photo',
        extension: 'jpg',
        group: 'images',
        width: 400,
        height: 300,
        archived: false,
        docIds: [ 'api-img-1:en:published' ],
        crops: [],
        used: true,
        utilized: true
      });

      const response = await apos.http.get(
        '/api/v1/@apostrophecms/url?attachments=1',
        {
          headers: {
            'x-requested-with': 'AposExternalFront',
            'apos-external-front-key': externalFrontKey
          }
        }
      );
      assert(response.attachments);
      assert(typeof response.attachments.uploadsUrl === 'string');
      assert(Array.isArray(response.attachments.results));
      const att = response.attachments.results.find(a => a._id === 'att-api-jpg');
      assert(att, 'Should include the seeded attachment');
      assert(att.urls.length > 1, 'Sized image should have multiple URL entries');
    });

    it('should accept attachmentSkipSizes as comma-separated list', async function () {
      const response = await apos.http.get(
        '/api/v1/@apostrophecms/url?attachments=1&attachmentSkipSizes=original,max',
        {
          headers: {
            'x-requested-with': 'AposExternalFront',
            'apos-external-front-key': externalFrontKey
          }
        }
      );
      const att = response.attachments.results.find(a => a._id === 'att-api-jpg');
      const sizeNames = att.urls.map(u => u.size);
      assert(!sizeNames.includes('original'), 'original should be skipped');
      assert(!sizeNames.includes('max'), 'max should be skipped');
      assert(sizeNames.includes('full'), 'full should remain');
    });

    it('should accept attachmentSizes as comma-separated list', async function () {
      const response = await apos.http.get(
        '/api/v1/@apostrophecms/url?attachments=1&attachmentSizes=full,one-half',
        {
          headers: {
            'x-requested-with': 'AposExternalFront',
            'apos-external-front-key': externalFrontKey
          }
        }
      );
      const att = response.attachments.results.find(a => a._id === 'att-api-jpg');
      const sizeNames = att.urls.map(u => u.size);
      assert(sizeNames.includes('full'));
      assert(sizeNames.includes('one-half'));
      assert(!sizeNames.includes('original'));
      assert(!sizeNames.includes('max'));
    });

    it('should accept attachmentScope=all', async function () {
      // Insert an attachment not referenced by any content doc
      await apos.attachment.db.insertOne({
        _id: 'att-api-orphan',
        name: 'api-orphan',
        extension: 'png',
        group: 'images',
        width: 50,
        height: 50,
        archived: false,
        docIds: [ 'unreferenced-img:en:published' ],
        crops: [],
        used: false,
        utilized: false
      });

      const response = await apos.http.get(
        '/api/v1/@apostrophecms/url?attachments=1&attachmentScope=all',
        {
          headers: {
            'x-requested-with': 'AposExternalFront',
            'apos-external-front-key': externalFrontKey
          }
        }
      );
      const ids = response.attachments.results.map(a => a._id);
      assert(ids.includes('att-api-orphan'), 'all scope should include attachments not in URL results');
    });

    it('should default scope to used and exclude orphaned attachments', async function () {
      const response = await apos.http.get(
        '/api/v1/@apostrophecms/url?attachments=1',
        {
          headers: {
            'x-requested-with': 'AposExternalFront',
            'apos-external-front-key': externalFrontKey
          }
        }
      );
      const ids = response.attachments.results.map(a => a._id);
      assert(!ids.includes('att-api-orphan'), 'used scope should not include attachments not in URL results');
    });

    it('should ignore invalid attachmentScope values', async function () {
      const response = await apos.http.get(
        '/api/v1/@apostrophecms/url?attachments=1&attachmentScope=evil',
        {
          headers: {
            'x-requested-with': 'AposExternalFront',
            'apos-external-front-key': externalFrontKey
          }
        }
      );
      // Invalid scope falls back to 'used' via launder.select
      const ids = response.attachments.results.map(a => a._id);
      assert(!ids.includes('att-api-orphan'), 'invalid scope should fall back to used');
    });

    it('should ignore non-boolean attachments values', async function () {
      const response = await apos.http.get(
        '/api/v1/@apostrophecms/url?attachments=evil',
        {
          headers: {
            'x-requested-with': 'AposExternalFront',
            'apos-external-front-key': externalFrontKey
          }
        }
      );
      assert.strictEqual(response.attachments, null, 'Non-boolean value should result in null attachments');
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
      const { pages: results } = await apos.url.getAllUrlMetadata(req);

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

  describe('getFiltersWithChoices for relationship fields', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/url': {
            options: { static: true }
          },
          category: {
            extend: '@apostrophecms/piece-type',
            options: {
              name: 'category',
              label: 'Category',
              alias: 'category'
            }
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
                _categories: {
                  type: 'relationship',
                  withType: 'category',
                  label: 'Categories'
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
                { name: 'categories' }
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
      const tech = await apos.category.insert(req, {
        title: 'Tech',
        visibility: 'public'
      });
      const science = await apos.category.insert(req, {
        title: 'Science',
        visibility: 'public'
      });

      for (let i = 1; i <= 6; i++) {
        const cats = i <= 3 ? [ tech ] : [ science ];
        await apos.article.insert(req, {
          title: `Article ${i}`,
          visibility: 'public',
          _categories: cats
        });
      }
    });

    after(async function () {
      await t.destroy(apos);
      apos = null;
    });

    it('should return relationship filter choices with counts', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const query = apos.articlePage.indexQuery(req);
      const filters = await apos.articlePage.getFiltersWithChoices(query, {
        allCounts: true
      });

      assert(Array.isArray(filters));
      assert.strictEqual(filters.length, 1);
      assert.strictEqual(filters[0].name, 'categories');

      const techChoice = filters[0].choices.find(c => c.value === 'tech');
      const scienceChoice = filters[0].choices.find(c => c.value === 'science');
      assert(techChoice, 'Should have tech choice');
      assert(scienceChoice, 'Should have science choice');
      assert.strictEqual(techChoice.count, 3, 'Tech should have count 3');
      assert.strictEqual(scienceChoice.count, 3, 'Science should have count 3');
    });

    it('should enumerate relationship filter URLs in getUrlMetadata', async function () {
      const req = apos.task.getAnonReq({ mode: 'published' });
      const { pages: results } = await apos.url.getAllUrlMetadata(req);

      const filterUrls = results.filter(r =>
        r.url && r.url.startsWith('/articles/categories/')
      );
      assert(filterUrls.length >= 2, `Should have at least 2 filter URLs, got ${filterUrls.length}`);
      assert(
        filterUrls.some(r => r.url === '/articles/categories/tech'),
        'Should enumerate /articles/categories/tech'
      );
      assert(
        filterUrls.some(r => r.url === '/articles/categories/science'),
        'Should enumerate /articles/categories/science'
      );
    });
  });

  describe('URL support', function () {

    describe('baseUrl configured, no staticBaseUrl', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
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

      it('apos.baseUrl is set correctly', function () {
        assert.strictEqual(apos.baseUrl, 'http://localhost:3000');
      });

      it('apos.staticBaseUrl is undefined when not configured', function () {
        assert.strictEqual(apos.staticBaseUrl, undefined);
      });

      it('getBaseUrl returns empty string when req.aposStaticBuild is true and no staticBaseUrl', function () {
        const req = apos.task.getAnonReq({
          mode: 'published',
          aposStaticBuild: true
        });
        const baseUrl = apos.page.getBaseUrl(req);
        assert.strictEqual(baseUrl, '');
      });

      it('getBaseUrl returns apos.baseUrl when req.aposStaticBuild is not set', function () {
        const req = apos.task.getAnonReq({ mode: 'published' });
        const baseUrl = apos.page.getBaseUrl(req);
        assert.strictEqual(baseUrl, 'http://localhost:3000');
      });

      it('getAllUrlMetadata strips baseUrl from page URLs for static build requests', async function () {
        const req = apos.task.getAnonReq({
          mode: 'published',
          aposStaticBuild: true
        });
        const { pages } = await apos.url.getAllUrlMetadata(req);
        assert(pages.length > 0);
        for (const entry of pages) {
          assert(
            !entry.url.startsWith('http://'),
            `URL should be path-only, got: ${entry.url}`
          );
        }
        const home = pages.find(r => r.url === '/');
        assert(home, 'Should include the home page with path-only URL');
      });

      it('getAllUrlMetadata strips baseUrl from uploadsUrl for static build requests', async function () {
        const req = apos.task.getAnonReq({
          mode: 'published',
          aposStaticBuild: true
        });
        const { attachments } = await apos.url.getAllUrlMetadata(req, {
          attachments: { scope: 'all' }
        });
        assert(attachments);
        assert(
          !attachments.uploadsUrl.startsWith('http://'),
          `uploadsUrl should be path-only, got: ${attachments.uploadsUrl}`
        );
        assert.strictEqual(attachments.uploadsUrl, '/uploads');
      });

      it('apos.baseUrl is NOT modified after static build requests', async function () {
        const req = apos.task.getAnonReq({
          mode: 'published',
          aposStaticBuild: true
        });
        await apos.url.getAllUrlMetadata(req);
        assert.strictEqual(apos.baseUrl, 'http://localhost:3000');
      });
    });

    describe('baseUrl + staticBaseUrl configured', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
          staticBaseUrl: 'https://www.example.com',
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

      it('apos.staticBaseUrl is set correctly', function () {
        assert.strictEqual(apos.staticBaseUrl, 'https://www.example.com');
      });

      it('getBaseUrl returns staticBaseUrl when req.aposStaticBuild is true', function () {
        const req = apos.task.getAnonReq({
          mode: 'published',
          aposStaticBuild: true
        });
        const baseUrl = apos.page.getBaseUrl(req);
        assert.strictEqual(baseUrl, 'https://www.example.com');
      });

      it('getBaseUrl returns apos.baseUrl when req.aposStaticBuild is not set', function () {
        const req = apos.task.getAnonReq({ mode: 'published' });
        const baseUrl = apos.page.getBaseUrl(req);
        assert.strictEqual(baseUrl, 'http://localhost:3000');
      });

      it('getAllUrlMetadata strips staticBaseUrl from page URLs for static build requests', async function () {
        const req = apos.task.getAnonReq({
          mode: 'published',
          aposStaticBuild: true
        });
        const { pages } = await apos.url.getAllUrlMetadata(req);
        assert(pages.length > 0);
        for (const entry of pages) {
          assert(
            !entry.url.startsWith('https://'),
            `URL should be path-only, got: ${entry.url}`
          );
        }
        const home = pages.find(r => r.url === '/');
        assert(home, 'Should include the home page with path-only URL');
      });

      it('getAllUrlMetadata strips original baseUrl from uploadsUrl', async function () {
        const req = apos.task.getAnonReq({
          mode: 'published',
          aposStaticBuild: true
        });
        const { attachments } = await apos.url.getAllUrlMetadata(req, {
          attachments: { scope: 'all' }
        });
        assert(attachments);
        assert.strictEqual(
          attachments.uploadsUrl,
          '/uploads',
          'uploadsUrl should strip the original baseUrl, not staticBaseUrl'
        );
      });

      it('req.absoluteUrl uses staticBaseUrl during static builds', function () {
        const req = apos.task.getAnonReq({
          mode: 'published',
          aposStaticBuild: true,
          url: '/some-page'
        });
        assert(
          req.absoluteUrl.startsWith('https://www.example.com'),
          `req.absoluteUrl should use staticBaseUrl, got: ${req.absoluteUrl}`
        );
      });

      it('apos.baseUrl is NOT modified after static build requests', async function () {
        const req = apos.task.getAnonReq({
          mode: 'published',
          aposStaticBuild: true
        });
        await apos.url.getAllUrlMetadata(req);
        assert.strictEqual(apos.baseUrl, 'http://localhost:3000');
      });
    });

    describe('staticBaseUrl only (no baseUrl)', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          staticBaseUrl: 'https://www.example.com',
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

      it('apos.baseUrl is undefined', function () {
        assert.strictEqual(apos.baseUrl, undefined);
      });

      it('apos.staticBaseUrl is set', function () {
        assert.strictEqual(apos.staticBaseUrl, 'https://www.example.com');
      });

      it('getBaseUrl returns staticBaseUrl when req.aposStaticBuild is true', function () {
        const req = apos.task.getAnonReq({
          mode: 'published',
          aposStaticBuild: true
        });
        const baseUrl = apos.page.getBaseUrl(req);
        assert.strictEqual(baseUrl, 'https://www.example.com');
      });

      it('getBaseUrl returns empty string without static build flag', function () {
        const req = apos.task.getAnonReq({ mode: 'published' });
        const baseUrl = apos.page.getBaseUrl(req);
        assert.strictEqual(baseUrl, '');
      });

      it('getAllUrlMetadata strips staticBaseUrl from page URLs', async function () {
        const req = apos.task.getAnonReq({
          mode: 'published',
          aposStaticBuild: true
        });
        const { pages } = await apos.url.getAllUrlMetadata(req);
        assert(pages.length > 0);
        for (const entry of pages) {
          assert(
            !entry.url.startsWith('https://'),
            `URL should be path-only, got: ${entry.url}`
          );
        }
      });

      it('uploadsUrl is path-only (no baseUrl to strip)', async function () {
        const req = apos.task.getAnonReq({
          mode: 'published',
          aposStaticBuild: true
        });
        const { attachments } = await apos.url.getAllUrlMetadata(req, {
          attachments: { scope: 'all' }
        });
        assert(attachments);
        assert.strictEqual(attachments.uploadsUrl, '/uploads');
      });
    });

    describe('baseUrl + prefix', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
          prefix: '/cms',
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

      it('getAllUrlMetadata strips baseUrl but preserves prefix in page URLs', async function () {
        const req = apos.task.getAnonReq({
          mode: 'published',
          aposStaticBuild: true
        });
        const { pages } = await apos.url.getAllUrlMetadata(req);
        assert(pages.length > 0);
        for (const entry of pages) {
          assert(
            !entry.url.startsWith('http://'),
            `URL should not start with http://, got: ${entry.url}`
          );
          assert(
            entry.url.startsWith('/cms') || entry.url.startsWith('/api'),
            `URL should start with /cms prefix, got: ${entry.url}`
          );
        }
      });

      it('getAllUrlMetadata strips baseUrl from uploadsUrl, preserving prefix', async function () {
        const req = apos.task.getAnonReq({
          mode: 'published',
          aposStaticBuild: true
        });
        const { attachments } = await apos.url.getAllUrlMetadata(req, {
          attachments: { scope: 'all' }
        });
        assert(attachments);
        assert.strictEqual(
          attachments.uploadsUrl,
          '/cms/uploads',
          'uploadsUrl should be path-only with prefix preserved'
        );
      });
    });

    describe('no static header (normal external front)', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
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

      it('getAllUrlMetadata returns path-only page URLs even without static build flag', async function () {
        const req = apos.task.getAnonReq({ mode: 'published' });
        const { pages } = await apos.url.getAllUrlMetadata(req);
        assert(pages.length > 0);
        const home = pages.find(r => r.url === '/');
        assert(home, 'Should return path-only URLs regardless of static build flag');
        for (const entry of pages) {
          assert(
            !entry.url.startsWith('http://'),
            `URL should be path-only, got: ${entry.url}`
          );
        }
      });

      it('getAllUrlMetadata returns path-only uploadsUrl even without static build flag', async function () {
        const req = apos.task.getAnonReq({ mode: 'published' });
        const { attachments } = await apos.url.getAllUrlMetadata(req, {
          attachments: { scope: 'all' }
        });
        assert(attachments);
        assert.strictEqual(
          attachments.uploadsUrl,
          '/uploads',
          'uploadsUrl should be path-only regardless of static build flag'
        );
      });
    });

    describe('APOS_STATIC_BASE_URL environment variable', function () {
      let apos;
      let savedEnvVar;

      before(async function () {
        savedEnvVar = process.env.APOS_STATIC_BASE_URL;
        process.env.APOS_STATIC_BASE_URL = 'https://env.example.com';
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
          staticBaseUrl: 'https://option.example.com',
          modules: {
            '@apostrophecms/url': {
              options: { static: true }
            }
          }
        });
      });

      after(async function () {
        if (savedEnvVar) {
          process.env.APOS_STATIC_BASE_URL = savedEnvVar;
        } else {
          delete process.env.APOS_STATIC_BASE_URL;
        }
        await t.destroy(apos);
        apos = null;
      });

      it('env variable overrides the staticBaseUrl option', function () {
        assert.strictEqual(apos.staticBaseUrl, 'https://env.example.com');
      });

      it('getBaseUrl uses env-based staticBaseUrl for static builds', function () {
        const req = apos.task.getAnonReq({
          mode: 'published',
          aposStaticBuild: true
        });
        const baseUrl = apos.page.getBaseUrl(req);
        assert.strictEqual(baseUrl, 'https://env.example.com');
      });
    });

    describe('express middleware sets req.aposStaticBuild', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
          staticBaseUrl: 'https://www.example.com',
          modules: {
            '@apostrophecms/express': {
              options: {
                externalFrontKey: 'test-key'
              }
            },
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

      it('sets req.aposStaticBuild and req.staticBaseUrl when header is present', async function () {
        const jar = apos.http.jar();
        // Use the URL API endpoint which requires externalFront
        const response = await apos.http.get('/api/v1/@apostrophecms/url', {
          jar,
          headers: {
            'x-requested-with': 'AposExternalFront',
            'apos-external-front-key': 'test-key',
            'x-apos-static-base-url': '1'
          }
        });
        assert(response);
        assert(response.pages);
        // Page URLs should be path-only (stripped)
        for (const entry of response.pages) {
          assert(
            !entry.url.startsWith('http://') && !entry.url.startsWith('https://'),
            `URL should be path-only via HTTP, got: ${entry.url}`
          );
        }
      });

      it('returns path-only URLs even without the static header', async function () {
        const jar = apos.http.jar();
        const response = await apos.http.get('/api/v1/@apostrophecms/url', {
          jar,
          headers: {
            'x-requested-with': 'AposExternalFront',
            'apos-external-front-key': 'test-key'
          }
        });
        assert(response);
        assert(response.pages);
        const home = response.pages.find(r => r.url === '/');
        assert(home, 'URLs should be path-only regardless of static header');
      });
    });

    describe('CDN uploadsUrl (cloud provider)', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
          modules: {
            '@apostrophecms/url': {
              options: { static: true }
            },
            '@apostrophecms/uploadfs': {
              options: {
                uploadfs: {
                  uploadsUrl: 'https://cdn.example.com/uploads'
                }
              }
            }
          }
        });
      });

      after(async function () {
        await t.destroy(apos);
        apos = null;
      });

      it('does not strip CDN uploadsUrl that differs from baseUrl', async function () {
        const req = apos.task.getAnonReq({ mode: 'published' });
        const { attachments } = await apos.url.getAllUrlMetadata(req, {
          attachments: { scope: 'all' }
        });
        assert(attachments);
        assert.strictEqual(
          attachments.uploadsUrl,
          'https://cdn.example.com/uploads',
          'CDN uploadsUrl should be left unchanged'
        );
      });

      it('still strips baseUrl from page URLs', async function () {
        const req = apos.task.getAnonReq({ mode: 'published' });
        const { pages } = await apos.url.getAllUrlMetadata(req);
        assert(pages.length > 0);
        for (const entry of pages) {
          assert(
            !entry.url.startsWith('http://localhost:3000'),
            `URL should be path-only, got: ${entry.url}`
          );
        }
      });
    });
  });

  describe('uploadfs relative URLs', function () {

    describe('default (no staticBaseUrl, no relativeUrls)', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
          modules: {}
        });
      });

      after(async function () {
        await t.destroy(apos);
        apos = null;
      });

      it('uploadsUrl includes baseUrl (BC)', function () {
        assert.strictEqual(
          apos.uploadfs.getUrl(),
          'http://localhost:3000/uploads'
        );
      });
    });

    describe('with staticBaseUrl configured', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
          staticBaseUrl: 'https://www.example.com',
          modules: {}
        });
      });

      after(async function () {
        await t.destroy(apos);
        apos = null;
      });

      it('uploadsUrl is path-only (no host)', function () {
        assert.strictEqual(apos.uploadfs.getUrl(), '/uploads');
      });
    });

    describe('with staticBaseUrl as empty string', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
          staticBaseUrl: '',
          modules: {}
        });
      });

      after(async function () {
        await t.destroy(apos);
        apos = null;
      });

      it('uploadsUrl includes baseUrl (empty string is falsy, BC preserved)', function () {
        assert.strictEqual(
          apos.uploadfs.getUrl(),
          'http://localhost:3000/uploads'
        );
      });
    });

    describe('with relativeUrls option (no staticBaseUrl)', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
          modules: {
            '@apostrophecms/uploadfs': {
              options: {
                relativeUrls: true
              }
            }
          }
        });
      });

      after(async function () {
        await t.destroy(apos);
        apos = null;
      });

      it('uploadsUrl is path-only', function () {
        assert.strictEqual(apos.uploadfs.getUrl(), '/uploads');
      });
    });

    describe('with both staticBaseUrl and relativeUrls', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
          staticBaseUrl: 'https://www.example.com',
          modules: {
            '@apostrophecms/uploadfs': {
              options: {
                relativeUrls: true
              }
            }
          }
        });
      });

      after(async function () {
        await t.destroy(apos);
        apos = null;
      });

      it('uploadsUrl is path-only', function () {
        assert.strictEqual(apos.uploadfs.getUrl(), '/uploads');
      });
    });

    describe('with prefix and staticBaseUrl', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
          staticBaseUrl: 'https://www.example.com',
          prefix: '/cms',
          modules: {}
        });
      });

      after(async function () {
        await t.destroy(apos);
        apos = null;
      });

      it('uploadsUrl preserves prefix but omits host', function () {
        assert.strictEqual(apos.uploadfs.getUrl(), '/cms/uploads');
      });
    });

    describe('with prefix and relativeUrls (no staticBaseUrl)', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
          prefix: '/cms',
          modules: {
            '@apostrophecms/uploadfs': {
              options: {
                relativeUrls: true
              }
            }
          }
        });
      });

      after(async function () {
        await t.destroy(apos);
        apos = null;
      });

      it('uploadsUrl preserves prefix but omits host', function () {
        assert.strictEqual(apos.uploadfs.getUrl(), '/cms/uploads');
      });
    });

    describe('cloud storage overrides uploadsUrl', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
          staticBaseUrl: 'https://www.example.com',
          modules: {
            '@apostrophecms/uploadfs': {
              options: {
                uploadfs: {
                  uploadsUrl: 'https://cdn.example.com/uploads'
                }
              }
            }
          }
        });
      });

      after(async function () {
        await t.destroy(apos);
        apos = null;
      });

      it('explicit uploadsUrl from cloud config takes precedence', function () {
        assert.strictEqual(
          apos.uploadfs.getUrl(),
          'https://cdn.example.com/uploads'
        );
      });
    });
  });

  describe('staticBuildHeader middleware', function () {

    describe('with staticBaseUrl configured', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
          staticBaseUrl: 'https://www.example.com',
          modules: {
            '@apostrophecms/express': {
              options: {
                externalFrontKey: 'test-key'
              }
            },
            '@apostrophecms/url': {
              options: { static: true }
            },
            article: {
              extend: '@apostrophecms/piece-type',
              options: {
                name: 'article',
                label: 'Article',
                alias: 'article',
                publicApiProjection: {
                  title: 1,
                  _url: 1
                }
              }
            },
            'article-page': {
              extend: '@apostrophecms/piece-page-type',
              options: {
                name: 'articlePage',
                label: 'Articles',
                alias: 'articlePage'
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
          title: 'Middleware Test Article',
          visibility: 'public'
        });
      });

      after(async function () {
        await t.destroy(apos);
        apos = null;
      });

      it('sets req.aposStaticBuild via direct API call with header', async function () {
        const jar = apos.http.jar();
        const response = await apos.http.get('/api/v1/article', {
          jar,
          headers: {
            'x-apos-static-base-url': '1'
          }
        });
        assert(response);
        assert(response.results);
        assert(response.results.length > 0);
        // With aposStaticBuild and staticBaseUrl configured, piece _url
        // should use staticBaseUrl (not baseUrl)
        for (const piece of response.results) {
          assert(
            piece._url.startsWith('https://www.example.com'),
            `_url should use staticBaseUrl, got: ${piece._url}`
          );
          assert(
            !piece._url.startsWith('http://localhost:3000'),
            `_url should NOT use baseUrl, got: ${piece._url}`
          );
        }
      });

      it('does not set aposStaticBuild without the header', async function () {
        const jar = apos.http.jar();
        const response = await apos.http.get('/api/v1/article', {
          jar
        });
        assert(response);
        assert(response.results);
        assert(response.results.length > 0);
        // Without the header, piece _url should include baseUrl
        for (const piece of response.results) {
          assert(
            piece._url.startsWith('http://localhost:3000'),
            `_url should include baseUrl without the header, got: ${piece._url}`
          );
        }
      });

      it('externalFront still works when both headers are sent', async function () {
        const jar = apos.http.jar();
        const response = await apos.http.get('/api/v1/@apostrophecms/url', {
          jar,
          headers: {
            'x-requested-with': 'AposExternalFront',
            'apos-external-front-key': 'test-key',
            'x-apos-static-base-url': '1'
          }
        });
        assert(response);
        assert(response.pages);
        for (const entry of response.pages) {
          assert(
            !entry.url.startsWith('http://'),
            `URL should be path-only via externalFront, got: ${entry.url}`
          );
        }
      });
    });

    describe('without staticBaseUrl (header still sets aposStaticBuild)', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
          modules: {
            article: {
              extend: '@apostrophecms/piece-type',
              options: {
                name: 'article',
                label: 'Article',
                alias: 'article',
                publicApiProjection: {
                  title: 1,
                  _url: 1
                }
              }
            },
            'article-page': {
              extend: '@apostrophecms/piece-page-type',
              options: {
                name: 'articlePage',
                label: 'Articles',
                alias: 'articlePage'
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
          title: 'No StaticBaseUrl Article',
          visibility: 'public'
        });
      });

      after(async function () {
        await t.destroy(apos);
        apos = null;
      });

      it('sets aposStaticBuild even without staticBaseUrl (matches externalFront behavior)', async function () {
        const jar = apos.http.jar();
        const response = await apos.http.get('/api/v1/article', {
          jar,
          headers: {
            'x-apos-static-base-url': '1'
          }
        });
        assert(response);
        assert(response.results);
        assert(response.results.length > 0);
        // With aposStaticBuild=true and no staticBaseUrl, getBaseUrl returns ''
        // so _url should be path-only
        for (const piece of response.results) {
          assert(
            !piece._url.startsWith('http://'),
            `_url should be path-only when aposStaticBuild is true, got: ${piece._url}`
          );
        }
      });
    });

    describe('non-API routes ignore the header', function () {
      let apos;

      before(async function () {
        apos = await t.create({
          root: module,
          baseUrl: 'http://localhost:3000',
          staticBaseUrl: 'https://www.example.com',
          modules: {}
        });
      });

      after(async function () {
        await t.destroy(apos);
        apos = null;
      });

      it('non-API request with the header does not cause errors', async function () {
        const jar = apos.http.jar();
        // Request the home page (non-API route) with the static header
        // — should be ignored and not cause issues
        const response = await apos.http.get('/', {
          jar,
          headers: {
            'x-apos-static-base-url': '1'
          },
          fullResponse: true
        });
        assert.strictEqual(response.status, 200);
      });
    });
  });
});
