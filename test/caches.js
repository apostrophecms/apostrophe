var assert = require('assert');

describe('Caches', function() {

  this.timeout(5000);

  after(function() {
    apos.db.dropDatabase();
  });

  var apos;
  var cache;
  it('should exist on the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      
      afterInit: function(callback) {
          assert(apos.caches);
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
});
