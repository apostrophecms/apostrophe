const t = require('../test-lib/test.js');
const assert = require('assert');

// Security coverage for the `exist-in-locale` route of the i18n module
// (GHSA-vmxh-77cw-65j7): only documents the requester is allowed to view,
// in the requested locale and mode, may be reported as existing.

describe('i18n exist-in-locale permissions', function() {

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
        thing: {
          extend: '@apostrophecms/piece-type'
        },
        // Only admins may view this type at all
        'admin-thing': {
          extend: '@apostrophecms/piece-type',
          options: {
            viewRole: 'admin'
          }
        }
      }
    });

    await t.createUser(apos, 'guest');
    await t.createUser(apos, 'contributor');
    await t.createUser(apos, 'editor');
    await t.createAdmin(apos);

    ids.publicThing = await insertPiece('thing', {
      title: 'Public thing',
      visibility: 'public'
    });
    ids.loginRequiredThing = await insertPiece('thing', {
      title: 'Login required thing',
      visibility: 'loginRequired'
    });
    ids.adminThing = await insertPiece('admin-thing', {
      title: 'Admin thing',
      visibility: 'public'
    });
  });

  // Inserts a piece in the `en` locale and localizes it to `fr`, publishing
  // both, then returns its `aposDocId`
  async function insertPiece(type, data) {
    const req = apos.task.getReq({ mode: 'draft' });
    const manager = apos.doc.getManager(type);
    const draft = await manager.insert(req, {
      ...manager.newInstance(),
      ...data
    });
    await manager.publish(req, draft);
    const frDraft = await manager.localize(req, draft, 'fr');
    await manager.publish(req.clone({
      locale: 'fr',
      mode: 'draft'
    }), frDraft);
    return draft.aposDocId;
  }

  async function existInLocale(username, body) {
    const jar = username ? await t.loginAs(apos, username) : apos.http.jar();
    // Obtain the CSRF cookie
    await apos.http.get('/', { jar });
    return apos.http.post('/api/v1/@apostrophecms/i18n/exist-in-locale', {
      jar,
      body
    });
  }

  async function assertStatus(promise, status) {
    try {
      await promise;
    } catch (e) {
      assert.strictEqual(e.status, status);
      return;
    }
    assert.fail(`Expected a ${status} error`);
  }

  it('anonymous users cannot use the route', async function() {
    await assertStatus(existInLocale(null, {
      ids: [ `${ids.publicThing}:en:published` ],
      locale: 'fr',
      mode: 'published'
    }), 404);
  });

  it('guests cannot probe for draft documents', async function() {
    await assertStatus(existInLocale('guest', {
      ids: [ `${ids.publicThing}:en:draft` ],
      locale: 'fr',
      mode: 'draft'
    }), 403);
  });

  it('guests cannot probe for draft documents when the mode is inferred from the ids', async function() {
    await assertStatus(existInLocale('guest', {
      ids: [ `${ids.publicThing}:en:draft` ],
      locale: 'fr'
    }), 403);
  });

  it('guests can see published documents they may view', async function() {
    const result = await existInLocale('guest', {
      ids: [
        `${ids.publicThing}:en:published`,
        `${ids.loginRequiredThing}:en:published`
      ],
      locale: 'fr',
      mode: 'published'
    });
    assert.deepStrictEqual(result.aposDocIds.sort(), [
      ids.publicThing,
      ids.loginRequiredThing
    ].sort());
  });

  it('guests cannot see published documents of a type restricted by viewRole', async function() {
    const result = await existInLocale('guest', {
      ids: [ `${ids.adminThing}:en:published` ],
      locale: 'fr',
      mode: 'published'
    });
    assert.deepStrictEqual(result, {
      originalLocaleIds: [],
      newLocaleIds: [],
      aposDocIds: []
    });
  });

  it('contributors cannot see draft documents of a type restricted by viewRole', async function() {
    const result = await existInLocale('contributor', {
      ids: [ `${ids.adminThing}:en:draft` ],
      locale: 'fr',
      mode: 'draft'
    });
    assert.deepStrictEqual(result.aposDocIds, []);
  });

  it('editors cannot see draft documents of a type restricted by viewRole', async function() {
    const result = await existInLocale('editor', {
      ids: [
        `${ids.adminThing}:en:draft`,
        `${ids.publicThing}:en:draft`
      ],
      locale: 'fr'
    });
    assert.deepStrictEqual(result, {
      originalLocaleIds: [ `${ids.publicThing}:en:draft` ],
      newLocaleIds: [ `${ids.publicThing}:fr:draft` ],
      aposDocIds: [ ids.publicThing ]
    });
  });

  it('editors can still see draft documents they may view, as the localize flow requires', async function() {
    const result = await existInLocale('editor', {
      ids: [
        `${ids.publicThing}:en:draft`,
        `${ids.loginRequiredThing}:en:draft`
      ],
      locale: 'fr'
    });
    assert.deepStrictEqual(result.aposDocIds.sort(), [
      ids.publicThing,
      ids.loginRequiredThing
    ].sort());
  });

  it('admins can see draft documents of a type restricted by viewRole', async function() {
    const result = await existInLocale('admin', {
      ids: [ `${ids.adminThing}:en:draft` ],
      locale: 'fr'
    });
    assert.deepStrictEqual(result, {
      originalLocaleIds: [ `${ids.adminThing}:en:draft` ],
      newLocaleIds: [ `${ids.adminThing}:fr:draft` ],
      aposDocIds: [ ids.adminThing ]
    });
  });
});
