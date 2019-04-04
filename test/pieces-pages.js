var t = require('../test-lib/test.js');
var assert = require('assert');
var request = require('request');
var Promise = require('bluebird');
var apos;

describe('Pieces Pages', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  // EXISTENCE

  it('should initialize', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',

      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900
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
      afterInit: function(callback) {
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        assert(apos.modules['events-pages']);
        done();
      }
    });
  });

  it('should be able to use db to insert test pieces', function(done) {
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

    apos.docs.db.insert(testItems, function(err) {
      assert(!err);
      done();
    });
  });

  it('should populate the ._url property of pieces in any docs query', function(done) {
    return apos.docs.find(apos.tasks.getAnonReq(), { type: 'event', title: 'Event 001' }).toObject(function(err, piece) {
      assert(!err);
      assert(piece);
      assert(piece._url);
      assert(piece._url === '/events/event-001');
      done();
    });
  });

  it('should not correctly populate the ._url property of pieces in a docs query with an inadequate projection', function(done) {
    return apos.docs.find(apos.tasks.getAnonReq(), { type: 'event', title: 'Event 001' }, { type: 1 }).toObject(function(err, piece) {
      assert(!err);
      assert(piece);
      assert((!piece._url) || (piece._url.match(/undefined/)));
      done();
    });
  });

  it('should correctly populate the ._url property of pieces in a docs query if _url itself is "projected"', function(done) {
    return apos.docs.find(apos.tasks.getAnonReq(), { type: 'event', title: 'Event 001' }, { _url: 1 }).toObject(function(err, piece) {
      assert(!err);
      assert(piece);
      assert(piece._url);
      assert(piece._url === '/events/event-001');
      done();
    });
  });

  it('should be able to access index page with first event on it, but not eleventh event', function(done) {

    return request('http://localhost:7900/events', function(err, response, body) {
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

    return request('http://localhost:7900/events?page=2', function(err, response, body) {
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
    return request('http://localhost:7900/events/event-001', function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Only event 1's title should show up
      assert(body.match(/Event 001/));
      assert(!body.match(/Event 002/));
      return done();
    });
  });

  it('pieces-page as home page: switch page types', function() {
    return Promise.try(function() {
      return apos.docs.db.update({
        slug: '/'
      }, {
        $set: {
          type: 'events'
        }
      });
    }).then(function() {
      return apos.docs.db.update({
        slug: '/events'
      }, {
        $set: {
          type: 'default'
        }
      });
    });
  });

  it('pieces-page as home page: correct permalinks on index page', function(done) {
    return request('http://localhost:7900/', function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Only page one events should show up
      assert(body.match(/event-001"/));
      assert(!body.match(/event-011"/));
      assert(body.match(/"\/event-001"/));
      return done();
    });
  });
});
