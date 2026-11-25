// Regression tests for GHSA-69r4-gcp7-c67r: the text of fields protected by
// `viewPermission` must not reach a user who may not view them through the
// search properties of a document (`highSearchText`, `lowSearchText`,
// `highSearchWords`, `searchSummary`), nor be discoverable through the
// `search` and `autocomplete` query builders.

const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('Search texts and viewPermission (GHSA-69r4-gcp7-c67r)', function() {
  let apos;
  let piece;
  const jars = {};
  const permission = {
    action: 'publish',
    type: 'search-note'
  };

  this.timeout(t.timeout);

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'search-note': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              publicNotes: {
                type: 'string',
                label: 'Public Notes'
              },
              secretNotes: {
                type: 'string',
                label: 'Secret Notes',
                viewPermission: permission
              },
              secretList: {
                type: 'array',
                label: 'Secret List',
                viewPermission: permission,
                fields: {
                  add: {
                    text: {
                      type: 'string',
                      label: 'Text'
                    }
                  }
                }
              },
              secretObject: {
                type: 'object',
                label: 'Secret Object',
                viewPermission: permission,
                fields: {
                  add: {
                    text: {
                      type: 'string',
                      label: 'Text'
                    }
                  }
                }
              },
              secretArea: {
                type: 'area',
                label: 'Secret Area',
                viewPermission: permission,
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {}
                  }
                }
              }
            }
          }
        }
      }
    });

    for (const role of [ 'editor', 'contributor' ]) {
      await t.createUser(apos, role);
      jars[role] = await t.loginAs(apos, role);
    }

    const req = apos.task.getReq();
    const manager = apos.modules['search-note'];
    piece = await manager.insert(req, {
      ...manager.newInstance(),
      title: 'Search Note',
      publicNotes: 'Openwords Visible',
      secretNotes: 'Hiddenalpha Value',
      secretList: [
        {
          _id: apos.util.generateId(),
          metaType: 'arrayItem',
          text: 'Hiddenbravo Value'
        }
      ],
      secretObject: {
        _id: apos.util.generateId(),
        metaType: 'object',
        text: 'Hiddencharlie Value'
      },
      secretArea: {
        _id: apos.util.generateId(),
        metaType: 'area',
        items: [
          {
            _id: apos.util.generateId(),
            metaType: 'widget',
            type: '@apostrophecms/rich-text',
            content: '<p>Hiddendelta Value</p>'
          }
        ]
      }
    });
    await manager.publish(req, piece);
  });

  after(async function() {
    return t.destroy(apos);
  });

  const secrets = [ 'hiddenalpha', 'hiddenbravo', 'hiddencharlie', 'hiddendelta' ];

  function assertNoSecrets(value) {
    const json = JSON.stringify(value).toLowerCase();
    for (const secret of secrets) {
      assert.ok(!json.includes(secret), `"${secret}" leaked`);
    }
  }

  function getOne(jar, mode) {
    return apos.http.get(
      `/api/v1/search-note/${piece.aposDocId}:en:${mode}`,
      { jar }
    );
  }

  it('contributor: GET one does not reveal viewPermission text in search properties', async function() {
    for (const mode of [ 'draft', 'published' ]) {
      const doc = await getOne(jars.contributor, mode);
      assert.equal(doc.title, 'Search Note');
      assert.equal(doc.publicNotes, 'Openwords Visible');
      assertNoSecrets(doc);
    }
  });

  it('contributor: GET list does not reveal viewPermission text in search properties', async function() {
    const { results } = await apos.http.get('/api/v1/search-note', {
      jar: jars.contributor,
      qs: { aposMode: 'draft' }
    });
    assert.equal(results.length, 1);
    assertNoSecrets(results);
  });

  it('contributor: search and autocomplete do not match viewPermission text', async function() {
    for (const secret of secrets) {
      for (const qs of [ { search: secret }, { autocomplete: secret } ]) {
        const { results } = await apos.http.get('/api/v1/search-note', {
          jar: jars.contributor,
          qs: {
            ...qs,
            aposMode: 'draft'
          }
        });
        assert.equal(results.length, 0, `${JSON.stringify(qs)} matched`);
      }
    }
  });

  it('contributor: the search query builder does not match viewPermission text', async function() {
    const req = apos.task.getReq({ role: 'contributor' });
    for (const secret of secrets) {
      const found = await apos.modules['search-note'].find(req).search(secret).toArray();
      assert.equal(found.length, 0, `search for "${secret}" matched`);
    }
  });

  it('public text is still searchable', async function() {
    const { results } = await apos.http.get('/api/v1/search-note', {
      jar: jars.contributor,
      qs: {
        search: 'openwords',
        aposMode: 'draft'
      }
    });
    assert.equal(results.length, 1);
    const req = apos.task.getReq();
    const found = await apos.modules['search-note'].find(req).search('openwords').toArray();
    assert.equal(found.length, 1);
    assert.ok(found[0].lowSearchText.includes('openwords'));
  });

  it('editor: still sees the viewPermission fields themselves', async function() {
    const doc = await getOne(jars.editor, 'draft');
    assert.equal(doc.secretNotes, 'Hiddenalpha Value');
  });
});
