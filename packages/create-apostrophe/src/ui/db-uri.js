/**
 * Suggested local development URI. The postgres form pre-fills the
 * conventional `postgres` superuser so the structure is obvious; the
 * user adds `:yourpassword` after `postgres` inline.
 *
 * @param {'mongodb' | 'postgres'} dbChoice
 * @param {string}                 shortName
 * @returns {string}
 */
export function defaultDbUri(dbChoice, shortName) {
  if (dbChoice === 'mongodb') {
    return `mongodb://localhost:27017/${shortName}`;
  }
  return `postgres://postgres@localhost:5432/${shortName}`;
}
