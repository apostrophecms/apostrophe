/* eslint-disable no-console */

const standard = require('eslint-config-standard');
const config = require('../eslintrc.json');

const { findMissing, diff } = require('./utils');

const standardRules = standard.rules;
const ourRules = config.rules;

const missingTemplate = rules => `Missing Rules:
\n
    ${rules.join(', ')}
\n
`;

const diffTemplate = (key, { standard, modified }) => `
    Rule: ${key}
      Standard: ${JSON.stringify(standard)}
      Ours:     ${JSON.stringify(modified)}
`;

const report = () => {
  console.log(`Comparing:
    eslint-config-standard to eslint-config-apostrophe
\n`);

  const missing = findMissing(standardRules, ourRules);

  if (missing.length) {
    console.log(missingTemplate(missing));
  }

  console.log('Modified Rules:\n');

  const variants = diff(standardRules, ourRules);

  for (const [ key, value ] of variants) {
    console.log(diffTemplate(key, value));
  }
};

module.exports = report();
