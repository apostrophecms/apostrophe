module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'apostrophe:fileTag',
    pluralLabel: 'apostrophe:fileTags',
    quickCreate: false,
    autopublish: true,
    editRole: 'editor',
    publishRole: 'editor',
    shortcut: 'G,g',
    relationshipSuggestionIcon: 'tag-icon'
  },
  fields: {
    remove: [ 'visibility' ]
  }
};
