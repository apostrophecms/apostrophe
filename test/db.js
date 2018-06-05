var t = require('../test-lib/test.js');
var assert = require('assert');

var apos;

describe('Db', function() {

  this.timeout(t.timeout);

  it('should exist on the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',

      afterInit: function(callback) {
        assert(apos.db);
        // Verify a normal, boring connection to localhost without the db option worked
        return apos.docs.db.findOne().then(function(doc) {
          assert(doc);
          return done();
        }).catch(function(err) {
          console.error(err);
          assert(false);
        });
      }
    });
  });

  it('should be able to launch a second instance reusing the connection', function(done) {
    var apos2 = require('../index.js')({
      root: module,
      shortName: 'test2',
      modules: {
        'apostrophe-express': {
          port: 7777
        },
        'apostrophe-db': {
          db: apos.db,
          uri: 'mongodb://this-will-not-work-unless-db-successfully-overrides-it/fail'
        }
      },
      afterInit: function(callback) {
        return apos.docs.db.findOne().then(function(doc) {
          assert(doc);
          return t.destroy(apos2, function() {
            return t.destroy(apos, done);
          });
        }).catch(function(err) {
          console.error(err);
          assert(false);
        });
      }
    });
  });
});
