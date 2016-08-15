var _ = require('lodash');

// This creates a default manager for a particular type of doc.
// If you need to extend it, use getManager(type), then
// modify the manager object returned. Or use _.defaults to
// add properties from this object to your own object. The latter
// technique is commonly used in our code.

module.exports = function(self, type) {
  var manager = {
    name: type,
    find: function(req, criteria, projection) {
      return self.find(req, criteria, projection).type(type);
    },
    newInstance: function() {
      // Careful, we can't refer to `manager` as self because of the way our
      // methods get merged into other objects; so get the actual manager
      var doc = self.apos.schemas.newInstance(self.apos.docs.getManager(type).schema);
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
    // Return true if only admins are allowed to edit this type.
    // Respected by the permissions module when it
    // enumerates doc types for the permissions list
    // of the groups module.
    isAdminOnly: function() {
      return false;
    },
    // Return a new schema containing only fields for which the
    // current user has the permission specified by the `permission`
    // property of the field, or there is no `permission` property for the field
    allowedSchema: function(req) {
      // Careful, we can't refer to `manager` as self because of the way our
      // methods get merged into other objects; so get the actual manager
      var schema = _.filter(self.apos.docs.getManager(type).schema, function(field) {
        return (!field.permission) || self.apos.permissions.can(req, field.permission);
      });
      return schema;
    },
    schema: _.cloneDeep(self.apos.docs.schema)
  };
  return manager;
};
