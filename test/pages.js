const t = require('../test-lib/test.js');
const assert = require('assert');
const _ = require('lodash');
// const request = require('request');

let apos;
let homeId;

describe('Pages', function() {

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should be a property of the apos object', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        'apostrophe-express': {
          session: {
            secret: 'Adipiscing'
          },
          port: 7900
        },
        'apostrophe-pages': {
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
      }
    });

    assert(apos.pages.__meta.name === 'apostrophe-pages');
  });

  // SETUP

  it('should make sure all of the expected indexes are configured', async function() {
    const expectedIndexes = ['path'];
    const actualIndexes = [];

    const info = await apos.docs.db.indexInformation();

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
    const home = await apos.pages.find(apos.tasks.getAnonReq(), { level: 0 }).toObject();

    assert(home);
    homeId = home._id;
    assert(home.slug === '/');
    assert(home.path === '/');
    assert(home.type === 'home');
    assert(home.parked);
    assert(home.published);
  });

  it('parked trash can exists', async function() {
    const trash = await apos.pages.find(apos.tasks.getReq(), { slug: '/trash' }).published(null).trash(null).toObject();

    assert(trash);
    assert(trash.slug === '/trash');
    assert(trash.path === '/trash');
    assert(trash.type === 'trash');
    assert(trash.parked);
    assert(!trash.published);
    // Verify that clonePermanent did its
    // job and removed properties not meant
    // to be stored in mongodb
    assert(!trash._children);
  });

  it('should be able to use db to insert documents', async function() {
    const testItems = [
      { _id: '1234',
        type: 'testPage',
        slug: '/parent',
        published: true,
        path: '/parent',
        level: 1,
        rank: 0
      },
      {
        _id: '2341',
        type: 'testPage',
        slug: '/child',
        published: true,
        path: '/parent/child',
        level: 2,
        rank: 0
      },
      {
        _id: '4123',
        type: 'testPage',
        slug: '/grandchild',
        published: true,
        path: '/parent/child/grandchild',
        level: 3,
        rank: 0
      },
      {
        _id: '4321',
        type: 'testPage',
        slug: '/sibling',
        published: true,
        path: '/parent/sibling',
        level: 2,
        rank: 1

      },
      {
        _id: '4312',
        type: 'testPage',
        slug: '/cousin',
        published: true,
        path: '/parent/sibling/cousin',
        level: 3,
        rank: 0
      },
      {
        _id: '4333',
        type: 'testPage',
        slug: '/another-parent',
        published: true,
        path: '/another-parent',
        level: 1,
        rank: 0
      }
    ];

    const items = await apos.docs.db.insert(testItems);

    assert(items.result.ok === 1);
    assert(items.insertedCount === 6);
  });

  // FINDING

  it('should have a find method on pages that returns a cursor', async function() {
    const cursor = apos.pages.find(apos.tasks.getAnonReq());
    assert(cursor);
  });

  it('should be able to find the parked homepage', async function() {
    const cursor = apos.pages.find(apos.tasks.getAnonReq(), { slug: '/' });

    const page = await cursor.toObject();

    // There should be only 1 result.
    assert(page);
    // It should have a path of /
    assert(page.path === '/');
    assert(page.rank === 0);
  });

  it('should be able to find just a single page', async function() {
    const cursor = apos.pages.find(apos.tasks.getAnonReq(), { slug: '/child' });

    const page = await cursor.toObject();

    // There should be only 1 result.
    assert(page);
    // It should have a path of /parent/child
    assert(page.path === '/parent/child');
  });

  it('should be able to include the ancestors of a page', async function() {
    const cursor = apos.pages.find(apos.tasks.getAnonReq(), { slug: '/child' });

    const page = await cursor.ancestors(true).toObject();

    // There should be only 1 result.
    assert(page);
    // There should be 2 ancestors.
    assert(page._ancestors.length === 2);
    // The first ancestor should be the homepage
    assert.strictEqual(page._ancestors[0].path, '/');
    // The second ancestor should be 'parent'
    assert.strictEqual(page._ancestors[1].path, '/parent');
  });

  it('should be able to include just one ancestor of a page, i.e. the parent', async function() {
    const cursor = apos.pages.find(apos.tasks.getAnonReq(), { slug: '/child' });

    const page = await cursor.ancestors({ depth: 1 }).toObject();

    // There should be only 1 result.
    assert(page);
    // There should be 1 ancestor returned.
    assert(page._ancestors.length === 1);
    // The first ancestor returned should be 'parent'
    assert.strictEqual(page._ancestors[0].path, '/parent');
  });

  it('should be able to include the children of the ancestors of a page', async function() {
    const cursor = apos.pages.find(apos.tasks.getAnonReq(), { slug: '/child' });

    const page = await cursor.ancestors({ children: 1 }).toObject();

    // There should be only 1 result.
    assert(page);
    // There should be 2 ancestors.
    assert(page._ancestors.length === 2);
    // The second ancestor should have children
    assert(page._ancestors[1]._children);
    // The first ancestor's child should have a path '/parent/child'
    assert.strictEqual(page._ancestors[1]._children[0].path, '/parent/child');
    // The second ancestor's child should have a path '/parent/sibling'
    assert.strictEqual(page._ancestors[1]._children[1].path, '/parent/sibling');
  });

  // INSERTING

  it('is able to insert a new page', async function() {
    const parentId = '1234';

    const newPage = {
      slug: '/new-page',
      published: true,
      type: 'testPage',
      title: 'New Page'
    };

    const page = await apos.pages.insert(apos.tasks.getReq(), parentId, newPage);

    // Is the path generally correct?
    assert.strictEqual(page.path, '/parent/new-page');
  });

  it('is able to insert a new page in the correct order', async function() {
    const cursor = apos.pages.find(apos.tasks.getAnonReq(), {
      slug: '/new-page'
    });

    const page = await cursor.toObject();

    assert(page);
    assert.strictEqual(page.rank, 2);
  });

  // INSERTING

  it('is able to insert a new page with promises', async function() {
    const parentId = '1234';

    const newPage = {
      slug: '/new-page-2',
      published: true,
      type: 'testPage',
      title: 'New Page 2'
    };

    const page = await apos.pages.insert(apos.tasks.getReq(), parentId, newPage);

    assert.strictEqual(page.path, '/parent/new-page-2');
  });

  it('is able to insert a new page in the correct order with promises', async function() {
    const cursor = apos.pages.find(apos.tasks.getAnonReq(), {
      slug: '/new-page-2'
    });

    const page = await cursor.toObject();

    assert.strictEqual(page.rank, 3);
  });

  // MOVING

  it('is able to move root/parent/sibling/cousin after root/parent', async function() {
    // 'Cousin' _id === 4312
    // 'Parent' _id === 1234
    await apos.pages.move(apos.tasks.getReq(), '4312', '1234', 'after');

    const cursor = apos.pages.find(apos.tasks.getAnonReq(), { _id: '4312' });

    const page = await cursor.toObject();

    // Is the new path correct?
    assert.strictEqual(page.path, '/cousin');
    // Is the rank correct?
    assert.strictEqual(page.rank, 1);
  });

  // it('is able to move root/cousin before root/parent/child', function() {
  //   // 'Cousin' _id === 4312
  //   // 'Child' _id === 2341
  //   apos.pages.move(apos.tasks.getReq(), '4312', '2341', 'before', function(err) {
  //     if (err) {
  //       console.log(err);
  //     }
  //     assert(!err);
  //     const cursor = apos.pages.find(apos.tasks.getAnonReq(), { _id: '4312' });
  //     cursor.toObject(function(err, page) {
  //       if (err) {
  //         console.log(err);
  //       }
  //       assert(!err);
  //       // Is the new path correct?
  //       assert.strictEqual(page.path, '/parent/cousin');
  //       // Is the rank correct?
  //       assert.strictEqual(page.rank, 0);
  //       return done();
  //     });
  //   });
  // });

  // it('is able to move root/parent/cousin inside root/parent/sibling', function() {
  //   // 'Cousin' _id === 4312
  //   // 'Sibling' _id === 4321
  //   apos.pages.move(apos.tasks.getReq(), '4312', '4321', 'inside', function(err) {
  //     if (err) {
  //       console.log(err);
  //     }
  //     assert(!err);
  //     const cursor = apos.pages.find(apos.tasks.getAnonReq(), { _id: '4312' });
  //     cursor.toObject(function(err, page) {
  //       if (err) {
  //         console.log(err);
  //       }
  //       assert(!err);
  //       // Is the new path correct?
  //       assert.strictEqual(page.path, '/parent/sibling/cousin');
  //       // Is the rank correct?
  //       assert.strictEqual(page.rank, 0);
  //       return done();
  //     });
  //   });

  // });

  // it('moving /parent into /another-parent should also move /parent/sibling', function() {
  //   apos.pages.move(apos.tasks.getReq(), '1234', '4333', 'inside', function(err) {
  //     if (err) {
  //       console.log(err);
  //     }
  //     assert(!err);
  //     const cursor = apos.pages.find(apos.tasks.getAnonReq(), { _id: '4321' });
  //     cursor.toObject(function(err, page) {
  //       if (err) {
  //         console.log(err);
  //       }
  //       assert(!err);
  //       // Is the grandchild's path correct?
  //       assert.strictEqual(page.path, '/another-parent/parent/sibling');
  //       return done();
  //     });
  //   });

  // });

  // it('should be able to serve a page', function() {
  //   return request('http://localhost:7900/child', function(err, response, body) {
  //     assert(!err);
  //     // Is our status code good?
  //     assert.strictEqual(response.statusCode, 200);
  //     // Did we get our page back?
  //     assert(body.match(/Sing to me, Oh Muse./));
  //     // Does the response prove that data.home was available?
  //     assert(body.match(/Home: \//));
  //     // Does the response prove that data.home._children was available?
  //     assert(body.match(/Tab: \/another-parent/));
  //     // console.log(body);
  //     return done();
  //   });
  // });

  // it('should not be able to serve a nonexistent page', function() {
  //   return request('http://localhost:7900/nobodyschild', function(err, response, body) {
  //     assert(!err);
  //     // Is our status code good?
  //     assert.strictEqual(response.statusCode, 404);
  //     // Does the response prove that data.home was available?
  //     assert(body.match(/Home: \//));
  //     // Does the response prove that data.home._children was available?
  //     assert(body.match(/Tab: \/another-parent/));
  //     // console.log(body);
  //     return done();
  //   });
  // });

  // it('should detect that the home page is an ancestor of any page except itself', function() {
  //   assert(
  //     apos.pages.isAncestorOf({
  //       path: '/'
  //     }, {
  //       path: '/about'
  //     }
  //     )
  //   );
  //   assert(
  //     apos.pages.isAncestorOf({
  //       path: '/'
  //     }, {
  //       path: '/about/grandkid'
  //     }
  //     )
  //   );
  //   assert(!apos.pages.isAncestorOf({
  //     path: '/'
  //   }, {
  //     path: '/'
  //   }));
  // });

  // it('should detect a tab as the ancestor of its great grandchild but not someone else\'s', function() {
  //   assert(
  //     apos.pages.isAncestorOf({
  //       path: '/about'
  //     }, {
  //       path: '/about/test/thing'
  //     }
  //     )
  //   );

  //   assert(
  //     !apos.pages.isAncestorOf({
  //       path: '/about'
  //     }, {
  //       path: '/wiggy/test/thing'
  //     }
  //     )
  //   );

  // });

  // it('is able to move parent to the trash', function() {
  //   apos.pages.moveToTrash(apos.tasks.getReq(), '1234', function(err) {
  //     if (err) {
  //       console.error(err);
  //     }
  //     assert(!err);
  //     const cursor = apos.pages.find(apos.tasks.getAnonReq(), { _id: '1234' });
  //     cursor.toObject(function(err, page) {
  //       if (err) {
  //         console.log(err);
  //       }
  //       assert(!err);
  //       assert(!page);
  //       apos.pages.find(apos.tasks.getAnonReq(), { _id: '1234' })
  //         .permission(false).trash(null).toObject(function(err, page) {
  //           assert(!err);
  //           assert.strictEqual(page.path, '/trash/parent');
  //           assert(page.trash);
  //           assert.strictEqual(page.level, 2);
  //           return done();
  //         });
  //     });
  //   });
  // });

  // it('is able to insert a new page with the path attempting to follow the slug rather than the title', function() {
  //   const parentId = homeId;

  //   const newPage = {
  //     slug: '/newish-page',
  //     published: true,
  //     type: 'testPage',
  //     title: 'New Page'
  //   };
  //   apos.pages.insert(apos.tasks.getReq(), parentId, newPage, function(err, page) {
  //     // did it return an error?
  //     assert(!err);
  //     // Is the path based on the slug rather than the title?
  //     assert.strictEqual(page.path, '/newish-page');
  //     done();
  //   });
  // });

});
