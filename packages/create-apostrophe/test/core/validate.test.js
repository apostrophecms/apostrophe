import assert from 'node:assert/strict';
import { assertSafeShortName } from '../../src/core/validate.js';

describe('core/validate', function () {
  it('accepts safe names and returns the value', function () {
    for (const ok of [ 'my-site', 'my_site', 'site1', 'A', 'a-b_c-1' ]) {
      assert.equal(assertSafeShortName(ok), ok);
    }
  });

  it('rejects path-unsafe / malformed names', function () {
    for (const bad of [
      '../evil', 'a/b', 'a\\b', '/abs', '..', '.', 'na me',
      'dot.name', '', 'pwn;rm', undefined, null, 42, {}
    ]) {
      assert.throws(() => assertSafeShortName(bad), TypeError);
    }
  });
});
