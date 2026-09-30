const { strict: assert } = require('node:assert');
const t = require('../test-lib/test.js');

// Moving a logged-in session to a locale served from another hostname
// relies on a single-use token carried in the URL of the redirect to that
// hostname. These tests cover the protections around that token.

describe('Cross-domain session tokens', function() {
  this.timeout(t.timeout);

  const namespace = '@apostrophecms/i18n:cross-domain-sessions';
  let apos;
  let port;

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {
                label: 'English',
                hostname: 'localhost'
              },
              fr: {
                label: 'French',
                hostname: 'fr.localhost'
              }
            }
          }
        }
      }
    });
    port = apos.modules['@apostrophecms/express'].server.address().port;
    await t.createAdmin(apos);
  });

  after(function() {
    return t.destroy(apos);
  });

  beforeEach(function() {
    return apos.cache.clear(namespace);
  });

  // A jar logged in as admin on the English (default) hostname, with the
  // CSRF cookie a browser would have
  async function adminJar() {
    const jar = await t.loginAs(apos, 'admin');
    await apos.http.get('/', { jar });
    return jar;
  }

  // Switch to the French locale as the admin UI does, returning the URL
  // on the French hostname the browser is sent to, including the token
  async function switchToFrench() {
    const jar = await adminJar();
    const { redirectTo } = await apos.http.post('/api/v1/@apostrophecms/i18n/locale', {
      body: { locale: 'fr' },
      jar
    });
    const url = new URL(redirectTo, `http://localhost:${port}`);
    // The locale hostname carries no port, the test server has its own
    url.port = port;
    return url;
  }

  function tokenOf(url) {
    return url.searchParams.get('aposCrossDomainSessionToken');
  }

  async function isAdmin(jar, hostname = 'fr.localhost') {
    try {
      await apos.http.get(`http://${hostname}:${port}/api/v1/@apostrophecms/user`, { jar });
      return true;
    } catch (e) {
      // Anonymous users are told there is nothing there
      assert.ok([ 403, 404 ].includes(e.status));
      return false;
    }
  }

  function redeem(url, jar, hostname = 'fr.localhost') {
    const target = new URL(url);
    target.hostname = hostname;
    return apos.http.get(target.toString(), {
      jar,
      fullResponse: true,
      redirect: 'manual'
    });
  }

  it('is only minted when the destination is on another hostname', async function() {
    const jar = await adminJar();
    const { redirectTo } = await apos.http.post('/api/v1/@apostrophecms/i18n/locale', {
      body: { locale: 'en' },
      jar
    });
    assert.equal(redirectTo.includes('aposCrossDomainSessionToken'), false);
  });

  it('is unguessable', async function() {
    const token = tokenOf(await switchToFrench());
    // 256 bits from a cryptographically secure source, not a cuid
    assert.match(token, /^[0-9a-f]{64}$/);
  });

  it('expires within a minute', async function() {
    const token = tokenOf(await switchToFrench());
    const entry = await apos.cache.cacheCollection.findOne({
      namespace,
      key: token
    });
    assert.ok(entry.expires);
    assert.ok(entry.expires.getTime() - Date.now() <= 60 * 1000);
  });

  it('moves the session to the destination hostname, then strips the token without rendering a page', async function() {
    const url = await switchToFrench();
    const jar = apos.http.jar();

    const response = await redeem(url, jar);

    assert.equal(response.status, 302);
    assert.equal(response.headers.location.includes('aposCrossDomainSessionToken'), false);
    assert.equal(response.headers['referrer-policy'], 'no-referrer');
    assert.match(response.headers['cache-control'], /no-store/);
    assert.equal(await isAdmin(jar), true);
  });

  it('can only be used once', async function() {
    const url = await switchToFrench();
    const first = apos.http.jar();
    const second = apos.http.jar();

    await redeem(url, first);
    await redeem(url, second);

    assert.equal(await isAdmin(first), true);
    assert.equal(await isAdmin(second), false);
  });

  it('can only be used once, even by simultaneous requests', async function() {
    const url = await switchToFrench();
    const jars = Array.from({ length: 10 }, () => apos.http.jar());

    await Promise.all(jars.map(jar => redeem(url, jar)));

    const admins = await Promise.all(jars.map(jar => isAdmin(jar)));
    assert.equal(admins.filter(Boolean).length, 1);
  });

  it('is refused on any hostname other than the one it was minted for', async function() {
    const url = await switchToFrench();
    const jar = apos.http.jar();

    await redeem(url, jar, 'localhost');

    assert.equal(await isAdmin(jar, 'localhost'), false);
    // Nor did that attempt spend it, as it was not the intended destination
    const legitimate = apos.http.jar();
    await redeem(url, legitimate);
    assert.equal(await isAdmin(legitimate), true);
  });

  it('is refused once expired', async function() {
    const url = await switchToFrench();
    await apos.cache.cacheCollection.updateOne(
      {
        namespace,
        key: tokenOf(url)
      },
      { $set: { expires: new Date(Date.now() - 1000) } }
    );
    const jar = apos.http.jar();

    await redeem(url, jar);

    assert.equal(await isAdmin(jar), false);
  });

  it('an unknown token leaves the existing session alone', async function() {
    const jar = apos.http.jar();
    await redeem(await switchToFrench(), jar);
    assert.equal(await isAdmin(jar), true);

    const bogus = new URL(`http://fr.localhost:${port}/`);
    bogus.searchParams.set('aposCrossDomainSessionToken', 'bogus');
    await redeem(bogus, jar);

    assert.equal(await isAdmin(jar), true);
  });

  it('is adopted under a new session id, never a pre-existing one', async function() {
    const jar = apos.http.jar();
    // Obtain a session on the destination hostname first, as someone
    // fixating a session id there would
    await t.createUser(apos, 'contributor');
    await apos.http.post(`http://fr.localhost:${port}/api/v1/@apostrophecms/login/login`, {
      body: {
        username: 'contributor',
        password: 'contributor',
        session: true
      },
      jar
    });
    const before = sessionId(jar);
    assert.ok(before);

    await redeem(await switchToFrench(), jar);

    assert.equal(await isAdmin(jar), true);
    assert.notEqual(sessionId(jar), before);
  });

  function sessionId(jar) {
    const cookies = jar.getCookiesSync(`http://fr.localhost:${port}/`);
    const cookie = cookies.find(cookie => cookie.key === `${apos.shortName}.sid`);
    return cookie && cookie.value;
  }
});
