const t = require('../test-lib/test.js');
const assert = require('assert');
const _ = require('lodash');

let apos;
let homeId;

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
            ]
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

  it('parked trash can exists', async function() {
    const trash = await apos.page.find(apos.task.getReq(), { slug: '/trash' }).trash(null).toObject();
    assert(trash);
    assert(trash.slug === '/trash');
    assert(trash.path === `${homeId.replace(':en:published', '')}/${trash._id.replace(':en:published', '')}`);
    assert(trash.type === '@apostrophecms/trash');
    assert(trash.parked);
    // Verify that clonePermanent did its
    // job and removed properties not meant
    // to be stored in mongodb
    assert(!trash._children);
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
        slug: '/child',
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
        slug: '/grandchild',
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
        slug: '/sibling',
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
        slug: '/cousin',
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
    const cursor = apos.page.find(apos.task.getAnonReq(), { slug: '/child' });

    const page = await cursor.toObject();

    // There should be only 1 result.
    assert(page);
    // It should have a path of /parent/child
    assert(page.path === `${homeId.replace(':en:published', '')}/parent/child`);
  });

  it('should be able to include the ancestors of a page', async function() {
    const cursor = apos.page.find(apos.task.getAnonReq(), { slug: '/child' });

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
    const cursor = apos.page.find(apos.task.getAnonReq(), { slug: '/child' });

    const page = await cursor.ancestors({ depth: 1 }).toObject();

    // There should be only 1 result.
    assert(page);
    // There should be 1 ancestor returned.
    assert(page._ancestors.length === 1);
    // The first ancestor returned should be 'parent'
    assert.strictEqual(page._ancestors[0].path, `${homeId.replace(':en:published', '')}/parent`);
  });

  it('should be able to include the children of the ancestors of a page', async function() {
    const cursor = apos.page.find(apos.task.getAnonReq(), { slug: '/child' });

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
      slug: '/new-page',
      visibility: 'public',
      type: 'test-page',
      title: 'New Page'
    };

    const page = await apos.page.insert(apos.task.getReq(), parentId, 'lastChild', newPage);

    // Is the path generally correct?
    assert.strictEqual(page.path, `${homeId.replace(':en:published', '')}/parent/${page._id.replace(':en:published', '')}`);
  });

  it('is able to insert a new page in the correct order', async function() {
    const cursor = apos.page.find(apos.task.getAnonReq(), {
      slug: '/new-page'
    });

    const page = await cursor.toObject();

    assert(page);
    assert.strictEqual(page.rank, 2);
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
    const response = await apos.http.get('/child', {
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

  it('is able to move parent to the trash', async function() {
    await apos.page.moveToTrash(apos.task.getReq(), 'parent:en:published');

    const cursor = apos.page.find(apos.task.getAnonReq(), { _id: 'parent' });
    const page = await cursor.toObject();

    assert(!page);

    const req = apos.task.getReq();
    const trash = await apos.page.findOneForEditing(req, { parkedId: 'trash' });
    const trashed = await apos.page.findOneForEditing(req, {
      _id: 'parent:en:published'
    });
    assert.strictEqual(trashed.path, `${homeId.replace(':en:published', '')}/${trash._id.replace(':en:published', '')}/${trashed._id.replace(':en:published', '')}`);
    assert(trashed.trash);
    assert.strictEqual(trashed.level, 2);
  });

  it('should be able to find the parked homepage', async function() {
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

});
