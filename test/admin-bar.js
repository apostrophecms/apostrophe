const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Admin bar', function() {

  this.timeout(t.timeout);

  /// ///
  // EXISTENCE
  /// ///

  it('should allow a group reversing the current order', async function() {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/admin-bar': {
            options: {
              addGroups: [
                {
                  label: 'Media',
                  items: [
                    '@apostrophecms/image',
                    '@apostrophecms/image-tag',
                    '@apostrophecms/file',
                    '@apostrophecms/file-tag'
                  ]
                },
                {
                  label: 'Content',
                  items: [
                    '@apostrophecms/file',
                    '@apostrophecms/image'
                  ]
                }
              ]
            }
          }
        }
      });
      assert(apos.modules['@apostrophecms/admin-bar']);
      assert(apos.adminBar);
      assert.strictEqual(apos.adminBar.items.length, 7);
      assert(apos.adminBar.items[2].name === '@apostrophecms/file');
      assert(apos.adminBar.items[3].name === '@apostrophecms/image');
    } finally {
      t.destroy(apos);
    }
  });

  it('should allow a group obeying the current order', async function() {
    let apos;
    try {
      apos = await t.create({
        modules: {
          '@apostrophecms/admin-bar': {
            options: {
              addGroups: [
                {
                  label: 'Media',
                  items: [
                    '@apostrophecms/image',
                    '@apostrophecms/file'
                  ]
                },
                {
                  label: 'Content',
                  items: [
                    '@apostrophecms/file',
                    '@apostrophecms/image'
                  ]
                }
              ]
            }
          }
        }
      });
      assert(apos.modules['@apostrophecms/admin-bar']);
      assert(apos.adminBar);
      assert(apos.adminBar.items.length === 7);
      assert(apos.adminBar.items[1].name === '@apostrophecms/file');
      assert(apos.adminBar.items[2].name === '@apostrophecms/image');
    } finally {
      t.destroy(apos);
    }
  });

  it('should should not have a "global" admin menu item by default', async function() {
    let apos;
    try {
      apos = await t.create({
        root: module
      });
      assert(apos.modules['@apostrophecms/admin-bar']);
      assert(apos.adminBar);
      assert(apos.adminBar.items.findIndex(i => i.name === '@apostrophecms/global') === -1);
    } finally {
      t.destroy(apos);
    }
  });

  it('should *should* have a "global" admin menu item with custom schema', async function() {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/global': {
            fields: {
              add: {
                someField: { type: 'string' }
              }
            }
          }
        }
      });
      assert(apos.modules['@apostrophecms/admin-bar']);
      assert(apos.adminBar);
      assert(apos.adminBar.items.findIndex(i => i.name === '@apostrophecms/global') > -1);
    } finally {
      t.destroy(apos);
    }
  });

  it('should add custom bars and place the ones with `last: true` at the end', async function() {
    let apos;
    try {
      apos = await t.create({
        root: module
      });

      apos.adminBar.addBar({
        id: 'bar1',
        componentName: 'Bar1'
      });
      apos.adminBar.addBar({
        id: 'bar2',
        componentName: 'Bar2',
        last: true
      });
      apos.adminBar.addBar({
        id: 'bar3',
        componentName: 'Bar3'
      });

      const expected = [
        {
          id: 'bar1',
          componentName: 'Bar1'
        },
        {
          id: 'bar3',
          componentName: 'Bar3'
        },
        {
          id: 'bar2',
          componentName: 'Bar2',
          last: true
        }
      ];

      assert.deepEqual(apos.adminBar.bars, expected);
    } finally {
      t.destroy(apos);
    }
  });
});
