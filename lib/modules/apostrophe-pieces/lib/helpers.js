module.exports = function(self, options) {
  var helpers = {
    menu: function() {
      return self.partial('menu', { options: options, permissions: req.permissions });
    }
  };
  var parent = {};
  parent[self.name] = helpers;
  self.apos.templates.addToApos(parent);
}
