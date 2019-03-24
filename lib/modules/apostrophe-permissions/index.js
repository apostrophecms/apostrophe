// This module manages the permissions of docs in Apostrophe.

let Promise = require('bluebird');
let _ = require('lodash');

module.exports = {

  alias: 'permissions',

  construct: function(self, options) {
    require('./lib/api')(self, options);
    self.addListTask = function() {
      return self.addTask('list', 'Usage: node app apostrophe-permissions:list', function() {
        return Promise.try(function() {
          // eslint-disable-next-line no-console
          console.log(_.map(self.getChoices(), 'value').join('\n'));
        });
      });
    };

    self.on('apostrophe:modulesReady', 'addListTask');
  }
};
