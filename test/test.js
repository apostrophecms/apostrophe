var assert = require('assert');
var mongo = require('mongodb');
var apos = require('../lib/apostrophe.js')();

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
    var start = (new Date()).getTime();
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
    it('IH use case #1: later objects can prevent path properties from being added', function(done) {
      var result = apos.build('/calendar',
        [ 'year', 'month' ],
        { year: '2014', month: '01', tag: undefined },
        { year: null, month: null });
      assert(result === '/calendar');
      return done();
    });
    it('Takes less than 250 msec to run these tests', function(done) {
      var end = (new Date()).getTime();
      // console.log(end - start);
      assert((end - start) < 250);
      return done();
    });
  });
  describe('test escapeHtml', function() {
    it('is defined', function() {
      assert(apos.escapeHtml);
    });
    it('does not alter a string requiring no escaping', function() {
      assert(apos.escapeHtml('this is fun') === 'this is fun');
    });
    it('escapes a string requiring escaping', function() {
      assert(apos.escapeHtml('<p>hmm</p>', '&lt;p&gt;hmm&lt;/p&gt;'));
    });
    it('escapes & properly too', function() {
      assert(apos.escapeHtml('&', '&amp;'));
    });
    var pretty = 'This is fun.\nhttp://google.com/\nHow about now?';
    it('leaves newlines and URLs alone when pretty is off', function() {
      assert(apos.escapeHtml(pretty) === pretty);
    });
    it('turns newlines into br and URLs into links when pretty is on', function() {
      assert(apos.escapeHtml(pretty, true) === 'This is fun.<br /><a href="http://google.com/">http://google.com/</a><br />How about now?');
    });
  });
  describe('test pruneTemporaryProperties', function() {
    it('is defined', function() {
      assert(apos.pruneTemporaryProperties);
    });
    it('prunes correctly', function() {
      var o = {
        a: 1,
        b: 1,
        c: {
          d: 1,
          e: 2,
          f: 3
        },
        d: [
          {
            a: 5,
            b: 7,
            c: 'whee',
            d: {
              a: 'boo'
            }
          },
          57
        ]
      };
      var correct = JSON.stringify(o);
      o._e = 'should get pruned';
      o.d[0].d._f = 'should get pruned too';
      apos.pruneTemporaryProperties(o);
      assert(JSON.stringify(o) === correct);
    });
  });
  describe('test slugify', function() {
    it('is defined', function() {
      assert(apos.slugify);
    });
    it('behaves reasonably for ascii', function() {
      assert(apos.slugify('I love manicotti, cheese!!! and sushi ') === 'i-love-manicotti-cheese-and-sushi');
    });
    it('behaves reasonably for non-ascii', function() {
      assert(apos.slugify('I love manicottiณณณ, cheese!!! and sushi ') === 'i-love-manicottiณณณ-cheese-and-sushi');
    });
  });
});

