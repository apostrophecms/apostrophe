const t = require('../test-lib/test.js');
const assert = require('assert');
const _ = require('lodash');

describe('Search', function() {
  let apos;
  let req;

  this.timeout(t.timeout);

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        event: {
          extend: '@apostrophecms/piece-type',
          options: {
            name: 'event',
            label: 'Event'
          }
        },
        'event-page': {
          extend: '@apostrophecms/piece-page-type'
        },
        '@apostrophecms/search': {
          options: {
            ancestorsApiProjection: {
              _id: 1,
              title: 1,
              slug: 1,
              type: 1,
              visibility: 1,
              orphan: 1,
              parkedId: 1,
              parked: 1,
              rank: 1,
              level: 1,
              aposDocId: 1,
              path: 1,
              lastPublishedAt: 1,
              aposLocale: 1,
              aposMode: 1,
              metaType: 1,
              createdAt: 1,
              archived: 1,
              titleSortified: 1,
              updatedAt: 1,
              updatedBy: 1,
              _url: 1
            }
          }
        },
        '@apostrophecms/page': {
          options: {
            park: [
              {
                title: 'Events',
                type: 'event-page',
                slug: '/events',
                parkedId: 'events'
              },
              {
                slug: '/search',
                parkedId: 'search',
                title: 'Search',
                type: '@apostrophecms/search'
              }
            ]
          }
        }
      }
    });

    req = apos.task.getReq();
    await apos.doc.insert(req, {
      title: 'Testing Search Event',
      type: 'event',
      slug: 'search-test-event'
    });
  });

  after(async function() {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should be a property of the apos object', async function() {
    assert(apos.search);
  });

  it('should add highSearchText, highSearchWords, lowSearchText, searchSummary to all docs on insert', async function() {
    const doc = await apos.doc.find(req, { slug: 'search-test-event' }).toObject();
    assert(doc.highSearchText);
    assert(doc.highSearchWords);
    assert(doc.lowSearchText);
    assert(doc.searchSummary !== undefined);

    assert(doc.highSearchText.match(/testing/));
    assert(_.includes(doc.highSearchWords, 'testing'));
  });

  it('should carry the _ancestors property', async function() {
    const response1 = await apos.http.get('/search?q=event');
    const [ piece ] = JSON.parse(response1);

    assert(piece._parent.title === 'Events');
    assert(piece._parent.type === 'event-page');
    assert(piece._parent.slug === '/events');
    assert(piece._parent._ancestors[0].slug === '/');
    assert(piece._parent._ancestors[0]._ancestors.length === 0);

    const response2 = await apos.http.get('/search?q=home');
    const [ homepage ] = JSON.parse(response2);

    assert(homepage._ancestors.length === 0);
  });

  it('should apply a custom projection on the _ancestors', async function() {
    const response1 = await apos.http.get('/search?q=event');
    const [ piece ] = JSON.parse(response1);

    assert.deepEqual(
      Object.keys(piece._parent._ancestors[0]),
      [
        '_id',
        'title',
        'slug',
        'type',
        'visibility',
        'orphan',
        'parkedId',
        'parked',
        'rank',
        'level',
        'aposDocId',
        'path',
        'lastPublishedAt',
        'aposLocale',
        'aposMode',
        'metaType',
        'createdAt',
        'archived',
        'titleSortified',
        'updatedAt',
        'updatedBy',
        '_url',
        '_ancestors'
      ]
    );
  });
});
