const t = require('../test-lib/test.js');
const assert = require('assert');
const _ = require('lodash');

let apos;
let homeId;
const apiKey = 'this is a test api key';

describe('Pages', function() {

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should be a property of the apos object', async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/express': {
          options: {
            apiKeys: {
              [apiKey]: {
                role: 'admin'
              }
            }
          }
        },
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
              }
            ],
            publicApiProjection: {
              title: 1,
              _url: 1
            }
          }
        },
        'test-page': {
          extend: '@apostrophecms/page-type'
        }
      }
    });

    assert(apos.page.__meta.name === '@apostrophecms/page');
  });

  // SETUP

  it('should make sure all of the expected indexes are configured', async function() {
    const expectedIndexes = [ 'path' ];
    const actualIndexes = [];

    const info = await apos.doc.db.indexInformation();

    // Extract the actual index info we care about
    _.each(info, function(index) {
      actualIndexes.push(index[0][0]);
    });

    // Now make sure everything in expectedIndexes is in actualIndexes
    _.each(expectedIndexes, function(index) {
      assert(_.includes(actualIndexes, index));
    });
  });

  it('parked homepage exists', async function() {
    const home = await apos.page.find(apos.task.getAnonReq(), { level: 0 }).toObject();

    assert(home);
    homeId = home._id;
    assert(home.slug === '/');
    assert(`${home.path}:en:published` === home._id);
    assert(home.type === '@apostrophecms/home-page');
    assert(home.parked);
    assert(home.visibility === 'public');
  });

  it('parked archive page exists', async function() {
    const archive = await apos.page.find(apos.task.getReq(), { slug: '/archive' }).archived(null).toObject();
    assert(archive);
    assert(archive.slug === '/archive');
    assert(archive.path === `${homeId.replace(':en:published', '')}/${archive._id.replace(':en:published', '')}`);
    assert(archive.type === '@apostrophecms/archive-page');
    assert(archive.parked);
    // Verify that clonePermanent did its
    // job and removed properties not meant
    // to be stored in mongodb
    assert(!archive._children);
  });

  it('should be able to use db to insert documents', async function() {
    const testItems = [
      {
        _id: 'parent:en:published',
        aposLocale: 'en:published',
        aposDocId: 'parent',
        type: 'test-page',
        slug: '/parent',
        visibility: 'public',
        path: `${homeId.replace(':en:published', '')}/parent`,
        level: 1,
        rank: 0
      },
      {
        _id: 'child:en:published',
        aposLocale: 'en:published',
        aposDocId: 'child',
        type: 'test-page',
        slug: '/parent/child',
        visibility: 'public',
        path: `${homeId.replace(':en:published', '')}/parent/child`,
        level: 2,
        rank: 0
      },
      {
        _id: 'grandchild:en:published',
        aposLocale: 'en:published',
        aposDocId: 'grandchild',
        type: 'test-page',
        slug: '/parent/child/grandchild',
        visibility: 'public',
        path: `${homeId.replace(':en:published', '')}/parent/child/grandchild`,
        level: 3,
        rank: 0
      },
      {
        _id: 'sibling:en:published',
        aposLocale: 'en:published',
        aposDocId: 'sibling',
        type: 'test-page',
        slug: '/parent/sibling',
        visibility: 'public',
        path: `${homeId.replace(':en:published', '')}/parent/sibling`,
        level: 2,
        rank: 1

      },
      {
        _id: 'cousin:en:published',
        aposLocale: 'en:published',
        aposDocId: 'cousin',
        type: 'test-page',
        slug: '/parent/sibling/cousin',
        visibility: 'public',
        path: `${homeId.replace(':en:published', '')}/parent/sibling/cousin`,
        level: 3,
        rank: 0
      },
      {
        _id: 'another-parent:en:published',
        aposLocale: 'en:published',
        aposDocId: 'another-parent',
        type: 'test-page',
        slug: '/another-parent',
        visibility: 'public',
        path: `${homeId.replace(':en:published', '')}/another-parent`,
        level: 1,
        rank: 1
      }
    ];
    // Insert draft versions too to match the A3 data model
    const draftItems = await apos.doc.db.insertMany(testItems.map(item => ({
      ...item,
      aposLocale: item.aposLocale.replace(':published', ':draft'),
      _id: item._id.replace(':published', ':draft')
    })));
    assert(draftItems.result.ok === 1);
    assert(draftItems.insertedCount === 6);

    const items = await apos.doc.db.insertMany(testItems);

    assert(items.result.ok === 1);
    assert(items.insertedCount === 6);
  });

  // FINDING

  it('should have a find method on pages that returns a cursor', async function() {
    const cursor = apos.page.find(apos.task.getAnonReq());
    assert(cursor);
  });

  it('should be able to find the parked homepage', async function() {
    const cursor = apos.page.find(apos.task.getAnonReq(), { slug: '/' });

    const page = await cursor.toObject();

    // There should be only 1 result.
    assert(page);
    assert(`${page.path}:en:published` === page._id);
    assert(page.rank === 0);
  });

  it('should be able to find just a single page', async function() {
    const cursor = apos.page.find(apos.task.getAnonReq(), { slug: '/parent/child' });

    const page = await cursor.toObject();

    // There should be only 1 result.
    assert(page);
    // It should have a path of /parent/child
    assert(page.path === `${homeId.replace(':en:published', '')}/parent/child`);
  });

  it('should convert an uppercase URL to its lowercase version', async function() {
    const response = await apos.http.get('/PArent/cHild', {
      fullResponse: true
    });
    assert(response.body.match(/URL: \/parent\/child/));
  });

  it('should NOT convert an uppercase URL if redirectFailedUpperCaseUrls is false', async function() {
    apos.page.options.redirectFailedUpperCaseUrls = false;
    try {
      await apos.http.get('/PArent/cHild', {
        fullResponse: true
      });
    } catch (error) {
      assert(error.status === 404);
    }
  });

  it('should be able to include the ancestors of a page', async function() {
    const cursor = apos.page.find(apos.task.getAnonReq(), { slug: '/parent/child' });

    const page = await cursor.ancestors(true).toObject();

    // There should be only 1 result.
    assert(page);
    // There should be 2 ancestors.
    assert(page._ancestors.length === 2);
    // The first ancestor should be the homepage
    assert.strictEqual(`${page._ancestors[0].path}:en:published`, homeId);
    // The second ancestor should be 'parent'
    assert.strictEqual(page._ancestors[1].path, `${homeId.replace(':en:published', '')}/parent`);
  });

  it('should be able to include just one ancestor of a page, i.e. the parent', async function() {
    const cursor = apos.page.find(apos.task.getAnonReq(), { slug: '/parent/child' });

    const page = await cursor.ancestors({ depth: 1 }).toObject();

    // There should be only 1 result.
    assert(page);
    // There should be 1 ancestor returned.
    assert(page._ancestors.length === 1);
    // The first ancestor returned should be 'parent'
    assert.strictEqual(page._ancestors[0].path, `${homeId.replace(':en:published', '')}/parent`);
  });

  it('should be able to include the children of the ancestors of a page', async function() {
    const cursor = apos.page.find(apos.task.getAnonReq(), { slug: '/parent/child' });

    const page = await cursor.ancestors({ children: 1 }).toObject();

    // There should be only 1 result.
    assert(page);
    // There should be 2 ancestors.
    assert(page._ancestors.length === 2);
    // The second ancestor should have children
    assert(page._ancestors[1]._children);
    // The first ancestor's child should have a path '/parent/child'
    assert.strictEqual(page._ancestors[1]._children[0].path, `${homeId.replace(':en:published', '')}/parent/child`);
    // The second ancestor's child should have a path '/parent/sibling'
    assert.strictEqual(page._ancestors[1]._children[1].path, `${homeId.replace(':en:published', '')}/parent/sibling`);
  });

  // INSERTING

  it('is able to insert a new page', async function() {
    const parentId = 'parent:en:published';

    const newPage = {
      slug: '/parent/new-page',
      visibility: 'public',
      type: 'test-page',
      title: 'New Page'
    };

    const page = await apos.page.insert(apos.task.getReq(), parentId, 'lastChild', newPage);

    // Is the path generally correct?
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/parent/${page._id.replace(':en:published', '')}`);
  });

  let newPage;

  it('is able to insert a new page in the correct order', async function() {
    const cursor = apos.page.find(apos.task.getAnonReq(), {
      slug: '/parent/new-page'
    });

    newPage = await cursor.toObject();

    assert(newPage);
    assert.strictEqual(newPage.rank, 2);
    assert.strictEqual(newPage.level, 2);
  });

  it('is able to insert a subpage', async function() {

    const subPageInfo = {
      slug: '/parent/new-page/sub-page',
      visibility: 'public',
      type: 'test-page',
      title: 'Sub Page'
    };

    const subPage = await apos.page.insert(apos.task.getReq(), newPage._id, 'lastChild', subPageInfo);
    const homePage = await apos.doc.db.findOne({
      slug: '/',
      aposMode: 'published'
    });
    const components = subPage.path.split('/');
    assert.strictEqual(components.length, 4);
    assert(components[0] === homePage.aposDocId);
    assert(components[1] === 'parent');
    assert(components[2] === newPage.aposDocId);
    assert(components[3] === subPage.aposDocId);
    assert.strictEqual(subPage.slug, '/parent/new-page/sub-page');
    assert(subPage.rank === 0);
    assert(subPage.level === 3);
  });

  // MOVING

  it('is able to move root/parent/sibling/cousin after root/parent', async function() {
    await apos.page.move(apos.task.getReq(), 'cousin:en:published', 'parent:en:published', 'after');

    const cursor = apos.page.find(apos.task.getAnonReq(), { _id: 'cousin:en:published' });

    const page = await cursor.toObject();

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/cousin`);
    // Is the rank correct?
    assert.strictEqual(page.rank, 1);
  });

  it('is able to move root/cousin before root/parent/child', async function() {
    // 'Cousin' _id === 4312
    // 'Child' _id === 2341

    await apos.page.move(apos.task.getReq(), 'cousin:en:published', 'child:en:published', 'before');
    const cursor = apos.page.find(apos.task.getAnonReq(), { _id: 'cousin:en:published' });
    const page = await cursor.toObject();

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/parent/cousin`);
    // Is the rank correct?
    assert.strictEqual(page.rank, 0);
  });

  it('is able to move root/parent/cousin inside root/parent/sibling', async function() {
    await apos.page.move(apos.task.getReq(), 'cousin:en:published', 'sibling:en:published', 'firstChild');

    const cursor = apos.page.find(apos.task.getAnonReq(), { _id: 'cousin:en:published' });
    const page = await cursor.toObject();

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/parent/sibling/cousin`);
    // Is the rank correct?
    assert.strictEqual(page.rank, 0);
  });

  it('moving /parent into /another-parent should also move /parent/sibling', async function() {
    await apos.page.move(apos.task.getReq(), 'parent:en:published', 'another-parent:en:published', 'firstChild');

    const cursor = apos.page.find(apos.task.getAnonReq(), { _id: 'sibling:en:published' });
    const page = await cursor.toObject();

    // Is the grandchild's path correct?
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/another-parent/parent/sibling`);
  });

  it('should be able to serve a page', async function() {
    const response = await apos.http.get('/another-parent/parent/child', {
      fullResponse: true
    });

    // Is our status code good?
    assert.strictEqual(response.status, 200);
    // Did we get our page back?
    assert(response.body.match(/Sing to me, Oh Muse./));
    // Does the response prove that data.home was available?
    assert(response.body.match(/Home: \//));
    // Does the response prove that data.home._children was available?
    assert(response.body.match(/Tab: \/another-parent/));
  });

  it('should not be able to serve a nonexistent page', async function() {
    try {
      await apos.http.get('/nobodyschild');
      assert(false);
    } catch (e) {
      // Is our status code good?
      assert.strictEqual(e.status, 404);
      // Does the response prove that data.home was available?
      assert(e.body.match(/Home: \//));
      // Does the response prove that data.home._children was available?
      assert(e.body.match(/Tab: \/another-parent/));
    }
  });

  it('should detect that the home page is an ancestor of any page except itself', function() {
    assert(
      // actual paths are made up of _ids in 3.x
      apos.page.isAncestorOf({
        path: 'home'
      }, {
        path: 'home/about'
      })
    );
    assert(
      apos.page.isAncestorOf({
        path: 'home'
      }, {
        path: 'home/about/grandkid'
      })
    );
    assert(!apos.page.isAncestorOf({
      path: 'home'
    }, {
      path: 'home'
    }));
  });

  it('should detect a tab as the ancestor of its great grandchild but not someone else\'s', function() {
    assert(
      apos.page.isAncestorOf({
        path: 'home/about'
      }, {
        path: 'home/about/test/thing'
      })
    );

    assert(
      !apos.page.isAncestorOf({
        path: 'home/about'
      }, {
        path: 'home/wiggy/test/thing'
      })
    );

  });

  it('is able to move parent to the archive', async function() {
    await apos.page.archive(apos.task.getReq(), 'parent:en:published');

    const cursor = apos.page.find(apos.task.getAnonReq(), { _id: 'parent' });
    const page = await cursor.toObject();

    assert(!page);

    const req = apos.task.getReq();
    const archive = await apos.page.findOneForEditing(req, { parkedId: 'archive' });
    const archived = await apos.page.findOneForEditing(req, {
      _id: 'parent:en:published'
    });
    assert.strictEqual(archived.path, `${homeId.replace(':en:published', '')}/${archive._id.replace(':en:published', '')}/${archived._id.replace(':en:published', '')}`);
    assert(archived.archived);
    assert.strictEqual(archived.level, 2);
  });

  it('should be able to find the parked homepage again', async function() {
    const cursor = apos.page.find(apos.task.getAnonReq(), { slug: '/' });

    const page = await cursor.toObject();

    // There should be only 1 result.
    assert(page);
    assert(`${page.path}:en:published` === page._id);
    assert(page.rank === 0);
  });

  it('After everything else, ranks must still be unduplicated among peers and level must be consistent with path', async function() {
    const pages = await apos.doc.db.find({
      slug: /^\//,
      aposLocale: 'en:published'
    }).sort({
      path: 1
    }).toArray();
    for (let i = 0; (i < pages.length); i++) {
      const iLevel = pages[i].path.replace(/[^/]+/g, '').length;
      assert(iLevel === pages[i].level);
      const ranks = [];
      for (let j = i + 1; (j < pages.length); j++) {
        const jLevel = pages[j].path.replace(/[^/]+/g, '').length;
        assert(jLevel === pages[j].level);
        if (pages[j].path.substring(0, pages[i].path.length) !== pages[i].path) {
          break;
        }
        if (pages[j].level !== (pages[i].level + 1)) {
          // Ignore grandchildren etc.
          continue;
        }
        assert(!ranks.includes(pages[j].rank));
        ranks.push(pages[j].rank);
      }
    }
  });

  it('should not set a cache-control value when retrieving pages, when cache option is not set', async function() {
    const response1 = await apos.http.get('/api/v1/@apostrophecms/page', { fullResponse: true });
    const response2 = await apos.http.get(`/api/v1/@apostrophecms/page/${homeId}`, { fullResponse: true });

    assert(response1.headers['cache-control'] === undefined);
    assert(response2.headers['cache-control'] === undefined);
  });

  it('should not set a cache-control value when retrieving a single page, when "etags" cache option is set', async function() {
    apos.page.options.cache = {
      api: {
        maxAge: 5555,
        etags: true
      }
    };

    const response = await apos.http.get(`/api/v1/@apostrophecms/page/${homeId}`, { fullResponse: true });

    assert(response.headers['cache-control'] === undefined);

    delete apos.page.options.cache;
  });

  it('should not set a cache-control value when retrieving pages, when "api" cache option is not set', async function() {
    apos.page.options.cache = {
      page: {
        maxAge: 5555
      }
    };

    const response1 = await apos.http.get('/api/v1/@apostrophecms/page', { fullResponse: true });
    const response2 = await apos.http.get(`/api/v1/@apostrophecms/page/${homeId}`, { fullResponse: true });

    assert(response1.headers['cache-control'] === undefined);
    assert(response2.headers['cache-control'] === undefined);

    delete apos.page.options.cache;
  });

  it('should set a "max-age" cache-control value when retrieving pieces, when "api" cache option is set', async function() {
    apos.page.options.cache = {
      api: {
        maxAge: 4444
      }
    };

    const response1 = await apos.http.get('/api/v1/@apostrophecms/page', { fullResponse: true });
    const response2 = await apos.http.get(`/api/v1/@apostrophecms/page/${homeId}`, { fullResponse: true });

    assert(response1.headers['cache-control'] === 'max-age=4444');
    assert(response2.headers['cache-control'] === 'max-age=4444');

    delete apos.page.options.cache;
  });

  it('should set a "no-store" cache-control value when retrieving pages, when user is connected', async function() {
    const jar = apos.http.jar();
    const user = apos.user.newInstance();

    user.title = 'admin';
    user.username = 'admin';
    user.password = 'admin';
    user.email = 'ad@min.com';
    user.role = 'admin';

    await apos.user.insert(apos.task.getReq(), user);
    await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'admin',
        password: 'admin',
        session: true
      },
      jar
    });

    const response1 = await apos.http.get('/api/v1/@apostrophecms/page', {
      fullResponse: true,
      jar
    });
    const response2 = await apos.http.get(`/api/v1/@apostrophecms/page/${homeId}`, {
      fullResponse: true,
      jar
    });

    assert(response1.headers['cache-control'] === 'no-store');
    assert(response2.headers['cache-control'] === 'no-store');
  });

  it('should set a "no-store" cache-control value when retrieving pages, when "api" cache option is set, when user is connected', async function() {
    apos.page.options.cache = {
      api: {
        maxAge: 4444
      }
    };

    const jar = apos.http.jar();

    await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'admin',
        password: 'admin',
        session: true
      },
      jar
    });

    const response1 = await apos.http.get('/api/v1/@apostrophecms/page', {
      fullResponse: true,
      jar
    });
    const response2 = await apos.http.get(`/api/v1/@apostrophecms/page/${homeId}`, {
      fullResponse: true,
      jar
    });

    assert(response1.headers['cache-control'] === 'no-store');
    assert(response2.headers['cache-control'] === 'no-store');

    delete apos.page.options.cache;
  });

  it('should set a "no-store" cache-control value when retrieving pages, when user is connected using an api key', async function() {
    const response1 = await apos.http.get(`/api/v1/@apostrophecms/page?apiKey=${apiKey}`, { fullResponse: true });
    const response2 = await apos.http.get(`/api/v1/@apostrophecms/page/${homeId}?apiKey=${apiKey}`, { fullResponse: true });

    assert(response1.headers['cache-control'] === 'no-store');
    assert(response2.headers['cache-control'] === 'no-store');
  });

  it('should set a "no-store" cache-control value when retrieving pages, when "api" cache option is set, when user is connected using an api key', async function() {
    apos.page.options.cache = {
      api: {
        maxAge: 4444
      }
    };

    const response1 = await apos.http.get(`/api/v1/@apostrophecms/page?apiKey=${apiKey}`, { fullResponse: true });
    const response2 = await apos.http.get(`/api/v1/@apostrophecms/page/${homeId}?apiKey=${apiKey}`, { fullResponse: true });

    assert(response1.headers['cache-control'] === 'no-store');
    assert(response2.headers['cache-control'] === 'no-store');

    delete apos.page.options.cache;
  });

  it('should not set a cache-control value when serving a page, when cache option is not set', async function() {
    const response = await apos.http.get('/', { fullResponse: true });

    assert(response.headers['cache-control'] === undefined);
  });

  it('should not set a cache-control value when serving a page, when "page" cache option is not set', async function() {
    apos.page.options.cache = {
      api: {
        maxAge: 4444
      }
    };
    const response = await apos.http.get('/', { fullResponse: true });

    assert(response.headers['cache-control'] === undefined);

    delete apos.page.options.cache;
  });

  it('should not set a cache-control value when serving a page, when "etags" cache option is set', async function() {
    apos.page.options.cache = {
      page: {
        maxAge: 4444,
        etags: true
      }
    };
    const response = await apos.http.get('/', { fullResponse: true });

    assert(response.headers['cache-control'] === undefined);

    delete apos.page.options.cache;
  });

  it('should set a cache-control value when serving a page, when "page" cache option is set', async function() {
    apos.page.options.cache = {
      page: {
        maxAge: 5555
      }
    };
    const response = await apos.http.get('/', { fullResponse: true });

    assert(response.headers['cache-control'] === 'max-age=5555');

    delete apos.page.options.cache;
  });

  it('should set a custom etag when retrieving a single page', async function() {
    apos.page.options.cache = {
      api: {
        maxAge: 1111,
        etags: true
      }
    };

    const response = await apos.http.get(`/api/v1/@apostrophecms/page/${homeId}`, { fullResponse: true });

    const eTagParts = response.headers.etag.split(':');

    assert(eTagParts[0] === apos.asset.getReleaseId());
    assert(eTagParts[1] === (new Date(response.body.cacheInvalidatedAt)).getTime().toString());
    assert(eTagParts[2]);

    delete apos.page.options.cache;
  });

  it('should return a 304 status code when retrieving a page with a matching etag', async function() {
    apos.page.options.cache = {
      api: {
        maxAge: 1111,
        etags: true
      }
    };

    const response1 = await apos.http.get(`/api/v1/@apostrophecms/page/${homeId}`, { fullResponse: true });
    const response2 = await apos.http.get(`/api/v1/@apostrophecms/page/${homeId}`, {
      fullResponse: true,
      headers: {
        'if-none-match': response1.headers.etag
      }
    });

    assert(response1.status === 200);
    assert(response1.body);

    assert(response2.status === 304);
    assert(response2.body === '');

    // Same ETag should be sent again to the client
    assert(response1.headers.etag === response2.headers.etag);

    delete apos.page.options.cache;
  });

  it('should not return a 304 status code when retrieving a page that has been edited', async function() {
    apos.page.options.cache = {
      api: {
        maxAge: 1111,
        etags: true
      }
    };

    const response1 = await apos.http.get(`/api/v1/@apostrophecms/page/${homeId}`, { fullResponse: true });

    const pageDoc = await apos.doc.db.findOne({
      slug: '/',
      aposLocale: 'en:published'
    });

    // Edit homepage, this should invalidate its cache,
    // so requesting it again should not return a 304 status code
    const pageUpdateResponse = await apos.doc.update(apos.task.getReq(), pageDoc);

    const response2 = await apos.http.get(`/api/v1/@apostrophecms/page/${homeId}`, {
      fullResponse: true,
      headers: {
        'if-none-match': response1.headers.etag
      }
    });

    const eTag1Parts = response1.headers.etag.split(':');
    const eTag2Parts = response2.headers.etag.split(':');

    assert(response1.status === 200);
    assert(response1.body);

    assert(response2.status === 200);
    assert(response2.body);

    // New ETag has been generated, with the new value of the edited homepage's `cacheInvalidatedAt` field...
    assert(eTag2Parts[1] === pageUpdateResponse.cacheInvalidatedAt.getTime().toString());
    // ...and a new timestamp
    assert(eTag2Parts[2] !== eTag1Parts[2]);

    delete apos.page.options.cache;
  });

  it('should not return a 304 status code when retrieving a page after the max-age period', async function() {
    apos.page.options.cache = {
      api: {
        maxAge: 4444,
        etags: true
      }
    };

    const response1 = await apos.http.get(`/api/v1/@apostrophecms/page/${homeId}`, { fullResponse: true });

    const eTagParts = response1.headers.etag.split(':');
    const outOfDateETagParts = [ ...eTagParts ];
    outOfDateETagParts[2] = Number(outOfDateETagParts[2]) - (4444 + 1) * 1000; // 1s outdated

    const response2 = await apos.http.get(`/api/v1/@apostrophecms/page/${homeId}`, {
      fullResponse: true,
      headers: {
        'if-none-match': outOfDateETagParts.join(':')
      }
    });

    const eTag1Parts = response1.headers.etag.split(':');
    const eTag2Parts = response2.headers.etag.split(':');

    assert(response1.status === 200);
    assert(response1.body);

    assert(response2.status === 200);
    assert(response2.body);

    // New timestamp
    assert(eTag1Parts[2] !== eTag2Parts[2]);

    delete apos.page.options.cache;
  });

  it('should set a custom etag when serving a page', async function() {
    apos.page.options.cache = {
      page: {
        maxAge: 4444,
        etags: true
      }
    };
    const response = await apos.http.get('/', { fullResponse: true });

    const eTagParts = response.headers.etag.split(':');

    assert(eTagParts[0] === apos.asset.getReleaseId());
    assert(eTagParts[1]);
    assert(eTagParts[2]);

    delete apos.page.options.cache;
  });

  it('should return a 304 status code when requesting a page with a matching etag', async function() {
    apos.page.options.cache = {
      page: {
        maxAge: 4444,
        etags: true
      }
    };

    const response1 = await apos.http.get('/', { fullResponse: true });
    const response2 = await apos.http.get('/', {
      fullResponse: true,
      headers: {
        'if-none-match': response1.headers.etag
      }
    });

    assert(response1.status === 200);
    assert(response1.body);

    assert(response2.status === 304);
    assert(response2.body === '');

    // Same ETag should be sent again to the client
    assert(response1.headers.etag === response2.headers.etag);

    delete apos.page.options.cache;
  });

  it('should not return a 304 status code when requesting a page that has been edited', async function() {
    apos.page.options.cache = {
      page: {
        maxAge: 4444,
        etags: true
      }
    };

    const response1 = await apos.http.get('/', { fullResponse: true });

    const pageDoc = await apos.doc.db.findOne({
      slug: '/',
      aposLocale: 'en:published'
    });

    // Edit homepage, this should invalidate its cache,
    // so requesting it again should not return a 304 status code
    const pageUpdateResponse = await apos.doc.update(apos.task.getReq(), pageDoc);

    const response2 = await apos.http.get('/', {
      fullResponse: true,
      headers: {
        'if-none-match': response1.headers.etag
      }
    });

    const eTag1Parts = response1.headers.etag.split(':');
    const eTag2Parts = response2.headers.etag.split(':');

    assert(response1.status === 200);
    assert(response1.body);

    assert(response2.status === 200);
    assert(response2.body);

    // New ETag has been generated, with the new value of the edited homepage's `cacheInvalidatedAt` field...
    assert(eTag2Parts[1] === pageUpdateResponse.cacheInvalidatedAt.getTime().toString());
    // ...and a new timestamp
    assert(eTag2Parts[2] !== eTag1Parts[2]);

    delete apos.page.options.cache;
  });

  it('should not return a 304 status code when requesting a page with an outdated release id', async function() {
    apos.page.options.cache = {
      page: {
        maxAge: 4444,
        etags: true
      }
    };

    const response1 = await apos.http.get('/', { fullResponse: true });

    const eTagParts = response1.headers.etag.split(':');
    const outOfDateETagParts = [ ...eTagParts ];
    outOfDateETagParts[0] = 'abcdefghi';

    const response2 = await apos.http.get('/', {
      fullResponse: true,
      headers: {
        'if-none-match': outOfDateETagParts.join(':')
      }
    });

    const eTag1Parts = response1.headers.etag.split(':');
    const eTag2Parts = response2.headers.etag.split(':');

    assert(response1.status === 200);
    assert(response1.body);

    assert(response2.status === 200);
    assert(response2.body);

    // New timestamp
    assert(eTag1Parts[2] !== eTag2Parts[2]);

    delete apos.page.options.cache;
  });

  it('should not return a 304 status code when requesting a page after the max-age period', async function() {
    apos.page.options.cache = {
      page: {
        maxAge: 4444,
        etags: true
      }
    };

    const response1 = await apos.http.get('/', { fullResponse: true });

    const eTagParts = response1.headers.etag.split(':');
    const outOfDateETagParts = [ ...eTagParts ];
    outOfDateETagParts[2] = Number(outOfDateETagParts[2]) - (4444 + 1) * 1000; // 1s outdated

    const response2 = await apos.http.get('/', {
      fullResponse: true,
      headers: {
        'if-none-match': outOfDateETagParts.join(':')
      }
    });

    const eTag1Parts = response1.headers.etag.split(':');
    const eTag2Parts = response2.headers.etag.split(':');

    assert(response1.status === 200);
    assert(response1.body);

    assert(response2.status === 200);
    assert(response2.body);

    // New timestamp
    assert(eTag1Parts[2] !== eTag2Parts[2]);

    delete apos.page.options.cache;
  });

  it('should not set a custom etag when retrieving a single page, when user is connected', async function() {
    apos.page.options.cache = {
      api: {
        maxAge: 4444,
        etags: true
      }
    };

    const jar = apos.http.jar();

    await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'admin',
        password: 'admin',
        session: true
      },
      jar
    });

    const response = await apos.http.get(`/api/v1/@apostrophecms/page/${homeId}`, {
      fullResponse: true,
      jar
    });

    const eTagParts = response.headers.etag.split(':');

    assert(eTagParts[0] !== apos.asset.getReleaseId());
    assert(eTagParts[1] !== (new Date(response.body.cacheInvalidatedAt)).getTime().toString());

    delete apos.page.options.cache;
  });

  it('should not set a custom etag when retrieving a single page, when user is connected using an api key', async function() {
    apos.page.options.cache = {
      api: {
        maxAge: 4444,
        etags: true
      }
    };

    const response = await apos.http.get(`/api/v1/@apostrophecms/page/${homeId}?apiKey=${apiKey}`, { fullResponse: true });

    const eTagParts = response.headers.etag.split(':');

    assert(eTagParts[0] !== apos.asset.getReleaseId());
    assert(eTagParts[1] !== (new Date(response.body.cacheInvalidatedAt)).getTime().toString());

    delete apos.page.options.cache;
  });

  describe('unpublish', function() {
    const baseItem = {
      aposDocId: 'some-page',
      type: 'test-page',
      slug: '/some-page',
      visibility: 'public',
      path: '/some-page',
      level: 1,
      rank: 0
    };
    const draftItem = {
      ...baseItem,
      _id: 'some-page:en:draft',
      aposLocale: 'en:draft'
    };
    const publishedItem = {
      ...baseItem,
      _id: 'some-page:en:published',
      aposLocale: 'en:published'
    };
    const previousItem = {
      ...baseItem,
      _id: 'some-page:en:previous',
      aposLocale: 'en:previous'
    };

    let draft;
    let published;
    let previous;

    this.beforeEach(async function() {
      await apos.doc.db.insertMany([
        draftItem,
        publishedItem,
        previousItem
      ]);

      draft = await apos.http.post(
        `/api/v1/@apostrophecms/page/${publishedItem._id}/unpublish?apiKey=${apiKey}`,
        {
          body: {},
          busy: true
        }
      );

      published = await apos.doc.db.findOne({ _id: 'some-page:en:published' });
      previous = await apos.doc.db.findOne({ _id: 'some-page:en:previous' });
    });

    this.afterEach(async function() {
      await apos.doc.db.deleteMany({
        aposDocId: 'some-page'
      });
    });

    it('should remove the published and previous versions of a page', function() {
      assert(published === null);
      assert(previous === null);
    });

    it('should update the draft version of a page', function() {
      assert(draft._id === draftItem._id);
      assert(draft.modified === true);
      assert(draft.lastPublishedAt === null);
    });
  });

  describe('draft sharing', function() {
    const page = {
      _id: 'some-page:en:published',
      title: 'Some Page',
      aposDocId: 'some-page',
      type: 'test-page',
      slug: '/some-page',
      visibility: 'public',
      path: '/some-page',
      level: 1,
      rank: 0
    };

    let req;
    let previousDraft;
    let previousPublished;
    let shareResponse;

    const generatePublicUrl = shareResponse =>
      `${shareResponse._url}?aposShareKey=${encodeURIComponent(shareResponse.aposShareKey)}&aposShareId=${encodeURIComponent(shareResponse._id)}`;

    this.beforeEach(async function() {
      req = apos.task.getReq();
      previousPublished = await apos.page.insert(req, homeId, 'lastChild', page);
      previousDraft = await apos.page.findOneForEditing(
        apos.task.getReq({ mode: 'draft' }),
        { _id: 'some-page:en:draft' }
      );
      await apos.page.update(req, {
        ...previousDraft,
        title: 'Some Page EDITED'
      });
    });

    this.afterEach(async function() {
      await apos.doc.db.deleteMany({ aposDocId: page.aposDocId });
    });

    describe('share', function() {
      this.beforeEach(async function() {
        shareResponse = await apos.page.share(req, previousDraft);
      });

      it('should have a "share" method that returns a draft with aposShareKey', async function() {
        const draft = await apos.doc.db.findOne({
          _id: `${previousDraft.aposDocId}:en:draft`
        });
        const published = await apos.doc.db.findOne({
          _id: `${previousDraft.aposDocId}:en:published`
        });

        assert(apos.page.share);
        assert(!Object.prototype.hasOwnProperty.call(published, 'aposShareKey'));
        assert(!Object.prototype.hasOwnProperty.call(previousDraft, 'aposShareKey'));
        assert(shareResponse.aposShareKey);
        assert(draft.aposShareKey);
        assert(shareResponse.aposShareKey === draft.aposShareKey);
      });

      it('should grant public access to a draft after having enabled draft sharing', async function() {
        const publicUrl = generatePublicUrl(shareResponse);
        const response = await apos.http.get(shareResponse._url, { fullResponse: true });
        const publicResponse = await apos.http.get(publicUrl, { fullResponse: true });

        assert(response.status === 200);
        assert(response.body.includes('Some Page'));
        assert(!response.body.includes('Some Page EDITED'));

        assert(publicResponse.status === 200);
        assert(publicResponse.body.includes('Some Page EDITED'));
      });

      it('should grant public access to a draft without admin UI, even when logged-in', async function() {
        const jar = apos.http.jar();

        await apos.http.post('/api/v1/@apostrophecms/login/login', {
          body: {
            username: 'admin',
            password: 'admin',
            session: true
          },
          jar
        });

        const publicUrl = generatePublicUrl(shareResponse);
        const publicResponse = await apos.http.get(publicUrl, {
          fullResponse: true,
          jar
        });

        assert(publicResponse.status === 200);
        assert(publicResponse.body.includes('Some Page EDITED'));
        assert(!publicResponse.body.includes('apos-admin-bar'));
      });

      it('should grant public access to a draft after having re-enabled draft sharing', async function() {
        await apos.page.unshare(req, previousDraft);

        const shareResponse = await apos.page.share(req, previousDraft);
        const publicUrl = generatePublicUrl(shareResponse);

        const publicResponse = await apos.http.get(publicUrl, { fullResponse: true });

        assert(publicResponse.status === 200);
        assert(publicResponse.body.includes('Some Page EDITED'));
      });
    });

    describe('unshare', function() {
      this.beforeEach(async function() {
        shareResponse = await apos.page.share(req, previousDraft);
      });

      it('should have a "unshare" method that returns a draft without aposShareKey', async function() {
        const unshareResponse = await apos.page.unshare(req, previousDraft);

        const draft = await apos.doc.db.findOne({
          _id: `${previousDraft.aposDocId}:en:draft`
        });
        const published = await apos.doc.db.findOne({
          _id: `${previousDraft.aposDocId}:en:published`
        });

        assert(apos.page.unshare);
        assert(!Object.prototype.hasOwnProperty.call(previousPublished, 'aposShareKey'));
        assert(!Object.prototype.hasOwnProperty.call(previousDraft, 'aposShareKey'));
        assert(!Object.prototype.hasOwnProperty.call(published, 'aposShareKey'));
        assert(!Object.prototype.hasOwnProperty.call(draft, 'aposShareKey'));
        assert(!Object.prototype.hasOwnProperty.call(unshareResponse, 'aposShareKey'));
      });

      it('should remove public access to a draft after having disabled draft sharing', async function() {
        await apos.page.unshare(req, previousDraft);

        try {
          const publicUrl = generatePublicUrl(shareResponse);
          await apos.http.get(publicUrl, { fullResponse: true });
        } catch (error) {
          assert(error.status === 404);
          return;
        }
        throw new Error('should have thrown 404 error');
      });
    });
  });
});
