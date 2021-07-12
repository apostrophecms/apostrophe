module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'apostrophe:imageTag',
    quickCreate: false,
    autopublish: true,
    editRole: 'editor',
    publishRole: 'editor'
  },
  fields: {
    remove: [ 'visibility' ]
  }
};
