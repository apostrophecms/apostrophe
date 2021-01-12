module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Image Tag',
    quickCreate: false,
    autopublish: true
  },
  fields: {
    remove: [ 'visibility' ]
  }
};
