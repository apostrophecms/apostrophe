const fs = require('fs');
const info = JSON.parse(fs.readFileSync('package.json'));

info.dependencies = info.dependencies || {};
info.dependencies.apostrophe = '^2.0.0';
fs.writeFileSync('test/package.json', JSON.stringify({
  "//": "Automatically generated to satisfy moog-require, do not edit",
  dependencies: info.dependencies || {},
  devDependencies: info.devDependencies || {}
}, null, '  '));
