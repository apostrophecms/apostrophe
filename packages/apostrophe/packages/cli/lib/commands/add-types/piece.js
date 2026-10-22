require('shelljs/global');
// Utilities from shelljs
/* globals mkdir */
const fs = require('fs');
const path = require('path');
const util = require('../../util');

const apostropheCurrent = {
  modulesDir: 'modules',
  version: 'current',
  pageSuffix: '-page',
  widgetSuffix: '-widget',
  pageModuleDir: '@apostrophecms/page/index.js'
};

module.exports = function(moduleName, majorVersion, isEsm, options) {
  const {
    modulesDir,
    version,
    pageSuffix,
    pageModuleDir
  } = apostropheCurrent;
  const strings = util.getStrings(version, 'add-piece', moduleName);

  util.log('add piece', `Adding ${moduleName} folder to /${modulesDir}.`);

  const modulePath = path.join(modulesDir, moduleName);

  mkdir('-p', modulePath);

  util.log('add piece', `Setting up index.js for ${moduleName} module`);

  const pieceConfig = util.esmify(strings.pieceConfig, isEsm);
  fs.writeFileSync(path.join(modulePath, 'index.js'), pieceConfig);

  util.log('add piece', `YOUR NEXT STEP: add the ${moduleName} module to "modules" in app.js.`);

  // Piece page setup
  // ****************
  if (options.page) {
    const pageDir = `${modulePath}${pageSuffix}`;
    util.log('add piece', `Creating a ${pageDir} folder with index.js and appropriate views`);

    const pagesConfig = util.esmify(strings.pagesConfig, isEsm);

    mkdir('-p', path.join(pageDir));
    fs.writeFileSync(path.join(pageDir, 'index.js'), pagesConfig);

    mkdir('-p', path.join(pageDir, 'views'));
    fs.writeFileSync(path.join(pageDir, 'views/show.html'), '');
    fs.writeFileSync(path.join(pageDir, 'views/index.html'), '');

    util.log('add piece', `YOUR NEXT STEP: add the ${pageDir} module to "modules" in app.js.`);
    util.log('add piece', `YOUR NEXT STEP: add the ${pageDir} page type to the "types" array in ${modulesDir}/${pageModuleDir}`);
  }

  return true;
};
