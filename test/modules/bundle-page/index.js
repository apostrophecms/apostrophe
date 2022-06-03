module.exports = {
  extend: '@apostrophecms/piece-page-type',
  webpack: {
    bundles: {
      extra: {
        templates: [ 'show' ]
      }
    },
    extensions: {
      ext1: {
        resolve: {
          alias: {
            ext1: 'foo-path'
          }
        }
      }
    },
    extensionOptions: {
      ext1(options) {
        return {
          alias: {
            ...options.alias || {},
            testAlias: 'test-path'
          }
        };
      }
    }
  },
  fields: {
    add: {
      main: {
        type: 'area',
        contextual: true,
        options: {
          widgets: {
            bundle: {}
          }
        }
      }
    }
  }
};
