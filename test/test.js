var assert = require('assert');
var mongo = require('mongodb');
var apos = require('../apostrophe.js')();

var db;

var req = {};
var res = {};

describe('apostrophe', function() {
  describe('initialize resources', function() {
    it('initialize mongodb', function(done) {
      db = new mongo.Db(
        'apostest',
        new mongo.Server('127.0.0.1', 27017, {}),
        // Sensible default of safe: true
        // (soon to be the driver's default)
        { safe: true }
      );
      assert(!!db);
      db.open(function(err) {
        assert(!err);
        return done();
      });
    });
    it('initialize apostrophe', function(done) {
      return apos.init({
        db: db,
        app: {
          request: {},
          locals: {},
          get: function() {},
          post: function() {}
        }
      }, function(err) {
        assert(!err);
        return done();
      });
    });
  });
  describe('test apos.build', function() {
    it('returns a URL unmodified', function(done) {
      assert(apos.build('/events') === '/events');
      return done();
    });
    it('adds a single parameter to a queryless URL', function(done) {
      assert(apos.build('/events', { tag: 'blue' }) === '/events?tag=blue');
      return done();
    });
    it('appends a parameter to a URL with a query', function(done) {
      // TODO this test is currently rather "this week's v8" specific, probably, in that the
      // order of the parameters is not guaranteed; other orderings would be acceptable too
      assert(apos.build('/events?page=5', { tag: 'blue' }) === '/events?tag=blue&page=5');
      return done();
    });
    it('replaces parameters in the URL', function(done) {
      assert(apos.build('/events?tag=blue', { tag: 'red' }) === '/events?tag=red');
      return done();
    });
    it('removes parameters', function(done) {
      assert(apos.build('/events?tag=blue', { tag: null }) === '/events');
      return done();
    });
    it('correctly allows the last data object to win', function(done) {
      assert(apos.build('/events', { tag: 'red' }, { tag: 'blue' }) === '/events?tag=blue');
      return done();
    });
    it('places path properties in the path', function(done) {
      assert(apos.build('/events', [ 'year', 'month' ], { year: '2013', month: '05', tag: 'red' }) === '/events/2013/05?tag=red');
      return done();
    });
    it('switches to placing path properties in the query if it encounters a non-slugify-compliant property', function(done) {
      assert(apos.build('/events', [ 'year', 'month' ], { year: '2013!@#@', month: '05', tag: 'red' }) === '/events?year=2013!%40%23%40&month=05&tag=red');
      return done();
    });
    it('does the right thing for a case that crashed once', function(done) {
      assert(apos.build("/events", ["year","month"], {}, {}) === '/events');
      return done();
    });
    it('correctly allows the last data object to win for a path property', function(done) {
      assert(apos.build("/events", ["year", "month"], { year: '2013', month: '01', tag: 'dance' }, { year: 2012, month: '12' }) === '/events/2012/12?tag=dance');
      return done();
    });
    it('DR use case #1', function(done) {
      assert(apos.build('/events',
        [ 'year', 'month' ],
        { year: '2013', month: '05', tag: 'dance' },
        { tag: 'tour' }) === '/events/2013/05?tag=tour');
      return done();
    });
    it('DR use case #2', function(done) {
      var result = apos.build('/events',
        [ 'year', 'month' ],
        { year: '2013', month: '05', tag: 'dance' },
        { page: '2' });
      assert(result === '/events/2013/05?page=2&tag=dance');
      return done();
    });
    it('DR use case #3', function(done) {
      var result = apos.build('/events',
        [ 'year', 'month' ],
        { year: '2013', month: '05', tag: 'dance' },
        {});
      assert(result === '/events/2013/05?tag=dance');
      return done();
    });
  });
});

