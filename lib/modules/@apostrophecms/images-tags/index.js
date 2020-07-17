module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Images Tag',
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
