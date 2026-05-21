import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, readFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../src/cli/main.js';
import { createStore as realCreateStore } from '../../src/core/store.js';
import { UserCancelled } from '../../src/ui/prompts.js';

const PKG_PATH = fileURLToPath(new URL('../../package.json', import.meta.url));
const CLI_VERSION = JSON.parse(readFileSync(PKG_PATH, 'utf8')).version;

// Swap process.stdout.write / process.stderr.write (and clack writes through
// these) for the duration of `fn`. Strip ANSI codes so assertions can match
// the visible text. `output` is the combined stream — clack renders error
// blocks to stdout and we write raw USAGE to stderr, so per-stream matching
// is brittle. The merged view is what the user actually sees.
async function captureIO(fn) {
  const stdoutWrite = process.stdout.write.bind(process.stdout);
  const stderrWrite = process.stderr.write.bind(process.stderr);
  let out = '';
  let err = '';
  process.stdout.write = (chunk) => {
    out += String(chunk);
    return true;
  };
  process.stderr.write = (chunk) => {
    err += String(chunk);
    return true;
  };
  try {
    const code = await fn();
    return {
      code,
      stdout: stripAnsi(out),
      stderr: stripAnsi(err),
      output: stripAnsi(out + err)
    };
  } finally {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
  }
}

// eslint-disable-next-line no-control-regex
const ANSI = /\[[0-9;]*m/g;
function stripAnsi(s) {
  return s.replace(ANSI, '');
}

const ARGV0 = [ 'node', 'create-apostrophe' ];

/**
 * Capture invocations of a stubbed createProject. Returns `result` to the
 * caller; tests inspect `calls` afterwards.
 */
function stubCreateProject(result = {
  ok: true,
  kitId: 'k',
  dbChoice: 'sqlite',
  packageManager: 'npm',
  durationMs: 1
}) {
  /** @type {Array<{ options: object, deps: object }>} */
  const calls = [];
  const fn = async (options, deps) => {
    calls.push({
      options,
      deps
    });
    return result;
  };
  return {
    fn,
    calls
  };
}

/** Store factory pointed at a fresh empty tmp dir. Returns the path so
 *  the test can clean it up after. */
function isolatedStoreFactory() {
  const dir = mkdtempSync(join(tmpdir(), 'ca-main-store-'));
  return {
    createStore: () => realCreateStore({ dir }),
    dir,
    cleanup: () => rmSync(dir, {
      recursive: true,
      force: true
    })
  };
}

describe('cli/main — argv & early-return paths', function () {
  it('--help returns 0 and prints usage', async function () {
    const { code, stdout } = await captureIO(() => main([ ...ARGV0, '--help' ]));
    assert.equal(code, 0);
    assert.match(stdout, /Usage:/);
    assert.match(stdout, /--unattended \[flags]/);
    assert.match(stdout, /--project-name=NAME/);
  });

  it('-h alias also returns usage', async function () {
    const { code, stdout } = await captureIO(() => main([ ...ARGV0, '-h' ]));
    assert.equal(code, 0);
    assert.match(stdout, /Usage:/);
  });

  it('--version returns 0 and prints the version', async function () {
    const { code, stdout } = await captureIO(() => main([ ...ARGV0, '--version' ]));
    assert.equal(code, 0);
    assert.equal(stdout.trim(), CLI_VERSION);
  });

  it('-V alias also returns the version', async function () {
    const { code, stdout } = await captureIO(() => main([ ...ARGV0, '-V' ]));
    assert.equal(code, 0);
    assert.equal(stdout.trim(), CLI_VERSION);
  });

  it('unknown flag (parseArgs error) → exit 2 with usage', async function () {
    const { code, output } = await captureIO(() =>
      main([ ...ARGV0, '--nope' ]));
    assert.equal(code, 2);
    assert.match(output, /Invalid arguments/);
    assert.match(output, /Usage:/);
  });

  it('old flag --non-interactive is rejected (renamed in 5b)', async function () {
    const { code, output } = await captureIO(() =>
      main([ ...ARGV0, '--non-interactive' ]));
    assert.equal(code, 2);
    assert.match(output, /Unknown option '--non-interactive'/);
  });

  it('old flag --short-name is rejected (renamed in 5b)', async function () {
    const { code, output } = await captureIO(() =>
      main([ ...ARGV0, '--unattended', '--short-name=foo' ]));
    assert.equal(code, 2);
    assert.match(output, /Unknown option '--short-name'/);
  });

  it('unknown positional → exit 2', async function () {
    const { code, output } = await captureIO(() =>
      main([ ...ARGV0, 'bogus' ]));
    assert.equal(code, 2);
    assert.match(output, /Unknown command/);
  });

  it('telemetry subcommand unknown → exit 2', async function () {
    const { code, output } = await captureIO(() =>
      main([ ...ARGV0, 'telemetry', 'whatever' ]));
    assert.equal(code, 2);
    assert.match(output, /Unknown telemetry subcommand/);
  });
});

describe('cli/main — unattended validation', function () {
  it('--unattended with no other args → exit 2 lists exactly the strictly-required flags', async function () {
    const { code, output } = await captureIO(() =>
      main([ ...ARGV0, '--unattended' ]));
    assert.equal(code, 2);
    assert.match(output, /--project-name is required/);
    assert.match(output, /Admin password required/);
    assert.match(output, /--telemetry is required/);
    // Defaulted flags must NOT be listed as required.
    assert.doesNotMatch(output, /--kit is required/);
    assert.doesNotMatch(output, /--db is required/);
    assert.doesNotMatch(output, /--username is required/);
  });

  it('invalid --project-name → exit 2 with naming error', async function () {
    const { code, output } = await captureIO(() =>
      main([
        ...ARGV0,
        '--unattended',
        '--project-name=../escape',
        '--password=pw',
        '--telemetry=off'
      ]));
    assert.equal(code, 2);
    assert.match(output, /Invalid arguments/);
  });

  it('--telemetry with bad value → exit 2', async function () {
    const { code, output } = await captureIO(() =>
      main([
        ...ARGV0,
        '--unattended',
        '--project-name=p',
        '--password=pw',
        '--telemetry=maybe'
      ]));
    assert.equal(code, 2);
    assert.match(output, /--telemetry must be 'on' or 'off'/);
  });

  it('--db=mongodb without --db-uri → exit 2', async function () {
    const { code, output } = await captureIO(() =>
      main([
        ...ARGV0,
        '--unattended',
        '--project-name=p',
        '--password=pw',
        '--telemetry=off',
        '--db=mongodb'
      ]));
    assert.equal(code, 2);
    assert.match(output, /--db-uri is required when --db=mongodb/);
  });

  it('--db=sqlite needs no --db-uri (sqlite is file-based)', async function () {
    // Trigger a different validation failure (unknown kit) so we exit
    // before any real I/O. Proves the sqlite branch passes the db-uri check.
    const { code, output } = await captureIO(() =>
      main([
        ...ARGV0,
        '--unattended',
        '--project-name=p',
        '--password=pw',
        '--telemetry=off',
        '--db=sqlite',
        '--kit=does-not-exist'
      ]));
    assert.equal(code, 2);
    assert.match(output, /Unknown --kit/);
    // USAGE block (printed after the error block) mentions --db-uri, so
    // assert on the actual error string, not just the flag name.
    assert.doesNotMatch(output, /--db-uri is required/);
  });

  it('--kit unknown → exit 2', async function () {
    const { code, output } = await captureIO(() =>
      main([
        ...ARGV0,
        '--unattended',
        '--project-name=p',
        '--password=pw',
        '--telemetry=off',
        '--kit=nope'
      ]));
    assert.equal(code, 2);
    assert.match(output, /Unknown --kit/);
  });

  it('--db unknown → exit 2 with the allowed-values hint', async function () {
    const { code, output } = await captureIO(() =>
      main([
        ...ARGV0,
        '--unattended',
        '--project-name=p',
        '--password=pw',
        '--telemetry=off',
        '--db=cassandra'
      ]));
    assert.equal(code, 2);
    assert.match(output, /Unknown --db/);
    assert.match(output, /sqlite, mongodb, postgres/);
  });
});

describe('cli/main — unattended happy path (mocked createProject)', function () {
  let store;
  beforeEach(function () {
    store = isolatedStoreFactory();
  });
  afterEach(function () {
    store.cleanup();
  });

  it('threads required + defaulted args into CreateProjectOptions', async function () {
    const cp = stubCreateProject();
    const { code } = await captureIO(() => main(
      [
        ...ARGV0,
        '--unattended',
        '--project-name=my-proj',
        '--password=pw',
        '--telemetry=off'
      ],
      {
        createProject: cp.fn,
        createStore: store.createStore
      }
    ));
    assert.equal(code, 0);
    assert.equal(cp.calls.length, 1);
    const { options } = cp.calls[0];
    assert.equal(options.shortName, 'my-proj');
    assert.equal(options.kitId, 'apostrophe-astro-demo'); // 5b default
    assert.equal(options.dbChoice, 'sqlite');             // 5b default
    assert.equal(options.dbUri, undefined);               // sqlite needs none
    assert.deepEqual(options.admin, {
      username: 'admin',                                  // 5b default
      password: 'pw'
    });
    assert.equal(options.nonInteractive, true);
    assert.ok(typeof options.confirmedAt === 'number');
    assert.equal(typeof options.cwd, 'string');
  });

  it('passes through explicit overrides for kit/db/db-uri/username', async function () {
    const cp = stubCreateProject();
    await captureIO(() => main(
      [
        ...ARGV0,
        '--unattended',
        '--project-name=my-proj',
        '--password=pw',
        '--telemetry=off',
        '--kit=apostrophe-essentials',
        '--db=postgres',
        '--db-uri=postgres://localhost/x',
        '--username=ops@example.com'
      ],
      {
        createProject: cp.fn,
        createStore: store.createStore
      }
    ));
    const { options } = cp.calls[0];
    assert.equal(options.kitId, 'apostrophe-essentials');
    assert.equal(options.dbChoice, 'postgres');
    assert.equal(options.dbUri, 'postgres://localhost/x');
    assert.equal(options.admin.username, 'ops@example.com');
  });

  it('result.ok === false → exit 1', async function () {
    const cp = stubCreateProject({
      ok: false,
      kitId: 'k',
      dbChoice: 'sqlite',
      packageManager: 'npm',
      durationMs: 0,
      failStage: 'clone',
      errorCode: 'git_clone_failed'
    });
    const { code } = await captureIO(() => main(
      [
        ...ARGV0,
        '--unattended',
        '--project-name=my-proj',
        '--password=pw',
        '--telemetry=off'
      ],
      {
        createProject: cp.fn,
        createStore: store.createStore
      }
    ));
    assert.equal(code, 1);
  });

  it('--password absent → falls back to APOS_ADMIN_PASSWORD', async function () {
    const cp = stubCreateProject();
    const prev = process.env.APOS_ADMIN_PASSWORD;
    process.env.APOS_ADMIN_PASSWORD = 'from-env';
    try {
      await captureIO(() => main(
        [
          ...ARGV0,
          '--unattended',
          '--project-name=my-proj',
          '--telemetry=off'
        ],
        {
          createProject: cp.fn,
          createStore: store.createStore
        }
      ));
    } finally {
      if (prev === undefined) {
        delete process.env.APOS_ADMIN_PASSWORD;
      } else {
        process.env.APOS_ADMIN_PASSWORD = prev;
      }
    }
    assert.equal(cp.calls.length, 1);
    assert.equal(cp.calls[0].options.admin.password, 'from-env');
  });
});

describe('cli/main — interactive path (mocked runFlow)', function () {
  let store;
  beforeEach(function () {
    store = isolatedStoreFactory();
  });
  afterEach(function () {
    store.cleanup();
  });

  // Build a FlowAnswers stand-in that matches the contract `runInteractive`
  // expects. Tests vary individual fields by overriding.
  function flowAnswers(extra = {}) {
    return {
      shortName: 'my-proj',
      build: 'astro',
      startingPoint: 'demo',
      sampleContent: false,
      kitId: 'apostrophe-astro-demo',
      dbChoice: 'sqlite',
      dbUri: undefined,
      admin: {
        username: 'admin',
        password: 'pw'
      },
      telemetryConsent: false,
      confirmedAt: Date.now(),
      ...extra
    };
  }

  it('flow answers → createProject options; exit 0 on ok:true', async function () {
    const cp = stubCreateProject();
    const answers = flowAnswers({
      shortName: 'sample',
      kitId: 'apostrophe-essentials',
      dbChoice: 'postgres',
      dbUri: 'postgres://localhost/x',
      admin: {
        username: 'ops',
        password: 'pw'
      }
    });
    const { code } = await captureIO(() => main(
      [ ...ARGV0 ],
      {
        createProject: cp.fn,
        createStore: store.createStore,
        runFlow: async () => answers
      }
    ));
    assert.equal(code, 0);
    assert.equal(cp.calls.length, 1);
    const { options } = cp.calls[0];
    assert.equal(options.shortName, 'sample');
    assert.equal(options.kitId, 'apostrophe-essentials');
    assert.equal(options.dbChoice, 'postgres');
    assert.equal(options.dbUri, 'postgres://localhost/x');
    assert.equal(options.admin.username, 'ops');
    assert.equal(options.nonInteractive, false);
    assert.equal(options.confirmedAt, answers.confirmedAt);
  });

  it('createProject ok:false → exit 1', async function () {
    const cp = stubCreateProject({
      ok: false,
      kitId: 'k',
      dbChoice: 'sqlite',
      packageManager: 'npm',
      durationMs: 0,
      failStage: 'admin',
      errorCode: 'admin_user_failed'
    });
    const { code } = await captureIO(() => main(
      [ ...ARGV0 ],
      {
        createProject: cp.fn,
        createStore: store.createStore,
        runFlow: async () => flowAnswers()
      }
    ));
    assert.equal(code, 1);
  });

  it('UserCancelled at any prompt → exit 130; createProject never called', async function () {
    const cp = stubCreateProject();
    const { code } = await captureIO(() => main(
      [ ...ARGV0 ],
      {
        createProject: cp.fn,
        createStore: store.createStore,
        runFlow: async () => {
          throw new UserCancelled();
        }
      }
    ));
    assert.equal(code, 130);
    assert.equal(cp.calls.length, 0);
  });

  it('unexpected runFlow throw is not swallowed (propagates)', async function () {
    const cp = stubCreateProject();
    const boom = new Error('boom');
    await assert.rejects(
      () => captureIO(() => main(
        [ ...ARGV0 ],
        {
          createProject: cp.fn,
          createStore: store.createStore,
          runFlow: async () => {
            throw boom;
          }
        }
      )),
      /boom/
    );
  });
});
