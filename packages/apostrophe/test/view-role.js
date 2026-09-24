const assert = require('node:assert/strict');
const t = require('../test-lib/test');

// `viewRole` restricts viewing a doc type to users of at least that role.
// The general public ranks below every role, so it must be restricted too,
// including when the docs would be loaded through a relationship.

describe('viewRole', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            publicApiProjection: {
              title: 1,
              _authors: 1
            }
          },
          fields: {
            add: {
              _authors: {
                type: 'relationship',
                withType: '@apostrophecms/user'
              }
            }
          }
        },
        memo: {
          extend: '@apostrophecms/piece-type',
          options: {
            viewRole: 'guest',
            publicApiProjection: {
              title: 1
            }
          }
        }
      }
    });

    const author = await t.createUser(apos, 'editor', {
      title: 'Author'
    });
    const req = apos.task.getReq();
    await apos.modules.article.insert(req, {
      ...apos.modules.article.newInstance(),
      title: 'Article',
      _authors: [ author ]
    });
    await apos.modules.memo.insert(req, {
      ...apos.modules.memo.newInstance(),
      title: 'Memo'
    });
  });

  after(function() {
    return t.destroy(apos);
  });

  it('forbids the public to view a type with a viewRole', function() {
    const req = apos.task.getAnonReq();
    assert.equal(apos.permission.can(req, 'view', '@apostrophecms/user'), false);
    assert.equal(apos.permission.can(req, 'view', 'memo'), false);
  });

  it('allows the public to view a type without a viewRole', function() {
    const req = apos.task.getAnonReq();
    assert.equal(apos.permission.can(req, 'view', 'article'), true);
  });

  it('still allows those of at least the viewRole to view', function() {
    assert.equal(apos.permission.can(apos.task.getGuestReq(), 'view', 'memo'), true);
    assert.equal(apos.permission.can(apos.task.getGuestReq(), 'view', '@apostrophecms/user'), false);
    assert.equal(apos.permission.can(apos.task.getAdminReq(), 'view', '@apostrophecms/user'), true);
  });

  it('does not find docs of a type with a viewRole for the public', async function() {
    const req = apos.task.getAnonReq();
    assert.deepEqual(await apos.user.find(req, {}).toArray(), []);
    assert.deepEqual(await apos.modules.memo.find(req, {}).toArray(), []);
    assert.deepEqual(await apos.doc.find(req, { type: '@apostrophecms/user' }).toArray(), []);
  });

  it('does not load users through a relationship for the public', async function() {
    const article = await apos.modules.article
      .find(apos.task.getAnonReq(), {})
      .toObject();
    assert.equal(article.title, 'Article');
    assert.deepEqual(article._authors, []);
  });

  it('still loads users through a relationship for an admin', async function() {
    const article = await apos.modules.article
      .find(apos.task.getAdminReq(), {})
      .toObject();
    assert.deepEqual(article._authors.map(({ title }) => title), [ 'Author' ]);
  });

  it('does not send users loaded through a relationship to the public via the REST API', async function() {
    const { results } = await apos.http.get('/api/v1/article');
    assert.equal(results.length, 1);
    assert.deepEqual(results[0]._authors, []);
  });

  it('does not send docs of a type with a viewRole to the public via the REST API', async function() {
    const { results } = await apos.http.get('/api/v1/memo');
    assert.deepEqual(results, []);
  });
});
