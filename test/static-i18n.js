const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;

describe('static i18n', function() {

  after(async function() {
    this.timeout(t.timeout);
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  it('should should exist on the apos object', async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {},
              fr: {
                prefix: '/fr'
              },
              es: {
                prefix: '/es',
                private: true
              }
            }
          }
        },
        example: {
          options: {
            i18n: {}
          }
        },
        'apos-fr': {
          options: {
            i18n: {
              // Legacy technique must work
              ns: 'apostrophe'
            }
          }
        },
        // A base class that contributes some namespaced phrases in the new style way (subdirs)
        'base-type': {
          instantiate: false
        },
        // Also contributes namespaced phrases in the new style way (subdirs)
        // plus default locale phrases in the root i18n folder
        subtype: {
          extend: 'base-type'
        }
      }
    });
    assert(apos.i18n);
    assert(apos.i18n.i18next);
  });

  it('should localize apostrophe namespace phrases in the default locale', function() {
    assert.strictEqual(apos.task.getReq().t('apostrophe:notFoundPageTitle'), '404 - Page not found');
  });

  it('should localize default namespace phrases contributed by a project level module', function() {
    assert.strictEqual(apos.task.getReq().t('projectLevelPhrase'), 'Project Level Phrase');
  });

  it('should merge translations in different languages of the same phrases from @apostrophecms/i18n and a different module', function() {
    assert.strictEqual(apos.task.getReq().t('apostrophe:richTextAlignCenter'), 'Align Center');
  });

  it('should merge translations in different languages of the same phrases from @apostrophecms/i18n and a different module (fr)', function() {
    // je suis désolé re: Google Translate-powered French test, feel free to PR better example
    assert.strictEqual(apos.task.getReq({ locale: 'fr' }).t('apostrophe:richTextAlignCenter'), 'Aligner Le Centre');
  });

  it('should fetch default locale phrases from main i18n dir with no i18n option necessary', function() {
    assert.strictEqual(apos.task.getReq().t('defaultTestOne'), 'Default Test One');
  });

  it('should fetch custom locale phrases from corresponding subdir', function() {
    assert.strictEqual(apos.task.getReq().t('custom:customTestTwo'), 'Custom Test Two From Base Type');
    assert.strictEqual(apos.task.getReq().t('custom:customTestThree'), 'Custom Test Three From Subtype');
  });

  it('last appearance in inheritance + configuration order wins', function() {
    assert.strictEqual(apos.task.getReq().t('custom:customTestOne'), 'Custom Test One From Subtype');
  });

  it('should honor the browser: true flag in the i18n section of an index.js file', function() {
    const browserData = apos.i18n.getBrowserData(apos.task.getReq());
    assert.strictEqual(browserData.i18n.en.custom.customTestOne, 'Custom Test One From Subtype');
  });

  it('should return a 404 HTTP error code when a logged out user tries to access to a content in a private locale', async function() {
    try {
      await apos.http.get('/es');
    } catch (error) {
      assert(error.status === 404);
      return;
    }
    throw new Error('should have thrown 404 error');
  });

});
