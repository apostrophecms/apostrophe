var t = require('../test-lib/test.js');
var assert = require('assert');

var apos;

describe('Static i18n', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  it('should be a property of the apos object', function(done) {
    this.timeout(t.timeout);
    this.slow(2000);

    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      modules: {
        'apostrophe-express': {
          port: 7900
        },
        'apostrophe-i18n': {
          locales: [ 'en', 'es' ]
        },
        'apostrophe-pages': {
          park: [
            {
              slug: '/i18n',
              title: 'i18n',
              type: 'i18n',
              published: true
            }
          ]
        },
        'test': {
          alias: 'test',
          construct: function(self, options) {
            self.testsRun = 0;
            self.addHelpers({
              'verify': function(s1, s2) {
                self.testsRun++;
                if (s1 !== s2) {
                  throw 'i18n test failed: ' + s1 + ' versus ' + s2;
                }
              }
            });
          }
        }
      },
      afterInit: function(callback) {
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      }
    });
  });

  it('i18n helper tests', function() {
    var rp = require('request-promise');
    return rp('http://localhost:7900/i18n').then(function(page) {
      assert(page);
      assert(!page.match(/An error has occurred/));
      // The bulk of the tests are executed by template helpers,
      // just make sure that happened
      assert(apos.test.testsRun > 0);
    });
  });

});
