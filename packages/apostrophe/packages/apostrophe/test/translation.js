const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('Translation', function () {
  let apos = null;

  this.timeout(t.timeout);

  const boot = async function () {
    apos = await t.create({
      root: module,
      modules: {
        'fake-translation-provider': {
          options: {
            alias: 'fakeProvider'
          },
          methods: (self) => ({
            async translate(req, provider, doc, source, target) {
              doc.title = `${provider}-${source}-${target}-${doc.title}-translated`;
              return doc;
            },
            async getSupportedLanguages(req, {
              provider, source, target
            } = {}) {
              const supported = [ 'en', 'es', 'fr' ];
              const sourceRespone = source?.length
                ? source.map((code) => ({
                  code,
                  supported: supported.includes(code)
                }))
                : supported.map((code) => ({
                  code,
                  supported: true
                }));
              const targetResponse = target?.length
                ? target.map((code) => ({
                  code,
                  supported: supported.includes(code)
                }))
                : supported.map((code) => ({
                  code,
                  supported: true
                }));

              return {
                source: sourceRespone,
                target: targetResponse
              };
            }
          })
        },
        'default-page': {
          extend: '@apostrophecms/page-type',
          options: {
            label: 'Default'
          }
        }
      }
    });
  };

  before(async function () {
    await boot();
  });

  after(function () {
    return t.destroy(apos);
  });

  it('should be disabled if no providers', async function () {
    const translation = apos.modules['@apostrophecms/translation'];
    assert.equal(translation.isEnabled(), false);
  });

  it('should add a translation provider', async function () {
    const translation = apos.modules['@apostrophecms/translation'];
    const provider = apos.fakeProvider;

    translation.addProvider(provider, {
      label: 'Fake Provider',
      name: 'fake'
    });
    assert.equal(translation.providers.length, 1);
    assert.equal(translation.providers[0].name, 'fake');
    assert.equal(translation.isEnabled(), true);
  });

  it('should validate the provider interface', async function () {
    const translation = apos.modules['@apostrophecms/translation'];

    assert.throws(() => translation.addProvider(), {
      cause: 'invalidArguments'
    });
    assert.throws(() => translation.addProvider({}, { name: 'anotherFake' }), {
      cause: 'invalidArguments'
    });
    assert.throws(
      () => translation.addProvider(
        { __meta: { name: 'another-translation-provider' } },
        { name: 'anotherFake' }
      ),
      { cause: 'interfaceNotImplemented' }
    );
    assert.throws(
      () => translation.addProvider(
        {
          __meta: { name: 'another-translation-provider' },
          translate() {}
        },
        { name: 'anotherFake' }
      ),
      { cause: 'interfaceNotImplemented' }
    );
    assert.throws(
      () => translation.addProvider(
        {
          __meta: { name: 'another-translation-provider' },
          getSupportedLanguages() {}
        },
        { name: 'anotherFake' }
      ),
      { cause: 'interfaceNotImplemented' }
    );
    assert.throws(
      () => translation.addProvider(
        {
          __meta: { name: 'another-translation-provider' },
          translate() {},
          getSupportedLanguages() {}
        },
        { name: 'fake' }
      ),
      { cause: 'duplicate' }
    );
  });

  it('should get a translation provider by its name', async function () {
    const translation = apos.modules['@apostrophecms/translation'];

    assert.deepEqual(translation.getProvider('fake'), {
      name: 'fake',
      label: 'Fake Provider',
      module: 'fake-translation-provider'
    });
    assert.equal(translation.getProvider('anotherFake'), undefined);
  });

  it('should get the first provider if no name is provided', async function () {
    const translation = apos.modules['@apostrophecms/translation'];

    assert.deepEqual(translation.getProvider(), {
      name: 'fake',
      label: 'Fake Provider',
      module: 'fake-translation-provider'
    });
  });

  it('should get the provider module by its name', async function () {
    const translation = apos.modules['@apostrophecms/translation'];

    assert.deepEqual(translation.getProviderModule('fake'), apos.fakeProvider);
    assert.equal(translation.getProviderModule('anotherFake'), undefined);
  });

  it('should get the first provider module if no name is provided', async function () {
    const translation = apos.modules['@apostrophecms/translation'];

    assert.deepEqual(translation.getProviderModule(), apos.fakeProvider);
  });

  it('should get browser data', async function () {
    const translation = apos.modules['@apostrophecms/translation'];
    const req = apos.task.getReq();

    assert.deepEqual(translation.getBrowserData(req), {
      action: '/api/v1/@apostrophecms/translation',
      enabled: true,
      providers: [
        {
          name: 'fake',
          label: 'Fake Provider'
        }
      ]
    });
  });

  it('should invoke translation on beforeLocalize', async function () {
    const translation = apos.modules['@apostrophecms/translation'];
    const handler = translation.handlers['@apostrophecms/doc-type:beforeLocalize']
      .translate;

    assert(handler);

    const req = apos.task.getReq({
      query: {
        aposTranslateTargets: [ 'es', 'fr' ]
      }
    });
    const doc = {
      _id: '123',
      title: 'Hello World'
    };
    const source = 'en';
    const target = 'es';
    const existing = false;

    await handler(req, doc, {
      source,
      target,
      existing
    });
    assert.equal(doc.title, 'fake-en-es-Hello World-translated');
  });

  it('should skip translation on beforeLocalize if no providers', async function () {
    const translation = apos.modules['@apostrophecms/translation'];
    const providers = translation.providers;
    translation.providers = [];
    const handler = translation.handlers['@apostrophecms/doc-type:beforeLocalize']
      .translate;

    const savedNotify = apos.notify;
    let notifyCallArgs = null;
    apos.notify = function (...args) {
      notifyCallArgs = args;
    };

    assert(handler);

    const req = apos.task.getReq({
      query: {
        aposTranslateTargets: [ 'es', 'fr' ]
      }
    });
    const doc = {
      _id: '123',
      title: 'Hello World'
    };
    const source = 'en';
    const target = 'es';
    const existing = false;

    await handler(req, doc, {
      source,
      target,
      existing
    });
    translation.providers = providers;
    apos.notify = savedNotify;

    assert.equal(doc.title, 'Hello World');
    assert.equal(notifyCallArgs, null);
  });

  it('should skip translation on beforeLocalize if disabled', async function () {
    const translation = apos.modules['@apostrophecms/translation'];
    translation.options.enabled = false;
    const handler = translation.handlers['@apostrophecms/doc-type:beforeLocalize']
      .translate;

    const savedNotify = apos.notify;
    let notifyCallArgs = null;
    apos.notify = function (...args) {
      notifyCallArgs = args;
    };

    assert(handler);

    const req = apos.task.getReq({
      query: {
        aposTranslateTargets: [ 'es', 'fr' ]
      }
    });
    const doc = {
      _id: '123',
      title: 'Hello World'
    };
    const source = 'en';
    const target = 'es';
    const existing = false;

    await handler(req, doc, {
      source,
      target,
      existing
    });
    translation.options.enabled = true;
    apos.notify = savedNotify;

    assert.equal(doc.title, 'Hello World');
    assert.equal(notifyCallArgs, null);
  });

  it('should skip translation on beforeLocalize if bad provider', async function () {
    const translation = apos.modules['@apostrophecms/translation'];
    const handler = translation.handlers['@apostrophecms/doc-type:beforeLocalize']
      .translate;

    const savedNotify = apos.notify;
    let notifyCallArgs = null;
    apos.notify = function (...args) {
      notifyCallArgs = args;
    };

    assert(handler);

    const req = apos.task.getReq({
      query: {
        aposTranslateTargets: [ 'es', 'fr' ],
        aposTranslateProvider: 'badProvider'
      }
    });
    const doc = {
      _id: '123',
      title: 'Hello World'
    };
    const source = 'en';
    const target = 'es';
    const existing = false;

    await handler(req, doc, {
      source,
      target,
      existing
    });
    apos.notify = savedNotify;

    assert.equal(doc.title, 'Hello World');
    assert.deepEqual(notifyCallArgs, [
      req,
      'Translation provider not found. Page "Hello World" was not translated.',
      {
        type: 'danger',
        dismiss: true
      }
    ]);
  });

  it('should skip translation on beforeLocalize if no target match', async function () {
    const translation = apos.modules['@apostrophecms/translation'];
    const handler = translation.handlers['@apostrophecms/doc-type:beforeLocalize']
      .translate;
    const savedNotify = apos.notify;
    let notifyCallArgs = null;
    apos.notify = function (...args) {
      notifyCallArgs = args;
    };

    assert(handler);

    const req = apos.task.getReq({
      query: {
        aposTranslateTargets: [ 'fr' ],
        aposTranslateProvider: 'fake'
      }
    });
    const doc = {
      _id: '123',
      title: 'Hello World'
    };
    const source = 'en';
    const target = 'es';
    const options = {};

    await handler(req, doc, source, target, options);
    apos.notify = savedNotify;

    assert.equal(doc.title, 'Hello World');
    assert.equal(notifyCallArgs, null);
  });

  describe('API', function () {
    let jar = null;

    before(async function () {
      jar = apos.http.jar();
      await t.createAdmin(apos, {
        username: 'admin',
        password: 'admin'
      });
      await t.createUser(apos, 'editor', {
        username: 'editor',
        password: 'editor'
      });
      await t.createUser(apos, 'guest', {
        username: 'guest',
        password: 'guest'
      });
    });

    async function login(role = 'admin') {
      jar = await t.loginAs(apos, role);
      const page = await apos.http.get('/', {
        jar
      });
      assert(page.match(/logged in/));
    }

    it('should not get supported languages when not authorized', async function () {
      jar = apos.http.jar();
      await assert.rejects(
        async () => apos.http.get(
          '/api/v1/@apostrophecms/translation/languages',
          {
            jar,
            qs: {
              provider: 'fake',
              source: [ 'en' ],
              target: [ 'es' ]
            }
          }
        ),
        {
          status: 404
        }
      );

      await login('guest');
      await assert.rejects(
        async () => apos.http.get(
          '/api/v1/@apostrophecms/translation/languages',
          {
            jar,
            qs: {
              provider: 'fake',
              source: [ 'en' ],
              target: [ 'es' ]
            }
          }
        ),
        {
          status: 404
        }
      );
      await t.logout(apos, 'guest', 'guest', jar);
      jar = apos.http.jar();
    });

    it('should get supported languages when authorized', async function () {
      await login('editor');

      {
        const res = await apos.http.get(
          '/api/v1/@apostrophecms/translation/languages',
          {
            jar,
            qs: {
              // Test without provider to get the first available
              source: [ 'en' ],
              // Don't get confused, `et` stands for
              // Extra- Terrestrial(E.T.)!
              target: [ 'es', 'et' ]
            }
          }
        );

        assert.deepEqual(res, {
          source: [
            {
              code: 'en',
              supported: true
            }
          ],
          target: [
            {
              code: 'es',
              supported: true
            },
            {
              code: 'et',
              supported: false
            }
          ]
        });
      }

      await t.logout(apos, 'editor', 'editor', jar);
      await login('admin');
      {
        const res = await apos.http.get(
          '/api/v1/@apostrophecms/translation/languages',
          {
            jar,
            qs: {
              provider: 'fake',
              source: [ 'en' ],
              // Don't get confused, `et` stands for
              // Extra- Terrestrial(E.T.)!
              target: [ 'es', 'et' ]
            }
          }
        );

        assert.deepEqual(res, {
          source: [
            {
              code: 'en',
              supported: true
            }
          ],
          target: [
            {
              code: 'es',
              supported: true
            },
            {
              code: 'et',
              supported: false
            }
          ]
        });

        await t.logout(apos, 'admin', 'admin', jar);
        jar = apos.http.jar();
      }
    });

    it('should validate the provider name', async function () {
      await login('admin');
      await assert.rejects(
        async () => apos.http.get(
          '/api/v1/@apostrophecms/translation/languages',
          {
            jar,
            qs: {
              provider: 'badProvider',
              source: [ 'en' ],
              target: [ 'es' ]
            }
          }
        ),
        {
          status: 400
        }
      );
    });
  });
});
