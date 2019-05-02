let t = require('../test-lib/test.js');
let assert = require('assert');
let Promise = require('bluebird');

describe('Promisified Events Core', function() {

  this.timeout(50000);

  let apos;

  after(async function() {
    return t.destroy(apos);
  });

  it('should execute handlers for several events in the proper order', async function() {
    let invoked = false;
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
            self.ready1AddA = async function(context) {
              await Promise.delay(100);
              assert(!context.b);
              context.a = true;
            };
            self.on('ready2', 'ready2AddB');
            self.ready2AddB = function(context) {
              assert(context.a);
              context.b = true;
            };
            self.on('ready3', 'ready3HeyNice');
            self.ready3HeyNice = async function() {
              await Promise.delay(100);
              niceFinished = true;
            };
            self.on('ready2', 'ready2AddC', async function(context) {
              await Promise.delay(10);
              assert(context.a);
              assert(context.b);
              context.c = true;
            });
            assert(self.ready2AddC);
            self.on('apostrophe:modulesReady', 'testEvents', async function() {
              let context = {};
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
              assert(true);
              invoked = true;
            });
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
              // event name and method name being the same should fail, even for cross-module events
            }
          }
        },
        'test3': {
          alias: 'test3'
        }
      }
    });
    assert(invoked);
  });

});
