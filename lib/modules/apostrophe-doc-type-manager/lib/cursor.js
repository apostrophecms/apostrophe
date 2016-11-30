// Cursor for fetching docs of this specific type. The `afterConstruct`
// method locks the results down to this type by calling the
// `self.type` filter for us. Subclasses frequently add new filters.

module.exports = {
  extend: 'apostrophe-cursor',
  afterConstruct: function(self) {
    self.type(self.options.module.name);
  },
  construct: function(self) {
    // Add cursor filter methods for each field in the schema. Doing it now allows
    // normal overrides of these generic filters by subclasses
    self.apos.schemas.addFilters(self.options.module.schema, {
      override: [ 'tags' ]
    }, self);
  }
};
