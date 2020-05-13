const t = require('../test-lib/test.js');
const assert = require('assert');
const Promise = require('bluebird');

describe('Promisified Events: @apostrophecms/doc-type-manager:beforeInsert', function() {
  this.timeout(50000);

  after(function() {
    return t.destroy(apos);
  });

  let apos;
  let coreEventsWork = false;

  it('should implement @apostrophecms/doc-type-manager:beforeInsert handlers properly', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        'test1': {
          alias: 'test1',
          handlers(self) {
            return {
              '@apostrophecms/doc-type-manager:beforeInsert': {
                async beforeInsertReverseTitle(req, doc, options) {
                  if (doc.type === 'default') {
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
        '@apostrophecms/pages': {
          options: {
            park: [
              {
                type: 'default',
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
    const doc = await apos.docs.db.findOne({ findMeAgain: true });

    assert(doc);
    assert.strictEqual(doc.title, 'tseT');
    assert(coreEventsWork);
  });
});
