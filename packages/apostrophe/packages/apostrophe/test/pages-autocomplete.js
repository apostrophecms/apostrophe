const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('Pages Autocomplete', function() {
  let apos;
  let jar;

  this.timeout(t.timeout);

  before(async function () {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/page': {
          options: {
            park: [],
            types: [
              {
                name: '@apostrophecms/home-page',
                label: 'Home'
              },
              {
                name: 'test-page',
                label: 'Test Page'
              },
              {
                name: 'complex-page',
                label: 'Complex Page'
              }
            ]
          }
        },
        'test-page': {
          extend: '@apostrophecms/page-type',
          options: {
            alias: 'testPage',
            label: 'Test Page'
          }
        },
        // Pretend we have page relationships here
        'complex-page': {
          extend: '@apostrophecms/page-type',
          options: {
            alias: 'complexPage',
            label: 'Complex Page'
          }
        }
      }
    });

    await t.createAdmin(apos, {
      username: 'admin',
      password: 'admin',
      title: 'admin',
      email: 'admin@example.com'
    });

    jar = await login(apos);
    await createTestPages(apos, jar);
  });

  after(async function () {
    return t.destroy(apos);
  });

  it('should suggest all types', async function () {
    {
      const suggestions = await apos.http.get('/api/v1/@apostrophecms/page', {
        jar,
        qs: {
          autocomplete: 'home'
        }
      });
      assert.equal(suggestions.results.length, 1, 'home page not found');
      assert.equal(suggestions.results[0].slug, '/', 'home page slug not found');
    }

    {
      const suggestions = await apos.http.get('/api/v1/@apostrophecms/page', {
        jar,
        qs: {
          autocomplete: 'test'
        }
      });
      assert.equal(suggestions.results.length, 1, 'test page not found');
      assert.equal(suggestions.results[0].slug, '/test-page', 'test page slug not found');
    }

    {
      const suggestions = await apos.http.get('/api/v1/@apostrophecms/page', {
        jar,
        qs: {
          autocomplete: 'complex'
        }
      });
      assert.equal(suggestions.results.length, 1, 'complex page not found');
      assert.equal(suggestions.results[0].slug, '/complex-page', 'complex page slug not found');
    }

    {
      const suggestions = await apos.http.get('/api/v1/@apostrophecms/page', {
        jar,
        qs: {
          autocomplete: 'page'
        }
      });
      assert.equal(suggestions.results.length, 3, 'all pages does not match');
    }
  });

  it('should suggest by type', async function () {
    {
      const suggestions = await apos.http.get('/api/v1/@apostrophecms/page', {
        jar,
        qs: {
          autocomplete: 'page',
          type: '@apostrophecms/home-page'
        }
      });
      assert.equal(suggestions.results.length, 1, 'home page not found');
      assert.equal(suggestions.results[0].slug, '/', 'home page slug not found');
    }

    {
      const suggestions = await apos.http.get('/api/v1/@apostrophecms/page', {
        jar,
        qs: {
          autocomplete: 'page',
          type: 'test-page'
        }
      });
      assert.equal(suggestions.results.length, 1, 'test page not found');
      assert.equal(suggestions.results[0].slug, '/test-page', 'test page slug not found');
    }

    {
      const suggestions = await apos.http.get('/api/v1/@apostrophecms/page', {
        jar,
        qs: {
          autocomplete: 'page',
          type: 'complex-page'
        }
      });
      assert.equal(suggestions.results.length, 1, 'complex page not found');
      assert.equal(suggestions.results[0].slug, '/complex-page', 'complex page slug not found');
    }
  });
});

async function login(apos) {
  const jar = await t.loginAs(apos, 'admin');
  const page = await apos.http.get('/', {
    jar
  });
  assert(page.match(/logged in/));
  return jar;
}

async function createTestPages(apos, jar) {
  const req = apos.task.getReq();

  const home = await apos.page.find(req, { slug: '/' }).toObject();

  const testPage = await apos.page.insert(req, home._id, 'lastChild', {
    title: 'Test Page',
    slug: '/test-page',
    type: 'test-page'
  });
  assert(testPage);
  assert(testPage.slug === '/test-page');

  const complexPage = await apos.page.insert(req, home._id, 'lastChild', {
    title: 'Complex Page',
    slug: '/complex-page',
    type: 'complex-page',
    pageIds: [ testPage.aposDocId ],
    basePageIds: [ home.aposDocId ]
  });
  assert(complexPage);
  assert(complexPage.slug === '/complex-page');

  // Validate test data
  const tree = await apos.http.get('/api/v1/@apostrophecms/page', {
    jar
  });
  assert.equal(tree.slug, '/');
  // Important when validating suggestions.
  assert.equal(tree.highSearchText.includes('page'), true, 'home page does not include page in highSearchText');
  assert.equal(tree._children.length, 2);
  assert(tree._children.some(page => page.slug === '/test-page'), 'test page missing');
  assert(tree._children.some(page => page.slug === '/complex-page'), 'complex page missing');
}
