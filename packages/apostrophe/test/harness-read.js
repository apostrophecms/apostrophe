const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// The harness's read tools and the schema read.

describe('Harness: read tools and the schema read', function () {
  this.timeout(t.timeout);

  let apos;

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {},
              fr: { prefix: '/fr' }
            }
          }
        },
        '@apostrophecms/ai': {
          extendMethods() {
            return {
              getDeniedTypes(_super) {
                return [ ..._super(), 'read-secret' ];
              }
            };
          }
        },
        'read-person': {
          extend: '@apostrophecms/piece-type'
        },
        'read-secret': {
          extend: '@apostrophecms/piece-type'
        },
        // Inline rich text, with the same options on a piece and a widget
        'read-note': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              text: {
                type: 'richText',
                options: { toolbar: [ 'italic' ] }
              }
            }
          }
        },
        'read-quote-widget': {
          extend: '@apostrophecms/widget-type',
          fields: {
            add: {
              text: {
                type: 'richText',
                options: { toolbar: [ 'italic' ] }
              },
              credit: { type: 'richText' }
            }
          }
        },
        'read-setting': {
          extend: '@apostrophecms/piece-type',
          options: {
            localized: false
          }
        },
        'read-hero-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            aiHow: 'One hero per page, at the top.'
          },
          styles: {
            add: {
              padding: 'padding',
              width: 'width'
            }
          },
          fields: {
            add: {
              heading: {
                type: 'string',
                label: 'The heading label',
                help: 'The heading help',
                required: true
              },
              content: {
                type: 'area',
                options: {
                  max: 2,
                  widgets: {
                    '@apostrophecms/rich-text': {
                      toolbar: [ 'bold', 'link', 'styles' ],
                      insert: [],
                      styles: [
                        {
                          tag: 'p',
                          label: 'Paragraph'
                        },
                        {
                          tag: 'p',
                          class: 'lead',
                          label: 'Lead'
                        }
                      ]
                    }
                  }
                }
              },
              _image: {
                type: 'relationship',
                withType: '@apostrophecms/image',
                max: 1
              },
              items: {
                type: 'array',
                fields: {
                  add: {
                    label: { type: 'string' },
                    body: {
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
        },
        'read-article': {
          extend: '@apostrophecms/piece-type',
          options: {
            aiWhen: 'News with a date.'
          },
          fields: {
            add: {
              body: {
                type: 'string',
                textarea: true
              },
              _author: {
                type: 'relationship',
                withType: 'read-person',
                max: 1
              },
              main: {
                type: 'area',
                options: {
                  widgets: {
                    'read-hero': {},
                    '@apostrophecms/rich-text': {},
                    '@apostrophecms/image': {}
                  }
                }
              },
              seoTitle: { type: 'string' },
              seoDescription: {
                type: 'string',
                help: 'Shown in search results'
              },
              background: {
                type: 'select',
                choices: [
                  {
                    label: 'None',
                    value: 'none'
                  },
                  {
                    label: 'Custom',
                    value: 'custom'
                  }
                ],
                def: 'none'
              },
              backgroundColor: {
                type: 'color',
                if: { background: 'custom' },
                requiredIf: { background: 'custom' }
              },
              priority: {
                type: 'range',
                min: 0,
                max: 120,
                step: 4,
                def: 32
              },
              palette: {
                type: 'object',
                if: { background: 'custom' },
                fields: {
                  add: {
                    accent: { type: 'color' },
                    stops: {
                      type: 'array',
                      if: { accent: { $ne: '' } },
                      fields: {
                        add: {
                          position: { type: 'integer' }
                        }
                      }
                    }
                  }
                }
              },
              code: {
                type: 'string',
                readOnly: true,
                def: 'A1'
              },
              category: {
                type: 'select',
                choices: 'getCategories'
              }
            },
            group: {
              basics: {
                label: 'Basics',
                fields: [ 'title', 'body', '_author', 'main' ]
              },
              seo: {
                label: 'SEO',
                fields: [ 'seoTitle', 'seoDescription' ]
              },
              look: {
                label: 'Look',
                fields: [ 'background', 'backgroundColor', 'palette', 'priority', 'code', 'category' ]
              }
            }
          },
          methods(self) {
            return {
              getCategories(req) {
                return [
                  {
                    label: 'One',
                    value: 'one'
                  },
                  {
                    label: 'Two',
                    value: 'two'
                  }
                ];
              }
            };
          }
        },
        'read-article-page': {
          extend: '@apostrophecms/piece-page-type',
          options: {
            pieces: 'read-article'
          }
        },
        'read-page': {
          extend: '@apostrophecms/page-type'
        }
      }
    });
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  function userReq(username = 'ann', extra = {}) {
    return apos.task.getReq({
      user: {
        _id: `user-${username}`,
        username,
        title: username[0].toUpperCase() + username.slice(1),
        role: 'admin'
      },
      mode: 'draft',
      ...extra
    });
  }

  // Runs a tool as the engine does: arguments validated and defaulted,
  // the result held to its budget
  function run(name, input, req = userReq()) {
    return apos.ai.executeToolCall(req, apos.ai.getTool(name), {
      id: 'call-1',
      name,
      input
    });
  }

  async function seed() {
    const req = userReq();
    const person = await apos.modules['read-person'].insert(req, { title: 'Jane Doe' });
    const image = await apos.image.insert(req, { title: 'Team photo' });
    const article = await apos.modules['read-article'].insert(req, {
      title: 'Launch news',
      body: 'Body text',
      _author: [ person ],
      main: {
        metaType: 'area',
        items: [
          {
            _id: 'hero-1',
            metaType: 'widget',
            type: 'read-hero',
            heading: 'Welcome aboard',
            _image: [ image ],
            content: {
              metaType: 'area',
              items: [ {
                _id: 'text-2',
                metaType: 'widget',
                type: '@apostrophecms/rich-text',
                content: '<p>Inner text</p>'
              } ]
            },
            items: [ {
              _id: 'item-1',
              label: 'First',
              body: {
                metaType: 'area',
                items: []
              }
            } ]
          },
          {
            _id: 'text-1',
            metaType: 'widget',
            type: '@apostrophecms/rich-text',
            content: '<p>Hello <b>world</b>, a long enough paragraph to need cutting before the end of it all, and more.</p>'
          },
          {
            _id: 'image-1',
            metaType: 'widget',
            type: '@apostrophecms/image',
            _image: [ image ]
          }
        ]
      }
    });
    await apos.modules['read-article'].localize(req, article, 'fr');
    return {
      person,
      image,
      article
    };
  }

  describe('search_content', function () {
    let article;

    before(async function () {
      ({ article } = await seed());
      await apos.modules['read-secret'].insert(userReq(), { title: 'Launch secrets' });
    });

    it('should find documents by words, naming the locale and each by title next to its id', async function () {
      const result = await run('search_content', { query: 'launch' });

      assert.equal(result.locale, 'en');
      assert.deepEqual(result.results, [ {
        _id: article._id,
        type: 'read-article',
        title: 'Launch news',
        slug: 'launch-news'
      } ]);
    });

    it('should list a type, in another locale', async function () {
      const result = await run('search_content', {
        type: 'read-article',
        locale: 'fr'
      });

      assert.equal(result.locale, 'fr');
      assert.deepEqual(
        result.results.map(doc => doc._id),
        [ article._id.replace(':en:', ':fr:') ]
      );
    });

    it('should list only the values the model may use', function () {
      const { properties } = apos.ai.getTool('search_content').input;

      assert(properties.type.enum.includes('read-article'));
      assert.equal(properties.type.enum.includes('read-secret'), false);
      assert.equal(properties.type.enum.includes('@apostrophecms/recently-edited'), false);
      assert.equal(properties.type.enum.includes('@apostrophecms/archive-page'), false);
      assert.deepEqual(properties.locale.enum, [ 'en', 'fr' ]);
    });

    it('should list a type a page at a time', async function () {
      await apos.modules['read-article'].insert(userReq(), { title: 'Later news' });

      const first = await run('search_content', {
        type: 'read-article',
        limit: 1
      });
      const second = await run('search_content', {
        type: 'read-article',
        limit: 1,
        offset: first.next
      });

      assert.equal(first.next, 1);
      assert.deepEqual(
        [ ...first.results, ...second.results ].map(doc => doc.title),
        [ 'Later news', 'Launch news' ]
      );
      assert.equal(second.next, undefined);
    });

    it('should ask for words or a type', async function () {
      await assert.rejects(run('search_content', {}), { name: 'aiToolError' });
    });
  });

  describe('get_document', function () {
    let article;

    before(async function () {
      ({ article } = await seed());
      await apos.doc.db.updateOne({ _id: article._id }, {
        $push: {
          'main.items': {
            _id: 'gone-1',
            metaType: 'widget',
            type: 'read-gone',
            text: 'Retired'
          }
        }
      });
    });

    it('should outline every area, nested ones under their widget, with its locales', async function () {
      const result = await run('get_document', { _id: article._id });

      assert.equal(result.title, 'Launch news');
      assert.equal(result.locale, 'en');
      assert.deepEqual(result.locales, [ 'en', 'fr' ]);
      assert.deepEqual(
        result.fields.map(field => field.name),
        [ 'title', 'body', '_author', 'slug', 'visibility', 'archived' ]
      );
      assert(result.fields.every(field => field.chars > 0));
      const field = name => result.fields.find(field => field.name === name);
      // Short values come with the outline, the rest is read by path
      assert.equal(field('title').value, 'Launch news');
      assert.equal(field('archived').value, false);
      assert.equal('value' in field('_author'), false);
      const [ main ] = result.areas;
      assert.equal(main.path, 'main');
      assert.deepEqual(
        main.widgets.map(({
          _id, type, preview
        }) => ({
          _id,
          type,
          preview
        })),
        [
          {
            _id: 'hero-1',
            type: 'read-hero',
            preview: 'Welcome aboard'
          },
          {
            _id: 'text-1',
            type: '@apostrophecms/rich-text',
            preview: 'Hello world, a long enough paragraph to need cutting before the end of ' +
              'it all, a…'
          },
          {
            _id: 'image-1',
            type: '@apostrophecms/image',
            preview: 'Team photo'
          }
        ]
      );
      assert.deepEqual(main.widgets[0].areas, [
        {
          path: '@hero-1.content',
          widgets: [ {
            _id: 'text-2',
            type: '@apostrophecms/rich-text',
            preview: 'Inner text',
            chars: main.widgets[0].areas[0].widgets[0].chars
          } ]
        },
        {
          path: '@item-1.body',
          widgets: []
        }
      ]);
      assert.equal(JSON.stringify(result).includes('Retired'), false);
    });

    it('should read values by name, dot path and @id path, rich text included', async function () {
      const result = await run('get_document', {
        _id: article._id,
        view: 'properties',
        paths: [ 'body', '@hero-1.heading', '@text-1', '_author', 'main.nope' ]
      });

      assert.deepEqual(result.properties, [
        {
          path: 'body',
          value: 'Body text'
        },
        {
          path: '@hero-1.heading',
          value: 'Welcome aboard'
        },
        {
          path: '@text-1',
          value: {
            _id: 'text-1',
            type: '@apostrophecms/rich-text',
            content: '<p>Hello <b>world</b>, a long enough paragraph to need cutting before ' +
              'the end of it all, and more.</p>'
          }
        },
        {
          path: '_author',
          value: [ {
            _id: result.properties[3].value[0]._id,
            title: 'Jane Doe'
          } ]
        },
        {
          path: 'main.nope',
          missing: true
        }
      ]);
    });

    it('should outline only the areas and widgets named by path', async function () {
      const { parts } = await run('get_document', {
        _id: article._id,
        paths: [ '@hero-1.content', '@image-1', 'main.nope' ]
      });

      assert.deepEqual(parts.map(part => part.path), [
        '@hero-1.content', '@image-1', 'main.nope'
      ]);
      assert.deepEqual(parts[0].widgets.map(widget => widget._id), [ 'text-2' ]);
      assert.equal(parts[1].widget.preview, 'Team photo');
      assert.equal(parts[2].missing, true);
    });

    it('should read properties by path only, through the AI-facing schema', async function () {
      await assert.rejects(
        run('get_document', {
          _id: article._id,
          view: 'properties'
        }),
        error => (error.name === 'aiToolError') && /paths/.test(error.message)
      );
      const { properties } = await run('get_document', {
        _id: article._id,
        view: 'properties',
        paths: [ 'highSearchText', 'main' ]
      });

      assert.equal(properties[0].missing, true);
      assert.deepEqual(
        properties[1].value.items.map(widget => widget._id),
        [ 'hero-1', 'text-1', 'image-1' ]
      );
    });

    it('should list versions with who, when and the AI mark', async function () {
      await apos.harness.writeDocuments(userReq('bob'), [ {
        _id: article._id,
        patch: { body: 'Written by AI' }
      } ]);

      const result = await run('get_document', {
        _id: article._id,
        view: 'versions'
      });

      const [ newest, ...rest ] = result.versions;
      assert.equal(newest.by, 'Bob');
      assert.equal(newest.ai, true);
      assert(newest.at instanceof Date);
      assert(newest.versionId);
      assert.equal(rest.at(-1).by, 'Ann');
      assert.equal(rest.at(-1).ai, false);
    });

    it('should tell the model where ids come from for a document it can\'t read', async function () {
      await assert.rejects(
        run('get_document', { _id: 'nope' }),
        error => (error.name === 'aiToolError') && /search_content/.test(error.message)
      );
      const secret = await apos.modules['read-secret'].insert(userReq(), { title: 'Secret' });
      await assert.rejects(run('get_document', { _id: secret._id }), { name: 'aiToolError' });
    });
  });

  describe('list_types', function () {
    before(async function () {
      await apos.page.insert(userReq(), '_home', 'lastChild', {
        title: 'News',
        type: 'read-article-page',
        slug: '/news'
      });
    });

    it('should list pages, pieces and widgets with how each doc type goes live', async function () {
      const result = await run('list_types', {});
      const piece = name => result.pieces.find(type => type.name === name);

      assert(result.pages.some(type => type.name === 'read-page'));
      assert.deepEqual(piece('read-article'), {
        name: 'read-article',
        label: 'Read Article',
        publishing: 'drafts',
        pages: [ '/news' ]
      });
      assert.equal(piece('@apostrophecms/image').publishing, 'autopublish');
      assert.equal(piece('read-setting').publishing, 'noDrafts');
      assert.equal(piece('@apostrophecms/recently-edited'), undefined);
      assert.equal(piece('read-secret'), undefined);
      assert(result.widgets.some(type => type.name === 'read-hero'));
    });

    it('should name types in the language of the admin UI, not of the content', async function () {
      const req = userReq('ann', { locale: 'en' });
      req.user.adminLocale = 'fr';

      const result = await run('list_types', {}, req);

      assert.equal(
        result.pieces.find(type => type.name === '@apostrophecms/file').label,
        'Fichier'
      );
    });
  });

  describe('get_schema', function () {
    it('should read a document type field by field, under its groups', async function () {
      const { schema } = await run('get_schema', { types: [ 'read-article' ] });
      const lines = schema.split('\n');

      assert.equal(
        lines[5],
        'main: area [read-hero, @apostrophecms/rich-text html A, @apostrophecms/image]'
      );
      assert.deepEqual([ ...lines.slice(0, 5), ...lines.slice(6) ], [
        '# read-article (piece)',
        '## basics',
        'title: string, required',
        'body: string',
        '_author: relationship → read-person, max 1',
        '## utility',
        'slug: slug, required',
        'visibility: select [public, loginRequired], required, default public, ' +
          'help "Select whether this content is public or private"',
        '## seo',
        'seoTitle: string',
        'seoDescription: string, help "Shown in search results"',
        '## look',
        'background: select [none, custom], default none',
        'backgroundColor: color, if background=custom, required if background=custom',
        'palette: object, 2 fields folded, if background=custom',
        'priority: range 0–120, step 4, default 32',
        'code: string, readonly, default A1',
        'category: select [one, two]',
        '## ungrouped',
        'archived: boolean, default false'
      ]);
    });

    it('should read a widget type with its style fields and the markup each area keeps', async function () {
      const { schema, legend } = await run('get_schema', { types: [ 'read-hero' ] });
      const lines = schema.split('\n');

      assert.deepEqual(lines, [
        '# read-hero (widget)',
        '## basics',
        'heading: string, required, help "The heading help"',
        'content: area [@apostrophecms/rich-text html A], max 2',
        '_image: relationship → @apostrophecms/image, max 1',
        'items: array',
        '  label: string',
        '  body: area [@apostrophecms/rich-text html B]',
        '## styles',
        'padding: style padding, px, box, min 0',
        'width: style width, %, range 0–100, step 10, default 100'
      ]);
      assert.equal(schema.includes('The heading label'), false);
      // Each set of markup a save keeps, listed once
      assert(legend.includes('\nmarkup A: br, p, b, strong, a, p.lead'));
      assert.match(legend, /\nmarkup B: br, p, [^\n]+$/);
      for (const entry of [ 'style:', 'area:', 'html:', 'relationship →', 'box:', 'range:' ]) {
        assert(legend.includes(`\n${entry}`), entry);
      }
      assert.equal(legend.includes('\ncolor:'), false);
    });

    it('should read folded fields in full, by dot path, one type at a time', async function () {
      const { legend } = await run('get_schema', { types: [ 'read-article' ] });
      const whole = await run('get_schema', {
        types: [ 'read-article' ],
        fields: [ 'palette' ]
      });
      const nested = await run('get_schema', {
        types: [ 'read-article' ],
        fields: [ 'palette.stops', 'nope' ]
      });

      assert(legend.includes('\nfolded:'));
      assert.deepEqual(whole.schema.split('\n'), [
        '# read-article (piece)',
        'palette: object, if background=custom',
        '  accent: color',
        '  stops: array, if accent!=""',
        '    position: integer'
      ]);
      assert.deepEqual(nested.schema.split('\n'), [
        '# read-article (piece)',
        'palette.stops: array, if accent!=""',
        '  position: integer',
        'nope: no such field'
      ]);
      await assert.rejects(run('get_schema', {
        types: [ 'read-article', 'read-hero' ],
        fields: [ 'palette' ]
      }), { name: 'aiToolError' });
    });

    it('should give rich text its content line, and several types in one read', async function () {
      const { schema, legend } = await run('get_schema', {
        types: [ '@apostrophecms/rich-text', '@apostrophecms/image' ]
      });

      assert.match(schema, /^# @apostrophecms\/rich-text \(widget\)\ncontent: html A\n/);
      assert.match(legend, /\nmarkup A: br, p, /);
      assert.match(schema, /\n# @apostrophecms\/image \(piece\)\n/);
      assert.match(schema, /\n# @apostrophecms\/image \(widget\)\n/);
    });

    it('should name the markup an inline rich text field keeps, each set once', async function () {
      const { schema, legend } = await run('get_schema', {
        types: [ 'read-note', 'read-quote' ]
      });
      const lines = schema.split('\n');

      assert(lines.includes('text: html A'));
      assert.equal(lines.filter(line => line === 'text: html A').length, 2);
      assert(lines.includes('credit: html B'));
      assert(legend.includes('\nmarkup A: br, p, i, em'));
      assert.match(legend, /\nmarkup B: br, p, /);
      assert.equal(legend.includes('markup C'), false);
    });

    it('should send help in the language of the admin UI', async function () {
      const req = userReq('ann', { locale: 'en' });
      req.user.adminLocale = 'fr';

      const { schema } = await run('get_schema', { types: [ 'read-article' ] }, req);

      assert(schema.includes('help "Choisissez si ce contenu est public ou privé"'));
    });
  });

  describe('get_guidance', function () {
    it('should return the aiHow of the types that have one', async function () {
      const { input } = apos.ai.getTool('get_guidance');

      assert.deepEqual(input.properties.types.items.enum, [ 'read-hero' ]);
      assert.deepEqual(await run('get_guidance', { types: [ 'read-hero' ] }), {
        guidance: [ {
          type: 'read-hero',
          aiHow: 'One hero per page, at the top.'
        } ]
      });
    });
  });

  describe('get_page_tree', function () {
    let services;

    before(async function () {
      const req = userReq();
      services = await apos.page.insert(req, '_home', 'lastChild', {
        title: 'Services',
        type: 'read-page',
        slug: '/services'
      });
      const design = await apos.page.insert(req, services._id, 'lastChild', {
        title: 'Design',
        type: 'read-page',
        slug: '/services/design'
      });
      await apos.page.insert(req, design._id, 'lastChild', {
        title: 'Logos',
        type: 'read-page',
        slug: '/services/design/logos'
      });
    });

    it('should list the tree from the home page, two levels down', async function () {
      const result = await run('get_page_tree', {});
      const page = slug => result.pages.find(page => page.slug === slug);

      assert.equal(result.locale, 'en');
      assert.equal(result.pages[0].slug, '/');
      assert.equal(result.pages[0].parentId, null);
      assert.deepEqual(page('/services/design'), {
        _id: page('/services/design')._id,
        title: 'Design',
        slug: '/services/design',
        type: 'read-page',
        level: 2,
        parentId: services._id,
        children: 1
      });
      assert.equal(page('/services/design/logos'), undefined);
      assert.equal(result.truncated, true);
    });

    it('should start from a page named by slug or id', async function () {
      const bySlug = await run('get_page_tree', {
        root: '/services',
        depth: 3
      });
      const byId = await run('get_page_tree', {
        root: services._id,
        depth: 3
      });

      assert.deepEqual(
        bySlug.pages.map(page => page.title),
        [ 'Services', 'Design', 'Logos' ]
      );
      assert.equal(bySlug.truncated, undefined);
      assert.deepEqual(byId.pages, bySlug.pages);
    });

    it('should stop where its budget would, and say so', async function () {
      const tool = apos.ai.getTool('get_page_tree');
      const { maxResultChars } = tool;
      tool.maxResultChars = 700;
      try {
        const result = await run('get_page_tree', { depth: 5 });

        assert.equal(result.truncated, true);
        assert(result.pages.length > 0);
        assert(JSON.stringify(result).length <= 700);
      } finally {
        tool.maxResultChars = maxResultChars;
      }
    });
  });

  describe('find_references', function () {
    it('should list the documents using an image, with where each holds it', async function () {
      const { image, article } = await seed();
      const unused = await apos.image.insert(userReq(), { title: 'Unused' });

      const result = await run('find_references', { _id: image._id });

      assert.equal(result.title, 'Team photo');
      assert.equal(result.locale, 'en');
      assert.deepEqual(result.references, [ {
        _id: article._id,
        type: 'read-article',
        title: 'Launch news',
        paths: [ '@hero-1._image', '@image-1._image' ]
      } ]);
      assert.equal(result.total, 1);
      assert.equal(result.next, undefined);
      assert.deepEqual(
        (await run('find_references', { _id: unused._id })).references,
        []
      );
    });

    it('should read the documents a page at a time', async function () {
      const { person } = await seed();
      await apos.modules['read-article'].insert(userReq(), {
        title: 'By Jane too',
        _author: [ person ]
      });

      const first = await run('find_references', {
        _id: person._id,
        limit: 1
      });
      const second = await run('find_references', {
        _id: person._id,
        limit: 1,
        offset: first.next
      });

      assert.equal(first.total, 2);
      assert.equal(first.next, 1);
      assert.equal(second.next, undefined);
      assert.notEqual(first.references[0]._id, second.references[0]._id);
      assert.deepEqual(second.references[0].paths.concat(first.references[0].paths), [
        '_author', '_author'
      ]);
    });
  });

  it('should give every read tool a result budget', function () {
    for (const name of [
      'search_content', 'get_document', 'list_types', 'get_schema',
      'get_guidance', 'get_page_tree', 'find_references', 'get_changes'
    ]) {
      const tool = apos.ai.getTool(name);
      assert.equal(tool.kind, 'query', name);
      assert(tool.maxResultChars > 0, name);
      assert(tool.tags.includes('content'), name);
    }
  });
});
