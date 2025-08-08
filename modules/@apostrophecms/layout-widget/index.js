module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'apostrophe:layout',
    steps: 12,
    minSpan: 1,
    defaultSpan: 4,
    defaultJustify: 'stretch',
    mobile: {
      breakpoint: 480
    },
    tablet: {
      breakpoint: 1024
    }
  },
  fields: {
    add: {
      columns: {
        type: 'area',
        options: {
          editorComponent: 'AposAreaLayoutEditor',
          widgets: {
            '@apostrophecms/layout-column': {}
          }
        }
      }
    }
  }
};
