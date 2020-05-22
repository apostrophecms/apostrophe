const t = require('../test-lib/test.js');
const assert = require('assert');

let apos;
let homeId;
let jar;

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
        '@apostrophecms/pages': {
          options: {
            park: [],
            types: [
              {
                name: 'home',
                label: 'Home'
              },
              {
                name: 'testPage',
                label: 'Test Page'
              }
            ]
          }
        },
        testPage: {
          extend: '@apostrophecms/page-type',
          fields: {
            color: {
              type: 'string'
            }
          }
        }
      }
    });

    assert(apos.pages.__meta.name === '@apostrophecms/pages');
  });

  it('should be able to insert test user', async function() {
    assert(apos.users.newInstance);
    const user = apos.users.newInstance();
    assert(user);

    user.firstName = 'ad';
    user.lastName = 'min';
    user.title = 'admin';
    user.username = 'admin';
    user.password = 'admin';
    user.email = 'ad@min.com';
    user.permissions = [ 'admin' ];

    return apos.users.insert(apos.tasks.getReq(), user);
  });

  it('REST: should be able to log in as admin', async () => {
    jar = apos.http.jar();

    // establish session
    let page = await apos.http.get('/', {
      jar
    });

    assert(page.match(/logged out/));

    // Log in

    await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'admin',
        password: 'admin'
      },
      jar
    });

    // Confirm login
    page = await apos.http.get('/', {
      jar
    });

    assert(page.match(/logged in/));
  });

  it('can GET the home page without session', async () => {
    const home = await apos.http.get('/api/v1/@apostrophecms/pages', {});
    assert(home);
    assert(home.slug === '/');
    // make sure new style paths used
    assert(home.path !== '/');
    assert(home.path === home._id);
    assert(home.level === 0);
    homeId = home._id;
  });

  it('should be able to use db to insert documents', async function() {
    const testItems = [
      { _id: 'parent',
        type: 'testPage',
        slug: '/parent',
        published: true,
        path: `${homeId}/parent`,
        level: 1,
        rank: 0
      },
      {
        _id: 'child',
        type: 'testPage',
        slug: '/child',
        published: true,
        path: `${homeId}/parent/child`,
        level: 2,
        rank: 0
      },
      {
        _id: 'grandchild',
        type: 'testPage',
        slug: '/grandchild',
        published: true,
        path: `${homeId}/parent/child/grandchild`,
        level: 3,
        rank: 0
      },
      {
        _id: 'sibling',
        type: 'testPage',
        slug: '/sibling',
        published: true,
        path: `${homeId}/parent/sibling`,
        level: 2,
        rank: 1

      },
      {
        _id: 'cousin',
        type: 'testPage',
        slug: '/cousin',
        published: true,
        path: `${homeId}/parent/sibling/cousin`,
        level: 3,
        rank: 0
      },
      {
        _id: 'another-parent',
        type: 'testPage',
        slug: '/another-parent',
        published: true,
        path: `${homeId}/another-parent`,
        level: 1,
        rank: 0
      }
    ];

    const items = await apos.docs.db.insertMany(testItems);

    assert(items.result.ok === 1);
    assert(items.insertedCount === 6);
  });

  it('is able to make a subpage of the homepage without _position or _targetId', async function() {

    const body = {
      slug: '/new-tab',
      published: true,
      type: 'testPage',
      title: 'New Tab'
    };

    const page = await apos.http.post('/api/v1/@apostrophecms/pages', {
      body,
      jar
    });

    assert(page);
    assert(page.title === 'New Tab');
    // Is the path generally correct?
    assert.strictEqual(page.path, `${homeId}/${page._id}`);
    assert.strictEqual(page.level, 1);
  });

  it('is able to make a subpage of /parent with _position and _targetId', async function() {

    const body = {
      slug: '/new-page',
      published: true,
      type: 'testPage',
      title: 'New Page',
      _targetId: 'parent',
      _position: 'lastChild'
    };

    const page = await apos.http.post('/api/v1/@apostrophecms/pages', {
      body,
      jar
    });

    assert(page);
    assert(page.title === 'New Page');
    // Is the path generally correct?
    assert.strictEqual(page.path, `${homeId}/parent/${page._id}`);
    assert.strictEqual(page.level, 2);
    assert.strictEqual(page.rank, 2);
  });

  it('cannot POST a page without a session', async () => {
    const body = {
      slug: '/new-tab',
      published: true,
      type: 'testPage',
      title: 'New Tab'
    };
    try {
      await apos.http.post('/api/v1/@apostrophecms/pages', {
        body
      });
      assert(false);
    } catch (e) {
      assert(true);
    }
  });

  it('should be able to find just a single page with ancestors', async function() {
    const page = await apos.http.get('/api/v1/@apostrophecms/pages/child');

    assert(page);
    assert(page.path === `${homeId}/parent/child`);
    // There should be 2 ancestors.
    assert(page._ancestors.length === 2);
    // The first ancestor should be the homepage
    assert.strictEqual(page._ancestors[0].path, homeId);
    // The second ancestor should be 'parent'
    assert.strictEqual(page._ancestors[1].path, `${homeId}/parent`);

    // There should be only 1 result.
    assert(page);
    // There should be 2 ancestors.
    assert(page._ancestors.length === 2);
  });

  it('should be able to find just a single page with children', async function() {
    const page = await apos.http.get('/api/v1/@apostrophecms/pages/parent');

    assert(page);
    assert(page.path === `${homeId}/parent`);
    // There should be 1 ancestor
    assert(page._ancestors.length === 1);
    // The first ancestor should be the homepage
    assert.strictEqual(page._ancestors[0].path, homeId);

    // There should be children
    assert(page._children);
    assert(page._children.length === 3);
    assert(page._children[0]._id === 'child');
    assert(page._children[1]._id === 'sibling');
    assert(page._children[2].slug === '/new-page');
  });

  it('is able to move root/parent/sibling/cousin after root/parent', async function() {
    let page = await apos.http.patch('/api/v1/@apostrophecms/pages/cousin', {
      body: {
        _targetId: 'parent',
        _position: 'after'
      },
      jar
    });
    assert(page._id);
    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId}/cousin`);
    // Is the rank correct?
    assert.strictEqual(page.rank, 1);
  });

  it('is able to move root/cousin before root/parent/child', async function() {
    // 'Cousin' _id === 4312
    // 'Child' _id === 2341
    let page = await apos.http.patch('/api/v1/@apostrophecms/pages/cousin', {
      body: {
        _targetId: 'child',
        _position: 'before'
      },
      jar
    });

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId}/parent/cousin`);
    // Is the rank correct?
    assert.strictEqual(page.rank, 0);
  });

  it('is able to move root/parent/cousin inside root/parent/sibling', async function() {
    let page = await apos.http.patch('/api/v1/@apostrophecms/pages/cousin', {
      body: {
        _targetId: 'sibling',
        _position: 'firstChild'
      },
      jar
    });

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId}/parent/sibling/cousin`);
    // Is the rank correct?
    assert.strictEqual(page.rank, 0);
  });

  it('moving /parent into /another-parent should also move /parent/sibling', async function() {
    await apos.http.patch('/api/v1/@apostrophecms/pages/parent', {
      body: {
        _targetId: 'another-parent',
        _position: 'firstChild'
      },
      jar
    });
    const page = await apos.http.get('/api/v1/@apostrophecms/pages/sibling', { jar });

    // Is the grandchild's path correct?
    assert.strictEqual(page.path, `${homeId}/another-parent/parent/sibling`);
  });

  it('can use PUT to modify a page', async function() {
    const page = await apos.http.get('/api/v1/@apostrophecms/pages/sibling', { jar });
    assert(page);
    page.title = 'Changed Title';
    page.color = 'blue';
    await apos.http.put('/api/v1/@apostrophecms/pages/sibling', { body: page, jar });
    const page2 = await apos.http.get('/api/v1/@apostrophecms/pages/sibling', { jar });
    assert.strictEqual(page2.title, 'Changed Title');
    assert.strictEqual(page2.color, 'blue');
  });

  it('can use PATCH to modify one property of a page', async function() {
    const page = await apos.http.get('/api/v1/@apostrophecms/pages/sibling', { jar });
    assert(page);
    page.title = 'Changed Title';
    await apos.http.patch('/api/v1/@apostrophecms/pages/sibling', {
      body: {
        title: 'New Title'
      },
      jar
    });
    const page2 = await apos.http.get('/api/v1/@apostrophecms/pages/sibling', { jar });
    assert.strictEqual(page2.title, 'New Title');
    // Did not modify this
    assert.strictEqual(page2.color, 'blue');
  });
});
