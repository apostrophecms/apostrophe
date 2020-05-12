let t = require('../test-lib/test.js');
let assert = require('assert');
let _ = require('lodash');

let apos;

describe('Search', function() {

  this.timeout(t.timeout);

  after(async () => {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should be a property of the apos object', async () => {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        '@apostrophecms/express': {
          options: {
            secret: 'xxx',
            port: 7900
          }
        },
        'events': {
          extend: '@apostrophecms/pieces',
          options: {
            name: 'event',
            label: 'Event'
          }
        }
      }
    });
    assert(apos.search);
  });

  it('should add highSearchText, highSearchWords, lowSearchText, searchSummary to all docs on insert', async () => {
    let req = apos.tasks.getReq();
    await apos.docs.insert(req, {
      title: 'Testing Search Event',
      type: 'event',
      tags: ['search', 'test', 'pizza'],
      slug: 'search-test-event',
      published: true
    });

    const doc = await apos.docs.find(req, { slug: 'search-test-event' }).toObject();
    assert(doc.highSearchText);
    assert(doc.highSearchWords);
    assert(doc.lowSearchText);
    assert(doc.searchSummary !== undefined);

    assert(doc.lowSearchText.match(/pizza/));
    assert(doc.highSearchText.match(/testing/));
    assert(_.includes(doc.highSearchWords, 'test', 'pizza', 'testing'));
  });
});
