const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Manager Filters', function() {
  this.timeout(t.timeout);
  let apos;
  let jar;

  after(function() {
    return t.destroy(apos);
  });

  before(async function () {
    apos = await t.create({
      root: module,
      modules: {
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'article'
          },
          filters: {
            add: {
              score: {
                label: 'Score',
                choices: 'getScoreChoices()'
              },
              _topics: {
                label: 'Topics'
              },
              other: {
                label: 'Other',
                choices: 'topic:topicMethod()'
              }
            }
          },
          fields: {
            add: {
              _topics: {
                label: 'Topics',
                type: 'relationship',
                withType: 'topic'
              },
              score: {
                label: 'Score',
                type: 'select',
                choices: 'getScoreChoices()',
                required: true
              }
            }
          },
          methods(self) {
            return {
              getScoreChoices() {
                return [
                  {
                    label: 'Low',
                    value: 0
                  },
                  {
                    label: 'Medium',
                    value: 1
                  },
                  {
                    label: 'High',
                    value: 2
                  }
                ];
              },
              normalMethod() {
                throw new Error('This method should not be called in the context of a filter');
              }
            };
          }
        },
        topic: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'topic'
          },
          methods(self) {
            return {
              topicMethod() {
                return [
                  {
                    label: 'Topic 1',
                    value: 'Topic 1'
                  },
                  {
                    label: 'Topic 2',
                    value: 'Topic 2'
                  }
                ];
              }
            };
          }
        }
      }
    });
    await insertDocs();
    await createAdminUser();
    jar = await login('admin');
  });

  it('should support relationship and dynamic choices filters for pieces', async function() {
    const { choices } = await apos.http.get('/api/v1/article', {
      jar,
      qs: {
        choices: [ '_topics' ],
        dynamicChoices: [ 'score' ]
      }
    });

    const actual = {
      score: choices.score,
      _topics: choices._topics.map(({
        label, slug, type, metaType
      }) => ({
        slug,
        type,
        metaType,
        label
      }))
    };

    const expected = {
      score: [
        {
          label: 'Low',
          value: 0
        },
        {
          label: 'Medium',
          value: 1
        },
        {
          label: 'High',
          value: 2
        }
      ],
      _topics: [
        {
          slug: 'topic-1',
          type: 'topic',
          metaType: 'doc',
          label: 'Topic 1'
        },
        {
          slug: 'topic-2',
          type: 'topic',
          metaType: 'doc',
          label: 'Topic 2'
        },
        {
          slug: 'topic-3',
          type: 'topic',
          metaType: 'doc',
          label: 'Topic 3'
        }
      ]
    };

    assert.deepEqual(actual, expected);
  });

  it('should not be able to call a method not defined in the filters', async function() {
    try {
      await apos.http.get('/api/v1/article', {
        jar,
        qs: {
          dynamicChoices: [ 'normalMethod()' ]
        }
      });
      assert.fail('Expected an error to be thrown');
    } catch (error) {
      assert.equal(error.status, 400);
    }
  });

  it('should be able to get dynamic choices from a method in another module', async function() {
    const { choices: actual } = await apos.http.get('/api/v1/article', {
      jar,
      qs: {
        dynamicChoices: [ 'other' ]
      }
    });

    const expected = {
      other: [
        {
          label: 'Topic 1',
          value: 'Topic 1'
        },
        {
          label: 'Topic 2',
          value: 'Topic 2'
        }
      ]
    };

    assert.deepEqual(actual, expected);
  });

  async function insertDocs() {
    const req = apos.task.getReq();
    const defaultTopic = apos.topic.newInstance();
    const topics = [
      {
        ...defaultTopic,
        title: 'Topic 1'
      },
      {
        ...defaultTopic,
        title: 'Topic 2'
      },
      {
        ...defaultTopic,
        title: 'Topic 3'
      }
    ];

    const insertedTopics = [];
    for (const topic of topics) {
      const insertedTopic = await apos.topic.insert(req, topic);
      insertedTopics.push(insertedTopic);
    }

    const defaultArticle = apos.article.newInstance();
    const articles = [
      {
        ...defaultArticle,
        title: 'Article 1',
        score: 0,
        _topics: [ insertedTopics[0] ]
      },
      {
        ...defaultArticle,
        title: 'Article 2',
        score: 1,
        _topics: [ insertedTopics[1] ]
      },
      {
        ...defaultArticle,
        title: 'Article 3',
        score: 2,
        _topics: [ insertedTopics[2] ]
      }
    ];

    for (const article of articles) {
      await apos.article.insert(req, article);
    }
  }

  async function createAdminUser() {
    const adminUser = {
      ...apos.user.newInstance(),
      title: 'admin',
      username: 'admin',
      password: 'admin',
      email: 'ad@min.com',
      role: 'admin'
    };

    await apos.user.insert(apos.task.getReq(), adminUser);
  }

  async function login(username, password) {
    if (!password) {
      password = username;
    }
    jar = apos.http.jar();

    // establish session
    let page = await apos.http.get('/', {
      jar
    });

    assert(page.match(/logged out/));

    // Log in

    await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username,
        password,
        session: true
      },
      jar
    });

    // Confirm login
    page = await apos.http.get('/', {
      jar
    });

    assert(page.match(/logged in/));
    return jar;
  }
});
