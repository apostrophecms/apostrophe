module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'File Tag',
    quickCreate: false
  },
  fields: {
    remove: [ 'visibility' ]
  }
};
