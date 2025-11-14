const { globSync } = require('glob');

// synchronous glob 10 but with the sorting semantics of glob 8,
// to ease backwards compatibility in Apostrophe startup logic.
// Also replaces \ with / for consistency across platforms

module.exports = (pattern, options) => {
  pattern = pattern.replaceAll('\\', '//');
  const result = globSync(pattern, options).map(path => path.replaceAll('\\', '/'));
  if (!options.nosort) {
    result.sort((a, b) => a.localeCompare(b, 'en'));
  }
  return result;
};
