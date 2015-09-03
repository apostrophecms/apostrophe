apos.define('apostrophe-versions', {

  extend: 'apostrophe-context',

  beforeConstruct: function(self, options) {
    self.options = options;
  },

  afterConstruct: function(self) {
    self.addLinks();
  },

  construct: function(self) {
    self.addLinks = function() {
      apos.ui.link('versions', 'page', function() {
        apos.create('apostrophe-versions-editor', {
          action: self.action,
          _id: apos.pages.options.page._id,
          afterRevert: function() {
            window.location.reload(true);
          }
        });
      });
      // pieces subclasses can be many and varied, so they add
      // their own links to trigger the versions editor. TODO:
      // should the above code move into apostrophe-pages too
      // for the sake of consistency? That could obviate the
      // need for this singleton. -Tom
    };

    apos.versions = self;
  }
});
