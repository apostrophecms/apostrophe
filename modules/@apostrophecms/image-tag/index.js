module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Image Tag',
    quickCreate: false
  },
  fields: {
    remove: [ 'visibility' ]
  }
};
