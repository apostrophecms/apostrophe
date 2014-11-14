/* global it, describe */

var assert = require('assert');
var mongo = require('mongodb');
var _ = require('lodash');
var async = require('async');
var apos = require('../lib/apostrophe.js')();
var db;

function find(a, b) {
  for (var i in a) {
    if (b(a[i])) {
      return a[i];
    }
  }
}

function req(d) {
  var o = {
    traceIn: function() {},
    traceOut: function() {}
  };
  _.extend(o, d);
  return o;
}

describe('apostrophe', function() {
  describe('initialize resources', function() {
    it('initialize mongodb', function(done) {
      mongo.connect('mongodb://127.0.0.1:27017/apostest', function(err, _db) {
        assert(!err);
        assert(_db);
        db = _db;
        // Reset the database for another go
        db.dropDatabase(function(err) {
          assert(!err);
          return done();
        });
      });
    });
    it('initialize apostrophe', function(done) {
      return apos.init({
        db: db,
        app: {
          request: {},
          locals: {},
          get: function() {},
          post: function() {},
          all: function() {}
        }
      }, function(err) {
        assert(!err);
        return done();
      });
    });
  });
  var start;
  describe('test apos.build', function() {
    it('returns a URL unmodified', function(done) {
      start = (new Date()).getTime();
      assert(apos.build('/events') === '/events');
      return done();
    });
    it('returns the URL "#" unmodified', function(done) {
      try {
        assert(apos.build('#') === '#');
      } catch (e) {
        console.error(e.stack);
      }
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
    it('Preserves hashes', function(done) {
      var result = apos.build('/calendar#skipdown',
        [ 'year', 'month' ],
        { year: '2014', month: '01', tag: 'blue' }
      );
      assert(result === '/calendar/2014/01?tag=blue#skipdown');
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
      assert.equal(apos.slugify('I love manicotti, cheese!!! and sushi '), 'i-love-manicotti-cheese-and-sushi');
    });
    it('behaves reasonably for non-ascii', function() {
      assert.equal(apos.slugify('I love manicottiณณณ, cheese!!! and sushi '), 'i-love-manicottiณณณ-cheese-and-sushi');
    });
  });
  describe('test permissions.can', function() {
    it('apos.permissions is defined', function() {
      assert(apos.permissions);
    });
    it('allows view-page in the generic case', function() {
      assert(apos.permissions.can(req(), 'view-page'));
    });
    it('rejects edit-page in the generic case', function() {
      assert(!apos.permissions.can(req(), 'edit-page'));
    });
    it('forbids view-page for public with loginRequired', function() {
      assert(!apos.permissions.can(req(), 'view-page', { published: true, loginRequired: 'loginRequired' }));
    });
    it('permits view-page for public without loginRequired', function() {
      assert(apos.permissions.can(req(), 'view-page', { published: true }));
    });
    it('prohibits view-page for public without published', function() {
      assert(!apos.permissions.can(req(), 'view-page', {}));
    });
    it('prohibits view-page for public with loginRequired', function() {
      assert(!apos.permissions.can(req(), 'view-page', { published: true, loginRequired: 'loginRequired' }));
    });
    it('permits view-page for guest user with loginRequired', function() {
      assert(apos.permissions.can(req({ user: { permissions: { guest: 1 } } }), 'view-page', { published: true, loginRequired: 'loginRequired' }));
    });
    it('permits view-page for individual with proper id', function() {
      assert(apos.permissions.can(req({ user: { _id: 1 } }), 'view-page', { published: true, loginRequired: 'certainPeople', pagePermissions: [ 'view-1' ] }));
    });
    it('forbids view-page for individual with wrong id', function() {
      assert(!apos.permissions.can(req({ user: { _id: 2 } }), 'view-page', { published: true, loginRequired: 'certainPeople', pagePermissions: [ 'view-1' ] }));
    });
    it('permits view-page for individual with group id', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ] } }), 'view-page', { published: true, loginRequired: 'certainPeople', pagePermissions: [ 'view-1002' ] }));
    });
    it('forbids view-page for individual with wrong group id', function() {
      assert(!apos.permissions.can(req({ user: { _id: 2, groupIds: [ 1001, 1002 ] } }), 'view-page', { published: true, loginRequired: 'certainPeople', pagePermissions: [ 'view-1003' ] }));
    });
    it('certainPeople will not let you slide past to an unpublished page', function() {
      assert(!apos.permissions.can(req({ user: { _id: 1 } }), 'view-page', {  loginRequired: 'certainPeople', pagePermissions: [ 'view-1' ] }));
    });
    it('permits view-page for unpublished page for individual with group id for editing', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ] } }), 'view-page', { pagePermissions: [ 'edit-1002' ] }));
    });
    it('permits edit-page for individual with group id for editing and the edit permission', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ], permissions: { edit: true } } }), 'edit-page', { pagePermissions: [ 'edit-1002' ] }));
    });
    it('forbids edit-page for individual with group id for editing but no edit permission', function() {
      assert(!apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ] } }), 'edit-page', { pagePermissions: [ 'edit-1002' ] }));
    });
    it('permits edit-page for individual with group id for managing and edit permission', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ], permissions: { edit: true } } }), 'edit-page', { pagePermissions: [ 'publish-1002' ] }));
    });
    it('forbids edit-page for other person', function() {
      assert(!apos.permissions.can(req({ user: { _id: 7 } }), 'edit-page', { pagePermissions: [ 'publish-1002' ] }));
    });
  });
  describe('test permissions.criteria', function() {
    it('successfully inserted test data', function(done) {
      return apos.pages.insert([
        {
          _id: 'page-1',
          slug: 'page-1',
          published: true
        },
        {
          _id: 'page-2',
          slug: 'page-2',
        },
        {
          _id: 'page-3',
          slug: 'page-3',
          published: true,
          loginRequired: 'loginRequired'
        },
        {
          _id: 'page-4',
          slug: 'page-4',
          published: true,
          loginRequired: 'certainPeople',
          pagePermissions: [ 'view-1' ]
        },
        {
          _id: 'page-5',
          slug: 'page-5',
          loginRequired: 'certainPeople',
          pagePermissions: [ 'view-1' ]
        },
        {
          _id: 'page-6',
          slug: 'page-6',
          published: true,
          loginRequired: 'certainPeople',
          pagePermissions: [ 'view-1002' ]
        },
        {
          _id: 'page-7',
          slug: 'page-7',
          pagePermissions: [ 'edit-1002' ]
        },
        {
          _id: 'page-8',
          slug: 'page-8',
          pagePermissions: [ 'publish-1002' ]
        }
      ], function(err, count) {
        assert(!err);
        done();
      });
    });

    var err;
    var results;
    it('public user queries without error', function(done) {
      return apos.pages.find(apos.permissions.criteria(req({}), 'view-page')).toArray(function(_err, _results) {
        err = _err;
        assert(!err);
        results = _results;
        assert(Array.isArray(results));
        done();
      });
    });

    it('forbids view-page for public with loginRequired', function() {
      assert(!find(results, function(result) {
        return !!result.loginRequired;
      }));
    });
    it('allows public view-page without loginRequired', function() {
      assert(find(results, function(result) {
        return !result.loginRequired;
      }));
    });
    it('prohibits view-page for public without published', function() {
      assert(!find(results, function(result) {
        return !result.published;
      }));
    });

    it('guest user queries without error', function(done) {
      return apos.pages.find(apos.permissions.criteria(req({ user: { permissions: { guest: 1 } } }), 'view-page')).toArray(function(_err, _results) {
        err = _err;
        assert(!err);
        results = _results;
        assert(Array.isArray(results));
        done();
      });
    });

    it('permits view-page for guest user with loginRequired', function() {
      assert(find(results, function(result) {
        return result.loginRequired === 'loginRequired';
      }));
    });

    it('id 1 user queries without error', function(done) {
      return apos.pages.find(apos.permissions.criteria(req({ user: { _id: 1 } }), 'view-page')).toArray(function(_err, _results) {
        err = _err;
        assert(!err);
        results = _results;
        assert(Array.isArray(results));
        done();
      });
    });

    it('permits view-page for individual with proper id', function() {
      assert(find(results, function(result) {
        return (result.loginRequired === 'certainPeople') && result.pagePermissions && (result.pagePermissions.length === 1) && (result.pagePermissions[0] === 'view-1');
      }));
    });
    it('certainPeople will not let you slide past to an unpublished page', function() {
      assert(!find(results, function(result) {
        return (result.loginRequired === 'certainPeople') && (result.pagePermissions.length === 1) && (result.pagePermissions[0] === 'view-1') && (!result.published);
      }));
    });

    it('id 2 user queries without error', function(done) {
      return apos.pages.find(apos.permissions.criteria(req({ user: { _id: 2 } }), 'view-page')).toArray(function(_err, _results) {
        err = _err;
        assert(!err);
        results = _results;
        assert(Array.isArray(results));
        done();
      });
    });

    it('forbids view-page for individual with wrong id', function() {
      assert(!find(results, function(result) {
        return (result.loginRequired === 'certainPeople') && result.pagePermissions && (result.pagePermissions.length === 1) && (result.pagePermissions[0] === 'view-1');
      }));
    });

    it('group 1002 user queries without error', function(done) {
      return apos.pages.find(apos.permissions.criteria(req({ user: { _id: 3, groupIds: [ 1002 ] } }), 'view-page')).toArray(function(_err, _results) {
        err = _err;
        assert(!err);
        results = _results;
        assert(Array.isArray(results));
        done();
      });
    });

    it('permits view-page for individual with proper group id', function() {
      assert(find(results, function(result) {
        return (result.loginRequired === 'certainPeople') && result.pagePermissions && (find(result.pagePermissions, function(p) { return p === 'view-1002'; }));
      }));
    });

    it('permits view-page for unpublished page for individual with group id for editing', function() {
      assert(find(results, function(result) {
        return (result.loginRequired !== 'certainPeople') && result.pagePermissions && (find(result.pagePermissions, function(p) { return p === 'edit-1002'; }));
      }));
    });

    it('group 1003 user queries without error', function(done) {
      return apos.pages.find(apos.permissions.criteria(req({ user: { _id: 3, groupIds: [ 1003 ] } }), 'view-page')).toArray(function(_err, _results) {
        err = _err;
        assert(!err);
        results = _results;
        assert(Array.isArray(results));
        done();
      });
    });

    it('forbids view-page for individual with wrong group id', function() {
      assert(!find(results, function(result) {
        return (result.loginRequired === 'certainPeople') && result.pagePermissions && (find(result.pagePermissions, function(p) { return p === 'view-1002'; }));
      }));
    });

    it('group 1002 user queries for editing without error', function(done) {
      return apos.pages.find(apos.permissions.criteria(req({ user: { _id: 3, groupIds: [ 1002 ], permissions: { edit: true } } }), 'edit-page')).toArray(function(_err, _results) {
        err = _err;
        assert(!err);
        results = _results;
        assert(Array.isArray(results));
        done();
      });
    });

    it('permits edit-page for individual with group id for editing', function() {
      assert(find(results, function(result) {
        return (result.pagePermissions && find(result.pagePermissions, function(p) { return p === 'edit-1002'; }));
      }));
    });

    it('permits edit-page for individual with group id for editing', function() {
      assert(find(results, function(result) {
        return (result.pagePermissions && find(result.pagePermissions, function(p) { return p === 'edit-1002'; }));
      }));
    });

    it('permits edit-page for individual with group id for managing', function() {
      assert(find(results, function(result) {
        return (result.pagePermissions && find(result.pagePermissions, function(p) { return p === 'publish-1002'; }));
      }));
    });

    it('other user queries for editing without error', function(done) {
      return apos.pages.find(apos.permissions.criteria(req({ user: { _id: 7 } }), 'edit-page')).toArray(function(_err, _results) {
        err = _err;
        assert(!err);
        results = _results;
        assert(Array.isArray(results));
        done();
      });
    });

    it('forbids edit-page for other person', function() {
      assert(!results.length);
    });

    it('appropriate user can add area to page-1 with putArea without error', function(done) {
      return apos.putArea(req({ user: { permissions: { admin: 1 } } }), 'page-1:test', { type: 'area', items: [ { type: 'richText', content: '<h4>Whee</h4>' } ] }, function(err) {
        assert(!err);
        done();
      });
    });
    it('the area actually gets there', function(done) {
      return apos.getPage(req({ user: { permissions: { admin: 1 } } }), 'page-1', function(err, page) {
        assert(!err);
        assert(page);
        assert(page.test);
        assert(page.test.items[0]);
        assert(page.test.items[0].content === '<h4>Whee</h4>');
        done();
      });
    });
    it('inappropriate user cannot add area to page-1 with putArea', function(done) {
      return apos.putArea(req({ user: { permissions: { guest: 1 } } }), 'page-1:test', { type: 'area', items: [ { type: 'richText', content: '<h4>Whee</h4>' } ] }, function(err) {
        assert(err);
        done();
      });
    });
    it('appropriate user can make new page with putArea without error', function(done) {
      return apos.putArea(req({ user: { permissions: { admin: 1 } } }), 'global:test', { type: 'area', items: [ { type: 'richText', content: '<h4>Whee</h4>' } ] }, function(err) {
        assert(!err);
        done();
      });
    });
    it('an area on a new page actually gets there', function(done) {
      return apos.getPage(req({ user: { permissions: { admin: 1 } } }), 'global', function(err, page) {
        assert(!err);
        assert(page);
        assert(page.test);
        assert(page.test.items[0]);
        assert(page.test.items[0].content === '<h4>Whee</h4>');
        done();
      });
    });
    it('can add a second area to that new page', function(done) {
      return apos.putArea(req({ user: { permissions: { admin: 1 } } }), 'global:test2', { type: 'area', items: [ { type: 'richText', content: '<h4>Whee</h4>' } ] }, function(err) {
        assert(!err);
        done();
      });
    });
    it('second area does not blow out the first', function(done) {
      return apos.getPage(req({ user: { permissions: { admin: 1 } } }), 'global', function(err, page) {
        assert(!err);
        assert(page);
        assert(page.test);
        assert(page.test.items[0]);
        assert(page.test.items[0].content === '<h4>Whee</h4>');
        done();
      });
    });
    it('even an admin cannot make a new page with putArea if the slug starts with /', function(done) {
      return apos.putArea(req({ user: { permissions: { admin: 1 } } }), '/:test', { type: 'area', items: [ { type: 'richText', content: '<h4>Whee</h4>' } ] }, function(err) {
        assert(err);
        done();
      });
    });
  });
});

