module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'File Tag',
    quickCreate: false,
    autopublish: true,
    editRole: 'editor',
    publishRole: 'editor'
  },
  fields: {
    remove: [ 'visibility' ]
  }
};
