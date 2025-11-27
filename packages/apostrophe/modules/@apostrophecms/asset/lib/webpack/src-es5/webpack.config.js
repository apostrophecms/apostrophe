module.exports = (options, apos) => {
  return require('../src/webpack.config.js')({
    ...options,
    es5: true
  }, apos);
};
