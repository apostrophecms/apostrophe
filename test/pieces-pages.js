var assert = require('assert');
var _ = require('lodash');
var async = require('async');
var request = require('request');
var t = require('./testUtils');

var apos;

describe('Pieces Pages', function() {

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
          port: 7943
        },
        'events': {
          extend: 'apostrophe-pieces',
          name: 'event',
          label: 'Event',
          alias: 'events',
          sort: { title: 1 }
        },
        'events-pages': {
          extend: 'apostrophe-pieces-pages',
          name: 'events',
          label: 'Events',
          alias: 'eventsPages',
          perPage: 10
        },
        'apostrophe-pages': {
          park: [
            {
              title: 'Events',
              type: 'events',
              slug: '/events',
              published: true
            }
          ]
        }
      },
      afterListen: function(err) {
        assert(apos.modules['events-pages']);
        done();
      }
    });
  });

  it('should be able to use db to insert test pieces', function(done){
    var testItems = [];
    var total = 100;
    for (var i = 1; (i <= total); i++) {
      var paddedInt = apos.launder.padInteger(i, 3);

      testItems.push({
        _id: 'event' + paddedInt,
        slug: 'event-' + paddedInt,
        published: true,
        type: 'event',
        title: 'Event ' + paddedInt,
        titleSortified: 'event ' + paddedInt,
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

  it('should populate the ._url property of pieces in any docs query', function(done) {
    return apos.docs.find(t.req.anon(apos), { type: 'event', title: 'Event 001' }).toObject(function(err, piece) {
      assert(!err);
      assert(piece);
      assert(piece._url);
      assert(piece._url === '/events/event-001');
      done();
    });
  });

  it('should be able to access index page with first event on it, but not eleventh event', function(done) {

    return request('http://localhost:7943/events', function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Only page one events should show up
      assert(body.match(/event-001"/));
      assert(!body.match(/event-011"/));
      return done();
    });
  });

  it('should be able to access second page', function(done) {

    return request('http://localhost:7943/events?page=2', function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Only page two events should show up
      assert(body.match(/event-011"/));
      assert(!body.match(/event-001"/));
      return done();
    });
  });

  it('should be able to access "show" page for first event, should not also contain second event', function(done) {
    return request('http://localhost:7943/events/event-001', function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Only event 1's title should show up
      assert(body.match(/Event 001/));
      assert(!body.match(/Event 002/));
      return done();
    });
  });

});
