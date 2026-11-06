// What the user is told when their Node.js is too old for the chosen kit.
// The rules (which kit needs which major) live in core/node-version.js; this
// file only words them.

import * as render from './render.js';
import { link } from './links.js';

const RERUN_INTERACTIVE = 'npm create apostrophe@latest';
const RERUN_UNATTENDED = 'npm create apostrophe@latest -- --unattended [flags]';

/** @param {string} kitId */
const rerunUnattendedWithKit = (kitId) =>
  `npm create apostrophe@latest -- --unattended --kit=${kitId} [flags]`;

/**
 * @param {number} requiredMajor
 * @returns {string[]}
 */
function upgradeLines(requiredMajor) {
  return [
    'Upgrade Node.js, for example with nvm:',
    '',
    `  nvm install ${requiredMajor}`,
    '',
    `or download it from ${link('nodejs', { stamp: false })}`
  ];
}

/**
 * Explain, after an install was refused, which Node.js the kit needs and how
 * to re-run once upgraded.
 *
 * When `alternative` is given (a kit that does run on this Node.js), an
 * unattended run is also shown the exact flag to install it instead, so a
 * script or agent can act on the message without guessing.
 *
 * @param {{
 *   requiredMajor: number, nodeVersion: string, kitLabel: string,
 *   alternative?: { kitId: string, label: string }
 * }} info
 * @param {{ unattended?: boolean }} [opts]
 */
export function renderUnsupportedNodeVersion(
  {
    requiredMajor, nodeVersion, kitLabel, alternative
  },
  { unattended = false } = {}
) {
  const alternativeLines = unattended && alternative
    ? [
      '',
      `Or install ${alternative.label}, which runs on Node.js ${nodeVersion}:`,
      '',
      `  ${rerunUnattendedWithKit(alternative.kitId)}`
    ]
    : [];
  render.errorBlock(
    `Node.js ${requiredMajor} or newer is required`,
    [
      `${kitLabel} needs Node.js ${requiredMajor} or newer, ` +
        `but you are running Node.js ${nodeVersion}.`,
      '',
      ...upgradeLines(requiredMajor),
      '',
      'Then re-run the installer:',
      '',
      `  ${unattended ? RERUN_UNATTENDED : RERUN_INTERACTIVE}`,
      ...alternativeLines
    ].join('\n')
  );
}

/**
 * Interactive, before anything is installed: the build the user just picked
 * can't run on this Node.js. They are offered the build question again.
 *
 * @param {{ requiredMajor: number, nodeVersion: string, buildLabel: string }} info
 */
export function renderBuildNeedsNewerNode({
  requiredMajor, nodeVersion, buildLabel
}) {
  render.errorBlock(
    `${buildLabel} needs Node.js ${requiredMajor} or newer`,
    [
      `You are running Node.js ${nodeVersion}.`,
      '',
      ...upgradeLines(requiredMajor),
      '',
      'Then re-run the installer. Or choose Apostrophe Standalone,',
      'which runs on this version of Node.js.'
    ].join('\n')
  );
}
