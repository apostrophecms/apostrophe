const confUtils = {};
const Conf = require('conf');
const { v4: uuidv4 } = require('uuid');

const conf = new Conf({
  configName: 'cli_config',
  projectName: '@apostrophecms/cli',
  projectSuffix: '',
  schema: {
    uid: {
      type: 'string'
    },
    versionNotified: {
      type: 'string'
    }
  }
});

module.exports = confUtils;

confUtils.getConf = function (propertyName) {
  return conf.get(propertyName);
};

confUtils.setConf = function (propertyName, value) {
  return conf.set(propertyName, value);
};

confUtils.checkConf = async function () {
  let details = conf.store;

  if (!details.uid) {
    details = await setupConf();
  }

  return details;
};

confUtils.clearConf = function () {
  // Just in case there are permissions issues with deleting the file, let's
  // clear it out first.
  conf.clear();
};

confUtils.getPath = function () {
  return conf.path;
};

async function setupConf () {
  console.info('\n👋 It looks like this might be your first time using the Apostrophe CLI on this computer. Run `apos --help` for the available commands.\n');

  const uid = uuidv4();
  conf.set('uid', uid);

  return conf.store;
}
