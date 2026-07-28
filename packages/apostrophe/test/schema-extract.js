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
