var t = require('../test-lib/test.js');
var assert = require('assert');
var Promise = require('bluebird');

describe('Promisified Events Core', function() {

  this.timeout(50000);

  var apos;

  after(function(done) {
    return t.destroy(apos, done);
  });

  it('should execute handlers for several events in the proper order', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      modules: {
        'test1': {
          alias: 'test1',
          construct: function(self, options) {
            var sameNameFail = false;
            var niceFinished = false;
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
            self.modulesReady = function(callback) {
              var context = {};
              return self.emit('ready1', context).then(function() {
                assert(context.a);
                return self.emit('ready2', context);
              }).then(function() {
                assert(context.a);
                assert(context.b);
                assert(context.c);
                return self.emit('ready3');
              }).then(function() {
                assert(context.a);
                assert(context.b);
                assert(context.c);
                assert(context.d);
                assert(niceFinished);
                assert(true);
                done();
              });
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
              // event name and method name being the same should fail, even for cross-module events
            }
          }
        },
        'test3': {
          alias: 'test3'
        }
      },
      afterInit: function(callback) {
        callback();
        return done();
      }
    });
  });

});
