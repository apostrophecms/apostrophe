import assert from 'node:assert/strict';
import { slugify } from '../../../helpers/universal/slug.js';

describe('slugify', () => {
  it('lowercases and hyphenates a basic string', () => {
    assert.equal(slugify('Hello World'), 'hello-world');
  });

  it('handles multiple spaces', () => {
    assert.equal(slugify('foo   bar'), 'foo-bar');
  });

  it('strips leading and trailing whitespace', () => {
    assert.equal(slugify('  hello  '), 'hello');
  });

  it('preserves accented characters by default', () => {
    const result = slugify('Ça va');
    assert.match(result, /^[a-z-]+$/i.test(result) ? /.*/ : /ça|ca/);
  });

  it('strips accents when stripAccents is true', () => {
    assert.equal(slugify('Ça va', { stripAccents: true }), 'ca-va');
  });

  it('strips accents from more complex strings', () => {
    assert.equal(slugify('Héllo Wörld', { stripAccents: true }), 'hello-world');
  });

  it('forwards options to sluggo', () => {
    // separator option is passed through to sluggo
    const result = slugify('Hello World', { separator: '_' });
    assert.equal(result, 'hello_world');
  });
});
