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
      apos = await require('../index.js')({
        root: module,
        shortName: 'test',
        argv: {
          _: []
        },
        modules: {
          'apostrophe-admin-bar': {
            options: {
              addGroups: [
                {
                  label: 'Media',
                  items: [
                    'apostrophe-images',
                    'apostrophe-files'
                  ]
                },
                {
                  label: 'Content',
                  items: [
                    'apostrophe-login-logout',
                    'apostrophe-files',
                    'apostrophe-images'
                  ]
                }
              ]
            }
          }
        }
      });
      assert(apos.modules['apostrophe-admin-bar']);
      assert(apos.adminBar);
      console.log(JSON.stringify(apos.adminBar.items, null, '  '));
      assert(apos.adminBar.items.length === 8);
      assert(apos.adminBar.items[5].name === 'apostrophe-login-logout');
      assert(apos.adminBar.items[6].name === 'apostrophe-files');
      assert(apos.adminBar.items[7].name === 'apostrophe-images');
    } finally {
      t.destroy(apos);
    }
  });

  it('should allow a group obeying the current order', async function() {
    let apos;
    try {
      apos = await require('../index.js')({
        root: module,
        shortName: 'test',
        argv: {
          _: []
        },
        modules: {
          'apostrophe-express': {
            secret: 'xxx',
            csrf: false
          },
          'apostrophe-admin-bar': {
            options: {
              addGroups: [
                {
                  label: 'Media',
                  items: [
                    'apostrophe-images',
                    'apostrophe-files'
                  ]
                },
                {
                  label: 'Content',
                  items: [
                    'apostrophe-files',
                    'apostrophe-images',
                    'apostrophe-login-logout'
                  ]
                }
              ]
            }
          }
        }
      });
      assert(apos.modules['apostrophe-admin-bar']);
      assert(apos.adminBar);
      assert(apos.adminBar.items.length === 8);
      assert(apos.adminBar.items[5].name === 'apostrophe-files');
      assert(apos.adminBar.items[6].name === 'apostrophe-images');
      assert(apos.adminBar.items[7].name === 'apostrophe-login-logout');
    } finally {
      t.destroy(apos);
    }
  });
});
