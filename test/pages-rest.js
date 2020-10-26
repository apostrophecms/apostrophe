const t = require('../test-lib/test.js');
const assert = require('assert');

let apos;
let homeId;
let jar;

describe('Pages REST', function() {

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should be a property of the apos object', async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/page': {
          options: {
            publicApiProjection: {
              title: 1,
              _url: 1,
              path: 1,
              level: 1,
              rank: 1
            },
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
            ]
          }
        },
        'test-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              color: {
                type: 'string'
              },
              body: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {
                      toolbar: [ 'bold', 'italic' ]
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    assert(apos.page.__meta.name === '@apostrophecms/page');
  });

  it('should be able to insert test user', async function() {
    assert(apos.user.newInstance);
    const user = apos.user.newInstance();
    assert(user);

    user.firstName = 'ad';
    user.lastName = 'min';
    user.title = 'admin';
    user.username = 'admin';
    user.password = 'admin';
    user.email = 'ad@min.com';

    return apos.user.insert(apos.task.getReq(), user);
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
    const home = await apos.http.get('/api/v1/@apostrophecms/page', {});
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
      {
        _id: 'parent',
        type: 'test-page',
        slug: '/parent',
        visibility: 'public',
        path: `${homeId}/parent`,
        level: 1,
        rank: 0
      },
      {
        _id: 'child',
        type: 'test-page',
        slug: '/child',
        visibility: 'public',
        path: `${homeId}/parent/child`,
        level: 2,
        rank: 0
      },
      {
        _id: 'grandchild',
        type: 'test-page',
        slug: '/grandchild',
        visibility: 'public',
        path: `${homeId}/parent/child/grandchild`,
        level: 3,
        rank: 0
      },
      {
        _id: 'sibling',
        type: 'test-page',
        slug: '/sibling',
        visibility: 'public',
        path: `${homeId}/parent/sibling`,
        level: 2,
        rank: 1

      },
      {
        _id: 'cousin',
        type: 'test-page',
        slug: '/cousin',
        visibility: 'public',
        path: `${homeId}/parent/sibling/cousin`,
        level: 3,
        rank: 0
      },
      {
        _id: 'another-parent',
        type: 'test-page',
        slug: '/another-parent',
        visibility: 'public',
        path: `${homeId}/another-parent`,
        level: 1,
        rank: 1
      },
      {
        _id: 'neighbor',
        type: 'test-page',
        slug: '/neighbor',
        visibility: 'public',
        path: `${homeId}/neighbor`,
        level: 1,
        rank: 2
      }
    ];

    const items = await apos.doc.db.insertMany(testItems);

    assert(items.result.ok === 1);
    assert(items.insertedCount === 7);
  });

  it('is able to make a subpage of the homepage without _position or _targetId', async function() {

    const body = {
      slug: '/new-tab',
      visibility: 'public',
      type: 'test-page',
      title: 'New Tab'
    };

    const page = await apos.http.post('/api/v1/@apostrophecms/page', {
      body,
      jar
    });

    assert(page);
    assert(page.title === 'New Tab');
    // Is the path generally correct?
    assert.strictEqual(page.path, `${homeId}/${page._id}`);
    assert.strictEqual(page.level, 1);
  });

  it('is able to make a subpage of the homepage at index `1` with numerical _position', async function() {
    const body = {
      slug: '/second-new',
      visibility: 'public',
      type: 'test-page',
      title: 'Second New',
      _targetId: '_home',
      _position: '1'
    };

    const page = await apos.http.post('/api/v1/@apostrophecms/page', {
      body,
      jar
    });

    assert(page);
    assert(page.title === 'Second New');
    // Is the path generally correct?
    assert.strictEqual(page.path, `${homeId}/${page._id}`);
    assert.strictEqual(page.level, 1);
    assert.strictEqual(page.rank, 1);
  });

  let newPageId;
  it('is able to make a subpage of /parent with _position and _targetId', async function() {

    const body = {
      slug: '/new-page',
      visibility: 'public',
      type: 'test-page',
      title: 'New Page',
      _targetId: 'parent',
      _position: 'lastChild'
    };

    const page = await apos.http.post('/api/v1/@apostrophecms/page', {
      body,
      jar
    });

    newPageId = page._id;
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
      visibility: 'public',
      type: 'test-page',
      title: 'New Tab'
    };
    try {
      await apos.http.post('/api/v1/@apostrophecms/page', {
        body
      });
      assert(false);
    } catch (e) {
      assert(true);
    }
  });

  it('should be able to find just a single page with ancestors', async function() {
    const page = await apos.http.get('/api/v1/@apostrophecms/page/child');

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
    const page = await apos.http.get('/api/v1/@apostrophecms/page/parent');

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
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/cousin', {
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
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/cousin', {
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

  it('is able to move root/parent/child before root/parent/cousin using numerical position', async function() {
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/child', {
      body: {
        _targetId: 'parent',
        _position: 0
      },
      jar
    });

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId}/parent/child`);
    // Is the rank correct?
    assert.strictEqual(page.rank, 0);
  });

  it('is able to move root/parent/new-page between root/parent/cousin and root/parent/sibling using numerical position', async function() {
    const page = await apos.http.patch(`/api/v1/@apostrophecms/page/${newPageId}`, {
      body: {
        _targetId: 'parent',
        _position: 2
      },
      jar
    });

    const cousin = await apos.http.get('/api/v1/@apostrophecms/page/cousin', { jar });
    const sibling = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId}/parent/${newPageId}`);
    // Is the rank correct?
    assert(page.rank > cousin.rank);
    assert(page.rank < sibling.rank);
  });

  it('is able to move root/neighbor as the last child of /root/parent using numerical position', async function() {
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/neighbor', {
      body: {
        _targetId: 'parent',
        _position: 4
      },
      jar
    });

    // `sibling` was previously the last child of `parent`.
    const sibling = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId}/parent/neighbor`);
    // Is the rank correct?
    assert(page.rank > sibling.rank);
  });

  it('allows positioning a page at its existing location (lastChild) using numerical position', async function() {
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/neighbor', {
      body: {
        _targetId: 'parent',
        _position: 4
      },
      jar
    });

    // `sibling` was previously the last child of `parent`.
    const sibling = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId}/parent/neighbor`);
    // Is the rank correct?
    assert(page.rank > sibling.rank);
  });
  it('is able to move root/parent/child/grandchild to the next-to-last position under `parent`', async function() {
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/grandchild', {
      body: {
        _targetId: 'parent',
        _position: 4
      },
      jar
    });

    // `sibling` was previously the next-to-last child of `parent`.
    const sibling = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    const neighbor = await apos.http.get('/api/v1/@apostrophecms/page/neighbor', { jar });

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId}/parent/grandchild`);
    // Is the rank correct?
    assert(page.rank > sibling.rank);
    assert(page.rank < neighbor.rank);
  });

  it('allows positioning a page at its existing location (4 of 5) using numerical position', async function() {
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/grandchild', {
      body: {
        _targetId: 'parent',
        _position: 4
      },
      jar
    });

    // `sibling` was previously the next-to-last child of `parent`.
    const sibling = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    const neighbor = await apos.http.get('/api/v1/@apostrophecms/page/neighbor', { jar });

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId}/parent/grandchild`);
    // Is the rank correct?
    assert(page.rank > sibling.rank);
    assert(page.rank < neighbor.rank);
  });
  it('is able to move root/parent/cousin inside root/parent/sibling', async function() {
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/cousin', {
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
    await apos.http.patch('/api/v1/@apostrophecms/page/parent', {
      body: {
        _targetId: 'another-parent',
        _position: 'firstChild'
      },
      jar
    });
    const page = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });

    // Is the grandchild's path correct?
    assert.strictEqual(page.path, `${homeId}/another-parent/parent/sibling`);
  });

  it('can use PUT to modify a page', async function() {
    const page = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    assert(page);
    page.title = 'Changed Title';
    page.color = 'blue';
    await apos.http.put('/api/v1/@apostrophecms/page/sibling', {
      body: page,
      jar
    });
    const page2 = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    assert.strictEqual(page2.title, 'Changed Title');
    assert.strictEqual(page2.color, 'blue');
  });

  it('can use PATCH to modify one property of a page', async function() {
    const page = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    assert(page);
    page.title = 'Changed Title';
    await apos.http.patch('/api/v1/@apostrophecms/page/sibling', {
      body: {
        title: 'New Title'
      },
      jar
    });
    const page2 = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    assert.strictEqual(page2.title, 'New Title');
    // Did not modify this
    assert.strictEqual(page2.color, 'blue');
  });

  it('can use PATCH to move a page beneath the home page with _targetId: _home', async function() {
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/cousin', {
      body: {
        _targetId: '_home',
        _position: 'firstChild'
      },
      jar
    });
    assert(page._id);
    assert.strictEqual(page.path, `${homeId}/${page._id}`);
    assert.strictEqual(page.level, 1);
    assert.strictEqual(page.rank, 0);
  });

  it('can use PATCH to move a page into the trash using _trash as _targetId', async function() {
    let page = await apos.http.patch('/api/v1/@apostrophecms/page/cousin', {
      body: {
        _targetId: '_trash',
        _position: 'firstChild'
      },
      jar
    });
    assert(page._id);
    const trash = await apos.http.get('/api/v1/@apostrophecms/page/_trash?trash=1', {
      jar
    });
    assert(trash);
    // Verify this is really working because of the _trash
    // shortcut
    assert(trash._id !== '_trash');
    assert.strictEqual(page.path, `${homeId}/${trash._id}/${page._id}`);
    assert.strictEqual(page.level, 2);
    assert.strictEqual(page.rank, 0);
    page = await apos.http.get('/api/v1/@apostrophecms/page/cousin?_edit=1&trash=1', {
      jar
    });
    assert(page.trash);
  });

  it('Can use PATCH to add a widget to an area by path', async () => {
    let page = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    page = await apos.http.patch('/api/v1/@apostrophecms/page/sibling', {
      body: {
        $push: {
          'body.items': {
            metaType: 'widget',
            type: '@apostrophecms/rich-text',
            content: 'This is <b>Bold</b>'
          }
        }
      },
      jar
    });
    page = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    assert(page.body.items[0]);
    assert(page.body.items[0].content.match(/<b>Bold<\/b>/));
  });

  it('Can use PATCH to update a widget by path', async () => {
    let page = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    page = await apos.http.patch('/api/v1/@apostrophecms/page/sibling', {
      body: {
        'body.items.0': {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: 'This is normal'
        }
      },
      jar
    });
    page = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    assert(page.body.items[0]);
    assert(page.body.items[0].content.match(/normal/));
  });

  it('Can use PATCH to update a widget via @ syntax', async () => {
    let page = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    const _id = `@${page.body.items[0]._id}`;
    page = await apos.http.patch('/api/v1/@apostrophecms/page/sibling', {
      body: {
        [_id]: {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: 'I @ syntax'
        }
      },
      jar
    });
    page = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    assert(page.body.items[0]);
    assert(page.body.items[0].content.match(/I @ syntax/));
  });

  it('Can use $position to insert a widget at the beginning of the area', async () => {
    let page = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    page = await apos.http.patch('/api/v1/@apostrophecms/page/sibling', {
      body: {
        $push: {
          'body.items': {
            $each: [
              {
                metaType: 'widget',
                type: '@apostrophecms/rich-text',
                content: 'Oh in the beginning'
              }
            ],
            $position: 0
          }
        }
      },
      jar
    });
    page = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    assert(page.body.items[0]);
    assert(page.body.items[0].content.match(/Oh in the beginning/));
    assert(page.body.items[1]);
    assert(page.body.items[1].content.match(/I @ syntax/));
    assert(!page.body.items[2]);
  });

  it('Can use $position to insert a widget in the middle of the area', async () => {
    let page = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    page = await apos.http.patch('/api/v1/@apostrophecms/page/sibling', {
      body: {
        $push: {
          'body.items': {
            $each: [
              {
                metaType: 'widget',
                type: '@apostrophecms/rich-text',
                content: 'Why don\'t you meet me in the middle'
              }
            ],
            $position: 1
          }
        }
      },
      jar
    });
    page = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    assert(page.body.items[0]);
    assert(page.body.items[0].content.match(/Oh in the beginning/));
    assert(page.body.items[1]);
    assert(page.body.items[1].content.match(/middle/));
    assert(page.body.items[2]);
    assert(page.body.items[2].content.match(/I @ syntax/));
    assert(!page.body.items[3]);
  });

  it('Can use $before to insert a widget in the middle of the area', async () => {
    let page = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    page = await apos.http.patch('/api/v1/@apostrophecms/page/sibling', {
      body: {
        $push: {
          'body.items': {
            $each: [
              {
                metaType: 'widget',
                type: '@apostrophecms/rich-text',
                content: 'before'
              }
            ],
            $before: page.body.items[1]._id
          }
        }
      },
      jar
    });
    page = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    assert(page.body.items[0]);
    assert(page.body.items[0].content.match(/Oh in the beginning/));
    assert(page.body.items[1]);
    assert(page.body.items[1].content.match(/before/));
    assert(page.body.items[2]);
    assert(page.body.items[2].content.match(/middle/));
    assert(page.body.items[3]);
    assert(page.body.items[3].content.match(/I @ syntax/));
    assert(!page.body.items[4]);
  });

  it('Can use $after to insert a widget in the middle of the area', async () => {
    let page = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    page = await apos.http.patch('/api/v1/@apostrophecms/page/sibling', {
      body: {
        $push: {
          'body.items': {
            $each: [
              {
                metaType: 'widget',
                type: '@apostrophecms/rich-text',
                content: 'after'
              }
            ],
            $after: page.body.items[0]._id
          }
        }
      },
      jar
    });
    page = await apos.http.get('/api/v1/@apostrophecms/page/sibling', { jar });
    assert(page.body.items[0]);
    assert(page.body.items[0].content.match(/Oh in the beginning/));
    assert(page.body.items[1]);
    assert(page.body.items[1].content.match(/after/));
    assert(page.body.items[2]);
    assert(page.body.items[2].content.match(/before/));
    assert(page.body.items[3]);
    assert(page.body.items[3].content.match(/middle/));
    assert(page.body.items[4]);
    assert(page.body.items[4].content.match(/I @ syntax/));
    assert(!page.body.items[5]);
  });

});
