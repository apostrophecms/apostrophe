var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  self.addHelpers({

    menu: function(options) {
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

    // Emit controls section of page create modal: the cancel/save buttons, etc.
    createControls: function() {
      var req = self.apos.templates.contextReq;
      return self.partial('controls', { controls: self.getCreateControls(req) });
    },

    // Emit controls section of page editor modal: the cancel/save buttons, etc.
    editControls: function() {
      var req = self.apos.templates.contextReq;
      return self.partial('controls', { controls: self.getEditControls(req) });
    },

    isPage: function(page) {
      return self.isPage(page);
    }

  });

};
