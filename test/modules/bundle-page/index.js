module.exports = {
  extend: '@apostrophecms/piece-page-type',
  webpack: {
    bundles: {
      'extra-bundle': {
        templates: [ 'show' ]
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
