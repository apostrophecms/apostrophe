// Guided interactive flow. Drives the headless installer with a
// UI-aware logger and renders progress + success/failure screens.

import * as render from './render.js';
import * as prompts from './prompts.js';
import { defaultDbUri, verifyDbReachable } from './db-probe.js';
import { link, kitGuide } from './links.js';
import { assertSafeShortName } from '../core/validate.js';
import { deriveKitId } from '../core/kits.js';
import {
  status as telemetryStatus,
  optIn as telemetryOptIn,
  optOut as telemetryOptOut,
  preview as telemetryPreview
} from '../telemetry/commands.js';

const TOTAL_STEPS = 6;

/** @typedef {'astro' | 'standalone'}             BuildType */
/** @typedef {'essentials' | 'demo'}              StartingPoint */
/** @typedef {import('../index.js').DbChoice}     DbChoice */
/** @typedef {import('../index.js').AdminAccount} AdminAccount */
/** @typedef {ReturnType<typeof import('../core/store.js').createStore>} Store */

/**
 * @typedef {object} FlowAnswers
 * @property {string}         shortName
 * @property {BuildType}      build
 * @property {StartingPoint}  startingPoint
 * @property {boolean}        sampleContent
 * @property {string}         kitId
 * @property {DbChoice}       dbChoice
 * @property {string}         [dbUri]
 * @property {AdminAccount}   admin
 * @property {boolean}        telemetryConsent
 * @property {number}         confirmedAt  Epoch ms when the user confirmed
 *                                         the plan; the install duration
 *                                         is measured from this point.
 */

/**
 * @typedef {object} RunFlowDeps
 * @property {Store}             store
 * @property {string}            cliVersion
 * @property {NodeJS.ProcessEnv} [env]
 */

/**
 * Run the guided flow. Throws `UserCancelled` if the user aborts at any
 * prompt; the bin catches it, renders a cancel message, and exits 130.
 *
 * @param {RunFlowDeps} deps
 * @returns {Promise<FlowAnswers>}
 */
export async function runFlow(deps) {
  render.intro('Welcome to ApostropheCMS! Let\'s set up your project.');
  render.muted('Press Ctrl-C at any time to cancel.');
  /** @type {Omit<FlowAnswers, 'confirmedAt'> | undefined} */
  let defaults;
  while (true) {
    const answers = await collectAnswers(deps, defaults);
    const confirmedAt = await reviewAndConfirm(answers, deps);
    if (confirmedAt !== null) {
      return {
        ...answers,
        confirmedAt
      };
    }
    defaults = answers;
  }
}

/**
 * @param {RunFlowDeps} deps
 * @param {Omit<FlowAnswers, 'confirmedAt'>} [defaults]
 * @returns {Promise<Omit<FlowAnswers, 'confirmedAt'>>}
 */
async function collectAnswers(deps, defaults) {
  const shortName = await askProjectName(defaults?.shortName);
  const build = await askBuildType(defaults?.build);
  const startingPoint = await askStartingPoint(defaults?.startingPoint);
  const sampleContent = startingPoint === 'demo'
    ? await askSampleContent(defaults?.sampleContent)
    : false;
  const kitId = deriveKitId({
    build,
    startingPoint,
    sampleContent
  });
  const { dbChoice, dbUri } = await askDatabase(shortName, defaults);
  const admin = await askAdminAccount(defaults?.admin);
  const telemetryConsent = await resolveTelemetryConsent(deps);
  return {
    shortName,
    build,
    startingPoint,
    sampleContent,
    kitId,
    dbChoice,
    dbUri,
    admin,
    telemetryConsent
  };
}

/** @param {string} [defaultShortName] */
async function askProjectName(defaultShortName = 'my-project') {
  return prompts.text({
    message: render.stepLabel(1, TOTAL_STEPS, 'Project name'),
    placeholder: 'my-project',
    defaultValue: defaultShortName,
    validate: validateProjectName
  });
}

/**
 * @param {BuildType} [initial]
 * @returns {Promise<BuildType>}
 */
async function askBuildType(initial = 'astro') {
  return prompts.select({
    message: render.stepLabel(2, TOTAL_STEPS, 'How would you like to build?'),
    initialValue: initial,
    options: [
      {
        value: 'astro',
        label: 'Apostrophe + Astro',
        hint: 'recommended — Astro frontend, Apostrophe content'
      },
      {
        value: 'standalone',
        label: 'Apostrophe Standalone',
        hint: 'full-stack, no separate frontend'
      }
    ]
  });
}

/**
 * @param {StartingPoint} [initial]
 * @returns {Promise<StartingPoint>}
 */
async function askStartingPoint(initial = 'essentials') {
  return prompts.select({
    message: render.stepLabel(3, TOTAL_STEPS, 'Choose a starting point:'),
    initialValue: initial,
    options: [
      {
        value: 'essentials',
        label: 'Essentials',
        hint: 'clean slate, no sample content'
      },
      {
        value: 'demo',
        label: 'Demo',
        hint: 'working blog, widgets, components'
      }
    ]
  });
}

/** @param {boolean} [initial] */
async function askSampleContent(initial = false) {
  return prompts.confirm({
    message: render.stepLabel('3b', TOTAL_STEPS, 'Pre-fill with sample content?'),
    initialValue: initial
  });
}

/**
 * Database selection with the optional connection-string sub-step. Loops
 * until the user has a reachable URI or switches to a DB that needs none.
 * When `defaults` is provided (restart pass) the previous dbChoice and,
 * if the user re-picks the same DB, the previous URI are reused.
 *
 * @param {string} shortName
 * @param {{ dbChoice?: DbChoice, dbUri?: string }} [defaults]
 * @returns {Promise<{ dbChoice: DbChoice, dbUri?: string }>}
 */
async function askDatabase(shortName, defaults) {
  let initialChoice = defaults?.dbChoice;
  while (true) {
    const dbChoice = await askDbChoice(initialChoice);
    if (dbChoice === 'sqlite') {
      return { dbChoice };
    }
    const initialUri = defaults?.dbChoice === dbChoice
      ? defaults?.dbUri
      : undefined;
    const result = await collectAndVerifyDbUri(dbChoice, shortName, initialUri);
    if (result.kind === 'ok') {
      return {
        dbChoice,
        dbUri: result.dbUri
      };
    }
    // 'switch' falls through to re-ask the DB choice; preselect whatever
    // they were on so re-picking the same DB stays one keystroke away.
    initialChoice = dbChoice;
  }
}

/**
 * @param {DbChoice} [initial]
 * @returns {Promise<DbChoice>}
 */
async function askDbChoice(initial = 'sqlite') {
  const choice = await prompts.select({
    message: render.stepLabel(4, TOTAL_STEPS, 'Choose a database:'),
    initialValue: initial,
    options: [
      {
        value: 'sqlite',
        label: 'SQLite',
        hint: 'local file, no setup — recommended'
      },
      {
        value: 'mongodb',
        label: 'MongoDB'
      },
      {
        value: 'postgres',
        label: 'PostgreSQL'
      }
    ]
  });
  render.info('You don\'t have to use the same database in production.');
  if (choice === 'postgres') {
    render.info('Postgres usually needs a password — add `:yourpassword` after `postgres` in the URI.');
  }
  return /** @type {DbChoice} */ (choice);
}

/**
 * Inner loop: ask for a connection string, probe it, on failure offer
 * retry-or-switch. Returns `{ kind: 'ok', dbUri }` when reachable, or
 * `{ kind: 'switch' }` to bounce back to the DB select.
 *
 * @param {'mongodb' | 'postgres'} dbChoice
 * @param {string}                 shortName
 * @param {string}                 [initialUri]  Preserves the user's
 *   previously-entered URI across a flow restart so they don't have to
 *   retype it.
 * @returns {Promise<{ kind: 'ok', dbUri: string } | { kind: 'switch' }>}
 */
async function collectAndVerifyDbUri(dbChoice, shortName, initialUri) {
  let candidate = initialUri ?? defaultDbUri(dbChoice, shortName);
  while (true) {
    candidate = await prompts.text({
      message: render.stepLabel('4b', TOTAL_STEPS, 'Connection string:'),
      defaultValue: candidate,
      initialValue: candidate
    });
    const spin = render.startSpinner('Verifying connection');
    const result = await verifyDbReachable(dbChoice, candidate);
    if (result.ok && result.skipped === 'srv') {
      spin.succeed('SRV URI — verified at install time');
      return {
        kind: 'ok',
        dbUri: candidate
      };
    }
    if (result.ok) {
      spin.succeed(`Reachable at ${result.host}:${result.port}`);
      return {
        kind: 'ok',
        dbUri: candidate
      };
    }
    if (result.error === 'unparseable') {
      spin.fail('Could not parse the connection string');
    } else {
      spin.fail(`Could not reach ${result.host}:${result.port} — ${result.error}`);
    }
    const next = await prompts.select({
      message: 'How would you like to proceed?',
      options: [
        {
          value: 'retry',
          label: 'Re-enter the connection string'
        },
        {
          value: 'switch',
          label: 'Choose a different database'
        }
      ]
    });
    if (next === 'switch') {
      return { kind: 'switch' };
    }
  }
}

/**
 * Carries the previous username as the new default on a restart pass.
 * The password is intentionally NOT carried — re-typed every time, never
 * echoed back to the terminal as a default.
 *
 * @param {AdminAccount} [defaults]
 * @returns {Promise<AdminAccount>}
 */
async function askAdminAccount(defaults) {
  const username = await prompts.text({
    message: render.stepLabel(5, TOTAL_STEPS, 'Create your admin account — username or email:'),
    defaultValue: defaults?.username ?? 'admin',
    placeholder: 'admin',
    validate: validateAdminUsername
  });
  const password = await prompts.password({
    message: 'Password:',
    validate: validateAdminPassword
  });
  return {
    username,
    password
  };
}

/**
 * Empty / unset is accepted so clack's `defaultValue` resolves on bare
 * Enter — clack passes `undefined` on empty submissions, not `''`.
 * Whitespace-only is rejected — the admin task takes the value verbatim.
 *
 * @param {string | undefined} value
 * @returns {string | undefined}
 */
function validateAdminUsername(value) {
  if (!value) {
    return undefined;
  }
  if (value.trim().length === 0) {
    return 'Username or email cannot be blank.';
  }
  return undefined;
}

/**
 * Apostrophe core only requires a non-empty password — no length floor.
 *
 * @param {string | undefined} value
 * @returns {string | undefined}
 */
function validateAdminPassword(value) {
  if (!value) {
    return 'Password is required.';
  }
  return undefined;
}

/**
 * Resolves the effective consent for this install. The prompt is
 * suppressed when a preference is already stored, or when
 * `APOS_TELEMETRY=0` is set (kill switch wins — consent is `false`
 * regardless of what's stored). Only a first-time user with no kill
 * switch reaches the interactive prompt.
 *
 * @param {RunFlowDeps} deps
 * @returns {Promise<boolean>}
 */
async function resolveTelemetryConsent(deps) {
  const current = telemetryStatus(deps.store, deps.env);
  if (current.killSwitchOn) {
    return false;
  }
  if (current.storedConsent !== undefined) {
    return current.storedConsent;
  }
  return askTelemetryConsent(deps);
}

/**
 * "See what would be sent" is the first option AND the default — bare
 * Enter shows the preview rather than silently committing. After viewing
 * the payload, the prompt re-opens with `off` preselected so a second
 * Enter is a deliberate commit (this path runs only for users with no
 * stored preference yet).
 *
 * @param {RunFlowDeps} deps
 * @returns {Promise<boolean>}
 */
async function askTelemetryConsent({
  store, cliVersion, env
}) {
  let initial = 'details';
  while (true) {
    const choice = await prompts.select({
      message: telemetryPromptMessage(),
      initialValue: initial,
      options: [
        {
          value: 'details',
          label: 'See exactly what would be sent',
          hint: 'prints the redacted payload — nothing is sent'
        },
        {
          value: 'on',
          label: 'Yes, share anonymous data',
          hint: 'no personal info, no content'
        },
        {
          value: 'off',
          label: 'No thanks'
        }
      ]
    });
    if (choice === 'details') {
      renderTelemetryPreview({
        store,
        cliVersion,
        env
      });
      initial = 'off';
      continue;
    }
    if (choice === 'on') {
      telemetryOptIn(store, env);
      return true;
    }
    telemetryOptOut(store);
    return false;
  }
}

/** Header line + multi-line body (with the policy link) for the consent
 *  select. Returned as a single string; clack renders newlines below the
 *  header in the same prompt rail. */
function telemetryPromptMessage() {
  return [
    render.stepLabel(6, TOTAL_STEPS, 'Help us improve Apostrophe?'),
    'Share anonymous usage data: no personal info, no content, just basic',
    'telemetry like which features are used. See exactly what we collect:',
    link('telemetryPolicy')
  ].join('\n');
}

/**
 * @param {RunFlowDeps} deps
 */
function renderTelemetryPreview({
  store, cliVersion, env
}) {
  const p = telemetryPreview({
    store,
    cliVersion,
    env
  });
  const body =
    JSON.stringify(p.payload, null, 2) +
    '\n\n' +
    (p.idSentinel
      ? 'anonymousId is a placeholder — a real UUID is generated on first opt-in.\n'
      : '') +
    'Nothing has been sent. This is just a preview of the data that would be shared if you opt in.';
  render.note('Telemetry preview', body);
}

/**
 * Render the plan summary and ask the user to confirm. Returns the
 * confirmation timestamp on `Yes` — the install duration is measured
 * from this value — or `null` on `No`, which signals the orchestrator
 * to restart the prompts with the prior selections as defaults.
 *
 * @param {Omit<FlowAnswers, 'confirmedAt'>} answers
 * @param {RunFlowDeps} deps
 * @returns {Promise<number | null>}
 */
async function reviewAndConfirm(answers, deps) {
  render.summary('Review your choices', [
    [ 'Project', answers.shortName ],
    [ 'Type', buildLabel(answers.build) ],
    [ 'Starter', starterLabel(answers.startingPoint, answers.sampleContent) ],
    [ 'Database', dbLabel(answers.dbChoice) ],
    [ 'Username', answers.admin.username ],
    [ 'Telemetry', telemetryLabel(answers.telemetryConsent, deps) ]
  ]);
  const ready = await prompts.confirm({
    message: 'Ready to create?',
    initialValue: true
  });
  return ready ? Date.now() : null;
}

/** @param {BuildType} build */
function buildLabel(build) {
  return build === 'astro' ? 'Apostrophe + Astro' : 'Apostrophe Standalone';
}

/**
 * @param {StartingPoint} startingPoint
 * @param {boolean}       sampleContent
 */
function starterLabel(startingPoint, sampleContent) {
  if (startingPoint === 'essentials') {
    return 'Essentials';
  }
  return sampleContent ? 'Demo (with sample content)' : 'Demo';
}

/** @param {DbChoice} dbChoice */
function dbLabel(dbChoice) {
  if (dbChoice === 'sqlite') {
    return 'SQLite';
  }
  if (dbChoice === 'mongodb') {
    return 'MongoDB';
  }
  return 'PostgreSQL';
}

/**
 * Distinguishes explicit opt-out from the env kill switch so a user
 * who set `APOS_TELEMETRY=0` sees why the line reads "Off".
 *
 * @param {boolean}     consent
 * @param {RunFlowDeps} deps
 */
function telemetryLabel(consent, deps) {
  if (consent) {
    return 'On';
  }
  const status = telemetryStatus(deps.store, deps.env);
  return status.killSwitchOn ? 'Off (APOS_TELEMETRY=0)' : 'Off';
}

/** @typedef {import('../index.js').CreateProjectResult} CreateProjectResult */

/**
 * Render the install outcome. Branches on `result.ok` and dispatches to
 * the Astro / Standalone success screen or the generic failure block.
 * Bin calls this after `createProject` resolves; flow.js is UI only.
 *
 * @param {CreateProjectResult} result
 * @param {FlowAnswers}         answers
 */
export function renderInstallResult(result, answers) {
  if (result.ok) {
    renderSuccess(answers);
  } else {
    renderFailure(answers, result);
  }
}

/** Dev-server ports per kit frontend — Astro uses 4321, standalone 3000. */
const DEV_PORT = Object.freeze({
  astro: 4321,
  standalone: 3000
});

/** @param {FlowAnswers} answers */
function renderSuccess(answers) {
  const port = DEV_PORT[answers.build];
  const { username } = answers.admin;
  const body = [
    'Your project is ready.',
    '',
    `  cd ${answers.shortName}`,
    '  npm run dev',
    '',
    `  Open:                     http://localhost:${port}`,
    `  Login with ${username}:   http://localhost:${port}/login`,
    `  Get Oriented:             ${kitGuide(answers.kitId)}`,
    '',
    `  Docs:     ${link('docs')}`,
    `  Discord:  ${link('discord', { stamp: false })}`
  ].join('\n');
  render.note('All set', body);
  render.outro('Happy building!');
}

/**
 * @param {FlowAnswers}         answers
 * @param {CreateProjectResult} result
 */
function renderFailure(answers, result) {
  const stage = result.failStage ?? 'unknown';
  const code = result.errorCode ?? '(none)';
  const lines = [
    `Stage:  ${stage}`,
    `Code:   ${code}`,
    `Kit:    ${answers.kitId}`,
    '',
    'See the messages above for the underlying error.',
    `Docs:    ${link('docs')}`,
    `Discord: ${link('discord', { stamp: false })}`
  ];
  render.errorBlock('Install failed', lines.join('\n'));
  render.outro('Install did not complete.');
}

/**
 * Empty / unset input is accepted so clack's `defaultValue` resolves on
 * bare Enter — clack passes `undefined` on empty submissions, not `''`.
 *
 * @param {string | undefined} value
 * @returns {string | undefined}
 */
function validateProjectName(value) {
  if (!value) {
    return undefined;
  }
  try {
    assertSafeShortName(value);
    return undefined;
  } catch {
    return 'Use letters, numbers, hyphens, or underscores only.';
  }
}
