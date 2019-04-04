apos.define('apostrophe-polymorphic-manager-chooser', {
  extend: 'apostrophe-doc-type-manager-chooser',
  autocomplete: false,
  construct: function(self, options) {
    self.launchBrowser = function() {
      return self.convertInlineRelationships(function(err) {
        if (err) {
          apos.notify('Please address errors first.', { type: 'error' });
          return;
        }
        return apos.create('apostrophe-polymorphic-manager-manager-modal', {
          chooser: self,
          action: self.action,
          body: {
            limit: self.limit,
            field: self.field
          },
          transition: 'slide'
        });
      });
    };
  }
});
