module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
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
