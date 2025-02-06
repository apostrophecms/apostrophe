module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'apostrophe:fileTag',
    pluralLabel: 'apostrophe:fileTags',
    quickCreate: false,
    autopublish: true,
    versions: true,
    editRole: 'editor',
    publishRole: 'editor',
    shortcut: 'G,Shift+F',
    relationshipSuggestionIcon: 'tag-icon'
  },
  fields: {
    remove: [ 'visibility' ]
  }
};
