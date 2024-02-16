const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe.only('Translation', function () {
  let apos;

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
            async translate(text, source, target) {
              return `${text}-${source}-${target}-translated`;
            },
            async getSupportedLanguages(source, target) {
              return {
                source: [
                  {
                    code: 'en',
                    supported: true
                  },
                  {
                    // Don't get confused, `et` stands for
                    // Extra- Terrestrial(E.T.)!
                    code: 'et',
                    supported: false
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

  it('should add a translation provider', async function () {
    const translation = apos.modules['@apostrophecms/translation'];
    const provider = apos.fakeProvider;

    translation.addProvider(provider, {
      label: 'Fake Provider',
      name: 'fake'
    });
    assert.equal(translation.providers.length, 1);
    assert.equal(translation.providers[0].name, 'fake');
  });

});
