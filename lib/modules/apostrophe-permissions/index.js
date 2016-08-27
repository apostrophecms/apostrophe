// This module manages the permissions of docs in Apostrophe.

module.exports = {

  alias: 'permissions',

  construct: function(self, options) {
    require('./lib/api')(self, options);
    require('./lib/strategiesApi')(self, options);
  }
};
