module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'Arguments Testing Widget'
  },
  fields: {
    add: {
      snippet: {
        type: 'string',
        label: 'Snippet'
      }
    }
  }
};
