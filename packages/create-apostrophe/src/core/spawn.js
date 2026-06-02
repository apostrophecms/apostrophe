// No-shell child process helper.
//
// `shell: false` is explicit and load-bearing: arguments are passed to the
// kernel verbatim, so a project name or connection string containing shell
// metacharacters is an inert string, never executed

import { spawn } from 'node:child_process';

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
