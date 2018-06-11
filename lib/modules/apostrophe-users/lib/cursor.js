var _ = require('@sailshq/lodash');

module.exports = {

  extend: 'apostrophe-pieces-cursor',

  afterConstruct: function(self) {
    // Users are a backend concept, we usually don't care if they are published
    self.published(null);
  },

  construct: function(self, options) {
    self.addFilter('singleGroup', {
      def: self.options.module.options.groups,
      after: function(results) {
        var options = self.get('singleGroup');
        if (!options) {
          return;
        }
        _.each(results, function(result) {
          if (result.groupIds) {
            result.group = result.groupIds[0];
          }
        });
      }
    });
  }
};
