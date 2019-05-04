const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Promisified Events: apostrophe-docs:beforeInsert', function() {

  this.timeout(50000);

  after(function() {
    return t.destroy(apos);
  });

  let apos;
  let coreEventsWork = false;

  it('should implement apostrophe-docs:beforeInsert handlers properly', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test2',
      argv: {
        _: []
      },
      modules: {
        'test1': {
          alias: 'test1',
          construct: function(self, options) {
            self.on('apostrophe-docs:beforeInsert', 'beforeInsertReverseTitle', function(req, doc, options) {
              if (doc.type === 'default') {
                return Promise.delay(50).then(function() {
                  doc.title = doc.title.split('').reverse().join('');
                });
              }
            });

            self.on('apostrophe:modulesReady', 'modulesReadyCoreEventsWork', function() {
              coreEventsWork = true;
            });
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
    assert(doc.title === 'Test');
    assert(coreEventsWork);
  });
});
