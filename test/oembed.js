
var assert = require('assert');
var _ = require('lodash');
var async = require('async');
var request = require('request');
var qs = require('qs');
var apos;

describe('Oembed', function() {

  this.timeout(5000);

  after(function() {
    apos.db.dropDatabase();
  });

  //////
  // EXISTENCE
  //////

  it('should initialize', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7952,
          csrf: false
        }
      },
      afterInit: function(callback) {
        assert(apos.modules['apostrophe-oembed']);
        assert(apos.oembed);
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

  var youtube = 'https://www.youtube.com/watch?v=us00G8oILCM&feature=related';

  it('YouTube still has the video we like to use for testing', function(done) {
    return request(youtube, function(err, response, body) {
      assert(!err);
      assert(response.statusCode === 200);
      return done();
    });
  });

  it('Should deliver an oembed response for YouTube', function(done) {
    return request('http://localhost:7952/modules/apostrophe-oembed/query?' + qs.stringify(
    {
      url: youtube
    }), function(err, response, body) {
      assert(!err);
      assert(response.statusCode === 200);
      var data = JSON.parse(body);
      assert(data.type === 'video');
      return done();
    });
  });

});
