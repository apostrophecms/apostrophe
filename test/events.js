const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Promisified Events Core', function() {
  this.timeout(50000);

  let apos;

  after(function() {
    return t.destroy(apos);
  });

  it('should execute handlers for several events in the proper order', async function() {
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
            let sameNameFail = false;
            let niceFinished = false;

            try {
              self.on('ready1', 'ready1');
            } catch (e) {
              sameNameFail = true;
            }

            assert(sameNameFail);

            self.on('ready1', 'ready1AddA');
            self.ready1AddA = function(context) {
              return Promise.delay(100).then(function() {
                assert(!context.b);
                context.a = true;
              });
            };

            self.on('ready2', 'ready2AddB');
            self.ready2AddB = function(context) {
              assert(context.a);
              context.b = true;
            };

            self.on('ready3', 'ready3HeyNice');
            self.ready3HeyNice = function() {
              return Promise.delay(100).then(function() {
                niceFinished = true;
              });
            };

            self.on('ready2', 'ready2AddC', function(context) {
              return Promise.delay(10).then(function() {
                assert(context.a);
                assert(context.b);
                context.c = true;
              });
            });

            assert(self.ready2AddC);

            self.modulesReady = async function() {
              const context = {};
              await self.emit('ready1', context);

              assert(context.a);
              await self.emit('ready2', context);

              assert(context.a);
              assert(context.b);
              assert(context.c);

              await self.emit('ready3');

              assert(context.a);
              assert(context.b);
              assert(context.c);
              assert(context.d);
              assert(niceFinished);
            };
          }
        },
        'test2': {
          alias: 'test2',
          construct: function(self, options) {
            self.on('test1:ready1', 'ready1SetD', function(context) {
              context.d = true;
            });

            try {
              self.on('test1:ready1', 'ready1', function(context) {
                context.d = true;
              });
            } catch (e) {
              // Event name and method name being the same should fail, even
              // for cross-module events.
              assert(e);
            }
          }
        },
        'test3': {
          alias: 'test3'
        }
      }
    });
  });
});
