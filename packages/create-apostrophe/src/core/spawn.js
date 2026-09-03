// No-shell child process helper.
//
// `shell: false` is explicit and load-bearing: arguments are passed to the
// kernel verbatim, so a project name or connection string containing shell
// metacharacters is an inert string, never executed

import { spawn } from 'node:child_process';

/** Default number of trailing lines {@link tail} keeps. */
const TAIL_LINES = 30;

/**
 * Last lines of a child's output, for showing the user why a step failed.
 * A failing `node app.js` or `npm install` can emit a great deal; the end is
 * where the actual error is.
 *
 * @param {string} [output]  Combined or single stream.
 * @param {number} [lines]
 * @returns {string} Trimmed tail, prefixed with an elision marker when cut.
 *   Empty string when there is nothing to show.
 */
export function tail(output, lines = TAIL_LINES) {
  const trimmed = (output ?? '').trimEnd();
  if (!trimmed) {
    return '';
  }
  const all = trimmed.split(/\r?\n/);
  if (all.length <= lines) {
    return trimmed;
  }
  return [ `… (${all.length - lines} earlier lines omitted)`, ...all.slice(-lines) ]
    .join('\n');
}

/**
 * @param {string} command            Executable name/path (no shell parsing).
 * @param {string[]} [args]           Args passed verbatim.
 * @param {object} [opts]
 * @param {string}  [opts.cwd]
 * @param {object}  [opts.env]        Defaults to `process.env`.
 * @param {string}  [opts.input]      Written to stdin then closed, if set.
 * @returns {Promise<{
 *   code: number|null, stdout: string, stderr: string, error: Error|null
 * }>} `code` is the exit code (null on spawn failure); `error` is set only
 *   when the process could not be spawned (e.g. ENOENT — binary missing).
 */
export function run(command, args = [], {
  cwd, env, input
} = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd,
        env: env ?? process.env,
        shell: false,
        stdio: [ input != null ? 'pipe' : 'ignore', 'pipe', 'pipe' ]
      });
    } catch (error) {
      resolve({
        code: null,
        stdout: '',
        stderr: '',
        error
      });
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (res) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(res);
    };

    child.stdout?.on('data', (d) => {
      stdout += d;
    });
    child.stderr?.on('data', (d) => {
      stderr += d;
    });

    child.on('error', (error) => finish({
      code: null,
      stdout,
      stderr,
      error
    }));
    child.on('close', (code) => finish({
      code,
      stdout,
      stderr,
      error: null
    }));

    if (input != null) {
      child.stdin.end(input);
    }
  });
}
