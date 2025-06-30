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
                    '@apostrophecms/image-tag'
                  ]
                },
                {
                  label: 'Content',
                  items: [
                    '@apostrophecms/file',
                    '@apostrophecms/file-tag'
                  ]
                }
              ]
            }
          }
        }
      });

      assert(apos.modules['@apostrophecms/admin-bar']);
      assert(apos.adminBar);

      // Find the first item belonging to each group
      const findFirstGroupItem = (groupLabel) => {
        return apos.adminBar.items.find(item => {
          // Check if this item is a group leader for this group
          if (apos.adminBar.groupLabels[item.name] === groupLabel) {
            return true;
          }
          // Check if this item belongs to a leader of this group
          if (item.menuLeader && apos.adminBar.groupLabels[item.menuLeader] === groupLabel) {
            return true;
          }
          return false;
        });
      };

      const firstMediaItem = findFirstGroupItem('Media');
      const firstContentItem = findFirstGroupItem('Content');

      assert(firstMediaItem, 'Should find at least one Media group item');
      assert(firstContentItem, 'Should find at least one Content group item');

      const mediaGroupIndex = apos.adminBar.items.indexOf(firstMediaItem);
      const contentGroupIndex = apos.adminBar.items.indexOf(firstContentItem);

      assert(mediaGroupIndex < contentGroupIndex,
        'Media group (defined first) should appear before Content group (defined second) in the admin bar');

      // Verify the groups actually exist and have correct labels
      assert.strictEqual(apos.adminBar.groupLabels['@apostrophecms/image'], 'Media');
      assert.strictEqual(apos.adminBar.groupLabels['@apostrophecms/file'], 'Content');

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

});
