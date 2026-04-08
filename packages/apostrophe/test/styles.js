const t = require('../test-lib/test.js');
const assert = require('assert/strict');
const universal = import(
  '../modules/@apostrophecms/styles/ui/apos/universal/render.mjs'
);
const customRulesImport = import(
  '../modules/@apostrophecms/styles/ui/apos/universal/customRules.mjs'
);
const imageHelpersImport = import(
  '../modules/@apostrophecms/styles/ui/apos/universal/backgroundHelpers.mjs'
);

describe('Styles', function () {
  this.timeout(t.timeout);

  describe('Universal Renderer', function () {
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

    it('should export render styles functions', async function () {
      const {
        default: renderStyles, renderGlobalStyles, renderScopedStyles
      } = await universal;
      assert.equal(
        typeof renderStyles,
        'function',
        'Default export should be a function'
      );
      assert.equal(
        typeof renderGlobalStyles,
        'function',
        'renderGlobalStyles should be a function'
      );
      assert.equal(
        typeof renderScopedStyles,
        'function',
        'renderScopedStyles should be a function'
      );
    });

    it('should normalize field', async function () {
      const { NORMALIZERS } = await universal;
      // Basic field
      {
        const field = {
          name: 'testField',
          type: 'string',
          selector: '.test-class',
          property: 'color',
          unit: 'px'
        };
        const actual = NORMALIZERS._(
          field,
          {
            testField: 'red'
          }
        );
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [ '.test-class' ],
            properties: [ 'color' ],
            value: 'red',
            unit: 'px'
          },
          'Basic field should be normalized correctly'
        );
      }

      // Basic field with rootSelector
      {
        const field = {
          name: 'testField',
          type: 'string',
          selector: '.test-class',
          property: 'color',
          unit: 'px'
        };
        const actual = NORMALIZERS._(
          field,
          {
            testField: 'red'
          },
          {
            rootSelector: '#root'
          }
        );
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [ '#root .test-class' ],
            properties: [ 'color' ],
            value: 'red',
            unit: 'px'
          },
          'Basic field with rootSelector should be normalized correctly'
        );
      }

      // Basic field with array selector
      {
        const field = {
          name: 'testField',
          type: 'string',
          selector: [ '.class1', '.class2' ],
          property: 'color',
          unit: 'px'
        };
        const actual = NORMALIZERS._(
          field,
          {
            testField: 'red'
          }
        );
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [ '.class1', '.class2' ],
            properties: [ 'color' ],
            value: 'red',
            unit: 'px'
          },
          'Basic field with array selector should be normalized correctly'
        );
      }

      // Basic field with array property
      {
        const field = {
          name: 'testField',
          type: 'string',
          selector: '.test-class',
          property: [ 'color', 'background-color' ],
          unit: 'px'
        };
        const actual = NORMALIZERS._(
          field,
          {
            testField: 'red'
          }
        );
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [ '.test-class' ],
            properties: [ 'color', 'background-color' ],
            value: 'red',
            unit: 'px'
          },
          'Basic field with array property should be normalized correctly'
        );
      }

      // Basic field with rootSelector and without field selector
      {
        const field = {
          name: 'testField',
          type: 'string',
          property: 'color',
          unit: 'px'
        };
        const actual = NORMALIZERS._(
          field,
          {
            testField: 'red'
          },
          {
            rootSelector: '#root'
          }
        );
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [ '#root' ],
            properties: [ 'color' ],
            value: 'red',
            unit: 'px'
          },
          'Basic field with rootSelector and without field selector should be normalized correctly'
        );
      }

      // Empty, not relevant to styles field, that will be skipped later
      {
        const field = {
          name: 'hasBorder',
          type: 'boolean'
        };
        const actual = NORMALIZERS._(
          field,
          {
            hasBorder: true
          }
        );
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [],
            properties: [],
            value: true,
            unit: ''
          },
          'Empty field should be normalized correctly'
        );
      }
    });

    it('should skip field with skipFalsyValues when value is falsy', async function () {
      const { NORMALIZERS } = await universal;

      // Value 0 with skipFalsyValues: true — should skip
      {
        const field = {
          name: 'blur',
          type: 'range',
          selector: '.bg',
          property: '--bg-blur',
          unit: 'px',
          skipFalsyValues: true
        };
        const actual = NORMALIZERS._(field, { blur: 0 });
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [],
            properties: [],
            value: null,
            unit: ''
          },
          'Field with skipFalsyValues and value 0 should produce empty output'
        );
      }

      // Value null with skipFalsyValues: true — should skip
      {
        const field = {
          name: 'blur',
          type: 'range',
          selector: '.bg',
          property: '--bg-blur',
          unit: 'px',
          skipFalsyValues: true
        };
        const actual = NORMALIZERS._(field, { blur: null });
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [],
            properties: [],
            value: null,
            unit: ''
          },
          'Field with skipFalsyValues and value null should produce empty output'
        );
      }

      // Value undefined with skipFalsyValues: true — should skip
      {
        const field = {
          name: 'blur',
          type: 'range',
          selector: '.bg',
          property: '--bg-blur',
          unit: 'px',
          skipFalsyValues: true
        };
        const actual = NORMALIZERS._(field, {});
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [],
            properties: [],
            value: null,
            unit: ''
          },
          'Field with skipFalsyValues and value undefined should produce empty output'
        );
      }

      // Value empty string with skipFalsyValues: true — should skip
      {
        const field = {
          name: 'blur',
          type: 'range',
          selector: '.bg',
          property: '--bg-blur',
          unit: 'px',
          skipFalsyValues: true
        };
        const actual = NORMALIZERS._(field, { blur: '' });
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [],
            properties: [],
            value: null,
            unit: ''
          },
          'Field with skipFalsyValues and empty string should produce empty output'
        );
      }

      // Truthy value with skipFalsyValues: true — should produce normal output
      {
        const field = {
          name: 'blur',
          type: 'range',
          selector: '.bg',
          property: '--bg-blur',
          unit: 'px',
          skipFalsyValues: true
        };
        const actual = NORMALIZERS._(field, { blur: 7 });
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [ '.bg' ],
            properties: [ '--bg-blur' ],
            value: 7,
            unit: 'px'
          },
          'Field with skipFalsyValues and truthy value should produce normal output'
        );
      }

      // Value 0 without skipFalsyValues — should produce
      // normal output (default behavior)
      {
        const field = {
          name: 'blur',
          type: 'range',
          selector: '.bg',
          property: '--bg-blur',
          unit: 'px'
        };
        const actual = NORMALIZERS._(field, { blur: 0 });
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [ '.bg' ],
            properties: [ '--bg-blur' ],
            value: 0,
            unit: 'px'
          },
          'Field without skipFalsyValues and value 0 should produce normal output'
        );
      }

      // Class field with skipFalsyValues: true and falsy value — should
      // skip (no class toggle)
      {
        const field = {
          name: 'hasBlur',
          type: 'boolean',
          class: 'has-bg-blur',
          skipFalsyValues: true
        };
        const actual = NORMALIZERS._(field, { hasBlur: false });
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [],
            properties: [],
            value: null,
            unit: ''
          },
          'Class field with skipFalsyValues and falsy value should produce empty output'
        );
      }
    });

    it('should handle class + property combo field', async function () {
      const {
        NORMALIZERS, renderScopedStyles
      } = await universal;

      // Both class and property, truthy value — should produce both outputs
      {
        const field = {
          name: 'blur',
          type: 'range',
          selector: '.bg',
          property: '--my-var',
          unit: 'px',
          class: 'my-class'
        };
        const storage = {
          classes: new Set(),
          styles: new Map(),
          inlineVotes: new Set()
        };
        const actual = NORMALIZERS._(field, { blur: 5 }, { storage });
        assert.deepEqual(
          actual.selectors,
          [ '.bg' ],
          'Combo field should have selectors'
        );
        assert.deepEqual(
          actual.properties,
          [ '--my-var' ],
          'Combo field should have properties'
        );
        assert.equal(actual.value, 5, 'Combo field should have value');
        assert.equal(actual.unit, 'px', 'Combo field should have unit');
        assert.ok(
          storage.classes.has('my-class'),
          'Combo field should apply the class toggle'
        );
      }

      // Only class, no property — should apply class only (existing behavior)
      {
        const field = {
          name: 'active',
          type: 'boolean',
          class: 'is-active'
        };
        const storage = {
          classes: new Set(),
          styles: new Map(),
          inlineVotes: new Set()
        };
        const actual = NORMALIZERS._(field, { active: true }, { storage });
        assert.deepEqual(actual.properties, [], 'Class-only field should have no properties');
        assert.ok(
          storage.classes.has('is-active'),
          'Class-only field should apply the class'
        );
      }

      // Only property, no class — should produce CSS only (existing behavior)
      {
        const field = {
          name: 'blur',
          type: 'range',
          selector: '.bg',
          property: '--my-var',
          unit: 'px'
        };
        const storage = {
          classes: new Set(),
          styles: new Map(),
          inlineVotes: new Set()
        };
        const actual = NORMALIZERS._(field, { blur: 5 }, { storage });
        assert.deepEqual(actual.properties, [ '--my-var' ], 'Property-only field should have properties');
        assert.equal(storage.classes.size, 0, 'Property-only field should not add classes');
      }

      // Full render: class + property + skipFalsyValues, value = 0 — neither
      // class nor CSS
      {
        const schema = [
          {
            name: 'blur',
            type: 'range',
            selector: '.bg',
            property: '--my-var',
            unit: 'px',
            class: 'has-bg-blur',
            skipFalsyValues: true
          }
        ];
        const result = renderScopedStyles(schema, { blur: 0 }, { rootSelector: '#id' });
        assert.equal(result.css, '', 'skipFalsyValues + combo with 0 should produce no CSS');
        assert.deepEqual(result.classes, [], 'skipFalsyValues + combo with 0 should produce no classes');
      }

      // Full render: class + property + skipFalsyValues, truthy value — both
      // class and CSS
      {
        const schema = [
          {
            name: 'blur',
            type: 'range',
            selector: '.bg',
            property: '--my-var',
            unit: 'px',
            class: 'has-bg-blur',
            skipFalsyValues: true
          }
        ];
        const result = renderScopedStyles(schema, { blur: 10 }, { rootSelector: '#id' });
        assert.ok(
          result.css.includes('--my-var: 10px'),
          'skipFalsyValues + combo with truthy value should produce CSS'
        );
        assert.ok(
          result.classes.includes('has-bg-blur'),
          'skipFalsyValues + combo with truthy value should produce class'
        );
      }
    });

    it('should dispatch object field with customType to custom rule', async function () {
      const { renderScopedStyles } = await universal;
      const customRules = (await customRulesImport).default;

      // Register a mock custom rule
      customRules._testObjectRule = function ({
        field, subfields, options
      }) {
        // Consume only 'color' subfield, leave 'size' for normal processing
        const colorSub = subfields.color;
        const rules = [];
        if (colorSub?.value) {
          rules.push(`background-color: ${colorSub.value}`);
        }
        return {
          rules,
          processedFields: [ 'color' ]
        };
      };

      try {
        const schema = [
          {
            name: 'bg',
            type: 'object',
            customType: '_testObjectRule',
            selector: '.bg',
            schema: [
              {
                name: 'color',
                type: 'color',
                property: '--bg-color'
              },
              {
                name: 'size',
                type: 'range',
                property: '--bg-size',
                unit: 'px'
              }
            ]
          }
        ];
        const result = renderScopedStyles(
          schema,
          {
            bg: {
              color: '#ff0000',
              size: 12
            }
          },
          { rootSelector: '#id' }
        );

        // Custom rule's output should be present
        assert.ok(
          result.css.includes('background-color: #ff0000'),
          'Custom rule should produce its CSS declarations'
        );
        // 'color' was consumed by rule — should NOT appear as standard --bg-color
        assert.ok(
          !result.css.includes('--bg-color'),
          'Consumed subfield should not be double-processed'
        );
        // 'size' was NOT consumed — should be processed normally
        assert.ok(
          result.css.includes('--bg-size: 12px'),
          'Non-consumed subfield should be processed normally'
        );
      } finally {
        delete customRules._testObjectRule;
      }
    });

    it('should dispatch non-object field with customType to custom rule', async function () {
      const { renderScopedStyles } = await universal;
      const customRules = (await customRulesImport).default;

      customRules._testScalarRule = function ({
        field, subfields, options
      }) {
        return {
          rules: [ `--custom: ${field.value}${field.unit}` ],
          processedFields: []
        };
      };

      try {
        const schema = [
          {
            name: 'myVal',
            type: 'range',
            customType: '_testScalarRule',
            selector: '.target',
            property: '--my-val',
            unit: 'px'
          }
        ];
        const result = renderScopedStyles(
          schema,
          { myVal: 42 },
          { rootSelector: '#id' }
        );

        assert.ok(
          result.css.includes('--custom: 42px'),
          'Non-object customType should produce CSS from custom rule'
        );
        // Standard extract should NOT run (no --my-val output)
        assert.ok(
          !result.css.includes('--my-val:'),
          'Non-object customType should not go through standard extract'
        );
      } finally {
        delete customRules._testScalarRule;
      }
    });

    it('should skip unknown customType with console error', async function () {
      const { renderScopedStyles } = await universal;
      // eslint-disable-next-line no-console
      const originalError = console.error;
      let errorMsg = '';
      // eslint-disable-next-line no-console
      console.error = (msg) => {
        errorMsg = msg;
      };

      try {
        const schema = [
          {
            name: 'myVal',
            type: 'range',
            customType: '_nonExistentRule',
            selector: '.target',
            property: '--my-val',
            unit: 'px'
          }
        ];
        const result = renderScopedStyles(
          schema,
          { myVal: 5 },
          { rootSelector: '#id' }
        );

        assert.ok(
          errorMsg.includes('Unknown customType "_nonExistentRule"'),
          'Should log error for unknown customType'
        );
        assert.equal(result.css, '', 'Unknown customType should produce no CSS');
      } finally {
        // eslint-disable-next-line no-console
        console.error = originalError;
      }
    });

    it('should thread engine options to custom rule', async function () {
      const { renderScopedStyles } = await universal;
      const customRules = (await customRulesImport).default;
      let receivedOptions = null;

      customRules._testOptionsRule = function ({
        field, subfields, options
      }) {
        receivedOptions = options;
        return {
          rules: [],
          processedFields: []
        };
      };

      try {
        const schema = [
          {
            name: 'myVal',
            type: 'range',
            customType: '_testOptionsRule',
            selector: '.target',
            property: '--my-val',
            unit: 'px'
          }
        ];
        renderScopedStyles(
          schema,
          { myVal: 1 },
          {
            rootSelector: '#id',
            imageSizes: [ {
              name: 'small',
              width: 100
            } ]
          }
        );

        assert.ok(receivedOptions, 'Custom rule should receive options');
        assert.deepEqual(
          receivedOptions.imageSizes,
          [ {
            name: 'small',
            width: 100
          } ],
          'Engine options should be threaded to custom rule'
        );
        // Internal render keys should NOT leak
        assert.equal(
          receivedOptions.rootSelector,
          undefined,
          'Internal render keys should not leak to custom rule options'
        );
      } finally {
        delete customRules._testOptionsRule;
      }
    });

    it('should normalize object field (UI container)', async function () {
      const { NORMALIZERS } = await universal;
      const subField1 = {
        name: 'subField1',
        type: 'string',
        selector: '.sub-class1',
        property: 'color',
        unit: 'px'
      };
      const subField2 = {
        name: 'subField2',
        type: 'string',
        selector: '.sub-class2',
        property: 'background-color',
        unit: 'px'
      };
      const field = {
        name: 'testObjectField',
        type: 'object',
        schema: [ subField1, subField2 ]
      };
      const { subfields: actualSubfields, ...actualObject } = NORMALIZERS.object(
        field,
        {
          testObjectField: {
            subField1: 'blue',
            subField2: 'green'
          }
        }
      );
      assert.deepEqual(
        actualObject,
        {
          raw: field,
          selectors: [],
          properties: [],
          value: {
            subField1: 'blue',
            subField2: 'green'
          }
        },
        'Object field container should be normalized correctly'
      );
      assert.deepEqual(
        actualSubfields.length,
        2,
        'Object field should have two subfields'
      );
      assert.deepEqual(
        actualSubfields[0],
        {
          raw: subField1,
          selectors: [ '.sub-class1' ],
          properties: [ 'color' ],
          value: 'blue',
          unit: 'px'
        },
        'First subfield should be normalized correctly'
      );
      assert.deepEqual(
        actualSubfields[1],
        {
          raw: subField2,
          selectors: [ '.sub-class2' ],
          properties: [ 'background-color' ],
          value: 'green',
          unit: 'px'
        },
        'Second subfield should be normalized correctly'
      );
    });

    it('should normalize object field with deep selectors', async function () {
      const { NORMALIZERS } = await universal;
      const isEnabled = {
        name: 'isEnabled',
        type: 'boolean'
      };
      const subField1 = {
        name: 'subField1',
        type: 'string',
        selector: '.sub-class1',
        property: 'color',
        unit: 'px'
      };
      const subField2 = {
        name: 'subField2',
        type: 'string',
        property: 'background-color',
        unit: 'px'
      };
      const field = {
        name: 'testObjectField',
        type: 'object',
        selector: '.object-class',
        valueTemplate: '%subField1% %subField2%',
        schema: [ isEnabled, subField1, subField2 ]
      };
      const actual = NORMALIZERS.object(
        field,
        {
          testObjectField: {
            isEnabled: true,
            subField1: 'blue',
            subField2: 'green'
          }
        },
        {
          rootSelector: '#root'
        }
      );

      const { subfields: actualSubfieds, ...actualObject } = actual;
      assert.deepEqual(
        actualObject,
        {
          raw: field,
          selectors: [ '#root .object-class' ],
          properties: [],
          value: {
            isEnabled: true,
            subField1: 'blue',
            subField2: 'green'
          },
          valueTemplate: '%subField1% %subField2%'
        },
        'Object field root field should be normalized correctly'
      );
      assert.equal(
        actualSubfieds.length,
        2,
        'Object field should have two subfields'
      );
      assert.deepEqual(
        actualSubfieds[0],
        {
          raw: subField1,
          selectors: [ '#root .object-class .sub-class1' ],
          properties: [ 'color' ],
          value: 'blue',
          unit: 'px'
        },
        'First subfield should be normalized correctly'
      );
      assert.deepEqual(
        actualSubfieds[1],
        {
          raw: subField2,
          selectors: [ '#root .object-class' ],
          properties: [ 'background-color' ],
          value: 'green',
          unit: 'px'
        },
        'Second subfield should be normalized correctly'
      );
    });

    it('should normalize object field with only root selector', async function () {
      const { NORMALIZERS } = await universal;
      const subField1 = {
        name: 'subField1',
        type: 'string',
        property: '--primary-color'
      };
      const field = {
        name: 'testObjectField',
        type: 'object',
        schema: [ subField1 ]
      };
      const actual = NORMALIZERS.object(
        field,
        {
          testObjectField: {
            subField1: 'blue'
          }
        },
        {
          rootSelector: ':root'
        }
      );
      const { subfields: actualSubfieds, ...actualObject } = actual;
      assert.deepEqual(
        actualObject,
        {
          raw: field,
          selectors: [ ':root' ],
          properties: [],
          value: {
            subField1: 'blue'
          }
        },
        'Object field root field should be normalized correctly'
      );
      assert.equal(
        actualSubfieds.length,
        1,
        'Object field should have one subfield'
      );
      assert.deepEqual(
        actualSubfieds[0],
        {
          raw: subField1,
          selectors: [ ':root' ],
          properties: [ '--primary-color' ],
          value: 'blue',
          unit: ''
        },
        'First subfield should be normalized correctly'
      );
    });

    it('should export createRenderer factory', async function () {
      const { createRenderer } = await universal;
      assert.equal(
        typeof createRenderer,
        'function',
        'createRenderer should be a function'
      );

      const renderer = createRenderer({
        imageSizes: [ {
          name: 'small',
          width: 100
        } ]
      });
      assert.equal(
        typeof renderer.renderGlobalStyles,
        'function',
        'renderer.renderGlobalStyles should be a function'
      );
      assert.equal(
        typeof renderer.renderScopedStyles,
        'function',
        'renderer.renderScopedStyles should be a function'
      );
    });

    it('should thread createRenderer memoized options to custom rule', async function () {
      const { createRenderer } = await universal;
      const customRules = (await customRulesImport).default;
      let receivedOptions = null;

      customRules._testMemoRule = function ({ options }) {
        receivedOptions = options;
        return {
          rules: [],
          processedFields: []
        };
      };

      try {
        const schema = [
          {
            name: 'val',
            type: 'range',
            customType: '_testMemoRule',
            selector: '.t',
            property: '--v',
            unit: 'px'
          }
        ];

        const renderer = createRenderer({
          imageSizes: [ {
            name: 'full',
            width: 1140,
            height: 760
          } ]
        });
        renderer.renderScopedStyles(
          schema,
          { val: 1 },
          { rootSelector: '#id' }
        );

        assert.ok(receivedOptions, 'Custom rule should receive options');
        assert.deepEqual(
          receivedOptions.imageSizes,
          [ {
            name: 'full',
            width: 1140,
            height: 760
          } ],
          'Memoized imageSizes should be threaded to custom rule'
        );
      } finally {
        delete customRules._testMemoRule;
      }
    });

    it('should allow createRenderer call options to override memoized options', async function () {
      const { createRenderer } = await universal;
      const customRules = (await customRulesImport).default;
      let receivedOptions = null;

      customRules._testOverrideRule = function ({ options }) {
        receivedOptions = options;
        return {
          rules: [],
          processedFields: []
        };
      };

      try {
        const schema = [
          {
            name: 'val',
            type: 'range',
            customType: '_testOverrideRule',
            selector: '.t',
            property: '--v',
            unit: 'px'
          }
        ];

        const renderer = createRenderer({
          imageSizes: [ {
            name: 'small',
            width: 100
          } ]
        });
        renderer.renderScopedStyles(
          schema,
          { val: 1 },
          {
            rootSelector: '#id',
            imageSizes: [ {
              name: 'large',
              width: 1000
            } ]
          }
        );

        assert.deepEqual(
          receivedOptions.imageSizes,
          [ {
            name: 'large',
            width: 1000
          } ],
          'Call-level imageSizes should override memoized imageSizes'
        );
      } finally {
        delete customRules._testOverrideRule;
      }
    });

    it('should work without imageSizes (backward compatible)', async function () {
      const { renderGlobalStyles, renderScopedStyles } = await universal;

      const schema = [
        {
          name: 'color',
          type: 'color',
          selector: ':root',
          property: '--color'
        }
      ];

      const globalResult = renderGlobalStyles(schema, { color: '#abc' });
      assert.ok(
        globalResult.css.includes('--color: #abc'),
        'renderGlobalStyles should work without imageSizes'
      );

      const scopedResult = renderScopedStyles(schema, { color: '#abc' }, {
        rootSelector: '#id'
      });
      assert.ok(
        scopedResult.css.includes('--color: #abc'),
        'renderScopedStyles should work without imageSizes'
      );
    });

    it('should include imageSizes in attachment getBrowserData', function () {
      const browserData = apos.attachment.getBrowserData(apos.task.getReq());
      assert.ok(
        Array.isArray(browserData.imageSizes),
        'imageSizes should be an array in browser data'
      );
      assert.ok(
        browserData.imageSizes.length > 0,
        'imageSizes should not be empty'
      );
      assert.ok(
        browserData.imageSizes[0].name,
        'Each image size should have a name'
      );
      assert.ok(
        browserData.imageSizes[0].width,
        'Each image size should have a width'
      );
      assert.deepEqual(
        browserData.imageSizes,
        apos.attachment.imageSizes,
        'Browser data imageSizes should match server-side imageSizes'
      );
    });

    describe('Image helpers (customRules)', function () {
      let extractImageData;
      let buildResponsiveImageRules;

      before(async function () {
        ({
          extractImageData,
          buildResponsiveImageRules
        } = await imageHelpersImport);
      });

      describe('extractImageData', function () {
        it('should return urls map for a valid image attachment', function () {
          const value = {
            group: 'images',
            _urls: {
              original: '/attachments/abc.original.jpg',
              full: '/attachments/abc.full.jpg',
              max: '/attachments/abc.max.jpg',
              'one-sixth': '/attachments/abc.one-sixth.jpg'
            }
          };
          const result = extractImageData(value);
          assert.deepEqual(
            result,
            value._urls,
            'Should return the _urls map directly'
          );
        });

        it('should return null for non-image group', function () {
          const value = {
            group: 'office',
            _urls: {
              original: '/attachments/doc.pdf'
            }
          };
          assert.equal(
            extractImageData(value),
            null,
            'Office files should return null'
          );
        });

        it('should return null when _urls is missing', function () {
          const value = { group: 'images' };
          assert.equal(
            extractImageData(value),
            null,
            'Missing _urls should return null'
          );
        });

        it('should return null for null/undefined value', function () {
          assert.equal(extractImageData(null), null, 'null should return null');
          assert.equal(extractImageData(undefined), null, 'undefined should return null');
        });

        it('should return urls map for SVG (only original in _urls)', function () {
          const value = {
            group: 'images',
            _urls: {
              original: '/attachments/icon.svg'
            }
          };
          const result = extractImageData(value);
          assert.deepEqual(
            result,
            value._urls,
            'SVG should return the _urls map'
          );
        });

        it('should return urls map regardless of which sizes are present', function () {
          const value = {
            group: 'images',
            _urls: {
              original: '/attachments/abc.original.jpg',
              max: '/attachments/abc.max.jpg',
              'one-third': '/attachments/abc.one-third.jpg'
            }
          };
          const result = extractImageData(value);
          assert.deepEqual(
            result,
            value._urls,
            'Should return the _urls map directly'
          );
        });

        it('should return urls map even with non-standard size names', function () {
          const value = {
            group: 'images',
            _urls: {
              original: '/attachments/abc.original.jpg',
              'custom-size': '/attachments/abc.custom.jpg'
            }
          };
          const result = extractImageData(value);
          assert.deepEqual(
            result,
            value._urls,
            'Should return the _urls map regardless of size names'
          );
        });

        it('should return null when _urls is empty', function () {
          const value = {
            group: 'images',
            _urls: {}
          };
          assert.equal(
            extractImageData(value),
            null,
            'Empty _urls should return null'
          );
        });
      });

      describe('buildResponsiveImageRules', function () {
        it('should return base url rule for single size', function () {
          const urls = {
            original: '/attachments/icon.svg'
          };
          const result = buildResponsiveImageRules('--bg-image', urls);
          assert.deepEqual(result.rules, [
            '--bg-image: url(/attachments/icon.svg)'
          ], 'Should have only base url rule');
          assert.deepEqual(result.mediaRules, [], 'Should have no media rules');
        });

        it('should produce media query breakpoints for multiple sizes', function () {
          const urls = {
            'one-sixth': '/attachments/abc.one-sixth.jpg',
            'one-third': '/attachments/abc.one-third.jpg',
            'one-half': '/attachments/abc.one-half.jpg',
            'two-thirds': '/attachments/abc.two-thirds.jpg',
            full: '/attachments/abc.full.jpg',
            max: '/attachments/abc.max.jpg',
            original: '/attachments/abc.original.jpg'
          };
          const result = buildResponsiveImageRules('--bg-image', urls);
          assert.deepEqual(result.rules, [
            '--bg-image: url(/attachments/abc.max.jpg)'
          ], 'Base rule should use the largest available sized image');
          assert.ok(result.mediaRules.length > 0, 'Should have media rules');
          for (const mr of result.mediaRules) {
            assert.ok(
              mr.query.includes('width'),
              'Media rule query should use range syntax'
            );
            assert.ok(
              mr.rules[0].startsWith('--bg-image: url('),
              'Media rule should set --bg-image'
            );
          }
        });

        it('should not produce media rules that duplicate the default url', function () {
          const urls = {
            full: '/attachments/abc.full.jpg',
            max: '/attachments/abc.max.jpg'
          };
          const result = buildResponsiveImageRules('--bg-image', urls);
          // Base is now max (largest). Mobile BP selects full (≠ base) → emitted.
          // Tablet BP selects max (= base) → skipped.
          for (const mr of result.mediaRules) {
            assert.notEqual(
              mr.rules[0],
              '--bg-image: url(/attachments/abc.max.jpg)',
              'Should not duplicate the base url in a media query'
            );
          }
        });

        it('should use correct property name in declarations', function () {
          const urls = {
            full: '/attachments/abc.full.jpg',
            max: '/attachments/abc.max.jpg',
            'one-third': '/attachments/abc.one-third.jpg'
          };
          const result = buildResponsiveImageRules('--hero-bg-image', urls);
          assert.ok(
            result.rules[0].startsWith('--hero-bg-image:'),
            'Should use provided property name in base rule'
          );
          if (result.mediaRules.length > 0) {
            assert.ok(
              result.mediaRules[0].rules[0].startsWith('--hero-bg-image:'),
              'Should use provided property name in media rules'
            );
          }
        });

        it('should use custom imageSizes when provided', function () {
          const urls = {
            small: '/attachments/abc.small.jpg',
            medium: '/attachments/abc.medium.jpg',
            large: '/attachments/abc.large.jpg'
          };
          const imageSizes = [
            {
              name: 'small',
              width: 400
            },
            {
              name: 'medium',
              width: 1000
            },
            {
              name: 'large',
              width: 1800
            }
          ];
          const result = buildResponsiveImageRules('--bg-image', urls, imageSizes);
          assert.deepEqual(result.rules, [
            '--bg-image: url(/attachments/abc.large.jpg)'
          ], 'Base rule should use largest sized image');
          // With sizes 400, 1000, 1800 and breakpoints 480, 768 (×2 DPR):
          // - 480px → target 960 → best match >= 960 is 1000 (medium)  → emitted
          // - 768px → target 1536 → best match >= 1536 is 1800 (large) = base → skipped
          assert.equal(result.mediaRules.length, 1, 'Only mobile breakpoint should emit');
          assert.ok(
            result.mediaRules[0].rules[0].includes('abc.medium.jpg'),
            'Should use medium image for mobile breakpoint'
          );
          assert.equal(
            result.mediaRules[0].query,
            '(width <= 480px)',
            'Mobile breakpoint should use range query'
          );
        });

        it('should skip original and uncropped entries', function () {
          const urls = {
            original: '/attachments/abc.original.jpg',
            uncropped: { full: '/attachments/abc.uncropped.full.jpg' },
            full: '/attachments/abc.full.jpg',
            'one-third': '/attachments/abc.one-third.jpg'
          };
          const result = buildResponsiveImageRules('--bg-image', urls);
          const allUrls = [
            ...result.rules,
            ...result.mediaRules.flatMap(mr => mr.rules)
          ].join(' ');
          assert.ok(
            !allUrls.includes('original'),
            'Should not reference original in any rule'
          );
          assert.ok(
            !allUrls.includes('uncropped'),
            'Should not reference uncropped in any rule'
          );
        });
      });
    });

    describe('background composite rule (customRules)', function () {
      let renderScopedStyles;

      before(async function () {
        ({ renderScopedStyles } = await universal);
      });

      function makeBackgroundSchema(subfields) {
        return [
          {
            name: 'bg',
            type: 'object',
            customType: 'background',
            selector: '.s-w123',
            property: '--bg',
            schema: [
              {
                name: 'enabled',
                type: 'boolean',
                def: false
              },
              {
                name: 'backgroundType',
                type: 'select',
                def: 'color'
              },
              ...subfields
            ]
          }
        ];
      }

      describe('Color mode', function () {
        it('should produce background-color for valid color', function () {
          const schema = makeBackgroundSchema([
            {
              name: 'color',
              type: 'color'
            }
          ]);
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'color',
                color: '#1a1a2e'
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            result.css.includes('background-color: #1a1a2e'),
            'Should produce background-color declaration'
          );
        });

        it('should produce empty rules when no color is set', function () {
          const schema = makeBackgroundSchema([
            {
              name: 'color',
              type: 'color'
            }
          ]);
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'color',
                color: null
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            !result.css.includes('background-color'),
            'Should not produce background-color when no color set'
          );
        });
      });

      describe('Gradient mode', function () {
        it('should produce linear-gradient with all values', function () {
          const schema = makeBackgroundSchema([
            {
              name: 'gradientStart',
              type: 'color'
            },
            {
              name: 'gradientEnd',
              type: 'color'
            },
            {
              name: 'gradientAngle',
              type: 'range',
              unit: 'deg'
            }
          ]);
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'gradient',
                gradientStart: '#ff0000',
                gradientEnd: '#0000ff',
                gradientAngle: 135
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            result.css.includes('background: linear-gradient(135deg, #ff0000, #0000ff)'),
            'Should produce linear-gradient declaration'
          );
        });

        it('should apply defaults when gradient values are missing', function () {
          const schema = makeBackgroundSchema([
            {
              name: 'gradientStart',
              type: 'color'
            },
            {
              name: 'gradientEnd',
              type: 'color'
            },
            {
              name: 'gradientAngle',
              type: 'range',
              unit: 'deg'
            }
          ]);
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'gradient'
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            result.css.includes('background: linear-gradient(180deg, #000000, #ffffff)'),
            'Should use default gradient values'
          );
        });
      });

      describe('Image mode', function () {
        const imageAttachment = {
          group: 'images',
          _urls: {
            'one-sixth': '/attachments/abc.one-sixth.jpg',
            'one-third': '/attachments/abc.one-third.jpg',
            'one-half': '/attachments/abc.one-half.jpg',
            'two-thirds': '/attachments/abc.two-thirds.jpg',
            full: '/attachments/abc.full.jpg',
            max: '/attachments/abc.max.jpg',
            original: '/attachments/abc.original.jpg'
          }
        };

        function makeImageSchema(extraSubfields = []) {
          return makeBackgroundSchema([
            {
              name: '_image',
              type: 'relationship'
            },
            {
              name: 'overlay',
              type: 'boolean'
            },
            {
              name: 'overlayColor',
              type: 'color'
            },
            {
              name: 'overlayOpacity',
              type: 'range'
            },
            ...extraSubfields
          ]);
        }

        it('should produce CSS variables and background shorthand for valid image', function () {
          const schema = makeImageSchema();
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'image',
                _image: [ { attachment: imageAttachment } ]
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            result.css.includes('--bg-image: url(/attachments/abc.full.jpg)'),
            'Should export --bg-image CSS variable'
          );
          assert.ok(
            result.css.includes('background: var(--bg-image-layer,'),
            'Should produce background shorthand with override hook'
          );
          assert.ok(
            result.css.includes('center / cover no-repeat'),
            'Should include background sizing'
          );
        });

        it('should emit initial values for override hooks to prevent inheritance in nested widgets', function () {
          const schema = makeImageSchema();
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'image',
                _image: [ { attachment: imageAttachment } ]
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            result.css.includes('--bg-image-layer: initial'),
            'Should reset --bg-image-layer to initial for nested widget isolation'
          );
          assert.ok(
            result.css.includes('--bg-overlay-layer: initial'),
            'Should reset --bg-overlay-layer to initial for nested widget isolation'
          );
        });

        it('should produce empty rules when no image is set', function () {
          const schema = makeImageSchema();
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'image',
                _image: []
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            !result.css.includes('--bg-image'),
            'Should not produce image variables when no image set'
          );
        });

        it('should produce empty rules when image has no attachment', function () {
          const schema = makeImageSchema();
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'image',
                _image: [ { title: 'missing attachment' } ]
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            !result.css.includes('--bg-image'),
            'Should not produce image variables when attachment is missing'
          );
        });

        it('should produce overlay CSS variable and layer when overlay is enabled', function () {
          const schema = makeImageSchema();
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'image',
                _image: [ { attachment: imageAttachment } ],
                overlay: true,
                overlayColor: '#000000',
                overlayOpacity: 50
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            result.css.includes('--bg-overlay: linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5))'),
            'Should export --bg-overlay CSS variable'
          );
          assert.ok(
            result.css.includes('var(--bg-overlay-layer, var(--bg-overlay))'),
            'Should include overlay layer with override hook in background'
          );
          assert.ok(
            result.css.includes('var(--bg-image-layer,'),
            'Should include image layer in background'
          );
        });

        it('should not produce overlay when overlay is disabled', function () {
          const schema = makeImageSchema();
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'image',
                _image: [ { attachment: imageAttachment } ],
                overlay: false
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            !result.css.includes('--bg-overlay:'),
            'Should not produce overlay variable when overlay is disabled'
          );
          assert.ok(
            !result.css.includes('var(--bg-overlay-layer,'),
            'Should not produce overlay layer reference in background shorthand when overlay is disabled'
          );
        });

        it('should handle SVG image (only url, no image-set)', function () {
          const svgAttachment = {
            group: 'images',
            _urls: {
              original: '/attachments/icon.svg'
            }
          };
          const schema = makeImageSchema();
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'image',
                _image: [ { attachment: svgAttachment } ]
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            result.css.includes('--bg-image: url(/attachments/icon.svg)'),
            'Should export --bg-image for SVG'
          );
          assert.ok(
            !result.css.includes('@media'),
            'Should not produce media query breakpoints for SVG (single rendition)'
          );
        });
      });

      describe('Partial processing', function () {
        it('should not include blur in processedFields', function () {
          const schema = makeBackgroundSchema([
            {
              name: '_image',
              type: 'relationship'
            },
            {
              name: 'overlay',
              type: 'boolean'
            },
            {
              name: 'overlayColor',
              type: 'color'
            },
            {
              name: 'overlayOpacity',
              type: 'range'
            },
            {
              name: 'blur',
              type: 'range',
              unit: 'px',
              property: '--bg-blur',
              class: 'has-bg-blur',
              skipFalsyValues: true
            }
          ]);
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'image',
                _image: [ {
                  attachment: {
                    group: 'images',
                    _urls: {
                      full: '/attachments/abc.full.jpg',
                      max: '/attachments/abc.max.jpg',
                      original: '/attachments/abc.original.jpg'
                    }
                  }
                } ],
                blur: 7
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            result.css.includes('--bg-blur: 7px'),
            'Blur should be extracted by the engine (not consumed by background rule)'
          );
          assert.ok(
            result.classes.includes('has-bg-blur'),
            'Blur class should be applied by the engine'
          );
        });

        it('should let additional project fields be processed by the engine', function () {
          const schema = makeBackgroundSchema([
            {
              name: 'color',
              type: 'color'
            },
            {
              name: 'textColor',
              type: 'color',
              property: 'color'
            }
          ]);
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'color',
                color: '#1a1a2e',
                textColor: '#ffffff'
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            result.css.includes('color: #ffffff'),
            'Additional fields should be processed by the engine normally'
          );
          assert.ok(
            result.css.includes('background-color: #1a1a2e'),
            'Background rule output should still be present'
          );
        });
      });

      describe('Variable base name', function () {
        it('should use default --bg prefix', function () {
          const schema = [
            {
              name: 'bg',
              type: 'object',
              customType: 'background',
              selector: '.s-w123',
              property: '--bg',
              schema: [
                {
                  name: 'enabled',
                  type: 'boolean',
                  def: false
                },
                {
                  name: 'backgroundType',
                  type: 'select',
                  def: 'color'
                },
                {
                  name: 'color',
                  type: 'color'
                }
              ]
            }
          ];
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'color',
                color: '#abc123'
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            result.css.includes('background-color: #abc123'),
            'Should produce background-color with default prefix'
          );
        });

        it('should use custom prefix for CSS variables', function () {
          const heroAttachment = {
            group: 'images',
            _urls: {
              full: '/attachments/hero.full.jpg',
              max: '/attachments/hero.max.jpg',
              original: '/attachments/hero.original.jpg'
            }
          };
          const schema = [
            {
              name: 'heroBg',
              type: 'object',
              customType: 'background',
              selector: '.s-hero',
              property: '--hero-bg',
              schema: [
                {
                  name: 'enabled',
                  type: 'boolean',
                  def: false
                },
                {
                  name: 'backgroundType',
                  type: 'select',
                  def: 'color'
                },
                {
                  name: '_image',
                  type: 'relationship'
                },
                {
                  name: 'overlay',
                  type: 'boolean'
                },
                {
                  name: 'overlayColor',
                  type: 'color'
                },
                {
                  name: 'overlayOpacity',
                  type: 'range'
                }
              ]
            }
          ];
          const result = renderScopedStyles(
            schema,
            {
              heroBg: {
                enabled: true,
                backgroundType: 'image',
                _image: [ { attachment: heroAttachment } ],
                overlay: true,
                overlayColor: '#ff0000',
                overlayOpacity: 80
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            result.css.includes('--hero-bg-image: url(/attachments/hero.full.jpg)'),
            'Should use custom prefix for image variable'
          );
          assert.ok(
            result.css.includes('--hero-bg-overlay: linear-gradient('),
            'Should use custom prefix for overlay variable'
          );
          assert.ok(
            result.css.includes('var(--hero-bg-overlay-layer,'),
            'Should use custom prefix for overlay hook'
          );
          assert.ok(
            result.css.includes('var(--hero-bg-image-layer,'),
            'Should use custom prefix for image hook'
          );
        });
      });

      describe('Inline vote and media queries', function () {
        const imageAttachment = {
          group: 'images',
          _urls: {
            'one-sixth': '/attachments/abc.one-sixth.jpg',
            'one-third': '/attachments/abc.one-third.jpg',
            'one-half': '/attachments/abc.one-half.jpg',
            'two-thirds': '/attachments/abc.two-thirds.jpg',
            full: '/attachments/abc.full.jpg',
            max: '/attachments/abc.max.jpg',
            original: '/attachments/abc.original.jpg'
          }
        };

        function makeImageSchemaNoSelector(extraSubfields = []) {
          return [
            {
              name: 'bg',
              type: 'object',
              customType: 'background',
              property: '--bg',
              schema: [
                {
                  name: 'enabled',
                  type: 'boolean',
                  def: false
                },
                {
                  name: 'backgroundType',
                  type: 'select',
                  def: 'color'
                },
                {
                  name: 'color',
                  type: 'color'
                },
                {
                  name: '_image',
                  type: 'relationship'
                },
                {
                  name: 'overlay',
                  type: 'boolean'
                },
                {
                  name: 'overlayColor',
                  type: 'color'
                },
                {
                  name: 'overlayOpacity',
                  type: 'range'
                },
                ...extraSubfields
              ]
            }
          ];
        }

        it('should force scoped CSS when media queries are present (no field selector)', function () {
          const schema = makeImageSchemaNoSelector();
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'image',
                _image: [ { attachment: imageAttachment } ]
              }
            },
            { rootSelector: '#w123' }
          );
          // Media queries present → must produce scoped CSS, not inline
          assert.ok(
            result.css.includes('@media'),
            'Should produce media queries for responsive images'
          );
          assert.equal(
            result.inline,
            '',
            'Should not produce inline styles when media queries are present'
          );
          assert.ok(
            result.css.includes('#w123{'),
            'Should scope rules under rootSelector'
          );
        });

        it('should produce inline styles for color mode (no selector, no media queries)', function () {
          const schema = makeImageSchemaNoSelector();
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'color',
                color: '#ff0000'
              }
            },
            { rootSelector: '#w123' }
          );
          assert.ok(
            result.inline.includes('background-color: #ff0000'),
            'Color mode without selector should produce inline styles'
          );
          assert.equal(
            result.css,
            '',
            'Should not produce scoped CSS for inline-eligible color mode'
          );
        });

        it('should produce media query breakpoints with correct image overrides', function () {
          const schema = makeImageSchemaNoSelector();
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'image',
                _image: [ { attachment: imageAttachment } ]
              }
            },
            { rootSelector: '#w123' }
          );
          // Base is now max (largest entry). Mobile BP selects full (≠ base)
          // → emitted. Tablet BP selects max (= base) → skipped.
          const hasMobile = result.css.includes('@media (width <= 480px)');
          assert.ok(
            hasMobile,
            'Should produce mobile responsive breakpoint with range query'
          );
          // Media queries should override --bg-image with smaller images
          assert.ok(
            result.css.includes('--bg-image: url(/attachments/abc'),
            'Media query should override --bg-image variable'
          );
        });
      });

      describe('Subfield filtering', function () {
        it('should not emit CSS for unprocessed subfields with null values', function () {
          const schema = [
            {
              name: 'bg',
              type: 'object',
              customType: 'background',
              selector: '.s-test',
              property: '--bg',
              schema: [
                {
                  name: 'enabled',
                  type: 'boolean',
                  def: false
                },
                {
                  name: 'backgroundType',
                  type: 'select',
                  def: 'color'
                },
                {
                  name: 'color',
                  type: 'color'
                },
                {
                  name: 'blur',
                  type: 'range',
                  unit: 'px',
                  property: '--bg-blur'
                }
              ]
            }
          ];
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'color',
                color: '#aabbcc',
                blur: null
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            result.css.includes('background-color: #aabbcc'),
            'Should render the color rule'
          );
          assert.ok(
            !result.css.includes('--bg-blur'),
            'Should NOT emit --bg-blur when value is null'
          );
        });

        it('should not emit CSS for unprocessed subfields without property or selector', function () {
          const schema = [
            {
              name: 'bg',
              type: 'object',
              customType: 'background',
              selector: '.s-test',
              property: '--bg',
              schema: [
                {
                  name: 'enabled',
                  type: 'boolean',
                  def: false
                },
                {
                  name: 'backgroundType',
                  type: 'select',
                  def: 'color'
                },
                {
                  name: 'color',
                  type: 'color'
                },
                {
                  name: 'noPropertyField',
                  type: 'string'
                }
              ]
            }
          ];
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'color',
                color: '#aabbcc',
                noPropertyField: 'some-value'
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            result.css.includes('background-color: #aabbcc'),
            'Should render the color rule'
          );
          assert.ok(
            !result.css.includes('some-value'),
            'Should NOT emit a field without property or selector'
          );
        });

        it('should emit CSS for valid unprocessed subfields with values', function () {
          const schema = [
            {
              name: 'bg',
              type: 'object',
              customType: 'background',
              selector: '.s-test',
              property: '--bg',
              schema: [
                {
                  name: 'enabled',
                  type: 'boolean',
                  def: false
                },
                {
                  name: 'backgroundType',
                  type: 'select',
                  def: 'color'
                },
                {
                  name: 'color',
                  type: 'color'
                },
                {
                  name: 'blur',
                  type: 'range',
                  unit: 'px',
                  property: '--bg-blur',
                  class: 'has-bg-blur',
                  skipFalsyValues: true
                }
              ]
            }
          ];
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'color',
                color: '#aabbcc',
                blur: 5
              }
            },
            { rootSelector: '#id' }
          );
          assert.ok(
            result.css.includes('--bg-blur: 5px'),
            'Should emit --bg-blur for valid value'
          );
          assert.ok(
            result.classes.includes('has-bg-blur'),
            'Should apply blur class for valid value'
          );
        });
      });

      describe('Unprocessed subfield inline vote', function () {
        // Edge case: a customType object rule does NOT process a subfield,
        // but that subfield carries its own `selector` which should force
        // scoped CSS. The vote must still happen because normalizeObject
        // normalizes (and votes) ALL subfields before the rule runs.
        it('should force scoped CSS when an unprocessed subfield has a selector', function () {
          const schema = [
            {
              name: 'bg',
              type: 'object',
              customType: 'background',
              property: '--bg',
              // NO selector on parent
              schema: [
                {
                  name: 'enabled',
                  type: 'boolean',
                  def: false
                },
                {
                  name: 'backgroundType',
                  type: 'select',
                  def: 'color'
                },
                {
                  name: 'color',
                  type: 'color'
                },
                // Unprocessed by the background rule, has its own selector
                {
                  name: 'customExtra',
                  type: 'range',
                  unit: 'px',
                  property: '--custom-extra',
                  selector: '.extra-scope'
                }
              ]
            }
          ];
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'color',
                color: '#aabbcc',
                customExtra: 10
              }
            },
            { rootSelector: '#w999' }
          );
          // The subfield has a selector → it votes inline: false during
          // normalizeObject, even though the background rule never touches it.
          assert.ok(
            result.css.includes('--custom-extra: 10px'),
            'Unprocessed subfield should produce scoped CSS'
          );
          assert.ok(
            result.css.includes('.extra-scope'),
            'Subfield selector should appear in scoped output'
          );
          assert.equal(
            result.inline,
            '',
            'Subfield selector should force scoped CSS, not inline'
          );
        });

        it('should force scoped CSS when an unprocessed subfield has a mediaQuery', function () {
          const schema = [
            {
              name: 'bg',
              type: 'object',
              customType: 'background',
              property: '--bg',
              schema: [
                {
                  name: 'enabled',
                  type: 'boolean',
                  def: false
                },
                {
                  name: 'backgroundType',
                  type: 'select',
                  def: 'color'
                },
                {
                  name: 'color',
                  type: 'color'
                },
                // Unprocessed by the background rule, has its own media query
                {
                  name: 'mqExtra',
                  type: 'range',
                  unit: 'rem',
                  property: '--mq-extra',
                  mediaQuery: '(min-width: 1024px)'
                }
              ]
            }
          ];
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'color',
                color: '#112233',
                mqExtra: 3
              }
            },
            { rootSelector: '#w888' }
          );
          assert.ok(
            result.css.includes('@media (min-width: 1024px)'),
            'Unprocessed subfield media query should produce scoped CSS'
          );
          assert.ok(
            result.css.includes('--mq-extra: 3rem'),
            'Unprocessed subfield should emit its rule inside the media query'
          );
          assert.equal(
            result.inline,
            '',
            'Subfield mediaQuery should force scoped CSS, not inline'
          );
        });

        it('should still allow inline when unprocessed subfields have no selector or mediaQuery', function () {
          const schema = [
            {
              name: 'bg',
              type: 'object',
              customType: 'background',
              property: '--bg',
              schema: [
                {
                  name: 'enabled',
                  type: 'boolean',
                  def: false
                },
                {
                  name: 'backgroundType',
                  type: 'select',
                  def: 'color'
                },
                {
                  name: 'color',
                  type: 'color'
                },
                // Unprocessed, no selector, no mediaQuery
                {
                  name: 'simpleExtra',
                  type: 'range',
                  unit: 'px',
                  property: '--simple-extra'
                }
              ]
            }
          ];
          const result = renderScopedStyles(
            schema,
            {
              bg: {
                enabled: true,
                backgroundType: 'color',
                color: '#445566',
                simpleExtra: 8
              }
            },
            { rootSelector: '#w777' }
          );
          // No subfield selector/mediaQuery, no image mode → inline
          assert.ok(
            result.inline.includes('--simple-extra: 8px'),
            'Unprocessed subfield without selector should render inline'
          );
          assert.ok(
            result.inline.includes('background-color: #445566'),
            'Color output should also be inline'
          );
          assert.equal(
            result.css,
            '',
            'Nothing should force scoped CSS'
          );
        });
      });
    });
  });

  describe('Background preset (e2e)', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/styles': {
            extendMethods(self) {
              return {
                registerPresets(_super) {
                  _super();
                  const bg = self.getPreset('background');
                  bg.fields.add.blur = {
                    label: 'Blur',
                    type: 'range',
                    min: 0,
                    max: 20,
                    def: 0,
                    if: {
                      enabled: true,
                      backgroundType: 'image'
                    },
                    unit: 'px',
                    property: '--preset-bg-blur',
                    class: 'has-bg-blur',
                    skipFalsyValues: true
                  };
                  self.setPreset('background', bg);
                }
              };
            }
          },
          'test-bg-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Background Widget'
            },
            styles: {
              add: {
                background: 'background'
              }
            }
          },
          'test-bg-custom-prefix-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Background Custom Prefix Widget'
            },
            styles: {
              add: {
                background: {
                  preset: 'background',
                  property: '--hero-bg'
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

    describe('Preset schema validation', function () {
      it('should register the background preset with correct structure', function () {
        const preset = apos.styles.getPreset('background');
        assert.ok(preset, 'Background preset should be registered');
        assert.equal(preset.type, 'object', 'Should be an object type');
        assert.equal(preset.customType, 'background', 'Should have customType background');
        assert.equal(preset.property, '--preset-bg', 'Should have --preset-bg property');
      });

      it('should have all required subfields', function () {
        const preset = apos.styles.getPreset('background');
        const fieldNames = Object.keys(preset.fields.add);
        const required = [
          'enabled', 'backgroundType', 'color',
          'gradientStart', 'gradientEnd', 'gradientAngle',
          '_image', 'overlay', 'overlayColor', 'overlayOpacity'
        ];
        for (const name of required) {
          assert.ok(
            fieldNames.includes(name),
            `Should have ${name} subfield`
          );
        }
      });

      it('should include extended blur field via registerPresets', function () {
        const preset = apos.styles.getPreset('background');
        assert.ok(
          preset.fields.add.blur,
          'Extended blur field should be present'
        );
        assert.equal(
          preset.fields.add.blur.type,
          'range',
          'Blur should be a range field'
        );
        assert.equal(
          preset.fields.add.blur.property,
          '--preset-bg-blur',
          'Blur should use --preset-bg-blur property'
        );
      });

      it('should have gradientAngle with step 5', function () {
        const preset = apos.styles.getPreset('background');
        assert.equal(
          preset.fields.add.gradientAngle.step,
          5,
          'Gradient angle should have step 5'
        );
      });

      it('should compile background preset into widget schema', function () {
        const schema = apos.modules['test-bg-widget'].schema;
        const bgField = schema.find(field => field.name === 'background');
        assert.ok(bgField, 'Background field should exist in widget schema');
        assert.equal(bgField.type, 'object', 'Should be compiled as object');
        assert.equal(bgField.customType, 'background', 'Should preserve customType');
        assert.ok(
          Array.isArray(bgField.schema),
          'Should have compiled schema array (from fields.add)'
        );
        const subfieldNames = bgField.schema.map(f => f.name);
        assert.ok(
          subfieldNames.includes('enabled'),
          'Compiled schema should include enabled'
        );
        assert.ok(
          subfieldNames.includes('backgroundType'),
          'Compiled schema should include backgroundType'
        );
        assert.ok(
          subfieldNames.includes('blur'),
          'Compiled schema should include extended blur field'
        );
      });
    });

    describe('Conditional field gating', function () {
      it('should gate all fields when enabled is false', function () {
        const result = apos.modules['test-bg-widget'].getStylesheet(
          { background: { enabled: false } },
          'gate-test-1'
        );
        assert.equal(result.css, '', 'Should produce no CSS when disabled');
        assert.equal(result.inline, '', 'Should produce no inline when disabled');
      });

      it('should show only color field when backgroundType is color', function () {
        const result = apos.modules['test-bg-widget'].getStylesheet(
          {
            background: {
              enabled: true,
              backgroundType: 'color',
              color: '#ff0000',
              // These should be gated out
              gradientStart: '#111111',
              gradientEnd: '#222222'
            }
          },
          'gate-test-2'
        );
        assert.ok(
          result.inline.includes('background-color: #ff0000'),
          'Should produce color output'
        );
        assert.ok(
          !result.inline.includes('linear-gradient'),
          'Should NOT produce gradient output when backgroundType is color'
        );
      });

      it('should show gradient fields when backgroundType is gradient', function () {
        const result = apos.modules['test-bg-widget'].getStylesheet(
          {
            background: {
              enabled: true,
              backgroundType: 'gradient',
              gradientStart: '#ff0000',
              gradientEnd: '#0000ff',
              gradientAngle: 90
            }
          },
          'gate-test-3'
        );
        assert.ok(
          result.inline.includes('linear-gradient(90deg, #ff0000, #0000ff)'),
          'Should produce gradient output'
        );
      });

      it('should gate overlay fields when overlay is false', function () {
        const imageAttachment = {
          group: 'images',
          _urls: {
            'one-third': '/attachments/gate.one-third.jpg',
            full: '/attachments/gate.full.jpg',
            max: '/attachments/gate.max.jpg',
            original: '/attachments/gate.original.jpg'
          }
        };
        const result = apos.modules['test-bg-widget'].getStylesheet(
          {
            background: {
              enabled: true,
              backgroundType: 'image',
              _image: [ { attachment: imageAttachment } ],
              overlay: false,
              overlayColor: '#000000',
              overlayOpacity: 50
            }
          },
          'gate-test-4'
        );
        assert.ok(
          !result.css.includes('--preset-bg-overlay:'),
          'Should NOT produce overlay in scoped CSS when overlay toggle is false'
        );
        assert.equal(
          result.inline,
          '',
          'Image mode should not produce inline styles'
        );
      });

      it('should show overlay fields when overlay is true', function () {
        const imageAttachment = {
          group: 'images',
          _urls: {
            'one-third': '/attachments/gate.one-third.jpg',
            full: '/attachments/gate.full.jpg',
            max: '/attachments/gate.max.jpg',
            original: '/attachments/gate.original.jpg'
          }
        };
        const result = apos.modules['test-bg-widget'].getStylesheet(
          {
            background: {
              enabled: true,
              backgroundType: 'image',
              _image: [ { attachment: imageAttachment } ],
              overlay: true,
              overlayColor: '#000000',
              overlayOpacity: 50
            }
          },
          'gate-test-5'
        );
        assert.ok(
          result.css.includes('--preset-bg-overlay'),
          'Should produce overlay in scoped CSS when overlay toggle is true'
        );
        assert.equal(
          result.inline,
          '',
          'Image mode should not produce inline styles'
        );
      });
    });

    describe('End-to-end rendering', function () {
      it('should render color mode correctly', function () {
        const result = apos.modules['test-bg-widget'].getStylesheet(
          {
            background: {
              enabled: true,
              backgroundType: 'color',
              color: '#336699'
            }
          },
          'e2e-color'
        );
        assert.ok(
          result.inline.includes('background-color: #336699'),
          'Should produce background-color'
        );
        assert.equal(
          result.css,
          '',
          'Color mode should produce inline, not scoped CSS'
        );
      });

      it('should render gradient mode correctly', function () {
        const result = apos.modules['test-bg-widget'].getStylesheet(
          {
            background: {
              enabled: true,
              backgroundType: 'gradient',
              gradientStart: '#ff0000',
              gradientEnd: '#0000ff',
              gradientAngle: 45
            }
          },
          'e2e-gradient'
        );
        assert.ok(
          result.inline.includes('background: linear-gradient(45deg, #ff0000, #0000ff)'),
          'Should produce linear-gradient'
        );
      });

      it('should render image mode with responsive breakpoints', function () {
        const imageAttachment = {
          group: 'images',
          _urls: {
            'one-sixth': '/attachments/e2e.one-sixth.jpg',
            'one-third': '/attachments/e2e.one-third.jpg',
            'one-half': '/attachments/e2e.one-half.jpg',
            'two-thirds': '/attachments/e2e.two-thirds.jpg',
            full: '/attachments/e2e.full.jpg',
            max: '/attachments/e2e.max.jpg',
            original: '/attachments/e2e.original.jpg'
          }
        };
        const result = apos.modules['test-bg-widget'].getStylesheet(
          {
            background: {
              enabled: true,
              backgroundType: 'image',
              _image: [ { attachment: imageAttachment } ]
            }
          },
          'e2e-image'
        );
        assert.ok(
          result.css.includes('--preset-bg-image: url(/attachments/e2e.full.jpg)'),
          'Should export --preset-bg-image variable'
        );
        assert.ok(
          result.css.includes('background:'),
          'Should produce background shorthand'
        );
        assert.ok(
          result.css.includes('@media'),
          'Should produce responsive media queries'
        );
        assert.equal(
          result.inline,
          '',
          'Image mode with media queries should not produce inline styles'
        );
      });

      it('should render image mode with overlay', function () {
        const imageAttachment = {
          group: 'images',
          _urls: {
            'one-third': '/attachments/e2e-ov.one-third.jpg',
            full: '/attachments/e2e-ov.full.jpg',
            max: '/attachments/e2e-ov.max.jpg',
            original: '/attachments/e2e-ov.original.jpg'
          }
        };
        const result = apos.modules['test-bg-widget'].getStylesheet(
          {
            background: {
              enabled: true,
              backgroundType: 'image',
              _image: [ { attachment: imageAttachment } ],
              overlay: true,
              overlayColor: '#ff0000',
              overlayOpacity: 80
            }
          },
          'e2e-overlay'
        );
        assert.ok(
          result.css.includes('--preset-bg-overlay: linear-gradient(rgba(255, 0, 0, 0.8), rgba(255, 0, 0, 0.8))'),
          'Should produce overlay CSS variable in scoped CSS'
        );
        assert.ok(
          result.css.includes('var(--preset-bg-overlay-layer, var(--preset-bg-overlay))'),
          'Should include overlay layer in background shorthand'
        );
        assert.ok(
          result.css.includes('var(--preset-bg-image-layer,'),
          'Should include image layer in background shorthand'
        );
        assert.equal(
          result.inline,
          '',
          'Image mode with overlay should not produce inline styles'
        );
      });

      it('should render extended blur field alongside background', function () {
        const imageAttachment = {
          group: 'images',
          _urls: {
            'one-third': '/attachments/e2e-blur.one-third.jpg',
            full: '/attachments/e2e-blur.full.jpg',
            max: '/attachments/e2e-blur.max.jpg',
            original: '/attachments/e2e-blur.original.jpg'
          }
        };
        const result = apos.modules['test-bg-widget'].getStylesheet(
          {
            background: {
              enabled: true,
              backgroundType: 'image',
              _image: [ { attachment: imageAttachment } ],
              blur: 10
            }
          },
          'e2e-blur'
        );
        assert.ok(
          result.css.includes('--preset-bg-blur: 10px'),
          'Extended blur field should appear in scoped CSS'
        );
        assert.ok(
          result.classes.includes('has-bg-blur'),
          'Extended blur field should toggle class'
        );
        assert.ok(
          result.css.includes('--preset-bg-image:'),
          'Background image output should still be present in scoped CSS'
        );
        assert.equal(
          result.inline,
          '',
          'Image mode with blur should not produce inline styles'
        );
      });

      it('should skip blur output when blur is 0 (skipFalsyValues)', function () {
        const imageAttachment = {
          group: 'images',
          _urls: {
            'one-third': '/attachments/e2e-noblur.one-third.jpg',
            full: '/attachments/e2e-noblur.full.jpg',
            max: '/attachments/e2e-noblur.max.jpg',
            original: '/attachments/e2e-noblur.original.jpg'
          }
        };
        const result = apos.modules['test-bg-widget'].getStylesheet(
          {
            background: {
              enabled: true,
              backgroundType: 'image',
              _image: [ { attachment: imageAttachment } ],
              blur: 0
            }
          },
          'e2e-noblur'
        );
        assert.ok(
          !result.css.includes('--preset-bg-blur'),
          'Should not emit --preset-bg-blur in scoped CSS when value is 0 (skipFalsyValues)'
        );
        assert.ok(
          !result.classes.includes('has-bg-blur'),
          'Should not toggle blur class when value is 0'
        );
        assert.equal(
          result.inline,
          '',
          'Image mode should not produce inline styles'
        );
      });
    });

    describe('Custom property prefix', function () {
      it('should use overridden prefix for all CSS variables', function () {
        const imageAttachment = {
          group: 'images',
          _urls: {
            'one-third': '/attachments/hero.one-third.jpg',
            full: '/attachments/hero.full.jpg',
            max: '/attachments/hero.max.jpg',
            original: '/attachments/hero.original.jpg'
          }
        };
        const result = apos.modules['test-bg-custom-prefix-widget'].getStylesheet(
          {
            background: {
              enabled: true,
              backgroundType: 'image',
              _image: [ { attachment: imageAttachment } ],
              overlay: true,
              overlayColor: '#000000',
              overlayOpacity: 50
            }
          },
          'e2e-prefix'
        );
        assert.ok(
          result.css.includes('--hero-bg-image:'),
          'Should use custom prefix for image variable in scoped CSS'
        );
        assert.ok(
          result.css.includes('--hero-bg-overlay:'),
          'Should use custom prefix for overlay variable in scoped CSS'
        );
        assert.ok(
          result.css.includes('var(--hero-bg-overlay-layer,'),
          'Should use custom prefix in overlay hook'
        );
        assert.ok(
          result.css.includes('var(--hero-bg-image-layer,'),
          'Should use custom prefix in image hook'
        );
        assert.equal(
          result.inline,
          '',
          'Image mode with custom prefix should not produce inline styles'
        );
      });
    });

    describe('i18n labels', function () {
      it('should resolve all background label keys', function () {
        const keys = [
          'styleBackground',
          'styleBackgroundColor',
          'styleBackgroundGradient',
          'styleBackgroundImage',
          'styleBackgroundOverlay',
          'styleBackgroundType',
          'styleGradientAngle',
          'styleGradientEnd',
          'styleGradientStart',
          'styleOverlayColor',
          'styleOverlayOpacity'
        ];
        for (const key of keys) {
          const resolved = apos.i18n.i18next.t(`apostrophe:${key}`);
          assert.ok(
            resolved && !resolved.startsWith('apostrophe:'),
            `Label key apostrophe:${key} should resolve (got "${resolved}")`
          );
        }
      });
    });
  });

  describe('Setup', function () {
    let apos;
    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/styles': {
            styles(self, options) {
              return {
                add: {
                  border: {
                    preset: 'border',
                    selector: '.border-style'
                  },
                  width: {
                    preset: 'width',
                    label: 'Custom Width',
                    selector: '.custom-width'
                  },
                  borderCard: {
                    preset: 'border',
                    label: 'Card Border',
                    selector: '.card'
                  }
                },
                group: {
                  typography: {
                    label: 'Styles',
                    group: {
                      border: {
                        label: 'Border',
                        inline: true,
                        fields: [ 'border' ]
                      },
                      width: {
                        label: 'Width',
                        fields: [ 'width' ]
                      },
                      borderCard: {
                        label: 'Border Card',
                        fields: [ 'borderCard' ]
                      }
                    }
                  }
                }
              };
            },
            extendMethods(self) {
              return {
                registerPresets(_super) {
                  _super();
                  // Extend an existing one:
                  const widthPreset = self.getPreset('width');

                  // Ensure we really change the default
                  assert.equal(
                    widthPreset.step,
                    10,
                    'Width preset should have step 10 by default'
                  );
                  widthPreset.step = 1;
                  self.setPreset('width', widthPreset);

                  // Add a custom one:
                  self.setPreset('customPreset', {
                    label: 'Custom Preset',
                    type: 'string',
                    def: 'custom',
                    property: 'customProperty'
                  });

                  // Test validation
                  assert.throws(
                    () => {
                      self.setPreset('invalidPreset', {
                        label: 'Invalid Preset'
                      });
                    },
                    {
                      message: /Preset must be an object with a "type" property/i
                    },
                    'Should validate preset type while registering'
                  );
                  assert.throws(
                    () => {
                      self.setPreset('anotherInvalidPreset', null);
                    },
                    {
                      message: /Preset must be an object with a "type" property/i
                    },
                    'Should validate null preset while registering'
                  );
                },

                // Test that presets getter fails before registration.
                composeSchema(_super, ...args) {
                  assert.throws(
                    () => {
                      self.getPreset('width');
                    },
                    {
                      message: /Presets have not been initialzed yet/i
                    },
                    'Should not be able to get presets before they are registered'
                  );
                  return _super(...args);
                }
              };
            }
          },
          'test-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Widget'
            },
            styles: {
              add: {
                border: 'border',
                width: {
                  preset: 'width',
                  label: 'Custom Width',
                  selector: '.custom-width'
                },
                backgroundColor: {
                  label: 'Background Color',
                  type: 'color',
                  required: true
                }
              }
            },
            fields: {
              add: {
                title: {
                  type: 'string',
                  label: 'Title'
                },
                aStyle: {
                  type: 'string',
                  label: 'A Style'
                }
              },
              // Explicit existing groups
              group: {
                basics: {
                  label: 'Basics',
                  fields: [ 'title' ]
                },
                styles: {
                  label: 'Styles',
                  fields: [ 'aStyle' ]
                }
              }
            }

          },
          'test-empty-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Groups Widget'
            }
          },
          'test-empty-styles-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Groups Widget'
            },
            fields: {
              add: {
                myField: {
                  type: 'string',
                  label: 'My Field'
                }
              }
            }
          },
          'test-empty-fields-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Empty Fields Widget'
            },
            styles: {
              add: {
                width: {
                  preset: 'width',
                  label: 'Custom Width',
                  selector: '.card'
                }
              }
            }
          },
          'test-nogroups-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test No Groups Widget'
            },
            fields: {
              add: {
                myField: {
                  type: 'string',
                  label: 'A Style'
                }
              }
            },
            styles: {
              add: {
                width: {
                  preset: 'width',
                  label: 'Custom Width',
                  selector: '.card'
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
    it('@apostrophecms/styles should exist', async function () {
      assert(
        apos.modules['@apostrophecms/styles'],
        '@apostrophecms/styles module should exist'
      );
      assert(apos.styles, 'Alias `apos.styles` should exist');
    });

    it('should cascade styles (@apostrophecms/styles)', async function () {
      assert(apos.styles.styles, '@apostrophecms/styles should have a styles property');
      const schema = apos.styles.schema;
      const borderField = schema.find(field => field.name === 'border');
      const widthField = schema.find(field => field.name === 'width');
      const borderCardField = schema.find(field => field.name === 'borderCard');

      assert.equal(borderField?.type, 'object', 'Border field not expanded correctly');
      assert.equal(borderField.group.name, 'ungrouped', 'Styles groups should be ungrouped');
      assert.equal(widthField?.type, 'range', 'Width field not expanded correctly');
      assert.equal(widthField.group.name, 'ungrouped', 'Styles groups should be ungrouped');
      assert.equal(
        borderCardField?.type,
        'object',
        'Border Card field not expanded correctly'
      );
      assert.equal(borderCardField.group.name, 'ungrouped', 'Styles groups should be ungrouped');
    });

    it('should cascade styles (widgets)', async function () {
      assert(apos.modules['test-widget'].styles, 'test-widget should have a styles property');
      const schema = apos.modules['test-widget'].schema;
      const borderField = schema.find(field => field.name === 'border');
      const widthField = schema.find(field => field.name === 'width');
      const backgroundColorField = schema.find(field => field.name === 'backgroundColor');
      const titleField = schema.find(field => field.name === 'title');
      const aStyleField = schema.find(field => field.name === 'aStyle');

      assert.equal(borderField?.type, 'object', 'Border field not expanded correctly');
      assert.equal(borderField.group.name, 'styles', 'Border field not in styles group');
      assert.equal(widthField?.type, 'range', 'Width field not expanded correctly');
      assert.equal(widthField.group.name, 'styles', 'Width field not in styles group');
      assert.equal(
        backgroundColorField?.type,
        'color',
        'Background Color field not expanded correctly'
      );
      assert.equal(
        backgroundColorField.group.name,
        'styles',
        'Background Color field not in styles group'
      );

      assert.deepEqual(
        apos.modules['test-widget'].fieldsGroups.styles.fields,
        [ 'border', 'width', 'backgroundColor', 'aStyle' ],
        'Styles group should contain all style fields in the right order'
      );

      assert.equal(titleField?.type, 'string', 'Title field should remain unchanged');
      assert.equal(titleField.group.name, 'basics', 'Title field should remain in basics group');
      assert.equal(aStyleField?.type, 'string', 'aStyle field should remain unchanged');
      assert.equal(aStyleField.group.name, 'styles', 'sStyle field should be in styles group');
    });

    it('should handle empty styles and fields groups (widgets)', async function () {
      assert.deepEqual(
        apos.modules['test-empty-widget'].fieldsGroups,
        {},
        'Fields groups should be empty'
      );
    });

    it('should handle empty styles groups (widgets)', async function () {
      assert.deepEqual(
        apos.modules['test-empty-styles-widget'].fieldsGroups,
        {},
        'Fields groups should be empty'
      );
    });

    it('should handle empty fields groups (widgets)', async function () {
      assert.deepEqual(
        apos.modules['test-empty-fields-widget'].fieldsGroups,
        {
          styles: {
            label: 'apostrophe:styles',
            fields: [ 'width' ]
          }
        },
        'Fields groups should contain basics and styles groups'
      );
    });

    it('should handle fields and styles groups (widgets)', async function () {
      assert.deepEqual(
        apos.modules['test-nogroups-widget'].fieldsGroups,
        {
          basics: {
            label: 'apostrophe:basics',
            fields: [ 'myField' ]
          },
          styles: {
            label: 'apostrophe:styles',
            fields: [ 'width' ]
          }
        },
        'Fields groups should contain basics and styles groups'
      );
    });

    it('should register and retrieve presets', async function () {
      const borderPreset = apos.styles.getPreset('border');
      const widthPreset = apos.styles.getPreset('width');
      const customPreset = apos.styles.getPreset('customPreset');

      assert(borderPreset, 'Border preset should be registered');

      assert(widthPreset, 'Width preset should be registered');
      assert.equal(
        widthPreset.step,
        1,
        'Width preset should be modified correctly'
      );

      assert(customPreset, 'Custom preset should be registered');
      assert.equal(
        customPreset.type,
        'string',
        'Custom preset should be registered correctly'
      );
    });

    it('should fail to set presets after initialization', async function () {
      assert.throws(
        () => {
          apos.styles.setPreset('anotherPreset', {
            label: 'Another Preset',
            type: 'string',
            property: 'anotherProperty'
          });
        },
        {
          message: /Attempt to set preset anotherPreset after initialization/i
        },
        'Should throw an error when trying to set a preset after initialization'
      );
    });
  });

  describe('Object styles', function () {
    let apos;

    // A multi-field as selector
    const styleSelectorConfig = (options) => ({
      border: {
        label: 'apostrophe:styleBorder',
        type: 'object',
        selector: '.border-style',
        fields: {
          add: {
            active: {
              label: 'apostrophe:styleBorder',
              type: 'boolean',
              def: false
            },
            width: {
              label: 'apostrophe:styleWidth',
              type: 'box',
              def: {
                top: 1,
                right: 1,
                bottom: 1,
                left: 1
              },
              if: {
                active: true
              },
              unit: 'px',
              property: 'border-%key%-width'
            },
            radius: {
              label: 'apostrophe:styleRadius',
              type: 'range',
              min: 0,
              max: 32,
              def: 0,
              if: {
                active: true
              },
              property: 'border-radius',
              unit: 'px'
            },
            color: {
              label: 'apostrophe:styleColor',
              type: 'color',
              def: options.borderColor,
              if: {
                active: true
              },
              property: 'border-color'
            },
            style: {
              label: 'apostrophe:styleStyle',
              type: 'select',
              def: 'solid',
              if: {
                active: true
              },
              choices: [
                {
                  label: 'apostrophe:styleSolid',
                  value: 'solid'
                },
                {
                  label: 'apostrophe:styleDotted',
                  value: 'dotted'
                },
                {
                  label: 'apostrophe:styleDashed',
                  value: 'dashed'
                }
              ],
              property: 'border-style'
            }
          }
        }
      }
    });
    const inlineStyleConfig = (options) => ({
      border: {
        label: 'apostrophe:styleBorder',
        type: 'object',
        fields: {
          add: {
            width: {
              label: 'apostrophe:styleWidth',
              type: 'box',
              def: {
                top: 1,
                right: 1,
                bottom: 1,
                left: 1
              },
              unit: 'px',
              property: 'border-%key%-width'
            },
            radius: {
              label: 'apostrophe:styleRadius',
              type: 'range',
              min: 0,
              max: 32,
              def: 0,
              property: 'border-radius',
              unit: 'px'
            },
            color: {
              label: 'apostrophe:styleColor',
              type: 'color',
              def: options.borderColor,
              property: 'border-color'
            },
            style: {
              label: 'apostrophe:styleStyle',
              type: 'select',
              def: 'solid',
              choices: [
                {
                  label: 'apostrophe:styleSolid',
                  value: 'solid'
                },
                {
                  label: 'apostrophe:styleDotted',
                  value: 'dotted'
                },
                {
                  label: 'apostrophe:styleDashed',
                  value: 'dashed'
                }
              ],
              property: 'border-style'
            }
          }
        }
      }
    });
    const classesStyleConfig = () => ({
      alignSelect: {
        type: 'select',
        class: true,
        choices: [
          {
            label: 'None',
            value: ''
          },
          {
            label: 'Left',
            value: 'apos-left'
          },
          {
            label: 'Center',
            value: 'apos-center'
          },
          {
            label: 'Right',
            value: 'apos-right'
          }
        ],
        def: ''
      },
      leftBoolean: {
        type: 'boolean',
        class: 'apos-left',
        def: false
      },
      checkboxes: {
        type: 'checkboxes',
        class: true,
        choices: [
          {
            label: 'Rounded Corners',
            value: 'rounded-corners'
          },
          {
            label: 'Shadow',
            value: 'shadow'
          },
          {
            label: 'Border',
            value: 'border'
          }
        ]
      }
    });
    const mediaQueryStyleConfig = () => ({
      responsivePadding: {
        type: 'object',
        mediaQuery: '(width > 1200px)',
        selector: '.responsive-padding',
        fields: {
          add: {
            desktop: {
              type: 'range',
              min: 0,
              max: 32,
              def: 0,
              property: 'padding',
              unit: 'px'
            },
            tablet: {
              type: 'range',
              min: 0,
              max: 32,
              def: 0,
              property: 'padding',
              unit: 'px',
              mediaQuery: '(560px < width <= 1200px)'
            },
            mobile: {
              type: 'range',
              min: 0,
              max: 32,
              def: 0,
              property: 'padding',
              unit: 'px',
              mediaQuery: '(width <= 560px)'
            }
          }
        }
      }
    });
    const valueTemplateStyleConfig = () => ({
      boxShadow: {
        type: 'object',
        valueTemplate: '%x% %y% %blur% %color%',
        property: 'box-shadow',
        selector: '.box-shadow',
        fields: {
          add: {
            active: {
              type: 'boolean'
            },
            // Assert no output when one of the fields is missing
            x: {
              type: 'range',
              min: -32,
              max: 32,
              def: 4,
              unit: 'px',
              if: {
                active: true
              }
            },
            y: {
              type: 'range',
              min: -32,
              max: 32,
              def: 4,
              unit: 'px'
            },
            blur: {
              type: 'range',
              min: 0,
              max: 32,
              def: 2,
              unit: 'px'
            },
            color: {
              type: 'color'
            },
            standalone: {
              type: 'integer',
              property: 'width',
              // No unit to test interpolation in valueTemplate
              valueTemplate: '%VALUE%px'
            }
          }
        }
      }
    });
    const boxValueTemplateConfig = (options) => ({
      position: {
        type: 'object',
        valueTemplate: '%box.top% %box.right% %box.bottom% %box.left%',
        property: 'inset',
        selector: '.box-position',
        fields: {
          add: {
            active: {
              type: 'boolean'
            },
            box: {
              type: 'box',
              unit: 'px',
              if: {
                active: true
              }
            }
          }
        }
      }
    });

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/styles': {
            styles(self, options) {
              return {
                add: {
                  border: styleSelectorConfig(options).border,
                  ...classesStyleConfig(),
                  ...mediaQueryStyleConfig(),
                  ...valueTemplateStyleConfig(),
                  ...boxValueTemplateConfig()
                }
              };
            }
          },
          'test-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Widget'
            },
            styles: {
              add: {
                border: styleSelectorConfig({
                  borderColor: 'black',
                  shadowColor: 'gray'
                }).border
              }
            }
          },
          'test-inline-style-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Inline Style Widget'
            },
            styles: {
              add: inlineStyleConfig({
                borderColor: 'black',
                shadowColor: 'gray'
              })
            }
          },
          'test-classes-style-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Classes Style Widget'
            },
            styles: {
              add: classesStyleConfig()
            }
          },
          'test-media-query-style-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Media Query Style Widget'
            },
            styles: {
              add: mediaQueryStyleConfig()
            }
          },
          'test-value-template-style-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Value Template Style Widget'
            },
            styles: {
              add: {
                ...valueTemplateStyleConfig(),
                ...boxValueTemplateConfig()
              }
            }
          }
        }
      });
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('should render object styles correctly (@apostrophecms/styles)', async function () {
      const actual = await apos.styles.getStylesheet(
        {
          border: {
            active: true,
            width: {
              top: 2,
              right: 4,
              bottom: 2,
              left: 4
            },
            radius: 8,
            color: 'red',
            style: 'dashed'
          },
          boxShadow: {
            active: true,
            x: 5,
            y: 5,
            blur: 10,
            color: 'rgba(0,0,0,0.5)'
          }
        }
      );
      const styles = actual.css;
      const actualChecks = {
        selector: styles.startsWith('.border-style{'),
        selectorEnd: styles.endsWith('}'),
        borderTopWidth: styles.includes('border-top-width: 2px'),
        borderRightWidth: styles.includes('border-right-width: 4px'),
        borderBottomWidth: styles.includes('border-bottom-width: 2px'),
        borderLeftWidth: styles.includes('border-left-width: 4px'),
        borderRadius: styles.includes('border-radius: 8px;'),
        borderColor: styles.includes('border-color: red;'),
        borderStyle: styles.includes('border-style: dashed;')
      };
      assert.deepEqual(actualChecks, {
        selector: true,
        selectorEnd: true,
        borderTopWidth: true,
        borderRightWidth: true,
        borderBottomWidth: true,
        borderLeftWidth: true,
        borderRadius: true,
        borderColor: true,
        borderStyle: true
      });
    });

    it('should render object with selector correctly (widgets)', async function () {
      const actual = await apos.modules['test-widget'].getStylesheet(
        {
          border: {
            active: true,
            width: {
              top: 3,
              right: 3,
              bottom: 3,
              left: 3
            },
            radius: 12,
            color: 'blue',
            style: 'dotted'
          },
          boxShadow: {
            active: true,
            x: 2,
            y: 2,
            blur: 5,
            color: 'rgba(0,0,0,0.3)'
          }
        },
        'randomStyleId'
      );
      const styles = actual.css;
      const actualChecks = {
        selector: styles.startsWith('#randomStyleId .border-style{'),
        selectorEnd: styles.endsWith('}'),
        borderWidth: styles.includes('border-width: 3px'),
        borderTopWidth: styles.includes('border-top-width: 3px'),
        borderRightWidth: styles.includes('border-right-width: 3px'),
        borderBottomWidth: styles.includes('border-bottom-width: 3px'),
        borderLeftWidth: styles.includes('border-left-width: 3px'),
        borderRadius: styles.includes('border-radius: 12px;'),
        borderColor: styles.includes('border-color: blue;'),
        borderStyle: styles.includes('border-style: dotted;')
      };
      assert.deepEqual(actualChecks, {
        selector: true,
        selectorEnd: true,
        borderWidth: true,
        borderTopWidth: false,
        borderRightWidth: false,
        borderBottomWidth: false,
        borderLeftWidth: false,
        borderRadius: true,
        borderColor: true,
        borderStyle: true
      });
    });

    it('should render object as inline style correctly (widgets)', async function () {
      const actual = await apos.modules['test-inline-style-widget'].getStylesheet(
        {
          border: {
            active: true,
            width: {
              top: 3,
              right: 3,
              bottom: 3,
              left: 3
            },
            radius: 12,
            color: 'blue',
            style: 'dotted'
          },
          boxShadow: {
            active: true,
            x: 2,
            y: 2,
            blur: 5,
            color: 'rgba(0,0,0,0.3)'
          }
        },
        'randomStyleId'
      );
      assert.equal(actual.css, '');

      const styles = actual.inline;
      const actualChecks = {
        selector: !styles.includes('#randomStyleId{'),
        isInline: !styles.includes('{') && !styles.includes('}'),
        borderWidth: styles.includes('border-width: 3px'),
        borderRadius: styles.includes('border-radius: 12px;'),
        borderColor: styles.includes('border-color: blue;'),
        borderStyle: styles.includes('border-style: dotted;')
      };
      assert.deepEqual(actualChecks, {
        selector: true,
        isInline: true,
        borderWidth: true,
        borderRadius: true,
        borderColor: true,
        borderStyle: true
      });
    });

    it('should extract classes from the styles schema (@apostrophecms/styles)', async function () {
      const actual = apos.styles.getStylesheet(
        {
          alignSelect: 'apos-center',
          leftBoolean: true,
          checkboxes: [ 'rounded-corners', 'shadow' ]
        }
      );
      const classes = actual.classes;
      assert.deepEqual(classes.sort(), [
        'apos-center',
        'apos-left',
        'rounded-corners',
        'shadow'
      ].sort()
      );
    });

    it('should extract classes from the styles schema (widget)', async function () {
      const actual = apos.modules['test-classes-style-widget'].getStylesheet(
        {
          alignSelect: 'apos-center',
          leftBoolean: true,
          checkboxes: [ 'rounded-corners', 'shadow' ]
        },
        'randomStyleId'
      );
      assert.equal(actual.css, '');
      assert.equal(actual.inline, '');

      const classes = actual.classes;
      assert.deepEqual(classes.sort(), [
        'apos-center',
        'apos-left',
        'rounded-corners',
        'shadow'
      ].sort()
      );
    });

    it('should render media query styles correctly (@apostrophecms/styles)', async function () {
      const actual = apos.styles.getStylesheet(
        {
          responsivePadding: {
            mobile: 4,
            tablet: 8,
            desktop: 12
          }
        }
      );
      assert.equal(actual.inline, undefined);
      assert.deepEqual(actual.classes, []);
      const styles = actual.css;
      assert.equal(
        styles,
        '@media (width > 1200px){.responsive-padding{padding: 12px;}}' +
        '@media (560px < width <= 1200px){.responsive-padding{padding: 8px;}}' +
        '@media (width <= 560px){.responsive-padding{padding: 4px;}}'
      );
    });

    it('should render media query styles correctly (widget)', async function () {
      const actual = apos.modules['test-media-query-style-widget'].getStylesheet(
        {
          responsivePadding: {
            mobile: 2,
            tablet: 6,
            desktop: 10
          }
        },
        'randomStyleId'
      );
      assert.equal(actual.inline, '');
      assert.deepEqual(actual.classes, []);
      const styles = actual.css;
      assert.equal(
        styles,
        '@media (width > 1200px){#randomStyleId .responsive-padding{padding: 10px;}}' +
        '@media (560px < width <= 1200px){#randomStyleId .responsive-padding{padding: 6px;}}' +
        '@media (width <= 560px){#randomStyleId .responsive-padding{padding: 2px;}}'
      );
    });

    it('should render value template styles correctly (@apostrophecms/styles)', async function () {
      {
        const actual = apos.styles.getStylesheet(
          {
            boxShadow: {
              active: true,
              x: 3,
              y: 3,
              blur: 6,
              color: 'rgba(0,0,0,0.4)',
              standalone: 10
            }
          }
        );
        const styles = actual.css;
        assert.deepEqual(actual.classes, []);
        assert.equal(
          styles,
          '.box-shadow{box-shadow: 3px 3px 6px rgba(0,0,0,0.4);width: 10px;}',
          'Output CSS does not match expected value template output when active'
        );
      }

      {
        const actual = apos.styles.getStylesheet(
          {
            boxShadow: {
              active: false,
              x: 5,
              y: 5,
              blur: 10,
              color: 'rgba(0,0,0,0.5)',
              standalone: 15
            }
          }
        );
        const styles = actual.css;
        assert.deepEqual(actual.classes, []);
        assert.equal(
          styles,
          '.box-shadow{width: 15px;}',
          'Output CSS does not match expected value template output when inactive'
        );
      }

      // Test `%box.value%` interpolation support
      {
        const actual = apos.styles.getStylesheet(
          {
            position: {
              active: true,
              box: {
                top: 10,
                right: 15,
                bottom: 20,
                left: 25
              }
            }
          }
        );
        const styles = actual.css;
        assert.deepEqual(actual.classes, []);
        assert.equal(
          styles,
          '.box-position{inset: 10px 15px 20px 25px;}',
          'Output CSS does not match expected %box.value% template output'
        );
      }

      // Test `%box.value%` interpolation when inactive
      {
        const actual = apos.styles.getStylesheet(
          {
            position: {
              active: false,
              box: {
                top: 10,
                right: 15,
                bottom: 20,
                left: 25
              }
            }
          }
        );
        const styles = actual.css;
        assert.deepEqual(actual.classes, []);
        assert.equal(
          styles,
          '',
          'Output CSS does not match expected %box.value% template output'
        );
      }
    });

    it('should render value template styles correctly (widget)', async function () {
      {
        const actual = apos.modules['test-value-template-style-widget'].getStylesheet(
          {
            boxShadow: {
              active: true,
              x: 4,
              y: 5,
              blur: 8,
              color: 'rgba(0,0,0,0.6)',
              standalone: 12
            }
          },
          'randomStyleId'
        );
        const styles = actual.css;
        assert.deepEqual(actual.classes, []);
        assert.equal(
          styles,
          '#randomStyleId .box-shadow{box-shadow: 4px 5px 8px rgba(0,0,0,0.6);width: 12px;}',
          'Output CSS does not match expected value template output when active'
        );
      }

      {
        const actual = apos.modules['test-value-template-style-widget'].getStylesheet(
          {
            boxShadow: {
              active: false,
              x: 6,
              y: 7,
              blur: 12,
              color: 'rgba(0,0,0,0.7)',
              standalone: 18
            }
          },
          'randomStyleId'
        );
        const styles = actual.css;
        assert.deepEqual(actual.classes, []);
        assert.equal(
          styles,
          '#randomStyleId .box-shadow{width: 18px;}',
          'Output CSS does not match expected value template output when inactive'
        );
      }

      // Test `%box.value%` interpolation support
      {
        const actual = apos.modules['test-value-template-style-widget'].getStylesheet(
          {
            position: {
              active: true,
              box: {
                top: 10,
                right: 15,
                bottom: 20,
                left: 25
              }
            }
          },
          'randomStyleId'
        );
        const styles = actual.css;
        assert.deepEqual(actual.classes, []);
        assert.equal(
          styles,
          '#randomStyleId .box-position{inset: 10px 15px 20px 25px;}',
          'Output CSS does not match expected %box.value% template output'
        );
      }

      // Test `%box.value%` interpolation disabled when inactive
      {
        const actual = apos.modules['test-value-template-style-widget'].getStylesheet(
          {
            position: {
              active: false,
              box: {
                top: 10,
                right: 15,
                bottom: 20,
                left: 25
              }
            }
          },
          'randomStyleId'
        );
        const styles = actual.css;
        assert.deepEqual(actual.classes, []);
        assert.equal(
          styles,
          '',
          'Output CSS does not match expected %box.value% template output when inactive'
        );
      }
    });
  });

  describe('Conditional styles', function () {
    let apos;

    const conditionalStylesSchema = () => ({
      // This is first to show that order does not matter
      anotherBorder: {
        type: 'object',
        selector: '.another-border-style',
        fields: {
          add: {
            color: {
              type: 'color',
              property: 'border-color',
              if: {
                '<border.active': true
              }
            }
          }
        }
      },
      textColor: {
        label: 'Text Color',
        type: 'color',
        property: '--color',
        selector: ':root'
      },
      backgroundColor: {
        label: 'Background Color',
        type: 'color',
        property: '--background-color',
        selector: ':root',
        if: {
          parentActive: true
        }
      },
      // When background is not visible, highlight is not either,
      // no matter the condition value of backgroundColor
      // matches.
      highlightColor: {
        label: 'Highlight Color',
        type: 'color',
        property: '--highlight-color',
        selector: ':root',
        if: {
          backgroundColor: '#000000'
        }
      },
      border: {
        type: 'object',
        selector: '.border-style',
        fields: {
          add: {
            width: {
              type: 'box',
              def: {
                top: 1,
                right: 1,
                bottom: 1,
                left: 1
              },
              if: {
                active: true,
                '<parentActive': true
              },
              unit: 'px',
              property: 'border-%key%-width'
            },
            color: {
              type: 'color',
              if: {
                active: true
              },
              property: 'border-color'
            },
            // Last to show order does not matter
            active: {
              type: 'boolean',
              def: false
            }
          }
        }
      },
      // Last to show order does not matter
      parentActive: {
        type: 'boolean',
        def: false
      }
    });

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/styles': {
            styles: {
              add: conditionalStylesSchema()
            }
          },
          'test-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Widget'
            },
            styles: {
              add: conditionalStylesSchema()
            }
          }
        }
      });
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('should support conditional style fields (@apostrophecms/styles)', async function () {
      {
        const actual = await apos.styles.getStylesheet(
          {
            parentActive: false,
            border: {
              active: false,
              width: {
                top: 2,
                right: 4,
                bottom: 2,
                left: 4
              },
              color: 'red'
            },
            anotherBorder: {
              color: 'green'
            },
            textColor: 'blue',
            backgroundColor: '#000000',
            highlightColor: 'yellow'
          }
        );
        assert.equal(
          actual.css,
          ':root{--color: blue;}',
          'Output CSS does not match expected with `parentActive: false` and `border.active: false`'
        );
      }

      {
        const actual = await apos.styles.getStylesheet(
          {
            parentActive: true,
            border: {
              active: false,
              width: {
                top: 2,
                right: 2,
                bottom: 2,
                left: 2
              },
              color: 'red'
            },
            anotherBorder: {
              color: 'green'
            },
            textColor: 'blue',
            backgroundColor: '#ffffff',
            highlightColor: 'yellow'
          }
        );
        assert.equal(
          actual.css,
          ':root{--color: blue;--background-color: #ffffff;}',
          'Output CSS does not match expected with `parentActive: true` and `border.active: false`'
        );
      }

      {
        const actual = await apos.styles.getStylesheet(
          {
            parentActive: false,
            border: {
              active: true,
              width: {
                top: 3,
                right: 3,
                bottom: 3,
                left: 3
              },
              color: 'red'
            },
            anotherBorder: {
              color: 'green'
            },
            textColor: 'blue',
            backgroundColor: '#000000',
            highlightColor: 'yellow'
          }
        );
        // Key point:
        // - `highlightColor` should be omitted because backgroundColor is not visible.
        assert.equal(
          actual.css,
          '.another-border-style{border-color: green;}:root{--color: blue;}.border-style{border-color: red;}',
          'Output CSS does not match expected with `parentActive: false` and `border.active: true`'
        );
      }

      {
        const actual = await apos.styles.getStylesheet(
          {
            parentActive: true,
            border: {
              active: true,
              width: {
                top: 4,
                right: 4,
                bottom: 4,
                left: 4
              },
              color: 'red'
            },
            anotherBorder: {
              color: 'green'
            },
            textColor: 'blue',
            backgroundColor: '#000000',
            highlightColor: 'yellow'
          }
        );
        assert.equal(
          actual.css,
          '.another-border-style{border-color: green;}' +
          ':root{--color: blue;--background-color: #000000;--highlight-color: yellow;}' +
          '.border-style{border-width: 4px;border-color: red;}',
          'Output CSS does not match expected with `parentActive: true` and `border.active: true`'
        );
      }
    });

    it('should support conditional style fields (widgets)', async function () {
      const rootId = 'testWidgetId';
      const rootSelector = `#${rootId}`;

      {
        const actual = await apos.modules['test-widget'].getStylesheet(
          {
            parentActive: false,
            border: {
              active: false,
              width: {
                top: 2,
                right: 4,
                bottom: 2,
                left: 4
              },
              color: 'red'
            },
            anotherBorder: {
              color: 'green'
            },
            textColor: 'blue',
            backgroundColor: '#000000',
            highlightColor: 'yellow'
          },
          rootId
        );
        assert.equal(
          actual.css,
          `${rootSelector} :root{--color: blue;}`,
          'Output CSS does not match expected with `parentActive: false` and `border.active: false`'
        );
      }

      {
        const actual = await apos.modules['test-widget'].getStylesheet(
          {
            parentActive: true,
            border: {
              active: false,
              width: {
                top: 2,
                right: 2,
                bottom: 2,
                left: 2
              },
              color: 'red'
            },
            anotherBorder: {
              color: 'green'
            },
            textColor: 'blue',
            backgroundColor: '#ffffff',
            highlightColor: 'yellow'
          },
          rootId
        );
        assert.equal(
          actual.css,
          `${rootSelector} :root{--color: blue;--background-color: #ffffff;}`,
          'Output CSS does not match expected with `parentActive: true` and `border.active: false`'
        );
      }

      {
        // Key point:
        // - `--highlight-color: yellow;` should be omitted because backgroundColor
        //   is not visible. Demonstrates that conditional logic based on other
        //   conditional fields is working.
        const actual = await apos.modules['test-widget'].getStylesheet(
          {
            parentActive: false,
            border: {
              active: true,
              width: {
                top: 3,
                right: 3,
                bottom: 3,
                left: 3
              },
              color: 'red'
            },
            anotherBorder: {
              color: 'green'
            },
            textColor: 'blue',
            backgroundColor: '#000000',
            highlightColor: 'yellow'
          },
          rootId
        );
        assert.equal(
          actual.css,
          `${rootSelector} .another-border-style{border-color: green;}` +
          `${rootSelector} :root{--color: blue;}` +
          `${rootSelector} .border-style{border-color: red;}`,
          'Output CSS does not match expected with `parentActive: false` and `border.active: true`'
        );
      }

      {
        const actual = await apos.modules['test-widget'].getStylesheet(
          {
            parentActive: true,
            border: {
              active: true,
              width: {
                top: 4,
                right: 4,
                bottom: 4,
                left: 4
              },
              color: 'red'
            },
            anotherBorder: {
              color: 'green'
            },
            textColor: 'blue',
            backgroundColor: '#000000',
            highlightColor: 'yellow'
          },
          rootId
        );
        assert.equal(
          actual.css,
          `${rootSelector} .another-border-style{border-color: green;}` +
          `${rootSelector} :root{--color: blue;--background-color: #000000;--highlight-color: yellow;}` +
          `${rootSelector} .border-style{border-width: 4px;border-color: red;}`,
          'Output CSS does not match expected with `parentActive: true` and `border.active: true`'
        );
      }
    });
  });

  describe('Render styles helpers', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          'test-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Widget'
            },
            styles: {
              add: {
                // Produces CSS output
                borderColor: {
                  type: 'color',
                  property: 'border-color',
                  selector: '.border'
                },
                // Produces inline output (no selector)
                backgroundColor: {
                  type: 'color',
                  property: 'background-color'
                },
                // Produces class output
                alignment: {
                  type: 'select',
                  class: true,
                  choices: [
                    {
                      label: 'None',
                      value: ''
                    },
                    {
                      label: 'Left',
                      value: 'align-left'
                    },
                    {
                      label: 'Center',
                      value: 'align-center'
                    }
                  ],
                  def: ''
                }
              }
            }
          },
          'no-styles-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'No Styles Widget'
            }
          }
        }
      });
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('should prepare, render elements, and render attributes for widget with all style types', function () {
      const widget = {
        _id: 'widget123',
        metaType: 'widget',
        type: 'test',
        borderColor: 'red',
        backgroundColor: 'blue',
        alignment: 'align-left'
      };

      // Step 1: prepareWidgetStyles
      const styles = apos.styles.prepareWidgetStyles(widget);

      const stylesExpected = {
        hasStyleId: !!styles.styleId,
        widgetId: styles.widgetId,
        hasCss: !!styles.css,
        hasInline: !!styles.inline,
        hasCssColor: styles.css.includes('border-color: red'),
        hasCssBackground: styles.css.includes('background-color: blue'),
        hasClasses: styles.classes.includes('align-left')
      };
      assert.deepEqual(stylesExpected, {
        hasStyleId: true,
        widgetId: 'widget123',
        hasCss: true,
        hasInline: false,
        hasCssColor: true,
        hasCssBackground: true,
        hasClasses: true
      }, 'prepareWidgetStyles should return correct styles object');

      // Step 2: getWidgetElements consumes styles
      const elements = apos.styles.getWidgetElements(styles);

      const elementsExpected = {
        referencesStyleId: elements.includes(`data-apos-widget-style-id="${styles.styleId}"`),
        referencesWidgetId: elements.includes(`data-apos-widget-style-for="${styles.widgetId}"`),
        containsCss: elements.includes('border-color: red')
      };
      assert.deepEqual(elementsExpected, {
        referencesStyleId: true,
        referencesWidgetId: true,
        containsCss: true
      }, 'getWidgetElements should render style element correctly');

      // Step 3: getWidgetAttributes consumes styles
      const attributes = apos.styles.getWidgetAttributes(styles);

      const attributesExpected = {
        hasId: attributes.includes(`id="${styles.styleId}"`),
        hasDataWrapperFor: attributes.includes(`data-apos-widget-style-wrapper-for="${styles.widgetId}"`),
        hasDataWrapperClasses: attributes.includes(`data-apos-widget-style-classes="${styles.classes.join(' ')}"`),
        hasClasses: attributes.includes('class="align-left"'),
        hasNoInlineStyle: !attributes.includes('style=')
      };
      assert.deepEqual(attributesExpected, {
        hasId: true,
        hasDataWrapperFor: true,
        hasDataWrapperClasses: true,
        hasClasses: true,
        hasNoInlineStyle: true
      }, 'getWidgetAttributes should render attributes correctly');
    });

    it('should handle widget with only css output (no inline, no classes)', function () {
      const widget = {
        _id: 'widget-css-only',
        metaType: 'widget',
        type: 'test',
        borderColor: 'green'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const elements = apos.styles.getWidgetElements(styles);
      const attributes = apos.styles.getWidgetAttributes(styles);

      const actualChecks = {
        elementContainsCss: elements.includes('border-color: green'),
        attributesHasId: attributes.includes(`id="${styles.styleId}"`),
        attributesHasNoClass: !attributes.includes('class='),
        attributesHasNoStyle: !attributes.includes('style=')
      };
      assert.deepEqual(actualChecks, {
        elementContainsCss: true,
        attributesHasId: true,
        attributesHasNoClass: true,
        attributesHasNoStyle: true
      }, 'widget with only css should produce correct output');
    });

    it('should handle widget with only inline output (no css, no classes)', function () {
      const widget = {
        _id: 'widget-inline-only',
        metaType: 'widget',
        type: 'test',
        backgroundColor: 'yellow'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const elements = apos.styles.getWidgetElements(styles);
      const attributes = apos.styles.getWidgetAttributes(styles);
      assert.equal(elements, '', 'elements should be empty (no css)');
      assert(
        attributes.includes('style="background-color: yellow'),
        'attributes should have inline style'
      );
      assert(!attributes.includes('class='), 'attributes should not have class');
    });

    it('should handle widget with only class output (no css, no inline)', function () {
      const widget = {
        _id: 'widget-class-only',
        metaType: 'widget',
        type: 'test',
        alignment: 'align-center'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const elements = apos.styles.getWidgetElements(styles);
      const attributes = apos.styles.getWidgetAttributes(styles);

      assert.equal(elements, '', 'elements should be empty (no css)');
      assert(attributes.includes('class="align-center"'), 'attributes should have class');
      assert(!attributes.includes('style='), 'attributes should not have inline style');
    });

    it('should handle widget with no style values', function () {
      const widget = {
        _id: 'widget-no-styles',
        metaType: 'widget',
        type: 'no-styles'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const elements = apos.styles.getWidgetElements(styles);
      const attributes = apos.styles.getWidgetAttributes(styles);

      const actualChecks = {
        hasStyleId: !!styles.styleId,
        widgetId: styles.widgetId,
        elementsEmpty: elements === '',
        attributesHasId: attributes.includes(`id="${styles.styleId}"`),
        attributesHasNoClass: !attributes.includes('class='),
        attributesHasNoStyle: !attributes.includes('style=')
      };
      assert.deepEqual(actualChecks, {
        hasStyleId: true,
        widgetId: 'widget-no-styles',
        elementsEmpty: true,
        attributesHasId: true,
        attributesHasNoClass: true,
        attributesHasNoStyle: true
      }, 'widget with no styles should produce correct output');
    });

    it('should return empty styles object from prepareWidgetStyles for unknown widget type', function () {
      const widget = {
        _id: 'widget-unknown',
        metaType: 'widget',
        type: 'unknown'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);

      assert.deepEqual(styles, {
        styleId: '',
        widgetId: '',
        css: '',
        inline: '',
        classes: []
      }, 'should return empty styles object');
    });

    it('should generate unique styleId for each prepareWidgetStyles call', function () {
      const widget = {
        _id: 'widget-unique',
        metaType: 'widget',
        type: 'test'
      };

      const styles1 = apos.styles.prepareWidgetStyles(widget);
      const styles2 = apos.styles.prepareWidgetStyles(widget);

      assert.notEqual(styles1.styleId, styles2.styleId, 'styleIds should be unique');
    });

    it('should merge additional attributes with prepared styles', function () {
      const widget = {
        _id: 'widget-merge',
        metaType: 'widget',
        type: 'test',
        backgroundColor: 'blue',
        alignment: 'align-left'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const additionalAttrs = {
        class: 'custom-class',
        style: 'margin: 10px',
        'data-testid': 'my-widget',
        'aria-label': 'Custom Widget'
      };

      const attributes = apos.styles.getWidgetAttributes(styles, additionalAttrs);
      const actualChecks = {
        mergedClasses: attributes.includes('class="align-left custom-class"'),
        mergedStyles: attributes.includes('style="background-color: blue;margin: 10px;"'),
        hasDataTestId: attributes.includes('data-testid="my-widget"'),
        hasAriaLabel: attributes.includes('aria-label="Custom Widget"')
      };
      assert.deepEqual(actualChecks, {
        mergedClasses: true,
        mergedStyles: true,
        hasDataTestId: true,
        hasAriaLabel: true
      }, 'additional attributes should be merged correctly');
    });

    it('should deduplicate classes when merging additional attributes', function () {
      const widget = {
        _id: 'widget-dedup',
        metaType: 'widget',
        type: 'test',
        alignment: 'align-left'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const additionalAttrs = {
        class: 'align-left extra-class'
      };

      const attributes = apos.styles.getWidgetAttributes(styles, additionalAttrs);
      assert(attributes.includes('class="align-left extra-class"'), 'should deduplicate classes');
      assert(
        attributes.includes('data-apos-widget-style-classes="align-left"'),
        'should save classes reference correctly'
      );
      assert.equal(
        (attributes.match(/align-left/g) || []).length,
        2,
        'align-left should appear twice'
      );
    });

    it('should handle additional attributes as array for classes', function () {
      const widget = {
        _id: 'widget-array-class',
        metaType: 'widget',
        type: 'test',
        alignment: 'align-center'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const additionalAttrs = {
        class: [ 'extra1', 'extra2' ]
      };

      const attributes = apos.styles.getWidgetAttributes(styles, additionalAttrs);

      assert(attributes.includes('class="align-center extra1 extra2"'), 'should merge array classes');
    });

    it('should add additional attributes when styles have no classes or inline', function () {
      const widget = {
        _id: 'widget-add-attrs',
        metaType: 'widget',
        type: 'no-styles'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const additionalAttrs = {
        class: 'added-class',
        style: 'color: red',
        'data-custom': 'value'
      };

      const attributes = apos.styles.getWidgetAttributes(styles, additionalAttrs);
      const actualChecks = {
        hasClass: attributes.includes('class="added-class"'),
        hasStyle: attributes.includes('style="color: red;"'),
        hasCustomAttr: attributes.includes('data-custom="value"')
      };
      assert.deepEqual(actualChecks, {
        hasClass: true,
        hasStyle: true,
        hasCustomAttr: true
      }, 'additional attributes should be added when styles have none');
    });

    it('should ignore null and undefined values in additional attributes', function () {
      const widget = {
        _id: 'widget-null-attrs',
        metaType: 'widget',
        type: 'test'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const additionalAttrs = {
        'data-null': null,
        'data-undefined': undefined,
        'data-valid': 'value'
      };

      const attributes = apos.styles.getWidgetAttributes(styles, additionalAttrs);

      const actualChecks = {
        hasNoNullAttr: !attributes.includes('data-null'),
        hasNoUndefinedAttr: !attributes.includes('data-undefined'),
        hasValidAttr: attributes.includes('data-valid="value"')
      };
      assert.deepEqual(actualChecks, {
        hasNoNullAttr: true,
        hasNoUndefinedAttr: true,
        hasValidAttr: true
      }, 'null and undefined attribute values should be ignored');
    });

    it('should filter empty strings from additional classes', function () {
      const widget = {
        _id: 'widget-filter-empty',
        metaType: 'widget',
        type: 'test',
        alignment: 'align-right'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const additionalAttrs = {
        class: '  extra1   extra2  '
      };

      const attributes = apos.styles.getWidgetAttributes(styles, additionalAttrs);

      assert(attributes.includes('class="align-right extra1 extra2"'), 'should filter empty strings');
    });

    describe('edge cases for getWidgetElements', function () {
      it('should return empty string for null input', function () {
        assert.equal(apos.styles.getWidgetElements(null), '');
      });

      it('should return empty string for undefined input', function () {
        assert.equal(apos.styles.getWidgetElements(undefined), '');
      });

      it('should return empty string when css is missing', function () {
        assert.equal(apos.styles.getWidgetElements({ styleId: 'test' }), '');
      });

      it('should return empty string when styleId is missing', function () {
        assert.equal(apos.styles.getWidgetElements({ css: '.test{}' }), '');
      });

      it('should return empty string when css is empty', function () {
        assert.equal(apos.styles.getWidgetElements({
          css: '',
          styleId: 'test'
        }), '');
      });
    });

    describe('edge cases for getWidgetAttributes', function () {
      it('should return empty string for null input', function () {
        assert.equal(apos.styles.getWidgetAttributes(null), '');
      });

      it('should return empty string for undefined input', function () {
        assert.equal(apos.styles.getWidgetAttributes(undefined), '');
      });

      it('should return empty string when styleId is missing', function () {
        assert.equal(apos.styles.getWidgetAttributes({ classes: [ 'test' ] }), '');
      });

      it('should handle missing widgetId', function () {
        const result = apos.styles.getWidgetAttributes({ styleId: 'test' });
        assert(result.includes('data-apos-widget-style-wrapper-for=""'));
      });

      it('should handle empty classes array', function () {
        const result = apos.styles.getWidgetAttributes({
          classes: [],
          styleId: 'test',
          widgetId: 'w1'
        });
        assert(!result.includes('class='));
      });

      it('should handle empty additional attributes object', function () {
        const result = apos.styles.getWidgetAttributes({
          classes: [ 'c1' ],
          inline: 'color: red',
          styleId: 'test',
          widgetId: 'w1'
        }, {});
        assert(
          result.includes('class="c1"'),
          'should include class c1'
        );
        assert(
          result.includes('style="color: red;"'),
          'should include inline style'
        );
      });

      it('should return the attributes as an object when specified', function () {
        const result = apos.styles.getWidgetAttributes({
          classes: [ 'c1' ],
          inline: 'color: red',
          styleId: 'test',
          widgetId: 'w1'
        }, {}, { asObject: true });
        assert.deepEqual(result, {
          id: 'test',
          class: 'c1',
          style: 'color: red;',
          'data-apos-widget-style-wrapper-for': 'w1',
          'data-apos-widget-style-classes': 'c1'
        });
      });
    });
  });

  describe('Widgets auto wrapper opt-out', function () {
    let apos;
    let page;
    let jar;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          'test-style-page': {
            fields: {
              add: {
                body: {
                  type: 'area',
                  options: {
                    widgets: {
                      'test-nostyle': {}
                    }
                  }
                }
              }
            }
          },
          'test-nostyle-widget': {
            options: {
              stylesWrapper: false
            },
            styles: {
              add: {
                textColor: {
                  type: 'color',
                  property: 'color',
                  selector: '.whatever'
                }
              }
            }
          }
        }
      });

      // Add a test page to work with
      const req = apos.task.getReq();
      const input = {
        slug: '/test-styles',
        type: 'test-style-page',
        title: 'Test Styles Page',
        metaType: 'doc'
      };
      const instance = apos.util.getManagerOf(input).newInstance();
      input.body = {
        ...instance.body,
        items: [
          {
            metaType: 'widget',
            type: 'test-nostyle',
            textColor: 'purple'
          }
        ]
      };
      page = await apos.doc.insert(req, {
        ...instance,
        ...input
      });
      assert.equal(page.aposMode, 'published');
      assert.equal(page.slug, input.slug);

      jar = apos.http.jar();
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('should not wrap widget output in styles wrapper', async function () {
      const [ widget ] = page.body.items;
      assert.equal(apos.modules['test-nostyle-widget']?.options?.stylesWrapper, false);
      assert.equal(widget?.type, 'test-nostyle');
      assert.equal(widget.textColor, 'purple');

      const result = await apos.http.get('/test-styles', { jar });

      assert.equal(
        result.includes('<style'),
        false,
        'No style tag should be rendered for widget'
      );
      assert.equal(
        result.includes('<article class="no-style-widget">content</article>'),
        true,
        'Widget output should not be wrapped in styles wrapper'
      );
    });
  });

  describe('Nunjucks helpers (stylesWrapper: false)', function () {
    let apos;
    let page;
    let jar;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          // A page that uses the test-style-widget
          'test-style-page': {},
          'test-style-widget': {
            options: {
              stylesWrapper: false
            },
            styles: {
              add: {
                // Produces CSS output
                borderColor: {
                  type: 'color',
                  property: 'border-color',
                  selector: '.border'
                },
                // Produces inline output (no selector)
                backgroundColor: {
                  type: 'color',
                  property: 'background-color'
                },
                // Produces class output
                alignment: {
                  type: 'select',
                  class: true,
                  choices: [
                    {
                      label: 'None',
                      value: ''
                    },
                    {
                      label: 'Left',
                      value: 'align-left'
                    },
                    {
                      label: 'Center',
                      value: 'align-center'
                    }
                  ],
                  def: ''
                }
              }
            }
          }
        }
      });

      // Add a test page to work with
      const req = apos.task.getReq();
      const input = {
        slug: '/test-styles',
        type: 'test-style-page',
        title: 'Test Styles Page',
        metaType: 'doc'
      };
      const instance = apos.util.getManagerOf(input).newInstance();
      page = await apos.doc.insert(req, {
        ...instance,
        ...input
      });
      assert.equal(page.aposMode, 'published');
      assert.equal(page.slug, input.slug);

      jar = apos.http.jar();
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('should render styles helpers correctly in widget template (css)', async function () {
      const updated = await apos.doc.update(apos.task.getReq(), {
        ...page,
        body: {
          ...page.body,
          items: [
            {
              type: 'test-style',
              borderColor: 'red',
              backgroundColor: 'blue',
              alignment: 'align-left',
              metaType: 'widget'
            }
          ]
        }
      });
      const widget = updated.body.items[0];
      const res = await apos.http.get('/test-styles', { jar });
      const styleIdMatch = res.match(/data-apos-widget-style-id="([^"]+)"/);
      const styleId = styleIdMatch ? styleIdMatch[1] : null;
      const actual = {
        hasStyleId: !!styleId,
        hasWidgetId: !!widget._id,
        hasStyleElement: res
          .includes(`<style data-apos-widget-style-for="${widget._id}" data-apos-widget-style-id="${styleId}">`),
        hasBorderCss: res
          .includes(`#${styleId} .border{border-color: red;}`),
        hasBackgroundColorCss: res
          .includes(`#${styleId}{background-color: blue;}`),
        hasWrapper: res
          .includes(`<article id="${styleId}" data-apos-widget-style-wrapper-for="${widget._id}" data-apos-widget-style-classes="align-left" class="align-left fancy-article">`),
        closesWrapper: res
          .includes('</article>')
      };

      assert.deepEqual(actual, {
        hasStyleId: true,
        hasWidgetId: true,
        hasStyleElement: true,
        hasBorderCss: true,
        hasBackgroundColorCss: true,
        hasWrapper: true,
        closesWrapper: true
      }, 'Nunjucks helpers should render correctly in widget template');
    });

    it('should render styles helpers correctly in widget template (no styles)', async function () {
      const updated = await apos.doc.update(apos.task.getReq(), {
        ...page,
        body: {
          ...page.body,
          items: [
            {
              type: 'test-style',
              metaType: 'widget'
            }
          ]
        }
      });
      const widget = updated.body.items[0];
      const res = await apos.http.get('/test-styles', { jar });
      const styleIdMatch = res.match(/id="([^"]+)"/);
      const styleId = styleIdMatch ? styleIdMatch[1] : null;

      const actual = {
        hasStyleId: !!styleId,
        hasWidgetId: !!widget._id,
        hasStyleElement: res
          .includes(`<style data-apos-widget-style-for="${styleId}">`),
        hasWrapper: res
          .includes(`<article id="${styleId}" data-apos-widget-style-wrapper-for="${widget._id}" data-apos-widget-style-classes="" class="fancy-article">`),
        closesWrapper: res
          .includes('</article>')
      };

      assert.deepEqual(actual, {
        hasStyleId: true,
        hasWidgetId: true,
        hasStyleElement: false,
        hasWrapper: true,
        closesWrapper: true
      }, 'Nunjucks helpers should render correctly in widget template with no styles');
    });

    it('should render styles helpers correctly in widget template (inline)', async function () {
      const updated = await apos.doc.update(apos.task.getReq(), {
        ...page,
        body: {
          ...page.body,
          items: [
            {
              type: 'test-style',
              backgroundColor: 'blue',
              metaType: 'widget'
            }
          ]
        }
      });
      const widget = updated.body.items[0];
      const res = await apos.http.get('/test-styles', { jar });
      const styleIdMatch = res.match(/id="([^"]+)"/);
      const styleId = styleIdMatch ? styleIdMatch[1] : null;

      const actual = {
        hasStyleId: !!styleId,
        hasWidgetId: !!widget._id,
        hasStyleElement: res
          .includes(`<style data-apos-widget-style-for="${styleId}">`),
        hasBackgroundColorCss: res
          .includes(`#${styleId}{background-color: blue;}`),
        hasBackgroundColorInline: res
          .includes('style="background-color: blue;"'),
        hasWrapper: res
          .includes(`<article id="${styleId}" data-apos-widget-style-wrapper-for="${widget._id}" data-apos-widget-style-classes="" class="fancy-article" style="background-color: blue;">`),
        closesWrapper: res
          .includes('</article>')
      };

      assert.deepEqual(actual, {
        hasStyleId: true,
        hasWidgetId: true,
        hasStyleElement: false,
        hasBackgroundColorCss: false,
        hasBackgroundColorInline: true,
        hasWrapper: true,
        closesWrapper: true
      }, 'Nunjucks helpers should render correctly in widget template with inline styles');
    });
  });

  describe('Migrations', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/styles': {
            fields: {
              add: {
                textColor: {
                  type: 'color',
                  label: 'Text Color',
                  help: 'Choose a color for the text',
                  selector: '.palette-playground',
                  property: 'color'
                },
                colorVariable: {
                  type: 'color',
                  label: 'Background Color via CSS Variable',
                  help: 'Used in text background color',
                  selector: ':root',
                  property: '--cool-variable-for-palette-testing'
                },
                textDecoration: {
                  type: 'select',
                  label: 'Text Decoration',
                  selector: '.palette-playground',
                  property: 'text-decoration',
                  choices: [
                    {
                      label: 'None',
                      value: 'none'
                    },
                    {
                      label: 'Underline',
                      value: 'underline'
                    }
                  ]
                },
                fontSize: {
                  label: 'Font Size',
                  type: 'range',
                  min: 1,
                  max: 40,
                  step: 1,
                  def: 30,
                  unit: 'px',
                  property: 'font-size',
                  selector: '.palette-playground'
                },
                fontFamily: {
                  label: 'Font Family',
                  type: 'select',
                  selector: '.palette-playground',
                  property: 'font-family',
                  help: 'Fonts defined in global',
                  choices: 'getFontFamilyChoices'
                },
                borderStyle: {
                  type: 'select',
                  label: 'Border Style',
                  selector: '.palette-playground',
                  property: 'border-style',
                  choices: [
                    {
                      label: 'None',
                      value: 'none'
                    },
                    {
                      label: 'Solid',
                      value: 'solid'
                    },
                    {
                      label: 'Dotted',
                      value: 'dotted'
                    }
                  ]
                },
                borderWidth: {
                  label: 'Border Width',
                  type: 'range',
                  min: 1,
                  max: 5,
                  step: 1,
                  unit: 'px',
                  property: 'border-width',
                  selector: '.palette-playground'
                },
                borderColor: {
                  type: 'color',
                  label: 'Border Color',
                  selector: '.palette-playground',
                  property: 'border-color'
                },
                borderRadius: {
                  label: 'Border Radius',
                  type: 'range',
                  min: 0,
                  max: 50,
                  step: 0.5,
                  unit: '%',
                  property: 'border-radius',
                  selector: '.palette-playground'
                },
                marginTop: {
                  label: 'Margin Top',
                  type: 'range',
                  min: 0,
                  max: 20,
                  step: 1,
                  unit: 'px',
                  property: 'margin-top',
                  selector: '.palette-playground'
                },
                marginRight: {
                  label: 'Margin Right',
                  type: 'range',
                  min: 0,
                  max: 20,
                  step: 1,
                  unit: 'px',
                  property: 'margin-right',
                  selector: '.palette-playground'
                },
                marginBottom: {
                  label: 'Margin Bottom',
                  type: 'range',
                  min: 0,
                  max: 20,
                  step: 1,
                  unit: 'px',
                  property: 'margin-bottom',
                  selector: '.palette-playground'
                },
                marginLeft: {
                  label: 'Margin Left',
                  type: 'range',
                  min: 0,
                  max: 20,
                  step: 1,
                  unit: 'px',
                  property: 'margin-left',
                  selector: '.palette-playground'
                },
                paddingTop: {
                  label: 'Padding Top',
                  type: 'range',
                  min: 0,
                  max: 20,
                  step: 1,
                  unit: 'px',
                  property: 'padding-top',
                  selector: '.palette-playground'
                },
                paddingRight: {
                  label: 'Padding Right',
                  type: 'range',
                  min: 0,
                  max: 20,
                  step: 1,
                  unit: 'px',
                  property: 'padding-right',
                  selector: '.palette-playground'
                },
                paddingBottom: {
                  label: 'Padding Bottom',
                  type: 'range',
                  min: 0,
                  max: 20,
                  step: 1,
                  unit: 'px',
                  property: 'padding-bottom',
                  selector: '.palette-playground'
                },
                paddingLeft: {
                  label: 'Padding Left',
                  type: 'range',
                  min: 0,
                  max: 20,
                  step: 1,
                  unit: 'px',
                  property: 'padding-left',
                  selector: '.palette-playground'
                },
                shadow: {
                  label: 'Shadow',
                  type: 'color',
                  selector: '.palette-playground',
                  property: 'box-shadow',
                  valueTemplate: '0 0 7px 2px %VALUE%'
                },
                rotation: {
                  label: 'Rotation',
                  type: 'range',
                  min: 0,
                  max: 360,
                  step: 1,
                  unit: 'deg',
                  selector: '.palette-playground',
                  property: 'transform',
                  valueTemplate: 'rotate(%VALUE%)'
                },
                blur: {
                  label: 'Blur',
                  type: 'range',
                  min: 0,
                  max: 5,
                  step: 0.1,
                  unit: 'px',
                  selector: '.palette-playground',
                  property: 'filter',
                  valueTemplate: 'blur(%VALUE%)'
                },
                float: {
                  type: 'select',
                  label: 'Float',
                  help: 'Applied on screens with width less than 801px',
                  selector: '.palette-playground',
                  property: 'float',
                  choices: [
                    {
                      label: 'None',
                      value: 'none'
                    },
                    {
                      label: 'Left',
                      value: 'left'
                    },
                    {
                      label: 'Right',
                      value: 'right'
                    }
                  ],
                  mediaQuery: 'screen and (max-width: 800px)'
                },
                opacity: {
                  type: 'select',
                  label: 'Opacity',
                  help: 'Applied on screens with width more than 800px',
                  selector: '.palette-playground',
                  property: 'opacity',
                  choices: [
                    {
                      label: '50%',
                      value: '0.5'
                    }
                  ],
                  mediaQuery: 'screen and (min-width: 801px)'
                }
              },
              group: {
                colors: {
                  label: 'Colors',
                  fields: [ 'textColor', 'colorVariable' ]
                },
                typography: {
                  label: 'Typography',
                  fields: [ 'textDecoration' ],
                  group: {
                    fonts: {
                      label: 'Fonts',
                      inline: true,
                      fields: [ 'fontSize', 'fontFamily' ]
                    }
                  }
                },
                miscellaneous: {
                  label: 'Miscellaneous',
                  group: {
                    border: {
                      label: 'Border',
                      fields: [ 'borderStyle', 'borderWidth', 'borderColor', 'borderRadius' ]
                    },
                    margin: {
                      label: 'Margin',
                      fields: [ 'marginTop', 'marginRight', 'marginBottom', 'marginLeft' ]
                    },
                    padding: {
                      label: 'Padding',
                      fields: [ 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft' ]
                    }
                  },
                  fields: [ 'shadow', 'rotation', 'blur' ]
                },
                mediaQueries: {
                  label: 'Media Queries',
                  fields: [ 'float', 'opacity' ]
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

    const doc = {
      textColor: '#ff0000',
      colorVariable: '#00ff00',
      textDecoration: 'underline',
      fontSize: 20,
      fontFamily: 'Arial',
      borderStyle: 'solid',
      borderWidth: 2,
      borderColor: '#0000ff',
      borderRadius: 10,
      marginTop: 5,
      marginRight: 5,
      marginBottom: 5,
      marginLeft: 5,
      paddingTop: 10,
      paddingRight: 10,
      paddingBottom: 10,
      paddingLeft: 10,
      shadow: '#333333',
      rotation: 45,
      blur: 2,
      float: 'left',
      opacity: '0.5'
    };

    it('should render legacy styles correctly (@apstrophecms/styles)', async function () {
      assert.deepEqual(
        apos.styles.stylesGroups,
        {
          colors: {
            label: 'Colors',
            fields: [ 'textColor', 'colorVariable' ]
          },
          typography: {
            label: 'Typography',
            fields: [ 'textDecoration' ],
            group: {
              fonts: {
                label: 'Fonts',
                inline: true,
                fields: [ 'fontSize', 'fontFamily' ]
              }
            }
          },
          miscellaneous: {
            label: 'Miscellaneous',
            group: {
              border: {
                label: 'Border',
                fields: [ 'borderStyle', 'borderWidth', 'borderColor', 'borderRadius' ]
              },
              margin: {
                label: 'Margin',
                fields: [ 'marginTop', 'marginRight', 'marginBottom', 'marginLeft' ]
              },
              padding: {
                label: 'Padding',
                fields: [ 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft' ]
              }
            },
            fields: [ 'shadow', 'rotation', 'blur' ]
          },
          mediaQueries: {
            label: 'Media Queries',
            fields: [ 'float', 'opacity' ]
          }
        },
        'Styles groups should not contain extra groups or fields'
      );

      const actual = apos.styles.getStylesheet(doc);
      const { css } = actual;
      const actualCss = {
        hasSelector: css.startsWith('.palette-playground{'),
        hasColor: css.includes('color: #ff0000;'),
        hasDecoration: css.includes('text-decoration: underline;'),
        hasFontSize: css.includes('font-size: 20px;'),
        hasFontFamily: css.includes('font-family: Arial;'),
        hasBorderStyle: css.includes('border-style: solid;'),
        hasBorderWidth: css.includes('border-width: 2px;'),
        hasBorderColor: css.includes('border-color: #0000ff;'),
        hasBorderRadius: css.includes('border-radius: 10%;'),
        hasMarginTop: css.includes('margin-top: 5px;'),
        hasMarginRight: css.includes('margin-right: 5px;'),
        hasMarginBottom: css.includes('margin-bottom: 5px;'),
        hasMarginLeft: css.includes('margin-left: 5px;'),
        hasPaddingTop: css.includes('padding-top: 10px;'),
        hasPaddingRight: css.includes('padding-right: 10px;'),
        hasPaddingBottom: css.includes('padding-bottom: 10px;'),
        hasPaddingLeft: css.includes('padding-left: 10px;'),
        hasShadow: css.includes('box-shadow: 0 0 7px 2px #333333;'),
        hasRotation: css.includes('transform: rotate(45deg);'),
        hasBlur: css.includes('filter: blur(2px);'),
        hasFloatMediaQuery: css.includes('@media screen and (max-width: 800px){.palette-playground{float: left;}}'),
        hasOpacityMediaQuery: css.includes('@media screen and (min-width: 801px){.palette-playground{opacity: 0.5;}}'),
        hasColorVariable: css.includes(':root{--cool-variable-for-palette-testing: #00ff00;}')
      };
      assert.deepEqual(
        actualCss,
        {
          hasSelector: true,
          hasColor: true,
          hasDecoration: true,
          hasFontSize: true,
          hasFontFamily: true,
          hasBorderStyle: true,
          hasBorderWidth: true,
          hasBorderColor: true,
          hasBorderRadius: true,
          hasMarginTop: true,
          hasMarginRight: true,
          hasMarginBottom: true,
          hasMarginLeft: true,
          hasPaddingTop: true,
          hasPaddingRight: true,
          hasPaddingBottom: true,
          hasPaddingLeft: true,
          hasShadow: true,
          hasRotation: true,
          hasBlur: true,
          hasFloatMediaQuery: true,
          hasOpacityMediaQuery: true,
          hasColorVariable: true
        },
        'Stylesheet should render all styles correctly'
      );
    });
  });
});
