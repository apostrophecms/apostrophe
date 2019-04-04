// This module manages the permissions of docs in Apostrophe.

var Promise = require('bluebird');
var _ = require('@sailshq/lodash');

module.exports = {

  alias: 'permissions',

  afterConstruct: function(self) {
    self.pushSingleton();
  },

  construct: function(self, options) {
    self.extended = self.options.extended;
    require('./lib/api')(self, options);
    require('./lib/browser')(self, options);
    require('./lib/strategiesApi')(self, options);
    self.addListTask = function() {
      return self.addTask('list', 'Usage: node app apostrophe-permissions:list', function() {
        return Promise.try(function() {
          // eslint-disable-next-line no-console
          console.log(_.pluck(self.getChoices(), 'value').join('\n'));
        });
      });
    };

    self.modulesReady = function() {
      self.addListTask();
    };
  }
};
