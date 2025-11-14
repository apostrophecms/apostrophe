const { glob: globOriginal } = require('glob');
const {
  resolve: resolveOriginal,
  dirname: dirnameOriginal
} = require('path');

module.exports = {
  glob,
  resolve,
  dirname
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
