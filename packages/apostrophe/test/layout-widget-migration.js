const assert = require('node:assert/strict');
const t = require('../test-lib/test.js');

describe('Layout Widget Migration', function () {
  this.timeout(t.timeout);

  describe('migrateColumnWidget (unit)', function () {
    let apos;
    let migrate;

    before(async function () {
      apos = await t.create({ root: module });
      migrate = apos.modules['@apostrophecms/layout-column-widget'].migrateColumnWidget;
    });

    after(async function () {
      await t.destroy(apos);
    });

    it('returns $set for old-schema widget', function () {
      const widget = {
        _id: 'w1',
        type: '@apostrophecms/layout-column',
        metaType: 'widget',
        desktop: {
          colstart: 1,
          colspan: 6,
          rowstart: 1,
          rowspan: 1,
          order: 0,
          justify: 'center',
          align: 'start'
        },
        tablet: {
          show: false,
          order: 2
        },
        mobile: {
          show: true,
          order: 3
        }
      };

      const result = migrate(widget, 'main.items.0');

      assert.deepEqual(result, {
        $set: {
          'main.items.0.colstart': 1,
          'main.items.0.colspan': 6,
          'main.items.0.rowstart': 1,
          'main.items.0.rowspan': 1,
          'main.items.0.order': 0,
          'main.items.0.justify': 'center',
          'main.items.0.align': 'start',
          'main.items.0.showTablet': false,
          'main.items.0.showMobile': true
        }
      });
    });

    it('returns null for already-migrated widget (idempotency)', function () {
      const widget = {
        _id: 'w1',
        type: '@apostrophecms/layout-column',
        metaType: 'widget',
        desktop: {
          colstart: 1,
          colspan: 6
        },
        tablet: {},
        mobile: {},
        colstart: 1,
        colspan: 6,
        rowstart: 1,
        rowspan: 1,
        order: 0,
        justify: 'center',
        align: 'start',
        showTablet: true,
        showMobile: true
      };

      const result = migrate(widget, 'main.items.0');
      assert.equal(result, null);
    });

    it('applies defaults when optional fields are missing', function () {
      const widget = {
        _id: 'w1',
        type: '@apostrophecms/layout-column',
        metaType: 'widget',
        desktop: {
          colstart: 2,
          colspan: 4
        },
        tablet: {},
        mobile: {}
      };

      const result = migrate(widget, 'main.items.0');

      assert.deepEqual(result, {
        $set: {
          'main.items.0.colstart': 2,
          'main.items.0.colspan': 4,
          'main.items.0.rowstart': 1,
          'main.items.0.rowspan': 1,
          'main.items.0.order': null,
          'main.items.0.justify': null,
          'main.items.0.align': null,
          'main.items.0.showTablet': true,
          'main.items.0.showMobile': true
        }
      });
    });

    it('uses correct dot path for deeply nested widget', function () {
      const widget = {
        _id: 'w-inner',
        type: '@apostrophecms/layout-column',
        metaType: 'widget',
        desktop: {
          colstart: 3,
          colspan: 2
        },
        tablet: { show: false },
        mobile: { show: true }
      };

      const result = migrate(widget, 'main.items.0.content.items.0');

      assert.equal(result.$set['main.items.0.content.items.0.colstart'], 3);
      assert.equal(result.$set['main.items.0.content.items.0.colspan'], 2);
      assert.equal(result.$set['main.items.0.content.items.0.showTablet'], false);
      assert.equal(result.$set['main.items.0.content.items.0.showMobile'], true);
    });

    it('returns update when colstart is null at root but desktop still present', function () {
      const widget = {
        _id: 'w1',
        type: '@apostrophecms/layout-column',
        metaType: 'widget',
        colstart: null,
        desktop: {
          colstart: 5,
          colspan: 3
        },
        tablet: { show: true },
        mobile: { show: false }
      };

      const result = migrate(widget, 'main.items.0');

      assert.equal(result.$set['main.items.0.colstart'], 5);
      assert.equal(result.$set['main.items.0.colspan'], 3);
      assert.equal(result.$set['main.items.0.showMobile'], false);
    });
  });

  describe('migration registration (integration)', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          'test-column-widget': {
            extend: '@apostrophecms/layout-column-widget',
            options: {
              label: 'Test Column'
            }
          },
          'test-layout-widget': {
            extend: '@apostrophecms/layout-widget',
            options: {
              label: 'Test Layout'
            },
            fields: {
              add: {
                columns: {
                  type: 'area',
                  options: {
                    widgets: {
                      'test-column': {}
                    }
                  }
                }
              }
            }
          },
          'default-page': {
            extend: '@apostrophecms/page-type',
            options: {
              label: 'Default'
            },
            fields: {
              add: {
                main: {
                  type: 'area',
                  options: {
                    widgets: {
                      '@apostrophecms/layout': {},
                      'test-layout': {}
                    }
                  }
                }
              }
            }
          },
          '@apostrophecms/page': {
            options: {
              types: [
                {
                  name: 'default-page',
                  label: 'Default'
                }
              ]
            }
          }
        }
      });
    });

    after(async function () {
      await t.destroy(apos);
    });

    it('registers migration for base column widget', async function () {
      const record = await apos.migration.db.findOne({
        _id: '@apostrophecms/layout-column-widget:flatten-column-schema'
      });
      assert(record, 'Base column migration should be registered');
    });

    it('registers migration for extended column widget', async function () {
      const record = await apos.migration.db.findOne({
        _id: 'test-column-widget:flatten-column-schema'
      });
      assert(record, 'Extended column migration should be registered');
    });

    it('both migrations are independent records', async function () {
      const base = await apos.migration.db.findOne({
        _id: '@apostrophecms/layout-column-widget:flatten-column-schema'
      });
      const extended = await apos.migration.db.findOne({
        _id: 'test-column-widget:flatten-column-schema'
      });
      assert.notEqual(base._id, extended._id);
    });

    it('returns $set for extended column type', function () {
      const migrate = apos.modules['test-column-widget'].migrateColumnWidget;
      const widget = {
        _id: 'w1',
        type: 'test-column',
        metaType: 'widget',
        desktop: {
          colstart: 2,
          colspan: 4,
          rowstart: 1,
          rowspan: 2,
          order: 1,
          justify: 'start',
          align: 'center'
        },
        tablet: {
          show: true,
          order: 3
        },
        mobile: {
          show: false,
          order: 4
        }
      };

      const result = migrate(widget, 'main.items.0');

      assert.deepEqual(result, {
        $set: {
          'main.items.0.colstart': 2,
          'main.items.0.colspan': 4,
          'main.items.0.rowstart': 1,
          'main.items.0.rowspan': 2,
          'main.items.0.order': 1,
          'main.items.0.justify': 'start',
          'main.items.0.align': 'center',
          'main.items.0.showTablet': true,
          'main.items.0.showMobile': false
        }
      });
    });
  });

  describe('migration execution (database)', function () {
    let apos;

    const modules = {
      'test-column-widget': {
        extend: '@apostrophecms/layout-column-widget',
        options: {
          label: 'Test Column'
        }
      },
      'test-layout-widget': {
        extend: '@apostrophecms/layout-widget',
        options: {
          label: 'Test Layout'
        },
        fields: {
          add: {
            columns: {
              type: 'area',
              options: {
                widgets: {
                  'test-column': {}
                }
              }
            }
          }
        }
      },
      'default-page': {
        extend: '@apostrophecms/page-type',
        options: {
          label: 'Default'
        },
        fields: {
          add: {
            main: {
              type: 'area',
              options: {
                widgets: {
                  '@apostrophecms/layout': {},
                  'test-layout': {}
                }
              }
            }
          }
        }
      },
      '@apostrophecms/page': {
        options: {
          types: [
            {
              name: 'default-page',
              label: 'Default'
            }
          ]
        }
      }
    };

    afterEach(async function () {
      await t.destroy(apos);
    });

    async function setupAndRunMigration(oldDocs) {
      // Boot the instance (migrations run automatically on boot)
      apos = await t.create({
        root: module,
        modules
      });

      // Remove our migration records so they will run again
      await apos.migration.db.deleteMany({
        _id: {
          $in: [
            '@apostrophecms/layout-column-widget:flatten-column-schema',
            'test-column-widget:flatten-column-schema'
          ]
        }
      });

      // Insert old-shaped data directly into the DB (bypass managers)
      for (const doc of oldDocs) {
        await apos.doc.db.insertOne(doc);
      }

      // Verify the old data is in the DB as expected
      for (const doc of oldDocs) {
        const found = await apos.doc.db.findOne({ _id: doc._id });
        assert(found, `Doc ${doc._id} should exist in DB`);
      }

      // Run only the flatten-column-schema migrations directly,
      // avoiding the full migrate() which skips on a new site
      const migrations = apos.migration.migrations.filter(
        m => m.name.endsWith(':flatten-column-schema')
      );
      for (const migration of migrations) {
        await apos.migration.runOne(migration);
      }

      // Return fetched docs for assertions
      const results = {};
      for (const doc of oldDocs) {
        results[doc._id] = await apos.doc.db.findOne({ _id: doc._id });
      }
      return results;
    }

    it('migrates base column widget in DB', async function () {
      const results = await setupAndRunMigration([
        {
          _id: 'test-base-col:en:published',
          aposLocale: 'en:published',
          type: 'default-page',
          slug: '/test-base-col',
          main: {
            _id: 'area1',
            metaType: 'area',
            items: [
              {
                _id: 'w1',
                type: '@apostrophecms/layout-column',
                metaType: 'widget',
                desktop: {
                  colstart: 1,
                  colspan: 6,
                  rowstart: 1,
                  rowspan: 1,
                  order: 0,
                  justify: 'center',
                  align: 'start'
                },
                tablet: {
                  show: false,
                  order: 2
                },
                mobile: {
                  show: true,
                  order: 3
                }
              }
            ]
          }
        }
      ]);

      const widget = results['test-base-col:en:published'].main.items[0];
      assert.equal(widget.colstart, 1);
      assert.equal(widget.colspan, 6);
      assert.equal(widget.rowstart, 1);
      assert.equal(widget.rowspan, 1);
      assert.equal(widget.order, 0);
      assert.equal(widget.justify, 'center');
      assert.equal(widget.align, 'start');
      assert.equal(widget.showTablet, false);
      assert.equal(widget.showMobile, true);
      assert(widget.desktop);
    });

    it('migrates extended column widget in DB', async function () {
      const results = await setupAndRunMigration([
        {
          _id: 'test-ext-col:en:published',
          aposLocale: 'en:published',
          type: 'default-page',
          slug: '/test-ext-col',
          main: {
            _id: 'area1',
            metaType: 'area',
            items: [
              {
                _id: 'w1',
                type: 'test-column',
                metaType: 'widget',
                desktop: {
                  colstart: 2,
                  colspan: 4,
                  rowstart: 1,
                  rowspan: 2,
                  order: 1,
                  justify: 'start',
                  align: 'center'
                },
                tablet: {
                  show: true,
                  order: 3
                },
                mobile: {
                  show: false,
                  order: 4
                }
              }
            ]
          }
        }
      ]);

      const widget = results['test-ext-col:en:published'].main.items[0];
      assert.equal(widget.colstart, 2);
      assert.equal(widget.colspan, 4);
      assert.equal(widget.rowstart, 1);
      assert.equal(widget.rowspan, 2);
      assert.equal(widget.order, 1);
      assert.equal(widget.justify, 'start');
      assert.equal(widget.align, 'center');
      assert.equal(widget.showTablet, true);
      assert.equal(widget.showMobile, false);
      assert(widget.desktop);
    });

    it('applies defaults for missing optional fields in DB', async function () {
      const results = await setupAndRunMigration([
        {
          _id: 'test-defaults:en:published',
          aposLocale: 'en:published',
          type: 'default-page',
          slug: '/test-defaults',
          main: {
            _id: 'area1',
            metaType: 'area',
            items: [
              {
                _id: 'w1',
                type: '@apostrophecms/layout-column',
                metaType: 'widget',
                desktop: {
                  colstart: 2,
                  colspan: 4
                },
                tablet: {},
                mobile: {}
              }
            ]
          }
        }
      ]);

      const widget = results['test-defaults:en:published'].main.items[0];
      assert.equal(widget.colstart, 2);
      assert.equal(widget.colspan, 4);
      assert.equal(widget.rowstart, 1);
      assert.equal(widget.rowspan, 1);
      assert.equal(widget.order, null);
      assert.equal(widget.justify, null);
      assert.equal(widget.align, null);
      assert.equal(widget.showTablet, true);
      assert.equal(widget.showMobile, true);
      assert(widget.desktop);
    });

    it('does not touch non-column widgets in DB', async function () {
      const results = await setupAndRunMigration([
        {
          _id: 'test-non-col:en:published',
          aposLocale: 'en:published',
          type: 'default-page',
          slug: '/test-non-col',
          main: {
            _id: 'area1',
            metaType: 'area',
            items: [
              {
                _id: 'w1',
                type: '@apostrophecms/layout-column',
                metaType: 'widget',
                desktop: {
                  colstart: 1,
                  colspan: 6
                },
                tablet: {},
                mobile: {}
              },
              {
                _id: 'w2',
                type: '@apostrophecms/rich-text',
                metaType: 'widget',
                desktop: { something: 'untouched' }
              }
            ]
          }
        }
      ]);

      const richText = results['test-non-col:en:published'].main.items[1];
      assert.deepEqual(richText.desktop, { something: 'untouched' });
    });

    it('migrates deeply nested areas in DB', async function () {
      const results = await setupAndRunMigration([
        {
          _id: 'test-nested:en:published',
          aposLocale: 'en:published',
          type: 'default-page',
          slug: '/test-nested',
          main: {
            _id: 'area1',
            metaType: 'area',
            items: [
              {
                _id: 'w-outer',
                type: '@apostrophecms/some-widget',
                metaType: 'widget',
                content: {
                  _id: 'area2',
                  metaType: 'area',
                  items: [
                    {
                      _id: 'w-inner',
                      type: '@apostrophecms/layout-column',
                      metaType: 'widget',
                      desktop: {
                        colstart: 3,
                        colspan: 2
                      },
                      tablet: { show: false },
                      mobile: { show: true }
                    }
                  ]
                }
              }
            ]
          }
        }
      ]);

      const inner = results['test-nested:en:published'].main.items[0].content.items[0];
      assert.equal(inner.colstart, 3);
      assert.equal(inner.colspan, 2);
      assert.equal(inner.showTablet, false);
      assert.equal(inner.showMobile, true);
      assert(inner.desktop);
    });

    it('is idempotent when run twice in DB', async function () {
      const oldDocs = [
        {
          _id: 'test-idempotent:en:published',
          aposLocale: 'en:published',
          type: 'default-page',
          slug: '/test-idempotent',
          main: {
            _id: 'area1',
            metaType: 'area',
            items: [
              {
                _id: 'w1',
                type: '@apostrophecms/layout-column',
                metaType: 'widget',
                desktop: {
                  colstart: 1,
                  colspan: 6
                },
                tablet: {},
                mobile: {}
              }
            ]
          }
        }
      ];

      // Boot and run migration once
      const firstResults = await setupAndRunMigration(oldDocs);
      const widgetAfterFirst = firstResults['test-idempotent:en:published'].main.items[0];
      assert.equal(widgetAfterFirst.colstart, 1);
      assert.equal(widgetAfterFirst.showTablet, true);

      // Remove migration record again and run a second time
      await apos.migration.db.deleteMany({
        _id: '@apostrophecms/layout-column-widget:flatten-column-schema'
      });
      const migration = apos.migration.migrations.find(
        m => m.name === '@apostrophecms/layout-column-widget:flatten-column-schema'
      );
      await apos.migration.runOne(migration);

      const doc = await apos.doc.db.findOne({ _id: 'test-idempotent:en:published' });
      const widget = doc.main.items[0];
      assert.equal(widget.colstart, 1);
      assert.equal(widget.colspan, 6);
      assert.equal(widget.rowstart, 1);
      assert.equal(widget.rowspan, 1);
      assert.equal(widget.showTablet, true);
      assert.equal(widget.showMobile, true);
      assert(widget.desktop);
    });

    it('migrates both base and extended column widgets in the same doc', async function () {
      const results = await setupAndRunMigration([
        {
          _id: 'test-both:en:published',
          aposLocale: 'en:published',
          type: 'default-page',
          slug: '/test-both',
          main: {
            _id: 'area1',
            metaType: 'area',
            items: [
              {
                _id: 'w-base',
                type: '@apostrophecms/layout-column',
                metaType: 'widget',
                desktop: {
                  colstart: 1,
                  colspan: 6
                },
                tablet: { show: false },
                mobile: { show: true }
              },
              {
                _id: 'w-ext',
                type: 'test-column',
                metaType: 'widget',
                desktop: {
                  colstart: 7,
                  colspan: 6
                },
                tablet: { show: true },
                mobile: { show: false }
              }
            ]
          }
        }
      ]);

      const baseWidget = results['test-both:en:published'].main.items[0];
      assert.equal(baseWidget.colstart, 1);
      assert.equal(baseWidget.colspan, 6);
      assert.equal(baseWidget.showTablet, false);
      assert.equal(baseWidget.showMobile, true);
      assert(baseWidget.desktop);

      const extWidget = results['test-both:en:published'].main.items[1];
      assert.equal(extWidget.colstart, 7);
      assert.equal(extWidget.colspan, 6);
      assert.equal(extWidget.showTablet, true);
      assert.equal(extWidget.showMobile, false);
      assert(extWidget.desktop);
    });

    it('migrates deeply nested extended column in DB', async function () {
      const results = await setupAndRunMigration([
        {
          _id: 'test-ext-nested:en:published',
          aposLocale: 'en:published',
          type: 'default-page',
          slug: '/test-ext-nested',
          main: {
            _id: 'area1',
            metaType: 'area',
            items: [
              {
                _id: 'w-outer',
                type: '@apostrophecms/some-widget',
                metaType: 'widget',
                content: {
                  _id: 'area2',
                  metaType: 'area',
                  items: [
                    {
                      _id: 'w-inner',
                      type: 'test-column',
                      metaType: 'widget',
                      desktop: {
                        colstart: 5,
                        colspan: 3
                      },
                      tablet: { show: false },
                      mobile: { show: true }
                    }
                  ]
                }
              }
            ]
          }
        }
      ]);

      const inner = results['test-ext-nested:en:published'].main.items[0].content.items[0];
      assert.equal(inner.colstart, 5);
      assert.equal(inner.colspan, 3);
      assert.equal(inner.showTablet, false);
      assert.equal(inner.showMobile, true);
      assert(inner.desktop);
    });
  });
});
