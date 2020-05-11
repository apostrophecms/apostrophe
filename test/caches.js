var t = require('../test-lib/test.js');
var assert = require('assert');

describe('Caches', function() {

  after(function(done) {
    return t.destroy(apos, done);
  });

  this.timeout(t.timeout);

  var apos;
  var cache;
  it('should exist on the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',

      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900,
          csrf: false
        }
      },

      afterInit: function(callback) {
        assert(apos.caches);
        apos.argv._ = [];
        return callback(null);
      },

      afterListen: function(err) {
        console.error(err);
        assert(!err);
        return done();
      }
    });
  });
  it('should give us a cache object', function() {
    cache = apos.caches.get('testMonkeys');
  });
  it('should not crash on clear', function(done) {
    cache.clear(done);
  });
  it('should not contain capuchin yet', function(done) {
    return cache.get('capuchin', function(err, monkey) {
      assert(!err);
      assert(!monkey);
      return done();
    });
  });
  it('should allow us to store capuchin', function(done) {
    return cache.set('capuchin', { message: 'eek eek' }, function(err) {
      assert(!err);
      return done();
    });
  });
  it('should now contain capuchin', function(done) {
    return cache.get('capuchin', function(err, monkey) {
      assert(!err);
      assert(monkey);
      assert(monkey.message === 'eek eek');
      return done();
    });
  });
  it('should not crash on clear #2', function(done) {
    cache.clear(done);
  });
  it('should not contain capuchin anymore', function(done) {
    return cache.get('capuchin', function(err, monkey) {
      assert(!err);
      assert(!monkey);
      return done();
    });
  });

  it('should not crash on clear with promise', function() {
    return cache.clear();
  });
  it('should not contain capuchin yet', function() {
    return cache.get('capuchin')
      .then(function(monkey) {
        assert(!monkey);
        return true;
      });
  });
  it('should allow us to store capuchin', function() {
    return cache.set('capuchin', { message: 'eek eek' });
  });
  it('should now contain capuchin', function() {
    return cache.get('capuchin')
      .then(function(monkey) {
        assert(monkey);
        assert(monkey.message === 'eek eek');
        return true;
      });
  });
  it('should allow us to store a value with a lifetime using a promise', function() {
    return cache.set('colobus', { message: 'oop oop' }, 86400);
  });
  it('should now contain colobus', function() {
    return cache.get('colobus')
      .then(function(monkey) {
        assert(monkey);
        assert(monkey.message === 'oop oop');
        return true;
      });
  });
  it('should not crash on clear #2', function() {
    return cache.clear();
  });
  it('should not contain capuchin anymore', function() {
    return cache.get('capuchin')
      .then(function(monkey) {
        assert(!monkey);
        return true;
      });
  });
});
