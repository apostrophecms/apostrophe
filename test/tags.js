var assert = require('assert');
var _ = require('lodash');
var request = require('request');
var async = require('async');

var apos;

function anonReq() {
  return {
    res: {
      __: function(x) { return x; }
    },
    browserCall: apos.app.request.browserCall,
    getBrowserCalls: apos.app.request.getBrowserCalls,
    query: {}
  };
}

function adminReq() {
  return _.merge(anonReq(), {
    user: {
      _permissions: {
        admin: true
      }
    }
  });
}

describe('Tags', function() {
  it('should be a property of the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7946
        }
      },
      afterInit: function(callback) {
        assert(apos.tags);
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        done();
      }
    });
  });

  it('should insert some docs to test itself', function(done){
    var testDocs = [
      {
        title: 'Tag Test Doc 1',
        slug: '/tag-test-doc-1',
        published: true,
        tags: ['tag1', 'tag2', 'agressive']
      },
      {
        title: 'Tag Test Doc 2',
        slug: '/tag-test-doc-2',
        published: true,
        tags: ['tag3', 'tag4', 'pizza']
      },
      {
        title: 'Tag Test Doc Event',
        type: 'event',
        slug: 'tag-test-doc-event',
        published: true,
        tags: ['featured event']
      },
    ]

    return async.eachSeries(testDocs, function(doc, callback) {
      apos.docs.insert(adminReq(), doc, callback);
    }, function(err) {
      assert(!err);
      done();
    });
  });

  it('should have a get method that returns a list of tags', function(done){
    return apos.tags.get(adminReq(), {}, function(err, tags){
      assert(!err);
      assert(tags);
      assert(Array.isArray(tags));
      done();
    });
  });

  it('should have a prefix option on the get method that filters the tags', function(done){
    return apos.tags.get(adminReq(), { prefix: 'tag' }, function(err, tags){
      assert(!err);
      assert(_.contains(tags, 'tag1', 'tag2', 'tag3', 'tag4'));
      assert(!_.contains(tags, 'agressive'));
      done();
    });
  });

  it('should have a contains option on the get method that filters the tags', function(done){
    return apos.tags.get(adminReq(), { contains: 'ag' }, function(err, tags){
      assert(!err);
      assert(_.contains(tags, 'agressive', 'tag1', 'tag2', 'tag3', 'tag4'));
      done();
    });
  });

  it('should return an empty array if a prefix or contains option does not match', function(done){
    return apos.tags.get(adminReq(), { contains: '9046gobbledygook1678' }, function(err, tags){
      assert(!err);
      assert(tags.length === 0);
      done();
    });
  });

  it('should provide an api route for autocomplete', function(done){
    return request('http://localhost:7946/modules/apostrophe-tags/autocomplete?term=ag', function(err, response, body) {
      assert(!err);
      assert(body);
      body = JSON.parse(body);
      assert(Array.isArray(body));

      // make sure we don't have any results that didn't match our term.
      _.each(body, function(item) {
        assert(item.value !== 'pizza');
      });

      done();
    });
  });

  it('should provide an option to search by prefix in the autocomplete route', function(done){
    return request('http://localhost:7946/modules/apostrophe-tags/autocomplete?term=ag&prefix=true', function(err, response, body) {
      assert(!err);
      assert(body);

      body = JSON.parse(body);

      //make sure we don't have any results that didn't match our term.
      _.each(body, function(item) {
        assert(!item.value.match(/tag/));
      });

      done();
    });
  });

});
