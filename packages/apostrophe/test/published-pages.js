const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Pages', function() {

  let apos;

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

  it('inserting child pages with a published req should produce the correct draft/published pairs', async function() {
    const req = apos.task.getAdminReq();
    const manager = apos.doc.getManager('test-page');

    for (let i = 1; (i <= 10); i++) {
      const page = manager.newInstance();
      page.title = `test-child-${i}`;
      page.type = 'test-page';
      const { _id } = await apos.page.insert(req, '_home', 'lastChild', page, {});
      const fetchedPage = await apos.page.find(req, { _id }).toObject();
      assert.strictEqual(fetchedPage.aposMode, 'published');
      assert(fetchedPage);
      const draftReq = req.clone({
        mode: 'draft'
      });
      const draft = await apos.page.find(draftReq, {
        aposDocId: fetchedPage.aposDocId
      }).toObject();
      assert(draft);
      assert.strictEqual(draft.aposMode, 'draft');
      assert(draft.level === fetchedPage.level);
      assert(draft.lastPublishedAt);
      assert(fetchedPage.lastPublishedAt);
      assert(draft.lastPublishedAt.getTime() === fetchedPage.lastPublishedAt.getTime());
    }
    assert(checkRanks('en:published'));
    assert(checkRanks('en:draft'));
  });

  it('Can fix the ranks after intentionally messing them up', async function() {
    for (let i = 5; (i <= 10); i++) {
      await apos.doc.db.updateMany({
        title: `test-child-${i}`
      }, {
        $set: {
          rank: i - 2
        }
      });
    }
    try {
      await checkRanks('en:published');
      assert(false);
    } catch (e) {
      // Good, supposed to fail
    }
    try {
      await checkRanks('en:draft');
      assert(false);
    } catch (e) {
      // Good, supposed to fail
    }
    await apos.page.deduplicateRanks2Migration();
    await checkRanks('en:published');
    await checkRanks('en:draft');
  });

  it('Can fix lastPublishedAt after intentionally messing it up', async function() {
    let published = await apos.doc.db.findOne({
      aposLocale: 'en:published',
      slug: '/test-child-1'
    });
    assert(published.lastPublishedAt);
    await apos.doc.db.updateOne({
      _id: published._id
    }, {
      $unset: {
        lastPublishedAt: 1
      }
    });
    published = await apos.doc.db.findOne({
      aposLocale: 'en:published',
      slug: '/test-child-1'
    });
    assert(!published.lastPublishedAt);
    await apos.page.missingLastPublishedAtMigration();
    published = await apos.doc.db.findOne({
      aposLocale: 'en:published',
      slug: '/test-child-1'
    });
    assert(published.lastPublishedAt);
  });

  async function checkRanks(aposLocale) {
    const pages = await apos.doc.db.find({
      level: 1,
      aposLocale
    }).project({
      slug: 1,
      rank: 1,
      title: 1
    }).toArray();
    for (let i = 1; (i <= 10); i++) {
      assert(pages.find(page => (page.rank === i - 1) && page.title === `test-child-${i}`));
    }
    assert(pages.find(page => (page.slug === '/archive') && (page.rank === 10)));
  }
});
