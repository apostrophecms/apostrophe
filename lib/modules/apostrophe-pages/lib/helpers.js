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
    },

    // Emit controls section of page editor modal: the cancel/save buttons, etc.
    editControls: function() {
      // Clone so it can be modified without affecting future instances
      // (if you want to modify nested properties, clone more deeply)
      var controls = _.cloneDeep(self.editControls);
      // An override opportunity: modify the controls property
      self.apos.emit('pagesEditControls', {
        req: self.apos.templates.contextReq,
        type: self.name,
        controls: controls
      });
      return self.partial('controls', { controls: controls });
    }

  });

};
