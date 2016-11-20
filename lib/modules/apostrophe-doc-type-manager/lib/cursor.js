// Cursor for fetching docs of this specific type. The `afterConstruct`
// method locks the results down to this type by calling the
// `self.type` filter for us. Subclasses frequently add new filters.

module.exports = {
  extend: 'apostrophe-cursor',
  afterConstruct: function(self) {
    self.type(self.options.module.name);
    // Add cursor filter methods for each field in the schema
    self.apos.schemas.addFilters(self.options.module.schema, self);
  }
};
