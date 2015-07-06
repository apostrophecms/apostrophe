var _ = require('lodash');

module.exports = function(self, cursor) {

  cursor.addFilter('singleGroup', {
    def: self.options.groups,
    after: function(results) {
      var options = cursor.get('singleGroup');
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
};
