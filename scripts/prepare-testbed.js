const fs = require('fs');
const path = require('path');
const glob = require('glob');

const packageJsonFiles = glob.sync('packages/*/package.json');

packageJsonFiles.forEach(file => {
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  ['dependencies', 'devDependencies'].forEach(depType => {
    if (pkg[depType]) {
      Object.keys(pkg[depType]).forEach(dep => {
        if (pkg[depType][dep].startsWith('workspace:')) {
          const depPath = dep.startsWith('@apostrophecms/') ? dep.replace('@apostrophecms/', '') : dep

          // relative path
          pkg[depType][dep] = `file:../${depPath}`;

          console.log('pkg[depType][dep]',pkg[depType][dep] )
          /* const depPkgPath = path.join('packages', depPath, 'package.json'); */
          /* if (fs.existsSync(depPkgPath)) { */
          /*   const depPkg = JSON.parse(fs.readFileSync(depPkgPath, 'utf8')); */
          /*   pkg[depType][dep] = `^${depPkg.version}`; */
          /* } */
        }
      });
    }
  });

  fs.writeFileSync(file, JSON.stringify(pkg, null, 2));
});
