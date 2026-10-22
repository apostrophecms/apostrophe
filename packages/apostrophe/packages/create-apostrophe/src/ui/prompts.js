// Typed thin wrappers over @clack/prompts. The goal is twofold:
//   1. Stable, narrowly-typed signatures the flow can call without
//      importing clack directly (so swapping the prompt lib stays a
//      local change).
//   2. Uniform cancel handling: clack returns a sentinel symbol on
//      Ctrl-C / escape; every wrapper here turns that into a
//      `UserCancelled` throw so the flow can unwind via try/catch and
//      the bin can render `render.cancel(...)` + exit 130 in one place.

import * as clack from '@clack/prompts';

/**
 * Thrown by every prompt wrapper when the user cancels (Ctrl-C / escape).
 * The bin/flow catches it, renders a cancel message, and exits cleanly.
 */
export class UserCancelled extends Error {
  constructor() {
    super('User cancelled.');
    this.name = 'UserCancelled';
  }
}

/**
 * @template T
 * @param {T | symbol} value
 * @returns {T}
 */
function unwrap(value) {
  if (clack.isCancel(value)) {
    throw new UserCancelled();
  }
  return /** @type {T} */ (value);
}

/**
 * Free-form text input with optional default and synchronous validator.
 * `validate` returns a string error message to keep the user on the
 * prompt, or `undefined` to accept the value.
 *
 * @param {{
 *   message: string,
 *   placeholder?: string,
 *   defaultValue?: string,
 *   initialValue?: string,
 *   validate?: (value: string) => string | undefined
 * }} opts
 * @returns {Promise<string>}
 */
export async function text(opts) {
  const value = await clack.text({
    message: opts.message,
    placeholder: opts.placeholder,
    defaultValue: opts.defaultValue,
    initialValue: opts.initialValue,
    validate: opts.validate
  });
  return unwrap(value);
}

/**
 * Single-choice select. Returns the `value` of the chosen option, typed
 * to whatever the caller declares for the option set.
 *
 * @template T
 * @param {{
 *   message: string,
 *   options: ReadonlyArray<{ value: T, label: string, hint?: string }>,
 *   initialValue?: T
 * }} opts
 * @returns {Promise<T>}
 */
export async function select(opts) {
  const value = await clack.select({
    message: opts.message,
    options: /** @type {any} */ (opts.options),
    initialValue: opts.initialValue
  });
  return unwrap(value);
}

/**
 * Yes/no. Pass `initialValue: undefined` to leave the cursor unbiased
 * (clack defaults it to `true` otherwise).
 *
 * @param {{ message: string, initialValue?: boolean }} opts
 * @returns {Promise<boolean>}
 */
export async function confirm(opts) {
  const value = await clack.confirm({
    message: opts.message,
    initialValue: opts.initialValue
  });
  return unwrap(value);
}

/**
 * Masked password input. `validate` runs without echoing the value.
 *
 * @param {{
 *   message: string,
 *   mask?: string,
 *   validate?: (value: string) => string | undefined
 * }} opts
 * @returns {Promise<string>}
 */
export async function password(opts) {
  const value = await clack.password({
    message: opts.message,
    mask: opts.mask,
    validate: opts.validate
  });
  return unwrap(value);
}
