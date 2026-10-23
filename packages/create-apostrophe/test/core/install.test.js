import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  install, npmInstallCommand, npmCommand
} from '../../src/core/steps/install.js';
import { StageError, UnsupportedPackageManagerError } from '../../src/core/errors.js';

function fakeRunFactory(calls, {
  code = 0, error = null, npmVersion = '11.6.0', versionCode = 0
} = {}) {
  return async (command, args, opts) => {
    calls.push({
      command,
      args,
      cwd: opts.cwd
    });
    if (args.at(-1) === '--version') {
      return {
        code: versionCode,
        stdout: `${npmVersion}\n`,
        stderr: '',
        error: null
      };
    }
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

// The Windows branch is asserted here rather than in the install() tests
// below so it is covered on every platform: CI does not run on Windows, and
// this is the one piece of the step whose correctness is Windows-specific.
describe('core/steps/install npmInstallCommand', function () {
  it('posix: spawns npm directly', function () {
    assert.deepEqual(npmInstallCommand('linux'), [ 'npm', [ 'install' ] ]);
    assert.deepEqual(npmInstallCommand('darwin'), [ 'npm', [ 'install' ] ]);
  });

  it('win32: goes through the command interpreter', function () {
    // npm on Windows is npm.cmd, a batch file. CreateProcess can't run it and
    // libuv's PATH search only tries .com/.exe, so a bare spawn('npm') is
    // ENOENT; naming npm.cmd is EINVAL without a shell (CVE-2024-27980 fix).
    const [ command, args ] = npmInstallCommand('win32');
    assert.match(command, /cmd\.exe$/i);
    assert.deepEqual(args, [ '/d', '/s', '/c', 'npm', 'install' ]);
  });

  it('npmCommand: same shape for other npm subcommands', function () {
    assert.deepEqual(npmCommand([ '--version' ], 'linux'), [ 'npm', [ '--version' ] ]);
    assert.deepEqual(
      npmCommand([ '--version' ], 'win32')[1],
      [ '/d', '/s', '/c', 'npm', '--version' ]
    );
  });

  it('win32: honors ComSpec when set', function () {
    const saved = process.env.ComSpec;
    process.env.ComSpec = 'C:\\Windows\\System32\\cmd.exe';
    try {
      assert.equal(npmInstallCommand('win32')[0], 'C:\\Windows\\System32\\cmd.exe');
    } finally {
      if (saved === undefined) {
        delete process.env.ComSpec;
      } else {
        process.env.ComSpec = saved;
      }
    }
  });
});

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

  it('standalone: npm install twice in appRoot, lockfile preserved', async function () {
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
    const call = {
      command: 'npm',
      args: [ 'install' ],
      cwd: projectDir
    };
    assert.deepEqual(calls, [ call, call ]);
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

    const order = [
      [ 'npm', appRoot ],
      [ 'npm', join(projectDir, 'frontend') ]
    ];
    assert.deepEqual(calls.map((c) => [ c.command, c.cwd ]), [ ...order, ...order ]);
  });

  it('external frontend + root package.json: backend → frontend → root', async function () {
    // Newer Astro kits ship a root package.json with orchestration deps
    // (concurrently) so a single `npm run dev` runs both apps. Without
    // installing the root, `npm run dev` fails with "concurrently: not found".
    const projectDir = join(dir, 'proj');
    const appRoot = join(projectDir, 'backend');
    mkdirSync(appRoot, { recursive: true });
    mkdirSync(join(projectDir, 'frontend'), { recursive: true });
    writeFileSync(join(projectDir, 'package.json'), '{}');

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

    // Root install runs LAST so its (potentially redundant) recursion into
    // workspaces hits an already-warm cache.
    const order = [
      [ 'npm', appRoot ],
      [ 'npm', join(projectDir, 'frontend') ],
      [ 'npm', projectDir ]
    ];
    assert.deepEqual(calls.map((c) => [ c.command, c.cwd ]), [ ...order, ...order ]);
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

  describe('packageManager guard (pnpm launches)', function () {
    const readPkg = (projectDir) => readFileSync(join(projectDir, 'package.json'), 'utf8');

    async function runInstall(pm, projectDir, runOpts = {}, extra = {}) {
      const calls = [];
      const res = await install(
        {
          projectDir,
          appRoot: projectDir,
          packageManager: pm,
          ...extra
        },
        { run: fakeRunFactory(calls, runOpts) }
      );
      return {
        calls,
        res
      };
    }

    function project(pkgText = '{\n  "name": "x"\n}\n') {
      const projectDir = join(dir, 'proj');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'package.json'), pkgText);
      return projectDir;
    }

    it('pnpm → pins the npm that ran the install', async function () {
      const projectDir = project();
      const { calls } = await runInstall('pnpm', projectDir);
      assert.deepEqual(calls.map((c) => c.args.at(-1)), [ 'install', 'install', '--version' ]);
      assert.equal(
        readPkg(projectDir),
        '{\n  "name": "x",\n  "packageManager": "npm@11.6.0"\n}\n'
      );
    });

    it('npm and unknown → package.json untouched, no version check', async function () {
      for (const pm of [ 'npm', 'unknown' ]) {
        const projectDir = project();
        const { calls } = await runInstall(pm, projectDir);
        assert.deepEqual(calls.map((c) => c.args.at(-1)), [ 'install', 'install' ], pm);
        assert.equal(readPkg(projectDir), '{\n  "name": "x"\n}\n', pm);
        rmSync(projectDir, {
          recursive: true,
          force: true
        });
      }
    });

    it('external frontend → every installed package.json is pinned', async function () {
      const projectDir = join(dir, 'proj');
      const appRoot = join(projectDir, 'backend');
      for (const d of [ projectDir, appRoot, join(projectDir, 'frontend') ]) {
        mkdirSync(d, { recursive: true });
        writeFileSync(join(d, 'package.json'), '{ "name": "x" }\n');
      }
      await install(
        {
          projectDir,
          appRoot,
          frontend: 'astro',
          packageManager: 'pnpm'
        },
        { run: fakeRunFactory([]) }
      );
      for (const d of [ projectDir, appRoot, join(projectDir, 'frontend') ]) {
        assert.equal(JSON.parse(readPkg(d)).packageManager, 'npm@11.6.0', d);
      }
    });

    it('keeps tabs, CRLF and a missing trailing newline', async function () {
      const tabs = project('{\r\n\t"name": "x"\r\n}');
      await runInstall('pnpm', tabs);
      assert.equal(
        readPkg(tabs),
        '{\r\n\t"name": "x",\r\n\t"packageManager": "npm@11.6.0"\r\n}'
      );
    });

    it('never replaces a packageManager the kit declares', async function () {
      const text = '{\n  "name": "x",\n  "packageManager": "npm@10.0.0"\n}\n';
      const projectDir = project(text);
      await runInstall('pnpm', projectDir);
      assert.equal(readPkg(projectDir), text);
    });

    it('npm --version failing or odd → install still succeeds, nothing written', async function () {
      for (const runOpts of [ { versionCode: 1 }, { npmVersion: 'npm WARN something' } ]) {
        const projectDir = project();
        const { res } = await runInstall('pnpm', projectDir, runOpts);
        assert.equal(res.packageManager, 'pnpm');
        assert.equal(readPkg(projectDir), '{\n  "name": "x"\n}\n');
        rmSync(projectDir, {
          recursive: true,
          force: true
        });
      }
    });
  });

  it('pnpm → runs npm, reports pnpm', async function () {
    const projectDir = join(dir, 'proj');
    mkdirSync(join(projectDir, 'node_modules', 'apostrophe'), { recursive: true });
    const calls = [];
    const res = await install(
      {
        projectDir,
        appRoot: projectDir,
        packageManager: 'pnpm'
      },
      { run: fakeRunFactory(calls) }
    );
    assert.equal(calls[0].command, 'npm');
    assert.equal(res.packageManager, 'pnpm');
  });

  it('rejects yarn before any work, without spawning', async function () {
    const projectDir = join(dir, 'proj');
    mkdirSync(projectDir, { recursive: true });
    for (const pm of [ 'yarn' ]) {
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

  describe('second install', function () {
    // npm's first install without a lockfile is not final (fsevents dropped
    // on macOS, gcp-metadata misplaced); the second pass settles the tree.
    function project() {
      const projectDir = join(dir, 'proj');
      mkdirSync(projectDir, { recursive: true });
      return projectDir;
    }

    it('runs after every first install has succeeded', async function () {
      const projectDir = project();
      const calls = [];
      let firstPassDone = false;
      const inner = fakeRunFactory(calls);
      const run = async (command, args, opts) => {
        if (calls.length === 1) {
          // The second call sees apostrophe already installed.
          firstPassDone = existsSync(join(projectDir, 'node_modules', 'apostrophe'));
        }
        return inner(command, args, opts);
      };
      await install({
        projectDir,
        appRoot: projectDir,
        packageManager: 'npm'
      }, { run });
      assert.equal(calls.length, 2);
      assert.equal(firstPassDone, true);
    });

    it('a failing second run does not fail the install', async function () {
      for (const second of [
        {
          code: 1,
          stderr: 'boom',
          error: null
        },
        {
          code: null,
          error: Object.assign(new Error('spawn EAGAIN'), { code: 'EAGAIN' })
        }
      ]) {
        const projectDir = project();
        let n = 0;
        const run = async (command, args, opts) => {
          n++;
          if (n === 1) {
            mkdirSync(join(opts.cwd, 'node_modules', 'apostrophe'), { recursive: true });
            return {
              code: 0,
              error: null
            };
          }
          return second;
        };
        const res = await install({
          projectDir,
          appRoot: projectDir,
          packageManager: 'npm'
        }, { run });
        assert.deepEqual(res, { packageManager: 'npm' });
        assert.equal(n, 2);
        rmSync(projectDir, {
          recursive: true,
          force: true
        });
      }
    });

    it('a failing first run is not retried', async function () {
      const projectDir = project();
      const calls = [];
      await assert.rejects(
        () => install({
          projectDir,
          appRoot: projectDir,
          packageManager: 'npm'
        }, { run: fakeRunFactory(calls, { code: 1 }) }),
        (err) => err.errorCode === 'install_failed'
      );
      assert.equal(calls.length, 1);
    });

    it('apostrophe missing after the first pass → no second run', async function () {
      const projectDir = project();
      let n = 0;
      await assert.rejects(
        () => install({
          projectDir,
          appRoot: projectDir,
          packageManager: 'npm'
        }, {
          run: async () => {
            n++;
            return {
              code: 0,
              error: null
            };
          }
        }),
        (err) => err.errorCode === 'apostrophe_missing'
      );
      assert.equal(n, 1);
    });
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
