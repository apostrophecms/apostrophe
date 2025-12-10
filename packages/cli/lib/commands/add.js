require('shelljs/global');
// Utilities from shelljs
// /* globals mkdir */
// const fs = require('fs');
// const path = require('path');
const util = require('../util');
const { stripIndent } = require('common-tags');

module.exports = function (program, version) {
  program
    .command('add <module-type> <module-name>')
    .description(stripIndent`
      Add an Apostrophe module with boilerplate configuration to get you started.
      - Add "module" for <module-type> to add a generic module.
      - Add "piece" for <module-type> to add a piece-type module.
      - Add "widget" for <module-type> to add a widget-type module.
      Example: \`apos add piece article\`
    `)
    .option('--page', 'Used with the "piece" module type. Also add a corresponding piece page module.')
    .option('--widget', 'Used with the "piece" module type. Also add a corresponding piece widget module (A2 only).')
    .option('--player', 'Used with the "widget" module type. Also add a Javascript player file for browser-side code.')
    .action(async function(type, moduleName, options) {
      const allowedTypes = [ 'module', 'piece', 'widget' ];
      if (!allowedTypes.includes(type)) {
        await util.error('add module', `Module type ${type} was not recognized. Options include "module", "piece", and "widget".`);
        return false;
      }
      const appPath = await util.getAppPath(`add ${type}`);

      if (!appPath) {
        return false;
      }

      const majorVersion = await util.getMajorVersion('add', version);

      if (!majorVersion) {
        await util.error('add module', 'Error finding the version of Apostrophe installed in this project');
        return false;
      }

      const isEsm = await util.isEsm(`add ${type}`);

      const success = require(`./add-types/${type}`)(moduleName, majorVersion, isEsm, options);

      if (success) {
        await util.success(`add ${type}`);
      }

      return true;
    });
};
