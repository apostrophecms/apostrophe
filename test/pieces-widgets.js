var assert = require('assert');
var _ = require('lodash');
var async = require('async');
var request = require('request');
var t = require('./testUtils');

var apos;

describe('Pieces Widgets', function() {

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
          port: 7944
        },
        'events': {
          extend: 'apostrophe-pieces',
          name: 'event',
          label: 'Event',
          alias: 'events',
          sort: { title: 1 }
        },
        'events-widgets': {
          extend: 'apostrophe-pieces-widgets'
        },
        'apostrophe-pages': {
          types: [
            {
              name: 'home',
              label: 'Home'
            },
            {
              name: 'default',
              label: 'Default'
            }
          ],
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
      var title = 'Event ' + paddedInt;
      testItems.push({
        _id: 'wevent' + paddedInt,
        slug: 'wevent-' + paddedInt,
        published: true,
        type: 'event',
        title: title,
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

    // We need an event that can be distinguished by
    // something other than a number in order to test
    // our autocomplete, which feeds through mongo's text
    // indexes, which don't support numbers
    paddedInt = 'wiggly';
    title = 'Event Wiggly';
    testItems.push({
      _id: 'weventwiggly' + paddedInt,
      slug: 'wevent-wiggl' + paddedInt,
      published: true,
      type: 'event',
      title: title,
      tags: tags,
      // fake highSearchText and highSearchWords until the
      // search module is finished
      highSearchText: apos.utils.sortify(title),
      highSearchWords: apos.utils.sortify(title).split(/ /),
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
    var req = t.req.admin(apos);
    return async.eachSeries(testItems, function(item, callback) {
      return apos.docs.insert(req, item, callback);
    }, function(err) {
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

  // This code is pulled from express tests in order to properly test POST route
  var jar;

  function getCsrfToken(jar) {
    var csrfCookie = _.find(jar.getCookies('http://localhost:7944/'), { key: 'XSRF-TOKEN' });
    if (!csrfCookie) {
      return null;
    }
    var csrfToken = csrfCookie.value;
    return csrfToken;
  }

  // TODO Removing this test for now, we need a more reliable way of making a request
  // with a proper csrf token in our test suite.
  // it('should be able to autocomplete docs', function(done) {
  //   // otherwise request does not track cookies
  //   jar = request.jar();
  //   request({
  //     method: 'GET',
  //     url: 'http://localhost:7944/page-with-events',
  //     jar: jar
  //   }, function(err, response, body) {
  //     assert.equal(response.statusCode, 200);
  //     var csrfToken = getCsrfToken(jar);
  //     // Now let's get a modal so we can bless the joins
  //     return request({
  //       method: 'POST',
  //       url: 'http://localhost:7944/modules/events-widgets/modal',
  //       json: {
  //         _id: 'wevent007'
  //       },
  //       jar: jar,
  //       headers: {
  //         'X-XSRF-TOKEN': csrfToken
  //       }
  //     }, function(err, response, body) {
  //       assert(!err);
  //       // Is our status code good?
  //       assert.equal(response.statusCode, 200);
  //       return request({
  //         method: 'POST',
  //         url: 'http://localhost:7944/modules/apostrophe-docs/autocomplete',
  //         json: {
  //           term: 'wig',
  //           field: {
  //             type: 'joinByArray',
  //             name: '_pieces',
  //             label: 'Individually',
  //             idsField: 'pieceIds',
  //             withType: 'event'
  //           }
  //         },
  //         jar: jar,
  //         headers: {
  //           'X-XSRF-TOKEN': csrfToken
  //         }
  //       }, function(err, response, body) {
  //         assert(!err);
  //         // Is our status code good?
  //         assert.equal(response.statusCode, 200);
  //         var events;
  //         if (typeof body === 'string') {
  //           events = JSON.parse(body);
  //         } else {
  //           events = body;
  //         }
  //         assert(events);
  //         assert(Array.isArray(events));
  //         assert(events[0].label === 'Event Wiggly');
  //         assert(events.length === 1);
  //         done();
  //       });
  //     });
  //   });
  // });
});
