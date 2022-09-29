const t = require('../test-lib/test.js');
const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Widgets', function() {
  const getRenderArgs = (req, page) => ({
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
  let homePath;

  this.timeout(t.timeout);

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'args-bad-page': {},
        'args-good-page': {},
        'args-widget': {},
        'placeholder-page': {},
        'placeholder-widget': {}
      }
    });

    req = apos.task.getAnonReq();

    const home = await apos.page.find(apos.task.getAnonReq(), { level: 0 }).toObject();
    homePath = home._id.replace(':en:published', '');
  });

  after(function() {
    return t.destroy(apos);
  });

  describe('area tag', function() {
    let testItems = [];

    before(async function() {
      testItems = [
        {
          _id: 'goodPageId:en:published',
          aposLocale: 'en:published',
          aposDocId: 'goodPageId',
          type: 'args-good-page',
          slug: '/good-page',
          visibility: 'public',
          path: `${homePath}/good-page`,
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
          path: `${homePath}/bad-page`,
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

      await apos.doc.db.insertMany(testItems.map(item => ({
        ...item,
        aposLocale: item.aposLocale.replace(':published', ':draft'),
        _id: item._id.replace(':published', ':draft')
      })));

      await apos.doc.db.insertMany(testItems);
    });

    after(async function() {
      await apos.doc.db.deleteMany({
        aposDocId: {
          $in: testItems.map(item => item.aposDocId)
        }
      });
    });

    it('should be able to render page template with well constructed area tag', async function() {
      const goodPageDoc = await apos.page.find(req, { slug: '/good-page' }).toObject();

      const args = getRenderArgs(req, goodPageDoc);
      const result = await apos.modules['args-good-page'].render(req, 'page', args);

      assert(result.includes('<h2>Good args page</h2>'));
      assert(result.includes('<p>You can control what happens when the text reaches the edges of its content area using its attributes.</p>'));
      assert(result.includes('<li>color: 🟣</li>'));
    });

    it('should error while trying to render page template with poorly constructed area tag', async function() {
      const badPageDoc = await apos.page.find(req, { slug: '/bad-page' }).toObject();

      const args = getRenderArgs(req, badPageDoc);

      try {
        await apos.modules['args-bad-page'].render(req, 'page', args);

        assert(false);
      } catch (error) {
        assert(error.toString().includes('Too many arguments were passed'));
      }
    });
  });

  describe('placeholders', function() {
    const insertPage = async (apos, homePath, widgets) => {
      const page = {
        _id: 'placeholder-page:en:published',
        aposLocale: 'en:published',
        aposDocId: 'placeholder-page',
        type: 'placeholder-page',
        slug: '/placeholder-page',
        visibility: 'public',
        path: `${homePath}/placeholder-page`,
        level: 1,
        rank: 0,
        metaType: 'doc',
        main: {
          _id: 'area1',
          items: widgets,
          metaType: 'area'
        }
      };

      await apos.doc.db.insertOne(page);
      await apos.doc.db.insertOne({
        ...page,
        aposLocale: page.aposLocale.replace(':published', ':draft'),
        _id: page._id.replace(':published', ':draft')
      });
    };

    const deletePage = async (apos, page) => {
      await apos.doc.db.deleteMany({
        aposDocId: page.aposDocId
      });
    };

    describe('custom widget', function() {
      const widgetBaseData = {
        metaType: 'widget',
        type: 'placeholder'
      };
      const widgetData = {
        ...widgetBaseData,
        string: 'Some string',
        integer: 2,
        float: 2.2,
        date: '2022-09-21',
        time: '15:39:12'
      };

      let page;
      let result;

      before(async function() {
        const widgets = [
          {
            _id: 'widget1',
            ...widgetBaseData,
            aposPlaceholder: true
          },
          {
            _id: 'widget2',
            ...widgetBaseData,
            aposPlaceholder: false
          },
          {
            _id: 'widget3',
            ...widgetBaseData
          },
          {
            _id: 'widget4',
            ...widgetData
          },
          {
            _id: 'widget5',
            ...widgetData,
            aposPlaceholder: true
          }
        ];

        await insertPage(apos, homePath, widgets);
        page = await apos.page.find(req, { slug: '/placeholder-page' }).toObject();

        const args = getRenderArgs(req, page);
        result = await apos.modules['placeholder-page'].render(req, 'page', args);
      });

      after(async function() {
        await deletePage(apos, page);
      });

      it('should render the placeholders when widget\'s `aposPlaceholder` doc field is `true`', function() {
        assert(result.includes('<li>widget1 - aposPlaceholder: true</li>'));
        assert(result.includes('<li>widget1 - string: String PLACEHOLDER</li>'));
        assert(result.includes('<li>widget1 - integer: 0</li>'));
        assert(result.includes('<li>widget1 - float: 0.1</li>'));
        assert(result.includes('<li>widget1 - date: YYYY-MM-DD</li>'));
        assert(result.includes('<li>widget1 - time: HH:MM:SS</li>'));
      });

      it('should not render the placeholders when widget\'s `aposPlaceholder` doc field is `false`', function() {
        assert(result.includes('<li>widget2 - aposPlaceholder: false</li>'));
        assert(!result.includes('<li>widget2 - string: String PLACEHOLDER</li>'));
        assert(!result.includes('<li>widget2 - integer: 0</li>'));
        assert(!result.includes('<li>widget2 - float: 0.1</li>'));
        assert(!result.includes('<li>widget2 - date: YYYY-MM-DD</li>'));
        assert(!result.includes('<li>widget2 - time: HH:MM:SS</li>'));
      });

      it('should not render the placeholders when widget\'s `aposPlaceholder` doc field is not defined', function() {
        assert(!result.includes('<li>widget3 - string: String PLACEHOLDER</li>'));
        assert(!result.includes('<li>widget3 - integer: 0</li>'));
        assert(!result.includes('<li>widget3 - float: 0.1</li>'));
        assert(!result.includes('<li>widget3 - date: YYYY-MM-DD</li>'));
        assert(!result.includes('<li>widget3 - time: HH:MM:SS</li>'));

        assert(result.includes('<li>widget4 - string: Some string</li>'));
        assert(result.includes('<li>widget4 - integer: 2</li>'));
        assert(result.includes('<li>widget4 - float: 2.2</li>'));
        assert(result.includes('<li>widget4 - date: 2022-09-21</li>'));
        assert(result.includes('<li>widget4 - time: 15:39:12</li>'));
      });

      it('should not render the placeholders when widget\'s fields are defined', function() {
        assert(result.includes('<li>widget5 - string: Some string</li>'));
        assert(result.includes('<li>widget5 - integer: 2</li>'));
        assert(result.includes('<li>widget5 - float: 2.2</li>'));
        assert(result.includes('<li>widget5 - date: 2022-09-21</li>'));
        assert(result.includes('<li>widget5 - time: 15:39:12</li>'));
      });
    });

    describe('image widget', function() {
      const widgetBaseData = {
        metaType: 'widget',
        type: '@apostrophecms/image'
      };
      const widgets = [
        {
          _id: 'widget1',
          ...widgetBaseData,
          aposPlaceholder: true
        },
        {
          _id: 'widget2',
          ...widgetBaseData,
          aposPlaceholder: false
        },
        {
          _id: 'widget3',
          ...widgetBaseData
        }
      ];

      let page;
      let result;

      before(async function() {
        await insertPage(apos, homePath, widgets);
        page = await apos.page.find(req, { slug: '/placeholder-page' }).toObject();

        const args = getRenderArgs(req, page);
        result = await apos.modules['placeholder-page'].render(req, 'page', args);
      });

      after(async function() {
        await deletePage(apos, page);
      });

      it('should render the image placeholder only when widget\'s `aposPlaceholder` doc field is `true`', function() {
        const { document } = new JSDOM(result).window;
        const imgNodes = document.querySelectorAll('img');

        assert(imgNodes.length === 1);
        assert(imgNodes[0].classList.contains('image-widget-placeholder'));
        assert(imgNodes[0].alt === 'Image placeholder');
        assert(imgNodes[0].src === '/apos-frontend/default/modules/@apostrophecms/image-widget/placeholder.jpg');
      });

      describe('image widget - other module option', function() {
        let _apos;
        let _page;
        let _result;

        before(async function() {
          // Recreate local apos instance with falsy `placeholderUrl` option set to image widget module
          _apos = await t.create({
            root: module,
            modules: {
              'placeholder-page': {},
              '@apostrophecms/image-widget': {
                options: {
                  placeholderUrl: null
                }
              }
            }
          });
          const _req = _apos.task.getAnonReq();

          const home = await _apos.page.find(_apos.task.getAnonReq(), { level: 0 }).toObject();
          const _homePath = home._id.replace(':en:published', '');

          await insertPage(_apos, _homePath, widgets);
          _page = await _apos.page.find(_req, { slug: '/placeholder-page' }).toObject();

          const args = getRenderArgs(_req, _page);
          _result = await _apos.modules['placeholder-page'].render(_req, 'page', args);
        });

        after(async function() {
          await deletePage(_apos, _page);
          await t.destroy(_apos);
        });

        it('should not render the image placeholder when widget\'s module `placeholderUrl` option is falsy', function() {
          const { document } = new JSDOM(_result).window;
          const imgNodes = document.querySelectorAll('img');

          assert(imgNodes.length === 0);
        });
      });
    });

    describe('video widget', function() {
      const widgetBaseData = {
        metaType: 'widget',
        type: '@apostrophecms/video'
      };
      const widgets = [
        {
          _id: 'widget1',
          ...widgetBaseData,
          aposPlaceholder: true
        },
        {
          _id: 'widget2',
          ...widgetBaseData,
          aposPlaceholder: false
        },
        {
          _id: 'widget3',
          ...widgetBaseData
        }
      ];

      let page;
      let result;

      before(async function() {
        await insertPage(apos, homePath, widgets);
        page = await apos.page.find(req, { slug: '/placeholder-page' }).toObject();

        const args = getRenderArgs(req, page);
        result = await apos.modules['placeholder-page'].render(req, 'page', args);
      });

      after(async function() {
        await deletePage(apos, page);
      });

      it('should render the video placeholder only when widget\'s `aposPlaceholder` doc field is `true`', function() {
        const { document } = new JSDOM(result).window;
        const videoWrapperNodes = document.querySelectorAll('[data-apos-video-widget]');

        assert(videoWrapperNodes.length === 1);
        assert(videoWrapperNodes[0].dataset.aposVideoUrl === 'https://youtu.be/Q5UX9yexEyM');
      });

      describe('video widget - other module option', function() {
        let _apos;
        let _page;
        let _result;

        before(async function() {
          // Recreate local apos instance with falsy `placeholderUrl` option set to video widget module
          _apos = await t.create({
            root: module,
            modules: {
              'placeholder-page': {},
              '@apostrophecms/video-widget': {
                options: {
                  placeholderUrl: null
                }
              }
            }
          });
          const _req = _apos.task.getAnonReq();

          const home = await _apos.page.find(_apos.task.getAnonReq(), { level: 0 }).toObject();
          const _homePath = home._id.replace(':en:published', '');

          await insertPage(_apos, _homePath, widgets);
          _page = await _apos.page.find(_req, { slug: '/placeholder-page' }).toObject();

          const args = getRenderArgs(_req, _page);
          _result = await _apos.modules['placeholder-page'].render(_req, 'page', args);
        });

        after(async function() {
          await deletePage(_apos, _page);
          await t.destroy(_apos);
        });

        it('should not render the video placeholder when widget\'s module `placeholderUrl` option is falsy', function() {
          const { document } = new JSDOM(_result).window;
          const videoWrapperNodes = document.querySelectorAll('[data-apos-video-widget]');

          assert(videoWrapperNodes.length === 0);
        });
      });
    });
  });
});
