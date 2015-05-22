module.exports = function(self, options) {
  self.apos.templates.addToApos({
    pages: {
      menu: function(options){
        return self.partial('menu', { args: options });
      }
    }
  })
}
