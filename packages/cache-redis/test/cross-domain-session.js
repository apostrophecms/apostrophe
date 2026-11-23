const assert = require('assert').strict;
const testUtil = require('apostrophe/test-lib/test');

// Switching to a locale served from another hostname moves the session
// with a token stored in the cache, so it must work with the Redis cache

describe('Cross-domain session tokens with the Redis cache', function() {
  let apos;
  let port;

  this.timeout(20000);

  before(async function() {
    apos = await testUtil.create({
      testModule: true,
      modules: {
        '@apostrophecms/express': {
          options: {
            session: { secret: 'test-the-redis' }
          }
        },
        '@apostrophecms/cache-redis': {
          options: {
            redisActive: true
          }
        },
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
    await testUtil.createAdmin(apos);
  });

  after(async function() {
    await apos.cache.clear('@apostrophecms/i18n:cross-domain-sessions');
    await testUtil.destroy(apos);
  });

  async function switchToFrench() {
    const jar = await testUtil.loginAs(apos, 'admin');
    await apos.http.get('/', { jar });
    const { redirectTo } = await apos.http.post('/api/v1/@apostrophecms/i18n/locale', {
      body: { locale: 'fr' },
      jar
    });
    const url = new URL(redirectTo, `http://localhost:${port}`);
    url.hostname = 'fr.localhost';
    url.port = port;
    return url;
  }

  async function isAdmin(jar) {
    try {
      await apos.http.get(`http://fr.localhost:${port}/api/v1/@apostrophecms/user`, { jar });
      return true;
    } catch (e) {
      assert.ok([ 403, 404 ].includes(e.status));
      return false;
    }
  }

  function redeem(url, jar) {
    return apos.http.get(url.toString(), {
      jar,
      fullResponse: true,
      redirect: 'manual'
    });
  }

  it('moves the session to the destination hostname', async function() {
    const url = await switchToFrench();
    assert.ok(url.searchParams.get('aposCrossDomainSessionToken'));
    const jar = apos.http.jar();

    const response = await redeem(url, jar);

    assert.equal(response.status, 302);
    assert.equal(await isAdmin(jar), true);
  });

  it('can only be used once', async function() {
    const url = await switchToFrench();
    const jars = Array.from({ length: 10 }, () => apos.http.jar());

    await Promise.all(jars.map(jar => redeem(url, jar)));

    const admins = await Promise.all(jars.map(jar => isAdmin(jar)));
    assert.equal(admins.filter(Boolean).length, 1);
  });
});
