apos.define('apostrophe-pieces-widget-editor', {
  extend: 'apostrophe-widget-editor',
  construct: function(self, options) {
    self.applyTemplateOptionsToSchema = function() {
      // Modify self.schema, which is our own safe copy of the schema for this widget type,
      // based on the template options. This allows template options like "limit" to be
      // attached to joins and so on. The server side should make the same adjustments
      var byId = _.find(self.schema, '_pieces');
      if (byId) {
        if (self.options.templateOptions.limit) {
          byId.limit = self.options.templateOptions.limit;
        }
      }
    };
  }
});

