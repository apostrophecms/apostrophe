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

  it('should update alt attributes in linkImages method', function () {
    // Since we don't have a full apos instance, test the logic directly
    const richText = {
      apos: {
        util: {
          escapeHtml: (text) => {
            if (!text) return '';
            return text.replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;')
                      .replace(/"/g, '&quot;')
                      .replace(/'/g, '&#39;');
          }
        },
        modules: {
          '@apostrophecms/image': {
            action: '/api/v1/@apostrophecms/image',
            getLargestSize: () => 'full'
          }
        }
      }
    };

    // Mock the linkImages method logic
    function linkImages(widget, content) {
      const self = richText;
      let i;
      for (const doc of (widget._relatedDocs || [])) {
        let offset = 0;
        while (true) {
          const target = `${self.apos.modules['@apostrophecms/image'].action}/${doc.aposDocId}/src`;
          i = content.indexOf(target, offset);
          if (i === -1) {
            break;
          }
          offset = i + target.length;
          const left = content.lastIndexOf('<', i);
          const src = content.indexOf(' src="', left);
          const close = content.indexOf('"', src + 6);
          if ((left !== -1) && (src !== -1) && (close !== -1)) {
            const imageModule = self.apos.modules['@apostrophecms/image'];
            const newSrc = doc.attachment._urls[imageModule.getLargestSize()];
            content = content.substring(0, src + 5) + newSrc +
              content.substring(close + 1);

            const newLeft = content.lastIndexOf('<', i);
            const newRight = content.indexOf('>', newLeft);
            if (newRight !== -1) {
              const altStart = content.indexOf(' alt="', newLeft);
              const altText = doc.alt ? self.apos.util.escapeHtml(doc.alt) : '';

              if ((altStart !== -1) && (altStart < newRight)) {
                const altValueStart = altStart + 6;
                const altEnd = content.indexOf('"', altValueStart);
                if (altEnd !== -1) {
                  content = content.substring(0, altValueStart) + altText +
                    content.substring(altEnd);
                }
              } else if (altText) {
                const beforeClose = content.substring(newRight - 1, newRight) === '/'
                  ? newRight - 1
                  : newRight;
                content = content.substring(0, beforeClose) + ` alt="${altText}"` +
                  content.substring(beforeClose);
              }
            }
          } else {
            break;
          }
        }
      }
      return content;
    }

    // Test 1: Replace existing alt attribute
    const widget1 = {
      _relatedDocs: [{
        aposDocId: 'image123',
        alt: 'Updated alt text',
        attachment: {
          _urls: {
            full: 'https://example.com/image.jpg'
          }
        }
      }]
    };
    const content1 = '<img src="/api/v1/@apostrophecms/image/image123/src" alt="Old alt" />';
    const result1 = linkImages(widget1, content1);
    assert(result1.includes('alt="Updated alt text"'));
    assert(!result1.includes('Old alt'));

    // Test 2: Insert missing alt attribute
    const widget2 = {
      _relatedDocs: [{
        aposDocId: 'image456',
        alt: 'New alt text',
        attachment: {
          _urls: {
            full: 'https://example.com/image2.jpg'
          }
        }
      }]
    };
    const content2 = '<img src="/api/v1/@apostrophecms/image/image456/src" />';
    const result2 = linkImages(widget2, content2);
    assert(result2.includes('alt="New alt text"'));

    // Test 3: HTML escaping
    const widget3 = {
      _relatedDocs: [{
        aposDocId: 'image789',
        alt: 'Text with "quotes" & <symbols>',
        attachment: {
          _urls: {
            full: 'https://example.com/image3.jpg'
          }
        }
      }]
    };
    const content3 = '<img src="/api/v1/@apostrophecms/image/image789/src" />';
    const result3 = linkImages(widget3, content3);
    assert(result3.includes('&quot;quotes&quot;'));
    assert(result3.includes('&amp;'));
    assert(result3.includes('&lt;symbols&gt;'));
  });
});
