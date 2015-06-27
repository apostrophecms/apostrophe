var _ = require('lodash');

// This creates a default manager for a particular type of doc.
// If you need to extend it, use getManager(type), then
// modify the manager object returned.

module.exports = function(self, type) {
  return {
    name: type,
    find: function(req, criteria, projection) {
      return self.find(req, criteria, projection).type(type);
    },
    getAutocompleteProjection: function(query) {
      return {
        title: 1,
        _id: 1
      };
    },
    addExtraAutocompleteCriteria: function(cursor, query) {
      return;
    },
    getAutocompleteTitle: function(doc, query) {
      return doc.title;
    },
    schema: _.cloneDeep(self.apos.pages.schema)
  };
};
