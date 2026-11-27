// Its UI is built only when it is enabled (see `build.enable`), its extra
// bundle too
module.exports = {
  options: {
    ignoreNoCodeWarning: true,
    enabled: false
  },
  build: {
    enable: options => options.enabled === true,
    vite: {
      bundles: {
        'ui-build-on-extra': {}
      }
    }
  },
  webpack: {
    bundles: {
      'ui-build-on-extra': {}
    }
  }
};
