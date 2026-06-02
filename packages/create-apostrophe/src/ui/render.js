// Presentation primitives for the guided flow. picocolors for styling,
// @clack/prompts for the streamed I/O. No business logic, no prompts —
// just composable helpers the flow/bin draw with. Reusable by any caller
// that mounts this package's UI (e.g. @apostrophecms/cli `create`).

import pc from 'picocolors';
import * as clack from '@clack/prompts';

/**
 * Banner line that opens the flow. clack draws it with a divider that
 * connects visually to the subsequent prompts.
 *
 * @param {string} title
 */
export function intro(title) {
  clack.intro(pc.bgCyan(pc.black(` ${title} `)));
}

/**
 * Closing line. The caller passes the final user-facing message; success
 * vs. failure framing happens in the flow.
 *
 * @param {string} message
 */
export function outro(message) {
  clack.outro(message);
}

/**
 * "N/total  Label" — used as a prompt's title so the step counter sits
 * right above the question. Returns a string; the caller passes it to a
 * clack prompt.
 *
 * @param {number | string} n
 * @param {number | string} total
 * @param {string} label
 * @returns {string}
 */
export function stepLabel(n, total, label) {
  return `${pc.cyan(`${n}/${total}`)}  ${pc.bold(label)}`;
}

/** @param {string} msg */
export function info(msg) {
  clack.log.info(msg);
}
/** @param {string} msg */
export function warn(msg) {
  clack.log.warn(msg);
}
/** @param {string} msg */
export function error(msg) {
  clack.log.error(msg);
}
/** @param {string} msg */
export function success(msg) {
  clack.log.success(msg);
}

/** Dimmed, icon-less aside for low-priority hints. */
/** @param {string} msg */
export function muted(msg) {
  clack.log.message(pc.dim(msg));
}

/**
 * String-transform helpers (no I/O). Inline these inside template
 * strings when a multi-line block needs spot styling — `bold` for
 * section headers, `dim` for placeholders/asides.
 *
 * @param {string} text
 * @returns {string}
 */
export function bold(text) {
  return pc.bold(text);
}
/** @param {string} text */
export function dim(text) {
  return pc.dim(text);
}

/**
 * Bordered block. Useful for the plan/review screen and for any aside
 * that should stand apart from the prompt stream.
 *
 * @param {string} title
 * @param {string} body
 */
export function note(title, body) {
  clack.note(body, title);
}

/**
 * Plan/review box rendered as a clack note. `rows` are `[label, value]`
 * tuples; labels are right-padded to the longest one so values align.
 *
 * @param {string} title
 * @param {ReadonlyArray<[string, string]>} rows
 */
export function summary(title, rows) {
  if (rows.length === 0) {
    note(title, '');
    return;
  }
  const width = Math.max(...rows.map(([ label ]) => label.length));
  const body = rows
    .map(([ label, value ]) => `${pc.dim(label.padEnd(width))}  ${value}`)
    .join('\n');
  note(title, body);
}

/**
 * Multi-line error block — title in red+bold, details below.
 *
 * @param {string} title
 * @param {string} details
 */
export function errorBlock(title, details) {
  clack.log.error(`${pc.bold(pc.red(title))}\n${details}`);
}

/**
 * Cancel framing for a user-initiated abort (Ctrl-C / escape).
 *
 * @param {string} [message]
 */
export function cancel(message = 'Cancelled.') {
  clack.cancel(message);
}

/**
 * One unit of work with a spinner. Mirrors the headless Logger.task()
 * contract — start happens at construction, the handle settles it.
 *
 * @typedef {object} TaskHandle
 * @property {(msg?: string) => void} succeed
 * @property {(msg?: string) => void} fail
 * @property {(fraction: number) => void} progress  Advance the task's bar
 *   (0–1). No-op for spinner tasks; forward-only.
 */

/**
 * Bridge from the headless {@link import('../index.js').Logger} contract
 * to the clack/picocolors UI, keeping the orchestrator and steps UI-agnostic.
 *
 * @returns {import('../index.js').Logger}
 */
export function createUiLogger() {
  return {
    info,
    warn,
    error,
    muted,
    task(label, { progress: useProgress = false } = {}) {
      // clack writes a connector line on every start(), so pick spinner vs.
      // bar up front rather than swapping mid-task (which would stack lines).
      const active = useProgress
        ? clack.progress({
          style: 'block',
          max: 100,
          size: 24
        })
        : clack.spinner();
      active.start(label);
      let lastPct = 0;
      return {
        succeed(msg) {
          active.stop(msg ?? label);
        },
        fail(msg) {
          // clack's stop() always renders success; error() is the red variant.
          active.error(msg ?? label);
        },
        progress(fraction) {
          if (!useProgress) {
            return;
          }
          const pct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
          const delta = pct - lastPct;
          if (delta > 0) {
            active.advance(delta, `${label}  ${pct}%`);
            lastPct = pct;
          }
        }
      };
    }
  };
}

/**
 * Lower-level spinner for cases that aren't a Logger.task — e.g. the UI's
 * own pre-orchestrator checks (db reachability probe).
 *
 * @param {string} label
 * @returns {TaskHandle & { update(msg: string): void }}
 */
export function startSpinner(label) {
  const s = clack.spinner();
  s.start(label);
  return {
    succeed(msg) {
      s.stop(msg ?? label);
    },
    fail(msg) {
      // clack's stop() always renders success; error() is the red variant.
      s.error(msg ?? label);
    },
    update(msg) {
      s.message(msg);
    }
  };
}
