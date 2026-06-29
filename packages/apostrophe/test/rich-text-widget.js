const assert = require('assert/strict');
const t = require('../test-lib/test.js');

describe('Rich Text Widget', function () {
  let apos;
  this.timeout(t.timeout);

  afterEach(function() {
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

  it('should add images for testing', async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/page': {
          options: {
            park: [
              {
                title: 'Test Page',
                type: 'rich-text-image-page',
                slug: '/rich-text-image-page',
                parkedId: 'rich-text-image-page'
              }
            ],
            types: [
              {
                name: 'rich-text-image-page',
                label: 'Rich Text Image Page'
              }
            ]
          }
        },
        'rich-text-image-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              main: {
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
    });

    const req = apos.task.getReq();
    const base = apos.http.getBase();

    // add images with and without alt attributes:
    const image1 = await apos.image.insert(req, {
      _id: 'image-1:en:published',
      type: '@apostrophecms/image',
      slug: 'image-1',
      visibility: 'public',
      attachment: {
        _id: 'attachment-1',
        crop: null,
        group: 'images',
        name: 'attachment-1',
        title: 'Attachment 1',
        extension: 'jpg',
        type: 'attachment',
        archivedDocIds: [],
        length: 184317,
        md5: '816e2fe1190b7aa81ed26d8479e26181',
        width: 500,
        height: 400,
        landscape: true,
        used: true,
        utilized: true,
        archived: false
      },
      alt: 'Test Image 1'
    });
    const image2 = await apos.image.insert(req, {
      _id: 'image-2:en:published',
      type: '@apostrophecms/image',
      slug: 'image-2',
      visibility: 'public',
      attachment: {
        _id: 'attachment-2',
        crop: null,
        group: 'images',
        name: 'attachment-2',
        title: 'Attachment 2',
        extension: 'jpg',
        type: 'attachment',
        archivedDocIds: [],
        length: 184317,
        md5: '816e2fe1190b7aa81ed26d8479e26182',
        width: 500,
        height: 400,
        landscape: true,
        used: true,
        utilized: true,
        archived: false
      }
    });

    // update page with rich text widget containing images:
    const page = await apos.page.find(req, { slug: '/rich-text-image-page' }).toObject();
    page.main = {
      _id: 'area',
      metaType: 'area',
      items: [
        {
          _id: 'widget',
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<figure class="image-float-left"><img src="/api/v1/@apostrophecms/image/image-1/src" alt="Test Image 1"><figcaption></figcaption></figure><figure class="image-float-left"><img src="/api/v1/@apostrophecms/image/image-2/src" alt=""><figcaption></figcaption></figure>',
          imageIds: [ image1.aposDocId, image2.aposDocId ]
        }
      ]
    };
    await apos.page.update(req, page);

    // assert that alt attributes are present in the rendered HTML:
    const response1 = await fetch(`${base}/rich-text-image-page`, {
      method: 'GET'
    });
    const text1 = await response1.text();
    assert(text1.includes('src="/uploads/attachments/attachment-1-attachment-1.max.jpg" alt="Test Image 1"'));
    assert(text1.includes('src="/uploads/attachments/attachment-2-attachment-2.max.jpg" alt=""'));

    // update alt attributes:
    image1.alt = 'Updated Test Image 1';
    image2.alt = 'Updated Test Image 2';
    await apos.image.update(req, image1);
    await apos.image.update(req, image2);

    // re-fetch the page to check if the updated alt attributes are present:
    const response2 = await fetch(`${base}/rich-text-image-page`, {
      method: 'GET'
    });
    const text2 = await response2.text();
    assert(text2.includes('src="/uploads/attachments/attachment-1-attachment-1.max.jpg" alt="Updated Test Image 1"'));
    assert(text2.includes('src="/uploads/attachments/attachment-2-attachment-2.max.jpg" alt="Updated Test Image 2"'));
  });

  describe('image import allowlist (SSRF mitigation)', function () {
    let originalConsoleError;

    before(function () {
      // The sanitize method intentionally console.errors thrown errors to
      // surface stack traces during development; silence that noise during
      // these negative tests.
      // eslint-disable-next-line no-console
      originalConsoleError = console.error;
      // eslint-disable-next-line no-console
      console.error = () => {};
    });

    after(function () {
      // eslint-disable-next-line no-console
      console.error = originalConsoleError;
    });

    it('allows rich text HTML import without `<img>` tags even with no allowlist configured', async function () {
      apos = await t.create({
        root: module,
        modules: {}
      });

      const manager = apos.modules['@apostrophecms/rich-text-widget'];
      const req = apos.task.getReq();

      const output = await manager.sanitize(req, {
        type: '@apostrophecms/rich-text',
        content: '<p>seed</p>',
        import: {
          html: '<p>Hello <strong>world</strong></p>'
        }
      }, {});

      assert.match(output.content, /Hello/);
    });

    it('rejects an image fetch for a hostname not in the allowlist and never calls fetch', async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/rich-text-widget': {
            options: {
              imageImportAllowedHostnames: [ 'images.example.com' ]
            }
          }
        }
      });

      const manager = apos.modules['@apostrophecms/rich-text-widget'];
      const req = apos.task.getReq();

      const originalFetch = global.fetch;
      let fetchCalled = false;
      global.fetch = async () => {
        fetchCalled = true;
        throw new Error('fetch should not be called');
      };

      try {
        await assert.rejects(
          () => manager.sanitize(req, {
            type: '@apostrophecms/rich-text',
            content: '<p>seed</p>',
            import: {
              html: '<img src="http://127.0.0.1:7777/secret.png">',
              baseUrl: 'http://127.0.0.1:7777'
            }
          }, {}),
          (err) => {
            assert.equal(err.name, 'forbidden');
            assert.match(err.message, /127\.0\.0\.1/);
            assert.match(err.message, /imageImportAllowedHostnames/);
            return true;
          }
        );
      } finally {
        global.fetch = originalFetch;
      }

      assert.equal(fetchCalled, false);
    });

    it('rejects rich text HTML import for non-http(s) protocols even if hostname matches', async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/rich-text-widget': {
            options: {
              imageImportAllowedHostnames: [ 'localhost' ]
            }
          }
        }
      });

      const manager = apos.modules['@apostrophecms/rich-text-widget'];
      const req = apos.task.getReq();

      await assert.rejects(
        () => manager.sanitize(req, {
          type: '@apostrophecms/rich-text',
          content: '<p>seed</p>',
          import: {
            html: '<img src="file:///etc/passwd">',
            baseUrl: 'file://localhost'
          }
        }, {}),
        (err) => {
          assert.equal(err.name, 'forbidden');
          return true;
        }
      );
    });

    it('proceeds to fetch when import URL hostname is on the allowlist', async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/rich-text-widget': {
            options: {
              imageImportAllowedHostnames: [ 'images.example.com' ]
            }
          }
        }
      });

      const manager = apos.modules['@apostrophecms/rich-text-widget'];
      const req = apos.task.getReq();

      const originalFetch = global.fetch;
      const fetchedUrls = [];
      // Throw a unique marker error from inside fetch. If the allowlist
      // passes, the marker error propagates; if the allowlist rejects, we
      // would see a `forbidden` error instead.
      const marker = new Error('FETCH_REACHED');
      marker.name = 'FetchReached';
      global.fetch = async (url) => {
        fetchedUrls.push(url.toString());
        throw marker;
      };

      try {
        await assert.rejects(
          () => manager.sanitize(req, {
            type: '@apostrophecms/rich-text',
            content: '<p>seed</p>',
            import: {
              html: '<img src="https://images.example.com/foo.png">',
              baseUrl: 'https://images.example.com'
            }
          }, {}),
          (err) => err.name === 'FetchReached'
        );
      } finally {
        global.fetch = originalFetch;
      }

      assert.deepEqual(fetchedUrls, [ 'https://images.example.com/foo.png' ]);
    });

    it('helper methods reflect option configuration', async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/rich-text-widget': {
            options: {
              imageImportAllowedHostnames: [ 'Images.Example.com', '', null, 'cdn.example.com' ]
            }
          }
        }
      });

      const manager = apos.modules['@apostrophecms/rich-text-widget'];

      assert.deepEqual(
        manager.getImageImportAllowedHostnames(),
        [ 'images.example.com', 'cdn.example.com' ]
      );

      const allowed = manager.getImageImportAllowedHostnames();
      assert.equal(
        manager.isImageImportHostnameAllowed(new URL('https://images.example.com/foo.png'), allowed),
        true
      );
      assert.equal(
        manager.isImageImportHostnameAllowed(new URL('https://IMAGES.example.com/foo.png'), allowed),
        true
      );
      assert.equal(
        manager.isImageImportHostnameAllowed(new URL('https://attacker.example.com/foo.png'), allowed),
        false
      );
      assert.equal(
        manager.isImageImportHostnameAllowed(new URL('file:///etc/passwd'), allowed),
        false
      );
    });
  });
});
