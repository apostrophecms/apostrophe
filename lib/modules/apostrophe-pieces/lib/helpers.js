module.exports = function(self, options) {
  var helpers = {
    menu: function() {
      return self.partial('menu', { options: options });
    }
  };
  var parent = {};
  parent[self.__meta.name] = helpers;
  self.apos.templates.addToApos(parent);
}
