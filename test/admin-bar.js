const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Admin bar', function () {

  this.timeout(t.timeout);

  /// ///
  // EXISTENCE
  /// ///

  it('should respect `last` and `after` options when no groups or order specified', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          'test-natural-options': {
            init(self) {
              self.apos.adminBar.add('normal-item', 'Normal Item', null);
              self.apos.adminBar.add('last-item', 'Last Item', null, { last: true });
              self.apos.adminBar.add('after-item', 'After Item', null, { after: 'normal-item' });
            }
          }
          // No groups or order - let last/after work naturally
        }
      });

      const normalIndex = apos.adminBar.items.findIndex(item => item.name === 'normal-item');
      const afterIndex = apos.adminBar.items.findIndex(item => item.name === 'after-item');
      const lastIndex = apos.adminBar.items.findIndex(item => item.name === 'last-item');

      // When no higher-priority options, last/after should work
      assert(afterIndex === normalIndex + 1, 'After item should immediately follow target');
      assert(lastIndex === apos.adminBar.items.length - 1, 'Last item should be at the end');
    } finally {
      t.destroy(apos);
    }
  });

  it('should create groups with proper menuLeader assignment', async function () {
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
                    '@apostrophecms/file'
                  ]
                }
              ]
            }
          }
        }
      });

      assert(apos.modules['@apostrophecms/admin-bar']);
      assert(apos.adminBar);

      const imageItem = apos.adminBar.items.find(item => item.name === '@apostrophecms/image');
      const fileItem = apos.adminBar.items.find(item => item.name === '@apostrophecms/file');

      // Both items should have the same menuLeader (the first item in the group)
      assert(imageItem.menuLeader === '@apostrophecms/image');
      assert(fileItem.menuLeader === '@apostrophecms/image');

      // Group label should be stored
      assert(apos.adminBar.groupLabels['@apostrophecms/image'] === 'Media');

      // Items should be consecutive
      const imageIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/image');
      const fileIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/file');
      assert(Math.abs(imageIndex - fileIndex) === 1);
    } finally {
      t.destroy(apos);
    }
  });

  it('should handle duplicates in multi-item groups correctly', async function () {
    let apos;
    const warnings = [];

    try {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/admin-bar': {
            options: {
              addGroups: [
                {
                  label: 'Media Group',
                  items: [
                    '@apostrophecms/image',
                    '@apostrophecms/file'
                  ]
                },
                {
                  label: 'Content Group',
                  items: [
                    '@apostrophecms/file', // Duplicate!
                    '@apostrophecms/user',
                    '@apostrophecms/image-tag'
                  ]
                }
              ]
            }
          }
        }
      });

      // Mock warn function
      const originalWarn = apos.util.warn;
      apos.util.warn = (...args) => {
        warnings.push(args.join(' '));
        originalWarn.apply(apos.util, args);
      };

      apos.adminBar.orderItems();
      apos.adminBar.groupItems();
      apos.util.warn = originalWarn;

      // Should warn about duplicate
      const duplicateWarning = warnings.find(w =>
        w.includes('@apostrophecms/file') && w.includes('multiple groups')
      );
      assert(duplicateWarning, 'Should warn about duplicate item');

      // File should be in first group only
      const fileItem = apos.adminBar.items.find(item => item.name === '@apostrophecms/file');
      assert(fileItem.menuLeader === '@apostrophecms/image', 'File should be in Media Group');

      // Second group should still exist with user as leader (since file was skipped)
      const userItem = apos.adminBar.items.find(item => item.name === '@apostrophecms/user');
      const imageTagItem = apos.adminBar.items.find(item => item.name === '@apostrophecms/image-tag');

      if (userItem && imageTagItem) {
        // Both remaining items should be grouped together
        assert(userItem.menuLeader === '@apostrophecms/user', 'User should be leader of Content Group');
        assert(imageTagItem.menuLeader === '@apostrophecms/user', 'Image-tag should be in Content Group');

        // They should be consecutive
        const userIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/user');
        const imageTagIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/image-tag');
        assert(Math.abs(userIndex - imageTagIndex) === 1, 'Content Group items should be consecutive');
      }

    } finally {
      t.destroy(apos);
    }
  });

  it('should handle groups in registration order without explicit order', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/admin-bar': {
            options: {
              addGroups: [
                {
                  label: 'Alpha Group',
                  items: [ '@apostrophecms/image-tag', '@apostrophecms/file-tag' ]
                },
                {
                  label: 'Beta Group',
                  items: [ '@apostrophecms/image', '@apostrophecms/file' ]
                }
              ]
            }
          }
        }
      });

      const iTagIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/image-tag');
      const fTagIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/file-tag');
      const imageIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/image');
      const fileIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/file');
      // Alpha group should come first in registration order
      assert(iTagIndex < imageIndex, 'First registered group should appear first');
      assert(fTagIndex < imageIndex, 'First registered group should appear first');

      // Groups should be internally ordered and contiguous

      assert(fTagIndex === iTagIndex + 1, 'First group should be contiguous');
      assert(fileIndex === imageIndex + 1, 'Second group should be contiguous');
    } finally {
      t.destroy(apos);
    }
  });

  it('should prioritize groups over individual `last` and `after` options', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          'test-precedence': {
            init(self) {
              self.apos.adminBar.add('item-a', 'Item A', null);
              self.apos.adminBar.add('item-b', 'Item B', null, { last: true });
              self.apos.adminBar.add('item-c', 'Item C', null, { after: '@apostrophecms/user' });
            }
          },
          '@apostrophecms/admin-bar': {
            options: {
              addGroups: [
                {
                  label: 'Test Group',
                  items: [ 'item-a', 'item-b', 'item-c' ] // All grouped despite last/after
                }
              ]
            }
          }
        }
      });

      const itemAIndex = apos.adminBar.items.findIndex(item => item.name === 'item-a');
      const itemBIndex = apos.adminBar.items.findIndex(item => item.name === 'item-b');
      const itemCIndex = apos.adminBar.items.findIndex(item => item.name === 'item-c');

      // All items should be grouped together, ignoring last/after
      assert(Math.abs(itemAIndex - itemBIndex) <= 2, 'Items should be grouped despite last option');
      assert(Math.abs(itemAIndex - itemCIndex) <= 2, 'Items should be grouped despite after option');
      assert(Math.abs(itemBIndex - itemCIndex) <= 2, 'Items should be grouped despite individual options');

      // All should have the same menuLeader
      assert(apos.adminBar.items[itemAIndex].menuLeader === 'item-a');
      assert(apos.adminBar.items[itemBIndex].menuLeader === 'item-a');
      assert(apos.adminBar.items[itemCIndex].menuLeader === 'item-a');
    } finally {
      t.destroy(apos);
    }
  });

  it('should prioritize order array over individual `last` and `after` options', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          'test-order-precedence': {
            init(self) {
              self.apos.adminBar.add('item-x', 'Item X', null, { last: true });
              self.apos.adminBar.add('item-y', 'Item Y', null, { after: '@apostrophecms/file' });
            }
          },
          '@apostrophecms/admin-bar': {
            options: {
              order: [ 'item-x', '@apostrophecms/user', 'item-y', '@apostrophecms/image' ]
            }
          }
        }
      });

      const itemXIndex = apos.adminBar.items.findIndex(item => item.name === 'item-x');
      const userIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/user');
      const itemYIndex = apos.adminBar.items.findIndex(item => item.name === 'item-y');
      const imageIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/image');

      // Should follow order array, ignoring last/after
      assert(itemXIndex === 0, 'item-x should be first per order array, not last');
      assert(userIndex === 1, 'user should be second per order array');
      assert(itemYIndex === 2, 'item-y should be third per order array, not after file');
      assert(imageIndex === 3, 'image should be fourth per order array');
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
              order: [ '@apostrophecms/user' ]
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

  it('should prioritize order array over individual `last` and `after` options', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          'test-order-precedence': {
            init(self) {
              self.apos.adminBar.add('item-x', 'Item X', null, { last: true });
              self.apos.adminBar.add('item-y', 'Item Y', null, { after: '@apostrophecms/file' });
            }
          },
          '@apostrophecms/admin-bar': {
            options: {
              order: [ 'item-x', '@apostrophecms/user', 'item-y', '@apostrophecms/image' ]
            }
          }
        }
      });

      const itemXIndex = apos.adminBar.items.findIndex(item => item.name === 'item-x');
      const userIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/user');
      const itemYIndex = apos.adminBar.items.findIndex(item => item.name === 'item-y');
      const imageIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/image');

      // Should follow order array, ignoring last/after
      assert(itemXIndex === 0, 'item-x should be first per order array, not last');
      assert(userIndex === 1, 'user should be second per order array');
      assert(itemYIndex === 2, 'item-y should be third per order array, not after file');
      assert(imageIndex === 3, 'image should be fourth per order array');
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
              order: [ '@apostrophecms/image' ],
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
              order: [ '@apostrophecms/user' ], // user is ordered, but not the group leader
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
