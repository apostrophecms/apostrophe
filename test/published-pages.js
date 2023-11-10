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

  it('inserting child pages with a published req should produce the correct draft/published pairs', async function() {
    const req = apos.task.getAdminReq();
    const manager = apos.doc.getManager('test-page');

    for (let i = 1; (i <= 10); i++) {
      const page = manager.newInstance();
      page.title = `test-child-${i}`;
      page.type = 'test-page';
      const { _id } = await apos.page.insert(req, '_home', 'lastChild', page, {});
      const fetchedPage = await apos.page.find(req, { _id }).toObject();
      assert(fetchedPage);
      const draftReq = req.clone({
        mode: 'draft'
      });
      const draft = await apos.page.find(draftReq, {
        aposDocId: fetchedPage.aposDocId
      }).toObject();
      assert(draft);
      assert(draft.level === fetchedPage.level);
      assert(draft.lastPublishedAt);
      assert(fetchedPage.lastPublishedAt);
      assert(draft.lastPublishedAt.getTime() === fetchedPage.lastPublishedAt.getTime());
    }
    const publishedPages = await apos.doc.db.find({
      level: 1,
      aposLocale: 'en:published'
    }).project({
      slug: 1,
      rank: 1
    }).toArray();
    const draftPages = await apos.doc.db.find({
      level: 1,
      aposLocale: 'en:draft'
    }).project({
      slug: 1,
      rank: 1
    }).toArray();
    for (let i = 1; (i <= 10); i++) {
      assert(draftPages.find(page => (page.rank === i - 1) && page.title === `test-child-${i}`));
      assert(publishedPages.find(page => (page.rank === i - 1) && page.title === `test-child-${i}`));
    }
    assert(draftPages.find(page => (page.slug === '/archive') && (page.rank === 10)));
    assert(publishedPages.find(page => (page.slug === '/archive') && (page.rank === 10)));
  });
});