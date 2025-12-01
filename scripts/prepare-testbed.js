const fs = require('fs');
const path = require('path');
const glob = require('glob');

const packageJsonFiles = glob.sync('packages/*/package.json');

packageJsonFiles.forEach(file => {
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));

  // Replace workspace:* with actual versions or file: paths
  ['dependencies', 'devDependencies'].forEach(depType => {
    if (pkg[depType]) {
      Object.keys(pkg[depType]).forEach(dep => {
        if (pkg[depType][dep].startsWith('workspace:')) {
          // Option A: Use the actual version from the referenced package
          const depPath = dep.startsWith('@apostrophecms/') ? dep.replace('@apostrophecms/', '') : dep
          const depPkgPath = path.join('packages', depPath, 'package.json');
          if (fs.existsSync(depPkgPath)) {
            const depPkg = JSON.parse(fs.readFileSync(depPkgPath, 'utf8'));
            pkg[depType][dep] = `^${depPkg.version}`;
          }
          // Option B: Or use relative file: paths
          // pkg[depType][dep] = `file:../${dep}`;
        }
      });
    }
  });

  fs.writeFileSync(file, JSON.stringify(pkg, null, 2));
});
