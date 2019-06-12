let t = require('../test-lib/test.js');
let assert = require('assert');
let apos;

describe('Base Module', function() {

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  it('should be subclassable', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        // will push an asset for us to look for later
        'apostrophe-test-module-push': {},
        // test the getOption method of modules
        'test-get-option': {}
      }
    });
    assert(apos.test && apos.test.color === 'red');
  });

  it('should produce correct responses via the getOption method', async function() {
    let mod = apos.modules['test-get-option'];
    let req = apos.tasks.getReq();
    assert.equal(mod.getOption(req, 'flavors.grape.sweetness'), 20);
    assert.equal(mod.getOption(req, 'flavors.cheese.swarthiness'), undefined);
    assert.equal(mod.getOption(req, 'flavors.grape.ingredients.0'), 'chemicals');
    let markup = await mod.render(req, 'test.html');
    assert(markup.match(/^\s*20\s*$/));
  });
});
