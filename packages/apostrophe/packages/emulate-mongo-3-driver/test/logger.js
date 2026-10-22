const assert = require('assert/strict');
const mongo = require('../index.js');

describe('logger', function() {
  it('logger.setLevel', function() {
    assert.doesNotThrow(
      () => {
        mongo.Logger.setLevel('info');
      }
    );
  });
});
