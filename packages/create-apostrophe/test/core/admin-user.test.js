import assert from 'node:assert/strict';
import { addAdminUser } from '../../src/core/steps/admin-user.js';
import { StageError } from '../../src/core/errors.js';

describe('core/steps/admin-user', function () {
  it('runs the user:add task with login as username, password over stdin', async function () {
    const calls = [];
    const run = async (command, args, opts) => {
      calls.push({
        command,
        args,
        opts
      });
      return {
        code: 0,
        error: null
      };
    };

    await addAdminUser(
      {
        appRoot: '/proj',
        login: 'me@example.com',
        password: 's3cret'
      },
      { run }
    );

    assert.deepEqual(calls[0].command, 'node');
    assert.deepEqual(calls[0].args, [
      'app.js', '@apostrophecms/user:add', 'me@example.com', 'admin'
    ]);
    assert.equal(calls[0].opts.cwd, '/proj');
    // Password goes over stdin, never as an argument.
    assert.equal(calls[0].opts.input, 's3cret\n');
    assert.ok(!calls[0].args.includes('s3cret'));
  });

  it('requires a login', async function () {
    await assert.rejects(
      () => addAdminUser({
        appRoot: '/p',
        password: 'x'
      }, { run: async () => ({ code: 0 }) }),
      TypeError
    );
  });

  it('non-zero exit → StageError(admin, admin_user_failed); no password leak', async function () {
    const run = async () => ({
      code: 1,
      error: null
    });
    await assert.rejects(
      () => addAdminUser({
        appRoot: '/p',
        login: 'admin',
        password: 'topsecret'
      }, { run }),
      (err) => {
        assert.ok(err instanceof StageError);
        assert.equal(err.stage, 'admin');
        assert.equal(err.errorCode, 'admin_user_failed');
        assert.doesNotMatch(err.message, /topsecret/);
        assert.doesNotMatch(String(err.cause && err.cause.message), /topsecret/);
        return true;
      }
    );
  });

  it('node missing → StageError(admin, node_missing)', async function () {
    const run = async () => ({
      code: null,
      error: Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })
    });
    await assert.rejects(
      () => addAdminUser({
        appRoot: '/p',
        login: 'admin',
        password: 'x'
      }, { run }),
      (err) => {
        assert.equal(err.stage, 'admin');
        assert.equal(err.errorCode, 'node_missing');
        return true;
      }
    );
  });
});
