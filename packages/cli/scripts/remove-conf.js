const confUtils = require('../lib/conf-utils');
const fs = require('fs');

confUtils.clearConf();

const filePath = confUtils.getPath();

try {
  // file removed
  fs.unlinkSync(filePath);
} catch (err) {
  /* eslint-disable no-console */
  console.error('There was an error while attempting to delete the CLI configuration file.', err);
  console.error(`You can find the file at ${filePath}`);
  /* eslint-enable no-console */
}
