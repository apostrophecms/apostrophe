module.exports = function(self, options) {
  var helpers = {
    menu: function() {
      return self.partial('menu', { options: options });
    }
  };
  self.addHelpers(helpers);
}
