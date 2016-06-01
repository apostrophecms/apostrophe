var _ = require('lodash');

module.exports = {

  extend: 'apostrophe-pieces-cursor',

  construct: function(self, options) {

    // Users are a backend concept, we usually don't care if they are published
    self.published(null);

    self.addFilter('singleGroup', {
      def: self.options.groups,
      after: function(results) {
        var options = self.get('singleGroup');
        if(!options){
          return;
        }
        _.each(results, function(result){
          if(result.groupIds){
            result.group = result.groupIds[0];
          }
        });
      }
    });
  }
};
