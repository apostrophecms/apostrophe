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
    apos = await t.create({
      root: module,
      modules: {
        'events': {
          extend: '@apostrophecms/piece-type',
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
    let req = apos.task.getReq();
    await apos.doc.insert(req, {
      title: 'Testing Search Event',
      type: 'event',
      slug: 'search-test-event',
      published: true
    });

    const doc = await apos.doc.find(req, { slug: 'search-test-event' }).toObject();
    assert(doc.highSearchText);
    assert(doc.highSearchWords);
    assert(doc.lowSearchText);
    assert(doc.searchSummary !== undefined);

    assert(doc.highSearchText.match(/testing/));
    assert(_.includes(doc.highSearchWords, 'testing'));
  });
});
