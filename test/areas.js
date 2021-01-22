const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;

describe('Areas', function() {

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should initialize', async function() {
    apos = await t.create({
      root: module,

      modules: {
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'articles',
            name: 'article',
            label: 'Article'
          },
          fields: {
            add: {
              main: {
                type: 'area',
                label: 'Main area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {
                      toolbar: [ 'bold' ],
                      styles: [
                        {
                          tag: 'p',
                          label: 'Paragraph'
                        }
                      ]
                    },
                    '@apostrophecms/html': {}
                  }
                }
              },
              moreAreas: {
                type: 'array',
                label: 'Some more areas',
                fields: {
                  add: {
                    someWidgets: {
                      type: 'area',
                      label: 'Some widgets in the area',
                      options: {
                        widgets: {
                          '@apostrophecms/html': {}
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    assert(apos.modules['@apostrophecms/area']);
    assert(apos.area);
    // In tests this will be the name of the test file,
    // so override that in order to get apostrophe to
    // listen normally and not try to run a task. -Tom
    apos.argv._ = [];
  });

  it('returns the rich text of an area via the richText method', function() {
    assert(apos.area.richText({
      metaType: 'area',
      items: [
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>So cool</h2>'
        },
        {
          metaType: 'widget',
          type: 'something-else',
          content: '<h3>Do not return me</h3>'
        },
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>Something else cool</h2>'
        }
      ]
    }) === '<h2>So cool</h2>\n<h2>Something else cool</h2>');
    assert(apos.area.richText({
      metaType: 'area',
      items: [
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>So cool</h2>'
        },
        {
          metaType: 'widget',
          type: 'something-else',
          content: '<h3>Do not return me</h3>'
        },
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>Something else cool</h2>'
        }
      ]
    }, { delimiter: '' }) === '<h2>So cool</h2><h2>Something else cool</h2>');
    assert(apos.area.richText({
      metaType: 'area',
      items: [
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>So cool</h2>'
        },
        {
          metaType: 'widget',
          type: 'something-else',
          content: '<h3>Do not return me</h3>'
        },
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>Something else cool</h2>'
        }
      ]
    }, { wrapper: 'div' }) === '<div><h2>So cool</h2></div><div><h2>Something else cool</h2></div>');
  });

  it('returns the plaintext of an area via the plaintext method', function() {
    assert.strictEqual(apos.area.plaintext({
      metaType: 'area',
      items: [
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>So cool</h2>'
        },
        {
          metaType: 'widget',
          type: 'something-else',
          content: '<h3>Do not return me</h3>'
        },
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>Something else cool</h2>'
        }
      ]
    }), 'So cool\nSomething else cool');
    assert.strictEqual(apos.area.plaintext({
      metaType: 'area',
      items: [
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>So cool</h2>'
        },
        {
          metaType: 'widget',
          type: 'something-else',
          content: '<h3>Do not return me</h3>'
        },
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>Something else cool</h2>'
        }
      ]
    }, { limit: 15 }), 'So cool...');
  });

  it('can populate an area object with required properties using the prepForRender method', async function () {
    apos.area.prepForRender(rteArea, areaDocs[0], 'main');

    assert(rteArea._fieldId);
    assert(rteArea._docId);
    assert(rteArea._edit !== undefined);
  });

  let firstRendered;
  let secondRendered;

  it('renders an area passed to the `renderArea` method', async function () {
    const req = apos.task.getReq();
    firstRendered = await apos.area.renderArea(req, rteArea, areaDocs[0]);

    assert(firstRendered);
    assert.equal(firstRendered, `
<div class="apos-area"><div data-rich-text><p>Perhaps its fate that today is the 4th of July, and you will once again be fighting for our freedom, not from tyranny, oppression, or persecution -- but from annihilation.</p><p>We're fighting for our right to live, to exist.</p></div>
</div>
`);
  });

  it('returns rendered HTML from the `renderAarea` method for a mixed widget area', async function() {
    const req = apos.task.getReq();
    apos.area.prepForRender(mixedArea, areaDocs[1], 'main');

    secondRendered = await apos.area.renderArea(req, mixedArea, areaDocs[1]);

    assert(secondRendered.includes('<div data-rich-text><p>Good morning.'));
    assert(secondRendered.includes('<marquee>The HTML <code>&lt;marquee&gt;</code> element'));
  });

  it('populates a document object with rendered HTML areas using the renderDocsAreas method.', async function () {
    const req = apos.task.getReq();
    areaDocs.forEach(doc => {
      // No rendered HTML yet.
      assert(!doc.main._rendered);
    });

    await apos.area.renderDocsAreas(req, areaDocs);

    areaDocs.forEach(doc => {
      // Now they're there.
      assert(doc.main._rendered);
      assert(!doc.main.items);

      // TEMP Commenting out until we add the array item metatype.
      // if (doc.moreAreas) {
      //   doc.moreAreas.forEach(area => {
      //     assert(area.someWidgets._rendered);
      //     assert(!area.someWidgets.items);
      //   });
      // }
    });

    assert.equal(areaDocs[0].main._rendered, firstRendered);
    assert.equal(areaDocs[1].main._rendered, secondRendered);
  });

  it('area considered empty when it should be', function() {
    const doc = {
      type: 'test',
      _id: 'test',
      body: {
        metaType: 'area',
        items: []
      },
      emptyText: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            _id: 'test2',
            type: '@apostrophecms/rich-text',
            content: ''
          }
        ]
      },
      insignificantText: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            _id: 'test2',
            type: '@apostrophecms/rich-text',
            content: '<h4> </h4>'
          }
        ]
      }
    };
    assert(apos.area.isEmpty({ area: doc.body }));
    assert(apos.area.isEmpty(doc, 'body'));
    assert(apos.area.isEmpty(doc, 'nonexistent'));
    assert(apos.area.isEmpty(doc, 'emptyText'));
    assert(apos.area.isEmpty(doc, 'insignificantText'));
  });

  it('area not considered empty when it should not be', function() {
    const doc = {
      type: 'test',
      _id: 'test',
      body: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            _id: 'test2',
            type: '@apostrophecms/video',
            url: 'http://somewhere.com'
          }
        ]
      },
      emptyText: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            _id: 'test2',
            type: '@apostrophecms/rich-text',
            content: ''
          }
        ]
      },
      fullText: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            _id: 'test2',
            type: '@apostrophecms/rich-text',
            content: '<h4>Some text</h4>'
          }
        ]
      }
    };
    assert(!apos.area.isEmpty({ area: doc.body }));
    assert(!apos.area.isEmpty(doc, 'body'));
    assert(!apos.area.isEmpty(doc, 'fullText'));
    assert(!apos.area.isEmpty({ area: doc.fullText }));
  });

  it('both isEmpty and legacy empty methods work on schema fields', function() {
    assert(
      !apos.schema.fieldTypes.boolean.isEmpty({
        type: 'boolean',
        name: 'test'
      }, true)
    );
    assert(
      apos.schema.fieldTypes.boolean.isEmpty({
        type: 'boolean',
        name: 'test'
      }, false)
    );
    assert(
      !apos.schema.fieldTypes.boolean.empty({
        type: 'boolean',
        name: 'test'
      }, true)
    );
    assert(
      apos.schema.fieldTypes.boolean.empty({
        type: 'boolean',
        name: 'test'
      }, false)
    );
  });
});

const rteArea = {
  _id: 'ckjyva89o000k2a67vcgl914k',
  items: [
    {
      _id: 'ckjyvagy9000p2a67fbf8nwd3',
      metaType: 'widget',
      type: '@apostrophecms/rich-text',
      content: '<p>Perhaps its fate that today is the 4th of July, and you will once again be fighting for our freedom, not from tyranny, oppression, or persecution -- but from annihilation.</p><p>We\'re fighting for our right to live, to exist.</p>'
    }
  ],
  metaType: 'area'
};
const mixedArea = {
  _id: 'ckjyv67wt001a2a67wibekp0c',
  items: [
    {
      _id: 'ckjyv6ezu001f2a67s572cvn2',
      metaType: 'widget',
      type: '@apostrophecms/rich-text',
      content: '<p>Good morning. In less than an hour, aircraft from here will join others from around the world. And you will be launching the largest aerial battle in this history of mankind.</p>'
    },
    {
      _id: 'ckk32go3e00152a67tbbgzcf9',
      code: '<marquee>The HTML <code>&lt;marquee&gt;</code> element is used to insert a scrolling area of text. You can control what happens when the text reaches the edges of its content area using its attributes.</marquee>',
      metaType: 'widget',
      type: '@apostrophecms/html'
    }
  ],
  metaType: 'area'
};

const areaDocs = [
  {
    _id: 'ckjyvbpgb000mki3rbtar64y7:en:published',
    _edit: true,
    aposDocId: 'ckjyvbpgb000mki3rbtar64y7',
    aposLocale: 'en:published',
    title: 'Nested article bits',
    slug: 'nested-article-bits',
    type: 'article',
    metaType: 'doc',
    main: rteArea
  },
  {
    _id: 'ckjyv9oyv000bki3r0007oajd:en:published',
    _edit: true,
    aposDocId: 'ckjyv9oyv000bki3r0007oajd',
    aposLocale: 'en:published',
    title: 'Fresh article',
    slug: 'fresh-article',
    type: 'article',
    metaType: 'doc',
    main: mixedArea,
    moreAreas: [
      {
        _id: 'ckk4746rp004i2a67iiw024yl',
        someWidgets: {
          _id: 'ckk4746s7004k2a67of8ra2zn',
          items: [
            {
              _id: 'ckk474uzf004q2a67fy06gwba',
              code: '<h1>🌝</h1>',
              metaType: 'widget',
              type: '@apostrophecms/html'
            },
            {
              _id: '32l474uzf004q2adddy06gwba',
              code: '<h2>🌚</h2>',
              metaType: 'widget',
              type: '@apostrophecms/html'
            }
          ],
          metaType: 'area'
        }
      }, {
        _id: 'ckk4763vq00642a67udf3hqbx',
        someWidgets: {
          _id: 'ckk477sm0000qw43r94lpmn2m',
          items: [],
          metaType: 'area'
        }
      }
    ]
  }
];
