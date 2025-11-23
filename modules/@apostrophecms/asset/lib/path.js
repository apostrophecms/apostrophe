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

// Don't make the URL protocol-absolute unless we
// have to (for Windows paths with a drive letter). Allows
// vite and webpack to still work with "npm link". For server
// side purposes, standard pathToFileURL is fine

function pathToFileURL(path) {
  if (path.match(/^[a-zA-Z]:/)) {
    return pathToFileURLOriginal(path);
  } else {
    return path;
  }
}
