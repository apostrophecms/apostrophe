// What the user is told about the package manager they launched us with.
// The rules (which managers run, which are refused) live in core/pm.js; this
// file only words them.

import * as render from './render.js';
import { link } from './links.js';
import { installsWithNpmInstead } from '../core/pm.js';

const RERUN_INTERACTIVE = 'npm create apostrophe@latest';
const RERUN_UNATTENDED = 'npm create apostrophe@latest -- --unattended [flags]';

/**
 * Tell a pnpm user, before any work, that the project will be installed with
 * npm. Silent for npm and for an undetected manager.
 *
 * @param {string} packageManager
 */
export function renderPackageManagerNotice(packageManager) {
  if (!installsWithNpmInstead(packageManager)) {
    return;
  }
  render.note(
    'This project will use npm',
    [
      `You started the installer with ${packageManager}.`,
      'Apostrophe starter kits are set up for npm, so this project',
      'will be installed with npm, which comes with Node.js.',
      'Use npm commands in the new project.',
      '',
      `${packageManager} support is on the way.`
    ].join('\n')
  );
}

/**
 * Lines for the success screen reminding a pnpm user that the new project
 * is an npm project. Empty for everyone else.
 *
 * @param {string} [packageManager]
 * @returns {string[]}
 */
export function npmOnlyReminder(packageManager) {
  if (!installsWithNpmInstead(packageManager)) {
    return [];
  }
  return [
    '',
    'This project uses npm. Run npm install and npm run dev here;',
    `${packageManager} install would break the project.`
  ];
}

/**
 * Explain an unsupported package manager and how to re-run with npm.
 *
 * @param {string} packageManager
 * @param {{ unattended?: boolean }} [opts]
 */
export function renderUnsupportedPackageManager(
  packageManager,
  { unattended = false } = {}
) {
  render.errorBlock(
    `${packageManager} isn't supported yet`,
    [
      'Apostrophe starter kits are set up for npm, which comes with Node.js.',
      'Re-run the installer with npm:',
      '',
      `  ${unattended ? RERUN_UNATTENDED : RERUN_INTERACTIVE}`,
      '',
      `Discord: ${link('discord', { stamp: false })}`
    ].join('\n')
  );
}
