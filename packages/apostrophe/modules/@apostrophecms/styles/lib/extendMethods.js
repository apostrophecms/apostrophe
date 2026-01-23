const { klona } = require('klona');

module.exports = self => {
  return {
    composeSchema(_super, ...args) {
      // Disable the fields vs styles check for now, because
      // it causes problems with modules that insert automatically fields.
      // We merge "system" fields with styles to prevent e.g. query failures.
      // self.ensureNoFields();

      self.presets = {};
      self.setStandardPresets();
      self.registerPresets();

      // Required only if the legacy fields schema is used.
      // Styles-flavored schema doesn't play well with all the things schemas need
      // Copy it out to another property and ungroup the fields
      if (Object.keys(self.fieldsGroups).length) {
        // klona to avoid problems with shared data structures due to inheritance. -Tom
        const defaultGroups = klona(self.apos.modules['@apostrophecms/any-doc-type']
          .fieldsGroups);
        const stylesGroups = klona(self.fieldsGroups);
        for (const group in defaultGroups) {
          delete stylesGroups[group];
        }
        self.stylesGroups = {
          ...self.stylesGroups,
          ...stylesGroups
        };
        self.fieldsGroups = defaultGroups;
      }
      const fieldSchema = self.expandStyles(self.styles);
      self.fields = {
        ...self.fields,
        ...fieldSchema
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
