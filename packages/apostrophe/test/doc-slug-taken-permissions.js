// Regression tests for GHSA-f66c-mpj2-3r8h: the `slug-taken` route reports
// whether any document uses a slug, including documents the caller cannot
// view. Because slugs are unique across all documents, anyone able to choose
// a slug must be able to learn that it is taken. However, logged-in users who
// cannot edit anything at all (e.g. guests) have no such need and must not be
// able to use it to probe for content.

const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('Doc slug-taken route permissions (GHSA-f66c-mpj2-3r8h)', function() {
  let apos;
  const jars = {};

  this.timeout(t.timeout);

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'secret-piece': {
          extend: '@apostrophecms/piece-type',
          options: {
            viewRole: 'admin'
          }
        }
      }
    });
    for (const role of [ 'admin', 'editor', 'contributor', 'guest' ]) {
      await t.createUser(apos, role);
      jars[role] = await t.loginAs(apos, role);
      // Obtain the CSRF cookie, so that POST requests are not rejected for
      // that reason alone
      await apos.http.get('/', { jar: jars[role] });
    }
    const req = apos.task.getReq();
    await apos.modules['secret-piece'].insert(req, {
      ...apos.modules['secret-piece'].newInstance(),
      title: 'Hidden Piece',
      slug: 'hidden-piece-slug',
      visibility: 'loginRequired'
    });
  });

  after(async function() {
    return t.destroy(apos);
  });

  function slugTaken(jar, slug) {
    return apos.http.post('/api/v1/@apostrophecms/doc/slug-taken', {
      jar,
      body: { slug }
    });
  }

  it('anonymous: cannot use the route', async function() {
    const jar = apos.http.jar();
    await apos.http.get('/', { jar });
    await assert.rejects(slugTaken(jar, 'hidden-piece-slug'), (e) => {
      assert.ok([ 403, 404 ].includes(e.status), `unexpected status ${e.status}`);
      return true;
    });
  });

  it('guest: cannot use the route to learn whether a slug exists', async function() {
    for (const slug of [ 'hidden-piece-slug', 'no-such-slug-at-all' ]) {
      await assert.rejects(slugTaken(jars.guest, slug), (e) => {
        assert.ok([ 403, 404 ].includes(e.status), `unexpected status ${e.status}`);
        return true;
      });
    }
  });

  for (const role of [ 'contributor', 'editor', 'admin' ]) {
    it(`${role}: can check whether a slug is available`, async function() {
      const response = await slugTaken(jars[role], 'no-such-slug-at-all');
      assert.deepEqual(response, { available: true });
      // Slugs are globally unique, so anyone who can choose a slug learns
      // that it is taken, even by a document they cannot view. Only a
      // conflict is reported, nothing about the document itself.
      await assert.rejects(slugTaken(jars[role], 'hidden-piece-slug'), (e) => {
        assert.equal(e.status, 409);
        assert.ok(!JSON.stringify(e.body || {}).includes('Hidden Piece'));
        return true;
      });
    });
  }
});
