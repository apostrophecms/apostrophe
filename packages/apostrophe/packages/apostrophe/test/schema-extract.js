const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('Schema extraction policy', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        // Field types exercising every extractable form
        'extract-test-types': {
          init(self) {
            self.apos.schema.addFieldType({
              name: 'plainText',
              extractable: [ 'text' ],
              extract() {
                return [];
              },
              def: ''
            });
            self.apos.schema.addFieldType({
              name: 'untaggedText',
              extract() {
                return [];
              },
              def: ''
            });
            self.apos.schema.addFieldType({
              name: 'testImage',
              extractable: [ 'image' ],
              extract(req, field, value) {
                return value ? [ { image: { url: value } } ] : [];
              }
            });
            self.apos.schema.addFieldType({
              name: 'noExtract',
              def: false
            });
            self.apos.schema.addFieldType({
              name: 'apiSecret',
              extend: 'plainText',
              extractable: false
            });
            self.apos.schema.addFieldType({
              name: 'taggedChild',
              extend: 'plainText',
              extractable: [ 'seo' ]
            });
          }
        },
        'policy-piece': {
          extend: '@apostrophecms/piece-type',
          options: {
            label: 'Policy Piece'
          },
          fields: {
            add: {
              plain: { type: 'plainText' },
              explicitTrue: {
                type: 'plainText',
                extractable: true
              },
              optOut: {
                type: 'plainText',
                extractable: false
              },
              keywords: {
                type: 'plainText',
                extractable: [ 'seoContext' ]
              },
              productCode: {
                type: 'plainText',
                extractable: [ 'notranslate' ]
              },
              bare: { type: 'untaggedText' },
              hero: { type: 'testImage' },
              featured: { type: 'noExtract' },
              featuredForced: {
                type: 'noExtract',
                extractable: true
              },
              token: { type: 'apiSecret' },
              tokenForced: {
                type: 'apiSecret',
                extractable: [ 'text' ]
              },
              child: { type: 'taggedChild' },
              childPlus: {
                type: 'taggedChild',
                extractable: [ 'extra' ]
              },
              secret: { type: 'password' },
              rows: {
                type: 'array',
                fields: {
                  add: {
                    cell: { type: 'plainText' },
                    cellOff: {
                      type: 'plainText',
                      extractable: false
                    }
                  }
                }
              },
              meta: {
                type: 'object',
                fields: {
                  add: {
                    inner: {
                      type: 'plainText',
                      extractable: [ 'deep' ]
                    }
                  }
                }
              }
            }
          }
        },
        'walk-piece': {
          extend: '@apostrophecms/piece-type',
          options: {
            label: 'Walk Piece'
          },
          fields: {
            add: {
              headline: { type: 'string' },
              body: {
                type: 'string',
                textarea: true
              },
              nickname: { type: 'slug' },
              productCode: {
                type: 'string',
                extractable: [ 'notranslate' ]
              },
              internalNote: {
                type: 'string',
                extractable: false
              },
              count: { type: 'integer' },
              rows: {
                type: 'array',
                fields: {
                  add: {
                    cell: { type: 'string' },
                    deep: {
                      type: 'object',
                      fields: {
                        add: {
                          inner: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              },
              markedRows: {
                type: 'array',
                extractable: [ 'notranslate' ],
                fields: {
                  add: {
                    cell: { type: 'string' }
                  }
                }
              },
              meta: {
                type: 'object',
                fields: {
                  add: {
                    inner: { type: 'string' }
                  }
                }
              },
              hero: { type: 'testImage' }
            }
          }
        },
        'fancy-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            label: 'Fancy'
          },
          fields: {
            add: {
              heading: { type: 'string' },
              nested: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {}
                  }
                }
              }
            }
          },
          methods(self) {
            return {
              extract(req, widget, options) {
                return [
                  {
                    text: widget.special,
                    tags: [ 'special' ]
                  },
                  ...self.apos.schema.extract(req, self.schema, widget, options)
                ];
              }
            };
          }
        },
        'muted-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            label: 'Muted',
            extractable: false
          },
          fields: {
            add: {
              note: { type: 'string' }
            }
          }
        },
        'tagged-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            label: 'Tagged',
            extractable: [ 'promo' ]
          },
          fields: {
            add: {
              blurb: { type: 'string' }
            }
          }
        },
        'area-piece': {
          extend: '@apostrophecms/piece-type',
          options: {
            label: 'Area Piece'
          },
          fields: {
            add: {
              body: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {},
                    '@apostrophecms/image': {},
                    fancy: {},
                    muted: {},
                    tagged: {
                      extractable: [ 'areaTag' ]
                    }
                  }
                }
              },
              mutedByConfig: {
                type: 'area',
                options: {
                  widgets: {
                    tagged: {
                      extractable: false
                    }
                  }
                }
              },
              markedArea: {
                type: 'area',
                extractable: [ 'notranslate' ],
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
  });

  after(async function() {
    return t.destroy(apos);
  });

  function field(name) {
    return apos.modules['policy-piece'].schema.find(f => f.name === name);
  }

  describe('field type definitions', function() {
    it('unions a subtype\'s extractable tags with its parent\'s on extend', function() {
      assert.deepEqual(
        apos.schema.getFieldType('taggedChild').extractable,
        [ 'text', 'seo' ]
      );
    });

    it('keeps extractable: false on a subtype as a hard opt-out', function() {
      const apiSecret = apos.schema.getFieldType('apiSecret');
      assert.equal(apiSecret.extractable, false);
      // The extractor itself is still inherited; only the policy blocks it
      assert.equal(typeof apiSecret.extract, 'function');
    });

    it('leaves an absent type-level extractable absent', function() {
      assert.equal(apos.schema.getFieldType('untaggedText').extractable, undefined);
      assert.deepEqual(
        apos.schema.getFieldType('plainText').extractable,
        [ 'text' ]
      );
    });
  });

  describe('field instance resolution', function() {
    it('resolves the policy per field instance', function() {
      const expected = {
        plain: [ 'text' ],
        explicitTrue: [ 'text' ],
        optOut: false,
        keywords: [ 'text', 'seoContext' ],
        productCode: [ 'text', 'notranslate' ],
        bare: [],
        hero: [ 'image' ],
        featured: false,
        featuredForced: false,
        token: false,
        tokenForced: false,
        child: [ 'text', 'seo' ],
        childPlus: [ 'text', 'seo', 'extra' ],
        secret: false
      };
      for (const [ name, value ] of Object.entries(expected)) {
        assert.deepEqual(field(name)._extractable, value, name);
      }
    });

    it('resolves fields of nested array and object schemas', function() {
      const rows = field('rows');
      assert.deepEqual(
        rows.schema.find(f => f.name === 'cell')._extractable,
        [ 'text' ]
      );
      assert.equal(
        rows.schema.find(f => f.name === 'cellOff')._extractable,
        false
      );
      const meta = field('meta');
      assert.deepEqual(
        meta.schema.find(f => f.name === 'inner')._extractable,
        [ 'text', 'deep' ]
      );
    });
  });

  describe('validation failures', function() {
    // Schema validation throws after every init has run, so the partially
    // booted instance can be captured and destroyed
    const failsToBoot = async (typeDef, fieldDef, pattern) => {
      let captured;
      try {
        await assert.rejects(t.create({
          root: module,
          exit: 'throw',
          modules: {
            'bad-types': {
              init(self) {
                captured = self.apos;
                if (typeDef) {
                  self.apos.schema.addFieldType(typeDef);
                }
              }
            },
            'bad-piece': {
              extend: '@apostrophecms/piece-type',
              options: {
                label: 'Bad Piece'
              },
              fields: {
                add: {
                  bad: fieldDef
                }
              }
            }
          }
        }), pattern);
      } finally {
        await t.destroy(captured);
      }
    };

    it('rejects extractable tags on a type with no extract method', async function() {
      await failsToBoot(
        {
          name: 'noWay',
          extractable: [ 'text' ]
        },
        { type: 'noWay' },
        /declares "extractable" but has no extract method/
      );
    });

    it('rejects extractable: true on a type with no extract method', async function() {
      await failsToBoot(
        {
          name: 'noWay',
          extractable: true
        },
        { type: 'noWay' },
        /declares "extractable" but has no extract method/
      );
    });

    it('rejects a malformed type-level extractable', async function() {
      await failsToBoot(
        {
          name: 'badTags',
          extractable: 'text',
          extract() {
            return [];
          }
        },
        { type: 'badTags' },
        /field type's "extractable" property must be true, false or an array of tag strings/
      );
    });

    it('rejects a malformed field-level extractable', async function() {
      await failsToBoot(
        null,
        {
          type: 'string',
          extractable: 'yes'
        },
        /The "extractable" property must be true, false or an array of tag strings/
      );
      await failsToBoot(
        null,
        {
          type: 'string',
          extractable: [ 'ok', 3 ]
        },
        /The "extractable" property must be true, false or an array of tag strings/
      );
    });
  });

  describe('the extract walk', function() {
    let req;
    let schema;

    const doc = () => ({
      headline: 'Big News',
      body: 'A long story',
      nickname: 'big-news',
      productCode: 'X-100',
      internalNote: 'do not leak',
      count: 5,
      rows: [
        {
          _id: 'r1',
          cell: 'One',
          deep: { inner: 'Deep one' }
        },
        {
          _id: 'r2',
          cell: 'Two'
        }
      ],
      markedRows: [
        {
          _id: 'm1',
          cell: 'Marked'
        }
      ],
      meta: { inner: 'About' },
      hero: '/uploads/hero.png'
    });

    before(function() {
      req = apos.task.getReq();
      schema = apos.modules['walk-piece'].schema;
    });

    function byPath(items, path) {
      return items.find(item => item.path === path);
    }

    it('walks a document into tagged content items', function() {
      const items = apos.schema.extract(req, schema, doc());
      assert.deepEqual(byPath(items, 'headline'), {
        path: 'headline',
        schemaPath: 'headline',
        type: 'string',
        label: 'Headline',
        tags: [ 'text' ],
        text: 'Big News'
      });
      assert.equal(byPath(items, 'body').text, 'A long story');
      // Slug inherits the string extractor untransformed
      assert.deepEqual(byPath(items, 'nickname').tags, [ 'text' ]);
      assert.equal(byPath(items, 'nickname').text, 'big-news');
      assert.equal(byPath(items, 'nickname').type, 'slug');
      assert.deepEqual(byPath(items, 'productCode').tags, [ 'text', 'notranslate' ]);
      assert.deepEqual(byPath(items, 'hero'), {
        path: 'hero',
        schemaPath: 'hero',
        type: 'testImage',
        label: 'Hero',
        tags: [ 'image' ],
        image: { url: '/uploads/hero.png' }
      });
      // Opted out and non-extractable fields never appear
      assert.equal(byPath(items, 'internalNote'), undefined);
      assert.equal(byPath(items, 'count'), undefined);
    });

    it('threads paths through arrays and objects', function() {
      const items = apos.schema.extract(req, schema, doc());
      assert.deepEqual(byPath(items, '@r1.cell'), {
        path: '@r1.cell',
        schemaPath: 'rows.cell',
        type: 'string',
        label: 'Cell',
        tags: [ 'text' ],
        text: 'One'
      });
      assert.deepEqual(byPath(items, '@r1.deep.inner'), {
        path: '@r1.deep.inner',
        schemaPath: 'rows.deep.inner',
        type: 'string',
        label: 'Inner',
        tags: [ 'text' ],
        text: 'Deep one'
      });
      assert.equal(byPath(items, '@r2.cell').text, 'Two');
      assert.equal(byPath(items, 'meta.inner').text, 'About');
      assert.equal(byPath(items, 'meta.inner').schemaPath, 'meta.inner');
      // The emitted paths resolve back to the content
      for (const item of items.filter(i => !i.metaOnly && i.text)) {
        assert.equal(apos.util.get(doc(), item.path), item.text);
      }
    });

    it('emits a metaOnly container marker for non-empty arrays only', function() {
      const items = apos.schema.extract(req, schema, doc());
      assert.deepEqual(byPath(items, 'rows'), {
        path: 'rows',
        schemaPath: 'rows',
        type: 'array',
        label: 'Rows',
        tags: [],
        metaOnly: true
      });
      const empty = apos.schema.extract(req, schema, {
        headline: 'Just this'
      });
      assert.equal(byPath(empty, 'rows'), undefined);
      assert.equal(byPath(empty, 'meta'), undefined);
    });

    it('unions a container\'s tags into its subtree', function() {
      const items = apos.schema.extract(req, schema, doc());
      assert.deepEqual(byPath(items, '@m1.cell').tags, [ 'notranslate', 'text' ]);
      assert.deepEqual(byPath(items, 'markedRows').tags, [ 'notranslate' ]);
    });

    it('include keeps any-of, plus metaOnly markers', function() {
      const items = apos.schema.extract(req, schema, doc(), {
        include: [ 'text' ]
      });
      assert.deepEqual(items.map(item => item.path), [
        'headline',
        'body',
        'nickname',
        'productCode',
        '@r1.cell',
        '@r1.deep.inner',
        '@r2.cell',
        'rows',
        '@m1.cell',
        'markedRows',
        'meta.inner'
      ]);
      const images = apos.schema.extract(req, schema, doc(), {
        include: [ 'image' ]
      });
      assert.deepEqual(
        images.filter(item => !item.metaOnly).map(item => item.path),
        [ 'hero' ]
      );
    });

    it('exclude wins over include, markers included', function() {
      const items = apos.schema.extract(req, schema, doc(), {
        include: [ 'text' ],
        exclude: [ 'notranslate' ]
      });
      assert.deepEqual(items.map(item => item.path), [
        'headline',
        'body',
        'nickname',
        '@r1.cell',
        '@r1.deep.inner',
        '@r2.cell',
        'rows',
        'meta.inner'
      ]);
    });

    it('keeps a marker-tagged field visible to every other query', function() {
      const items = apos.schema.extract(req, schema, doc(), {
        include: [ 'text' ]
      });
      assert.deepEqual(byPath(items, 'productCode').tags, [ 'text', 'notranslate' ]);
    });

    it('extend transforms matching items with the original in hand', function() {
      const items = apos.schema.extract(req, schema, doc(), {
        include: [ 'text' ],
        extend: {
          slug: (item) => ({
            ...item,
            text: item.text.replace(/-/g, ' '),
            original: item.text
          })
        }
      });
      const nickname = byPath(items, 'nickname');
      assert.equal(nickname.text, 'big news');
      assert.equal(nickname.original, 'big-news');
      // Other types are untouched
      assert.equal(byPath(items, 'headline').text, 'Big News');
      // The transform is strictly per call
      const plain = apos.schema.extract(req, schema, doc(), {
        include: [ 'text' ]
      });
      assert.equal(byPath(plain, 'nickname').text, 'big-news');
    });

    it('maxLength keeps items in walk order until the budget is hit', function() {
      const items = apos.schema.extract(req, schema, doc(), {
        include: [ 'text' ],
        maxLength: 25
      });
      // 'Big News' (8) + 'A long story' (12) fit; 'big-news' would overflow
      assert.deepEqual(items.map(item => item.path), [ 'headline', 'body' ]);
    });

    it('returns nothing for an unvalidated schema', function() {
      const items = apos.schema.extract(req, [
        {
          name: 'headline',
          type: 'string',
          label: 'Headline'
        }
      ], { headline: 'Hi' });
      assert.deepEqual(items, []);
    });

    it('rejects malformed options', function() {
      const invalid = (options, pattern) => {
        assert.throws(() => apos.schema.extract(req, schema, doc(), options), (e) => {
          assert.equal(e.name, 'invalid');
          assert.match(e.message, pattern);
          return true;
        });
      };
      invalid({ include: 'text' }, /"include" must be an array of tag strings/);
      invalid({ exclude: [ 3 ] }, /"exclude" must be an array of tag strings/);
      invalid({ tags: 'notranslate' }, /"tags" must be an array of tag strings/);
      invalid({ extend: { slug: true } }, /"extend" must be an object mapping field types to functions/);
      invalid({ extend: [ () => {} ] }, /"extend" must be an object mapping field types to functions/);
      invalid({ maxLength: 0 }, /"maxLength" must be a positive integer/);
      invalid({ maxLength: 'big' }, /"maxLength" must be a positive integer/);
    });
  });

  describe('widget extraction', function() {
    let req;
    let schema;

    const areaDoc = () => ({
      body: {
        metaType: 'area',
        items: [
          {
            _id: 'w1',
            type: '@apostrophecms/rich-text',
            content: '<p>Rich text</p>'
          },
          {
            _id: 'w2',
            type: 'fancy',
            special: 'Own data',
            heading: 'Head',
            nested: {
              metaType: 'area',
              items: [
                {
                  _id: 'w3',
                  type: '@apostrophecms/rich-text',
                  content: '<p>Deep</p>'
                }
              ]
            }
          },
          {
            _id: 'w4',
            type: 'muted',
            note: 'Never seen'
          },
          {
            _id: 'w5',
            type: 'tagged',
            blurb: 'Promo text'
          },
          {
            _id: 'w6',
            type: '@apostrophecms/image',
            caption: 'A caption',
            _image: [
              {
                attachment: {
                  _id: 'a1',
                  name: 'photo',
                  extension: 'jpg',
                  group: 'images',
                  width: 800,
                  height: 600
                }
              }
            ]
          }
        ]
      },
      mutedByConfig: {
        metaType: 'area',
        items: [
          {
            _id: 'w7',
            type: 'tagged',
            blurb: 'Hidden'
          }
        ]
      },
      markedArea: {
        metaType: 'area',
        items: [
          {
            _id: 'w8',
            type: '@apostrophecms/rich-text',
            content: '<p>Brand</p>'
          }
        ]
      }
    });

    before(function() {
      req = apos.task.getReq();
      schema = apos.modules['area-piece'].schema;
    });

    function byPath(items, path) {
      return items.find(item => item.path === path);
    }

    it('resolves widget policies once at schema validation', function() {
      const body = schema.find(f => f.name === 'body');
      assert.deepEqual(body._extractableWidgets, {
        '@apostrophecms/rich-text': [],
        '@apostrophecms/image': [],
        fancy: [],
        muted: false,
        tagged: [ 'promo', 'areaTag' ]
      });
    });

    it('dispatches area content through widget managers', function() {
      const items = apos.schema.extract(req, schema, areaDoc());
      assert.deepEqual(byPath(items, '@w1.content'), {
        path: '@w1.content',
        schemaPath: 'body.@apostrophecms/rich-text',
        type: 'widget:@apostrophecms/rich-text',
        label: apos.modules['@apostrophecms/rich-text-widget'].label,
        tags: [ 'text' ],
        text: '<p>Rich text</p>'
      });
      assert.deepEqual(byPath(items, 'body'), {
        path: 'body',
        schemaPath: 'body',
        type: 'area',
        label: 'Body',
        tags: [],
        metaOnly: true
      });
    });

    it('a custom widget contributes its own items ahead of its sub-schema', function() {
      const items = apos.schema.extract(req, schema, areaDoc());
      assert.deepEqual(byPath(items, '@w2'), {
        path: '@w2',
        schemaPath: 'body.fancy',
        type: 'widget:fancy',
        label: 'Fancy',
        tags: [ 'special' ],
        text: 'Own data'
      });
      assert.deepEqual(byPath(items, '@w2.heading'), {
        path: '@w2.heading',
        schemaPath: 'body.fancy.heading',
        type: 'string',
        label: 'Heading',
        tags: [ 'text' ],
        text: 'Head'
      });
    });

    it('nests widget, area and widget again with correct paths', function() {
      const items = apos.schema.extract(req, schema, areaDoc());
      assert.deepEqual(byPath(items, '@w3.content'), {
        path: '@w3.content',
        schemaPath: 'body.fancy.nested.@apostrophecms/rich-text',
        type: 'widget:@apostrophecms/rich-text',
        label: apos.modules['@apostrophecms/rich-text-widget'].label,
        tags: [ 'text' ],
        text: '<p>Deep</p>'
      });
      // The nested area emits its own container marker
      assert.deepEqual(byPath(items, '@w2.nested'), {
        path: '@w2.nested',
        schemaPath: 'body.fancy.nested',
        type: 'area',
        label: 'Nested',
        tags: [],
        metaOnly: true
      });
    });

    it('skips a widget opted out at the module level', function() {
      const items = apos.schema.extract(req, schema, areaDoc());
      assert.equal(byPath(items, '@w4'), undefined);
      assert.equal(byPath(items, '@w4.note'), undefined);
    });

    it('skips a widget opted out in the area configuration', function() {
      const items = apos.schema.extract(req, schema, areaDoc());
      assert.equal(byPath(items, '@w7.blurb'), undefined);
      // Nothing survived, so the area emits no marker either
      assert.equal(byPath(items, 'mutedByConfig'), undefined);
    });

    it('unions module and area configuration tags into widget items', function() {
      const items = apos.schema.extract(req, schema, areaDoc());
      assert.deepEqual(
        byPath(items, '@w5.blurb').tags,
        [ 'promo', 'areaTag', 'text' ]
      );
    });

    it('extracts the image widget as an image item plus its schema', function() {
      const items = apos.schema.extract(req, schema, areaDoc());
      const image = byPath(items, '@w6');
      assert.deepEqual(image.tags, [ 'image' ]);
      assert.equal(image.type, 'widget:@apostrophecms/image');
      assert.match(image.image.url, /a1-photo/);
      assert.match(image.image.url, /\.jpg$/);
      assert.equal(byPath(items, '@w6.caption').text, 'A caption');
      assert.deepEqual(byPath(items, '@w6.caption').tags, [ 'text' ]);
    });

    it('a marked area opts its whole subtree out of translation queries', function() {
      const all = apos.schema.extract(req, schema, areaDoc());
      assert.deepEqual(
        byPath(all, '@w8.content').tags,
        [ 'notranslate', 'text' ]
      );
      assert.deepEqual(byPath(all, 'markedArea').tags, [ 'notranslate' ]);
      const translation = apos.schema.extract(req, schema, areaDoc(), {
        include: [ 'text' ],
        exclude: [ 'notranslate' ]
      });
      assert.equal(byPath(translation, '@w8.content'), undefined);
      assert.equal(byPath(translation, 'markedArea'), undefined);
      // The unmarked area is unaffected, markers included
      assert(byPath(translation, '@w1.content'));
      assert(byPath(translation, 'body'));
      // The image item is not text, but the caption is
      assert.equal(byPath(translation, '@w6'), undefined);
      assert(byPath(translation, '@w6.caption'));
    });

    it('logs a structured warning when a widget text item stays on the widget anchor', function() {
      const calls = [];
      const original = apos.schema.logWarn;
      apos.schema.logWarn = (...args) => {
        calls.push(args);
      };
      try {
        apos.schema.extract(req, schema, areaDoc());
      } finally {
        apos.schema.logWarn = original;
      }
      // The fancy widget's own item names no path, so it defaulted to the
      // widget anchor and cannot be applied back
      const pathless = calls.filter(
        ([ , type ]) => type === 'widget-extract-pathless-item'
      );
      assert.equal(pathless.length, 1);
      const [ callReq, , message, data ] = pathless[0];
      assert.equal(callReq, req);
      assert.match(message, /"fancy" widget/);
      assert.deepEqual(data, {
        widgetType: 'fancy',
        widgetId: 'w2',
        path: '@w2',
        schemaPath: 'body.fancy'
      });
      // The image widget's anchored item is an image, not text; the other
      // widgets put their text on real property paths — one incident total
    });
  });

  describe('the extract probe', function() {
    let req;
    let walkSchema;
    let areaSchema;
    let policySchema;

    const walkDoc = () => ({
      headline: 'Big News',
      body: 'A long story',
      rows: [
        {
          _id: 'r1',
          cell: 'One',
          deep: { inner: 'Deep one' }
        }
      ],
      meta: { inner: 'About' }
    });

    const areaDoc = () => ({
      body: {
        metaType: 'area',
        items: [
          {
            _id: 'w1',
            type: '@apostrophecms/rich-text',
            content: '<p>Rich text</p>'
          },
          {
            _id: 'w2',
            type: 'fancy',
            special: 'Own data',
            heading: 'Head',
            nested: {
              metaType: 'area',
              items: [
                {
                  _id: 'w3',
                  type: '@apostrophecms/rich-text',
                  content: '<p>Deep</p>'
                }
              ]
            }
          },
          {
            _id: 'w4',
            type: 'muted',
            note: 'Never seen'
          }
        ]
      },
      mutedByConfig: {
        metaType: 'area',
        items: [
          {
            _id: 'w7',
            type: 'tagged',
            blurb: 'Hidden'
          }
        ]
      }
    });

    before(function() {
      req = apos.task.getReq();
      walkSchema = apos.modules['walk-piece'].schema;
      areaSchema = apos.modules['area-piece'].schema;
      policySchema = apos.modules['policy-piece'].schema;
    });

    function byPath(items, path) {
      return items.find(item => item.path === path);
    }

    it('replaces a field dispatch and finalizes with the same defaults', function() {
      const items = apos.schema.extract(req, walkSchema, walkDoc(), {
        probe(context) {
          if (context.kind === 'field' && context.path === 'headline') {
            return [ { text: 'Probed headline' } ];
          }
        }
      });
      assert.deepEqual(byPath(items, 'headline'), {
        path: 'headline',
        schemaPath: 'headline',
        type: 'string',
        label: 'Headline',
        tags: [ 'text' ],
        text: 'Probed headline'
      });
      // Every other dispatch point proceeds normally
      assert.equal(byPath(items, 'body').text, 'A long story');
      assert.equal(byPath(items, '@r1.cell').text, 'One');
    });

    it('declining everywhere leaves the extraction identical', function() {
      const plain = apos.schema.extract(req, walkSchema, walkDoc());
      const probed = apos.schema.extract(req, walkSchema, walkDoc(), {
        probe() {}
      });
      assert.deepEqual(probed, plain);
    });

    it('an empty array suppresses a dispatch point', function() {
      const items = apos.schema.extract(req, walkSchema, walkDoc(), {
        probe(context) {
          if (context.path === 'headline') {
            return [];
          }
        }
      });
      assert.equal(byPath(items, 'headline'), undefined);
      assert.equal(byPath(items, 'body').text, 'A long story');
    });

    it('replaces a widget dispatch, with the manager in hand', function() {
      let manager;
      const items = apos.schema.extract(req, areaSchema, areaDoc(), {
        probe(context) {
          if (context.kind === 'widget' && context.widget._id === 'w1') {
            manager = context.manager;
            return [
              {
                text: 'Probed rich text',
                path: `${context.path}.content`
              }
            ];
          }
        }
      });
      assert.equal(manager, apos.modules['@apostrophecms/rich-text-widget']);
      assert.deepEqual(byPath(items, '@w1.content'), {
        path: '@w1.content',
        schemaPath: 'body.@apostrophecms/rich-text',
        type: 'widget:@apostrophecms/rich-text',
        label: apos.modules['@apostrophecms/rich-text-widget'].label,
        tags: [],
        text: 'Probed rich text'
      });
    });

    it('threads through areas, widget managers, arrays and objects', function() {
      const seen = [];
      apos.schema.extract(req, areaSchema, areaDoc(), {
        probe(context) {
          seen.push(`${context.kind}:${context.schemaPath}`);
        }
      });
      // Fields and widgets at every depth, through the fancy widget's own
      // extract override, which passes the walk context on unchanged
      assert(seen.includes('field:body'));
      assert(seen.includes('widget:body.@apostrophecms/rich-text'));
      assert(seen.includes('widget:body.fancy'));
      assert(seen.includes('field:body.fancy.heading'));
      assert(seen.includes('field:body.fancy.nested'));
      assert(seen.includes('widget:body.fancy.nested.@apostrophecms/rich-text'));
      // Opted-out widgets are skipped without consulting the probe
      assert(!seen.includes('widget:body.muted'));
      assert(!seen.includes('widget:mutedByConfig.tagged'));

      const arraySeen = [];
      apos.schema.extract(req, walkSchema, walkDoc(), {
        probe(context) {
          arraySeen.push(`${context.kind}:${context.path}`);
        }
      });
      assert(arraySeen.includes('field:@r1.cell'));
      assert(arraySeen.includes('field:@r1.deep.inner'));
      assert(arraySeen.includes('field:meta.inner'));
    });

    it('replaces a dispatch point at full depth', function() {
      const items = apos.schema.extract(req, areaSchema, areaDoc(), {
        probe(context) {
          if (context.kind === 'widget' && context.widget._id === 'w3') {
            return [
              {
                text: 'Probed deep',
                path: `${context.path}.content`,
                tags: [ 'deepTag' ]
              }
            ];
          }
        }
      });
      const item = byPath(items, '@w3.content');
      assert.equal(item.text, 'Probed deep');
      assert.equal(item.schemaPath, 'body.fancy.nested.@apostrophecms/rich-text');
      assert.deepEqual(item.tags, [ 'deepTag' ]);
      assert.equal(item.type, 'widget:@apostrophecms/rich-text');
    });

    it('is consulted for fields core cannot extract, which stay silent unclaimed', function() {
      const doc = {
        featured: 'raw value',
        optOut: 'hidden',
        secret: 'hunter2'
      };
      const plain = apos.schema.extract(req, policySchema, doc);
      assert.equal(byPath(plain, 'featured'), undefined);
      assert.equal(byPath(plain, 'optOut'), undefined);

      const seen = [];
      const items = apos.schema.extract(req, policySchema, doc, {
        probe(context) {
          seen.push(context.field.name);
          if (context.field.name === 'featured') {
            return [ {
              text: context.value,
              tags: [ 'claimed' ]
            } ];
          }
        }
      });
      // Types with no extract method and opted-out fields are all seen:
      // `_extractable: false` conflates the two and a probe may own either
      assert(seen.includes('featured'));
      assert(seen.includes('optOut'));
      assert(seen.includes('secret'));
      assert.deepEqual(byPath(items, 'featured'), {
        path: 'featured',
        schemaPath: 'featured',
        type: 'noExtract',
        label: 'Featured',
        tags: [ 'claimed' ],
        text: 'raw value'
      });
      // Unclaimed inactive fields still yield nothing
      assert.equal(byPath(items, 'optOut'), undefined);
      assert.equal(byPath(items, 'secret'), undefined);
    });

    it('never consults the probe for an unvalidated schema', function() {
      let consulted = false;
      const items = apos.schema.extract(
        req,
        [ {
          name: 'free',
          type: 'string'
        } ],
        { free: 'Hi' },
        {
          probe() {
            consulted = true;
          }
        }
      );
      assert.deepEqual(items, []);
      assert.equal(consulted, false);
    });

    it('rejects a probe that is not a function', function() {
      assert.throws(() => {
        apos.schema.extract(req, walkSchema, walkDoc(), { probe: true });
      }, /probe/);
    });

    it('rejects a probe returning something other than an array', function() {
      assert.throws(() => {
        apos.schema.extract(req, walkSchema, walkDoc(), {
          probe() {
            return { text: 'not an array' };
          }
        });
      }, /probe/);
    });
  });

  describe('widget policy validation failures', function() {
    it('rejects a malformed extractable in an area widget configuration', async function() {
      let captured;
      try {
        await assert.rejects(t.create({
          root: module,
          exit: 'throw',
          modules: {
            'a-capture': {
              init(self) {
                captured = self.apos;
              }
            },
            'bad-piece': {
              extend: '@apostrophecms/piece-type',
              options: {
                label: 'Bad Piece'
              },
              fields: {
                add: {
                  bad: {
                    type: 'area',
                    options: {
                      widgets: {
                        '@apostrophecms/rich-text': {
                          extractable: 'nope'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }), /The "@apostrophecms\/rich-text" widget's "extractable" property must be true, false or an array of tag strings/);
      } finally {
        await t.destroy(captured);
      }
    });

    it('rejects a malformed extractable option on a widget module', async function() {
      let captured;
      try {
        await assert.rejects(t.create({
          root: module,
          exit: 'throw',
          modules: {
            'a-capture': {
              init(self) {
                captured = self.apos;
              }
            },
            'bad-widget': {
              extend: '@apostrophecms/widget-type',
              options: {
                label: 'Bad',
                extractable: 'nope'
              }
            }
          }
        }), /bad-widget: "extractable" must be true, false or an array of tag strings/);
      } finally {
        await t.destroy(captured);
      }
    });
  });
});

describe('Schema extraction parity with legacy extraction', function() {
  this.timeout(t.timeout);

  let apos;
  let req;
  let schema;

  // The live output of a legacy translation extract implementation for
  // the document below, captured against the same schema expressed
  // through that implementation's `translate` flags: field-level
  // `translate: false` on `brand`, `offRows.hidden` and `specs.secret`;
  // type-level `translate` on `legacyOnText`/`legacyOffText`;
  // module-level `translate: false` on the parity-legacy-off widget;
  // the double-nested area configuration form
  // `{ options: { translate: false } }` on the parity-plain widget.
  // Here every one of those flags is expressed as `extractable`
  // vocabulary instead, and the translation query below must reproduce
  // this output through the legacy shape mapping.
  const legacyFields = [
    {
      valuePath: 'title',
      schemaPath: 'title',
      type: 'string',
      text: 'Parity product'
    },
    {
      valuePath: 'slug',
      schemaPath: 'slug',
      type: 'slug',
      text: 'parity product',
      original: 'parity-product'
    },
    {
      valuePath: 'subtitle',
      schemaPath: 'subtitle',
      type: 'string',
      text: 'A machine for testing'
    },
    {
      valuePath: 'body',
      schemaPath: 'body',
      type: 'string',
      text: 'Long body text for the parity audit.'
    },
    {
      valuePath: 'nickname',
      schemaPath: 'nickname',
      type: 'slug',
      text: 'hello world',
      original: 'products/hello-world'
    },
    {
      valuePath: 'blurb',
      schemaPath: 'blurb',
      type: 'legacyOnText',
      text: 'Legacy opt-in text'
    },
    {
      valuePath: '@row1.cell',
      schemaPath: 'rows.cell',
      type: 'string',
      text: 'Row one'
    },
    {
      valuePath: '@row1.deep.inner',
      schemaPath: 'rows.deep.inner',
      type: 'string',
      text: 'Deep one'
    },
    {
      valuePath: '@sub1.subCell',
      schemaPath: 'rows.subRows.subCell',
      type: 'string',
      text: 'Sub one'
    },
    {
      valuePath: '@row1.subRows',
      schemaPath: '@row1.subRows',
      type: 'array',
      metaOnly: true
    },
    {
      valuePath: '@row2.cell',
      schemaPath: 'rows.cell',
      type: 'string',
      text: 'Row two'
    },
    {
      valuePath: 'rows',
      schemaPath: 'rows',
      type: 'array',
      metaOnly: true
    },
    {
      valuePath: '@inline1.line',
      schemaPath: 'inlineRows.line',
      type: 'string',
      text: 'Inline one'
    },
    {
      valuePath: '@table1.cellText',
      schemaPath: 'tableRows.cellText',
      type: 'string',
      text: 'Table one'
    },
    {
      valuePath: 'tableRows',
      schemaPath: 'tableRows',
      type: 'array',
      metaOnly: true
    },
    {
      valuePath: 'specs.name',
      schemaPath: 'specs.name',
      type: 'string',
      text: 'Spec name'
    },
    {
      valuePath: '@w1.content',
      schemaPath: 'main.widget:@apostrophecms/rich-text',
      type: 'widget:@apostrophecms/rich-text',
      metaPath: '@w1',
      text: '<p>Rich text content</p>'
    },
    {
      valuePath: '@w3.caption',
      schemaPath: 'main.widget:@apostrophecms/image.caption',
      type: 'string',
      text: 'A caption'
    },
    {
      valuePath: '@w4.heading',
      schemaPath: 'main.widget:parity-hero.heading',
      type: 'string',
      text: 'Hero heading'
    },
    {
      valuePath: '@w5.content',
      schemaPath: 'main.widget:parity-hero.nested.widget:@apostrophecms/rich-text',
      type: 'widget:@apostrophecms/rich-text',
      metaPath: '@w5',
      text: '<p>Nested rich text</p>'
    },
    {
      valuePath: '@w4.nested.items',
      schemaPath: 'main.widget:parity-hero.nested',
      type: 'area',
      metaPath: '@w4.nested',
      metaOnly: true
    },
    {
      valuePath: 'main.items',
      schemaPath: 'main',
      type: 'area',
      metaPath: 'main',
      metaOnly: true
    }
  ];

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'parity-types': {
          init(self) {
            self.apos.schema.addFieldType({
              name: 'legacyOnText',
              extend: 'string'
            });
            self.apos.schema.addFieldType({
              name: 'legacyOffText',
              extend: 'string',
              extractable: [ 'notranslate' ]
            });
          }
        },
        'parity-hero-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            label: 'Parity Hero'
          },
          fields: {
            add: {
              heading: { type: 'string' },
              nested: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {}
                  }
                }
              }
            }
          }
        },
        'parity-legacy-off-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            label: 'Parity Legacy Off',
            extractable: [ 'notranslate' ]
          },
          fields: {
            add: {
              note: { type: 'string' }
            }
          }
        },
        'parity-plain-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            label: 'Parity Plain'
          },
          fields: {
            add: {
              message: { type: 'string' }
            }
          }
        },
        'parity-product': {
          extend: '@apostrophecms/piece-type',
          options: {
            label: 'Parity Product'
          },
          fields: {
            add: {
              subtitle: { type: 'string' },
              body: {
                type: 'string',
                textarea: true
              },
              nickname: { type: 'slug' },
              brand: {
                type: 'string',
                extractable: [ 'notranslate' ]
              },
              blurb: { type: 'legacyOnText' },
              // A legacy custom type only translated fields carrying
              // their own `translate: true`; a field without one maps
              // to the marker tag to keep translation output identical
              blurbDefault: {
                type: 'legacyOnText',
                extractable: [ 'notranslate' ]
              },
              internalCode: { type: 'legacyOffText' },
              stock: { type: 'integer' },
              tagline: { type: 'string' },
              rows: {
                type: 'array',
                fields: {
                  add: {
                    cell: { type: 'string' },
                    deep: {
                      type: 'object',
                      fields: {
                        add: {
                          inner: { type: 'string' }
                        }
                      }
                    },
                    subRows: {
                      type: 'array',
                      fields: {
                        add: {
                          subCell: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              },
              inlineRows: {
                type: 'array',
                inline: true,
                fields: {
                  add: {
                    line: { type: 'string' }
                  }
                }
              },
              tableRows: {
                type: 'array',
                inline: true,
                style: 'table',
                fields: {
                  add: {
                    cellText: { type: 'string' }
                  }
                }
              },
              offRows: {
                type: 'array',
                fields: {
                  add: {
                    hidden: {
                      type: 'string',
                      extractable: [ 'notranslate' ]
                    }
                  }
                }
              },
              specs: {
                type: 'object',
                fields: {
                  add: {
                    name: { type: 'string' },
                    secret: {
                      type: 'string',
                      extractable: [ 'notranslate' ]
                    }
                  }
                }
              },
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {},
                    '@apostrophecms/image': {},
                    'parity-hero': {},
                    'parity-legacy-off': {},
                    'parity-plain': {
                      extractable: [ 'notranslate' ]
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    req = apos.task.getReq();
    schema = apos.modules['parity-product'].schema;
  });

  after(async function() {
    return t.destroy(apos);
  });

  // The same document the capture was extracted from; keep in sync
  // with the capture by hand
  function parityDoc() {
    return {
      title: 'Parity product',
      slug: 'parity-product',
      subtitle: 'A machine for testing',
      body: 'Long body text for the parity audit.',
      nickname: 'products/hello-world',
      brand: 'Acme',
      blurb: 'Legacy opt-in text',
      blurbDefault: 'Legacy default text',
      internalCode: 'X-123',
      stock: 5,
      tagline: '',
      rows: [
        {
          _id: 'row1',
          cell: 'Row one',
          deep: {
            _id: 'deep1',
            inner: 'Deep one'
          },
          subRows: [
            {
              _id: 'sub1',
              subCell: 'Sub one'
            }
          ]
        },
        {
          _id: 'row2',
          cell: 'Row two',
          deep: {
            _id: 'deep2',
            inner: ''
          },
          subRows: []
        }
      ],
      inlineRows: [
        {
          _id: 'inline1',
          line: 'Inline one'
        }
      ],
      tableRows: [
        {
          _id: 'table1',
          cellText: 'Table one'
        }
      ],
      offRows: [
        {
          _id: 'off1',
          hidden: 'Hidden text'
        }
      ],
      specs: {
        _id: 'specs1',
        name: 'Spec name',
        secret: 'Spec secret'
      },
      main: {
        _id: 'area1',
        metaType: 'area',
        items: [
          {
            _id: 'w1',
            metaType: 'widget',
            type: '@apostrophecms/rich-text',
            content: '<p>Rich text content</p>'
          },
          {
            _id: 'w2',
            metaType: 'widget',
            type: '@apostrophecms/rich-text',
            content: ''
          },
          {
            _id: 'w3',
            metaType: 'widget',
            type: '@apostrophecms/image',
            caption: 'A caption',
            _image: [
              {
                _id: 'image1',
                attachment: {
                  _id: 'att1',
                  name: 'sample',
                  extension: 'jpg',
                  group: 'images',
                  width: 800,
                  height: 600
                }
              }
            ]
          },
          {
            _id: 'w4',
            metaType: 'widget',
            type: 'parity-hero',
            heading: 'Hero heading',
            nested: {
              _id: 'area2',
              metaType: 'area',
              items: [
                {
                  _id: 'w5',
                  metaType: 'widget',
                  type: '@apostrophecms/rich-text',
                  content: '<p>Nested rich text</p>'
                }
              ]
            }
          },
          {
            _id: 'w6',
            metaType: 'widget',
            type: 'parity-legacy-off',
            note: 'Widget module opt-out'
          },
          {
            _id: 'w7',
            metaType: 'widget',
            type: 'parity-plain',
            message: 'Area config opt-out'
          }
        ]
      }
    };
  }

  // The translation consumer's query: translatable text only, minus
  // the marker tag, with the unslugify transform applied per call
  function translationQuery() {
    return apos.schema.extract(req, schema, parityDoc(), {
      include: [ 'text' ],
      exclude: [ 'notranslate' ],
      extend: {
        slug(item) {
          return {
            ...item,
            original: item.text,
            text: apos.util.slugify(item.text.split('/').pop(), {
              separator: ' ',
              stripAccents: false
            })
          };
        }
      }
    });
  }

  // Resolve an item's dot schemaPath against the schema, returning the
  // legacy component form (widget components prefixed `widget:`) and
  // the schema field the path ends on, when it ends on one
  function resolveLegacy(schemaPath) {
    const components = [];
    let fields = schema;
    let areaField = null;
    let field = null;
    for (const part of schemaPath.split('.')) {
      const found = fields && fields.find(f => f.name === part);
      if (found) {
        field = found;
        components.push(part);
        fields = found.schema;
        areaField = (found.type === 'area') ? found : null;
        continue;
      }
      if (areaField) {
        components.push(`widget:${part}`);
        fields = apos.area.getWidgetManager(part)?.schema;
        field = null;
        areaField = null;
        continue;
      }
      components.push(part);
      field = null;
    }
    return {
      schemaPath: components.join('.'),
      field
    };
  }

  // Map a core item to the legacy field meta shape
  function toLegacyShape(item) {
    const legacy = {
      valuePath: item.path,
      schemaPath: resolveLegacy(item.schemaPath).schemaPath,
      type: item.type
    };
    if (item.metaOnly) {
      if (item.type === 'area') {
        // Legacy area markers pointed their value path at the items
        // array and their meta path at the field
        legacy.valuePath = `${item.path}.items`;
        legacy.metaPath = item.path;
      }
      legacy.metaOnly = true;
      return legacy;
    }
    if (item.type === 'widget:@apostrophecms/rich-text') {
      // Legacy anchored the rich text meta on the widget itself
      legacy.metaPath = item.path.replace(/\.content$/, '');
    }
    legacy.text = item.text;
    if (item.original !== undefined) {
      legacy.original = item.original;
    }
    return legacy;
  }

  // Legacy suppressed the container marker of inline arrays not
  // styled as tables
  function isInlineMarker(item) {
    if (!item.metaOnly || item.type !== 'array') {
      return false;
    }
    const { field } = resolveLegacy(item.schemaPath);
    return !!(field && field.inline && field.style !== 'table');
  }

  it('reproduces the legacy translation extraction through the shape mapping', function() {
    const mapped = translationQuery()
      .filter(item => !isInlineMarker(item))
      .map(toLegacyShape);
    const expected = legacyFields.map(entry => {
      // Deviation: legacy composed a nested array marker's schemaPath
      // from its value path components; the walk reports the real
      // schema location
      return (entry.metaOnly && entry.valuePath === '@row1.subRows')
        ? {
          ...entry,
          schemaPath: 'rows.subRows'
        }
        : entry;
    });
    // Deviation: a container whose content is entirely excluded by the
    // query still emits its marker; legacy emitted nothing for it
    expected.splice(
      expected.findIndex(entry => entry.valuePath === 'specs.name'),
      0,
      {
        valuePath: 'offRows',
        schemaPath: 'offRows',
        type: 'array',
        metaOnly: true
      }
    );
    assert.deepEqual(mapped, expected);
  });

  it('keeps every legacy opt-out visible to non-translation queries', function() {
    const items = apos.schema.extract(req, schema, parityDoc(), {
      include: [ 'text' ]
    });
    const optedOut = [
      'brand',
      'blurbDefault',
      'internalCode',
      '@off1.hidden',
      'specs.secret',
      '@w6.note',
      '@w7.message'
    ];
    for (const path of optedOut) {
      const item = items.find(i => i.path === path);
      assert(item, `expected an item at ${path}`);
      assert(item.tags.includes('text'), `${path} must stay a text item`);
      assert(item.tags.includes('notranslate'), `${path} must carry the marker`);
    }
  });
});
