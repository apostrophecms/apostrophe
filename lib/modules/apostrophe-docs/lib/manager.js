var _ = require('lodash');

// This creates a default manager for a particular type of doc.
// If you need to extend it, use getManager(type), then
// modify the manager object returned. Or use _.defaults to
// add properties from this object to your own object.

module.exports = function(self, type) {
  var manager = {
    name: type,
    find: function(req, criteria, projection) {
      return self.find(req, criteria, projection).type(type);
    },
    newInstance: function() {
      var doc = self.apos.schemas.newInstance(manager.schema);
      doc.type = type;
      return doc;
    },
    getAutocompleteProjection: function(query) {
      return {
        title: 1,
        _id: 1
      };
    },
    getAutocompleteTitle: function(doc, query) {
      return doc.title;
    },
    // Used by apostrophe-versions to label changes that
    // are made to joins by ID
    decorateChange: function(doc, change) {
      change.text = doc.title;
    },
    schema: _.cloneDeep(self.apos.docs.schema)
  };
  return manager;
};
