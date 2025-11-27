var assert = require("assert");
describe('sluggo', function() {
  var sluggo;
  it('should be successfully initialized', function() {
    sluggo = require('../sluggo.js');
    assert(sluggo);
  });
  it('slugifies a complex unicode string', function() {
    var s = sluggo('@ monkey\'s are elab؉؉orate fools##');
    assert.strictEqual(s, 'monkey-s-are-elab-orate-fools');
  });
  it('slugifies a complex unicode string with allowed punctuation and a different separator', function() {
    var s = sluggo('@ monkey\'s are elab؉؉orate fools##', { separator: ',', allow: '؉'});
    assert.strictEqual(s, 'monkey,s,are,elab؉؉orate,fools');
  });
  it('behaves sensibly with existing slugs', function() {
    var s = sluggo('monkey-s-are-elab-orate-fools');
    assert.strictEqual(s, 'monkey-s-are-elab-orate-fools');
  });
  it('converts to lowercase', function() {
    var s = sluggo('Monkeys Are Elaborate Fools');
    assert.strictEqual(s, 'monkeys-are-elaborate-fools');
  });
  it('behaves sensibly when only the allowed punctuation character is present', function() {
    var s = sluggo('/', { allow: '/' });
    assert.strictEqual(s, '/');
  });
  it('fallback default is none', function() {
    var s = sluggo('@#(*&@', {});
    assert.strictEqual(s, 'none');
    var s = sluggo('', {});
    assert.strictEqual(s, 'none');
    var s = sluggo('test', {});
    assert.strictEqual(s, 'test');
  });
  it('empty string can be passed as default', function() {
    var s = sluggo('@#(*&@', { def: '' });
    assert.strictEqual(s, '');
    var s = sluggo('', { def: '' });
    assert.strictEqual(s, '');
    var s = sluggo('test', { def: '' });
    assert.strictEqual(s, 'test');
  });
  it('allows an array of exceptions', function () {
    var s = sluggo("/@/slug url", { allow: ['/', '@'] })
    assert.strictEqual(s, '/@/slug-url')
  })
});
