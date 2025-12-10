const assert = require('assert');
const utils = require('../lib/utils');

describe('eslint-config-apostrophe:utils', function () {
  it('should find missing rules', function () {
    const a = [ 1, 2, 3 ];
    const b = [ 3 ];

    const expected = [ 1, 2 ];
    const actual = utils.findMissing(a, b);

    assert.deepEqual(expected, actual);
    assert.notDeepEqual([ 1 ], actual);
  });

  it('should find differences in simple rules', function () {
    const a = {
      foo: 'bar',
      bar: 'baz'
    };

    const b = {
      foo: 'baz',
      bar: 'baz'
    };

    const expected = new Map();
    expected.set('foo', {
      standard: 'bar',
      modified: 'baz'
    });

    const actual = utils.diff(a, b);
    assert.deepEqual(expected, actual);

    expected.set('foo', {
      standard: 'bar',
      modified: 'bar'
    });
    assert.notDeepEqual(expected, actual);
  });

  it('should find differences in complex rules', function () {
    const a = {
      'brace-style': [ 'error', '1tbs', { allowSingleLine: true } ],
      curly: [ 'error', 'multi-line' ]
    };
    const b = {
      'brace-style': [ 'warn', '1tbs' ],
      curly: [ 'warn', 'all' ]
    };

    const expected = new Map();
    expected.set('brace-style', {
      standard: [ 'error', '1tbs', { allowSingleLine: true } ],
      modified: [ 'warn', '1tbs' ]
    });

    expected.set('curly', {
      standard: [ 'error', 'multi-line' ],
      modified: [ 'warn', 'all' ]
    });

    const actual = utils.diff(a, b);
    assert.deepEqual(expected, actual);
  });
});
