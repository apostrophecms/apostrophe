var _ = require('lodash');

module.exports = function(self, options) {
  self.addHelpers({
    menu: function(options){
      return self.partial('menu', options);
    },
    publishMenu: function(options) {
      return self.partial('publishMenu', options);
    },
    isAncestorOf: function(possibleAncestorPage, ofPage) {
      return self.isAncestorOf(possibleAncestorPage, ofPage);
    },
    afterContextMenu: function() {
      return self.apos.templates.safe(
        _.map(self.afterContextMenuHelpers || [], function(helper) {
          return helper(self.apos.templates.contextReq);
        }).join('')
      );
    }
  });
};
