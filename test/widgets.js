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

    req = apos.task.getAnonReq({
      query: {
        aposEdit: '1'
      }
    });

    const home = await apos.page.find(req, { level: 0 }).toObject();
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

      it('should not render the placeholders on preview mode', async function() {
        // eslint-disable-next-line no-unused-vars
        const { aposEdit, ...query } = req.query;
        const _nonEditingReq = {
          ...req,
          query
        };
        const args = getRenderArgs(_nonEditingReq, page);
        const _result = await apos.modules['placeholder-page'].render(_nonEditingReq, 'page', args);

        assert(!_result.includes('widget1'));
      });
    });

    const mediaWidgetTypeToAssertion = {
      image: {
        placeholderUrlOverride: '/modules/@apostrophecms/my-image-widget/placeholder.webp',
        assertAposPlaceholderTrue(document) {
          const imgNodes = document.querySelectorAll('img');
          assert(imgNodes.length === 1);
          assert(imgNodes[0].classList.contains('image-widget-placeholder'));
          assert(imgNodes[0].alt === 'Image placeholder');
          assert(imgNodes[0].src === '/apos-frontend/default/modules/@apostrophecms/image-widget/placeholder.jpg');
        },
        assertPreviewMode(document) {
          const imgNodes = document.querySelectorAll('img');

          assert(imgNodes.length === 0);
        },
        assertFalsyPlaceholderUrl(document) {
          const imgNodes = document.querySelectorAll('img');
          assert(imgNodes.length === 0);
        },
        assertPlaceholderUrlOverride(document) {
          const imgNodes = document.querySelectorAll('img');

          assert(imgNodes.length === 1);
          assert(imgNodes[0].classList.contains('image-widget-placeholder'));
          assert(imgNodes[0].alt === 'Image placeholder');
          assert(imgNodes[0].src === '/apos-frontend/default/modules/@apostrophecms/my-image-widget/placeholder.webp');
        }
      },
      video: {
        placeholderUrlOverride: 'https://vimeo.com/57946935',
        assertAposPlaceholderTrue(document) {
          const videoWrapperNodes = document.querySelectorAll('[data-apos-video-widget]');

          assert(videoWrapperNodes.length === 1);
          assert(videoWrapperNodes[0].dataset.aposVideoUrl === 'https://youtu.be/Q5UX9yexEyM');
        },
        assertPreviewMode(document) {
          const videoWrapperNodes = document.querySelectorAll('[data-apos-video-widget]');

          assert(videoWrapperNodes.length === 0);
        },
        assertFalsyPlaceholderUrl(document) {
          const videoWrapperNodes = document.querySelectorAll('[data-apos-video-widget]');

          assert(videoWrapperNodes.length === 0);
        },
        assertPlaceholderUrlOverride(document) {
          const videoWrapperNodes = document.querySelectorAll('[data-apos-video-widget]');

          assert(videoWrapperNodes.length === 1);
          assert(videoWrapperNodes[0].dataset.aposVideoUrl === 'https://vimeo.com/57946935');
        }
      }
    };

    Object.entries(mediaWidgetTypeToAssertion).forEach(([
      type,
      {
        placeholderUrlOverride,
        assertAposPlaceholderTrue,
        assertPreviewMode,
        assertFalsyPlaceholderUrl,
        assertPlaceholderUrlOverride
      }
    ]) => {
      describe(`${type} widget`, function() {
        const widgetBaseData = {
          metaType: 'widget',
          type: `@apostrophecms/${type}`
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

        it('should render the placeholder only when widget\'s `aposPlaceholder` doc field is `true`', function() {
          const { document } = new JSDOM(result).window;

          assertAposPlaceholderTrue(document);
        });

        it('should not render the placeholders on preview mode', async function() {
          // eslint-disable-next-line no-unused-vars
          const { aposEdit, ...query } = req.query;
          const _nonEditingReq = {
            ...req,
            query
          };
          const args = getRenderArgs(_nonEditingReq, page);
          const _result = await apos.modules['placeholder-page'].render(_nonEditingReq, 'page', args);

          const { document } = new JSDOM(_result).window;
          assertPreviewMode(document);
        });

        describe('placeholderUrl - falsy', function() {
          let _apos;
          let _page;
          let _result;

          before(async function() {
            // Recreate local apos instance with falsy `placeholderUrl` option set to widget module
            _apos = await t.create({
              root: module,
              modules: {
                'placeholder-page': {},
                [`@apostrophecms/${type}-widget`]: {
                  options: {
                    placeholderUrl: null,
                    placeholderImage: null
                  }
                }
              }
            });
            const _req = _apos.task.getAnonReq({
              query: {
                aposEdit: '1'
              }
            });

            const home = await _apos.page.find(_req, { level: 0 }).toObject();
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

          it('should not render the placeholder when widget\'s module `placeholderUrl` option is falsy', function() {
            const { document } = new JSDOM(_result).window;

            assertFalsyPlaceholderUrl(document);
          });
        });

        describe('placeholderUrl - override', function() {
          let _apos;
          let _page;
          let _result;

          before(async function() {
            // Recreate local apos instance with falsy `placeholderUrl` option set to widget module
            _apos = await t.create({
              root: module,
              modules: {
                'placeholder-page': {},
                [`@apostrophecms/${type}-widget`]: {
                  options: {
                    placeholderUrl: placeholderUrlOverride
                  }
                }
              }
            });
            const _req = _apos.task.getAnonReq({
              query: {
                aposEdit: '1'
              }
            });

            const home = await _apos.page.find(_req, { level: 0 }).toObject();
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

          it('should render the placeholder set to the widget\'s module `placeholderUrl` override', function() {
            const { document } = new JSDOM(_result).window;

            assertPlaceholderUrlOverride(document);
          });
        });
      });
    });
  });

});
