const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;

const config = {
  root: module,
  // Wrong port, but that is OK for this test
  baseUrl: 'http://localhost:3000',
  modules: {
    '@apostrophecms/i18n': {
      options: {
        locales: {
          en: {
            label: 'English'
          },
          'en-CA': {
            label: 'Canadian English',
            prefix: '/ca-en'
          },
          'fr-CA': {
            label: 'Canadian French',
            prefix: '/ca-fr'
          },
          'es-MX': {
            label: 'Mexico',
            hostname: 'example.mx'
          }
        }
      }
    },
    '@apostrophecms/express': {
      options: {
        // Allows us to inject an X-Forwarded-Host header for test purposes
        trustProxy: true
      }
    },
    'default-page': {},
    '@apostrophecms/page': {
      options: {
        park: [
          {
            parkedId: 'people',
            type: 'default-page',
            slug: '/people',
            title: 'People'
          }
        ]
      }
    }
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
    // Draft and published
    assert(homes.length === 8);
    const archives = await apos.doc.db.find({ parkedId: 'archive' }).toArray();
    assert(archives.length === 8);
    // Make sure all archive docs have the archived property set `true`
    assert(!archives.find(archive => !archive.archived));
    const globals = await apos.doc.db.find({ type: '@apostrophecms/global' }).toArray();
    assert(globals.length === 8);
    const people = await apos.doc.db.find({ parkedId: 'people' }).toArray();
    assert(people.length === 8);
    // People page in fr-CA has expected parked properties
    const req = apos.task.getReq();
    const peoplePageEn = await apos.page.find(req, {
      parkedId: 'people'
    }).toObject();
    const frCAReq = apos.task.getReq({
      locale: 'fr-CA'
    });
    let peoplePageFrCA = await apos.page.find(frCAReq, {
      parkedId: 'people'
    }).toObject();
    assert(peoplePageEn.aposDocId === peoplePageFrCA.aposDocId);
    assert(peoplePageEn.aposLocale === 'en:published');
    assert(peoplePageFrCA.aposLocale === 'fr-CA:published');
    assert(peoplePageEn.title === 'People');
    assert(peoplePageFrCA.title === 'People');
    peoplePageFrCA.title = 'Altered';
    await apos.page.update(frCAReq, peoplePageFrCA);
    peoplePageFrCA = await apos.page.find(frCAReq, {
      parkedId: 'people'
    }).toObject();
    assert(peoplePageFrCA.title === 'Altered');
  });

  let home;

  it('should not replicate redundantly on a second startup in same db, but should repark parked properties', async function() {
    const apos2 = await t.create({
      ...config,
      shortName: apos.options.shortName
    });

    const homes = await apos2.doc.db.find({ parkedId: 'home' }).toArray();
    // Draft and published
    assert(homes.length === 8);
    home = homes.find(home => home.aposLocale === 'en:published');
    const people = await apos2.doc.db.find({ parkedId: 'people' }).toArray();
    assert(people.length === 8);
    const archives = await apos2.doc.db.find({ parkedId: 'archive' }).toArray();
    assert(archives.length === 8);
    const globals = await apos2.doc.db.find({ type: '@apostrophecms/global' }).toArray();
    assert(globals.length === 8);
    const frCAReq = apos2.task.getReq({
      locale: 'fr-CA'
    });
    const peoplePageFrCA = await apos2.page.find(frCAReq, {
      parkedId: 'people'
    }).toObject();
    // Restored to parked value
    assert(peoplePageFrCA.title === 'People');
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

    const page = await apos.http.get('/', {
      jar
    });

    assert(page.match(/logged in/));
    assert(page.includes(`<a href="/api/v1/@apostrophecms/page/${home._id}/locale/en-CA">Canadian English (en-CA)</a>`));
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
    const reqEn = apos.task.getReq({
      locale: 'en',
      mode: 'draft'
    });
    const en = await apos.doc.find(reqEn, { slug: '/child-page' }).toObject();
    assert(en);
    assert.strictEqual(en._url, 'http://localhost:3000/child-page');
    await apos.page.publish(reqEn, en);
    const reqEnCA = apos.task.getReq({
      locale: 'en-CA',
      mode: 'draft'
    });
    const enCA = await apos.doc.find(reqEnCA, { slug: '/child-page' }).toObject();
    assert(enCA);
    assert.strictEqual(enCA._url, 'http://localhost:3000/ca-en/child-page');
    // Distinguish the content in this locale
    enCA.title = 'Child Page, Toronto Style';
    assert(apos.page.update(reqEnCA, enCA));
    // Not published yet
    try {
      await apos.http.get('/ca-en/child-page', {});
      assert(false);
    } catch (e) {
      assert(e.status === 404);
    }
    await apos.page.publish(reqEnCA, enCA);
    // Now it should work
    const childPage = await apos.http.get('/ca-en/child-page', {});
    assert(childPage.includes('<title>Child Page, Toronto Style</title>'));
    // Navigation links are localized
    assert(childPage.includes('"http://localhost:3000/ca-en/">Home: /'));
    assert(childPage.includes('"http://localhost:3000/ca-en/child-page">Tab: /child-page'));
    // Locale-switching links are present for locales that are available
    // and fall back to home page for locales that are not
    const childPageId = enCA._id.replace(':draft', ':published');
    assert(childPage.includes(`"/api/v1/@apostrophecms/page/${childPageId}/locale/en">English (en)</a></li>`));
    assert(childPage.includes(`"/api/v1/@apostrophecms/page/${childPageId}/locale/en-CA">Canadian English (en-CA)</a></li>`));
    assert(childPage.includes('"http://localhost:3000/ca-fr/">Canadian French (fr-CA)</a></li>'));
    assert(childPage.includes('"http://example.mx/">Mexico (es-MX)</a></li>'));

    // And the home page should be reachable
    const home = await apos.http.get('/ca-en/');
    assert(home);
  });

  it('Mexico locale should be received when hostname is correct', async() => {
    const reqEsMX = apos.task.getReq({
      locale: 'es-MX',
      mode: 'draft'
    });
    let esMX = await apos.doc.find(reqEsMX, { slug: '/' }).toObject();
    assert(esMX);
    assert.strictEqual(esMX._url, 'http://example.mx/');
    // Distinguish the content in this locale
    esMX.title = 'Pagina De Inicio';
    esMX = await apos.page.update(reqEsMX, esMX);
    await apos.page.publish(reqEsMX, esMX);
    // Without hostname, we default to English
    const homePage = await apos.http.get('/', {});
    assert(homePage.includes('<title>Home</title>'));
    const homePageEsMX = await apos.http.get('/', {
      headers: {
        'X-Forwarded-Host': 'example.mx'
      }
    });
    assert(homePageEsMX.includes('<title>Pagina De Inicio</title>'));
  });

  it('localize API should not succeed a second time without the update flag', async () => {
    try {
      await apos.http.post(`/api/v1/@apostrophecms/page/${child._id}/localize`, {
        body: {
          toLocale: 'en-CA'
        },
        jar
      });
      assert(false);
    } catch (e) {
      assert(e.status === 409);
    }
  });

  it('localize API should succeed a second time with the update flag', async () => {
    return apos.http.post(`/api/v1/@apostrophecms/page/${child._id}/localize`, {
      body: {
        toLocale: 'en-CA',
        update: true
      },
      jar
    });
  });
});
