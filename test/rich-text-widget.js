const assert = require('assert/strict');
const t = require('../test-lib/test.js');

describe.only('Rich Text Widget', function () {
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
    assert.deepEqual(richText.linkFieldsGroups, {
      link: {
        fields: [
          'linkTo',
          '_@apostrophecms/any-page-type',
          'updateTitle',
          'href',
          'target'
        ]
      }
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
    assert.deepEqual(richText.linkFieldsGroups, {
      link: {
        fields: [
          'linkTo',
          '_@apostrophecms/any-page-type',
          '_article',
          'updateTitle',
          'href',
          'target'
        ]
      }
    });
    // Shouls allow the HTML attributes in the schema
    const attributes = richText
      .toolbarToAllowedAttributes(richText.options.defaultOptions);

    assert(attributes.a.includes('target'));

    // Should find field by ID (and thus support remote methods)
    assert(richText.linkSchema.length > 0);
    const target = richText.linkSchema.find(field => field.name === 'target');
    assert(target);
    assert(target._id);
    const found = apos.schema.getFieldById(target._id);
    assert.deepEqual(found, target);
  });

  it('should support link schema management and html attributes', async function () {
    await t.destroy(apos);
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/rich-text-widget': {
          linkFields: {
            add: {
              'not-attribute': {
                label: 'Not Attribute',
                type: 'string'
              },
              'aria-label': {
                label: 'Aria Label',
                type: 'string',
                htmlAttribute: true
              },
              'data-foo': {
                label: 'Data Foo',
                type: 'select',
                htmlAttribute: true,
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
              'data-bool': {
                label: 'Data Bar',
                type: 'boolean',
                htmlAttribute: true
              },
              'data-single-choice': {
                label: 'Data Choice',
                type: 'checkboxes',
                htmlAttribute: true,
                choices: [
                  {
                    label: 'Foo',
                    value: 'foo'
                  }
                ]
              }
            },
            remove: [ 'target' ],
            group: {
              link: {
                fields: [
                  'not-attribute',
                  'data-foo',
                  'data-bool',
                  'data-single-choice',
                  'aria-label'
                ]
              }
            }
          }
        }
      }
    });

    const richText = apos.modules['@apostrophecms/rich-text-widget'];
    assert(richText.linkFields);
    assert(richText.linkFields['aria-label']);
    assert(richText.linkFields['data-foo']);
    assert(richText.linkFields['data-bool']);
    assert(richText.linkFields['data-single-choice']);
    assert(richText.linkSchema.length > 0);

    const ariaLabel = richText.linkSchema.find(field => field.name === 'aria-label');
    const dataFoo = richText.linkSchema.find(field => field.name === 'data-foo');
    const dataBool = richText.linkSchema.find(field => field.name === 'data-bool');
    const dataSingleChoice = richText.linkSchema.find(field => field.name === 'data-single-choice');
    const target = richText.linkSchema.find(field => field.name === 'target');
    const notAttribute = richText.linkSchema.find(field => field.name === 'not-attribute');

    assert(ariaLabel);
    assert(ariaLabel.htmlAttribute);
    assert(dataFoo);
    assert(dataFoo.htmlAttribute);
    assert(dataBool);
    assert(dataBool.htmlAttribute);
    assert(dataSingleChoice);
    assert(dataSingleChoice.htmlAttribute);
    assert(notAttribute);
    assert(!notAttribute.htmlAttribute);
    assert.equal(typeof target, 'undefined');

    // Groups are respected
    assert.equal(
      richText.linkSchema[richText.linkSchema.length - 1].name,
      'aria-label'
    );

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
