module.exports = function(self, options) {
  self.addHelpers({
    menu: function(options){
      return self.partial('menu', options);
    }
  });
}
