const t = require('../test-lib/test.js');
const assert = require('assert');

// Security coverage for the `:_id/locales` REST routes of piece types
// and pages (GHSA-gqh3-7856-rjjg): the public API gate must apply, and
// only the locale records the requester is allowed to view may be listed.

describe('Doc locales route permissions', function() {

  let apos;
  const ids = {};

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {},
              fr: {
                prefix: '/fr'
              }
            }
          }
        },
        '@apostrophecms/page': {
          options: {
            publicApiProjection: {
              title: 1,
              _url: 1
            }
          }
        },
        'default-page': {},
        // No public API projection: anonymous REST access is not allowed
        'private-thing': {
          extend: '@apostrophecms/piece-type'
        },
        // Public API projection: anonymous REST access is allowed, subject
        // to the usual per-document view permissions
        'public-thing': {
          extend: '@apostrophecms/piece-type',
          options: {
            publicApiProjection: {
              title: 1
            }
          }
        },
        // Only admins may view this type at all
        'admin-thing': {
          extend: '@apostrophecms/piece-type',
          options: {
            viewRole: 'admin',
            publicApiProjection: {
              title: 1
            }
          }
        }
      }
    });

    await t.createUser(apos, 'guest');
    await t.createUser(apos, 'contributor');
    await t.createUser(apos, 'editor');

    ids.privateThing = await insertPiece('private-thing', {
      title: 'Private thing',
      visibility: 'public'
    });
    ids.publicThing = await insertPiece('public-thing', {
      title: 'Public thing',
      visibility: 'public'
    });
    ids.loginRequiredThing = await insertPiece('public-thing', {
      title: 'Login required thing',
      visibility: 'loginRequired'
    });
    ids.adminThing = await insertPiece('admin-thing', {
      title: 'Admin thing',
      visibility: 'public'
    });
    ids.publicPage = await insertPage({
      title: 'Public page',
      slug: '/public-page',
      visibility: 'public'
    });
    ids.loginRequiredPage = await insertPage({
      title: 'Login required page',
      slug: '/login-required-page',
      visibility: 'loginRequired'
    });
  });

  async function localizeAndPublish(manager, req, draft) {
    await manager.publish(req, draft);
    const frReq = req.clone({
      locale: 'fr',
      mode: 'draft'
    });
    const frDraft = await manager.localize(req, draft, 'fr');
    await manager.publish(frReq, frDraft);
    return draft.aposDocId;
  }

  async function insertPiece(type, data) {
    const req = apos.task.getReq({ mode: 'draft' });
    const manager = apos.doc.getManager(type);
    const draft = await manager.insert(req, {
      ...manager.newInstance(),
      ...data
    });
    return localizeAndPublish(manager, req, draft);
  }

  async function insertPage(data) {
    const req = apos.task.getReq({ mode: 'draft' });
    const draft = await apos.page.insert(req, '_home', 'lastChild', {
      type: 'default-page',
      ...data
    });
    return localizeAndPublish(apos.page, req, draft);
  }

  function getLocales(action, aposDocId, jar) {
    return apos.http.get(`${action}/${aposDocId}:en:published/locales`, {
      jar
    });
  }

  function summarize(response) {
    return response.results.map(doc => doc.aposLocale).sort();
  }

  async function assertNotFound(promise) {
    try {
      await promise;
    } catch (e) {
      assert.strictEqual(e.status, 404);
      return;
    }
    assert.fail('Expected a 404 error');
  }

  it('anonymous users cannot use the locales route of a piece type without a public API projection', async function() {
    await assertNotFound(getLocales('/api/v1/private-thing', ids.privateThing));
  });

  it('anonymous users cannot use the locales route of pages without a public API projection', async function() {
    const projection = apos.page.options.publicApiProjection;
    delete apos.page.options.publicApiProjection;
    try {
      await assertNotFound(getLocales('/api/v1/@apostrophecms/page', ids.publicPage));
    } finally {
      apos.page.options.publicApiProjection = projection;
    }
  });

  it('anonymous users can list the published locales of a public piece', async function() {
    const response = await getLocales('/api/v1/public-thing', ids.publicThing);
    assert.deepStrictEqual(summarize(response), [ 'en:published', 'fr:published' ]);
  });

  it('anonymous users cannot list the locales of a piece that requires login', async function() {
    const response = await getLocales('/api/v1/public-thing', ids.loginRequiredThing);
    assert.deepStrictEqual(summarize(response), []);
  });

  // Note: `viewRole` is not yet enforced for anonymous users by
  // `apos.permission.criteria` itself, which is tracked separately
  // (GHSA-xf6w-q65w-4f2w). Since the locales route relies on
  // those criteria, it will pick up that fix automatically.

  it('anonymous users can list the published locales of a public page', async function() {
    const response = await getLocales('/api/v1/@apostrophecms/page', ids.publicPage);
    assert.deepStrictEqual(summarize(response), [ 'en:published', 'fr:published' ]);
  });

  it('anonymous users cannot list the locales of a page that requires login', async function() {
    const response = await getLocales('/api/v1/@apostrophecms/page', ids.loginRequiredPage);
    assert.deepStrictEqual(summarize(response), []);
  });

  it('guests can list the published locales of a page that requires login', async function() {
    const jar = await t.loginAs(apos, 'guest');
    const response = await getLocales('/api/v1/@apostrophecms/page', ids.loginRequiredPage, jar);
    assert.deepStrictEqual(summarize(response), [ 'en:published', 'fr:published' ]);
  });

  it('guests cannot list the locales of a piece type restricted by viewRole', async function() {
    const jar = await t.loginAs(apos, 'guest');
    const response = await getLocales('/api/v1/admin-thing', ids.adminThing, jar);
    assert.deepStrictEqual(summarize(response), []);
  });

  it('contributors cannot list the locales, including drafts, of a piece type restricted by viewRole', async function() {
    const jar = await t.loginAs(apos, 'contributor');
    const response = await getLocales('/api/v1/admin-thing', ids.adminThing, jar);
    assert.deepStrictEqual(summarize(response), []);
  });

  it('editors cannot list the locales, including drafts, of a piece type restricted by viewRole', async function() {
    const jar = await t.loginAs(apos, 'editor');
    const response = await getLocales('/api/v1/admin-thing', ids.adminThing, jar);
    assert.deepStrictEqual(summarize(response), []);
  });

  it('editors still get draft and published locales of pieces they may view', async function() {
    const jar = await t.loginAs(apos, 'editor');
    const response = await getLocales('/api/v1/private-thing', ids.privateThing, jar);
    assert.deepStrictEqual(summarize(response), [
      'en:draft',
      'en:published',
      'fr:draft',
      'fr:published'
    ]);
  });

  it('contributors still get draft and published locales of pages they may view', async function() {
    const jar = await t.loginAs(apos, 'contributor');
    const response = await getLocales('/api/v1/@apostrophecms/page', ids.loginRequiredPage, jar);
    assert.deepStrictEqual(summarize(response), [
      'en:draft',
      'en:published',
      'fr:draft',
      'fr:published'
    ]);
  });

  it('admins get all locales of restricted pieces', async function() {
    await t.createAdmin(apos);
    const jar = await t.loginAs(apos, 'admin');
    const response = await getLocales('/api/v1/admin-thing', ids.adminThing, jar);
    assert.deepStrictEqual(summarize(response), [
      'en:draft',
      'en:published',
      'fr:draft',
      'fr:published'
    ]);
  });
});
