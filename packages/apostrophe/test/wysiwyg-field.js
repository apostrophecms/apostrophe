const assert = require('assert/strict');
const t = require('../test-lib/test.js');

describe('Field Tag and Wysiwyg Fields', function () {
  let apos;
  this.timeout(t.timeout);

  afterEach(function() {
    return t.destroy(apos);
  });

  // A page type with one of everything the field tag has to cope with
  function modules() {
    return {
      '@apostrophecms/page': {
        options: {
          park: [
            {
              parkedId: 'fields',
              type: 'field-page',
              slug: '/fields',
              title: 'Fields'
            }
          ],
          types: [
            {
              name: 'field-page',
              label: 'Field Page'
            }
          ]
        }
      },
      'test-widget': {
        extend: '@apostrophecms/widget-type',
        fields: {
          add: {
            heading: {
              type: 'string',
              label: 'Heading'
            }
          }
        }
      },
      'field-page': {
        extend: '@apostrophecms/page-type',
        fields: {
          add: {
            body: {
              type: 'richText',
              label: 'Body'
            },
            subtitle: {
              type: 'string',
              label: 'Subtitle'
            },
            summary: {
              type: 'string',
              label: 'Summary',
              textarea: true
            },
            tagline: {
              type: 'string',
              label: 'Tagline',
              wysiwygIcon: 'pencil-icon'
            },
            wordCount: {
              type: 'integer',
              label: 'Word Count'
            },
            readOnlyBody: {
              type: 'richText',
              label: 'Read Only Body',
              readOnly: true
            },
            main: {
              type: 'area',
              options: {
                widgets: {
                  '@apostrophecms/rich-text': {},
                  test: {}
                }
              }
            },
            sections: {
              type: 'array',
              label: 'Sections',
              fields: {
                add: {
                  caption: {
                    type: 'string',
                    label: 'Caption'
                  },
                  detail: {
                    type: 'richText',
                    label: 'Detail'
                  },
                  blocks: {
                    type: 'area',
                    options: {
                      widgets: {
                        '@apostrophecms/rich-text': {}
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
  }

  // Render `template` with `data.page` set to the parked page, optionally
  // in editing mode, as the page would be rendered with the admin UI up
  async function render(template, { edit = false, page: override } = {}) {
    const req = apos.task.getReq(edit
      ? { query: { aposEdit: '1' } }
      : {});
    const page = override || await apos.page.find(req, { slug: '/fields' }).toObject();

    return {
      req,
      page,
      html: await apos.modules['field-page'].renderString(req, template, { page })
    };
  }

  it('should flag the field types that have an on page editor', async function () {
    apos = await t.create({
      root: module,
      modules: {}
    });

    assert.equal(apos.schema.fieldTypes.richText.wysiwyg, true);
    assert.equal(apos.schema.fieldTypes.string.wysiwyg, true);
    // Everything else has no on page editor
    assert.equal(apos.schema.fieldTypes.integer.wysiwyg, undefined);
    assert.equal(apos.schema.fieldTypes.select.wysiwyg, undefined);
    assert.equal(apos.schema.fieldTypes.area.wysiwyg, undefined);
  });

  it('should give each field type an icon for the breadcrumb trail', async function () {
    apos = await t.create({
      root: module,
      modules: {}
    });

    assert.equal(apos.schema.fieldTypes.richText.wysiwygIcon, 'format-text-icon');
    assert.equal(apos.schema.fieldTypes.string.wysiwygIcon, 'format-text-icon');
    // A field type that says nothing falls back to a generic icon
    assert.equal(apos.schema.wysiwygIconName({ type: 'integer' }), 'pencil-icon');
  });

  it('should give each field type the tag its value belongs in', async function () {
    apos = await t.create({
      root: module,
      modules: {}
    });

    // One line of text is part of the line the template put it on
    assert.equal(apos.schema.wysiwygTagName({ type: 'string' }), 'span');
    // Many lines of text are not
    assert.equal(
      apos.schema.wysiwygTagName({
        type: 'string',
        textarea: true
      }),
      'div'
    );
    assert.equal(apos.schema.wysiwygTagName({ type: 'richText' }), 'div');
    // A field type that says nothing gets a block, as before
    assert.equal(apos.schema.wysiwygTagName({ type: 'integer' }), 'div');
  });

  it('should render a single line string inline, and everything else as a block', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const subtitle = await render('{% field data.page, \'subtitle\' %}');
    assert(subtitle.html.startsWith('<span'));
    assert(subtitle.html.endsWith('</span>'));

    const summary = await render('{% field data.page, \'summary\' %}');
    assert(summary.html.startsWith('<div'));

    const body = await render('{% field data.page, \'body\' %}');
    assert(body.html.startsWith('<div'));

    // The template still has the last word
    const forced = await render(
      '{% field data.page, \'subtitle\' with { tag: \'p\' } %}'
    );
    assert(forced.html.startsWith('<p'));
    assert(forced.html.endsWith('</p>'));
  });

  it('should name the editor component after the field type', async function () {
    apos = await t.create({
      root: module,
      modules: {}
    });

    assert.equal(
      apos.schema.wysiwygComponentName('richText'),
      'AposWysiwygInputRichText'
    );
    assert.equal(
      apos.schema.wysiwygComponentName('string'),
      'AposWysiwygInputString'
    );
  });

  it('should render an area field exactly as the area tag does', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const req = apos.task.getReq();
    const page = await apos.page.find(req, { slug: '/fields' }).toObject();

    page.main = {
      _id: 'mainarea',
      metaType: 'area',
      items: [
        {
          _id: 'widget1',
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<p>Widget content</p>'
        }
      ]
    };
    await apos.page.update(req, page);

    const viaArea = await render('{% area data.page, \'main\' %}');
    const viaField = await render('{% field data.page, \'main\' %}');

    assert(viaArea.html.includes('<p>Widget content</p>'));
    assert.equal(viaField.html, viaArea.html);
  });

  it('should render an area field exactly as the area tag does when editing', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const req = apos.task.getReq();
    const page = await apos.page.find(req, { slug: '/fields' }).toObject();

    page.main = {
      _id: 'mainarea',
      metaType: 'area',
      items: []
    };
    await apos.page.update(req, page);

    const viaArea = await render('{% area data.page, \'main\' %}', { edit: true });
    const viaField = await render('{% field data.page, \'main\' %}', { edit: true });

    assert(viaArea.html.includes('data-apos-area-newly-editable'));
    assert.equal(viaField.html, viaArea.html);
  });

  it('should render a rich text field as markup, with permalinks resolved', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const req = apos.task.getReq();
    const home = await apos.page.find(req, { slug: '/' }).toObject();
    const page = await apos.page.find(req, { slug: '/fields' }).toObject();

    page.body = `<p>Hello <a href="#apostrophe-permalink-${home.aposDocId}?updateTitle=1">Old Title</a></p>`;
    await apos.page.update(req, page);

    const { html } = await render('{% field data.page, \'body\' %}');

    assert(html.includes('<div class="apos-wysiwyg-field apos-wysiwyg-field--richText"'));
    assert(html.includes('<p>Hello <a href="/">Home</a></p>'));
    // Not in editing mode, so no editor is asked for
    assert(!html.includes('data-apos-wysiwyg-field-newly-editable'));
  });

  it('should escape the value of a plain text field', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const req = apos.task.getReq();
    const page = await apos.page.find(req, { slug: '/fields' }).toObject();

    page.subtitle = 'Tom & <script>alert("nope")</script>';
    await apos.page.update(req, page);

    const { html } = await render('{% field data.page, \'subtitle\' %}');

    assert(html.includes('Tom &amp; &lt;script&gt;'));
    assert(!html.includes('<script>'));
  });

  it('should accept a tag, a class and attributes', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const req = apos.task.getReq();
    const page = await apos.page.find(req, { slug: '/fields' }).toObject();

    page.subtitle = 'Subtitle here';
    await apos.page.update(req, page);

    const { html } = await render(
      '{% field data.page, \'subtitle\' with { tag: \'span\', class: \'lede\', attrs: { role: \'note\' } } %}'
    );

    assert(html.includes('<span'));
    assert(html.includes('apos-wysiwyg-field--string'));
    assert(html.includes('lede'));
    assert(html.includes('role="note"'));
    assert(html.includes('Subtitle here'));
    assert(html.includes('</span>'));
  });

  it('should refuse an unsafe tag name', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    await assert.rejects(
      render('{% field data.page, \'subtitle\' with { tag: \'span onclick=alert(1)\' } %}'),
      (e) => {
        assert(e.message.includes('tag'));
        return true;
      }
    );
  });

  it('should output the editor markup when editing', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const req = apos.task.getReq();
    const page = await apos.page.find(req, { slug: '/fields' }).toObject();

    page.body = '<p>Editable body</p>';
    await apos.page.update(req, page);

    const { html } = await render('{% field data.page, \'body\' %}', { edit: true });

    assert(html.includes('data-apos-wysiwyg-field-newly-editable'));
    assert(html.includes('data-component="AposWysiwygInputRichText"'));
    assert(html.includes('data-patch-key="body"'));
    assert(html.includes(`data-doc-id="${page._id}"`));
    // The raw value travels to the browser as JSON, so that what the editor
    // saves back is what the user typed and not a rendering of it
    assert(html.includes('data-value=\'"&lt;p&gt;Editable body&lt;/p&gt;"\''));
    // The field is named by its id, not shipped in full: see below
    assert(html.includes('data-field-id="doc.field-page.body"'));
  });

  it('should name the field by its id rather than shipping the definition', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const { req, page } = await pageWithSections();
    const widget = {
      _id: 'widget1',
      metaType: 'widget',
      type: 'test',
      heading: 'In a widget',
      _edit: true,
      _docId: page._docId || page._id
    };

    const html = await apos.modules['field-page'].renderString(
      req,
      `{% field data.page, 'body' %}
       ${sectionTemplate('caption')}
       {% field data.widget, 'heading' %}`,
      {
        page,
        widget
      }
    );

    // Every doc type and widget type already ships its whole schema to the
    // browser, so sending the definition again with each field on the page
    // would be the same bytes twice. The id is enough to find it there
    assert(!html.includes('data-field='));

    // The id is the position of the field in the schema tree, which is what
    // makes it stable enough to be worth sending on its own
    assert(html.includes('data-field-id="doc.field-page.body"'));
    assert(html.includes('data-field-id="doc.field-page.sections.caption"'));
    assert(html.includes('data-field-id="widget.test.heading"'));

    // And every one of them is an id the schema module can resolve
    for (const [ , id ] of html.matchAll(/data-field-id="([^"]+)"/g)) {
      assert(apos.schema.getFieldById(id), `no field for ${id}`);
    }
  });

  it('should name the icon of the breadcrumb trail when editing', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const body = await render('{% field data.page, \'body\' %}', { edit: true });
    assert(body.html.includes('data-icon="format-text-icon"'));

    const subtitle = await render('{% field data.page, \'subtitle\' %}', { edit: true });
    assert(subtitle.html.includes('data-icon="format-text-icon"'));

    // The trail only exists while editing, so the icon is of no use otherwise
    const preview = await render('{% field data.page, \'body\' %}');
    assert(!preview.html.includes('data-icon'));
  });

  it('should let a field choose its own breadcrumb icon', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const { html } = await render('{% field data.page, \'tagline\' %}', { edit: true });

    assert(html.includes('data-icon="pencil-icon"'));
  });

  it('should not output the editor markup for a read only field', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const { html } = await render('{% field data.page, \'readOnlyBody\' %}', { edit: true });

    assert(html.includes('apos-wysiwyg-field--richText'));
    assert(!html.includes('data-apos-wysiwyg-field-newly-editable'));
  });

  it('should not output the editor markup when edit is false', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const { html } = await render(
      '{% field data.page, \'subtitle\' with { edit: false } %}',
      { edit: true }
    );

    assert(!html.includes('data-apos-wysiwyg-field-newly-editable'));
  });

  it('should not output the editor markup for a document the page is not about', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const req = apos.task.getReq({ query: { aposEdit: '1' } });
    const page = await apos.page.find(req, { slug: '/fields' }).toObject();
    const other = await apos.page.find(req, { slug: '/' }).toObject();
    // The document the admin bar takes as the context of the page, and the
    // only one edited here
    req.data.page = page;

    const render = (template, data) =>
      apos.modules['field-page'].renderString(req, template, data);

    // The page itself is edited in place as usual
    const own = await render('{% field data.page, \'subtitle\' %}', { page });
    assert(own.includes('data-apos-wysiwyg-field-newly-editable'));

    // The home page appears here to be read, and is edited on its own page.
    // Sending an editor that would never be mounted, and a second copy of the
    // value for it to start from, costs bytes on every page and buys nothing
    assert(other._edit, 'the other page is one this user may edit elsewhere');
    const foreign = await render('{% field data.other, \'title\' %}', { other });
    assert(!foreign.includes('data-apos-wysiwyg-field-newly-editable'));
    assert(!foreign.includes('data-value'));
    // The value is still displayed, in the tag and with the classes the field
    // type asked for
    assert.equal(
      foreign,
      '<span class="apos-wysiwyg-field apos-wysiwyg-field--string ' +
        `apos-wysiwyg-field--input">${other.title}</span>`
    );
  });

  it('should rule out no document when the request is not about one', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const req = apos.task.getReq({ query: { aposEdit: '1' } });
    const page = await apos.page.find(req, { slug: '/fields' }).toObject();

    // The area editor asks the render-widget route for fresh markup for one
    // widget, and that request is about no page at all. The only document in
    // play is the one being edited, so a missing context rules out nothing:
    // tighten this and editing a field in place stops working the moment its
    // widget is re-rendered, moved or previewed
    assert.deepEqual(req.data, {});
    const html = await apos.modules['field-page'].renderString(
      req,
      '{% field data.page, \'subtitle\' %}',
      { page }
    );
    assert(html.includes('data-apos-wysiwyg-field-newly-editable'));
  });

  it('should address a field of a widget with an @id patch key', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const req = apos.task.getReq({ query: { aposEdit: '1' } });
    const page = await apos.page.find(req, { slug: '/fields' }).toObject();

    // As it arrives in a widget template: loaded from a doc, so `_edit` and
    // `_docId` have been propagated to it
    const widget = {
      _id: 'widget1',
      metaType: 'widget',
      type: 'test',
      heading: 'In a widget',
      _edit: true,
      _docId: page._docId || page._id
    };

    const html = await apos.modules['field-page'].renderString(
      req,
      '{% field data.widget, \'heading\' %}',
      { widget }
    );

    assert(html.includes('data-patch-key="@widget1.heading"'));
    assert(html.includes(`data-doc-id="${widget._docId}"`));
    assert(html.includes('In a widget'));
  });

  it('should throw for a field that is not in the schema', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    await assert.rejects(
      render('{% field data.page, \'nonesuch\' %}'),
      (e) => {
        assert(e.message.includes('nonesuch'));
        return true;
      }
    );
  });

  it('should throw for a field type with no on page editor', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    await assert.rejects(
      render('{% field data.page, \'wordCount\' %}'),
      (e) => {
        assert(e.message.includes('integer'));
        assert(e.message.includes('wordCount'));
        return true;
      }
    );
  });

  it('should throw when the first argument is not an object', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    await assert.rejects(
      render('{% field \'nope\', \'subtitle\' %}'),
      (e) => {
        assert(e.message.includes('doc or widget'));
        return true;
      }
    );
  });

  it('should render a textarea field with its own modifier class', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const req = apos.task.getReq();
    const page = await apos.page.find(req, { slug: '/fields' }).toObject();

    page.summary = 'Line one\nLine two';
    await apos.page.update(req, page);

    const { html } = await render('{% field data.page, \'summary\' %}', { edit: true });

    assert(html.includes('apos-wysiwyg-field--textarea'));
    // Line breaks are honored for a textarea string, so that what is
    // displayed matches what was typed
    assert(html.includes('Line one<br />Line two'));
    assert(html.includes('data-component="AposWysiwygInputString"'));
    // The editor still gets the value as it is stored
    assert(html.includes('data-value=\'"Line one\\nLine two"\''));
  });

  // Save a page with two array items and load it back the way a page
  // template gets it, so that `_edit` and `_docId` have been propagated to
  // each array item exactly as they are in real life
  async function pageWithSections() {
    const req = apos.task.getReq();
    const page = await apos.page.find(req, { slug: '/fields' }).toObject();

    page.sections = [
      {
        metaType: 'arrayItem',
        scopedArrayName: 'doc-type.field-page.sections',
        _id: 'section1',
        caption: 'The first caption',
        detail: '<p>The first detail</p>'
      },
      {
        metaType: 'arrayItem',
        scopedArrayName: 'doc-type.field-page.sections',
        _id: 'section2',
        caption: 'The second caption',
        detail: '<p>The second detail</p>'
      }
    ];
    await apos.page.update(req, page);

    const editReq = apos.task.getReq({ query: { aposEdit: '1' } });
    return {
      req: editReq,
      page: await apos.page.find(editReq, { slug: '/fields' }).toObject()
    };
  }

  // As a template would iterate over the array
  const sectionTemplate = (field) =>
    `{% for section in data.page.sections %}{% field section, '${field}' %}{% endfor %}`;

  it('should address a string field of an array item with an @id patch key', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const { req, page } = await pageWithSections();
    const html = await apos.modules['field-page']
      .renderString(req, sectionTemplate('caption'), { page });

    assert(html.includes('data-patch-key="@section1.caption"'));
    assert(html.includes('data-patch-key="@section2.caption"'));
    // Both items are editable, and both know which document they belong to
    assert.equal(html.match(/data-apos-wysiwyg-field-newly-editable/g).length, 2);
    assert.equal(
      html.match(new RegExp(`data-doc-id="${page._id}"`, 'g')).length,
      2
    );
    assert(html.includes('data-component="AposWysiwygInputString"'));
    assert(html.includes('The first caption'));
    assert(html.includes('The second caption'));
  });

  it('should address a rich text field of an array item', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const { req, page } = await pageWithSections();
    const html = await apos.modules['field-page']
      .renderString(req, sectionTemplate('detail'), { page });

    assert(html.includes('data-patch-key="@section1.detail"'));
    assert(html.includes('data-component="AposWysiwygInputRichText"'));
    assert(html.includes('apos-wysiwyg-field--richText'));
    // Rich text is rendered as markup, not escaped
    assert(html.includes('<p>The first detail</p>'));
    assert(html.includes('<p>The second detail</p>'));
  });

  it('should render a field of an array item as plain markup when not editing', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    await pageWithSections();

    const req = apos.task.getReq();
    const page = await apos.page.find(req, { slug: '/fields' }).toObject();
    const html = await apos.modules['field-page']
      .renderString(req, sectionTemplate('caption'), { page });

    assert(html.includes('The first caption'));
    assert(!html.includes('data-apos-wysiwyg-field-newly-editable'));
    assert(!html.includes('data-patch-key'));
  });

  it('should delegate an area in an array item to the area tag', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    const { req, page } = await pageWithSections();

    const viaField = await apos.modules['field-page']
      .renderString(req, sectionTemplate('blocks'), { page });
    const viaArea = await apos.modules['field-page'].renderString(
      req,
      '{% for section in data.page.sections %}{% area section, \'blocks\' %}{% endfor %}',
      { page }
    );

    assert.equal(viaField, viaArea);
    assert(viaField.includes('data-apos-area-newly-editable'));
  });

  it('should patch a field of an array item by its @id key', async function () {
    apos = await t.create({
      root: module,
      modules: modules()
    });

    await pageWithSections();
    const req = apos.task.getReq();
    // applyPatch needs the ancestors, to work out what the schema allows here
    const page = await apos.page.find(req, { slug: '/fields' })
      .ancestors(true)
      .toObject();

    await apos.page.applyPatch(req, page, {
      '@section2.caption': 'A caption typed on the page'
    });

    assert.equal(page.sections[1].caption, 'A caption typed on the page');
    // Only that one field of that one item is touched
    assert.equal(page.sections[1].detail, '<p>The second detail</p>');
    assert.equal(page.sections[0].caption, 'The first caption');
  });
});
