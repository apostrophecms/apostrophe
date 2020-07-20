let t = require('../test-lib/test.js');
let assert = require('assert');
let _ = require('lodash');

describe('Urls', function() {

  this.timeout(t.timeout);

  let apos;
  let start;

  after(async () => {
    return t.destroy(apos);
  });

  it('should exist on the apos object', async () => {
    apos = await t.create({
      root: module
    });
    assert(apos.urls);
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
        let options = [
          '/events?tag=blue&page=5',
          '/events?page=5&tag=blue'
        ];
        assert(_.includes(options, apos.urls.build('/events?page=5', { tag: 'blue' })));
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
        assert(apos.urls.build('/events', [ 'year', 'month' ], {
          year: '2013',
          month: '05',
          tag: 'red'
        }) === '/events/2013/05?tag=red');
      });
      it('switches to placing path properties in the query if it encounters a non-slugify-compliant property', function() {
        assert(apos.urls.build('/events', [ 'year', 'month' ], {
          year: '2013!@#@',
          month: '05',
          tag: 'red'
        }) === '/events?year=2013%21%40%23%40&month=05&tag=red');
      });
      it('does the right thing for a case that crashed once', function() {
        assert(apos.urls.build('/events', ['year', 'month'], {}, {}) === '/events');
      });
      it('correctly allows the last data object to win for a path property', function() {
        assert(apos.urls.build('/events', ['year', 'month'], {
          year: '2013',
          month: '01',
          tag: 'dance'
        }, {
          year: 2012,
          month: '12'
        }) === '/events/2012/12?tag=dance');
      });
      it('DR use case #1', function() {
        assert(apos.urls.build('/events',
          [ 'year', 'month' ],
          {
            year: '2013',
            month: '05',
            tag: 'dance'
          },
          { tag: 'tour' }) === '/events/2013/05?tag=tour');
      });
      it('DR use case #2', function() {
        let result = apos.urls.build('/events',
          [ 'year', 'month' ],
          {
            year: '2013',
            month: '05',
            tag: 'dance'
          },
          { page: '2' });
        assert(result === '/events/2013/05?tag=dance&page=2');
      });
      it('DR use case #3', function() {
        let result = apos.urls.build('/events',
          [ 'year', 'month' ],
          {
            year: '2013',
            month: '05',
            tag: 'dance'
          },
          {});
        assert(result === '/events/2013/05?tag=dance');
      });
      it('IH use case #1: later objects can prevent path properties from being added', function() {
        let result = apos.urls.build('/calendar',
          [ 'year', 'month' ],
          {
            year: '2014',
            month: '01',
            tag: undefined
          },
          {
            year: null,
            month: null
          });
        assert(result === '/calendar');
      });
      it('Preserves hashes', function() {
        let result = apos.urls.build('/calendar#skipdown',
          [ 'year', 'month' ],
          {
            year: '2014',
            month: '01',
            tag: 'blue'
          }
        );
        assert(result === '/calendar/2014/01?tag=blue#skipdown');
      });
      it('Adds an array when $addToSet is used', function() {
        let result = apos.urls.build('/events', {
          colors: {
            $addToSet: 'blue'
          }
        });
        assert(result === '/events?colors%5B0%5D=blue');
      });
      it('Adds to existing query string array when $addToSet is used', function() {
        let result = apos.urls.build('/events?colors[]=purple&colors[]=red', {
          colors: {
            $addToSet: 'blue'
          }
        });
        assert(result === '/events?colors%5B0%5D=purple&colors%5B1%5D=red&colors%5B2%5D=blue');
      });
      it('Adds to existing URI encoded query string array when $addToSet is used', function() {
        let result = apos.urls.build('/events?colors%5B0%5D=purple&colors%5B1%5D=red&colors%5B2%5D=blue', {
          colors: {
            $addToSet: 'green'
          }
        });
        assert(result === '/events?colors%5B0%5D=purple&colors%5B1%5D=red&colors%5B2%5D=blue&colors%5B3%5D=green');
      });
      it('Does not create duplicates when $addToSet is used', function() {
        let result = apos.urls.build('/events?colors%5B0%5D=purple&colors%5B1%5D=red&colors%5B2%5D=blue', {
          colors: {
            $addToSet: 'blue'
          }
        });
        assert(result === '/events?colors%5B0%5D=purple&colors%5B1%5D=red&colors%5B2%5D=blue');
      });
      it('Treats numbers and strings the same when preventing duplicates', function() {
        let result = apos.urls.build('/events?colors[]=4&colors[]=5', {
          colors: {
            $addToSet: 5
          }
        });
        assert(result === '/events?colors%5B0%5D=4&colors%5B1%5D=5');
      });
      it('Removes from existing query string array when $pull is used', function() {
        let result = apos.urls.build('/events?colors[]=purple&colors[]=red', {
          colors: {
            $pull: 'red'
          }
        });
        assert(result === '/events?colors%5B0%5D=purple');
      });
      it('Removes array entirely when $pull removes last item', function() {
        let result = apos.urls.build('/events?colors[]=purple', {
          colors: {
            $pull: 'purple'
          }
        });
        assert(result === '/events');
      });
      it('Behaves reasonably when a nonexistent item is removed', function() {
        let result = apos.urls.build('/events?colors[]=purple', {
          colors: {
            $pull: 'blue'
          }
        });
        assert(result === '/events?colors%5B0%5D=purple');
      });
      it('Takes less than 250 msec to run these tests', function() {
        let end = (new Date()).getTime();
        assert((end - start) < 250);
      });
    });
  });
});
