const assert = require('assert/strict');
const t = require('../test-lib/test.js');

describe('Rich Text Schema Field', function () {
  let apos;
  this.timeout(t.timeout);

  afterEach(function() {
    return t.destroy(apos);
  });

  it('should register a richText field type mapped to AposInputRichText', async function () {
    apos = await t.create({
      root: module,
      modules: {}
    });

    assert(apos.schema.fieldTypes.richText);
    assert.equal(apos.schema.fieldTypes.richText.def, '');

    const req = apos.task.getReq();
    const browserData = apos.schema.getBrowserData(req);

    assert.equal(browserData.components.fields.richText, 'AposInputRichText');
  });

  it('should sanitize according to the rich text widget default options', async function () {
    apos = await t.create({
      root: module,
      modules: {}
    });

    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'richText',
          name: 'body',
          label: 'Body'
        }
      ]
    });
    const req = apos.task.getReq();
    const result = {};

    await apos.schema.convert(req, schema, {
      body: '<h2>Hello</h2><p><strong>Bold</strong></p><script>alert("nope")</script>'
    }, result);

    // h2 is one of the default styles, strong is available via the bold tool
    assert.equal(
      result.body,
      '<h2>Hello</h2><p><strong>Bold</strong></p>'
    );
  });

  it('should sanitize according to per-field options', async function () {
    apos = await t.create({
      root: module,
      modules: {}
    });

    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'richText',
          name: 'body',
          label: 'Body',
          options: {
            toolbar: [ 'styles', 'bold' ],
            styles: [
              {
                tag: 'p',
                label: 'Paragraph'
              }
            ]
          }
        }
      ]
    });
    const req = apos.task.getReq();
    const result = {};

    await apos.schema.convert(req, schema, {
      body: '<h2>Hello</h2><p><strong>Bold</strong></p><p><em>Italic</em></p>'
    }, result);

    // h2 is not among this field's styles and italic is not among its tools,
    // so both tags go away, but their text is preserved
    assert.equal(
      result.body,
      'Hello<p><strong>Bold</strong></p><p>Italic</p>'
    );
  });

  it('should honor rich text widget module level option overrides', async function () {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/rich-text-widget': {
          options: {
            defaultOptions: {
              toolbar: [ 'styles' ],
              styles: [
                {
                  tag: 'p',
                  label: 'Paragraph'
                },
                {
                  tag: 'h2',
                  label: 'Heading 2'
                }
              ]
            }
          }
        }
      }
    });

    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'richText',
          name: 'body',
          label: 'Body'
        }
      ]
    });
    const req = apos.task.getReq();
    const result = {};
    const input = {
      body: '<h2>Hello</h2><h3>Nope</h3><p><strong>Bold</strong></p>'
    };

    await apos.schema.convert(req, schema, input, result);

    // h3 and strong are no longer configured for anything
    assert.equal(result.body, '<h2>Hello</h2>Nope<p>Bold</p>');

    // And the widget, which is the other path to the same implementation,
    // agrees
    const widget = await apos.modules['@apostrophecms/rich-text-widget'].sanitize(
      req,
      {
        type: '@apostrophecms/rich-text',
        content: input.body
      },
      {}
    );

    assert.equal(widget.content, result.body);
  });

  it('should still honor per-area options for rich text widgets', async function () {
    apos = await t.create({
      root: module,
      modules: {}
    });

    const req = apos.task.getReq();
    const widget = await apos.modules['@apostrophecms/rich-text-widget'].sanitize(
      req,
      {
        type: '@apostrophecms/rich-text',
        content: '<h2>Hello</h2><p><em>Italic</em></p>'
      },
      {
        toolbar: [ 'styles', 'italic' ],
        styles: [
          {
            tag: 'p',
            label: 'Paragraph'
          }
        ]
      }
    );

    assert.equal(widget.content, 'Hello<p><em>Italic</em></p>');
  });

  it('should enforce required, using the same emptiness test as the widget', async function () {
    apos = await t.create({
      root: module,
      modules: {}
    });

    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'richText',
          name: 'body',
          label: 'Body',
          required: true
        }
      ]
    });
    const req = apos.task.getReq();

    await assert.rejects(
      apos.schema.convert(req, schema, { body: '<p></p>' }, {}),
      (errors) => {
        assert.equal(errors.length, 1);
        assert.equal(errors[0].path, 'body');
        assert.equal(errors[0].name, 'required');
        return true;
      }
    );

    // A table has no text of its own but it is certainly content
    const result = {};
    await apos.schema.convert(req, schema, {
      body: '<table><tbody><tr><td></td></tr></tbody></table>'
    }, result);
    assert(result.body.includes('<table'));
  });

  it('should report emptiness the same way the widget does', async function () {
    apos = await t.create({
      root: module,
      modules: {}
    });

    const field = {
      type: 'richText',
      name: 'body'
    };
    const { isEmpty } = apos.schema.fieldTypes.richText;

    assert.equal(isEmpty(field, ''), true);
    assert.equal(isEmpty(field, '<p></p>'), true);
    assert.equal(isEmpty(field, '<p>&nbsp;</p>'), true);
    assert.equal(isEmpty(field, '<p>Hi</p>'), false);
    assert.equal(isEmpty(field, '<figure><img src="/x" /></figure>'), false);
  });

  it('should contribute to search text and to extraction', async function () {
    apos = await t.create({
      root: module,
      modules: {
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            label: 'Article'
          },
          fields: {
            add: {
              body: {
                type: 'richText',
                label: 'Body'
              }
            }
          }
        }
      }
    });

    const req = apos.task.getReq();
    const article = await apos.modules.article.insert(req, {
      ...apos.modules.article.newInstance(),
      title: 'Article One',
      body: '<p>Findable content</p>'
    });

    // Body copy, like the content of a rich text widget, is indexed at the
    // lower weight and appears in the search summary
    assert(article.lowSearchText.includes('findable content'));
    assert(article.searchSummary.includes('Findable content'));

    const extracted = apos.schema.extract(req, apos.modules.article.schema, article);
    const item = extracted.find(one => one.path === 'body');

    assert(item);
    assert.equal(item.text, '<p>Findable content</p>');
    assert(item.tags.includes('text'));
  });

  it('should round trip a rich text field through the database', async function () {
    apos = await t.create({
      root: module,
      modules: {
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            label: 'Article'
          },
          fields: {
            add: {
              body: {
                type: 'richText',
                label: 'Body'
              }
            }
          }
        }
      }
    });

    const req = apos.task.getReq();
    const inserted = await apos.modules.article.insert(req, {
      ...apos.modules.article.newInstance(),
      title: 'Article Two',
      body: '<h3>Heading</h3><p>Body copy</p>'
    });

    const found = await apos.modules.article.find(req, { _id: inserted._id }).toObject();

    assert.equal(found.body, '<h3>Heading</h3><p>Body copy</p>');
  });

  it('should resolve permalinks in rich text field markup on request', async function () {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/page': {
          options: {
            park: [
              {
                parkedId: 'contact',
                type: '@apostrophecms/home-page',
                slug: '/contact',
                title: 'Contact'
              }
            ]
          }
        }
      }
    });

    const req = apos.task.getReq();
    const page = await apos.page.find(req, { slug: '/contact' }).toObject();

    assert(page);

    const content = `<p><a href="#apostrophe-permalink-${page.aposDocId}?updateTitle=1">Old Title</a></p>`;
    const richText = apos.modules['@apostrophecms/rich-text-widget'];
    const rendered = await richText.renderRichText(req, content);

    // Note the unquoted href: that is the long standing output of
    // `linkPermalinks`, which rich text widgets have always shared, so the
    // field type inherits it rather than diverging from the widget
    assert.equal(rendered, '<p><a href=/contact>Contact</a></p>');

    // The stored markup is never modified
    assert(content.includes('apostrophe-permalink-'));
  });

  it('should warn when rich text options are not nested in options', async function () {
    const warnings = [];

    apos = await t.create({
      root: module,
      modules: {
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            label: 'Article'
          },
          fields: {
            add: {
              body: {
                type: 'richText',
                label: 'Body',
                toolbar: [ 'bold' ]
              }
            }
          }
        },
        // Schema field validation warnings are emitted via `apos.util.error`
        '@apostrophecms/util': {
          methods() {
            return {
              error(...args) {
                warnings.push(args.join(' '));
              }
            };
          }
        }
      }
    });

    assert(warnings.some(warning => warning.includes('nest "toolbar" inside "options"')));
  });
});
