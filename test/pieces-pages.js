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
    var eventsPages = apos.eventsPages;
    // Simulate a page request
    var req = {
      data: {
        bestPage: {
          type: 'events'
        }
      },
      remainder: '/'
    };
    // pageServe method normally invoked via callAll in
    // the pages module
    eventsPages.pageServe(req, function(err) {
      var output = req.template({});
      // Look for the slug at the end of a link, using the
      // trailing quote to avoid false positives
      assert(output.match(/event-1"/));
      assert(!output.match(/event-11"/));
      done();
    });
  });

  it('should be able to access page two with eleventh event on it, but not first event', function(done) {
    var eventsPages = apos.eventsPages;
    // Simulate a page request
    var req = {
      data: {
        bestPage: {
          type: 'events'
        }
      },
      query: {
        page: 2
      },
      remainder: '/'
    };
    // pageServe method normally invoked via callAll in
    // the pages module
    eventsPages.pageServe(req, function(err) {
      var output = req.template({});
      // Look for the slug at the end of a link, using the
      // trailing quote to avoid false positives
      assert(output.match(/event-11"/));
      assert(!output.match(/event-1"/));
      done();
    });
  });

  it('should be able to access "show" page for first event, should not also contain second event', function(done) {
    var eventsPages = apos.eventsPages;
    // Simulate a page request
    var req = {
      data: {
        bestPage: {
          type: 'events'
        }
      },
      remainder: '/event-1'
    };
    // pageServe method normally invoked via callAll in
    // the pages module
    eventsPages.pageServe(req, function(err) {
      var output = req.template({});
      assert(output.match(/Event 1/));
      assert(!output.match(/Event 2/));
      done();
    });
  });

});
