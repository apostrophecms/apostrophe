module.exports = {
  extend: '@apostrophecms/page-type',
  options: {
    label: 'Placeholder Test Page'
  },
  fields: {
    add: {
      main: {
        type: 'area',
        label: 'Main',
        options: {
          widgets: {
            placeholder: {},
            '@apostrophecms/image': {},
            '@apostrophecms/video': {}
          }
        }
      }
    }
  }
};
