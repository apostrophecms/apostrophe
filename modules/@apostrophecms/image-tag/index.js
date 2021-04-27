module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Image Tag',
    quickCreate: false,
    autopublish: true,
    editRole: 'editor',
    publishRole: 'editor'
  },
  fields: {
    remove: [ 'visibility' ]
  }
};
