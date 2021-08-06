const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;

const config = {
  root: module,
  modules: {
    '@apostrophecms/i18n': {
      options: {
        locales: {
          en: {
            label: 'English'
          },
          'en-CA': {
            label: 'Canadian English'
          },
          'en-FR': {
            label: 'Canadian French'
          }
        }
      }
    },
    'default-page': {}
  }
};

describe('Locales', function() {

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should replicate key docs across locales at startup', async function() {
    apos = await t.create(config);

    const homes = await apos.doc.db.find({ parkedId: 'home' }).toArray();
    // Home page in default locale is published, others start out draft only
    assert(homes.length === 4);
    const archives = await apos.doc.db.find({ parkedId: 'archive' }).toArray();
    // Archive page in default locale is published, others start out draft only
    assert(archives.length === 4);
    const globals = await apos.doc.db.find({ type: '@apostrophecms/global' }).toArray();
    // Global doc in default locale is published, others start out draft only
    assert(globals.length === 4);
  });

  it('should not replicate redundantly on a second startup in same db', async function() {
    const apos2 = await t.create({
      ...config,
      shortName: apos.options.shortName
    });

    const homes = await apos2.doc.db.find({ parkedId: 'home' }).toArray();
    // Home page in default locale is published, others start out draft only
    assert(homes.length === 4);
    const archives = await apos2.doc.db.find({ parkedId: 'archive' }).toArray();
    // Archive page in default locale is published, others start out draft only
    assert(archives.length === 4);
    const globals = await apos2.doc.db.find({ type: '@apostrophecms/global' }).toArray();
    // Global doc in default locale is published, others start out draft only
    assert(globals.length === 4);

    await apos2.destroy();
  });

  let child, jar;

  it('should have just one locale for a newly inserted draft page', async function() {
    const req = apos.task.getReq({
      mode: 'draft'
    });
    child = await apos.page.insert(req,
      '_home',
      'lastChild',
      {
        title: 'Child Page',
        type: 'default-page'
      }
    );
    const versions = await apos.doc.db.find({ aposDocId: child.aposDocId }).toArray();
    assert(versions.length === 1);
  });

  it('should be able to insert test user', async function() {
    const user = apos.user.newInstance();

    user.title = 'admin';
    user.username = 'admin';
    user.password = 'admin';
    user.email = 'ad@min.com';
    user.role = 'admin';

    return apos.user.insert(apos.task.getReq(), user);
  });

  it('REST: should be able to log in as admin', async () => {
    jar = apos.http.jar();

    await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'admin',
        password: 'admin',
        session: true
      },
      jar
    });

    // Confirm login, seems necessary for the session cookie in the jar to work
    // on the next call
    const page = await apos.http.get('/', {
      jar
    });

    assert(page.match(/logged in/));

  });

  it('localize API should succeed', async () => {
    return apos.http.post(`/api/v1/@apostrophecms/page/${child._id}/localize`, {
      body: {
        toLocale: 'en-CA'
      },
      jar
    });
  });

  it('after localizing child page should exist in 2 locales', async () => {
    const versions = await apos.doc.db.find({ aposDocId: child.aposDocId }).toArray();
    assert(versions.length === 2);
    assert(!versions.find(version => version.title !== 'Child Page'));
    assert(versions.find(version => version.aposLocale === 'en:draft'));
    assert(versions.find(version => version.aposLocale === 'en-CA:draft'));
  });

});
