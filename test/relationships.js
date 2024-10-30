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

    assert.equal(homePage.main.items[0]._relPage[0]._articles[0].title, 'article 1');
  });

  it('should get one level of relationships when withRelationships is true', async function() {
    const paper = await apos.paper.find(req, { title: 'paper 1' }).toObject();
    console.log('paper', paper);

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

  const article2 = await apos.article.insert(req, {
    ...apos.article.newInstance(),
    title: 'article 2',
    _topics: []
  });

  await apos.paper.insert(req, {
    ...apos.paper.newInstance(),
    title: 'paper 1',
    _articles: [ article1, article2 ]
  });

  const page = await apos.page.insert(req, '_home', 'lastChild', {
    ...apos.modules['default-page'].newInstance(),
    title: 'page 1',
    slug: '/page-1',
    _articles: [ article1 ]
  });

  const homePage = await apos.page.find(req, { slug: '/' }).toObject();

  homePage.main.items = [
    {
      title: 'Random',
      _id: 'e5vrmk1lodf0qaogb92ge3b9',
      metaType: 'widget',
      type: 'random',
      aposPlaceholder: false,
      relPageIds: [ page.aposDocId ],
      relPageFields: { [page.aposDocId]: {} }
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
          _relPage: {
            label: 'Rel page',
            type: 'relationship',
            withType: 'default-page',
            withRelationships: true,
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
          _articles: {
            label: 'Articles',
            type: 'relationship',
            withType: 'article',
            withRelationships: true,
            builders: {
              project: {
                title: 1
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
