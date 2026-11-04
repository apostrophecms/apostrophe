const t = require('../test-lib/test.js');
const assert = require('assert');

// Localizing a page that is new to a locale places it after its previous
// peer there, or failing that, under its parent. That lookup must work
// whatever mode the request was made in: the Localize dialog sends the mode
// the editor is viewing, often published
describe('Localize from published mode', function() {

  let apos;
  let jar;
  let second;

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {
                label: 'English'
              },
              fr: {
                label: 'French',
                prefix: '/fr'
              }
            }
          }
        },
        'default-page': {}
      }
    });
    const req = apos.task.getReq({ mode: 'draft' });
    // The previous peer exists only in English
    await apos.page.insert(req, '_home', 'lastChild', {
      title: 'First',
      type: 'default-page'
    });
    second = await apos.page.insert(req, '_home', 'lastChild', {
      title: 'Second',
      type: 'default-page'
    });
    const user = apos.user.newInstance();
    Object.assign(user, {
      title: 'admin',
      username: 'admin',
      password: 'admin',
      email: 'ad@min.com',
      role: 'admin'
    });
    await apos.user.insert(apos.task.getReq(), user);
    jar = apos.http.jar();
    await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'admin',
        password: 'admin',
        session: true
      },
      jar
    });
    // Sets the CSRF cookie the next request needs
    await apos.http.get('/', { jar });
  });

  it('should localize a page whose previous peer is not in the target locale, from published mode', async function() {
    const result = await apos.http.post(
      `/api/v1/@apostrophecms/page/${second._id}/localize`,
      {
        qs: { aposMode: 'published' },
        body: { toLocale: 'fr' },
        jar
      }
    );
    assert.strictEqual(result._id, second._id.replace(':en:', ':fr:'));
    const copy = await apos.doc.db.findOne({ _id: `${second.aposDocId}:fr:draft` });
    assert(copy);
    assert.strictEqual(copy.title, 'Second');
  });
});
