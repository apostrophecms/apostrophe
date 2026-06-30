// CLI entry. Parses argv, dispatches to a subcommand handler, returns an
// exit code. Importable from tests as `main(argv)` so the bin stays a
// one-line shim.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import { createStore as defaultCreateStore } from '../core/store.js';
import { createProject as defaultCreateProject } from '../core/create-project.js';
import { isKnownKit } from '../core/kits.js';
import { resolveStarter, CUSTOM_KIT_ID } from '../core/starter.js';
import { assertSafeShortName } from '../core/validate.js';
import { createTelemetry as defaultCreateTelemetry } from '../telemetry/index.js';
import { DB_CHOICES } from '../telemetry/schema.js';
import {
  status as telemetryStatus,
  optIn as telemetryOptIn,
  optOut as telemetryOptOut,
  preview as telemetryPreview
} from '../telemetry/commands.js';
import { getAnonymousId, isKillSwitchOn } from '../telemetry/consent.js';
import { runFlow as defaultRunFlow, renderInstallResult } from '../ui/flow.js';
import * as render from '../ui/render.js';
import { UserCancelled } from '../ui/prompts.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PKG_PATH = join(SCRIPT_DIR, '../../package.json');
const CLI_VERSION = JSON.parse(readFileSync(PKG_PATH, 'utf8')).version;

const EXIT_OK = 0;
const EXIT_FAIL = 1;
const EXIT_ARG = 2;
const EXIT_CANCEL = 130;

const DEFAULT_KIT = 'apostrophe-astro-demo';
const DEFAULT_DB = 'sqlite';
const DEFAULT_USERNAME = 'admin';

const OPTION_SPEC = Object.freeze({
  'project-name': { type: 'string' },
  kit: { type: 'string' },
  starter: { type: 'string' },
  db: { type: 'string' },
  'db-uri': { type: 'string' },
  username: { type: 'string' },
  password: { type: 'string' },
  telemetry: { type: 'string' },
  unattended: { type: 'boolean' },
  help: {
    type: 'boolean',
    short: 'h'
  },
  version: {
    type: 'boolean',
    short: 'V'
  }
});

const USAGE = `${render.bold('Usage:')}
  npm create apostrophe@latest                                           ${render.dim('Run the guided installer')}
  npm create apostrophe@latest -- --starter=NAME|URL                     ${render.dim('Start from a custom starter (skips the kit prompt)')}
  npm create apostrophe@latest -- --unattended [flags]                   ${render.dim('Run without prompts')}
  npm create apostrophe@latest -- telemetry [status|on|off|preview]      ${render.dim('Manage telemetry preference')}
  npm create apostrophe@latest -- --help | --version

${render.dim('(everything after the `--` is forwarded to the installer; npm consumes args without it)')}

${render.bold('Starter selection')} ${render.dim('(either path; --starter overrides --kit)')}:
  --starter=NAME|ORG/REPO|URL   ${render.dim('Custom starter: a starter-kit name (e.g. ecommerce), an org/repo, or a git URL')}

${render.bold('Unattended flags')} ${render.dim('(--unattended is the only trigger for the headless path)')}:
  ${render.bold('Required:')}
  --project-name=NAME           ${render.dim('Project directory name')}
  --password=PASS               ${render.dim('Admin password (or use APOS_ADMIN_PASSWORD)')}
  --telemetry=on|off            ${render.dim('Telemetry consent (no default — explicit choice)')}

  ${render.bold('Defaulted (override to change):')}
  --kit=KITID                   ${render.dim(`Starter kit id (default: ${DEFAULT_KIT}); ignored when --starter is set`)}
  --db=sqlite|mongodb|postgres  ${render.dim(`Database choice (default: ${DEFAULT_DB})`)}
  --db-uri=URI                  ${render.dim('Connection string (required when --db is mongodb or postgres)')}
  --username=NAME               ${render.dim(`Admin username or email (default: ${DEFAULT_USERNAME})`)}

${render.bold('Environment:')}
  APOS_TELEMETRY=0              ${render.dim('Disable telemetry entirely (kill switch)')}
  APOS_ADMIN_PASSWORD           ${render.dim('Admin password (when --password is absent)')}
`;

/**
 * @typedef {object} MainDeps
 * @property {typeof defaultCreateProject} [createProject]  Injected for tests
 *   so the unattended/interactive paths can be exercised without real
 *   git/npm/node spawns.
 * @property {typeof defaultCreateStore}   [createStore]    Injected for tests
 *   to keep ~/.config out of the picture.
 * @property {typeof defaultRunFlow}       [runFlow]        Injected for tests
 *   so the interactive path can be exercised without driving clack prompts.
 * @property {typeof defaultCreateTelemetry} [createTelemetry] Injected for tests
 *   to observe the resolved `consent` (e.g. the kill switch overriding
 *   --telemetry=on) without building a live transport.
 */

/**
 * @param {string[]} argv  Full process.argv (node + script + args).
 * @param {MainDeps} [deps]
 * @returns {Promise<number>} Exit code.
 */
export async function main(argv, deps = {}) {
  const {
    createProject = defaultCreateProject,
    createStore = defaultCreateStore,
    createTelemetry = defaultCreateTelemetry,
    runFlow = defaultRunFlow
  } = deps;
  /** @type {{ values: Record<string, any>, positionals: string[] }} */
  let parsed;
  try {
    parsed = parseArgs({
      args: argv.slice(2),
      options: OPTION_SPEC,
      allowPositionals: true,
      strict: true
    });
  } catch (err) {
    render.errorBlock('Invalid arguments', err.message);
    process.stderr.write(USAGE);
    return EXIT_ARG;
  }
  const { values, positionals } = parsed;

  if (values.help) {
    process.stdout.write(USAGE);
    return EXIT_OK;
  }
  if (values.version) {
    process.stdout.write(`${CLI_VERSION}\n`);
    return EXIT_OK;
  }
  if (positionals[0] === 'telemetry') {
    return runTelemetryCommand({ sub: positionals[1] }, { createStore });
  }
  if (positionals.length > 0) {
    render.errorBlock('Unknown command', positionals[0]);
    process.stderr.write(USAGE);
    return EXIT_ARG;
  }
  if (values.unattended) {
    return runUnattended(values, {
      createProject,
      createStore,
      createTelemetry
    });
  }
  return runInteractive({
    starter: values.starter,
    createProject,
    createStore,
    createTelemetry,
    runFlow
  });
}

/**
 * Interactive install: walks the user through the guided flow, runs the
 * orchestrator, renders the success/failure screen. Exposed from the
 * public entry so umbrella CLIs (e.g. `apos create`) can launch the same
 * flow without going through argv parsing — their command framework keeps
 * ownership of help text and subcommand routing.
 *
 * `starter` is the only non-injectable option here: a raw `--starter` value
 * (starter-kit name, org/repo, or git URL). When present, it's resolved to a
 * clone URL and the guided flow skips the kit-selection questions entirely.
 *
 * @param {MainDeps & { starter?: string }} [deps]
 * @returns {Promise<number>}
 */
export async function runInteractive(deps = {}) {
  const {
    starter: rawStarter,
    createProject = defaultCreateProject,
    createStore = defaultCreateStore,
    createTelemetry = defaultCreateTelemetry,
    runFlow = defaultRunFlow
  } = deps;
  const starter = (typeof rawStarter === 'string' && rawStarter.trim().length > 0)
    ? resolveStarter(rawStarter)
    : undefined;
  const cwd = process.cwd();
  const env = process.env;
  const store = createStore();
  /** @type {import('../ui/flow.js').FlowAnswers} */
  let answers;
  try {
    answers = await runFlow({
      store,
      cliVersion: CLI_VERSION,
      env,
      starter
    });
  } catch (err) {
    if (err instanceof UserCancelled) {
      return EXIT_CANCEL;
    }
    throw err;
  }

  const telemetry = createTelemetry({
    consent: answers.telemetryConsent,
    cliVersion: CLI_VERSION,
    anonymousId: getAnonymousId(store)
  });
  const logger = render.createUiLogger();

  const result = await createProject(
    {
      shortName: answers.shortName,
      cwd,
      kitId: answers.kitId,
      starter,
      dbChoice: answers.dbChoice,
      dbUri: answers.dbUri,
      dbReset: answers.dbReset,
      admin: answers.admin,
      nonInteractive: false,
      confirmedAt: answers.confirmedAt
    },
    {
      telemetry,
      logger
    }
  );

  renderInstallResult(result, answers);
  await telemetry.flush();
  return result.ok ? EXIT_OK : EXIT_FAIL;
}

/**
 * Unattended install: all answers come from flags/env, no prompts,
 * deterministic. Validates inputs up front; on invalid args returns
 * `EXIT_ARG` without touching anything.
 *
 * @param {Record<string, any>} values  parseArgs `values`
 * @param {Required<MainDeps>} deps
 * @returns {Promise<number>}
 */
async function runUnattended(values, {
  createProject, createStore, createTelemetry
}) {
  const env = process.env;
  const issues = [];

  const shortName = values['project-name'];
  if (!shortName) {
    issues.push('--project-name is required');
  } else {
    try {
      assertSafeShortName(shortName);
    } catch (err) {
      issues.push(err.message);
    }
  }

  // --starter overrides --kit: clone an arbitrary repo instead of a registry
  // kit. Validate the empty and both-given cases up front.
  const usingStarter =
    typeof values.starter === 'string' && values.starter.trim().length > 0;
  if (values.starter !== undefined && !usingStarter) {
    issues.push('--starter cannot be empty');
  }
  if (usingStarter && values.kit !== undefined) {
    issues.push('Use either --kit or --starter, not both');
  }
  const starter = usingStarter ? resolveStarter(values.starter) : undefined;
  const kitId = usingStarter ? CUSTOM_KIT_ID : (values.kit ?? DEFAULT_KIT);
  if (!usingStarter && !isKnownKit(kitId)) {
    issues.push(`Unknown --kit: ${JSON.stringify(kitId)}`);
  }

  const dbChoice = values.db ?? DEFAULT_DB;
  if (!DB_CHOICES.includes(dbChoice)) {
    issues.push(`Unknown --db: ${JSON.stringify(dbChoice)}. Expected one of: ${DB_CHOICES.join(', ')}`);
  }

  const dbUri = values['db-uri'];
  if (dbChoice !== 'sqlite' && !dbUri) {
    issues.push(`--db-uri is required when --db=${dbChoice}`);
  }

  const username = (values.username ?? DEFAULT_USERNAME).trim();
  if (username.length === 0) {
    issues.push('--username cannot be empty');
  }

  const password = values.password ?? env.APOS_ADMIN_PASSWORD;
  if (!password) {
    issues.push('Admin password required: pass --password or set APOS_ADMIN_PASSWORD');
  }

  const telemetryFlag = values.telemetry;
  let telemetryConsent;
  if (telemetryFlag === undefined) {
    issues.push('--telemetry is required (use \'on\' or \'off\')');
  } else if (telemetryFlag === 'on') {
    telemetryConsent = true;
  } else if (telemetryFlag === 'off') {
    telemetryConsent = false;
  } else {
    issues.push(`--telemetry must be 'on' or 'off' (got ${JSON.stringify(telemetryFlag)})`);
  }

  if (issues.length > 0) {
    render.errorBlock(
      'Invalid arguments',
      issues.map(line => `• ${line}`).join('\n')
    );
    process.stderr.write(USAGE);
    return EXIT_ARG;
  }

  const cwd = process.cwd();
  const store = createStore();
  const telemetry = createTelemetry({
    consent: telemetryConsent && !isKillSwitchOn(env),
    cliVersion: CLI_VERSION,
    anonymousId: getAnonymousId(store) ?? 'unattended'
  });
  const logger = render.createUiLogger();

  const confirmedAt = Date.now();
  /** @type {import('../index.js').CreateProjectOptions} */
  const options = {
    shortName,
    cwd,
    kitId,
    starter,
    dbChoice,
    dbUri,
    // Unattended never drops a pre-existing DB — that needs interactive
    // consent. (A seed kit still resets its own target in the seed step.)
    dbReset: 'keep',
    admin: {
      username,
      password
    },
    nonInteractive: true,
    confirmedAt
  };

  const result = await createProject(options, {
    telemetry,
    logger
  });

  // A custom starter has no kit to derive build/startingPoint from; its layout
  // (and thus the dev-server port the success screen shows) comes back on the
  // result. The kit-derived fields are filled only for a registry kit.
  /** @type {import('../ui/flow.js').FlowAnswers} */
  const answers = {
    shortName,
    ...(usingStarter
      ? { starter }
      : {
        build: kitId.startsWith('apostrophe-astro') ? 'astro' : 'standalone',
        startingPoint: kitId.endsWith('-essentials') ? 'essentials' : 'demo',
        sampleContent: kitId.endsWith('-demo-data')
      }),
    kitId,
    dbChoice,
    dbUri,
    dbReset: 'keep',
    admin: {
      username,
      password
    },
    telemetryConsent,
    confirmedAt
  };
  renderInstallResult(result, answers);
  await telemetry.flush();
  return result.ok ? EXIT_OK : EXIT_FAIL;
}

/**
 * Run a `telemetry` subcommand by name. Exposed from the public entry so
 * umbrella CLIs can dispatch their own Commander subcommands to identical
 * output formatting — the npm-create positional dispatcher uses this too.
 *
 * @param {{ sub: string | undefined }} input
 * @param {{ createStore?: typeof defaultCreateStore, env?: NodeJS.ProcessEnv }} [deps]
 * @returns {Promise<number>}
 */
export async function runTelemetryCommand(input, deps = {}) {
  const {
    createStore = defaultCreateStore,
    env = process.env
  } = deps;
  const store = createStore();
  const sub = input.sub;

  if (sub === 'status') {
    const s = telemetryStatus(store, env);
    render.summary('Telemetry status', [
      [ 'consent', s.consent ? 'on' : 'off' ],
      [ 'source', s.source ],
      [ 'killSwitch', s.killSwitchOn ? 'on (APOS_TELEMETRY=0)' : 'off' ],
      [ 'storedConsent', s.storedConsent === undefined ? '(unset)' : String(s.storedConsent) ],
      [ 'anonymousId', s.anonymousId ?? '(none — generated on first opt-in)' ]
    ]);
    return EXIT_OK;
  }
  if (sub === 'on') {
    const r = telemetryOptIn(store, env);
    render.success(
      `Telemetry: on${r.killSwitchOn ? ' (overridden by APOS_TELEMETRY=0)' : ''}`
    );
    if (r.idGenerated) {
      render.muted(`Generated anonymousId: ${r.anonymousId}`);
    }
    return EXIT_OK;
  }
  if (sub === 'off') {
    telemetryOptOut(store);
    render.success('Telemetry: off');
    return EXIT_OK;
  }
  if (sub === 'preview') {
    const p = telemetryPreview({
      store,
      cliVersion: CLI_VERSION,
      env
    });
    const notes = [];
    if (p.idSentinel) {
      notes.push('anonymousId is a placeholder — a real UUID is generated on first opt-in.');
    }
    if (p.killSwitchOn) {
      notes.push('APOS_TELEMETRY=0 is set — even with consent: on, nothing would be sent.');
    }
    const body = notes.length === 0
      ? JSON.stringify(p.payload, null, 2)
      : `${JSON.stringify(p.payload, null, 2)}\n\n${render.dim(notes.join('\n'))}`;
    render.note('Telemetry preview', body);
    return EXIT_OK;
  }
  render.errorBlock(
    'Unknown telemetry subcommand',
    `${sub ?? '(none)'}\n\nExpected one of: status, on, off, preview`
  );
  return EXIT_ARG;
}
