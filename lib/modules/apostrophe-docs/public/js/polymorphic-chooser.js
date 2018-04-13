apos.define('apostrophe-polymorphic-chooser', {
  extend: 'apostrophe-doc-type-chooser',
  construct: function(self, options) {
    // TODO
    // disable edit
    // disable relationships
    // disable autocomplete
    self.launchBrowser = function() {
      return self.convertInlineRelationships(function(err) {
        if (err) {
          apos.notify('Please address errors first.', { type: 'error' });
          return;
        }
        return apos.create('apostrophe-polymorphic-chooser-modal', {
          decorate: self.decorateManager,
          chooser: self,
          source: 'polymorphic-chooser-modal',
          body: {
            limit: self.limit,
            types: self.field.withType
          },
          transition: 'slide'
        });
      });
    };
        
  }
});
