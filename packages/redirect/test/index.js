const assert = require('assert').strict;
const t = require('apostrophe/test-lib/util.js');

describe('@apostrophecms/redirect', function () {
  let apos;
  let redirectModule;

  this.timeout(t.timeout);

  after(async function() {
    await t.destroy(apos);
  });

  before(async function() {
    apos = await t.create({
      root: module,
      testModule: true,
      modules: getAppConfig()
    });

    redirectModule = apos.modules['@apostrophecms/redirect'];
    await insertPages(apos);
  });

  this.afterEach(async function() {
    await apos.doc.db.deleteMany({ type: '@apostrophecms/redirect' });
  });

  it('should allow to redirect to external URLs', async function() {
    const req = apos.task.getReq();
    const instance = redirectModule.newInstance();
    await redirectModule.insert(req, {
      ...instance,
      title: 'external redirect',
      urlType: 'external',
      redirectSlug: '/page-1',
      externalUrl: 'http://localhost:3000/page-2'
    });
    const redirected = await apos.http.get('http://localhost:3000/page-1');

    assert.equal(redirected, '<title>page 2</title>\n');
  });

  it('should allow to redirect to external URLs when the initial slug is UTF8', async function() {
    const req = apos.task.getReq();
    const instance = redirectModule.newInstance();
    await redirectModule.insert(req, {
      ...instance,
      title: 'external redirect',
      urlType: 'external',
      redirectSlug: '/page-✅',
      externalUrl: 'http://localhost:3000/page-2'
    });
    const redirected = await apos.http.get('http://localhost:3000/page-✅');

    assert.equal(redirected, '<title>page 2</title>\n');
  });

  it('query string matters by default', async function() {
    const req = apos.task.getReq();
    const instance = redirectModule.newInstance();
    await redirectModule.insert(req, {
      ...instance,
      title: 'external redirect',
      urlType: 'external',
      redirectSlug: '/page-✅',
      externalUrl: 'http://localhost:3000/page-2'
    });
    try {
      await apos.http.get('http://localhost:3000/page-✅?whatever');
      assert(false);
    } catch (e) {
      // good, should 404
    }
  });

  it('query string can optionally be ignored', async function() {
    const req = apos.task.getReq();
    const instance = redirectModule.newInstance();
    await redirectModule.insert(req, {
      ...instance,
      title: 'external redirect',
      urlType: 'external',
      redirectSlug: '/page-✅',
      externalUrl: 'http://localhost:3000/page-2',
      ignoreQueryString: true
    });
    const redirected = await apos.http.get('http://localhost:3000/page-✅?whatever');
    assert.equal(redirected, '<title>page 2</title>\n');
  });

  it('should allow to redirect to internal pages', async function() {
    const req = apos.task.getReq();
    const instance = redirectModule.newInstance();
    const page2 = await apos.page.find(req, { title: 'page 2' }).toObject();
    await redirectModule.insert(req, {
      ...instance,
      title: 'internal redirect',
      urlType: 'internal',
      redirectSlug: '/page-1',
      _newPage: [ page2 ]
    });
    const redirected = await apos.http.get('http://localhost:3000/page-1');

    assert.equal(redirected, '<title>page 2</title>\n');
  });

  it('should allow to redirect to internal pages in other locales', async function() {
    const req = apos.task.getReq();
    const reqFr = apos.task.getReq({ locale: 'fr' });
    const instance = redirectModule.newInstance();
    const pageFr = await apos.page.find(reqFr, { title: 'page fr' }).toObject();
    const inserted = await redirectModule.insert(req, {
      ...instance,
      title: 'internal redirect',
      urlType: 'internal',
      redirectSlug: '/page-1',
      _newPage: [ pageFr ]
    });
    assert.strictEqual(inserted.targetLocale, 'fr');
    const redirected = await apos.http.get('http://localhost:3000/page-1');
    assert.equal(redirected, '<title>page fr</title>\n');
  });

  it('regex should accept only permissible slugs (some edge cases are handled separately)', function() {
    const goodSlugs = [ '/auto/*', '/automotive', '/auto/cl600/*' ];
    const badSlugs = [ '/*', '/*/something/*' ];
    const pattern = apos.redirect.schema.find(field => field.name === 'redirectSlug').pattern;
    const regexp = new RegExp(pattern);
    for (const slug of goodSlugs) {
      assert(regexp.test(slug));
    }
    for (const slug of badSlugs) {
      assert(!regexp.test(slug));
    }
  });

  it('should not accept /* as redirectSlug', async function() {
    const req = apos.task.getReq();
    const instance = redirectModule.newInstance();

    await assert.rejects(
      redirectModule.insert(req, {
        ...instance,
        title: 'wildcard redirect',
        urlType: 'external',
        redirectSlug: '/*',
        externalUrl: '/page-2'
      })
    );
  });

  it('should not accept /api/v1/* as redirectSlug', async function() {
    const req = apos.task.getReq();
    const instance = redirectModule.newInstance();

    await assert.rejects(
      redirectModule.insert(req, {
        ...instance,
        title: 'wildcard redirect',
        urlType: 'external',
        redirectSlug: '/api/v1/*',
        externalUrl: '/page-2'
      })
    );
  });

  it('should make a simple wildcard redirection', async function() {
    const req = apos.task.getReq();
    const instance = redirectModule.newInstance();

    await redirectModule.insert(req, {
      ...instance,
      title: 'wildcard redirect',
      urlType: 'external',
      redirectSlug: '/manufacturers/*',
      externalUrl: '/auto/manufacturers'
    });

    const redirected = await apos.http.get('http://localhost:3000/manufacturers/bmw/k-1100-lt');
    assert.equal(redirected, '<title>manufacturers</title>\n');
  });

  it('should match the wildcard from the external url', async function() {
    const req = apos.task.getReq();
    const instance = redirectModule.newInstance();

    await redirectModule.insert(req, {
      ...instance,
      title: 'wildcard redirect',
      urlType: 'external',
      redirectSlug: '/manufacturers/mercedes-benz/*',
      externalUrl: '/auto/manufacturers/mercedes-benz/*'
    });

    const redirected = await apos.http.get('http://localhost:3000/manufacturers/mercedes-benz/cl600');
    assert.equal(redirected, '<title>cl600</title>\n');
  });

  it('should prioritize exact matches over wildcard matches', async function() {
    const req = apos.task.getReq();
    const instance = redirectModule.newInstance();

    await redirectModule.insert(req, {
      ...instance,
      title: 'wildcard redirect',
      urlType: 'external',
      redirectSlug: '/manufacturers/*',
      externalUrl: '/auto/manufacturers'
    });

    await redirectModule.insert(req, {
      ...instance,
      title: 'specific redirect',
      urlType: 'external',
      redirectSlug: '/manufacturers/mercedes-benz/cl600',
      externalUrl: '/auto/manufacturers/mercedes-benz/cl600'
    });

    const redirected = await apos.http.get('http://localhost:3000/manufacturers/mercedes-benz/cl600');
    assert.equal(redirected, '<title>cl600</title>\n');
  });

  it('should prioritize specific wildcard redirects over wider ones', async function() {
    const req = apos.task.getReq();
    const instance = redirectModule.newInstance();

    await redirectModule.insert(req, {
      ...instance,
      title: 'wildcard redirect',
      urlType: 'external',
      redirectSlug: '/manufacturers/*',
      externalUrl: '/auto/manufacturers'
    });

    await redirectModule.insert(req, {
      ...instance,
      title: 'specific redirect',
      urlType: 'external',
      redirectSlug: '/manufacturers/mercedes-benz/*',
      externalUrl: '/auto/manufacturers/mercedes-benz/*'
    });

    const redirected = await apos.http.get('http://localhost:3000/manufacturers/mercedes-benz/cl600');
    assert.equal(redirected, '<title>cl600</title>\n');
  });
});

async function insertPages(apos) {
  const req = apos.task.getReq();
  const frReq = apos.task.getReq({ locale: 'fr' });
  const defaultPageModule = apos.modules['default-page'];
  const pageInstance = defaultPageModule.newInstance();

  await apos.page.insert(req, '_home', 'lastChild', {
    ...pageInstance,
    title: 'page 1',
    slug: '/page-1'
  });
  await apos.page.insert(req, '_home', 'lastChild', {
    ...pageInstance,
    title: 'page 2',
    slug: '/page-2'
  });
  await apos.page.insert(frReq, '_home', 'lastChild', {
    ...pageInstance,
    title: 'page fr',
    slug: '/page-fr'
  });
  await apos.page.insert(req, '_home', 'lastChild', {
    ...pageInstance,
    title: 'cl600',
    slug: '/auto/manufacturers/mercedes-benz/cl600'
  });
  await apos.page.insert(req, '_home', 'lastChild', {
    ...pageInstance,
    title: 'manufacturers',
    slug: '/auto/manufacturers'
  });
}

function getAppConfig() {
  return {
    '@apostrophecms/express': {
      options: {
        session: { secret: 'supersecret' },
        port: 3000
      }
    },
    '@apostrophecms/i18n': {
      options: {
        defaultLocale: 'en',
        locales: {
          en: { label: 'English' },
          fr: {
            label: 'French',
            prefix: '/fr'
          }
        }
      }
    },
    '@apostrophecms/redirect': {
      options: {
        alias: 'redirect'
      }
    },
    'default-page': {},
    article: {
      extend: '@apostrophecms/piece-type',
      options: {
        alias: 'article'
      }
    },
    topic: {
      extend: '@apostrophecms/piece-type',
      options: {
        alias: 'topic'
      },
      fields: {
        add: {
          description: {
            label: 'Description',
            type: 'string'
          }
        }
      }
    }
  };
}
