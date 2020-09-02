const t = require('../test-lib/test.js');
const assert = require('assert');
const Promise = require('bluebird');

describe('Promisified Events Core', function() {
  this.timeout(50000);

  let apos;

  after(function() {
    return t.destroy(apos);
  });

  it('should execute handlers for several events in the proper order', async function() {
    let niceFinished = false;
    apos = await t.create({
      root: module,
      modules: {
        test1: {
          options: {
            alias: 'test1'
          },
          handlers(self) {
            return {
              ready1: {
                async ready1AddA(context) {
                  await Promise.delay(100);
                  assert(!context.b);
                  context.a = true;
                }
              },
              ready2: {
                async ready2AddB(context) {
                  assert(context.a);
                  context.b = true;
                },
                async ready2AddC(context) {
                  await Promise.delay(10);
                  assert(context.a);
                  assert(context.b);
                  context.c = true;
                }
              },
              ready3: {
                async ready3HeyNice() {
                  await Promise.delay(100);
                  niceFinished = true;
                }
              },
              'apostrophe:modulesReady': {
                async testHandlers() {
                  assert(self.ready2AddC);
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
                }
              }
            };
          }
        },
        test2: {
          options: {
            alias: 'test2'
          },
          handlers(self) {
            return {
              'test1:ready1': {
                ready1SetD(context) {
                  context.d = true;
                }
              }
            };
          }
        },
        test3: {
          options: {
            alias: 'test3'
          }
        }
      }
    });
    assert(niceFinished);
  });
});
