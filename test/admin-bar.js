var t = require('../test-lib/test.js');
var assert = require('assert');
var apos;

describe('Admin bar', function() {

  this.timeout(t.timeout);

  /// ///
  // EXISTENCE
  /// ///

  it('should allow a group reversing the current order', function(done) {
    this.timeout(10000);
    apos = require('../index.js')({
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
      },
      afterInit: function(callback) {
        assert(apos.modules['apostrophe-admin-bar']);
        assert(apos.adminBar);
        assert(apos.adminBar.items.length === 8);
        assert(apos.adminBar.items[5].name === 'apostrophe-login-logout');
        assert(apos.adminBar.items[6].name === 'apostrophe-files');
        assert(apos.adminBar.items[7].name === 'apostrophe-images');
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        return t.destroy(apos, done);
      }
    });
  });

  it('should allow a group obeying the current order', function(done) {
    this.timeout(10000);
    apos = require('../index.js')({
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
      },
      afterInit: function(callback) {
        assert(apos.modules['apostrophe-admin-bar']);
        assert(apos.adminBar);
        assert(apos.adminBar.items.length === 8);
        assert(apos.adminBar.items[5].name === 'apostrophe-files');
        assert(apos.adminBar.items[6].name === 'apostrophe-images');
        assert(apos.adminBar.items[7].name === 'apostrophe-login-logout');
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        return t.destroy(apos, done);
      }
    });
  });

});
