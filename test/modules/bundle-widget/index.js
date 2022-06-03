module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'Bundle Widget'
  },
  webpack: {
    bundles: {
      extra2: {}
    },
    extensions: {
      ext1(options) {
        return {
          mode: options.mode,
          resolve: {
            alias: {
              ext1Overriden: 'bar-path',
              ...options.alias
            }
          }
        };
      },
      ext2: {
        resolve: {
          alias: {
            ext2: 'ext2-path'
          }
        }
      }
    },
    extensionOptions: {
      ext1: {
        mode: 'production'
      }
    }
  }
};
