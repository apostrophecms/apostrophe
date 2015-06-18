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
          port: 7944
        },
        'events': {
          extend: 'apostrophe-pieces',
          name: 'event',
          label: 'Event',
          alias: 'events'
        },
        'events-widgets': {
          extend: 'apostrophe-pieces-widgets'
        },
        'apostrophe-pages': {
          park: [
            {
              title: 'Page With Events Widget',
              type: 'default',
              slug: '/page-with-events',
              published: true,
              body: {
                type: 'area',
                items: [
                  {
                    type: 'events',
                    by: 'id',
                    pieceIds: [
                      'wevent007', 'wevent006', 'wevent005'
                    ]
                  },
                  {
                    type: 'events',
                    by: 'tag',
                    tags: [
                      'tag2', 'madeupfaketag'
                    ],
                    limitByTag: 5
                  }
                ]
              }
            }
          ]
        }
      },
      afterListen: function(err) {
        assert(apos.modules['events-widgets']);
        done();
      }
    });
  });

  it('should be able to use db to insert test pieces', function(done){
    var testItems = [];
    var total = 100;
    for (var i = 1; (i <= total); i++) {
      var paddedInt = apos.launder.padInteger(i, 3);
      var tags;
      if (i > 50) {
        tags = [ 'tag2' ];
      } else {
        tags = [ 'tag1' ];
      }
      testItems.push({
        _id: 'wevent' + paddedInt,
        slug: 'wevent-' + paddedInt,
        published: true,
        type: 'event',
        title: 'Event ' + paddedInt,
        sortTitle: 'event ' + paddedInt,
        tags: tags,
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

  it('should find appropriate events and not others in a page containing tag and id-based event widgets', function(done) {

    return request('http://localhost:7944/page-with-events', function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Does it contain the right events via a widget?

      assert(body.match(/Event 005/));
      assert(body.match(/Event 006/));
      assert(body.match(/Event 007/));

      // Are they in the right order (reversed on purpose)?
      var i5 = body.indexOf('Event 005');
      var i6 = body.indexOf('Event 006');
      var i7 = body.indexOf('Event 007');
      assert((i5 > i6) && (i6 > i7));

      // These are by tag
      assert(body.match(/Event 051/));
      assert(body.match(/Event 052/));
      assert(body.match(/Event 053/));
      assert(body.match(/Event 054/));
      assert(body.match(/Event 055/));

      // Respect limit by tag
      assert(!body.match(/Event 056/));

      // Does it contain events not associated with the widget?
      assert(!body.match(/Event 001/));
      assert(!body.match(/Event 030/));
      return done();
    });
  });

});
