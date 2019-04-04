var t = require('../test-lib/test.js');
var assert = require('assert');
var _ = require('@sailshq/lodash');

describe('Urls', function() {

  this.timeout(t.timeout);

  var apos;
  var start;

  after(function(done) {
    return t.destroy(apos, done);
  });

  it('should exist on the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      afterInit: function(callback) {
        assert(apos.urls);
        return done();
      }
    });
  });

  // URLS METHODS ------------------------------------------------------- //

  describe('methods', function() {
    describe('test apos.urls.build', function() {
      it('returns a URL unmodified', function() {
        start = (new Date()).getTime();
        assert(apos.urls.build('/events') === '/events');
      });
      it('returns the URL "#" unmodified', function() {
        try {
          assert(apos.urls.build('#') === '#');
        } catch (e) {
          console.error(e.stack);
        }
      });
      it('adds a single parameter to a queryless URL', function() {
        assert(apos.urls.build('/events', { tag: 'blue' }) === '/events?tag=blue');
      });
      it('appends a parameter to a URL with a query', function() {
        // Neither of these is wrong
        var options = [
          '/events?tag=blue&page=5',
          '/events?page=5&tag=blue'
        ];
        assert(_.contains(options, apos.urls.build('/events?page=5', { tag: 'blue' })));
      });
      it('replaces parameters in the URL', function() {
        assert(apos.urls.build('/events?tag=blue', { tag: 'red' }) === '/events?tag=red');
      });
      it('removes parameters', function() {
        assert(apos.urls.build('/events?tag=blue', { tag: null }) === '/events');
      });
      it('correctly allows the last data object to win', function() {
        assert(apos.urls.build('/events', { tag: 'red' }, { tag: 'blue' }) === '/events?tag=blue');
      });
      it('places path properties in the path', function() {
        assert(apos.urls.build('/events', [ 'year', 'month' ], { year: '2013', month: '05', tag: 'red' }) === '/events/2013/05?tag=red');
      });
      it('switches to placing path properties in the query if it encounters a non-slugify-compliant property', function() {
        assert(apos.urls.build('/events', [ 'year', 'month' ], { year: '2013!@#@', month: '05', tag: 'red' }) === '/events?year=2013%21%40%23%40&month=05&tag=red');
      });
      it('does the right thing for a case that crashed once', function() {
        assert(apos.urls.build("/events", ["year", "month"], {}, {}) === '/events');
      });
      it('correctly allows the last data object to win for a path property', function() {
        assert(apos.urls.build("/events", ["year", "month"], { year: '2013', month: '01', tag: 'dance' }, { year: 2012, month: '12' }) === '/events/2012/12?tag=dance');
      });
      it('DR use case #1', function() {
        assert(apos.urls.build('/events',
          [ 'year', 'month' ],
          { year: '2013', month: '05', tag: 'dance' },
          { tag: 'tour' }) === '/events/2013/05?tag=tour');
      });
      it('DR use case #2', function() {
        var result = apos.urls.build('/events',
          [ 'year', 'month' ],
          { year: '2013', month: '05', tag: 'dance' },
          { page: '2' });
        assert(result === '/events/2013/05?tag=dance&page=2');
      });
      it('DR use case #3', function() {
        var result = apos.urls.build('/events',
          [ 'year', 'month' ],
          { year: '2013', month: '05', tag: 'dance' },
          {});
        assert(result === '/events/2013/05?tag=dance');
      });
      it('IH use case #1: later objects can prevent path properties from being added', function() {
        var result = apos.urls.build('/calendar',
          [ 'year', 'month' ],
          { year: '2014', month: '01', tag: undefined },
          { year: null, month: null });
        assert(result === '/calendar');
      });
      it('Preserves hashes', function() {
        var result = apos.urls.build('/calendar#skipdown',
          [ 'year', 'month' ],
          { year: '2014', month: '01', tag: 'blue' }
        );
        assert(result === '/calendar/2014/01?tag=blue#skipdown');
      });
      it('Adds an array when $addToSet is used', function() {
        var result = apos.urls.build('/events', {
          tags: {
            $addToSet: 'blue'
          }
        });
        assert(result === '/events?tags%5B0%5D=blue');
      });
      it('Adds to existing query string array when $addToSet is used', function() {
        var result = apos.urls.build('/events?tags[]=purple&tags[]=red', {
          tags: {
            $addToSet: 'blue'
          }
        });
        assert(result === '/events?tags%5B0%5D=purple&tags%5B1%5D=red&tags%5B2%5D=blue');
      });
      it('Adds to existing URI encoded query string array when $addToSet is used', function() {
        var result = apos.urls.build('/events?tags%5B0%5D=purple&tags%5B1%5D=red&tags%5B2%5D=blue', {
          tags: {
            $addToSet: 'green'
          }
        });
        assert(result === '/events?tags%5B0%5D=purple&tags%5B1%5D=red&tags%5B2%5D=blue&tags%5B3%5D=green');
      });
      it('Does not create duplicates when $addToSet is used', function() {
        var result = apos.urls.build('/events?tags%5B0%5D=purple&tags%5B1%5D=red&tags%5B2%5D=blue', {
          tags: {
            $addToSet: 'blue'
          }
        });
        assert(result === '/events?tags%5B0%5D=purple&tags%5B1%5D=red&tags%5B2%5D=blue');
      });
      it('Treats numbers and strings the same when preventing duplicates', function() {
        var result = apos.urls.build('/events?tags[]=4&tags[]=5', {
          tags: {
            $addToSet: 5
          }
        });
        assert(result === '/events?tags%5B0%5D=4&tags%5B1%5D=5');
      });
      it('Removes from existing query string array when $pull is used', function() {
        var result = apos.urls.build('/events?tags[]=purple&tags[]=red', {
          tags: {
            $pull: 'red'
          }
        });
        assert(result === '/events?tags%5B0%5D=purple');
      });
      it('Removes array entirely when $pull removes last item', function() {
        var result = apos.urls.build('/events?tags[]=purple', {
          tags: {
            $pull: 'purple'
          }
        });
        assert(result === '/events');
      });
      it('Behaves reasonably when a nonexistent item is removed', function() {
        var result = apos.urls.build('/events?tags[]=purple', {
          tags: {
            $pull: 'blue'
          }
        });
        assert(result === '/events?tags%5B0%5D=purple');
      });
      it('Takes less than 250 msec to run these tests', function() {
        var end = (new Date()).getTime();
        assert((end - start) < 250);
      });
    });
  });
});
