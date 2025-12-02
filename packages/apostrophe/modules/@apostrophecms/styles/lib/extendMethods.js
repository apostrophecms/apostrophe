module.exports = self => {
  return {
    composeSchema(_super, req) {
      // Styles-flavored schema doesn't play well with all the things schemas need
      // Copy it out to another property and ungroup the fields
      const defaultGroups = self.apos.modules['@apostrophecms/any-doc-type'].fieldsGroups;
      self.stylesGroups = self.fieldsGroups;
      for (const group in defaultGroups) {
        delete self.stylesGroups[group];
      }
      self.fieldsGroups = defaultGroups;
      _super(req);
    },
    getBrowserData(_super, req) {
      return {
        ..._super(req),
        action: self.action,
        schema: self.schema,
        groups: self.stylesGroups,
        serverRendered: self.options.serverRendered,
        publishLabel: 'apostrophe:stylesPublish'
      };
    }
  };
};
