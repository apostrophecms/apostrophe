const t = require('../test-lib/test.js');
const assert = require('assert');

describe('change-doc-ids', function() {

  let apos;
  const articles = [];
  const categories = [];

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  it('should initialize the apos object', async function() {
    apos = await t.create({
      root: module,
      modules: {
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'article'
          },
          fields: {
            add: {
              _categories: {
                type: 'relationship',
                withType: 'category'
              }
            }
          }
        },
        category: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'category'
          }
        },
        'default-page': {},
        '@apostrophecms/page': {
          options: {
            park: [
              {
                slug: '/test',
                type: 'default-page',
                title: 'Test',
                parkedId: 'test',
                visibility: 'public',
                _children: [
                  {
                    slug: '/test/child',
                    type: 'default-page',
                    title: 'Test Child',
                    parkedId: 'test-child',
                    visibility: 'public'
                  }
                ]
              }
            ]
          }
        }
      }
    });
  });

  it('should insert categories', async function() {
    for (let i = 0; (i < 10); i++) {
      const category = apos.category.newInstance();
      categories.push(await apos.category.insert(apos.task.getReq(), {
        ...category,
        title: 'Category ' + i,
        slug: 'category-' + i
      }));
    }
  });

  it('should insert articles with relationships to categories', async function() {
    for (let i = 0; (i < 10); i++) {
      const article = apos.article.newInstance();
      articles.push(await apos.article.insert(apos.task.getReq(), {
        ...article,
        title: 'Article ' + i,
        slug: 'article-' + i,
        _categories: [ categories[i % 4], categories[(i + 1) % 4] ]
      }));
    }
  });

  it('changeDocIds should work across a mix of pages and pieces', async function() {

    await sanityCheck();

    const pages = await apos.page.find(apos.task.getReq(), {}).toArray();
    const test = pages.find(page => page.slug === '/test');
    const newPageId = `new-test-page-id:${test.aposLocale}`;
    const newCategoryId = `new-test-category-id:${categories[0].aposLocale}`;
    const pairs = [
      [ test._id, newPageId ],
      [ categories[0]._id, newCategoryId ]
    ];
    await apos.doc.changeDocIds(pairs);

    await sanityCheck(newPageId, newCategoryId);
  });

  it('changeDocIds should skipReplace', async function() {

    await sanityCheck();
    const req = apos.task.getReq();
    const pages = await apos.page.find(req, {}).toArray();
    const categories = await apos.category.find(req, {}).toArray();
    const category = categories.find(category => category._id.startsWith('new-test-category-id'));
    const articles = await await apos.article.find(req, {}).toArray();
    const test = pages.find(page => page.slug === '/test');
    const existingPageId = `new-test-page-id:${test.aposLocale}`;
    const oldPageId = `old-test-page-id:${test.aposLocale}`;
    const existingCategoryId = `new-test-category-id:${category.aposLocale}`;
    const oldCategoryId = `old-test-category-id:${category.aposLocale}`;

    // Update articles to include the OLD category
    for (const article of articles) {
      if (article.categoriesIds.includes('new-test-category-id')) {
        const newIds = article.categoriesIds
          .filter(id => id !== 'new-test-category-id')
          .concat('old-test-category-id');
        await apos.doc.db.updateMany({
          aposDocId: article.aposDocId
        }, {
          $set: {
            categoriesIds: newIds
          }
        });
      }
    }
    // Sanity check - existingCategoryId should not be present in articles
    const articlesBefore = await apos.article.find(req, {}).toArray();
    assert.strictEqual(
      articlesBefore.every(article => !article.categoriesIds.includes('new-test-category-id')),
      true,
      'new-test-category-id should not be present in any articles'
    );
    assert.strictEqual(test._id, existingPageId);
    assert.strictEqual(category._id, existingCategoryId);
    const pairs = [
      [ oldPageId, existingPageId ],
      [ oldCategoryId, existingCategoryId ]
    ];

    await apos.doc.changeDocIds(pairs, { skipReplace: true });

    const articlesAfter = await apos.article.find(req, {}).toArray();
    assert.strictEqual(
      articlesAfter.every(article => !article.categoriesIds.includes('old-test-category-id')),
      true,
      'old-test-category-id should not be present in any articles'
    );

    await sanityCheck(existingPageId, existingCategoryId);
  });

  async function sanityCheck(newPageId, newCategoryId) {
    const pages = await apos.page.find(apos.task.getReq(), {}).children(true).toArray();
    const test = pages.find(page => page.slug === '/test');
    assert(test);
    assert(test._children[0]);
    assert(!test._children[1]);
    assert.strictEqual(test._children[0].slug, '/test/child');
    if (newPageId) {
      assert.strictEqual(test._id, newPageId);
      const newPageDocId = newPageId.replace(/:.+$/, '');
      assert.strictEqual(test.aposDocId, newPageDocId);
      assert(test.path.includes(newPageDocId));
      assert(test._children[0].path.includes(newPageDocId));
    }
    const articles = await apos.article.find(apos.task.getReq(), {}).sort({ slug: 1 }).toArray();
    assert.strictEqual(articles[0].title, 'Article 0');
    assert(articles[0]._categories);
    assert.strictEqual(articles[0]._categories.length, 2);
    assert(articles[0]._categories.find(category => category.slug === 'category-0'));
    assert(articles[0]._categories.find(category => category.slug === 'category-1'));
    if (newCategoryId) {
      assert.strictEqual(
        articles[0]._categories.some(obj => obj._id === newCategoryId),
        true,
        'newCategoryId not found'
      );
      const newCategory = articles[0]._categories.find(category => category._id === newCategoryId);
      assert(newCategory);
      assert.strictEqual(newCategory._id, newCategoryId);
      assert.strictEqual(newCategory.aposDocId, newCategoryId.replace(/:.+$/, ''));
    }
  }

});
