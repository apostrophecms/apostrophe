const t = require('../test-lib/test.js');
const assert = require('node:assert/strict');

describe('Box field', function () {
  this.timeout(t.timeout);

  let apos;
  let toCss;

  before(async function () {
    apos = await t.create({
      root: module
    });
    toCss = apos.modules['@apostrophecms/box-field'].__helpers.toCss;
  });

  after(async function () {
    return t.destroy(apos);
  });

  describe('toCss helper', function () {
    const uniform = {
      top: 24,
      right: 24,
      bottom: 24,
      left: 24
    };
    const nonUniform = {
      top: 32,
      right: 24,
      bottom: 32,
      left: 24
    };

    it('emits a shorthand declaration for a uniform box with %key%', function () {
      assert.equal(toCss(uniform, 'padding-%key%'), 'padding: 24px;');
    });

    it('emits a shorthand declaration for a uniform box without %key%', function () {
      assert.equal(toCss(uniform, 'padding'), 'padding: 24px;');
    });

    it('emits per-side declarations for a non-uniform box with %key%', function () {
      assert.equal(
        toCss(nonUniform, 'padding-%key%'),
        'padding-top: 32px;padding-right: 24px;padding-bottom: 32px;padding-left: 24px;'
      );
    });

    it('emits per-side declarations for a non-uniform box without %key%', function () {
      assert.equal(
        toCss(nonUniform, 'padding'),
        'padding-top: 32px;padding-right: 24px;padding-bottom: 32px;padding-left: 24px;'
      );
    });

    it('returns an empty string when value is undefined', function () {
      assert.equal(toCss(undefined, 'padding'), '');
    });

    it('returns an empty string when property is missing', function () {
      const original = apos.util.warnDevOnce;
      const warnings = [];
      apos.util.warnDevOnce = (...args) => {
        warnings.push(args);
      };
      try {
        assert.equal(toCss(uniform), '');
        assert.equal(toCss(nonUniform), '');
        assert.equal(toCss(uniform, ''), '');
        assert.equal(toCss(uniform, null), '');
        assert.equal(apos.template.templateApos.boxField.toCss(nonUniform), '');
        assert.ok(warnings.length >= 1);
        assert.equal(warnings[0][0], 'box-field-toCss-property');
      } finally {
        apos.util.warnDevOnce = original;
      }
    });
  });
});
