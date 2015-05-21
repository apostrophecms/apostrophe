module.exports = function(self, options) {
  self.apos.templates.addToApos({
    pages: {
      menu: function(options){
        console.log("Let me make you a menu");
        return self.partial('menu', { args: options });
      }
    }
  })
}
