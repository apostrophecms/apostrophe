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

  // For access to the sanitize methods
  var apos = options.apos;

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
  // `edit-page`, `view-page`, `publish-page`, `edit-file`
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
    var result = self._check(req, action, 'criteria', {}, { _iNeverMatch: true }, undefined, function(req, permissions, verb, type, object, strategy) {
      return strategy.criteria(req, permissions, verb, type);
    });
    return result;
  };

  // Add a permission everyone gets in the generic case, even if
  // not logged in. It is useful to add edit-files, for instance, to
  // allow file uploads by anonymous users for apostrophe-moderator.
  //
  // View permissions are handled separately.

  self.addPublic = function(permission) {
    self.publicPermissions[permission] = true;
  };

  // Set all the public permissions at once. Pass an array of
  // actions, like this: [ 'edit-file' ]
  //
  // View permissions are handled separately.

  self.setPublic = function(permissions) {
    self.publicPermissions = {};
    _.each(permissions, function(permission) {
      self.publicPermissions[permission] = true;
    });
  };

  // Given a request object for a user with suitable permissions, a data
  // object with loginRequired, loginRequiredPropagate and pagePermissions
  // properties, and a page object, this method will sanitize and apply
  // those permissions settings to the page and also propagate them to
  // descendant pages if it is requested.
  //
  // Propagation is only performed if a "propagator" function is passed.
  // This function will be called like the update method of a mongodb
  // collection, except without the first argument. You supply a
  // wrapper function that does the actual MongoDB update call with
  // criteria that match your descendant pages.
  //
  // The entries in the data.pagePermissions array may be strings such
  // as "view-xxx" where xxx is a user or group ID, or they may be
  // objects in which such a string is the "value" property, and the
  // "removed" and "propagate" properties may also be present.
  //
  // This method does NOT actually save the page object itself, although
  // it does update its properties, and it does directly modify
  // descendant pages if propagation is requested. It is your responsibility
  // to save the page object itself afterwards.
  //
  // "data" is usually req.body, however it may be convenient to call
  // this method from tasks as well.
  //
  // This method is designed to work with the data property created
  // by apos.permissions.debrief on the browser side.
  //
  // If options.editorsCanChangeEditPermissions is true, editing of
  // edit permissions is not restricted to admins.
  //
  // The `options` argument may be omitted.

  self.apply = function(req, data, page, propagator, options, callback) {

    if (arguments.length === 5) {
      callback = arguments[4];
      options = {};
    }

    // Only admins can change editing permissions.
    //
    // TODO I should be checking this as a named permission in its own right

    var userPermissions = req.user && req.user.permissions;

    var allowed = [ 'view' ];
    if (options.editorsCanChangeEditPermissions || userPermissions.admin) {
      allowed = [ 'view', 'edit', 'publish' ];
    }

    var propagatePull;
    var propagateAdd;
    var propagateSet;
    var propagateUnset;
    var loginRequired = apos.sanitizeSelect(data.loginRequired, [ '', 'loginRequired', 'certainPeople' ], '');
    if (loginRequired === '') {
      delete page.loginRequired;
    } else {
      page.loginRequired = loginRequired;
    }
    if (apos.sanitizeBoolean(data.loginRequiredPropagate)) {
      if (loginRequired !== '') {
        propagateSet = { loginRequired: loginRequired };
      } else {
        propagateUnset = { loginRequired: 1 };
      }
    }

    page.pagePermissions = page.pagePermissions || [];
    var map = {};
    var permissions = _.filter(page.pagePermissions, function(permission) {
      var matches = permission.split(/\-/);
      var verb = matches[0];
      var id = matches[1];
      if (!_.contains(allowed, verb)) {
        // We are not authorized to adjust permissions for this verb,
        // keep what is there
        return true;
      } else {
        // Strip this; we'll put it back if the user still wants it below
        return false;
      }
    });

    _.each(data.pagePermissions || [], function(permission) {
      // If we're not propagating (a new page), normalize
      // the rule to look like what we get when we're propagating
      if (typeof(permission) !== 'object') {
        permission = {
          value: apos.sanitizeString(permission),
          propagate: false,
          removed: false
        };
      }

      permission.value = apos.sanitizeString(permission.value);
      if (!permission.value.match(/^\w+\-([\w\-]+)$/)) {
        return;
      }

      var removed = apos.sanitizeBoolean(permission.removed);
      var propagate = apos.sanitizeBoolean(permission.propagate);
      if (removed) {
        if (propagate) {
          if (!propagatePull) {
            propagatePull = [];
          }
          propagatePull.push(permission.value);
        }
      } else {
        if (propagate) {
          if (!propagateAdd) {
            propagateAdd = [];
          }
          propagateAdd.push(permission.value);
        }
        // Duplicates shouldn't happen but it's the server's job to
        // watch out for the unlikely
        if (!_.contains(permissions, permission.value)) {
          permissions.push(permission.value);
        }
      }
    });

    page.pagePermissions = permissions;

    if (!propagator) {
      return setImmediate(callback);
    }

    if (propagatePull || propagateAdd || propagateSet || propagateUnset) {
      var command = {};
      if (propagatePull) {
        command.$pull = { pagePermissions: { $in: propagatePull } };
      }
      if (propagateAdd) {
        command.$addToSet = { pagePermissions: { $each: propagateAdd } };
      }
      if (propagateSet) {
        command.$set = propagateSet;
      }
      if (propagateUnset) {
        command.$unset = propagateUnset;
      }
      if (propagatePull && propagateAdd) {
        // Oh brother, must do it in two passes
        // https://jira.mongodb.org/browse/SERVER-1050
        var pullCommand = { $pull: command.$pull };
        delete command.$pull;
      }
      return async.series({
        pull: function(callback) {
          if (!pullCommand) {
            return callback(null);
          }
          return propagator(pullCommand, { multi: true }, callback);
        },
        main: function(callback) {
          return propagator(command, { multi: true }, callback);
        }
      }, callback);
    } else {
      return setImmediate(callback);
    }
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

  self.annotate = function(req, action, objects) {
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

  // Returns a user ID which is unique for this logged-in user, or if the user
  // is not logged in, an ID based on their session which will continue to be
  // available for as long as their session lasts

  self.getEffectiveUserId = function(req) {
    return (req.user && req.user._id) || ('anon-' + req.sessionID);
  };

  // Adds the given permission to the given page for the
  // user associated with the given request. Does not update
  // the page in the database; you need to do that.
  //
  // Currently this only makes sense with things that use the "page"
  // strategy (pretty much everything except files), and the
  // verbs that will work are `view`, `edit` and `publish`.
  //
  // For things that use the "owner" strategy, just set ownerId.

  self.add = function(req, page, permission) {
    page.pagePermissions = page.pagePermissions || [];
    // Allow 'edit-page' to be passed in, but we're really
    // only interested in the verb when building a permissions
    // array to store in the object
    permission = permission.replace(/\-.*$/, '');
    page.pagePermissions.push(permission + '-' + self.getEffectiveUserId(req));
  };

  self._options = options;

  if (options.workflow) {
    // publish permissions are superior to edit permissions
    self.impliedBy = options.impliedBy || {
      view: [ 'submit', 'edit', 'publish', 'admin' ],
      submit: [ 'edit', 'publish', 'admin' ],
      edit: [ 'publish', 'admin' ],
      publish: [ 'admin' ]
    };
  } else {
    // Without workflow there is no "can publish" checkbox and
    // we should treat edit permissions as being just as good
    // as publish permissions
    self.impliedBy = options.impliedBy || {
      view: [ 'submit', 'edit', 'publish', 'admin' ],
      submit: [ 'edit', 'publish', 'admin' ],
      publish: [ 'edit', 'admin' ],
      // Make sure publish still implies edit so that
      // publish permissions present before a site
      // switches off workflow are still honored
      edit: [ 'publish', 'admin' ]
    };

  }

  // Permissions that everyone has in the generic case. Typically empty
  // except on sites that allow anonymous uploads, submissions, etc.
  // view is handled as a special case

  self.publicPermissions = {};

  self.types = options.types || {
    page: {
      strategy: 'page'
    },
    file: {
      strategy: 'owner'
    }
  };

  self.defaultStrategy = options.defaultStrategy || 'page';

  self._check = function(req, action, event, _true, _false, object, then) {
    function filter(response) {
      // Post an event allowing an opportunity to change the result
      var result = { response: response };
      self.emit(event, req, action, object, result);
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

    if (verb === 'edit') {
      if (!(permissions.edit || permissions['edit-' + type])) {
        // Those without the generic edit permission for
        // something may not gain access to do it
        // via a specific permission attached to
        // an object. In other words, you have to
        // have the "edit" permission to edit any
        // pages ever, and you have to have either
        // "edit" or "edit-events" to edit events
        return filter(_false);
      }
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
          if (req.user && object.published && (object.loginRequired === 'certainPeople') && _.intersection(self.userPermissionNames(req.user, 'view'), object.pagePermissions).length) {
            return true;
          }

          // Case #4: you can edit the object
          if (req.user && _.intersection(self.userPermissionNames(req.user, 'edit'), object.pagePermissions).length) {
            return true;
          }
        } else {
          // Not view permissions

          // Case #4: we are only interested in people with a
          // specific permission.
          if (req.user && _.intersection(self.userPermissionNames(req.user, verb), object.pagePermissions).length) {
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
              pagePermissions: { $in: self.userPermissionNames(req.user, 'view') }
            });

            // Case #4: can edit the page
            clauses.push({
              pagePermissions: {
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
            pagePermissions: {
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
    owner: {
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

  // Given a permission name, this method appends the user ID and
  // the user's group IDs to each one and returns the resulting
  // array. For instance, if the user's ID is xyz and the user
  // is in groups with IDs abc and def, and this method is invoked
  // for the permission name "edit", the return value will be:
  //
  // [ "edit-xyz", "edit-abc", "edit-def" ]
  //
  // Permissions with such names are stored in the .pagePermissions
  // property of each page.
  //
  // Permission names that imply "edit" are also included,
  // for instance "publish-xyz" is also good enough.
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

}

// Required because EventEmitter is built on prototypal inheritance,
// calling the constructor is not enough
require('util').inherits(Permissions, require('events').EventEmitter);

module.exports = function(options) {
  return new Permissions(options);
};

