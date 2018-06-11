var _ = require('@sailshq/lodash');

module.exports = function(self, options) {
  // Returns a MongoDB projection object to be used when querying
  // for this type if all that is needed is a title for display
  // in an autocomplete menu. Since this is a page, we are including
  // the slug as well. `query.field` will contain the schema field definition
  // for the join we're trying to autocomplete.
  var superGetAutocompleteProjection = self.getAutocompleteProjection;
  self.getAutocompleteProjection = function(query) {
    var projection = superGetAutocompleteProjection(query);
    projection.slug = 1;
    return projection;
  };

  // Returns a string to represent the given `doc` in an
  // autocomplete menu. `doc` will contain only the fields returned
  // by `getAutocompleteProjection`. `query.field` will contain
  // the schema field definition for the join the user is attempting
  // to match titles from. The default behavior is to return
  // the `title` property, but since this is a page we are including
  // the slug as well.
  self.getAutocompleteTitle = function(doc, query) {
    return doc.title + ' (' + doc.slug + ')';
  };

  // Returns the minimum permission name that should be checked for
  // to determine if this user has some edit privileges for
  // this doc type (not necessarily every instance of it),
  // for example the ability to create one. Determines
  // admin bar menu item visibility. For pages this is always
  // `edit-apostrophe-page` because page types can be switched.

  self.getEditPermissionName = function() {
    return 'edit-apostrophe-page';
  };

  // Returns the minimum permission name that should be checked for
  // to determine if this user has blanket admin privileges for
  // this doc type. For pages this is always `admin-apostrophe-page`
  // because page types can be switched.

  self.getAdminPermissionName = function() {
    return 'admin-apostrophe-page';
  };

  var superComposeSchema = self.composeSchema;

  // Extend `composeSchema` to flag the use of field names
  // that are forbidden or nonfunctional in page types,
  // i.e. path, rank, level

  self.composeSchema = function() {
    superComposeSchema();
    const forbiddenFields = [ 'path', 'rank', 'level' ];
    _.each(self.schema, function(field) {
      if (_.contains(forbiddenFields, field.name)) {
        throw new Error('Page type ' + self.name + ': the field name ' + field.name + ' is forbidden');
      }
    });
  };

};
