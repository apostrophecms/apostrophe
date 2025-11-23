const { pathToFileURL: pathToFileURLOriginal } = require('url');
const { glob: globOriginal } = require('glob');

const {
  resolve: resolveOriginal,
  dirname: dirnameOriginal
} = require('path');

module.exports = {
  glob,
  resolve,
  dirname,
  pathToFileURL
};

async function glob(path, options) {
  const results = await globOriginal(path, options);
  return results.map(result => result.replaceAll('\\', '/'));
}

function resolve(...args) {
  return resolveOriginal(...args).replaceAll('\\', '/');
}

function dirname(path) {
  return dirnameOriginal(path).replaceAll('\\', '/');
}

function pathToFileURL(path) {
  if (process.platform === 'win32') {
    // On Windows this is the only reliable option
    return pathToFileURLOriginal(path);
  } else {
    // On non-Windows wrapping it as a protocol-absolute URL
    // is never necessary and breaks "npm link"
    return path;
  }
}
