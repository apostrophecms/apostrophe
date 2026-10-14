// Regression tests for GHSA-vh56-5m88-39rq: areas rendered by the page and
// piece REST APIs (`render-areas`) must be rendered from documents that no
// longer include the fields the user may not view (`viewPermission`).

const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('REST API: viewPermission fields in rendered areas (GHSA-vh56-5m88-39rq)', function() {
  let apos;
  let article;
  let page;
  const jars = {};

  this.timeout(t.timeout);

  const notesField = {
    type: 'relationship',
    label: 'Notes',
    withType: 'note-piece'
  };
  const body = {
    type: 'area',
    options: {
      widgets: {
        'render-note': {}
      }
    }
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
              body
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
        article: {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              body
            }
          }
        },
        // Its template outputs the related notes' `noteSecret`
        'render-note-widget': {
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
    const note = await apos.modules['note-piece'].insert(req, {
      ...apos.modules['note-piece'].newInstance(),
      title: 'Related Note',
      noteSecret: 'NOTE-SECRET-VALUE'
    });
    const area = () => ({
      metaType: 'area',
      items: [
        {
          _id: apos.util.generateId(),
          metaType: 'widget',
          type: 'render-note',
          _notes: [ note ]
        }
      ]
    });
    article = await apos.modules.article.insert(req, {
      ...apos.modules.article.newInstance(),
      title: 'Rendered Article',
      body: area()
    });
    page = await apos.page.insert(req, '_home', 'lastChild', {
      title: 'Rendered Page',
      type: 'test-page',
      slug: '/rendered-page',
      body: area()
    });
  });

  after(async function() {
    return t.destroy(apos);
  });

  function get(url, jar, renderAreas) {
    return apos.http.get(url, {
      jar,
      qs: {
        aposMode: 'draft',
        'render-areas': renderAreas
      }
    });
  }

  const routes = () => ({
    'piece GET one': `/api/v1/article/${article._id}`,
    'piece GET all': '/api/v1/article',
    'page GET one': `/api/v1/@apostrophecms/page/${page._id}`
  });

  for (const renderAreas of [ '1', 'inline' ]) {
    it(`admin: render-areas=${renderAreas} renders viewPermission fields of related documents`, async function() {
      for (const url of Object.values(routes())) {
        const json = JSON.stringify(await get(url, jars.admin, renderAreas));
        assert.ok(json.includes('NOTE-SECRET-VALUE'), url);
      }
    });

    it(`contributor: render-areas=${renderAreas} does not render viewPermission fields of related documents`, async function() {
      for (const url of Object.values(routes())) {
        const json = JSON.stringify(await get(url, jars.contributor, renderAreas));
        assert.ok(json.includes('Rendered'), url);
        assert.ok(!json.includes('NOTE-SECRET-VALUE'), `NOTE-SECRET leaked by ${url}`);
      }
    });
  }
});
