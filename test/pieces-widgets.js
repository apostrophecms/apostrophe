const t = require('../test-lib/test.js');
const assert = require('assert');
const request = require('request-promise');

describe('Pieces Widgets', function() {

  let apos;

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
    });
  });

  it('should be able to use db to insert test pieces', async function() {
    assert(apos.modules['events-widgets']);
    let testItems = [];
    let total = 100;
    for (let i = 1; (i <= total); i++) {
      let paddedInt = apos.launder.padInteger(i, 3);
      let tags;
      if (i > 50) {
        tags = [ 'tag2' ];
      } else {
        tags = [ 'tag1' ];
      }
      let title = 'Event ' + paddedInt;
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
    const paddedInt = 'wiggly';
    const title = 'Event Wiggly';
    const tags = [];
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
    const req = apos.tasks.getReq();
    for (const item of testItems) {
      await apos.docs.insert(req, item);
    }
  });

  it('should find appropriate events and not others in a page containing tag and id-based event widgets', async function() {

    const body = await request('http://localhost:7900/page-with-events');
    // Does it contain the right events via a widget?
    assert(body.match(/Event 005/));
    assert(body.match(/Event 006/));
    assert(body.match(/Event 007/));

    // Are they in the right order (reversed on purpose)?
    let i5 = body.indexOf('Event 005');
    let i6 = body.indexOf('Event 006');
    let i7 = body.indexOf('Event 007');
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
    apos = await require('../index.js')({
      argv: {
        _: []
      },
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
      }
    });
  });

  it('should be able to use db to insert test pieces', async function() {
    assert(apos.modules['events-widgets']);
    let testItems = [];
    let total = 100;
    for (let i = 1; (i <= total); i++) {
      let paddedInt = apos.launder.padInteger(i, 3);
      let tags;
      if (i > 50) {
        tags = [ 'tag2' ];
      } else {
        tags = [ 'tag1' ];
      }
      let title = 'Event ' + paddedInt;
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
    const paddedInt = 'wiggly';
    const title = 'Event Wiggly';
    const tags = [];
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
    let req = apos.tasks.getReq();
    for (const item of testItems) {
      await apos.docs.insert(req, item);
    }
  });

  it('should find appropriate events and not others in a page containing tag and id-based event widgets', async function() {

    const body = await request('http://localhost:7900/page-with-events');
    // Does it contain the right events via a widget?
    assert(body.match(/Event 005/));
    assert(body.match(/Event 006/));
    assert(body.match(/Event 007/));

    // Are they in the right order (reversed on purpose)?
    let i5 = body.indexOf('Event 005');
    let i6 = body.indexOf('Event 006');
    let i7 = body.indexOf('Event 007');
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
    let i3 = body.indexOf('Event 003');
    let i4 = body.indexOf('Event 004');
    // Are they in the right order and in the right place (before the regular stuff)?
    assert(i3 < i7);
    assert(i4 < i7);
    assert(i3 < i4);
  });

});
