var _ = require('lodash');
var async = require('async');

/**
 * permissions
 * @class Manages permissions of pages, files and other objects.
 * Provides methods for building MongoDB criteria that fetch things
 * the user is allowed to work with, and also for checking whether
 * the user can carry out specific actions, both on individual
 * objects and in the more general case (eg creating new objects).
 */

function Permissions(options) {
  options = options || {};

  var self = this;

  // Permissions is an event emitter/receiver
  require('events').EventEmitter.call(self);

  // Determines whether the active user "can" carry out the
  // action specified by "action". Returns true if the action
  // is permitted, false if not permitted.

  // This object emits a `can` event that provides an easy way to
  // extend permissions. The `can` event receives the request object, the
  // action, the object, and a `result` object with a `response` property
  // which is what will be returned by `can` if no changes are made.
  // To alter the result, just change `result.response`.
  //
  // Actions begin with a verb, followed by a hyphen and an
  // object type. For example:
  //
  // `edit-page`, `view-page`, `manage-page`, `edit-file`
  //
  // If there is no third argument, the question is whether this user can
  // perform the action in question to create a new object.
  //
  // If there is a third argument, this method checks whether the user can
  // carry out the specified action on that particular object.

  self.can = function(req, action, object) {
    return self._check(req, action, 'can', true, false, object, function(req, permissions, verb, type, object, strategy) {
      if (object) {
        return strategy.specific(req, permissions, verb, type, object);
      } else {
        return strategy.generic(req, permissions, verb, type);
      }
    });
  };

  // Returns a MongoDB criteria object which will match only objects
  // on which the current user is permitted to perform the
  // specified action.

  self.criteria = function(req, action) {
    return self._check(req, action, 'criteria', {}, { _iNeverMatch: true }, undefined, function(req, permissions, verb, type, object, strategy) {
      return strategy.criteria(req, permissions, verb);
    });
  };

  // Allow anonymous uploads. Handy to have a setter for this so that
  // the apostrophe-moderator module can activate it cleanly

  self.setPublicPermissions = function(permissions) {
    self.publicPermissions = permissions;
  };

  self.addPublicPermission = function(permission) {
    self.publicPermissions[permission] = true;
  };

  self._options = options;

  self.impliedBy = options.impliedBy || {
    view: [ 'view', 'edit', 'manage', 'admin' ],
    submit: [ 'edit', 'manage', 'admin' ],
    edit: [ 'manage', 'admin' ],
    manage: [ 'admin' ]
  };

  // Permissions that everyone has. Typically empty except on sites that allow
  // anonymous uploads, submissions, etc. view is handled as a special case
  self.publicPermissions = {};

  self.types = options.types || {
    page: {
      strategy: 'page',
      // Unless otherwise restricted
      everyoneCan: [ 'view' ]
    },
    file: {
      strategy: 'owner',
      // Unless otherwise restricted
      everyoneCan: [ 'view' ]
    }
  };

  self.defaultStrategy = options.defaultStrategy || 'owner';

  self._check = function(req, action, event, _true, _false, object, then) {
    function filter(response) {
      // Post an event allowing an opportunity to change the result
      var result = { response: response };
      self.emit(event, req, action, result);
      return result.response;
    }

    var permissions = {};
    _.extend(permissions, self.publicPermissions);
    _.extend(permissions, (req.user && req.user.permissions) || {});

    if (permissions.admin) {
      // Admins can do anything
      return filter(_true);
    }

    var matches = action.match(/^(\w+)\-([\w\-]+)$/);
    if (!matches) {
      return filter(_false);
    }
    var verb = matches[1];
    var type = matches[2];

    if (permissions['admin-' + type]) {
      // Admins of specific content types can do anything to them
      return filter(_true);
    }

    var strategy = self.strategies[(self.types[type] && self.types[type].strategy) || self.defaultStrategy];
    return filter(then(req, permissions, verb, type, object, strategy));
  };

  self.strategies = {
    page: {
      generic: function(req, permissions, verb, type) {
        if (verb === 'view') {
          return true;
        }
        if (permissions[verb]) {
          return true;
        }
        if (permissions[verb + '-' + type]) {
          return true;
        }
        if (_.find(self.impliedBy[verb] || [], function(implied) {
          if (permissions[implied]) {
            return true;
          }
          if (permissions[implied + '-' + type]) {
            return true;
          }
        })) {
          return true;
        }
        return false;
      },
      specific: function(req, permissions, verb, type, object) {
        var clauses = [];
        // view permissions have some niceties
        if (verb === 'view') {
          // Case #1: it is published and no login is required
          if (object.published && (!object.loginRequired)) {
            return true;
          }

          // Case #2: for logged-in users with the guest permission,
          // it's OK to show objects with loginRequired set to `loginRequired` but not `certainPeople`
          // (this is called "Login Required" on the front end)
          if (permissions.guest) {
            if (object.published && (object.loginRequired === 'loginRequired')) {
              return true;
            }
          }

          // Case #3: object is restricted to certain people
          if (req.user && object.published && (object.loginRequired === 'certainPeople') && _.intersection(self.userPermissionNames(req.user, 'view'), object.permissions).length) {
            return true;
          }

          // Case #4: you can edit the object
          if (req.user && _.intersection(self.userPermissionNames(req.user, 'edit'), object.permissions).length) {
            return true;
          }
        } else {
          // Not view permissions

          // Case #4: we are only interested in people with a
          // specific permission.
          if (req.user && _.intersection(self.userPermissionNames(req.user, verb), object.permissions).length) {
            return true;
          }
        }
        return false;
      },
      criteria: function(req, permissions, verb) {

        var clauses = [];

        // view permissions have some niceties
        if (verb === 'view') {
          // Case #1: it is published and no login is required
          clauses.push({
            published: true,
            loginRequired: { $exists: false }
          });

          if (req.user) {
            // Case #2: for logged-in users with the guest permission,
            // it's OK to show pages with loginRequired set to `loginRequired` but not `certainPeople`
            // (this is called "Login Required" on the front end)
            if (permissions.guest) {
              clauses.push({
                published: true,
                loginRequired: 'loginRequired'
              });
            }

            // Case #3: page is restricted to certain people

            clauses.push({
              published: true,
              loginRequired: 'certainPeople',
              permissions: { $in: self.userPermissionNames(req.user, 'view') }
            });

            // Case #4: can edit the page
            clauses.push({
              permissions: {
                $in: self.userPermissionNames(req.user, 'edit')
              }
            });
          }
        } else {
          // Not view permissions

          if (!req.user) {
            // We want to never match
            return { _iNeverMatch: true };
          }
          // Case #4: we are only interested in people with a
          // specific permission.
          clauses.push({
            permissions: {
              $in: self.userPermissionNames(req.user, verb)
            }
          });
        }
        if (!clauses.length) {
          // Empty $or is an error in MongoDB 2.6
          return {};
        }
        return { $or: clauses };
      }
    }
  };

  _.extend(self.strategies, {
    file: {
      generic: self.strategies.page.generic,
      specific: function(req, permissions, verb, type, object) {
        if (verb === 'view') {
          return true;
        }
        // Assume everything else is an editing operation
        if (object.ownerId === self.getEffectiveUserId(req)) {
          return true;
        }
        return false;
      },
      criteria: function(req, permissions, verb) {
        if (verb === 'view') {
          return {};
        }
        return {
          ownerId: self.getEffectiveUserId(req)
        };
      }
    }
  });

  // Returns a user ID which is unique for this logged-in user, or if the user
  // is not logged in, an ID based on their session which will continue to be
  // available for as long as their session lasts

  self.getEffectiveUserId = function(req) {
    return (req.user && req.user._id) || ('anon-' + req.sessionID);
  };

  // Given a permission name, this method appends the user ID and
  // the user's group IDs to each one and returns the resulting
  // array. For instance, if the user's ID is xyz and the user
  // is in groups with IDs abc and def, and this method is invoked
  // for the permission name "edit", the return value will be:
  //
  // [ "edit-xyz", "edit-abc", "edit-def" ]
  //
  // Permissions with such names are stored in the .permissions
  // property of each page.
  //
  // Permission names that imply "edit" are also included,
  // for instance "manage-xyz" is also good enough.
  //
  // Used internally to implement apos.permissions.criteria().

  self.userPermissionNames = function(user, names) {
    if (!user) {
      return [];
    }
    names = Array.isArray(names) ? names : [ names ];
    var groupIds = (user && user.groupIds) ? user.groupIds : [];

    _.each(names, function(name) {
      if (_.has(self.impliedBy, name)) {
        names = _.union(names, self.impliedBy[name]);
      }
    });

    var permissionNames = [];
    _.each(names, function(name) {
      _.each(groupIds, function(groupId) {
        permissionNames.push(name + '-' + groupId);
      });
      permissionNames.push(name + '-' + user._id);
    });

    return permissionNames;
  };

  // For each object in the array, if the user is able to
  // carry out the specified action, a property is added
  // to the object. For instance, if the action is "edit-page",
  // each page the user can edit gets a "._edit = true" property.
  //
  // Note the underscore.
  //
  // This is most often used when an array of objects the user
  // can view have been retrieved and we wish to know which ones
  // the user can also edit.

  self.addPermissionToObjects = function(req, action, objects) {
    var matches = action.match(/^(\w+)\-([\w\-]+)$/);
    var property;
    if (!matches) {
      property = '_' + action;
    } else {
      property = '_' + matches[1];
    }

    _.each(objects, function(object) {
      if (self.can(req, action, object)) {
        object[property] = true;
      }
    });
  };
}

// Required because EventEmitter is built on prototypal inheritance,
// calling the constructor is not enough
require('util').inherits(Permissions, require('events').EventEmitter);

module.exports = function(options) {
  return new Permissions(options);
};

