import assert from 'node:assert/strict';
import { addAdminUser } from '../../src/core/steps/admin-user.js';
import { StageError } from '../../src/core/errors.js';

describe('core/steps/admin-user', function () {
  it('runs the user:add task with the username, password over stdin', async function () {
    const calls = [];
    const run = async (command, args, opts) => {
      calls.push({
        command,
        args,
        opts
      });
      return {
        code: 0,
        stdout: '',
        stderr: '',
        error: null
      };
    };

    const outcome = await addAdminUser(
      {
        appRoot: '/proj',
        username: 'me@example.com',
        password: 's3cret'
      },
      { run }
    );

    assert.equal(outcome, 'created');
    assert.deepEqual(calls[0].command, 'node');
    assert.deepEqual(calls[0].args, [
      'app.js', '@apostrophecms/user:add', 'me@example.com', 'admin'
    ]);
    assert.equal(calls[0].opts.cwd, '/proj');
    // Password goes over stdin, never as an argument.
    assert.equal(calls[0].opts.input, 's3cret\n');
    assert.ok(!calls[0].args.includes('s3cret'));
  });

  for (const variant of [
    {
      adapter: 'mongo',
      stderr: 'E11000 duplicate key error collection: my-project.aposUsersSafe index: username_1 dup key: { username: "admin" }'
    },
    {
      adapter: 'postgres',
      stderr: 'Duplicate key error: username "admin" already exists'
    },
    {
      adapter: 'sqlite',
      stderr: 'Duplicate key error: already exists'
    }
  ]) {
    it(`duplicate-username (${variant.adapter}) → falls back to change-password; returns "updated"`, async function () {
      const calls = [];
      const run = async (command, args, opts) => {
        calls.push({
          command,
          args,
          opts
        });
        if (args[1] === '@apostrophecms/user:add') {
          return {
            code: 1,
            stdout: '',
            stderr: variant.stderr,
            error: null
          };
        }
        return {
          code: 0,
          stdout: '',
          stderr: '',
          error: null
        };
      };

      const outcome = await addAdminUser(
        {
          appRoot: '/proj',
          username: 'admin',
          password: 'pw'
        },
        { run }
      );

      assert.equal(outcome, 'updated');
      assert.equal(calls.length, 2);
      assert.deepEqual(calls[1].args, [
        'app.js', '@apostrophecms/user:change-password', 'admin'
      ]);
      assert.equal(calls[1].opts.input, 'pw\n');
      assert.ok(!calls[1].args.includes('pw'));
    });
  }

  it('non-duplicate non-zero exit → no fallback, original StageError stands', async function () {
    const calls = [];
    const run = async (command, args, opts) => {
      calls.push({
        command,
        args,
        opts
      });
      return {
        code: 1,
        stdout: '',
        stderr: 'Database connection lost',
        error: null
      };
    };

    await assert.rejects(
      () => addAdminUser({
        appRoot: '/p',
        username: 'admin',
        password: 'x'
      }, { run }),
      (err) => {
        assert.equal(err.errorCode, 'admin_user_failed');
        return true;
      }
    );
    // change-password must NOT have been attempted.
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].args[1], '@apostrophecms/user:add');
  });

  it('fallback fails too → original admin_user_failed propagates', async function () {
    const run = async (command, args) => ({
      code: 1,
      stdout: '',
      stderr: args[1] === '@apostrophecms/user:add'
        ? 'E11000 duplicate key error index: username_1'
        : 'No such user.',
      error: null
    });

    await assert.rejects(
      () => addAdminUser({
        appRoot: '/p',
        username: 'admin',
        password: 'x'
      }, { run }),
      (err) => {
        assert.equal(err.errorCode, 'admin_user_failed');
        return true;
      }
    );
  });

  it('requires a username', async function () {
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
      stdout: '',
      stderr: 'Something unrelated went wrong',
      error: null
    });
    await assert.rejects(
      () => addAdminUser({
        appRoot: '/p',
        username: 'admin',
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
        username: 'admin',
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
