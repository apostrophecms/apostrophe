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
      ext1: {
        resolve: {
          alias: {
            ext1Overriden: 'bar-path'
          }
        }
      },
      ext2: {
        resolve: {
          alias: {
            ext2: 'ext2-path'
          }
        }
      }
    }
  }
};
