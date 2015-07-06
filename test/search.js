var assert = require('assert');
var _ = require('lodash');
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

describe('Search', function() {
  //////
  // EXISTENCE
  //////

  it('should be a property of the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7945
        }
      },
      afterInit: function(callback) {
        assert(apos.search);
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        done();
      }
    });
  });

  it('should add highSearchText, highSearchWords, lowSearchText, searchSummary to all docs on insert', function(done){
    var req = adminReq();
    apos.docs.insert(req, {
      title: 'Testing Search Event',
      type: 'event',
      tags: ['search', 'test', 'pizza'],
      slug: 'search-test-event',
      published: true
    }, function(err){
      assert(!err);

      apos.docs.find(req, { slug: 'search-test-event' }).toObject(function(err, doc){
        assert(doc.highSearchText);
        assert(doc.highSearchWords);
        assert(doc.lowSearchText);
        assert(doc.searchSummary !== undefined);

        assert(doc.lowSearchText.match(/pizza/));
        assert(doc.highSearchText.match(/testing/));
        assert(_.contains(doc.highSearchWords, 'test', 'pizza', 'testing'));
        done();
      });

    });
  });

});
