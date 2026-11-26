// Its UI is built only when it is enabled (see `build.enable`)
module.exports = {
  options: {
    ignoreNoCodeWarning: true,
    enabled: false
  },
  build: {
    enable: options => options.enabled === true
  }
};
