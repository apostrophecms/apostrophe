const t = require('../test-lib/test.js');
const assert = require('node:assert/strict');

describe('Layout Widget — gap via styles', function () {
  this.timeout(t.timeout);

  describe('Styles helpers (server)', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/styles': {}
        }
      });
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('exposes the layoutGap preset with the layoutGapDefault marker', function () {
      const preset = apos.styles.getPreset('layoutGap');
      assert.ok(preset, 'layoutGap preset should be registered');
      assert.equal(preset.type, 'range');
      assert.equal(preset.min, 0);
      assert.equal(preset.max, 64);
      assert.equal(preset.def, 24);
      assert.equal(preset.unit, 'px');
      assert.equal(preset.property, '--apos-layout-gap');
      assert.equal(preset.selector, ':root');
      assert.equal(preset.layoutGapDefault, true);
    });

    it('fieldsWithProperty enumerates fields by CSS property (incl. nested)', function () {
      const schema = [
        {
          name: 'gap',
          type: 'range',
          property: 'gap'
        },
        {
          name: 'wrap',
          type: 'object',
          schema: [
            {
              name: 'innerGap',
              type: 'range',
              property: 'gap'
            },
            {
              name: 'color',
              type: 'color',
              property: 'background-color'
            }
          ]
        }
      ];
      assert.deepEqual(
        apos.styles.fieldsWithProperty(schema, 'gap'),
        [ 'gap', 'wrap.innerGap' ]
      );
      assert.deepEqual(
        apos.styles.fieldsWithProperty(schema, 'background-color'),
        [ 'wrap.color' ]
      );
      assert.deepEqual(apos.styles.fieldsWithProperty([], 'gap'), []);
      assert.deepEqual(apos.styles.fieldsWithProperty(null, 'gap'), []);
    });

    it('getFieldByPath resolves top-level and nested (dotted) paths', function () {
      const innerGap = {
        name: 'innerGap',
        type: 'range',
        property: 'gap',
        unit: 'px'
      };
      const wrap = {
        name: 'wrap',
        type: 'object',
        schema: [ innerGap ]
      };
      const gap = {
        name: 'gap',
        type: 'range',
        property: 'gap'
      };
      const schema = [ gap, wrap ];

      assert.equal(apos.styles.getFieldByPath(schema, 'gap'), gap);
      assert.equal(apos.styles.getFieldByPath(schema, 'wrap'), wrap);
      assert.equal(apos.styles.getFieldByPath(schema, 'wrap.innerGap'), innerGap);
      // Missing segments
      assert.equal(apos.styles.getFieldByPath(schema, 'nope'), null);
      assert.equal(apos.styles.getFieldByPath(schema, 'wrap.nope'), null);
      // Walking into a leaf (no `.schema`) must not throw
      assert.equal(apos.styles.getFieldByPath(schema, 'gap.foo'), null);
      // Invalid inputs
      assert.equal(apos.styles.getFieldByPath(null, 'gap'), null);
      assert.equal(apos.styles.getFieldByPath(schema, ''), null);
    });

    it('fieldsWithMarker returns names of fields carrying a true marker', function () {
      const schema = [
        {
          name: 'a',
          layoutGapDefault: true
        },
        { name: 'b' },
        {
          name: 'c',
          layoutGapDefault: false
        },
        {
          name: 'wrap',
          type: 'object',
          schema: [
            {
              name: 'inner',
              layoutGapDefault: true
            },
            {
              name: 'other',
              layoutGapDefault: false
            }
          ]
        }
      ];
      assert.deepEqual(
        apos.styles.fieldsWithMarker(schema, 'layoutGapDefault'),
        [ 'a', 'wrap.inner' ]
      );
      assert.deepEqual(apos.styles.fieldsWithMarker([], 'x'), []);
    });

    it('rejectLayoutGapPresetOnSchema throws on offending fields', function () {
      assert.throws(
        () => apos.styles.rejectLayoutGapPresetOnSchema(
          [ {
            name: 'siteGap',
            layoutGapDefault: true
          } ],
          'test-widget'
        ),
        /layoutGap/
      );
      // Throws when the marker lives on a nested object subfield
      assert.throws(
        () => apos.styles.rejectLayoutGapPresetOnSchema(
          [ {
            name: 'wrap',
            type: 'object',
            schema: [ {
              name: 'siteGap',
              layoutGapDefault: true
            } ]
          } ],
          'test-widget'
        ),
        /layoutGap/
      );
      // Must not throw on a clean schema
      apos.styles.rejectLayoutGapPresetOnSchema(
        [ {
          name: 'gap',
          property: 'gap'
        } ],
        'test-widget'
      );
    });
  });

  describe('Widget schema validation', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/styles': {}
        }
      });
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('expandStyles + rejectLayoutGapPresetOnSchema blocks the layoutGap preset on widget configs', function () {
      const expanded = apos.styles.expandStyles({ siteGap: 'layoutGap' });
      const schema = Object.entries(expanded).map(([ name, field ]) => ({
        name,
        ...field
      }));
      assert.throws(
        () => apos.styles.rejectLayoutGapPresetOnSchema(schema, 'Widget "x"'),
        /layoutGap/
      );
    });
  });

  describe('Layout-widget detection & resolution', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/styles': {
            styles: {
              add: {
                siteGap: 'layoutGap'
              }
            }
          },
          '@apostrophecms/layout-widget': {
            styles: {
              add: {
                gap: {
                  label: 'Gap',
                  type: 'range',
                  min: 0,
                  max: 64,
                  unit: 'px',
                  property: 'gap'
                }
              }
            }
          }
        }
      });
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('detects the styles layoutGap field name', function () {
      assert.equal(apos.styles.layoutGapFieldName, 'siteGap');
    });

    it('detects the widget gap field name and global enabled flag', function () {
      const lw = apos.modules['@apostrophecms/layout-widget'];
      assert.equal(lw.widgetGapFieldName, 'gap');
      assert.equal(lw.globalGapEnabled, true);
    });

    it('resolveWidgetGap returns null when widget value is absent', function () {
      const lw = apos.modules['@apostrophecms/layout-widget'];
      assert.equal(lw.resolveWidgetGap({}), null);
      assert.equal(lw.resolveWidgetGap({ gap: null }), null);
      assert.equal(lw.resolveWidgetGap({ gap: '' }), null);
    });

    it('resolveWidgetGap appends the field unit to numeric values', function () {
      const lw = apos.modules['@apostrophecms/layout-widget'];
      assert.equal(lw.resolveWidgetGap({ gap: 16 }), '16px');
    });

    it('shouldOmitInlineGap decision matrix', function () {
      const lw = apos.modules['@apostrophecms/layout-widget'];
      // Widget has its own gap → never omit
      assert.equal(
        lw.shouldOmitInlineGap({ gap: 8 }, { aposLayoutGap: 24 }),
        false
      );
      // No widget gap, global enabled → omit (cascade resolves via
      // :root --apos-layout-gap, falling through to the static
      // options.gap default when no saved value).
      assert.equal(
        lw.shouldOmitInlineGap({}, { aposLayoutGap: 24 }),
        true
      );
      assert.equal(
        lw.shouldOmitInlineGap({}, { aposLayoutGap: null }),
        true
      );
      assert.equal(lw.shouldOmitInlineGap({}, {}), true);
      assert.equal(lw.shouldOmitInlineGap({}, null), true);
    });

    it('gapInlineCss prefers widget value, then omits when global enabled', function () {
      const lw = apos.modules['@apostrophecms/layout-widget'];
      const gapInlineCss = lw.__helpers.gapInlineCss;
      // Widget value wins
      assert.equal(
        gapInlineCss({ gap: 12 }, { gap: '1rem' }, { aposLayoutGap: 24 }),
        ' --grid-gap: 12px;'
      );
      // No widget value, global enabled → empty (cascade resolves
      // through :root --apos-layout-gap or static options.gap default)
      assert.equal(
        gapInlineCss({}, { gap: '1rem' }, { aposLayoutGap: 24 }),
        ''
      );
      assert.equal(
        gapInlineCss({}, { gap: '1rem' }, { aposLayoutGap: null }),
        ''
      );
      assert.equal(
        gapInlineCss({}, {}, { aposLayoutGap: null }),
        ''
      );
    });

    it('annotateWidgetForExternalFront adds _gap and _gapHasGlobal', function () {
      const lw = apos.modules['@apostrophecms/layout-widget'];
      const out = lw.annotateWidgetForExternalFront(
        {
          _id: 'w1',
          type: '@apostrophecms/layout',
          gap: 18
        },
        {}
      );
      assert.equal(out._gap, '18px');
      assert.equal(out._gapHasGlobal, true);
    });

    it('parentOptionsForArea passes resolved widget gap to the editor', function () {
      const lw = apos.modules['@apostrophecms/layout-widget'];
      const parentOptionsForArea = lw.__helpers.parentOptionsForArea;
      // Widget value present → carries through as a string with unit
      assert.deepEqual(
        parentOptionsForArea(
          {
            _id: 'w1',
            gap: 18
          },
          { columns: 12 },
          { aposLayoutGap: 24 }
        ),
        {
          columns: 12,
          widgetId: 'w1',
          gap: '18px'
        }
      );
      // Widget value absent + global has value → gap: null (signal omit)
      assert.deepEqual(
        parentOptionsForArea(
          { _id: 'w2' },
          { columns: 12 },
          { aposLayoutGap: 24 }
        ),
        {
          columns: 12,
          widgetId: 'w2',
          gap: null
        }
      );
      // Widget value absent + global enabled → gap: null (signal omit)
      // regardless of whether the global has a saved value.
      assert.deepEqual(
        parentOptionsForArea(
          { _id: 'w3' },
          { columns: 12 },
          { aposLayoutGap: null }
        ),
        {
          columns: 12,
          widgetId: 'w3',
          gap: null
        }
      );
    });
  });

  describe('Layout-widget without global gap configured', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/styles': {},
          '@apostrophecms/layout-widget': {}
        }
      });
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('globalGapEnabled is false when no layoutGap field configured', function () {
      const lw = apos.modules['@apostrophecms/layout-widget'];
      assert.equal(lw.globalGapEnabled, false);
      assert.equal(lw.widgetGapFieldName, null);
    });

    it('gapInlineCss falls back to BC value', function () {
      const lw = apos.modules['@apostrophecms/layout-widget'];
      assert.equal(
        lw.__helpers.gapInlineCss({}, { gap: '1.5rem' }, {}),
        ' --grid-gap: 1.5rem;'
      );
    });
  });

  describe('Layout-widget with nested (dotted) gap field', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/styles': {},
          '@apostrophecms/layout-widget': {
            styles: {
              add: {
                gap: {
                  label: 'Gap',
                  type: 'range',
                  min: 0,
                  max: 64,
                  unit: 'px',
                  property: 'gap'
                }
              }
            }
          }
        }
      });
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('resolveWidgetGap reads from a dotted widgetGapFieldName via apos.util.get', function () {
      const lw = apos.modules['@apostrophecms/layout-widget'];
      const original = lw.widgetGapFieldName;
      const originalSchema = lw.schema;
      // Simulate detection of a nested gap field at `spacing.inner`.
      lw.widgetGapFieldName = 'spacing.inner';
      lw.schema = [ {
        name: 'spacing',
        type: 'object',
        schema: [ {
          name: 'inner',
          type: 'range',
          property: 'gap',
          unit: 'rem'
        } ]
      } ];
      try {
        assert.equal(
          lw.resolveWidgetGap({ spacing: { inner: 2 } }),
          '2rem'
        );
        assert.equal(
          lw.resolveWidgetGap({ spacing: { inner: '3rem' } }),
          '3rem'
        );
        assert.equal(lw.resolveWidgetGap({ spacing: {} }), null);
        assert.equal(lw.resolveWidgetGap({}), null);
      } finally {
        lw.widgetGapFieldName = original;
        lw.schema = originalSchema;
      }
    });
  });

  describe('Layout-widget with widget gap field declaring `def`', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/styles': {},
          '@apostrophecms/layout-widget': {
            styles: {
              add: {
                gap: {
                  label: 'Gap',
                  type: 'range',
                  min: 0,
                  max: 64,
                  def: 24,
                  unit: 'px',
                  property: 'gap'
                }
              }
            }
          }
        }
      });
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('resolveWidgetGap falls back to field.def when widget value is absent', function () {
      const lw = apos.modules['@apostrophecms/layout-widget'];
      assert.equal(lw.resolveWidgetGap({}), '24px');
      assert.equal(lw.resolveWidgetGap({ gap: null }), '24px');
      assert.equal(lw.resolveWidgetGap({ gap: '' }), '24px');
      // Explicit value still wins.
      assert.equal(lw.resolveWidgetGap({ gap: 8 }), '8px');
    });

    it('gapInlineCss emits the def value (no global cascade in play)', function () {
      const lw = apos.modules['@apostrophecms/layout-widget'];
      assert.equal(
        lw.__helpers.gapInlineCss({}, { gap: '1.5rem' }, {}),
        ' --grid-gap: 24px;'
      );
    });

    it('parentOptionsForArea passes the def value to the editor', function () {
      const lw = apos.modules['@apostrophecms/layout-widget'];
      assert.deepEqual(
        lw.__helpers.parentOptionsForArea(
          { _id: 'w1' },
          { columns: 12 },
          {}
        ),
        {
          columns: 12,
          widgetId: 'w1',
          gap: '24px'
        }
      );
    });
  });
});
