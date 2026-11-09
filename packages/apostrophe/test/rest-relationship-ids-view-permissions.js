// Regression tests for GHSA-p3m7-jjv4-357v: when the user may not view a
// relationship field (`viewPermission`), REST API responses must not include
// its stored ids and relationship fields (`<name>Ids` and `<name>Fields`)
// either, only the loaded `_<name>`.

const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('REST API: stored ids of a relationship field restricted by viewPermission (GHSA-p3m7-jjv4-357v)', function() {
  let apos;
  let article;
  let note;
  const jars = {};

  this.timeout(t.timeout);

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        note: {
          extend: '@apostrophecms/piece-type'
        },
        article: {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              secretCode: {
                type: 'string',
                label: 'Secret Code',
                viewPermission: {
                  action: 'publish',
                  type: 'article'
                }
              },
              _secretNotes: {
                type: 'relationship',
                label: 'Secret Notes',
                withType: 'note',
                fields: {
                  add: {
                    remark: {
                      type: 'string',
                      label: 'Remark'
                    }
                  }
                },
                viewPermission: {
                  action: 'publish',
                  type: 'article'
                }
              }
            }
          }
        }
      }
    });

    const req = apos.task.getReq();
    note = await apos.modules.note.insert(req, {
      ...apos.modules.note.newInstance(),
      title: 'Note'
    });
    article = await apos.modules.article.insert(req, {
      ...apos.modules.article.newInstance(),
      title: 'Article',
      secretCode: 'CONFIDENTIAL-code',
      _secretNotes: [ {
        ...note,
        _fields: { remark: 'CONFIDENTIAL-remark' }
      } ]
    });

    for (const role of [ 'editor', 'contributor' ]) {
      await t.createUser(apos, role);
      jars[role] = await t.loginAs(apos, role);
    }
  });

  after(async function() {
    return t.destroy(apos);
  });

  function assertHidden(doc) {
    assert.equal(doc._secretNotes, undefined);
    assert.equal(doc.secretNotesIds, undefined);
    assert.equal(doc.secretNotesFields, undefined);
    assert.equal(doc.secretCode, undefined);
  }

  it('does not send the stored ids of a forbidden relationship field (GET one)', async function() {
    const doc = await apos.http.get(`/api/v1/article/${article._id}`, {
      jar: jars.contributor
    });
    assert.equal(doc.title, 'Article');
    assertHidden(doc);
  });

  it('does not send the stored ids of a forbidden relationship field (GET list)', async function() {
    const { results } = await apos.http.get('/api/v1/article', {
      jar: jars.contributor
    });
    assert.equal(results.length, 1);
    assertHidden(results[0]);
  });

  it('sends the relationship and its stored ids to a user who may view it', async function() {
    const doc = await apos.http.get(`/api/v1/article/${article._id}`, {
      jar: jars.editor
    });
    assert.equal(doc._secretNotes.length, 1);
    assert.deepEqual(doc.secretNotesIds, [ note.aposDocId ]);
    assert.equal(doc.secretNotesFields[note.aposDocId].remark, 'CONFIDENTIAL-remark');
  });

  // Only the REST APIs and rendering remove these fields: server-side code
  // running as such a user gets them, and saving the document keeps them
  it('keeps the fields when server-side code fetches and saves the document as a user who may not view them', async function() {
    const req = apos.task.getReq({
      role: 'contributor',
      mode: 'draft'
    });
    const doc = await apos.modules.article
      .find(req, { aposDocId: article.aposDocId })
      .toObject();
    assert.equal(doc.secretCode, 'CONFIDENTIAL-code');
    assert.deepEqual(doc.secretNotesIds, [ note.aposDocId ]);
    doc.title = 'Article, edited by code';
    await apos.modules.article.update(req, doc);
    const stored = await apos.doc.db.findOne({ _id: doc._id });
    assert.equal(stored.title, 'Article, edited by code');
    assert.equal(stored.secretCode, 'CONFIDENTIAL-code');
    assert.deepEqual(stored.secretNotesIds, [ note.aposDocId ]);
    assert.equal(stored.secretNotesFields[note.aposDocId].remark, 'CONFIDENTIAL-remark');
  });

  it('keeps the stored relationship when a user who may not view it saves the document', async function() {
    const draftId = article._id.replace(':published', ':draft');
    const doc = await apos.http.get(`/api/v1/article/${draftId}`, {
      jar: jars.contributor
    });
    assertHidden(doc);
    await apos.http.put(`/api/v1/article/${draftId}`, {
      jar: jars.contributor,
      body: {
        ...doc,
        title: 'Article, edited'
      }
    });
    const stored = await apos.doc.db.findOne({ _id: draftId });
    assert.equal(stored.title, 'Article, edited');
    assert.equal(stored.secretCode, 'CONFIDENTIAL-code');
    assert.deepEqual(stored.secretNotesIds, [ note.aposDocId ]);
    assert.equal(stored.secretNotesFields[note.aposDocId].remark, 'CONFIDENTIAL-remark');
  });
});
