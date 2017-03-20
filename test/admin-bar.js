var assert = require('assert');
var _ = require('lodash');
var apos;

describe('Admin bar', function() {

  this.timeout(5000);

  after(function() {
    apos.db.dropDatabase();
  });

  //////
  // EXISTENCE
  //////

  it('should allow a group reversing the current order', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7954,
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
        assert(apos.adminBar.items.length === 7);
        assert(apos.adminBar.items[4].name === 'apostrophe-login-logout');
        assert(apos.adminBar.items[5].name === 'apostrophe-files');
        assert(apos.adminBar.items[6].name === 'apostrophe-images');
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      },
    });
  });

  it('should allow a group obeying the current order', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7955,
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
                'apostrophe-login-logout',
              ]
            }
          ]
        }
      },
      afterInit: function(callback) {
        assert(apos.modules['apostrophe-admin-bar']);
        assert(apos.adminBar);
        assert(apos.adminBar.items.length === 7);
        assert(apos.adminBar.items[4].name === 'apostrophe-files');
        assert(apos.adminBar.items[5].name === 'apostrophe-images');
        assert(apos.adminBar.items[6].name === 'apostrophe-login-logout');
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      },
    });
  });

});
