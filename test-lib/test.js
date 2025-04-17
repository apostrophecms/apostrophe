const fs = require('fs-extra');
const path = require('path');

const setupPackages = ({ folder = 'test' }) => {
  const testNodeModules = path.join(__dirname, '../', folder, 'node_modules/');
  fs.removeSync(testNodeModules);
  fs.mkdirSync(testNodeModules);
  fs.symlinkSync(path.join(__dirname, '../'), path.join(testNodeModules, 'apostrophe'), 'dir');

  const extras = path.join(__dirname, '../', folder, 'extra_node_modules/');
  const dirs = fs.existsSync(extras) ? fs.readdirSync(extras) : [];
  for (const dir of dirs) {
    fs.symlinkSync(path.join(extras, dir), path.join(testNodeModules, dir), 'dir');
  }

  // Need a "project level" package.json for functionality that checks
  // whether packages in node_modules are project level or not

  const packageJson = path.join(__dirname, '../', folder, 'package.json');
  // Remove it first, in case it's the old-style symlink to the main
  // package.json, which would break
  fs.removeSync(packageJson);
  const packageJsonInfo = {
    name: folder,
    dependencies: {
      apostrophe: '^4.0.0'
    },
    devDependencies: {
      'test-bundle': '1.0.0'
    }
  };
  for (const dir of dirs) {
    // Add namespaced modules support
    if (dir.startsWith('@')) {
      const submodules = fs.readdirSync(path.join(extras, dir));
      for (const submodule of submodules) {
        packageJsonInfo.dependencies[`${dir}/${submodule}`] = '1.0.0';
      }
    } else {
      packageJsonInfo.dependencies[dir] = '1.0.0';
    }
  }

  fs.writeFileSync(packageJson, JSON.stringify(packageJsonInfo, null, '  '));

  // A "project level" package-lock.json for checking webpack build cache

  const packageLockJson = path.join(__dirname, '../', folder, 'package-lock.json');
  const packageLockJsonInfo = {
    _: 'Do not change, fake lock used for testing',
    name: 'apostrophe',
    version: 'current',
    packages: {}
  };
  fs.removeSync(packageLockJson);
  fs.writeFileSync(packageLockJson, JSON.stringify(packageLockJsonInfo, null, '  '));
};
setupPackages({ folder: 'test' });

module.exports = require('./util.js');
module.exports.setupPackages = setupPackages;
