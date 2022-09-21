const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Widgets', function() {
  const getArgs = (req, page) => ({
    outerLayout: '@apostrophecms/template:outerLayout.html',
    permissions: req.user && (req.user._permissions || {}),
    scene: 'apos',
    refreshing: false,
    query: req.query,
    url: req.url,
    page
  });

  let apos;
  let req;
  let testItems;

  this.timeout(t.timeout);

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'args-bad-page': {},
        'args-good-page': {},
        'args-widget': {}
      }
    });
  });

  after(function() {
    return t.destroy(apos);
  });

  this.beforeEach(async function() {
    req = apos.task.getAnonReq();
    const home = await apos.page.find(apos.task.getAnonReq(), { level: 0 }).toObject();

    testItems = [
      {
        _id: 'goodPageId:en:published',
        aposLocale: 'en:published',
        aposDocId: 'goodPageId',
        type: 'args-good-page',
        slug: '/good-page',
        visibility: 'public',
        path: `${home._id.replace(':en:published', '')}/good-page`,
        level: 1,
        rank: 0,
        metaType: 'doc',
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
        path: `${home._id.replace(':en:published', '')}/bad-page`,
        level: 1,
        rank: 0,
        metaType: 'doc',
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
    await apos.doc.db.insertMany(testItems.map(item => ({
      ...item,
      aposLocale: item.aposLocale.replace(':published', ':draft'),
      _id: item._id.replace(':published', ':draft')
    })));
    await apos.doc.db.insertMany(testItems);
  });

  this.afterEach(async function() {
    await apos.doc.db.deleteMany({
      aposDocId: {
        $in: testItems.map(item => item.aposDocId)
      }
    });
  });

  it('should have added test modules', function() {
    assert(apos.modules['args-good-page']);
    assert(apos.modules['args-bad-page']);
    assert(apos.modules['args-widget']);
  });

  it('should be able to render page template with well constructed area tag', async function() {
    const goodPageDoc = await apos.page.find(req, { slug: '/good-page' }).toObject();

    const args = getArgs(req, goodPageDoc);
    const result = await apos.modules['args-good-page'].render(req, 'page', args);

    assert(result.includes('<h2>Good args page</h2>'));
    assert(result.includes('<p>You can control what happens when the text reaches the edges of its content area using its attributes.</p>'));
    assert(result.includes('<li>color: 🟣</li>'));
  });

  it('should error while trying to render page template with poorly constructed area tag', async function() {
    const badPageDoc = await apos.page.find(req, { slug: '/bad-page' }).toObject();

    const args = getArgs(req, badPageDoc);

    try {
      await apos.modules['args-bad-page'].render(req, 'page', args);

      assert(false);
    } catch (error) {
      assert(error.toString().includes('Too many arguments were passed'));
    }
  });
});
