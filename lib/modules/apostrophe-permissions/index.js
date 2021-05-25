// This module manages the permissions of docs in Apostrophe.
//
// ## Options
//
// `typeAdminsCanEditAllTypes`
//
// By default, assigning any admin piece permissions to a group
// (i.e. 'admin-apostrophe-image') will enable admin bar controls for
// all other pieces. This is to make management of joined items simpler in
// management dialogs. If this option is set to `true`, the admin bar will
// only show piece types that the user's group has been given explicit
// admin or edit permissions on. You will need to manage permissions for
// any joined pieces that also need to be editable.

var Promise = require('bluebird');
var _ = require('@sailshq/lodash');

module.exports = {

  alias: 'permissions',

  construct: function(self, options) {
    require('./lib/api')(self, options);
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
