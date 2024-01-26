const assert = require('assert/strict');
const t = require('../test-lib/test.js');

describe('Rich Text Widget', function () {
  let apos;
  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  it('should have rich text link types by default', async function () {
    apos = await t.create({
      root: module,
      modules: {}
    });

    const richText = apos.modules['@apostrophecms/rich-text-widget'];

    assert(richText.linkFields);
    assert(richText.linkFields.linkTo);
    assert.equal(richText.linkFields.linkTo.choices.length, 2);
    assert.deepEqual(richText.linkFields.linkTo.choices[0], {
      label: 'apostrophe:page',
      value: '@apostrophecms/any-page-type'
    });
    assert.deepEqual(richText.linkFields.linkTo.choices[1], {
      label: 'apostrophe:url',
      value: '_url'
    });
  });

  it('should support custom rich text link types', async function () {
    await t.destroy(apos);
    apos = await t.create({
      root: module,
      modules: {
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            label: 'Article'
          }
        },
        '@apostrophecms/rich-text-widget': {
          options: {
            linkWithType: [ '@apostrophecms/any-page-type', 'article' ]
          }
        }
      }
    });

    const richText = apos.modules['@apostrophecms/rich-text-widget'];

    assert(apos.modules.article);
    assert(richText.linkFields);
    assert(richText.linkFields.linkTo);
    assert.equal(richText.linkFields.linkTo.choices.length, 3);
    assert.deepEqual(richText.linkFields.linkTo.choices[0], {
      label: 'apostrophe:page',
      value: '@apostrophecms/any-page-type'
    });
    assert.deepEqual(richText.linkFields.linkTo.choices[1], {
      label: 'Article',
      value: 'article'
    });
    assert.deepEqual(richText.linkFields.linkTo.choices[2], {
      label: 'apostrophe:url',
      value: '_url'
    });
    // Shouls allow the HTML attributes in the schema
    const attributes = richText
      .toolbarToAllowedAttributes(richText.options.defaultOptions);

    assert(attributes.a.includes('target'));
  });

  it('should support link schema management and html attributes', async function () {
    await t.destroy(apos);
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/rich-text-widget': {
          linkFields: {
            add: {
              notAnAttribute: {
                label: 'Not An Attribute',
                type: 'string'
              },
              ariaLabel: {
                label: 'Aria Label',
                type: 'string',
                htmlAttribute: 'aria-label'
              },
              dataFoo: {
                label: 'Data Foo',
                type: 'select',
                htmlAttribute: 'data-foo',
                choices: [
                  {
                    label: 'Foo',
                    value: 'foo'
                  },
                  {
                    label: 'Bar',
                    value: 'bar'
                  }
                ]
              },
              dataBool: {
                label: 'Data Bar',
                type: 'boolean',
                htmlAttribute: 'data-bool'
              },
              dataSingleChoice: {
                label: 'Data Choice',
                type: 'checkboxes',
                htmlAttribute: 'data-single-choice',
                choices: [
                  {
                    label: 'Foo',
                    value: 'foo'
                  }
                ]
              }
            },
            remove: [ 'target' ]
          }
        }
      }
    });

    const richText = apos.modules['@apostrophecms/rich-text-widget'];
    assert(richText.linkFields);
    assert(richText.linkFields.ariaLabel);
    assert(richText.linkFields.dataFoo);
    assert(richText.linkFields.dataBool);
    assert(richText.linkFields.dataSingleChoice);
    assert(richText.linkSchema.length > 0);

    const ariaLabel = richText.linkSchema.find(field => field.htmlAttribute === 'aria-label');
    const dataFoo = richText.linkSchema.find(field => field.htmlAttribute === 'data-foo');
    const dataBool = richText.linkSchema.find(field => field.htmlAttribute === 'data-bool');
    const dataSingleChoice = richText.linkSchema.find(field => field.htmlAttribute === 'data-single-choice');
    const target = richText.linkSchema.find(field => field.htmlAttribute === 'target');
    const notAttribute = richText.linkSchema.find(field => field.htmlAttribute === 'not-attribute');

    assert(ariaLabel);
    assert(dataFoo);
    assert(dataBool);
    assert(dataSingleChoice);
    assert.equal(typeof notAttribute, 'undefined');
    assert.equal(typeof target, 'undefined');

    // Allows the HTML attributes in the schema
    const attributes = richText
      .toolbarToAllowedAttributes(richText.options.defaultOptions);

    assert.equal(attributes.a.includes('target'), false);
    assert.equal(attributes.a.includes('aria-label'), true);
    assert.equal(attributes.a.includes('data-foo'), true);
    assert.equal(attributes.a.includes('data-bool'), true);
    assert.equal(attributes.a.includes('data-single-choice'), true);
  });
});
