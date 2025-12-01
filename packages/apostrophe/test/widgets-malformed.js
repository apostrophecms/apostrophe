const t = require('../test-lib/test.js');
const { spawn } = require('child_process');
const assert = require('assert');

describe('Malformed Widgets', function () {
  this.timeout(t.timeout);

  it('should fail to initialize with a schema containing a field named "type"', function (done) {
    let throwsError = true;
    const mochaProcess = spawn('node', [ './test/widgets-children/widgets-malformed-child.js' ]);

    mochaProcess.stderr.on('data', (data) => {
      const errorMsg = data.toString();
      const errorMatch = errorMsg.match(/(?<error>Error:.*\n)/);
      if (errorMatch) {
        throwsError = true;
        assert.equal(errorMatch.groups.error, 'Error: The malformed module contains a forbidden field property name: "type".\n');
      } else {
        throwsError = false;
      }
    });

    mochaProcess.on('close', (code) => {
      assert.equal(code, 1, 'Mocha process exited with status code 0');
      assert.ok(throwsError, 'Error message not found in stderr');
      done();
    });
  });
});
