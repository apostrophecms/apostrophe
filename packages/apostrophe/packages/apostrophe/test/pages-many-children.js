const t = require('../test-lib/test.js');
const assert = require('assert/strict');

// Page ranks cross from one digit to two here, where a database that
// compares them as text would put 10 before 2
describe('pages - more than ten children', function () {
  this.timeout(t.timeout);

  let apos;
  let home;
  const titles = Array.from({ length: 12 }, (_, i) => `Child ${i + 1}`);

  after(async function () {
    await t.destroy(apos);
    apos = null;
  });

  before(async function () {
    apos = await t.create({
      root: module,
      modules: {
        'default-page': {
          extend: '@apostrophecms/page-type'
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
                name: 'default-page',
                label: 'Default'
              }
            ]
          }
        }
      }
    });

    const req = apos.task.getReq({ mode: 'draft' });
    home = await apos.page.find(req, { level: 0 }).toObject();
    for (const title of titles) {
      const draft = await apos.page.insert(req, home._id, 'lastChild', {
        type: 'default-page',
        title
      });
      await apos.page.publish(req, draft);
    }
  });

  // Every page directly under home in that mode, the archive included,
  // read without a database sort
  async function getPeers(mode) {
    const peers = await apos.doc.db.find({
      level: 1,
      slug: /^\//,
      aposMode: mode
    }).toArray();
    return peers.sort((a, b) => a.rank - b.rank);
  }

  function assertUniqueRanks(peers) {
    const ranks = peers.map(peer => peer.rank);
    assert.deepEqual(ranks, [ ...new Set(ranks) ]);
  }

  it('should list the children in rank order', async function () {
    for (const mode of [ 'draft', 'published' ]) {
      const req = apos.task.getReq({ mode });
      const page = await apos.page.find(req, { level: 0 }).children(true).toObject();
      assert.deepEqual(page._children.map(child => child.title), titles);
      assertUniqueRanks(await getPeers(mode));
    }
  });

  it('should insert a page between the last two children', async function () {
    const req = apos.task.getReq({ mode: 'draft' });
    const last = (await getPeers('draft')).find(peer => peer.title === 'Child 12');
    const draft = await apos.page.insert(req, last._id, 'before', {
      type: 'default-page',
      title: 'Inserted'
    });
    await apos.page.publish(req, draft);
    titles.splice(11, 0, 'Inserted');

    for (const mode of [ 'draft', 'published' ]) {
      const page = await apos.page
        .find(apos.task.getReq({ mode }), { level: 0 })
        .children(true)
        .toObject();
      assert.deepEqual(page._children.map(child => child.title), titles);
      assertUniqueRanks(await getPeers(mode));
    }
  });

  it('should move the first child to the end', async function () {
    const req = apos.task.getReq({ mode: 'draft' });
    const first = (await getPeers('draft')).find(peer => peer.title === 'Child 1');
    await apos.page.move(req, first._id, home._id, 'lastChild');
    const moved = await apos.page.find(req, { _id: first._id }).toObject();
    await apos.page.publish(req, moved);
    titles.push(titles.shift());

    for (const mode of [ 'draft', 'published' ]) {
      const page = await apos.page
        .find(apos.task.getReq({ mode }), { level: 0 })
        .children(true)
        .toObject();
      assert.deepEqual(page._children.map(child => child.title), titles);
      assertUniqueRanks(await getPeers(mode));
    }
  });
});
