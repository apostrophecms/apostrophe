
module.exports = {
  alias: 'tags',
  afterConstruct: function(self) {
    self.createRoutes();
    self.pushAssets();
    self.pushCreateSingleton();
  },
  construct: function(self, options) {

    require('./lib/api')(self, options);
    require('./lib/implementation')(self, options);
    require('./lib/routes')(self, options);
    require('./lib/browser')(self, options);

    self.addHelpers({
      menu: function() {
        return self.partial('menu', { options: options });
      }
    })
  }
}
