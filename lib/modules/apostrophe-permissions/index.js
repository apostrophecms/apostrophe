/**
 * permissions
 * @class Manages permissions of pages, files and other objects.
 * Provides methods for building MongoDB criteria that fetch things
 * the user is allowed to work with, and also for checking whether
 * the user can carry out specific actions, both on individual
 * objects and in the more general case (eg creating new objects).
 */

module.exports = {

  alias: 'permissions',

  construct: function(self, options) {
    // Permissions is an event emitter/receiver
    require('events').EventEmitter.call(self);

    require('./lib/api')(self, options);
    require('./lib/strategiesApi')(self, options);

  }
};
