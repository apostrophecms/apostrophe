// Regression tests for GHSA-vh56-5m88-39rq: documents loaded through
// relationships (direct, nested, reverse, inside widgets, array and object
// fields) and returned by the page and piece REST APIs must not include
// fields restricted by `viewPermission` in their own type's schema when the
// user lacks that permission.

const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('REST API: viewPermission fields of related documents (GHSA-vh56-5m88-39rq)', function() {
  let apos;
  let article;
  let page;
  let note;
  let topic;
  const jars = {};

  this.timeout(t.timeout);

  const notesField = {
    type: 'relationship',
    label: 'Notes',
    withType: 'note-piece'
  };

  before(async function() {
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
            ]
          }
        },
        'test-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              pageSecret: {
                type: 'string',
                label: 'Page Secret',
                viewPermission: {
                  action: 'publish',
                  type: 'test-page'
                }
              },
              _notes: notesField,
              _articles: {
                type: 'relationshipReverse',
                withType: 'article',
                reverseOf: '_pages'
              },
              main: {
                type: 'area',
                options: {
                  widgets: {
                    note: {}
                  }
                }
              }
            }
          }
        },
        'note-piece': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              noteSecret: {
                type: 'string',
                label: 'Note Secret',
                viewPermission: {
                  action: 'publish',
                  type: 'note-piece'
                }
              }
            }
          }
        },
        // No restricted fields of its own, used to reach notes through a
        // nested relationship
        topic: {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              _notes: notesField
            }
          }
        },
        article: {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              articleSecret: {
                type: 'string',
                label: 'Article Secret',
                viewPermission: {
                  action: 'publish',
                  type: 'article'
                }
              },
              _notes: notesField,
              _topics: {
                type: 'relationship',
                label: 'Topics',
                withType: 'topic',
                withRelationships: [ '_notes' ]
              },
              _pages: {
                type: 'relationship',
                label: 'Pages',
                withType: 'test-page'
              },
              items: {
                type: 'array',
                label: 'Items',
                fields: {
                  add: {
                    _notes: notesField
                  }
                }
              },
              meta: {
                type: 'object',
                label: 'Meta',
                fields: {
                  add: {
                    _notes: notesField
                  }
                }
              },
              body: {
                type: 'area',
                options: {
                  widgets: {
                    note: {}
                  }
                }
              }
            }
          }
        },
        'note-widget': {
          extend: '@apostrophecms/widget-type',
          fields: {
            add: {
              _notes: notesField
            }
          }
        }
      }
    });

    for (const role of [ 'admin', 'contributor' ]) {
      await t.createUser(apos, role);
      jars[role] = await t.loginAs(apos, role);
    }

    const req = apos.task.getReq({ mode: 'draft' });
    const noteWidgetArea = () => ({
      metaType: 'area',
      items: [
        {
          _id: apos.util.generateId(),
          metaType: 'widget',
          type: 'note',
          _notes: [ note ]
        }
      ]
    });
    note = await apos.modules['note-piece'].insert(req, {
      ...apos.modules['note-piece'].newInstance(),
      title: 'Related Note',
      noteSecret: 'NOTE-SECRET-VALUE'
    });
    topic = await apos.modules.topic.insert(req, {
      ...apos.modules.topic.newInstance(),
      title: 'Related Topic',
      _notes: [ note ]
    });
    page = await apos.page.insert(req, '_home', 'lastChild', {
      title: 'Related Page',
      type: 'test-page',
      slug: '/related-page',
      pageSecret: 'PAGE-SECRET-VALUE',
      _notes: [ note ],
      main: noteWidgetArea()
    });
    article = await apos.modules.article.insert(req, {
      ...apos.modules.article.newInstance(),
      title: 'Main Article',
      articleSecret: 'ARTICLE-SECRET-VALUE',
      _notes: [ note ],
      _topics: [ topic ],
      _pages: [ page ],
      items: [
        {
          _id: apos.util.generateId(),
          metaType: 'arrayItem',
          _notes: [ note ]
        }
      ],
      meta: {
        _id: apos.util.generateId(),
        metaType: 'objectItem',
        _notes: [ note ]
      },
      body: noteWidgetArea()
    });
  });

  after(async function() {
    return t.destroy(apos);
  });

  function getOne(type, doc, jar) {
    return apos.http.get(`/api/v1/${type}/${doc.aposDocId}:en:draft`, { jar });
  }

  function getAll(type, jar, qs = {}) {
    return apos.http.get(`/api/v1/${type}`, {
      jar,
      qs: {
        aposMode: 'draft',
        ...qs
      }
    });
  }

  function assertArticleRelationshipsLoaded(doc) {
    assert.equal(doc.title, 'Main Article');
    assert.equal(doc._notes[0].title, 'Related Note');
    assert.equal(doc._topics[0]._notes[0].title, 'Related Note');
    assert.equal(doc._pages[0].title, 'Related Page');
    assert.equal(doc.items[0]._notes[0].title, 'Related Note');
    assert.equal(doc.meta._notes[0].title, 'Related Note');
    assert.equal(doc.body.items[0]._notes[0].title, 'Related Note');
  }

  function assertPageRelationshipsLoaded(doc) {
    assert.equal(doc.title, 'Related Page');
    assert.equal(doc._notes[0].title, 'Related Note');
    assert.equal(doc._articles[0].title, 'Main Article');
    assert.equal(doc.main.items[0]._notes[0].title, 'Related Note');
  }

  function assertNoSecrets(response) {
    const json = JSON.stringify(response);
    for (const secret of [ 'NOTE-SECRET', 'PAGE-SECRET', 'ARTICLE-SECRET' ]) {
      assert.ok(!json.includes(secret), `${secret} leaked`);
    }
  }

  it('admin: related documents include their viewPermission fields', async function() {
    const doc = await getOne('article', article, jars.admin);
    assertArticleRelationshipsLoaded(doc);
    assert.equal(doc.articleSecret, 'ARTICLE-SECRET-VALUE');
    assert.equal(doc._notes[0].noteSecret, 'NOTE-SECRET-VALUE');
    assert.equal(doc._topics[0]._notes[0].noteSecret, 'NOTE-SECRET-VALUE');
    assert.equal(doc._pages[0].pageSecret, 'PAGE-SECRET-VALUE');
    assert.equal(doc.body.items[0]._notes[0].noteSecret, 'NOTE-SECRET-VALUE');
    const pageDoc = await getOne('@apostrophecms/page', page, jars.admin);
    assertPageRelationshipsLoaded(pageDoc);
    assert.equal(pageDoc._articles[0].articleSecret, 'ARTICLE-SECRET-VALUE');
  });

  it('contributor: piece GET one does not return viewPermission fields of related documents', async function() {
    const doc = await getOne('article', article, jars.contributor);
    assertArticleRelationshipsLoaded(doc);
    assertNoSecrets(doc);
  });

  it('contributor: piece GET all does not return viewPermission fields of related documents', async function() {
    const { results } = await getAll('article', jars.contributor);
    assertArticleRelationshipsLoaded(results[0]);
    assertNoSecrets(results);
  });

  it('contributor: page GET one does not return viewPermission fields of related documents', async function() {
    const doc = await getOne('@apostrophecms/page', page, jars.contributor);
    assertPageRelationshipsLoaded(doc);
    assertNoSecrets(doc);
  });

  it('contributor: page GET all by type does not return viewPermission fields of related documents', async function() {
    const { results } = await getAll('@apostrophecms/page', jars.contributor, {
      type: 'test-page'
    });
    assertPageRelationshipsLoaded(results[0]);
    assertNoSecrets(results);
  });

  it('contributor: a projection excluding type does not reveal viewPermission fields of a page', async function() {
    const doc = await apos.http.get(`/api/v1/@apostrophecms/page/${page.aposDocId}:en:draft`, {
      jar: jars.contributor,
      qs: {
        project: {
          type: 0,
          metaType: 0
        }
      }
    });
    assert.equal(doc.title, 'Related Page');
    assert.equal(doc.type, undefined);
    assert.equal(doc.pageSecret, undefined);
  });
});
