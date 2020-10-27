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
                    '@apostrophecms/login-logout',
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
      assert.strictEqual(apos.adminBar.items.length, 6);
      assert(apos.adminBar.items[3].name === '@apostrophecms/login-logout');
      assert(apos.adminBar.items[4].name === '@apostrophecms/file');
      assert(apos.adminBar.items[5].name === '@apostrophecms/image');
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
                    '@apostrophecms/image',
                    '@apostrophecms/login-logout'
                  ]
                }
              ]
            }
          }
        }
      });
      assert(apos.modules['@apostrophecms/admin-bar']);
      assert(apos.adminBar);
      assert(apos.adminBar.items.length === 6);
      assert(apos.adminBar.items[1].name === '@apostrophecms/file');
      assert(apos.adminBar.items[2].name === '@apostrophecms/image');
      assert(apos.adminBar.items[3].name === '@apostrophecms/login-logout');
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
});
