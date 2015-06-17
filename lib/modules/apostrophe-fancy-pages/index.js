module.exports = {
  construct: function(self, options) {
    self.name = self.options.name || self.__meta.name.replace(/\-pages$/, '');
    // require('./lib/routes.js')(self, options);
    require('./lib/dispatch.js')(self, options);
    // require('./lib/api.js')(self, options);
  }
};