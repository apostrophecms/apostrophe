const t = require('../test-lib/test.js');
const assert = require('assert');
const Promise = require('bluebird');

describe('Promisified Events: apostrophe-doc-type-manager:beforeInsert', function() {
  this.timeout(50000);

  after(function() {
    return t.destroy(apos);
  });

  let apos;
  let coreEventsWork = false;

  it('should implement apostrophe-doc-type-manager:beforeInsert handlers properly', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        'test1': {
          alias: 'test1',
          construct: function(self, options) {
            self.on(
              'apostrophe-doc-type-manager:beforeInsert', 'beforeInsertReverseTitle',
              async function(req, doc, options) {
                if (doc.type === 'default') {
                  await Promise.delay(50);

                  doc.title = doc.title.split('').reverse().join('');
                }
              }
            );

            self.on(
              'apostrophe:modulesReady', 'modulesReadyCoreEventsWork',
              function() {
                coreEventsWork = true;
              }
            );
          }
        },
        'apostrophe-pages': {
          park: [
            {
              type: 'default',
              findMeAgain: true,
              title: 'Test',
              slug: '/test',
              published: true
            }
          ]
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
