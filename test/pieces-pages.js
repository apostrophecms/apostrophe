const t = require('../test-lib/test.js');
const assert = require('assert');
const request = require('request-promise');
let apos;

describe('Pieces Pages', function() {

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should initialize', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        'apostrophe-express': {
          options: {
            secret: 'xxx',
            port: 7900
          }
        },
        'events': {
          extend: 'apostrophe-pieces',
          options: {
            name: 'event',
            label: 'Event',
            alias: 'events',
            sort: { title: 1 }
          }
        },
        'events-pages': {
          extend: 'apostrophe-pieces-pages',
          options: {
            name: 'events',
            label: 'Events',
            alias: 'eventsPages',
            perPage: 10
          }
        },
        'apostrophe-pages': {
          options: {
            park: [
              {
                title: 'Events',
                type: 'events',
                slug: '/events',
                published: true
              }
            ]
          }
        }
      }
    });
  });

  it('should be able to use db to insert test pieces', async function() {
    assert(apos.modules['events-pages']);
    const testItems = [];
    const total = 100;
    for (let i = 1; (i <= total); i++) {
      const paddedInt = apos.launder.padInteger(i, 3);

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

    return apos.docs.db.insertMany(testItems);
  });

  it('should populate the ._url property of pieces in any docs query', async function() {
    const piece = await apos.docs.find(apos.tasks.getAnonReq(), { type: 'event', title: 'Event 001' }).toObject();
    assert(piece);
    assert(piece._url);
    assert(piece._url === '/events/event-001');
  });

  it('should not correctly populate the ._url property of pieces in a docs query with an inadequate projection', async function() {
    const piece = await apos.docs.find(apos.tasks.getAnonReq(), { type: 'event', title: 'Event 001' }, { type: 1 }).toObject();
    assert(piece);
    assert((!piece._url) || (piece._url.match(/undefined/)));
  });

  it('should correctly populate the ._url property of pieces in a docs query if _url itself is "projected"', async function() {
    const piece = await apos.docs.find(apos.tasks.getAnonReq(), { type: 'event', title: 'Event 001' }, { _url: 1 }).toObject();
    assert(piece);
    assert(piece._url);
    assert(piece._url === '/events/event-001');
  });

  it('should be able to access index page with first event on it, but not eleventh event', async function() {

    const body = await request('http://localhost:7900/events');
    // Only page one events should show up
    assert(body.match(/event-001"/));
    assert(!body.match(/event-011"/));
  });

  it('should be able to access second page', async function() {
    const body = await request('http://localhost:7900/events?page=2');
    // Only page two events should show up
    assert(body.match(/event-011"/));
    assert(!body.match(/event-001"/));
  });

  it('should be able to access "show" page for first event, should not also contain second event', async function() {
    const body = await request('http://localhost:7900/events/event-001');
    // Only event 1's title should show up
    assert(body.match(/Event 001/));
    assert(!body.match(/Event 002/));
  });

});
