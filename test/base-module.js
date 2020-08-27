const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;

describe('Base Module', function() {

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  it('should be subclassable', async function() {
    apos = await t.create({
      root: module,
      modules: {
        // will push an asset for us to look for later
        '@apostrophecms/test-module-push': {},
        // test the getOption method of modules
        'test-get-option': {},
        'test-get-option-2': {}
      }
    });
    assert(apos.test && apos.test.color === 'red');
  });

  it('should produce correct responses via the getOption method', async function() {
    const mod = apos.modules['test-get-option'];
    const req = apos.task.getReq();
    assert.strictEqual(mod.getOption(req, 'flavors.grape.sweetness'), 20);
    assert.strictEqual(mod.getOption(req, 'flavors.cheese.swarthiness'), undefined);
    assert.strictEqual(mod.getOption(req, 'flavors.grape.ingredients.0'), 'chemicals');
    const markup = await mod.render(req, 'test.html');
    assert(markup.match(/20/));
    assert(markup.match(/yup/));
  });
});
