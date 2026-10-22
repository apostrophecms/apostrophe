module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'Placeholder Test Widget',
    placeholder: true
  },
  fields: {
    add: {
      string: {
        type: 'string',
        label: 'String',
        placeholder: 'String PLACEHOLDER'
      },
      integer: {
        type: 'integer',
        label: 'Integer',
        placeholder: 0
      },
      float: {
        type: 'float',
        label: 'Float',
        placeholder: 0.1
      },
      date: {
        type: 'date',
        label: 'Date',
        placeholder: 'YYYY-MM-DD'
      },
      time: {
        type: 'time',
        label: 'Time',
        placeholder: 'HH:MM:SS'
      }
    }
  }
};
