const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;
const migrations = {
  add: [],
  eachDoc: [],
  updateOne: []
};

describe('Pieces Pages', function() {

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should initialize', async function() {
    apos = await t.create({
      root: module,
      modules: {
        event: {
          extend: '@apostrophecms/piece-type',
          options: {
            name: 'event',
            label: 'Event',
            alias: 'event',
            sort: { title: 1 }
          }
        },
        'event-page': {
          extend: '@apostrophecms/piece-page-type',
          options: {
            name: 'eventPage',
            label: 'Event',
            alias: 'eventPage',
            perPage: 10
          }
        },
        home: {
          extend: '@apostrophecms/piece-type',
          options: {
            name: 'home',
            label: 'Home',
            alias: 'home',
            sort: { title: 1 }
          }
        },
        'home-page': {
          extend: '@apostrophecms/piece-page-type',
          options: {
            name: 'homePiecePage',
            label: 'Home Piece Page',
            alias: 'homePiecePage',
            perPage: 10
          }
        },
        '@apostrophecms/page': {
          options: {
            park: [
              {
                title: 'Events',
                type: 'eventPage',
                slug: '/events',
                parkedId: 'events'
              },
              {
                title: 'Home piece page',
                type: 'homePiecePage',
                slug: '/',
                parkedId: 'home'
              }
            ]
          }
        },
        '@apostrophecms/migration': {
          extendMethods(self) {
            return {
              add(_super, name, migrationFn, options) {
                migrations.add.push(name);
                migrationFn();
                return _super(name, migrationFn, options);
              },
              eachDoc(_super, criteria, limit, iterator) {
                if (criteria.type) {
                  self.apos.doc.db.updateOne = (filter, update, options) => {
                    migrations.updateOne.push({
                      filter,
                      update
                    });
                  };
                  migrations.eachDoc.push(criteria.type);
                  const doc = {
                    _id: criteria.type,
                    updatedAt: '1234'
                  };
                  iterator(doc);
                }

                return _super(criteria, limit, iterator);
              }
            };
          }
        }
      }
    });
  });

  it('should add via a migration the `cacheInvalidatedAt` field to any doc and set it to equal the doc\'s `updatedAt` field', () => {
    const modulesToTest = [
      '@apostrophecms/any-doc-type',
      'event-page', // piece-page type
      'event' // piece type
    ];

    modulesToTest.forEach(moduleName => {
      assert(migrations.add.includes(`add-cache-invalidated-at-field-for-${moduleName}`));
      assert(migrations.eachDoc.includes(moduleName));

      const updateOneMigration = migrations.updateOne.find(({ filter }) => filter._id === moduleName);

      // `cacheInvalidatedAt` field is added only if not already set in the doc
      assert(updateOneMigration.filter.cacheInvalidatedAt.$exists === 0);
      assert(updateOneMigration.update.$set.cacheInvalidatedAt === '1234');
    });
  });

  it('should be able to use db to insert test pieces', async function() {
    assert(apos.modules.event);
    const testItems = [];
    const total = 100;
    for (let i = 1; (i <= total); i++) {
      const paddedInt = apos.launder.padInteger(i, 3);

      testItems.push({
        _id: 'event' + paddedInt,
        slug: 'event-' + paddedInt,
        visibility: 'public',
        type: 'event',
        title: 'Event ' + paddedInt,
        titleSortified: 'event ' + paddedInt,
        body: {
          metaType: 'area',
          _id: apos.util.generateId(),
          items: [
            {
              metaType: 'widget',
              type: '@apostrophecms/rich-text',
              content: '<p>This is some content.</p>'
            }
          ]
        }
      });
    }

    return apos.doc.db.insertMany(testItems);
  });

  it('should be able to use db to insert test "home" pieces', async function() {
    assert(apos.modules.home);
    const testItems = [];
    const total = 100;
    for (let i = 1; (i <= total); i++) {
      const paddedInt = apos.launder.padInteger(i, 3);

      testItems.push({
        _id: 'home' + paddedInt,
        slug: 'home-' + paddedInt,
        visibility: 'public',
        type: 'home',
        title: 'Home ' + paddedInt,
        titleSortified: 'home ' + paddedInt,
        body: {
          metaType: 'area',
          _id: apos.util.generateId(),
          items: [
            {
              metaType: 'widget',
              type: '@apostrophecms/rich-text',
              content: '<p>This is some content.</p>'
            }
          ]
        }
      });
    }

    return apos.doc.db.insertMany(testItems);
  });
  it('should populate the ._url property of pieces in any docs query', async function() {
    const piece = await apos.doc.find(apos.task.getAnonReq(), {
      type: 'event',
      title: 'Event 001'
    }).toObject();
    assert(piece);
    assert(piece._url);
    assert(piece._url === '/events/event-001');
  });

  it('should not correctly populate the ._url property of pieces in a docs query with an inadequate projection', async function() {
    const piece = await apos.doc.find(apos.task.getAnonReq(), {
      type: 'event',
      title: 'Event 001'
    }, {
      project: {
        type: 1
      }
    }).toObject();
    assert(piece);
    assert((!piece._url) || (piece._url.match(/undefined/)));
  });

  it('should not create a double-slashed _url on a piece-page-type set as the homepage', async function() {
    const piece = await apos.doc.find(apos.task.getAnonReq(), {
      type: 'home',
      title: 'Home 001'
    }).toObject();
    assert(piece);
    assert(piece._url === '/home-001');
  });

  it('should correctly populate the ._url property of pieces in a docs query if _url itself is "projected"', async function() {
    const piece = await apos.doc.find(apos.task.getAnonReq(), {
      type: 'event',
      title: 'Event 001'
    }, {
      project: {
        _url: 1
      }
    }).toObject();
    assert(piece);
    assert(piece._url);
    assert(piece._url === '/events/event-001');
  });

  it('should be able to access index page with first event on it, but not eleventh event', async function() {

    const body = await apos.http.get('/events');
    // Only page one events should show up
    assert(body.match(/event-001"/));
    assert(!body.match(/event-011"/));
  });

  it('should be able to access second page', async function() {
    const body = await apos.http.get('/events?page=2');
    // Only page two events should show up
    assert(body.match(/event-011"/));
    assert(!body.match(/event-001"/));
  });

  it('should be able to access "show" page for first event, should not also contain second event', async function() {
    const body = await apos.http.get('/events/event-001');
    // Only event 1's title should show up
    assert(body.match(/Event 001/));
    assert(!body.match(/Event 002/));
  });

});
