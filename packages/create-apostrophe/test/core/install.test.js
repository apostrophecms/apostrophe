import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install } from '../../src/core/steps/install.js';
import { StageError, UnsupportedPackageManagerError } from '../../src/core/errors.js';

function fakeRunFactory(calls, { code = 0, error = null } = {}) {
  return async (command, args, opts) => {
    calls.push({
      command,
      args,
      cwd: opts.cwd
    });
    if (!error && code === 0) {
      mkdirSync(join(opts.cwd, 'node_modules', 'apostrophe'), { recursive: true });
    }
    return {
      code,
      stdout: '',
      stderr: '',
      error
    };
  };
}

describe('core/steps/install', function () {
  let dir;

  beforeEach(function () {
    dir = mkdtempSync(join(tmpdir(), 'ca-install-'));
  });

  afterEach(function () {
    rmSync(dir, {
      recursive: true,
      force: true
    });
  });

  it('standalone: one npm install in appRoot, lockfile preserved', async function () {
    const projectDir = join(dir, 'proj');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'package-lock.json'), '{}');

    const calls = [];
    const res = await install(
      {
        projectDir,
        appRoot: projectDir,
        packageManager: 'npm'
      },
      { run: fakeRunFactory(calls) }
    );

    assert.deepEqual(res, { packageManager: 'npm' });
    assert.deepEqual(calls, [ {
      command: 'npm',
      args: [ 'install' ],
      cwd: projectDir
    } ]);
    // Lockfile is no longer purged.
    assert.equal(existsSync(join(projectDir, 'package-lock.json')), true);
  });

  it('external frontend: npm install in backend/ then frontend/', async function () {
    const projectDir = join(dir, 'proj');
    const appRoot = join(projectDir, 'backend');
    mkdirSync(appRoot, { recursive: true });
    mkdirSync(join(projectDir, 'frontend'), { recursive: true });

    const calls = [];
    await install(
      {
        projectDir,
        appRoot,
        frontend: 'astro',
        packageManager: 'npm'
      },
      { run: fakeRunFactory(calls) }
    );

    assert.deepEqual(calls.map((c) => [ c.command, c.cwd ]), [
      [ 'npm', appRoot ],
      [ 'npm', join(projectDir, 'frontend') ]
    ]);
  });

  it('unknown pm runs npm, reports \'unknown\'', async function () {
    const projectDir = join(dir, 'proj');
    mkdirSync(projectDir, { recursive: true });
    const calls = [];
    const res = await install(
      {
        projectDir,
        appRoot: projectDir,
        packageManager: 'unknown'
      },
      { run: fakeRunFactory(calls) }
    );
    assert.equal(calls[0].command, 'npm');
    assert.equal(res.packageManager, 'unknown');
  });

  it('rejects pnpm/yarn before any work, without spawning', async function () {
    const projectDir = join(dir, 'proj');
    mkdirSync(projectDir, { recursive: true });
    for (const pm of [ 'pnpm', 'yarn' ]) {
      let spawned = false;
      await assert.rejects(
        () => install(
          {
            projectDir,
            appRoot: projectDir,
            packageManager: pm
          },
          {
            run: async () => {
              spawned = true; return { code: 0 };
            }
          }
        ),
        (err) => {
          assert.ok(err instanceof UnsupportedPackageManagerError);
          assert.equal(err.packageManager, pm);
          return true;
        }
      );
      assert.equal(spawned, false);
    }
  });

  it('npm missing → StageError(dependency_install, npm_missing)', async function () {
    const projectDir = join(dir, 'proj');
    mkdirSync(projectDir, { recursive: true });
    const run = async () => ({
      code: null,
      error: Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })
    });
    await assert.rejects(
      () => install({
        projectDir,
        appRoot: projectDir,
        packageManager: 'npm'
      }, { run }),
      (err) => {
        assert.ok(err instanceof StageError);
        assert.equal(err.stage, 'dependency_install');
        assert.equal(err.errorCode, 'npm_missing');
        return true;
      }
    );
  });

  it('non-zero exit → StageError(dependency_install, install_failed)', async function () {
    const projectDir = join(dir, 'proj');
    mkdirSync(projectDir, { recursive: true });
    await assert.rejects(
      () => install(
        {
          projectDir,
          appRoot: projectDir,
          packageManager: 'npm'
        },
        { run: fakeRunFactory([], { code: 1 }) }
      ),
      (err) => {
        assert.equal(err.errorCode, 'install_failed');
        return true;
      }
    );
  });

  it('apostrophe absent after install → apostrophe_missing', async function () {
    const projectDir = join(dir, 'proj');
    mkdirSync(projectDir, { recursive: true });
    const run = async () => ({
      code: 0,
      error: null
    });
    await assert.rejects(
      () => install({
        projectDir,
        appRoot: projectDir,
        packageManager: 'npm'
      }, { run }),
      (err) => {
        assert.equal(err.stage, 'dependency_install');
        assert.equal(err.errorCode, 'apostrophe_missing');
        return true;
      }
    );
  });
});
