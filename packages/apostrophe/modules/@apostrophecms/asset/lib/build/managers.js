const apos = require('./manager-apos.js');
const custom = require('./manager-custom.js');
const index = require('./manager-index.js');
const bundled = require('./manager-bundled.js');

module.exports = (self) => {
  const managers = {
    apos,
    custom,
    index,
    bundled
  };

  return function getManager(entrypoint) {
    if (!managers[entrypoint.type]) {
      throw new Error(`Unknown build manager type: ${entrypoint.type}`);
    }
    return managers[entrypoint.type](self, entrypoint);
  };
};
