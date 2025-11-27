/* eslint-disable no-console */
require('shelljs/global');
// Utilities from shelljs
/* globals exit which */
const fs = require('fs');
const util = {};
const _ = require('lodash');
const cliVersion = require('../package.json').version;
const confUtils = require('./conf-utils');
const packageJson = require('package-json');
const semver = require('semver');
const ora = require('ora');
const { spawn } = require('child_process');

module.exports = util;

const prefix = ' Apostrophe '.black.bgWhite.bold;

util.styleCommand = function(commandName, style) {
  const bgStyle = style === 'danger' ? 'bgRed'
    : style === 'success' ? 'bgGreen' : 'bgBlue';
  return ' '[bgStyle] + commandName[bgStyle].white + ' '[bgStyle];
};

util.log = function(commandName, message) {
  console.log(' ');
  console.log(prefix + util.styleCommand(commandName) + ' ' + message);
};

util.success = async function(commandName) {
  console.log(' ');
  console.log(prefix + util.styleCommand(commandName, 'success') + ' Finished successfully.'.green);

  try {
    await checkIfUpdated();
  } catch (error) {
    console.error(error);
  }
};

util.error = async function(commandName, msg) {
  console.error(' ');
  console.error(prefix + util.styleCommand(commandName, 'danger') + ' Failed'.red);
  if (msg) {
    console.error('\n' + msg.red + '\n');
  }

  try {
    await checkIfUpdated();
  } catch (error) {
    console.error(error);
  }
};

util.notValid = function(commandName) {
  console.log(' ');
  console.log(prefix + ' Not a valid command'.red);
};

util.isWindows = (require('os').platform() === 'win32');

util.missingDependency = function(dependencyName) {
  console.log(' ');
  console.log(dependencyName + ' not found'.red);
  console.log('Please install missing dependency'.red);
};

util.checkDependencies = function() {
  const config = require('../config');

  for (const i in config.SHELL_DEPENDS) {
    const dep = config.SHELL_DEPENDS[i];
    if (!which(dep)) {
      util.missingDependency(dep);
      exit(1);
    }
  }
};

util.getAppPath = async function(command, path) {
  path = path || './';

  if (fs.existsSync(path + '/app.js')) {
    return path;
  } else {
    let rootPath = /\/$/;
    // In case of Windows, top level directory is some variation on C:\
    if (util.isWindows) {
      rootPath = /([A-Z]):\\$/;
    }

    if (fs.realpathSync(path).match(rootPath)) {
      // we've reached top level folder, no app.js
      await util.error(command, 'Unable to locate an app.js in this directory. You need to be in the root directory of an Apostrophe project to run this command.');
      return null;
    }

    return util.getAppPath(command, path + '../');
  }
};

util.isEsm = async function(command, path) {
  const appPath = await util.getAppPath(command, path);
  let info;
  try {
    info = JSON.parse(fs.readFileSync(`${appPath}/package.json`));
  } catch (e) {
    await util.error('package.json is missing or invalid.');
    return null;
  }
  console.log(`isEsm: ${info.type === 'module'}`);
  return info.type === 'module';
}

util.esmify = function(code, isEsm) {
  if (!isEsm) {
    return code;
  }
  return code.replace('module.exports =', 'export default');
}

util.getMajorVersion = async (command, v) => {
  if (!v) {
    await util.error(command, 'Unable to identify the installed version of Apostrophe. Please install packages before creating modules with the CLI tool.');

    return null;
  }

  return v.split('.')[0];
};

util.getStrings = (version, command, moduleName, options) => {
  const allStrings = require('./boilerplate')(moduleName, options);
  return allStrings[version][command];
};

util.titleCase = function(string) {
  return string.replace(/\w\S*/g, function(txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

// Replace the given regexp with the given replacement in all of the files in
// the given array.
// As always, if you want global replace within the file, use `/g`

util.replaceInFiles = function(files, regex, replacement) {
  _.each(files, function(file) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(regex, replacement);
    fs.writeFileSync(file, content);
  });
};

util.secret = function() {
  const bytes = require('crypto').randomBytes(8);
  let string = '';
  let i;
  for (i = 0; (i < bytes.length); i++) {
    let s = bytes[i].toString(16);
    if (s.length < 2) {
      s = '0' + s;
    }
    string += s;
  }
  return string;
};

util.spawnWithSpinner = async function (command, options = {
  spinnerMessage: 'Processing...',
  codeMessage: 'Spawn process error code:'
}) {
  if (!command) {
    throw new Error('No command provided to spawnWithSpinner');
  }

  const spinner = ora({
    text: options.spinnerMessage,
    interval: 100,
    isEnabled: true
  });

  return new Promise((resolve, reject) => {
    try {
      const spawned = spawn(command, {
        shell: true
      });

      spinner.start();

      let output = '';
      spawned.stdout.on('data', (data) => {
        output += data.toString();
      });
      spawned.stderr.on('data', (data) => {
        output += data.toString();
      });

      spawned.on('exit', (code) => {
        spinner.stop();

        if (code !== null && code !== 0) {
          return reject(new Error(output));
        }
        // Log the install process output. Not using the CLI logging utility
        // since this isn't CLI messaging.
        console.log(output);

        return resolve();
      });
    } catch (error) {
      return reject(error);
    }
  });
};

async function checkIfUpdated () {
  try {
    // Get the latest published version number.
    const { version: latest } = await packageJson('@apostrophecms/cli');

    // Check if they've been notified for this version already. If so, bail out.
    const latestChecked = await confUtils.getConf('versionNotified');
    if (latestChecked && semver.gte(latestChecked, latest)) {
      return;
    }

    // If the local is behind the published version, suggest updating it.
    if (semver.gt(latest, cliVersion)) {
      console.log(`\n🆕 There is an updated version of the @apostrophecms/cli module. The latest is ${latest}. You are on ${cliVersion}.\nUse \`npm i -g @apostrophecms/cli\` to get the latest version.`);
    }
    // Stash the last notified version in user conf.
    confUtils.setConf('versionNotified', latest);

  } catch (error) {
    // Unable to check the latest version of the CLI package for some reason.
    // No need to interrupt the user.
  }
}
