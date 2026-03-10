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

    it('converts old-schema widget to flat fields', function () {
      const doc = {
        type: 'default-page',
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
      };

      const changed = migrate(doc);
      const item = doc.main.items[0];

      assert.equal(changed, true);
      assert.equal(item.colstart, 1);
      assert.equal(item.colspan, 6);
      assert.equal(item.rowstart, 1);
      assert.equal(item.rowspan, 1);
      assert.equal(item.order, 0);
      assert.equal(item.justify, 'center');
      assert.equal(item.align, 'start');
      assert.equal(item.showTablet, false);
      assert.equal(item.showMobile, true);
      assert.equal(item.desktop, undefined);
      assert.equal(item.tablet, undefined);
      assert.equal(item.mobile, undefined);
    });

    it('does not change already-migrated widget (idempotency)', function () {
      const doc = {
        type: 'default-page',
        main: {
          _id: 'area1',
          metaType: 'area',
          items: [
            {
              _id: 'w1',
              type: '@apostrophecms/layout-column',
              metaType: 'widget',
              colstart: 1,
              colspan: 6,
              rowstart: 1,
              rowspan: 1,
              order: 0,
              justify: 'center',
              align: 'start',
              showTablet: true,
              showMobile: true
            }
          ]
        }
      };

      const changed = migrate(doc);
      assert.equal(changed, false);
    });

    it('applies defaults when optional fields are missing', function () {
      const doc = {
        type: 'default-page',
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
      };

      const changed = migrate(doc);
      const item = doc.main.items[0];

      assert.equal(changed, true);
      assert.equal(item.rowstart, 1);
      assert.equal(item.rowspan, 1);
      assert.equal(item.order, null);
      assert.equal(item.justify, null);
      assert.equal(item.align, null);
      assert.equal(item.showTablet, true);
      assert.equal(item.showMobile, true);
    });

    it('does not touch non-column widgets in the same area', function () {
      const doc = {
        type: 'default-page',
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
      };

      migrate(doc);

      const richText = doc.main.items[1];
      assert.deepEqual(richText.desktop, { something: 'untouched' });
    });

    it('migrates deeply nested areas', function () {
      const doc = {
        type: 'default-page',
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
      };

      const changed = migrate(doc);
      const inner = doc.main.items[0].content.items[0];

      assert.equal(changed, true);
      assert.equal(inner.colstart, 3);
      assert.equal(inner.colspan, 2);
      assert.equal(inner.showTablet, false);
      assert.equal(inner.desktop, undefined);
    });

    it('second run returns false (no double migration)', function () {
      const doc = {
        type: 'default-page',
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
      };

      migrate(doc);
      const secondRun = migrate(doc);
      assert.equal(secondRun, false);
    });

    it('migrates widget with colstart: null at root but desktop still present', function () {
      const doc = {
        type: 'default-page',
        main: {
          _id: 'area1',
          metaType: 'area',
          items: [
            {
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
            }
          ]
        }
      };

      const changed = migrate(doc);
      const item = doc.main.items[0];

      assert.equal(changed, true);
      assert.equal(item.colstart, 5);
      assert.equal(item.colspan, 3);
      assert.equal(item.showMobile, false);
      assert.equal(item.desktop, undefined);
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
  });
});
