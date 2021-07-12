const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;

describe('static i18n', function() {

  after(async function() {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  it('should should exist on the apos object', async function() {
    apos = await t.create({
      root: module,
      modules: {
        example: {
          options: {
            i18n: {}
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

});
