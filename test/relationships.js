const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Relationships', function() {

  let apos;
  let req;

  before(async function() {
    apos = await t.create({
      root: module,
      modules: getModules()
    });

    req = apos.task.getReq();
    await insertRelationships(apos);
  });

  after(async function () {
    await t.destroy(apos);
  });

  this.timeout(t.timeout);

  it('should get multiple levels of relationships when withRelationships is an array', async function() {
    const homePage = await apos.page.find(req, { slug: '/' }).toObject();
    const subPage = homePage.main.items[0]._pages[0];
    const subArticle = subPage._articles[0];
    const subTopic = subArticle._topics[0];

    const expected = {
      subArticleTitle: 'article 1',
      subTopicTitle: 'topic 1',
      hasArticlesFields: true,
      hasTopcicsFields: true
    };
    const actual = {
      subArticleTitle: subArticle.title,
      subTopicTitle: subTopic.title,
      hasArticlesFields: Boolean(subPage.articlesFields),
      hasTopcicsFields: Boolean(subArticle.topicsFields)
    };

    assert.deepEqual(actual, expected);
  });

  it('should get one level of relationships when withRelationships set to one level array', async function() {
    const paper = await apos.paper.find(req, { title: 'paper 1' }).toObject();

    const { _articles } = paper._pages[0];
    const actual = {
      page1: paper._pages[0].title,
      page2: paper._pages[1].title,
      page1article: _articles[0].title,
      topicRel: _articles[0]._topics
    };
    const expected = {
      page1: 'page 1',
      page2: 'page 2',
      page1article: 'article 1',
      topicRel: undefined
    };

    assert.deepEqual(actual, expected);
  });
});

async function insertRelationships(apos) {
  const req = apos.task.getReq();

  const topic = await apos.topic.insert(req, {
    ...apos.topic.newInstance(),
    title: 'topic 1'
  });

  const article1 = await apos.article.insert(req, {
    ...apos.article.newInstance(),
    title: 'article 1',
    _topics: [ topic ]
  });

  const page1 = await apos.page.insert(req, '_home', 'lastChild', {
    ...apos.modules['default-page'].newInstance(),
    title: 'page 1',
    slug: '/page-1',
    _articles: [ article1 ]
  });

  const page2 = await apos.page.insert(req, '_home', 'lastChild', {
    ...apos.modules['default-page'].newInstance(),
    title: 'page 2',
    slug: '/page-2',
    _articles: []
  });

  await apos.paper.insert(req, {
    ...apos.paper.newInstance(),
    title: 'paper 1',
    _pages: [ page1, page2 ]
  });

  const homePage = await apos.page.find(req, { slug: '/' }).toObject();

  homePage.main.items = [
    {
      title: 'Random',
      _id: 'e5vrmk1lodf0qaogb92ge3b9',
      metaType: 'widget',
      type: 'random',
      aposPlaceholder: false,
      pagesIds: [ page1.aposDocId ],
      pagesFields: { [page1.aposDocId]: {} }
    }
  ];

  await apos.page.update(req, homePage);
};

function getModules() {
  return {
    '@apostrophecms/home-page': {
      fields: {
        add: {
          main: {
            type: 'area',
            options: {
              widgets: {
                random: {}
              }
            }
          }
        }
      }
    },
    'random-widget': {
      extend: '@apostrophecms/widget-type',
      fields: {
        add: {
          title: {
            label: 'Title',
            type: 'string',
            required: true
          },
          _pages: {
            label: 'Rel page',
            type: 'relationship',
            withType: 'default-page',
            withRelationships: [ '_articles._topics' ],
            builders: {
              project: {
                title: 1
              }
            }
          }
        }
      }
    },
    'default-page': {
      extend: '@apostrophecms/page-type',
      fields: {
        add: {
          _articles: {
            label: 'Articles',
            type: 'relationship',
            withType: 'article',
            builders: {
              project: {
                title: 1
              }
            }
          }
        }
      }
    },
    paper: {
      extend: '@apostrophecms/piece-type',
      options: {
        alias: 'paper'
      },
      fields: {
        add: {
          _pages: {
            label: 'Pages',
            type: 'relationship',
            withType: 'default-page',
            withRelationships: [ '_articles' ],
            builders: {
              project: {
                title: 1,
                _url: 1
              }
            }
          }
        }
      }
    },
    article: {
      extend: '@apostrophecms/piece-type',
      options: {
        alias: 'article',
        publicApiProjection: {
          title: 1,
          _url: 1
        }
      },
      fields: {
        add: {
          _topics: {
            label: 'Topics',
            type: 'relationship',
            withType: 'topic',
            required: false
          }
        }
      }
    },
    topic: {
      extend: '@apostrophecms/piece-type',
      options: {
        alias: 'topic'
      }
    }
  };
}
