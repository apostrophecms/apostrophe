require('shelljs/global');
// Utilities from shelljs
/* globals mkdir */
const fs = require('fs');
const path = require('path');
const util = require('../../util');

module.exports = function(moduleName, majorVersion, isEsm, options) {
  const modulesDir = 'modules';
  const stringSet = 'current';
  const fullWidgetName = `${moduleName}-widget`;

  util.log('add widget', `Adding ${fullWidgetName} folder to /${modulesDir}.`);

  const strings = util.getStrings(stringSet, 'add-widget', moduleName, options);

  const modulePath = path.join(modulesDir, fullWidgetName);

  mkdir('-p', modulePath);

  util.log('add widget', `Creating a views folder and widget.html for ${fullWidgetName}.`);

  mkdir('-p', path.join(modulePath, 'views'));

  const widgetView = strings.widgetsView || '';

  fs.writeFileSync(path.join(modulePath, 'views/widget.html'), widgetView);

  const widgetsConfig = util.esmify(strings.widgetsConfig, isEsm);

  util.log('add widget', `Setting up index.js for ${fullWidgetName}.`);

  fs.writeFileSync(path.join(modulePath, 'index.js'), widgetsConfig);

  if (options.player) {
    const playerFilename = 'index.js';
    util.log('add widget', `Setting up widget player ${playerFilename} for ${fullWidgetName}.`);

    const jsDir = 'ui/src';

    mkdir('-p', path.join(modulePath, jsDir));

    const jsConfig = strings.jsConfig;

    fs.writeFileSync(path.join(modulePath, jsDir, playerFilename), jsConfig);
  }

  util.log('add piece', `YOUR NEXT STEP: add the ${moduleName} module to "modules" in app.js.`);

  return true;
};
