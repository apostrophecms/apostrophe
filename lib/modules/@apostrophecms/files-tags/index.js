module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Files Tag',
    fields: {
      add: {
        title: {
          type: 'string',
          required: true
        }
      }
    }
  }
};
