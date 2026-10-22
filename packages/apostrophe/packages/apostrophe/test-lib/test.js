const fs = require('fs-extra');
const path = require('path');
const http = require('node:http');

const setupPackages = ({ folder = 'test' }) => {
  const testNodeModules = path.join(__dirname, '../', folder, 'node_modules/');
  fs.removeSync(testNodeModules);
  fs.mkdirSync(testNodeModules);
  fs.symlinkSync(path.join(__dirname, '../'), path.join(testNodeModules, 'apostrophe'), 'junction');

  const extras = path.join(__dirname, '../', folder, 'extra_node_modules/');
  const dirs = fs.existsSync(extras) ? fs.readdirSync(extras) : [];
  for (const dir of dirs) {
    fs.symlinkSync(path.join(extras, dir), path.join(testNodeModules, dir), 'junction');
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

// Performs a GET via the raw node:http client, sending `headers` to the server
// verbatim. Use this in tests that must control headers the built-in fetch
// (used by apos.http) would otherwise refuse or rewrite: e.g. a forbidden
// `Host` header, or the `Cache-Control: no-cache` it adds to any request that
// carries a conditional header (If-None-Match / If-Modified-Since). `url` may
// be absolute or site-relative (resolved against `apos.http.getBase()`).
// Resolves with a fullResponse-shaped { status, headers, body }.
const rawGet = (apos, url, headers = {}) => {
  const target = url.startsWith('/') ? `${apos.http.getBase()}${url}` : url;
  return new Promise((resolve, reject) => {
    // Pass the URL string (rather than a split hostname/port) so an IPv6 base
    // such as `http://[::1]:3000` from getBase() is handled correctly; a
    // bracketed hostname passed on its own is treated as a name to DNS-resolve.
    const req = http.request(target, {
      method: 'GET',
      headers
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString()
      }));
    });
    req.on('error', reject);
    req.end();
  });
};

module.exports = require('./util.js');
module.exports.setupPackages = setupPackages;
module.exports.rawGet = rawGet;
