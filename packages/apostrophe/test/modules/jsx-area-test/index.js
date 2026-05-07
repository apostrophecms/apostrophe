module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    alias: 'jsxAreaTest',
    name: 'jsx-area-test',
    label: 'JSX Area Test'
  },
  fields: {
    add: {
      main: {
        type: 'area',
        label: 'Main',
        options: {
          widgets: {
            '@apostrophecms/rich-text': {},
            'jsx-async': {}
          }
        }
      }
    }
  }
};
