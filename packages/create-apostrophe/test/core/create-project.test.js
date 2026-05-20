import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeCreateProject } from '../../src/core/create-project.js';
import { createProject as publicCreateProject } from '../../src/index.js';
import { StageError } from '../../src/core/errors.js';

const APP_JS = 'module.exports = { shortName: \'x\' };\n';
const PKG = '{ "name": "x" }\n';

function spies() {
  const events = [];
  const tasks = [];
  const logger = {
    info() {},
    warn() {},
    error() {},
    task(label) {
      const rec = {
        label,
        settled: null
      };
      tasks.push(rec);
      return {
        succeed() {
          rec.settled = 'succeed';
        },
        fail() {
          rec.settled = 'fail';
        }
      };
    }
  };
  const telemetry = {
    event(name, payload) {
      events.push({
        name,
        payload
      });
    }
  };
  return {
    events,
    tasks,
    logger,
    telemetry
  };
}

const baseOptions = (over = {}) => ({
  shortName: 'my-site',
  cwd: '/tmp/p',
  kitId: 'apostrophe-essentials',
  dbChoice: 'sqlite',
  admin: {
    username: 'admin',
    password: 'pw'
  },
  packageManager: 'npm',
  nonInteractive: true,
  confirmedAt: Date.now() - 25,
  ...over
});

describe('core/create-project', function () {
  let dir;

  beforeEach(function () {
    dir = mkdtempSync(join(tmpdir(), 'ca-cp-'));
  });

  afterEach(function () {
    rmSync(dir, {
      recursive: true,
      force: true
    });
  });

  // Fake clone that materializes a standalone project so the REAL scaffold and
  // db-config run against it. install/admin are faked (no npm/node spawn).
  function fakeStandaloneClone(calls) {
    return async ({ shortName }) => {
      const projectDir = join(dir, shortName);
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'app.js'), APP_JS);
      writeFileSync(join(projectDir, 'package.json'), PKG);
      calls.push('clone');
      return { projectDir };
    };
  }

  it('success: real scaffold+db, one install_success, tasks all succeed', async function () {
    const {
      events, tasks, logger, telemetry
    } = spies();
    const calls = [];
    const createProject = makeCreateProject({
      clone: fakeStandaloneClone(calls),
      scaffold: (await import('../../src/core/steps/scaffold.js')).scaffold,
      dbConfig: (await import('../../src/core/steps/db-config.js')).dbConfig,
      install: async () => {
        calls.push('install');
      },
      addAdminUser: async () => {
        calls.push('admin');
      }
    });

    const res = await createProject(baseOptions(), {
      telemetry,
      logger
    });

    assert.equal(res.ok, true);
    assert.equal(res.kitId, 'apostrophe-essentials');
    assert.equal(res.dbChoice, 'sqlite');
    assert.equal(res.packageManager, 'npm');
    assert.ok(res.durationMs >= 0);
    assert.equal(res.failStage, undefined);

    // Real artifacts produced.
    const env = join(dir, 'my-site', '.env');
    assert.equal(existsSync(env), true);

    // Exactly one terminal event, success.
    assert.equal(events.length, 1);
    assert.equal(events[0].name, 'install_success');
    assert.deepEqual(events[0].payload, {
      kitId: 'apostrophe-essentials',
      dbChoice: 'sqlite',
      packageManager: 'npm',
      durationMs: res.durationMs
    });
    assert.deepEqual(calls, [ 'clone', 'install', 'admin' ]);
    assert.deepEqual(tasks.map((t) => [ t.label, t.settled ]), [
      [ 'Cloning starter', 'succeed' ],
      [ 'Configuring project', 'succeed' ],
      [ 'Installing dependencies', 'succeed' ],
      [ 'Configuring database', 'succeed' ],
      [ 'Creating admin account', 'succeed' ]
    ]);
  });

  it('preflight: pnpm → ok:false failStage:null unsupported_pm, no steps', async function () {
    const {
      events, tasks, logger, telemetry
    } = spies();
    const calls = [];
    const createProject = makeCreateProject({
      clone: fakeStandaloneClone(calls),
      scaffold: () => {
        throw new Error('should not run');
      },
      dbConfig: () => {},
      install: () => {},
      addAdminUser: () => {}
    });

    const res = await createProject(
      baseOptions({ packageManager: 'pnpm' }),
      {
        telemetry,
        logger
      }
    );

    assert.deepEqual(res, {
      ok: false,
      kitId: 'apostrophe-essentials',
      dbChoice: 'sqlite',
      packageManager: 'pnpm',
      durationMs: res.durationMs,
      failStage: null,
      errorCode: 'unsupported_pm'
    });
    assert.equal(calls.length, 0);
    assert.equal(tasks.length, 0);
    assert.equal(events.length, 1);
    assert.equal(events[0].name, 'install_fail');
    assert.equal(events[0].payload.failStage, null);
    assert.equal(events[0].payload.errorCode, 'unsupported_pm');
  });

  it('step StageError → ok:false with that failStage, one install_fail', async function () {
    const {
      events, tasks, logger, telemetry
    } = spies();
    const after = [];
    const createProject = makeCreateProject({
      clone: async () => {
        throw new StageError('clone', { code: 'git_clone_failed' });
      },
      scaffold: () => {
        after.push('scaffold');
      },
      dbConfig: () => {
        after.push('db');
      },
      install: () => {
        after.push('install');
      },
      addAdminUser: () => {
        after.push('admin');
      }
    });

    const res = await createProject(baseOptions(), {
      telemetry,
      logger
    });

    assert.equal(res.ok, false);
    assert.equal(res.failStage, 'clone');
    assert.equal(res.errorCode, 'git_clone_failed');
    assert.deepEqual(after, []); // nothing after the failing step ran
    assert.equal(events.length, 1);
    assert.equal(events[0].name, 'install_fail');
    assert.deepEqual(tasks.map((t) => [ t.label, t.settled ]), [
      [ 'Cloning starter', 'fail' ]
    ]);
  });

  it('unexpected throw propagates; no telemetry emitted (caller emits)', async function () {
    const {
      events, logger, telemetry
    } = spies();
    const createProject = makeCreateProject({
      clone: async () => {
        throw new Error('boom');
      },
      scaffold: () => {},
      dbConfig: () => {},
      install: () => {},
      addAdminUser: () => {}
    });

    await assert.rejects(
      () => createProject(baseOptions(), {
        telemetry,
        logger
      }),
      /boom/
    );
    assert.equal(events.length, 0);
  });

  it('public index.js exposes createProject', function () {
    assert.equal(typeof publicCreateProject, 'function');
  });
});
