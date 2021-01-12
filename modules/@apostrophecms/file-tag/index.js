module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'File Tag',
    quickCreate: false,
    autopublish: true
  },
  fields: {
    remove: [ 'visibility' ]
  }
};
