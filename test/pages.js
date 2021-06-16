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

  it('should redirect a page with a default status code when req.redirect is set', function (done) {
    const parentId = homeId;
    const newPage = {
      slug: '/redirect-default',
      published: true,
      type: 'redirect-to-home-page',
      title: 'Redirect to home page'
    };

    const req = apos.tasks.getReq();
    apos.pages.insert(req, parentId, newPage, function (err) {
      assert(!err, 'Could not create page "/redirect-default" for the test');
      request({
        url: 'http://localhost:7900/redirect-default',
        followRedirect: false
      }, function(err, response, body) {
        assert(!err);
        assert.equal(response.statusCode, 301);
        done();
      });
    });
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

describe('Pages with trashInSchema', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  // EXISTENCE

  it('should be a property of the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test2',

      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7901
        },
        'apostrophe-docs': {
          trashInSchema: true
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
      },
      afterInit: function(callback) {
        assert(apos.pages);
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      }
    });
  });

  it('should be able to use db to insert documents', function(done) {
    var testItems = [
      { _id: 'p1',
        type: 'testPage',
        slug: '/parent1',
        path: '/parent1',
        published: true,
        level: 1,
        rank: 0
      },
      {
        _id: 'p1c1',
        type: 'testPage',
        slug: '/parent1/child1',
        path: '/parent1/child1',
        published: true,
        level: 2,
        rank: 0
      },
      { _id: 'p2',
        type: 'testPage',
        slug: '/parent2',
        path: '/parent2',
        published: true,
        level: 1,
        rank: 0
      },
      {
        _id: 'p2c2',
        type: 'testPage',
        slug: '/parent2/child2',
        path: '/parent2/child2',
        published: true,
        level: 2,
        rank: 0,
        trash: true
      }
    ];

    apos.docs.db.insert(testItems, function(err) {
      assert(!err);
      done();
    });

  });

  // MOVING

  it('is able to move p2 inside p1', function(done) {
    // 'Cousin' _id === 4312
    // 'Parent' _id === 1234
    apos.pages.move(apos.tasks.getReq(), 'p2', 'p1', 'inside', function(err) {
      if (err) {
        console.log(err);
      }
      assert(!err);
      var cursor = apos.pages.find(apos.tasks.getAnonReq(), {_id: 'p2'});
      cursor.toObject(function(err, page) {
        if (err) {
          console.log(err);
        }
        assert(!err);
        // Is the new path correct?
        assert.equal(page.path, '/parent1/parent2');
        // Is the new level correct?
        assert.equal(page.level, 2);
        return done();
      });
    });

  });

  it('p2c2 is now grandchild of p1, but still in trash', function() {
    return Promise.try(function() {
      return apos.docs.db.findOne({ _id: 'p2c2' });
    }).then(function(p2c2) {
      assert(p2c2.level === 3);
      assert(p2c2.path === '/parent1/parent2/child2');
      assert(p2c2.trash);
    });
  });

  it('add permissions for a new group to the home page', function() {
    const req = apos.tasks.getReq();
    let group;
    return Promise.try(function() {
      return apos.groups.insert(req, {
        title: 'test',
        permissions: [ 'edit-page' ]
      });
    }).then(function(_group) {
      group = _group;
      return apos.docs.db.findOne({ slug: '/' });
    }).then(function(home) {
      home.editGroupsIds = [ group._id ];
      const update = Promise.promisify(apos.pages.update);
      return update(req, home, {});
    }).then(function() {
      return apos.docs.db.findOne({ slug: '/' });
    }).then(function(home) {
      assert(_.includes(home.docPermissions, 'edit-' + group._id));
    });
  });

  it('"apply to subpages": propagate group id to child pages', function() {
    const req = apos.tasks.getReq();
    let home;
    return Promise.try(function() {
      return apos.docs.db.findOne({ slug: '/' });
    }).then(function(_home) {
      home = _home;
      home.applyToSubpages = true;
      const update = Promise.promisify(apos.pages.update);
      return update(req, home, {});
    }).then(function() {
      return apos.docs.db.find({ slug: /^\//, trash: { $ne: true } }).toArray();
    }).then(function(pages) {
      assert(!_.find(pages, function(page) {
        return (!_.includes(page.docPermissions, 'edit-' + home.editGroupsIds[0]));
      }));
    });
  });
});
