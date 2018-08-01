var t = require('../test-lib/test.js');
var assert = require('assert');
var async = require('async');
var request = require('request');

describe('Pieces Widgets', function() {

  var apos;

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
      afterInit: function(callback) {
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        assert(apos.modules['events-widgets']);
        done();
      }
    });
  });

  it('should be able to use db to insert test pieces', function(done) {
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
    var req = apos.tasks.getReq();
    return async.eachSeries(testItems, function(item, callback) {
      return apos.docs.insert(req, item, callback);
    }, function(err) {
      assert(!err);
      done();
    });
  });

  it('should find appropriate events and not others in a page containing tag and id-based event widgets', function(done) {

    return request('http://localhost:7900/page-with-events', function(err, response, body) {
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
      done();
    });
  });

});

describe('Pieces Widget With Extra Join', function() {

  var apos;

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
        'events-widgets': {
          extend: 'apostrophe-pieces-widgets',
          addFields: [
            {
              name: '_featured',
              type: 'joinByArray',
              withType: 'event'
            }
          ]
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
                    ],
                    featuredIds: [
                      'wevent003', 'wevent004'
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
      afterInit: function(callback) {
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        assert(apos.modules['events-widgets']);
        done();
      }
    });
  });

  it('should be able to use db to insert test pieces', function(done) {
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
    var req = apos.tasks.getReq();
    return async.eachSeries(testItems, function(item, callback) {
      return apos.docs.insert(req, item, callback);
    }, function(err) {
      assert(!err);
      done();
    });
  });

  it('should find appropriate events and not others in a page containing tag and id-based event widgets', function(done) {

    return request('http://localhost:7900/page-with-events', function(err, response, body) {
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

      // Does it contain the featured events in the extra join?
      assert(body.match(/Event 003/));
      assert(body.match(/Event 004/));
      var i3 = body.indexOf('Event 003');
      var i4 = body.indexOf('Event 004');
      // Are they in the right order and in the right place (before the regular stuff)?
      assert(i3 < i7);
      assert(i4 < i7);
      assert(i3 < i4);

      done();
    });
  });

});
