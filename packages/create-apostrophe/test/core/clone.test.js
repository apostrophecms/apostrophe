import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, mkdirSync, existsSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clone } from '../../src/core/steps/clone.js';
import { StageError } from '../../src/core/errors.js';

describe('core/steps/clone', function () {
  let cwd;

  beforeEach(function () {
    cwd = mkdtempSync(join(tmpdir(), 'ca-clone-'));
  });

  afterEach(function () {
    rmSync(cwd, {
      recursive: true,
      force: true
    });
  });

  it('invokes no-shell git with an end-of-options guard, then strips .git', async function () {
    const calls = [];
    // Fake `run` that simulates a successful clone by materializing the
    // project dir + a .git/ the step is expected to remove.
    const fakeRun = async (command, args, opts) => {
      calls.push({
        command,
        args,
        opts
      });
      const dir = join(opts.cwd, 'my-site');
      mkdirSync(join(dir, '.git', 'refs'), { recursive: true });
      writeFileSync(join(dir, 'app.js'), '// project');
      return {
        code: 0,
        stdout: '',
        stderr: '',
        error: null
      };
    };

    const { projectDir } = await clone(
      {
        repo: 'https://github.com/apostrophecms/public-demo.git',
        shortName: 'my-site',
        cwd
      },
      { run: fakeRun }
    );

    assert.deepEqual(calls[0].command, 'git');
    assert.deepEqual(calls[0].args, [
      'clone', '--', 'https://github.com/apostrophecms/public-demo.git', 'my-site'
    ]);
    assert.equal(projectDir, join(cwd, 'my-site'));
    assert.equal(existsSync(join(projectDir, 'app.js')), true);
    assert.equal(existsSync(join(projectDir, '.git')), false, '.git must be stripped');
  });

  it('rejects a path-traversal shortName before spawning git', async function () {
    let spawned = false;
    const fakeRun = async () => {
      spawned = true; return { code: 0 };
    };
    for (const bad of [ '../evil', 'a/b', '/abs', '..', 'na me', '.' ]) {
      await assert.rejects(
        () => clone({
          repo: 'r',
          shortName: bad,
          cwd
        }, { run: fakeRun }),
        TypeError
      );
    }
    assert.equal(spawned, false, 'git must not be spawned for an unsafe name');
  });

  it('throws StageError(clone, git_missing) when git is absent', async function () {
    const fakeRun = async () => ({
      code: null,
      stdout: '',
      stderr: '',
      error: Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' })
    });
    await assert.rejects(
      () => clone({
        repo: 'r',
        shortName: 's',
        cwd
      }, { run: fakeRun }),
      (err) => {
        assert.ok(err instanceof StageError);
        assert.equal(err.stage, 'clone');
        assert.equal(err.errorCode, 'git_missing');
        return true;
      }
    );
  });

  it('throws StageError(clone, git_clone_failed) on a non-zero exit', async function () {
    const fakeRun = async () => ({
      code: 128,
      stdout: '',
      stderr: 'fatal: repository not found',
      error: null
    });
    await assert.rejects(
      () => clone({
        repo: 'r',
        shortName: 's',
        cwd
      }, { run: fakeRun }),
      (err) => {
        assert.equal(err.stage, 'clone');
        assert.equal(err.errorCode, 'git_clone_failed');
        // Raw stderr must not leak into the symbolic errorCode (D7).
        assert.ok(!String(err.errorCode).includes('fatal'));
        return true;
      }
    );
  });
});
