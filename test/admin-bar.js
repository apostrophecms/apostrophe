const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Admin bar', function () {

  this.timeout(t.timeout);

  /// ///
  // EXISTENCE
  /// ///

  it('should allow a group reversing the current order', async function () {
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

  it('should allow a group obeying the current order', async function () {
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

  it('should should not have a "global" admin menu item by default', async function () {
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

  it('should *should* have a "global" admin menu item with custom schema', async function () {
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

  it('should add custom bars and place the ones with `last: true` at the end', async function () {
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

  it('should respect the order array for positioning items', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/admin-bar': {
            options: {
              order: [
                '@apostrophecms/file',
                '@apostrophecms/image',
                '@apostrophecms/user'
              ]
            }
          }
        }
      });

      assert(apos.adminBar.items[0].name === '@apostrophecms/file');
      assert(apos.adminBar.items[1].name === '@apostrophecms/image');
      assert(apos.adminBar.items[2].name === '@apostrophecms/user');
    } finally {
      t.destroy(apos);
    }
  });

  it('should place unordered items after ordered items but before last items', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/admin-bar': {
            options: {
              order: ['@apostrophecms/user']
            }
          },
          // Add a module with last:true to test positioning
          'test-module': {
            init(self) {
              self.apos.adminBar.add('test-module', 'Test', null, { last: true });
            }
          }
        }
      });

      const userIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/user');
      const testIndex = apos.adminBar.items.findIndex(item => item.name === 'test-module');
      const imageIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/image');

      // user (ordered) should come first
      // image (unordered) should come after user but before test-module
      // test-module (last:true) should come last
      assert(userIndex < imageIndex);
      assert(imageIndex < testIndex);
    } finally {
      t.destroy(apos);
    }
  });

  it('should override last:true when item appears in order array', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/admin-bar': {
            options: {
              order: ['@apostrophecms/user', '@apostrophecms/image']
            }
          },
          'test-module': {
            init(self) {
              self.apos.adminBar.add('test-module', 'Test', null, { last: true });
            }
          }
        }
      });

      const userIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/user');
      const imageIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/image');
      const testIndex = apos.adminBar.items.findIndex(item => item.name === 'test-module');

      // Even if image had last:true, it should respect order position
      assert(userIndex === 0);
      assert(imageIndex === 1);
      // test-module should still be last since it's not in order
      assert(testIndex === apos.adminBar.items.length - 1);
    } finally {
      t.destroy(apos);
    }
  });

  it('should position groups based on leader placement in order array', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/admin-bar': {
            options: {
              order: ['@apostrophecms/image'],
              addGroups: [
                {
                  label: 'Media',
                  items: [
                    '@apostrophecms/image',
                    '@apostrophecms/file'
                  ]
                }
              ]
            }
          }
        }
      });

      const imageIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/image');
      const fileIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/file');

      // Image (group leader) should be positioned according to order
      assert(imageIndex === 0);
      // File should immediately follow its group leader
      assert(fileIndex === imageIndex + 1);
      // Both should have the same menuLeader
      assert(apos.adminBar.items[imageIndex].menuLeader === '@apostrophecms/image');
      assert(apos.adminBar.items[fileIndex].menuLeader === '@apostrophecms/image');
    } finally {
      t.destroy(apos);
    }
  });

  it('should handle items in order array that do not exist', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/admin-bar': {
            options: {
              order: [
                'non-existent-module',
                '@apostrophecms/user',
                'another-fake-module'
              ]
            }
          }
        }
      });

      // Should not crash and should still position existing items correctly
      const userIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/user');
      assert(userIndex === 0); // Should be first among existing ordered items
    } finally {
      t.destroy(apos);
    }
  });

  it('should handle empty order array', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/admin-bar': {
            options: {
              order: []
            }
          }
        }
      });

      // Should behave like no order option was provided
      // All items should be in their default positions
      assert(apos.adminBar.items.length > 0);
      // This test mainly ensures no crashes occur
    } finally {
      t.destroy(apos);
    }
  });

  it('should handle groups with leaders not in order array', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/admin-bar': {
            options: {
              order: ['@apostrophecms/user'], // user is ordered, but not the group leader
              addGroups: [
                {
                  label: 'Media',
                  items: [
                    '@apostrophecms/image', // group leader, not in order
                    '@apostrophecms/file'
                  ]
                }
              ]
            }
          }
        }
      });

      const userIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/user');
      const imageIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/image');
      const fileIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/file');

      // User should be first (ordered)
      assert(userIndex === 0);
      // Image and file should be grouped together but after ordered items
      assert(Math.abs(imageIndex - fileIndex) === 1);
      assert(imageIndex > userIndex);
      // Group should still be properly formed
      assert(apos.adminBar.items[imageIndex].menuLeader === '@apostrophecms/image');
      assert(apos.adminBar.items[fileIndex].menuLeader === '@apostrophecms/image');
    } finally {
      t.destroy(apos);
    }
  });
});
