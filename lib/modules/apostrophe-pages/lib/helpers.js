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
    }
  });
};
