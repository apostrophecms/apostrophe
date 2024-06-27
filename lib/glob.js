const { globSync } = require('glob');

// synchronous glob 10 but with the sorting semantics of glob 8,
// to ease backwards compatibility in Apostrophe startup logic

module.exports = (pattern, options) => {
  const result = globSync(pattern, options);
  if (!options.nosort) {
    result.sort((a, b) => a.localeCompare(b, 'en'));
  }
  return result;
};
