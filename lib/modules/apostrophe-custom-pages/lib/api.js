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
  //
  // Used only when extended permissions are not in effect.

  self.getEditPermissionName = function() {
    return 'edit-apostrophe-page';
  };

  // Returns the minimum permission name that should be checked for
  // to determine if this user has blanket admin privileges for
  // this doc type. For pages this is always `admin-apostrophe-page`
  // because page types can be switched.
  //
  // Used only when extended permissions are not in effect.

  self.getAdminPermissionName = function() {
    if (self.isAdminOnly()) {
      return 'admin';
    }
    return 'admin-apostrophe-page';
  };

  // When extended permissions are in effect, returns an array of
  // permissions all of which the user must have in order to be
  // a candidate to perform the verb, if and only if they have
  // been designated specifically as an editor of a given piece via their
  // user id or group id(s).
  //
  // Used when extended permissions are in effect.

  self.getSometimesPermissionNames = function(verb) {
    if (self.isAdminOnly()) {
      return 'admin';
    }
    if (verb === 'trash') {
      return [ 'update-apostrophe-page', 'trash-apostrophe-page' ];
    }
    return verb + '-apostrophe-page';
  };

  // When extended permissions are in effect, returns an array of
  // permission names all of which the user must have in order to be
  // able to perform the verb on ANY piece of this type, regardless
  // of whether they were given permission specifically for that
  // individual piece. For instance, if the verb is `update`,
  // this returns `updateany-yourpiecetypename`. Accommodates
  // exceptions like `adminOnly` and special cases like the
  // `trash` verb, which requires both `update` permission
  // and `trash` permission.
  //
  // Used when extended permissions are in effect.

  self.getAlwaysPermissionNames = function(verb) {
    if (self.isAdminOnly()) {
      return 'admin';
    }
    if (verb === 'trash') {
      return [ 'updateany-apostrophe-page', 'trash-apostrophe-page' ];
    }
    return verb + 'any-apostrophe-page';
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
