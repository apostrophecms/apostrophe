module.exports = {
  extend: 'bundle-page-type',
  webpack: {
    bundles: {
      main: {},
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
