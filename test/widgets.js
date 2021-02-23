const t = require('../test-lib/test.js');
const assert = require('assert');
// const cheerio = require('cheerio');

let apos;

describe('Widgets', function() {

  this.timeout(t.timeout);

  after(async () => {
    return t.destroy(apos);
  });

  it('should add test modules', async () => {
    apos = await t.create({
      root: module,
      modules: {
        'args-bad-page': {},
        'args-good-page': {},
        'args-widget': {}
      }
    });
    assert(apos.modules['args-good-page']);
    assert(apos.modules['args-bad-page']);
    assert(apos.modules['args-widget']);
  });

  let testItems;

  it('should insert test documents', async function() {
    const home = await apos.page.find(apos.task.getAnonReq(), { level: 0 }).toObject();

    assert(home);
    const homeId = home._id;

    testItems = [
      {
        _id: 'goodPageId:en:published',
        aposLocale: 'en:published',
        aposDocId: 'goodPageId',
        type: 'args-good-page',
        slug: '/good-page',
        visibility: 'public',
        path: `${homeId.replace(':en:published', '')}/good-page`,
        level: 1,
        rank: 0,
        main: {
          _id: 'randomAreaId1',
          items: [
            {
              _id: 'randomWidgetId1',
              snippet: 'You can control what happens when the text reaches the edges of its content area using its attributes.',
              metaType: 'widget',
              type: 'args'
            }
          ],
          metaType: 'area'
        }
      },
      {
        _id: 'badPageId:en:published',
        aposLocale: 'en:published',
        aposDocId: 'badPageId',
        type: 'args-bad-page',
        slug: '/bad-page',
        visibility: 'public',
        path: `${homeId.replace(':en:published', '')}/bad-page`,
        level: 1,
        rank: 0,
        main: {
          _id: 'randomAreaId2',
          items: [
            {
              _id: 'randomWidgetId2',
              snippet: 'You can control what happens when the text reaches the edges of its content area using its attributes.',
              metaType: 'widget',
              type: 'args'
            }
          ],
          metaType: 'area'
        }
      }
    ];

    // Insert draft versions too to match the A3 data model
    const draftItems = await apos.doc.db.insertMany(testItems.map(item => ({
      ...item,
      aposLocale: item.aposLocale.replace(':published', ':draft'),
      _id: item._id.replace(':published', ':draft')
    })));
    assert(draftItems.result.ok === 1);
    assert(draftItems.insertedCount === 2);

    const items = await apos.doc.db.insertMany(testItems);

    assert(items.result.ok === 1);
    assert(items.insertedCount === 2);
  });

  it('should be able to render page template with well constructed area tag', async function() {
    const req = apos.task.getAnonReq();

    const goodPage = await apos.page.find(req, { slug: '/good-page' }).toObject();
    goodPage.metaType = 'doc';

    const result = await apos.modules['args-good-page'].renderPage(req, 'page', { page: goodPage });

    assert(result.indexOf('<h2>Good args page</h2>') !== -1);
    assert(result.indexOf('<p>You can control what happens when the text reaches the edges of its content area using its attributes.</p>') !== -1);
    assert(result.indexOf('<li>color: 🟣</li>') !== -1);
  });

  it('should error while trying to render page template with poorly constructed area tag', async function() {
    const req = apos.task.getAnonReq();

    const goodPage = await apos.page.find(req, { slug: '/bad-page' }).toObject();
    goodPage.metaType = 'doc';

    try {
      await apos.modules['args-bad-page'].renderPage(req, 'page', { page: goodPage });
      assert(false);
    } catch (error) {
      assert(error);
    }
  });
});
