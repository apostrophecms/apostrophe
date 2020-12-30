const t = require('../test-lib/test.js');
const assert = require('assert');
const cuid = require('cuid');

describe('Utils', function() {

  this.timeout(t.timeout);

  let apos;

  after(() => {
    return t.destroy(apos);
  });

  it('should exist on the apos.util object', async () => {
    apos = await t.create({
      root: module,
      modules: {
        product: {
          options: {
            alias: 'product'
          },
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              _articles: {
                type: 'relationshipReverse',
                withType: 'article'
              }
            }
          }
        },
        article: {
          options: {
            alias: 'article'
          },
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              _products: {
                type: 'relationship',
                withType: 'product'
              },
              main: {
                type: 'area',
                widgets: {
                  article: {}
                }
              }
            }
          }
        },
        'article-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            label: 'Article'
          },
          fields: {
            add: {
              _articles: {
                type: 'relationship',
                withType: 'article'
              }
            }
          }
        },
        'scary-article-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            label: 'Scary Article',
            neverLoadSelf: false
          },
          fields: {
            add: {
              _articles: {
                type: 'relationship',
                withType: 'article'
              }
            }
          }
        },
        'product-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            label: 'Product'
          },
          fields: {
            add: {
              _products: {
                type: 'relationship',
                withType: 'product'
              }
            }
          }
        },
        '@apostrophecms/page': {
          options: {
            park: [
              {
                slug: '/recursion-test-page',
                type: 'recursion-test-page',
                title: 'Recursion Test Page',
                parkedId: 'recursion-test-page'
              }
            ],
            types: [
              {
                name: '@apostrophecms/home-page',
                label: 'Home'
              },
              {
                name: 'recursion-test-page',
                label: 'Recursion Test Page'
              }
            ]
          }
        },
        'recursion-test-page': {
          extend: '@apostrophecms/page-type'
        }
      }
    });
    assert(apos.util.recursionGuard);
  });

  it('should create a stack as it goes and stop without executing depth 50', async () => {
    let depth = 0;
    let depth49First = true;
    const req = apos.task.getReq();
    let warnings = '';
    // Capture output of util.warn so we can verify there was a warning
    apos.util.warn = function(...args) {
      warnings += args.join('\n');
    };
    const result = await load();
    assert(warnings.match(/review the stack to find the problem/));
    assert(warnings.match(/test/));
    // Guarded functions not directly blocked by the depth rule should
    // return their own result
    assert(result === 'result');
    assert(depth === 49);
    assert(!req.aposStack.length);
    async function load() {
      return apos.util.recursionGuard(req, 'test', async () => {
        depth++;
        assert(req.aposStack);
        assert(req.aposStack.length === depth);
        const nestedResult = await load();
        // Careful, "depth" stays at 49 as we return up the stack
        if ((depth === 49) && (depth49First === true)) {
          // Guarded functions directly blocked by the depth rule
          // should return undefined
          assert(nestedResult === undefined);
          depth49First = false;
        } else {
          // Other invocations should return the result of the inner function
          assert(nestedResult === 'result');
        }
        return 'result';
      });
    }
  });

  it('should immediately stop runaway self-references among widgets by default', async () => {
    const req = apos.task.getReq();
    const product = await apos.product.insert(req, {
      title: 'Test Product'
    });
    const selfRefId = cuid();
    await apos.article.insert(req, {
      _id: selfRefId,
      title: 'Self Referential Article',
      main: {
        metaType: 'area',
        _id: cuid(),
        items: [
          {
            metaType: 'widget',
            type: 'article',
            articlesIds: [ selfRefId ]
          },
          {
            metaType: 'widget',
            type: 'product',
            productsIds: [ product._id ]
          }
        ]
      }
    });
    const article = await apos.article.find(req, {
      _id: selfRefId
    }).toObject();
    assert(article);
    // Sanity check that we didn't kill all widget loaders: check
    // the product widget
    assert(article.main.items[1]._products[0]);
    // Now dig into the recursive article widget
    assert(article.main.items[0]);
    // We do go down one level, because it's not recursing within the
    // widget loader yet on the first go
    assert(article.main.items[0]._articles);
    assert(article.main.items[0]._articles[0]);
    // However there should be no second go!
    assert(article.main.items[0]._articles[0].main);
    assert(article.main.items[0]._articles[0].main.items[0]);
    assert(!article.main.items[0]._articles[0].main.items[0]._articles);
  });

  it('should eventually stop runaway self-references among widgets that use neverLoadSelf: false', async () => {
    const req = apos.task.getReq();
    const selfRefId = cuid();
    await apos.article.insert(req, {
      _id: selfRefId,
      title: 'Very Self Referential Article',
      main: {
        metaType: 'area',
        _id: cuid(),
        items: [
          {
            metaType: 'widget',
            type: 'scary-article',
            articlesIds: [ selfRefId ]
          }
        ]
      }
    });
    let warnings = '';
    // Capture output of util.warn so we can verify there was a warning
    apos.util.warn = function(...args) {
      warnings += args.join('\n');
    };
    const article = await apos.article.find(req, {
      _id: selfRefId
    }).toObject();
    // Verify the stack shown in the warning references the right bits
    assert(warnings.match(/widget:scary-article/));
    assert(warnings.match(/relationship:article/));
    // If we get this far we successfully stopped the recursion at some depth
    assert(article);
    // ... But verify some recursion did take place
    assert(article.main.items[0]);
    assert(article.main.items[0]._articles[0]);
    assert(article.main.items[0]._articles[0].main.items[0]._articles[0]);
  });

  it('should eventually stop runaway self-references in async components', async () => {
    let warnings = '';
    // Capture output of util.warn so we can verify there was a warning
    apos.util.warn = function(...args) {
      warnings += args.join('\n');
    };
    const html = await apos.http.get('/recursion-test-page');
    assert(warnings.match(/component:recursion-test-page:test/));
    // If we got this far the recursion was eventually stopped
    assert(html.match(/Sing to me, Oh Muse\./));
    assert(html.match(/At depth 0/));
    assert(html.match(/At depth 48/));
    assert(!html.match(/At depth 49/));
    assert(!html.match(/Object/));
  });
});
