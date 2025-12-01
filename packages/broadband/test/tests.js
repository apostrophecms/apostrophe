const assert = require('assert');
const broadband = require('../index.js');

// Mock mongodb

const data = [];
let i;

for (i = 0; (i < 100); i++) {
  data[i] = { _id: i };
}

function Cursor() {
  const self = this;
  self.i = 0;
  self.nextObjectActive = false;
  self.nextObject = function(callback) {
    if (self.nextObjectActive) {
      throw 'nextObject called concurrently!';
    }
    self.nextObjectActive = true;
    if (self.i === self.failOn) {
      self.nextObjectActive = false;
      return setImmediate(function() {
        return callback('simulated error');
      });
    }
    if (self.i >= data.length) {
      return setImmediate(function() {
        self.nextObjectActive = false;
        return callback(null);
      });
    }
    const result = data[self.i++];

    return setTimeout(function() {
      self.nextObjectActive = false;
      return callback(null, result);
    }, Math.random() * 5);
  };
}

const collection = {
  find: function(criteria) {
    return new Cursor();
  }
};

describe('broadband', function() {
  let completions = 0;
  it('receives all results only once with random timing, never runs nextObject concurrently', function(done) {
    const seen = {};
    this.timeout(7000);

    const cursor = collection.find({});
    return broadband(cursor, 4, function(page, callback) {
      assert(page);
      assert(!seen[page._id]);
      seen[page._id] = true;
      return setTimeout(function() {
        return callback(null);
      }, Math.random() * 50);
    }, function(err) {
      completions++;
      assert(completions === 1);
      assert(!err);
      assert(Object.keys(seen).length === data.length);
      return done();
    });
  });
  it('handles an error on the 80th result gracefully', function(done) {
    let completions = 0;
    const limit = 4;
    let received = 0;
    let completed = 0;
    this.timeout(7000);

    const cursor = collection.find({});
    cursor.failOn = 80;
    let running = 0;
    let maxRunning = 0;
    return broadband(cursor, limit, function(page, callback) {
      received++;
      running++;
      if (running > maxRunning) {
        maxRunning = running;
      }
      return setTimeout(function() {
        running--;
        completed++;
        return callback(null);
      }, Math.random() * 50);
    }, function(err) {
      completions++;
      assert(completions === 1);
      assert(err);
      assert(received === cursor.failOn);
      assert((completed >= cursor.failOn) && (completed < cursor.failOn + limit));
      assert(maxRunning === limit);
      return done();
    });
  });
});
