const { createId } = require('@paralleldrive/cuid2');
const t = require('../test-lib/test.js');
const assert = require('assert');

const areaConfig = {
  '@apostrophecms/image': {},
  '@apostrophecms/video': {},
  '@apostrophecms/rich-text': {
    toolbar: [
      'styles',
      'bold',
      'italic',
      'strike',
      'link',
      'bullet_list',
      'ordered_list',
      'blockquote'
    ],
    styles: [
      {
        tag: 'p',
        label: 'Paragraph (P)'
      },
      {
        tag: 'h3',
        label: 'Heading 3 (H3)'
      },
      {
        tag: 'h4',
        label: 'Heading 4 (H4)'
      }
    ]
  }
};

describe('Pages REST', function() {

  let apos;
  let homeId;
  let jar;

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
        'two-column-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            label: 'Two Column'
          },
          fields: {
            add: {
              one: {
                type: 'area',
                contextual: true,
                options: {
                  widgets: areaConfig
                }
              },
              two: {
                type: 'area',
                contextual: true,
                options: {
                  widgets: areaConfig
                }
              }
            }
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
                    },
                    '@apostrophecms/image': {},
                    '@apostrophecms/video': {},
                    'two-column': {}
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

  it('should be able to insert test users', async function() {
    assert(apos.user.newInstance);
    const user = apos.user.newInstance();
    assert(user);

    user.title = 'admin';
    user.username = 'admin';
    user.password = 'admin';
    user.email = 'ad@min.com';
    user.role = 'admin';

    await apos.user.insert(apos.task.getReq(), user);

    const user2 = apos.user.newInstance();
    assert(user2);

    user2.title = 'admin2';
    user2.username = 'admin2';
    user2.password = 'admin2';
    user2.email = 'ad@min2.com';
    user2.role = 'admin';

    return apos.user.insert(apos.task.getReq(), user2);

  });

  it('REST: should be able to log in as admin', async function() {
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
        password: 'admin',
        session: true
      },
      jar
    });

    // Confirm login
    page = await apos.http.get('/', {
      jar
    });

    assert(page.match(/logged in/));
  });

  it('can GET the home page without session', async function() {
    const home = await apos.http.get('/api/v1/@apostrophecms/page', {});
    assert(home);
    assert(home.slug === '/');
    // make sure new style paths used
    assert(home.path !== '/');
    assert(`${home.path}:en:published` === home._id);
    assert(home.level === 0);
    homeId = home._id;
  });

  it('should be able to use db to insert documents', async function() {
    const lastPublishedAt = new Date();
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
        rank: 0,
        lastPublishedAt
      },
      {
        _id: 'child:en:published',
        aposLocale: 'en:published',
        aposDocId: 'child',
        slug: '/child',
        type: 'test-page',
        visibility: 'public',
        path: `${homeId.replace(':en:published', '')}/parent/child`,
        level: 2,
        rank: 0,
        lastPublishedAt
      },
      {
        _id: 'grandchild:en:published',
        aposLocale: 'en:published',
        aposDocId: 'grandchild',
        type: 'test-page',
        slug: '/grandchild',
        visibility: 'public',
        path: `${homeId.replace(':en:published', '')}/parent/child/grandchild`,
        level: 3,
        rank: 0,
        lastPublishedAt
      },
      {
        _id: 'sibling:en:published',
        aposLocale: 'en:published',
        aposDocId: 'sibling',
        type: 'test-page',
        slug: '/sibling',
        visibility: 'public',
        path: `${homeId.replace(':en:published', '')}/parent/sibling`,
        level: 2,
        rank: 1,
        lastPublishedAt
      },
      {
        _id: 'cousin:en:published',
        aposLocale: 'en:published',
        aposDocId: 'cousin',
        type: 'test-page',
        slug: '/cousin',
        visibility: 'public',
        path: `${homeId.replace(':en:published', '')}/parent/sibling/cousin`,
        level: 3,
        rank: 0,
        lastPublishedAt
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
        rank: 1,
        lastPublishedAt
      },
      {
        _id: 'neighbor:en:published',
        aposLocale: 'en:published',
        aposDocId: 'neighbor',
        type: 'test-page',
        slug: '/neighbor',
        visibility: 'public',
        path: `${homeId.replace(':en:published', '')}/neighbor`,
        level: 1,
        rank: 2,
        lastPublishedAt
      }
    ];

    // Insert draft versions too to match the A3 data model
    const draftItems = await apos.doc.db.insertMany(testItems.map(item => ({
      ...item,
      aposLocale: item.aposLocale.replace(':published', ':draft'),
      _id: item._id.replace(':published', ':draft')
    })));
    assert(draftItems.result.ok === 1);
    assert(draftItems.insertedCount === 7);

    // Change the rank of the archive pages to preserve the constraint that it
    // comes last
    await apos.doc.db.updateMany({
      type: '@apostrophecms/archive-page'
    }, {
      $set: {
        rank: 3
      }
    });

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
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/${page._id.replace(':en:published', '')}`);
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
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/${page._id.replace(':en:published', '')}`);
    const home = await apos.http.get('/api/v1/@apostrophecms/page?children=1', {
      jar
    });
    assert(home);
    assert(home._children);
    assert(home._children[1]);
    assert(home._children[1]._id === page._id);
  });

  let newPageId;
  it('is able to make a subpage of /parent with _position and _targetId', async function() {

    const body = {
      slug: '/new-page',
      visibility: 'public',
      type: 'test-page',
      title: 'New Page',
      _targetId: 'parent:en:published',
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
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/parent/${page._id.replace(':en:published', '')}`);
    assert.strictEqual(page.level, 2);
    assert.strictEqual(page.rank, 2);
  });

  it('cannot POST a page without a session', async function() {
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
    const page = await apos.http.get('/api/v1/@apostrophecms/page/child:en:published');

    assert(page);
    assert(page.path === `${homeId.replace(':en:published', '')}/parent/child`);
    // There should be 2 ancestors.
    assert(page._ancestors.length === 2);
    // The first ancestor should be the homepage
    assert.strictEqual(page._ancestors[0].path, `${homeId.replace(':en:published', '')}`);
    // The second ancestor should be 'parent'
    assert.strictEqual(page._ancestors[1].path, `${homeId.replace(':en:published', '')}/parent`);

    // There should be only 1 result.
    assert(page);
    // There should be 2 ancestors.
    assert(page._ancestors.length === 2);
  });

  it('should be able to find just a single page with children', async function() {
    const page = await apos.http.get('/api/v1/@apostrophecms/page/parent:en:published');

    assert(page);
    assert(page.path === `${homeId.replace(':en:published', '')}/parent`);
    // There should be 1 ancestor
    assert(page._ancestors.length === 1);
    // The first ancestor should be the homepage
    assert.strictEqual(page._ancestors[0].path, `${homeId.replace(':en:published', '')}`);

    // There should be children
    assert(page._children);
    assert(page._children.length === 3);
    assert(page._children[0]._id === 'child:en:published');
    assert(page._children[1]._id === 'sibling:en:published');
    assert(page._children[2].slug === '/new-page');
  });

  it('is able to move root/parent/sibling/cousin after root/parent', async function() {
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/cousin:en:published', {
      body: {
        _targetId: 'parent:en:published',
        _position: 'after'
      },
      jar
    });
    assert(page._id);
    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/cousin`);
    // Is the rank correct?
    const home = await apos.http.get('/api/v1/@apostrophecms/page', {});
    assert(home._children);
    assert(home._children[1]._id === 'cousin:en:published');
  });

  it('is able to move root/cousin before root/parent/child', async function() {
    // 'Cousin' _id === 4312
    // 'Child' _id === 2341
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/cousin:en:published', {
      body: {
        _targetId: 'child:en:published',
        _position: 'before'
      },
      jar
    });

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/parent/cousin`);
    // Is the rank correct?
    assert.strictEqual(page.rank, 0);
  });

  it('is able to move root/parent/child before root/parent/cousin using numerical position', async function() {
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/child:en:published', {
      body: {
        _targetId: 'parent:en:published',
        _position: 0
      },
      jar
    });

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/parent/child`);
    // Is the rank correct?
    assert.strictEqual(page.rank, 0);
  });

  it('is able to move root/parent/new-page between root/parent/cousin and root/parent/sibling using numerical position', async function() {
    const page = await apos.http.patch(`/api/v1/@apostrophecms/page/${newPageId}`, {
      body: {
        _targetId: 'parent:en:published',
        _position: 2
      },
      jar
    });
    const cousin = await apos.http.get('/api/v1/@apostrophecms/page/cousin:en:published', { jar });
    const sibling = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/parent/${newPageId.replace(':en:published', '')}`);
    // Is the rank correct?
    assert(page.rank > cousin.rank);
    assert(page.rank < sibling.rank);
  });

  it('is able to move root/neighbor as the last child of /root/parent using numerical position', async function() {
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/neighbor:en:published', {
      body: {
        _targetId: 'parent:en:published',
        _position: 4
      },
      jar
    });

    // `sibling` was previously the last child of `parent`.
    const sibling = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/parent/neighbor`);
    // Is the rank correct?
    assert(page.rank > sibling.rank);
  });

  it('allows positioning a page at its existing location (lastChild) using numerical position', async function() {
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/neighbor:en:published', {
      body: {
        _targetId: 'parent:en:published',
        _position: 4
      },
      jar
    });

    // `sibling` was previously the last child of `parent`.
    const sibling = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/parent/neighbor`);
    // Is the rank correct?
    assert(page.rank > sibling.rank);
  });
  it('is able to move root/parent/child/grandchild to the next-to-last position under `parent`', async function() {
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/grandchild:en:published', {
      body: {
        _targetId: 'parent:en:published',
        _position: 4
      },
      jar
    });

    // `sibling` was previously the next-to-last child of `parent`.
    const sibling = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    const neighbor = await apos.http.get('/api/v1/@apostrophecms/page/neighbor:en:published', { jar });

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/parent/grandchild`);
    // Is the rank correct?
    assert(page.rank > sibling.rank);
    assert(page.rank < neighbor.rank);
  });

  it('allows positioning a page at its existing location (4 of 5) using numerical position', async function() {
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/grandchild:en:published', {
      body: {
        _targetId: 'parent:en:published',
        _position: 4
      },
      jar
    });

    // `sibling` was previously the next-to-last child of `parent`.
    const sibling = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    const neighbor = await apos.http.get('/api/v1/@apostrophecms/page/neighbor:en:published', { jar });

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/parent/grandchild`);
    // Is the rank correct?
    assert(page.rank > sibling.rank);
    assert(page.rank < neighbor.rank);
  });
  it('is able to move root/parent/cousin inside root/parent/sibling', async function() {
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/cousin:en:published', {
      body: {
        _targetId: 'sibling:en:published',
        _position: 'firstChild'
      },
      jar
    });

    // Is the new path correct?
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/parent/sibling/cousin`);
    // Is the rank correct?
    assert.strictEqual(page.rank, 0);
  });

  it('moving /parent into /another-parent should also move /parent/sibling', async function() {
    await apos.http.patch('/api/v1/@apostrophecms/page/parent:en:published', {
      body: {
        _targetId: 'another-parent:en:published',
        _position: 'firstChild'
      },
      jar
    });
    const page = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });

    // Is the grandchild's path correct?
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/another-parent/parent/sibling`);
  });

  it('is able to make a subpage of the homepage at the last index with _position: lastChild', async function() {
    const body = {
      slug: '/third-new',
      visibility: 'public',
      type: 'test-page',
      title: 'Third New',
      _targetId: '_home',
      _position: 'lastChild'
    };

    const page = await apos.http.post('/api/v1/@apostrophecms/page', {
      body,
      jar
    });

    assert(page);
    assert(page.title === 'Third New');
    // Is the path generally correct?
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/${page._id.replace(':en:published', '')}`);
    const home = await apos.http.get('/api/v1/@apostrophecms/page?children=1', {
      jar
    });
    assert(home);
    assert(home._children);
    assert(home._children[3]._id === page._id);
  });

  it('can use PUT to modify a page', async function() {
    const page = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    assert(page);
    page.title = 'Changed Title';
    page.color = 'blue';
    await apos.http.put('/api/v1/@apostrophecms/page/sibling:en:published', {
      body: page,
      jar
    });
    const page2 = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    assert.strictEqual(page2.title, 'Changed Title');
    assert.strictEqual(page2.color, 'blue');
  });

  it('can use PATCH to modify one property of a page', async function() {
    const page = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    assert(page);
    page.title = 'Changed Title';
    await apos.http.patch('/api/v1/@apostrophecms/page/sibling:en:published', {
      body: {
        title: 'New Title'
      },
      jar
    });
    const page2 = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    assert.strictEqual(page2.title, 'New Title');
    // Did not modify this
    assert.strictEqual(page2.color, 'blue');
  });

  it('can use PATCH to move a page beneath the home page with _targetId: _home', async function() {
    const page = await apos.http.patch('/api/v1/@apostrophecms/page/cousin:en:published', {
      body: {
        _targetId: '_home',
        _position: 'firstChild'
      },
      jar
    });
    assert(page._id);
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/${page.aposDocId}`);
    assert.strictEqual(page.level, 1);
    assert.strictEqual(page.rank, 0);
  });

  it('can use PATCH to move a page into the archive using _archive as _targetId', async function() {
    let page = await apos.http.patch('/api/v1/@apostrophecms/page/cousin:en:published', {
      body: {
        _targetId: '_archive',
        _position: 'firstChild'
      },
      jar
    });
    assert(page._id);
    const archive = await apos.http.get('/api/v1/@apostrophecms/page/_archive?archived=1', {
      jar
    });
    assert(archive);
    // Verify this is really working because of the _archived
    // shortcut
    assert(archive._id !== '_archive');
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/${archive.aposDocId}/${page.aposDocId}`);
    assert.strictEqual(page.level, 2);
    assert.strictEqual(page.rank, 0);
    page = await apos.http.get('/api/v1/@apostrophecms/page/cousin:en:published?_edit=1&archived=1', {
      jar
    });
    assert(page.archived);
  });

  it('Can use PATCH to add a widget to an area by path', async function() {
    let page = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    page = await apos.http.patch('/api/v1/@apostrophecms/page/sibling:en:published', {
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
    page = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    assert(page.body.items[0]);
    assert(page.body.items[0].content.match(/<b>Bold<\/b>/));
  });

  it('Can use PATCH to update a widget by path', async function() {
    let page = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    page = await apos.http.patch('/api/v1/@apostrophecms/page/sibling:en:published', {
      body: {
        'body.items.0': {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: 'This is normal'
        }
      },
      jar
    });
    page = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    assert(page.body.items[0]);
    assert(page.body.items[0].content.match(/normal/));
  });

  it('Can use PATCH to update a widget via @ syntax', async function() {
    let page = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    const _id = `@${page.body.items[0]._id}`;
    page = await apos.http.patch('/api/v1/@apostrophecms/page/sibling:en:published', {
      body: {
        [_id]: {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: 'I @ syntax'
        }
      },
      jar
    });
    page = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    assert(page.body.items[0]);
    assert(page.body.items[0].content.match(/I @ syntax/));
  });

  it('Can use $position to insert a widget at the beginning of the area', async function() {
    let page = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    page = await apos.http.patch('/api/v1/@apostrophecms/page/sibling:en:published', {
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
    page = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    assert(page.body.items[0]);
    assert(page.body.items[0].content.match(/Oh in the beginning/));
    assert(page.body.items[1]);
    assert(page.body.items[1].content.match(/I @ syntax/));
    assert(!page.body.items[2]);
  });

  it('Can use $position to insert a widget in the middle of the area', async function() {
    let page = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    page = await apos.http.patch('/api/v1/@apostrophecms/page/sibling:en:published', {
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
    page = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    assert(page.body.items[0]);
    assert(page.body.items[0].content.match(/Oh in the beginning/));
    assert(page.body.items[1]);
    assert(page.body.items[1].content.match(/middle/));
    assert(page.body.items[2]);
    assert(page.body.items[2].content.match(/I @ syntax/));
    assert(!page.body.items[3]);
  });

  it('Can use $before to insert a widget in the middle of the area', async function() {
    let page = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    page = await apos.http.patch('/api/v1/@apostrophecms/page/sibling:en:published', {
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
    page = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
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

  it('Can use $after to insert a widget in the middle of the area', async function() {
    let page = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
    page = await apos.http.patch('/api/v1/@apostrophecms/page/sibling:en:published', {
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
    page = await apos.http.get('/api/v1/@apostrophecms/page/sibling:en:published', { jar });
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

  let advisoryLockTestId;

  it('can insert a page for advisory lock testing', async function() {
    const body = {
      slug: '/advisory-test',
      visibility: 'public',
      type: 'test-page',
      title: 'Advisory Test'
    };

    const page = await apos.http.post('/api/v1/@apostrophecms/page', {
      body,
      jar
    });

    assert(page);
    assert(page.title === 'Advisory Test');
    advisoryLockTestId = page._id;
  });

  it('can get an advisory lock on a page while patching a property', async function() {
    const page = await apos.http.patch(`/api/v1/@apostrophecms/page/${advisoryLockTestId}`, {
      jar,
      body: {
        _advisoryLock: {
          tabId: 'xyz',
          lock: true
        },
        title: 'Advisory Test Patched'
      }
    });
    assert(page.title === 'Advisory Test Patched');
  });

  it('cannot get an advisory lock with a different context id', async function() {
    try {
      await apos.http.patch(`/api/v1/@apostrophecms/page/${advisoryLockTestId}`, {
        jar,
        body: {
          _advisoryLock: {
            tabId: 'pdq',
            lock: true
          }
        }
      });
      assert(false);
    } catch (e) {
      assert(e.status === 409);
      assert(e.body.name === 'locked');
      assert(e.body.data.me);
    }
  });

  it('can get an advisory lock with a different context id if forcing', async function() {
    await apos.http.patch(`/api/v1/@apostrophecms/page/${advisoryLockTestId}`, {
      jar,
      body: {
        _advisoryLock: {
          tabId: 'pdq',
          lock: true,
          force: true
        }
      }
    });
  });

  it('can renew the advisory lock with the second context id after forcing', async function() {
    await apos.http.patch(`/api/v1/@apostrophecms/page/${advisoryLockTestId}`, {
      jar,
      body: {
        _advisoryLock: {
          tabId: 'pdq',
          lock: true
        }
      }
    });
  });

  it('can unlock the advisory lock while patching a property', async function() {
    const page = await apos.http.patch(`/api/v1/@apostrophecms/page/${advisoryLockTestId}`, {
      jar,
      body: {
        _advisoryLock: {
          tabId: 'pdq',
          lock: false
        },
        title: 'Advisory Test Patched Again'
      }
    });
    assert(page.title === 'Advisory Test Patched Again');
  });

  it('can relock with the first context id after unlocking', async function() {
    const doc = await apos.http.patch(`/api/v1/@apostrophecms/page/${advisoryLockTestId}`, {
      jar,
      body: {
        _advisoryLock: {
          tabId: 'xyz',
          lock: true
        }
      }
    });
    assert(doc.title === 'Advisory Test Patched Again');
  });

  let diacriticsId;
  it('is able to make a page including diacritics', async function() {
    const body = {
      slug: '/ḑiaçritiçs-čharaćters',
      visibility: 'public',
      type: 'test-page',
      title: 'Ḑiaçritiçs Čharaćters',
      _targetId: '_home',
      _position: '1'
    };

    const page = await apos.http.post('/api/v1/@apostrophecms/page', {
      body,
      jar
    });

    assert(page);
    assert(page.title === 'Ḑiaçritiçs Čharaćters');
    diacriticsId = page._id;
    // Accesses the published page.
    const published = await apos.http.get('/ḑiaçritiçs-čharaćters');
    assert(published);
  });

  it('can archive the diacritics page then access the draft preview', async function () {
    // Now only a draft preview will be available.
    await apos.page.archive(apos.task.getReq(), diacriticsId);

    try {
      const rendered = await apos.http.get('/ḑiaçritiçs-čharaćters', {
        jar
      });
      assert(rendered.match(/Sing to me, Oh Muse\./));
    } catch (error) {
      assert(false);
    }
  });

  let jar2;

  it('should be able to log in as second user', async function() {
    jar2 = apos.http.jar();

    // establish session
    let page = await apos.http.get('/', {
      jar: jar2
    });

    assert(page.match(/logged out/));

    // Log in

    await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'admin2',
        password: 'admin2',
        session: true
      },
      jar: jar2
    });

    // Confirm login
    page = await apos.http.get('/', {
      jar: jar2
    });

    assert(page.match(/logged in/));
  });

  it('second user with a distinct tabId gets an appropriate error specifying who has the lock', async function() {
    try {
      await apos.http.patch(`/api/v1/@apostrophecms/page/${advisoryLockTestId}`, {
        jar: jar2,
        body: {
          _advisoryLock: {
            tabId: 'nbc',
            lock: true
          }
        }
      });
      assert(false);
    } catch (e) {
      assert(e.status === 409);
      assert(e.body.name === 'locked');
      assert(!e.body.data.me);
      assert(e.body.data.username === 'admin');
    }
  });

  it('can insert a test-page with _newInstance and additional properties', async function() {
    const newInstance = await apos.http.post('/api/v1/@apostrophecms/page', {
      body: {
        _newInstance: true,
        slug: '/page-01',
        type: 'test-page',
        title: 'Page 01'
      },
      jar
    });
    const inserted = await apos.http.post('/api/v1/@apostrophecms/page', {
      body: {
        ...newInstance,
        body: {
          metaType: 'area',
          items: [
            {
              metaType: 'widget',
              type: '@apostrophecms/rich-text',
              id: createId(),
              content: '<p>This is the product key product with relationship</p>'
            }
          ]
        }
      },
      jar
    });

    const actual = {
      newInstance,
      inserted
    };
    const expected = {
      newInstance: {
        _previewable: true,
        orphan: false,
        slug: '/page-01',
        title: 'Page 01',
        type: 'test-page',
        visibility: 'public'
      },
      inserted: {
        _ancestors: inserted._ancestors,
        _create: true,
        _delete: true,
        _edit: true,
        _id: inserted._id,
        _publish: true,
        _url: '/page-01',
        aposDocId: inserted.aposDocId,
        aposLocale: 'en:published',
        aposMode: 'published',
        archived: false,
        body: {
          _docId: inserted.body._docId,
          _edit: true,
          _id: inserted.body._id,
          items: [
            {
              _docId: inserted.body.items.at(0)._docId,
              _edit: true,
              _id: inserted.body.items.at(0)._id,
              aposPlaceholder: false,
              content: '<p>This is the product key product with relationship</p>',
              imageIds: [],
              metaType: 'widget',
              permalinkIds: [],
              type: '@apostrophecms/rich-text'
            }
          ],
          metaType: 'area'
        },
        cacheInvalidatedAt: inserted.cacheInvalidatedAt,
        color: '',
        createdAt: inserted.createdAt,
        highSearchText: inserted.highSearchText,
        highSearchWords: inserted.highSearchWords,
        lastPublishedAt: inserted.lastPublishedAt,
        level: 1,
        lowSearchText: inserted.lowSearchText,
        metaType: 'doc',
        orphan: false,
        path: inserted.path,
        rank: inserted.rank,
        searchSummary: inserted.searchSummary,
        slug: '/page-01',
        title: 'Page 01',
        titleSortified: inserted.titleSortified,
        type: 'test-page',
        updatedAt: inserted.updatedAt,
        updatedBy: {
          _id: inserted.updatedBy._id,
          title: 'admin',
          username: 'admin'
        },
        visibility: 'public'
      }
    };

    assert.deepEqual(actual, expected);
  });
});
