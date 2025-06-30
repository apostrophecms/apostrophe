const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Admin bar', function () {

  this.timeout(t.timeout);

  /// ///
  // EXISTENCE
  /// ///

  it('should allow groups to appear in definition order', async function () {
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

      // With the fix, Media group (first defined) should appear first
      // So @apostrophecms/image (Media group leader) should come before @apostrophecms/file
      const imageIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/image');
      const fileIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/file');

      assert(imageIndex !== -1, '@apostrophecms/image should be found');
      assert(fileIndex !== -1, '@apostrophecms/file should be found');
      assert(imageIndex < fileIndex, 'Media group (@apostrophecms/image leader) should appear before Content group');

      // Group members should be consolidated
      const imageTagIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/image-tag');
      const fileTagIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/file-tag');

      // Media group members should be together
      assert(imageTagIndex === imageIndex + 1 || imageTagIndex === imageIndex + 2,
        '@apostrophecms/image-tag should follow @apostrophecms/image in Media group');
    } finally {
      t.destroy(apos);
    }
  });

  it('should respect explicit order when provided', async function () {
    let apos;
    try {
      apos = await t.create({
        modules: {
          '@apostrophecms/admin-bar': {
            options: {
              order: ['@apostrophecms/file', '@apostrophecms/image'],
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

      // With explicit order, @apostrophecms/file should come first
      const fileIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/file');
      const imageIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/image');

      assert(fileIndex !== -1, '@apostrophecms/file should be found');
      assert(imageIndex !== -1, '@apostrophecms/image should be found');
      assert(fileIndex < imageIndex, '@apostrophecms/file should come before @apostrophecms/image per explicit order');

      // They should still be grouped together
      assert(imageIndex === fileIndex + 1, 'Group members should be consecutive');
    } finally {
      t.destroy(apos);
    }
  });

  it('should handle last: true items correctly with explicit order', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/admin-bar': {
            init(self) {
              // Add a test item with last: true
              self.add('test-last-item', 'Test Last', null, { last: true });
              self.add('test-regular-item', 'Test Regular', null, {});
            },
            options: {
              order: ['test-last-item', '@apostrophecms/page'] // Explicit order should override last: true
            }
          }
        }
      });

      const lastItemIndex = apos.adminBar.items.findIndex(item => item.name === 'test-last-item');
      const regularItemIndex = apos.adminBar.items.findIndex(item => item.name === 'test-regular-item');

      assert(lastItemIndex !== -1, 'test-last-item should be found');
      assert(regularItemIndex !== -1, 'test-regular-item should be found');

      // Explicit order should override last: true, so test-last-item should come first
      assert(lastItemIndex < regularItemIndex, 'Explicit order should override last: true option');

      // test-last-item should be in position 0 (first in order array)
      assert(lastItemIndex === 0, 'test-last-item should be first due to explicit order');
    } finally {
      t.destroy(apos);
    }
  });

  it('should place last: true items at end when not in explicit order', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/admin-bar': {
            init(self) {
              self.add('test-last-item', 'Test Last', null, { last: true });
              self.add('test-regular-item', 'Test Regular', null, {});
            }
            // No explicit order - last: true should work normally
          }
        }
      });

      const lastItemIndex = apos.adminBar.items.findIndex(item => item.name === 'test-last-item');
      const regularItemIndex = apos.adminBar.items.findIndex(item => item.name === 'test-regular-item');

      assert(lastItemIndex !== -1, 'test-last-item should be found');
      assert(regularItemIndex !== -1, 'test-regular-item should be found');

      // Without explicit order, last: true should put item at end
      assert(lastItemIndex > regularItemIndex, 'last: true item should appear after regular items');
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

  it('should handle complex scenario with order, groups, and last items', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/admin-bar': {
            init(self) {
              self.add('article', 'Article', null, {});
              self.add('topic', 'Topic', null, {});
              self.add('settings', 'Settings', null, { last: true });
              self.add('help', 'Help', null, { last: true });
            },
            options: {
              order: ['@apostrophecms/user', 'topic'],
              addGroups: [
                {
                  label: 'Content',
                  items: ['article', 'topic']
                }
              ]
            }
          }
        }
      });

      const items = apos.adminBar.items;
      const getIndex = (name) => items.findIndex(item => item.name === name);

      const userIndex = getIndex('@apostrophecms/user');
      const topicIndex = getIndex('topic');
      const articleIndex = getIndex('article');
      const settingsIndex = getIndex('settings');
      const helpIndex = getIndex('help');

      // Verify explicit order is respected
      assert(userIndex < topicIndex, '@apostrophecms/user should come before topic (explicit order)');

      // Verify grouping works
      assert(Math.abs(topicIndex - articleIndex) === 1, 'topic and article should be adjacent (grouped)');

      // Verify last items are at the end
      assert(settingsIndex > topicIndex && settingsIndex > articleIndex, 'settings should be after content items');
      assert(helpIndex > topicIndex && helpIndex > articleIndex, 'help should be after content items');
      assert(settingsIndex < items.length && helpIndex < items.length, 'last items should be present');
    } finally {
      t.destroy(apos);
    }
  });
  // Add this debug version to your test file to see what's happening

  it('should allow groups to appear in definition order - DEBUG', async function () {
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

      // DEBUG: Print all items and their positions
      console.log('\n=== DEBUG: All admin bar items ===');
      apos.adminBar.items.forEach((item, index) => {
        const flags = [];
        if (item.options && item.options.last) flags.push('LAST');
        if (item.menuLeader && item.menuLeader !== item.name) flags.push(`GROUP:${item.menuLeader}`);
        if (item.menuLeader === item.name) flags.push('GROUP_LEADER');

        console.log(`  ${index}. ${item.name}${flags.length ? ` [${flags.join(', ')}]` : ''}`);
      });

      // DEBUG: Print group labels
      console.log('\nGroup labels:', apos.adminBar.groupLabels);

      // DEBUG: Check what groups were actually processed
      const groups = apos.adminBar.options.groups ||
        apos.adminBar.groups.concat(apos.adminBar.options.addGroups || []);
      console.log('\nGroups configuration:');
      groups.forEach((group, index) => {
        console.log(`  ${index}. "${group.label}": [${group.items.join(', ')}]`);
      });

      const imageIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/image');
      const fileIndex = apos.adminBar.items.findIndex(item => item.name === '@apostrophecms/file');

      console.log(`\n@apostrophecms/image at index: ${imageIndex}`);
      console.log(`@apostrophecms/file at index: ${fileIndex}`);
      console.log(`Image comes before file? ${imageIndex < fileIndex}`);

      assert(apos.modules['@apostrophecms/admin-bar']);
      assert(apos.adminBar);

      // Temporarily comment out the failing assertion to see the debug output
      // assert(imageIndex < fileIndex, 'Media group (@apostrophecms/image leader) should appear before Content group');

    } catch (error) {
      console.error('Test error:', error);
      throw error;
    } finally {
      if (apos) {
        t.destroy(apos);
      }
    }
  });

  // Also add this test to check if our improved orderItems method is even being used
  it('should use improved orderItems method - DEBUG', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/admin-bar': {
            init(self) {
              // Override to add debug logging
              const originalOrderItems = self.orderItems;
              self.orderItems = function () {
                console.log('\n=== DEBUG: orderItems called ===');
                console.log('Items before ordering:', self.items.map(item => item.name));
                console.log('Order configuration:', self.options.order);

                const result = originalOrderItems.call(this);

                console.log('Items after ordering:', self.items.map(item => item.name));
                console.log('=================================\n');

                return result;
              };

              const originalGroupItems = self.groupItems;
              self.groupItems = function () {
                console.log('\n=== DEBUG: groupItems called ===');
                console.log('Items before grouping:', self.items.map(item => item.name));

                const result = originalGroupItems.call(this);

                console.log('Items after grouping:', self.items.map(item => item.name));
                console.log('================================\n');

                return result;
              };
            },
            options: {
              addGroups: [
                {
                  label: 'Test Group',
                  items: ['@apostrophecms/image', '@apostrophecms/file']
                }
              ]
            }
          }
        }
      });

      // Just verify it runs
      assert(apos.adminBar);

    } catch (error) {
      console.error('Test error:', error);
      throw error;
    } finally {
      if (apos) {
        t.destroy(apos);
      }
    }
  });

});
