var assert = require('assert');
var _ = require('lodash');
var async = require('async');
var request = require('request');

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
      permissions: {
        admin: true
      }
    }
  });
}

describe('pieces-pages', function() {
  //////
  // EXISTENCE
  //////

  it('should initialize', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7942
        },
        'events': {
          extend: 'apostrophe-pieces',
          name: 'event',
          label: 'Event',
          alias: 'events'
        },
        'events-pages': {
          extend: 'apostrophe-pieces-pages',
          name: 'events',
          label: 'Events',
          alias: 'eventsPages',
          perPage: 10
        }
      },
      afterListen: function(err) {
        done();
      }
    });
  });

  it('should be able to use db to insert test pieces', function(done){
    var testItems = [];
    var total = 100;
    for (var i = 1; (i <= total); i++) {
      testItems.push({
        _id: 'event' + i,
        slug: 'event-' + i,
        published: true,
        type: 'event',
        title: 'Event ' + i,
        body: {
          type: 'area',
          items: [
            {
              type: 'apostrophe-rich-text',
              content: '<p>This is some content.</p>'
            }
          ]
        }
      });
    }

    apos.docs.db.insert(testItems, function(err){
      assert(!err);
      done();
    });
  });

  it('should be able to access index page with first event on it, but not eleventh event', function(done) {

    return request('http://localhost:7942/events', function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Only page one events should show up
      assert(body.match(/event-1"/));
      assert(!body.match(/event-11"/));
      return done();
    });
  });

  it('should be able to access index page with first event on it, but not eleventh event', function(done) {

    return request('http://localhost:7942/events?page=2', function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Only page two events should show up
      assert(body.match(/event-11"/));
      assert(!body.match(/event-1"/));
      return done();
    });
  });

  it('should be able to access "show" page for first event, should not also contain second event', function(done) {
    return request('http://localhost:7942/events/event-1', function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Only event 1's title should show up
      assert(body.match(/Event 1/));
      assert(!body.match(/Event 2/));
      return done();
    });
  });

});
