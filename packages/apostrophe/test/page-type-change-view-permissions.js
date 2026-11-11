// Regression tests for GHSA-f74v-rxwx-7vv9: changing the type of a page must
// not reveal the values of fields its previous type hid from the user with
// `viewPermission`.

const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('Page type change: viewPermission fields (GHSA-f74v-rxwx-7vv9)', function() {
  let apos;
  const jars = {};

  this.timeout(t.timeout);

  const viewPermission = {
    action: 'publish',
    type: 'secret-page'
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
                name: 'secret-page',
                label: 'Secret Page'
              },
              {
                name: 'plain-page',
                label: 'Plain Page'
              },
              {
                name: 'exposed-page',
                label: 'Exposed Page'
              },
              {
                name: 'guarded-page',
                label: 'Guarded Page'
              }
            ]
          }
        },
        'secret-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              privateData: {
                type: 'string',
                label: 'Private Data',
                viewPermission
              }
            }
          }
        },
        // Does not declare the field
        'plain-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              plain: {
                type: 'string',
                label: 'Plain'
              }
            }
          }
        },
        // Declares the field without restriction
        'exposed-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              privateData: {
                type: 'string',
                label: 'Private Data'
              }
            }
          }
        },
        // Declares the field with the same restriction
        'guarded-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              privateData: {
                type: 'string',
                label: 'Private Data',
                viewPermission
              }
            }
          }
        }
      }
    });

    for (const role of [ 'admin', 'contributor' ]) {
      await t.createUser(apos, role);
      jars[role] = await t.loginAs(apos, role);
    }
  });

  after(async function() {
    return t.destroy(apos);
  });

  async function insertSecretPage() {
    const req = apos.task.getReq();
    const page = await apos.page.insert(req, '_home', 'lastChild', {
      title: 'Secret Page',
      type: 'secret-page',
      privateData: 'TOPSECRET-VALUE'
    });
    await apos.page.publish(req, page);
    return `${page.aposDocId}:en:draft`;
  }

  function getPage(role, _id) {
    return apos.http.get(`/api/v1/@apostrophecms/page/${_id}`, {
      jar: jars[role]
    });
  }

  function patchPage(role, _id, body) {
    return apos.http.patch(`/api/v1/@apostrophecms/page/${_id}`, {
      jar: jars[role],
      body
    });
  }

  async function putPage(role, _id, body) {
    const page = await getPage(role, _id);
    return apos.http.put(`/api/v1/@apostrophecms/page/${_id}`, {
      jar: jars[role],
      body: {
        ...page,
        ...body
      }
    });
  }

  function assertHidden(page) {
    assert.ok(!JSON.stringify(page).includes('TOPSECRET'), 'viewPermission field leaked');
  }

  for (const type of [ 'plain-page', 'exposed-page' ]) {
    it(`contributor: PATCH to ${type} does not reveal a viewPermission field`, async function() {
      const _id = await insertSecretPage();
      assertHidden(await getPage('contributor', _id));
      const patched = await patchPage('contributor', _id, { type });
      assert.equal(patched.type, type);
      assertHidden(patched);
      assertHidden(await getPage('contributor', _id));
    });

    it(`contributor: PUT to ${type} does not reveal a viewPermission field`, async function() {
      const _id = await insertSecretPage();
      const updated = await putPage('contributor', _id, { type });
      assert.equal(updated.type, type);
      assertHidden(updated);
      assertHidden(await getPage('contributor', _id));
    });
  }

  it('contributor: can still set the field of a type that does not restrict it', async function() {
    const _id = await insertSecretPage();
    const patched = await patchPage('contributor', _id, {
      type: 'exposed-page',
      privateData: 'NEW-VALUE'
    });
    assert.equal(patched.privateData, 'NEW-VALUE');
  });

  it('contributor: keeps the field when the new type restricts it the same way', async function() {
    const _id = await insertSecretPage();
    const patched = await patchPage('contributor', _id, { type: 'guarded-page' });
    assert.equal(patched.type, 'guarded-page');
    assertHidden(patched);
    const page = await getPage('admin', _id);
    assert.equal(page.privateData, 'TOPSECRET-VALUE');
  });

  it('admin: changing the type keeps the field', async function() {
    const _id = await insertSecretPage();
    const patched = await patchPage('admin', _id, { type: 'exposed-page' });
    assert.equal(patched.privateData, 'TOPSECRET-VALUE');
    const restored = await patchPage('admin', _id, { type: 'secret-page' });
    assert.equal(restored.privateData, 'TOPSECRET-VALUE');
  });
});
