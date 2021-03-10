// This module provides a special doc type manager for the `apostrophe-page` type, which
// actually refers to any page in the tree, regardless of type. This
// allows you to create [apostrophe-schemas](/advanced-topics/schema-guide.md) that can link to
// any page in the page tree, rather than one specific page type.

module.exports = {

  extend: 'apostrophe-doc-type-manager',

  // Never actually found
  name: 'apostrophe-page',

  pluralLabel: 'Pages',

  construct: function(self, options) {
    // Return a cursor for finding pages of any type (but only pages, never pieces).
    // `apostrophe-pages-cursor` takes care of ensuring that pieces don't creep in.
    self.find = function(req, criteria, projection) {
      return self.apos.create('apostrophe-pages-cursor', {
        apos: self.apos,
        req: req,
        criteria: criteria,
        projection: projection
      });
    };

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
  }
};
