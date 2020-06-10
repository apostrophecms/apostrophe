let t = require('../test-lib/test.js');
let assert = require('assert');

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
                    '@apostrophecms/images',
                    '@apostrophecms/files'
                  ]
                },
                {
                  label: 'Content',
                  items: [
                    '@apostrophecms/login-logout',
                    '@apostrophecms/files',
                    '@apostrophecms/images'
                  ]
                }
              ]
            }
          }
        }
      });
      assert(apos.modules['@apostrophecms/admin-bar']);
      assert(apos.adminBar);
      assert.equal(apos.adminBar.items.length, 7);
      assert(apos.adminBar.items[4].name === '@apostrophecms/login-logout');
      assert(apos.adminBar.items[5].name === '@apostrophecms/files');
      assert(apos.adminBar.items[6].name === '@apostrophecms/images');
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
                    '@apostrophecms/images',
                    '@apostrophecms/files'
                  ]
                },
                {
                  label: 'Content',
                  items: [
                    '@apostrophecms/files',
                    '@apostrophecms/images',
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
      assert(apos.adminBar.items.length === 7);
      assert(apos.adminBar.items[4].name === '@apostrophecms/files');
      assert(apos.adminBar.items[5].name === '@apostrophecms/images');
      assert(apos.adminBar.items[6].name === '@apostrophecms/login-logout');
    } finally {
      t.destroy(apos);
    }
  });
});
