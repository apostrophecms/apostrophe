var t = require('../test-lib/test.js');
var assert = require('assert');
var request = require('request');

var apos;

describe('Soft Redirects', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  it('should exist', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',

      modules: {
        'apostrophe-express': {
          port: 7900,
          secret: 'test'
        },
        'apostrophe-pages': {
          park: [
            {
              parkedId: 'child',
              title: 'Child',
              slug: '/child',
              type: 'default',
              published: true
            }
          ]
        }
      },
      afterInit: function(callback) {
        assert(apos.modules['apostrophe-soft-redirects']);
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      }
    });
  });

  it('should be able to serve the /child page (which also populates historicUrls)', function(done) {
    return request('http://localhost:7900/child', function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Did we get our page back?
      assert(body.match(/Default Page Template/));
      return done();
    });
  });

  it('should be able to change the URL via db', function() {
    return apos.docs.db.update({ slug: '/child' }, { $set: { slug: '/child-moved' } });
  });

  it('should be able to serve the page at its new URL', function(done) {
    return request('http://localhost:7900/child-moved', function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Did we get our page back?
      assert(body.match(/Default Page Template/));
      return done();
    });
  });

  it('should be able to serve the page at its old URL too, via redirect', function(done) {
    return request({
      url: 'http://localhost:7900/child',
      followRedirect: response => {
        assert.equal(response.statusCode, 301);

        return true;
      }
    }, function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Did we get our page back?
      assert(body.match(/Default Page Template/));
      return done();
    });
  });

});
