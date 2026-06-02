// Defense-in-depth input validation for security-sensitive values.

/** Letters, digits, hyphen, underscore — no separators, no dots, no `..`. */
const SAFE_SHORT_NAME = /^[\w-]+$/;

/**
 * @param {string} shortName
 * @returns {string} the validated value (for inline use).
 * @throws {TypeError} if it is empty, non-string, or path-unsafe.
 */
export function assertSafeShortName(shortName) {
  if (typeof shortName !== 'string' || !SAFE_SHORT_NAME.test(shortName)) {
    throw new TypeError(
      `Unsafe shortName: ${JSON.stringify(shortName)}. ` +
      'Only letters, numbers, hyphens and underscores are allowed.'
    );
  }
  return shortName;
}
