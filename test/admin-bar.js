let t = require('../test-lib/test.js');
let assert = require('assert');
let apos;

describe('Admin bar', function() {

  this.timeout(t.timeout);

  /// ///
  // EXISTENCE
  /// ///

  it('should allow a group reversing the current order', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',

      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900,
          csrf: false
        },
        'apostrophe-admin-bar': {
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
    });
    assert(apos.modules['apostrophe-admin-bar']);
    assert(apos.adminBar);
    assert(apos.adminBar.items.length === 8);
    assert(apos.adminBar.items[5].name === 'apostrophe-login-logout');
    assert(apos.adminBar.items[6].name === 'apostrophe-files');
    assert(apos.adminBar.items[7].name === 'apostrophe-images');
    await t.destroy(apos);
  });

  it('should allow a group obeying the current order', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',

      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900,
          csrf: false
        },
        'apostrophe-admin-bar': {
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
    });
    assert(apos.modules['apostrophe-admin-bar']);
    assert(apos.adminBar);
    assert(apos.adminBar.items.length === 8);
    assert(apos.adminBar.items[5].name === 'apostrophe-files');
    assert(apos.adminBar.items[6].name === 'apostrophe-images');
    assert(apos.adminBar.items[7].name === 'apostrophe-login-logout');
    await t.destroy(apos);
  });

});
