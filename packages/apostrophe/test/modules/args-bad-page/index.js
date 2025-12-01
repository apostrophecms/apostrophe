module.exports = {
  extend: '@apostrophecms/page-type',
  options: {
    label: 'Bad Page'
  },
  fields: {
    add: {
      main: {
        type: 'area',
        label: 'Main',
        options: {
          widgets: {
            args: {}
          }
        }
      }
    }
  }
};
