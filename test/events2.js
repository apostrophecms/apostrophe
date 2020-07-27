const t = require('../test-lib/test.js');
const assert = require('assert');
const Promise = require('bluebird');

describe('Promisified Events: @apostrophecms/doc-type:beforeInsert', function() {
  this.timeout(50000);

  after(function() {
    return t.destroy(apos);
  });

  let apos;
  let coreEventsWork = false;

  it('should implement @apostrophecms/doc-type:beforeInsert handlers properly', async function() {
    apos = await t.create({
      root: module,
      modules: {
        'test1': {
          options: {
            alias: 'test1'
          },
          handlers(self) {
            return {
              '@apostrophecms/doc-type:beforeInsert': {
                async beforeInsertReverseTitle(req, doc, options) {
                  if (doc.type === 'default-page') {
                    await Promise.delay(50);
                    doc.title = doc.title.split('').reverse().join('');
                  }
                }
              },
              'apostrophe:modulesReady': {
                modulesReadyCoreEventsWork() {
                  coreEventsWork = true;
                }
              }
            };
          }
        },
        'default-page': {
          extend: '@apostrophecms/page-type'
        },
        '@apostrophecms/page': {
          options: {
            park: [
              {
                type: 'default-page',
                findMeAgain: true,
                title: 'Test',
                slug: '/test',
                published: true,
                parkedId: 'test'
              }
            ]
          }
        }
      }
    });
  });

  it('should find the results', async function() {
    const doc = await apos.doc.db.findOne({ findMeAgain: true });

    assert(doc);
    assert.strictEqual(doc.title, 'tseT');
    assert(coreEventsWork);
  });
});
