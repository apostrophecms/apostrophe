module.exports = {
  extend: '@apostrophecms/page-type',
  options: {
    label: 'Test Styles Page'
  },
  fields: {
    add: {
      body: {
        type: 'area',
        options: {
          widgets: {
            'test-style': {}
          }
        }
      }
    }
  }
};
