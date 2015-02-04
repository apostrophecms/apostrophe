module.exports = {
  construct: function(self, options) {
    self.options = options;
    self.apos = options.apos;
    // The URL for routes relating to this module is based on the
    // module name but is not distinct at the project level. Use the
    // metadata provided by moog to figure out the name
    self.action = '/modules/' + self.__meta.name;
    // mailer
    // pushAssets
    // route
    // etc
    // only if services are ready
    self.pushAsset = function(type, name) {
      self.apos.assets.push(self.__meta, type, name);
    };
  }
};
