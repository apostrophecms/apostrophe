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
              ns: 'apostrophe'
            }
          }
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

  it('should merge translations in different languages of the same phrases from @apostrophecms/i18n and a different module', function() {
    // je suis désolé re: Google Translate-powered French test, feel free to PR better example
    assert.strictEqual(apos.task.getReq({ locale: 'fr' }).t('apostrophe:richTextAlignCenter'), 'Aligner Le Centre');
  });

});
