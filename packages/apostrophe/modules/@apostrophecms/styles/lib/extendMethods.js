module.exports = self => {
  return {
    composeSchema(_super, ...args) {
      self.ensureNoFields();

      self.presets = {};
      self.setStandardPresets();
      self.registerPresets();

      // Required only if the legacy fields schema is used.
      // Styles-flavored schema doesn't play well with all the things schemas need
      // Copy it out to another property and ungroup the fields
      if (Object.keys(self.fields).length) {
        const defaultGroups = self.apos.modules['@apostrophecms/any-doc-type'].fieldsGroups;
        self.stylesGroups = self.fieldsGroups;
        for (const group in defaultGroups) {
          delete self.stylesGroups[group];
        }
        self.fieldsGroups = defaultGroups;
      }

      // No need to copy groups, as the custom modal is already handling
      // `stylesGroups` explicitly.
      const fieldSchema = self.expandStyles(self.styles);
      self.fields = {
        ...fieldSchema,
        ...self.fields
      };
      return _super(...args);
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
