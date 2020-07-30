const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Pieces Widgets', function() {

  let apos;

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should initialize', async function() {
    apos = await t.create({
      root: module,
      modules: {
        'event': {
          extend: '@apostrophecms/piece-type',
          options: {
            name: 'event',
            label: 'Event',
            alias: 'event',
            sort: { title: 1 }
          }
        },
        'event-widget': {
          extend: '@apostrophecms/piece-widget-type'
        },
        'default-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              body: {
                type: 'area',
                options: {
                  widgets: {
                    'event': {}
                  }
                }
              }
            }
          }
        },
        '@apostrophecms/page': {
          options: {
            types: [
              {
                name: '@apostrophecms/home-page',
                label: 'Home'
              },
              {
                name: 'default-page',
                label: 'Default'
              }
            ],
            park: [
              {
                title: 'Page With Events Widget',
                metaType: 'doc',
                type: 'default-page',
                slug: '/page-with-events',
                parkedId: 'page-with-event-widget',
                published: true,
                body: {
                  metaType: 'area',
                  items: [
                    {
                      metaType: 'widget',
                      type: 'event',
                      by: 'id',
                      pieceIds: [
                        'wevent012', 'wevent011', 'wevent010'
                      ]
                    },
                    {
                      metaType: 'widget',
                      type: 'event',
                      by: 'all',
                      limitAll: 5
                    }
                  ]
                }
              }
            ]
          }
        }
      }
    });
  });

  it('should be able to use db to insert test pieces', async function() {
    assert(apos.modules['event-widget']);
    let testItems = [];
    let total = 100;
    for (let i = 1; (i <= total); i++) {
      let paddedInt = apos.launder.padInteger(i, 3);
      let title = 'Event ' + paddedInt;
      testItems.push({
        _id: 'wevent' + paddedInt,
        slug: 'wevent-' + paddedInt,
        published: true,
        metaType: 'doc',
        type: 'event',
        title: title,
        body: {
          metaType: 'area',
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

    // We need an event that can be distinguished by
    // something other than a number in order to test
    // our autocomplete, which feeds through mongo's text
    // indexes, which don't support numbers
    const paddedInt = 'wiggly';
    const title = 'Event Wiggly';
    testItems.push({
      _id: 'weventwiggly' + paddedInt,
      slug: 'wevent-wiggl' + paddedInt,
      published: true,
      metaType: 'doc',
      type: 'event',
      title: title,
      // fake highSearchText and highSearchWords until the
      // search module is finished
      highSearchText: apos.util.sortify(title),
      highSearchWords: apos.util.sortify(title).split(/ /),
      body: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            type: '@apostrophecms/rich-text',
            content: '<p>This is some content.</p>'
          }
        ]
      }
    });
    const req = apos.task.getReq();
    for (const item of testItems) {
      await apos.doc.insert(req, item);
    }
  });

  it('should find appropriate events and not others in a page containing all and id-based event widgets', async function() {

    const body = await apos.http.get('/page-with-events');
    // Does it contain the right events via a widget?
    assert(body.match(/Event 010/));
    assert(body.match(/Event 011/));
    assert(body.match(/Event 012/));

    // Are they in the right order (reversed on purpose)?
    let i5 = body.indexOf('Event 010');
    let i6 = body.indexOf('Event 011');
    let i7 = body.indexOf('Event 012');
    assert((i5 > i6) && (i6 > i7));

    // These are by all
    assert(body.match(/Event 001/));
    assert(body.match(/Event 002/));
    assert(body.match(/Event 003/));
    assert(body.match(/Event 004/));
    assert(body.match(/Event 005/));

    // Respect limit by all
    assert(!body.match(/Event 006/));
  });

});

describe('Pieces Widget With Extra Join', function() {

  let apos;

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should initialize', async function() {
    apos = await t.create({
      root: module,
      modules: {
        'event': {
          extend: '@apostrophecms/piece-type',
          options: {
            name: 'event',
            label: 'Event',
            alias: 'event',
            sort: { title: 1 }
          }
        },
        'event-widget': {
          extend: '@apostrophecms/piece-widget-type',
          fields: {
            add: {
              _featured: {
                type: 'joinByArray',
                withType: 'event'
              }
            }
          }
        },
        '@apostrophecms/page': {
          options: {
            types: [
              {
                name: '@apostrophecms/home-page',
                label: 'Home'
              },
              {
                name: 'default-page',
                label: 'Default'
              }
            ],
            park: [
              {
                title: 'Page With Events Widget',
                type: 'default-page',
                slug: '/page-with-events',
                published: true,
                parkedId: 'page-with-event-widget',
                body: {
                  metaType: 'area',
                  items: [
                    {
                      metaType: 'widget',
                      type: 'event',
                      by: 'id',
                      pieceIds: [
                        'wevent012', 'wevent011', 'wevent010'
                      ],
                      featuredIds: [
                        'wevent020', 'wevent021'
                      ]
                    },
                    {
                      metaType: 'widget',
                      type: 'event',
                      by: 'all',
                      limitByAll: 5
                    }
                  ]
                }
              }
            ]
          }
        },
        'default-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              body: {
                type: 'area',
                options: {
                  widgets: {
                    'event': {}
                  }
                }
              }
            }
          }
        }
      }
    });
  });

  it('should be able to use db to insert test pieces', async function() {
    assert(apos.modules['event-widget']);
    let testItems = [];
    let total = 100;
    for (let i = 1; (i <= total); i++) {
      let paddedInt = apos.launder.padInteger(i, 3);
      let title = 'Event ' + paddedInt;
      testItems.push({
        _id: 'wevent' + paddedInt,
        slug: 'wevent-' + paddedInt,
        published: true,
        type: 'event',
        title: title,
        body: {
          metaType: 'area',
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

    // We need an event that can be distinguished by
    // something other than a number in order to test
    // our autocomplete, which feeds through mongo's text
    // indexes, which don't support numbers
    const paddedInt = 'wiggly';
    const title = 'Event Wiggly';
    testItems.push({
      _id: 'weventwiggly' + paddedInt,
      slug: 'wevent-wiggl' + paddedInt,
      published: true,
      type: 'event',
      title: title,
      // fake highSearchText and highSearchWords until the
      // search module is finished
      highSearchText: apos.util.sortify(title),
      highSearchWords: apos.util.sortify(title).split(/ /),
      body: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            type: '@apostrophecms/rich-text',
            content: '<p>This is some content.</p>'
          }
        ]
      }
    });
    let req = apos.task.getReq();
    for (const item of testItems) {
      await apos.doc.insert(req, item);
    }
  });

  it('should find appropriate events and not others in a page containing all and id-based event widgets', async function() {

    const body = await apos.http.get('/page-with-events');
    // Does it contain the right events via a widget?
    assert(body.match(/Event 010/));
    assert(body.match(/Event 011/));
    assert(body.match(/Event 012/));

    // Are they in the right order (reversed on purpose)?
    let i10 = body.indexOf('Event 010');
    let i11 = body.indexOf('Event 011');
    let i12 = body.indexOf('Event 012');
    assert((i10 > i11) && (i11 > i12));

    // These are by all
    assert(body.match(/Event 001/));
    assert(body.match(/Event 002/));
    assert(body.match(/Event 003/));
    assert(body.match(/Event 004/));
    assert(body.match(/Event 005/));

    // Respect limit by all
    assert(!body.match(/Event 006/));

    // Does it contain events not associated with the widgets?
    assert(!body.match(/Event 040/));

    // Does it contain the featured events in the extra join?
    assert(body.match(/Event 020/));
    assert(body.match(/Event 021/));
    let i20 = body.indexOf('Event 020');
    let i21 = body.indexOf('Event 021');
    // Are they in the right order and in the right place (before the regular stuff)?
    assert(i20 < i10);
    assert(i21 < i10);
  });

});
