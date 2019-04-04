// The `apostrophe-tags` module provides administration tools for managing
// tags on the site. This module subclasses pieces in order to provide a way
// to store tags that were created directly in the tag administration interface
// and do not appear on any other types of pieces yet. This ensures that they
// are visible when autocompleting tags.

module.exports = {
  extend: 'apostrophe-pieces',
  alias: 'tags',
  name: 'tag',
  label: 'Tag',
  adminOnly: true,
  afterConstruct: function(self) {
    self.pushDefinitions();
  },
  construct: function(self, options) {

    require('./lib/api')(self, options);
    require('./lib/implementation')(self, options);
    require('./lib/routes')(self, options);
    require('./lib/browser')(self, options);

    self.addHelpers({
      menu: function() {
        return self.partial('menu', { options: options });
      }
    });
  }
};
