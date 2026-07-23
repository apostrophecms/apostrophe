const t = require('../test-lib/test.js');
const assert = require('assert/strict');

// The two standard image adapters' declared aspect sets — what the core's
// nearest-match resolves against
const OPENAI = [ '1:1', '3:2', '2:3' ];
const GOOGLE = [ '1:1', '3:4', '4:3', '9:16', '16:9' ];

describe('AI image dials', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    apos = await t.create({
      root: module
    });
  });

  after(async function() {
    await t.destroy(apos);
  });

  describe('aspectRatio', function() {
    const valid = [
      [ 'square', 1 ],
      [ 'portrait', 3 / 4 ],
      [ 'landscape', 4 / 3 ],
      [ '1:1', 1 ],
      [ '16:9', 16 / 9 ],
      [ '2:3', 2 / 3 ],
      [ '1.91:1', 1.91 ]
    ];
    for (const [ aspect, ratio ] of valid) {
      it(`parses "${aspect}"`, function() {
        assert.equal(apos.ai.aspectRatio(aspect), ratio);
      });
    }

    const invalid = [ 'wide', '', '16x9', '16:', ':9', '0:1', '1:0', '-1:2', '16:9:1' ];
    for (const aspect of invalid) {
      it(`rejects ${JSON.stringify(aspect)}`, function() {
        assert.throws(() => apos.ai.aspectRatio(aspect), (e) => e.name === 'invalid');
      });
    }
  });

  describe('resolveAspect nearest-match', function() {
    // [ requested, declared aspects, resolved native aspect ]
    const cases = [
      // named tokens against each standard adapter's set
      [ 'square', OPENAI, '1:1' ],
      [ 'portrait', OPENAI, '2:3' ],
      [ 'landscape', OPENAI, '3:2' ],
      [ 'square', GOOGLE, '1:1' ],
      [ 'portrait', GOOGLE, '3:4' ],
      [ 'landscape', GOOGLE, '4:3' ],
      // explicit W:H — exact when declared, nearest otherwise
      [ '1:1', OPENAI, '1:1' ],
      [ '1:1', GOOGLE, '1:1' ],
      [ '16:9', OPENAI, '3:2' ],
      [ '16:9', GOOGLE, '16:9' ],
      [ '9:16', OPENAI, '2:3' ],
      [ '9:16', GOOGLE, '9:16' ],
      [ '3:2', OPENAI, '3:2' ],
      [ '3:2', GOOGLE, '4:3' ],
      [ '2:1', OPENAI, '3:2' ],
      [ '2:1', GOOGLE, '16:9' ],
      // reciprocal tie → the larger ratio wins
      [ '1:1', [ '3:2', '2:3' ], '3:2' ],
      // larger beats declaration order (2:3 declared first, 3:2 still wins)
      [ '1:1', [ '2:3', '3:2' ], '3:2' ],
      // exact duplicate ratios → declaration order (the first wins)
      [ 'square', [ '1:1', '1:1' ], '1:1' ]
    ];
    for (const [ requested, declared, resolved ] of cases) {
      it(`${requested} in [${declared.join(', ')}] → ${resolved}`, function() {
        assert.equal(apos.ai.resolveAspect(requested, declared), resolved);
      });
    }

    it('an omitted dial resolves to undefined', function() {
      assert.equal(apos.ai.resolveAspect(undefined, OPENAI), undefined);
    });

    it('a model with no declared aspects passes the canonical ratio through', function() {
      // an explicit ratio unchanged, a named token as its canonical 'W:H'
      // — never a named token an adapter would have to decode
      assert.equal(apos.ai.resolveAspect('16:9', undefined), '16:9');
      assert.equal(apos.ai.resolveAspect('portrait', []), '3:4');
      assert.equal(apos.ai.resolveAspect('square', []), '1:1');
    });
  });

  describe('normalizeImageOptions', function() {
    it('defaults count to 1 and leaves unset dials undefined', function() {
      assert.deepEqual(apos.ai.normalizeImageOptions('a watercolor fox'), {
        prompt: 'a watercolor fox',
        count: 1,
        aspect: undefined,
        quality: undefined,
        images: undefined,
        provider: undefined,
        model: undefined,
        signal: undefined
      });
    });

    it('carries the full dial set', function() {
      const result = apos.ai.normalizeImageOptions('a watercolor fox', {
        count: 2,
        aspect: '16:9',
        quality: 'high'
      });
      assert.equal(result.count, 2);
      assert.equal(result.aspect, '16:9');
      assert.equal(result.quality, 'high');
    });

    it('normalizes url and inline image sources for an edit', function() {
      const result = apos.ai.normalizeImageOptions('make the fox wear a red scarf', {
        images: [
          { url: 'https://example.com/fox.png' },
          {
            data: 'aGVsbG8=',
            mediaType: 'image/png',
            extra: 'stripped'
          }
        ]
      });
      assert.deepEqual(result.images, [
        { url: 'https://example.com/fox.png' },
        {
          data: 'aGVsbG8=',
          mediaType: 'image/png'
        }
      ]);
    });

    it('accepts provider and model together', function() {
      const result = apos.ai.normalizeImageOptions('a fox', {
        provider: 'openai',
        model: 'gpt-image-1'
      });
      assert.equal(result.provider, 'openai');
      assert.equal(result.model, 'gpt-image-1');
    });

    it('carries an AbortSignal', function() {
      const { signal } = new AbortController();
      const result = apos.ai.normalizeImageOptions('a fox', { signal });
      assert.equal(result.signal, signal);
    });

    const rejects = [
      [ 'an empty prompt', '', {} ],
      [ 'a non-string prompt', 42, {} ],
      [ 'a non-object options argument', 'a fox', 42 ],
      [ 'an unknown option', 'a fox', { size: '1024x1024' } ],
      [ 'a non-integer count', 'a fox', { count: 1.5 } ],
      [ 'a zero count', 'a fox', { count: 0 } ],
      [ 'a malformed aspect', 'a fox', { aspect: 'wide' } ],
      [ 'an unknown quality', 'a fox', { quality: 'ultra' } ],
      [ 'an empty images array', 'a fox', { images: [] } ],
      [ 'a malformed image source', 'a fox', { images: [ { path: 'x' } ] } ],
      [ 'provider without model', 'a fox', { provider: 'openai' } ],
      [ 'model without provider', 'a fox', { model: 'gpt-image-1' } ],
      [ 'a non-AbortSignal signal', 'a fox', { signal: {} } ]
    ];
    for (const [ label, prompt, options ] of rejects) {
      it(`rejects ${label}`, function() {
        assert.throws(
          () => apos.ai.normalizeImageOptions(prompt, options),
          (e) => e.name === 'invalid'
        );
      });
    }
  });
});
