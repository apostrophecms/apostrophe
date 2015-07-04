var _ = require('lodash');
var async = require('async');

module.exports = function(self, options) {

  self.permissionPattern = /^([^\-]+)\-(.*)$/;

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
  // `edit-doc`, `view-doc`, `publish-doc`, `edit-file`
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
  // object with loginRequired, loginRequiredPropagate and docPermissions
  // properties, and a doc object, this method will sanitize and apply
  // those permissions settings to the doc and also propagate them to
  // descendant docs if it is requested.
  //
  // Propagation is only performed if a "propagator" function is passed.
  // This function will be called like the update method of a mongodb
  // collection, except without the first argument. You supply a
  // wrapper function that does the actual MongoDB update call with
  // criteria that match your descendant docs.
  //
  // The entries in the data.docPermissions array may be strings such
  // as "view-xxx" where xxx is a user or group ID, or they may be
  // objects in which such a string is the "value" property, and the
  // "removed" and "propagate" properties may also be present.
  //
  // This method does NOT actually save the doc object itself, although
  // it does update its properties, and it does directly modify
  // descendant docs if propagation is requested. It is your responsibility
  // to save the doc object itself afterwards.
  //
  // "data" is usually req.body, however it may be convenient to call
  // this method from tasks as well.
  //
  // This method is designed to work with the data property created
  // by apos.permissions.debrief on the browser side.

  self.apply = function(req, data, doc, propagator, callback) {

    // Only admins can change editing permissions.
    //
    // TODO I should be checking this as a named permission in its own right

    var userPermissions = req.user && req.user._permissions;

    var allowed = [ 'view' ];
    if (userPermissions.admin) {
      allowed = [ 'view', 'edit', 'publish' ];
    }

    var propagatePull;
    var propagateAdd;
    var propagateSet;
    var propagateUnset;
    var loginRequired = self.apos.sanitizeSelect(data.loginRequired, [ '', 'loginRequired', 'certainPeople' ], '');
    if (loginRequired === '') {
      delete doc.loginRequired;
    } else {
      doc.loginRequired = loginRequired;
    }
    if (self.apos.sanitizeBoolean(data.loginRequiredPropagate)) {
      if (loginRequired !== '') {
        propagateSet = { loginRequired: loginRequired };
      } else {
        propagateUnset = { loginRequired: 1 };
      }
    }

    doc.docPermissions = doc.docPermissions || [];
    var map = {};
    var permissions = _.filter(doc.docPermissions, function(permission) {
      var matches = permission.match(self.permissionPattern);
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

    _.each(data.docPermissions || [], function(permission) {
      // If we're not propagating (a new doc), normalize
      // the rule to look like what we get when we're propagating
      if (typeof(permission) !== 'object') {
        permission = {
          value: self.apos.sanitizeString(permission),
          propagate: false,
          removed: false
        };
      }

      permission.value = self.apos.sanitizeString(permission.value);
      if (!permission.value.match(self.permissionPattern)) {
        return;
      }

      var removed = self.apos.sanitizeBoolean(permission.removed);
      var propagate = self.apos.sanitizeBoolean(permission.propagate);
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

    doc.docPermissions = permissions;

    if (!propagator) {
      return setImmediate(callback);
    }

    if (propagatePull || propagateAdd || propagateSet || propagateUnset) {
      var command = {};
      if (propagatePull) {
        command.$pull = { docPermissions: { $in: propagatePull } };
      }
      if (propagateAdd) {
        command.$addToSet = { docPermissions: { $each: propagateAdd } };
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
  // to the object. For instance, if the action is "edit-doc",
  // each doc the user can edit gets a "._edit = true" property.
  //
  // Note the underscore.
  //
  // This is most often used when an array of objects the user
  // can view have been retrieved and we wish to know which ones
  // the user can also edit.

  self.annotate = function(req, action, objects) {
    var matches = action.match(self.permissionPattern);
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

  // Adds the given permission to the given doc for the
  // user associated with the given request. Does not update
  // the doc in the database; you need to do that.
  //
  // Currently this only makes sense with things that use the "doc"
  // strategy (pretty much everything except files), and the
  // verbs that will work are `view`, `edit` and `publish`.
  //
  // For things that use the "owner" strategy, just set ownerId.

  self.add = function(req, doc, permission) {
    doc.docPermissions = doc.docPermissions || [];
    // Allow 'edit-doc' to be passed in, but we're really
    // only interested in the verb when building a permissions
    // array to store in the object
    permission = permission.replace(/\-.*$/, '');
    doc.docPermissions.push(permission + '-' + self.getEffectiveUserId(req));
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
    doc: {
      strategy: 'doc'
    },
    file: {
      strategy: 'owner'
    }
  };

  self.defaultStrategy = options.defaultStrategy || 'doc';

  self._check = function(req, action, event, _true, _false, object, then) {
    function filter(response) {
      // Post an event allowing an opportunity to change the result
      var result = { response: response };
      self.apos.emit(event, req, action, object, result);
      return result.response;
    }

    var permissions = {};
    _.extend(permissions, self.publicPermissions);
    _.extend(permissions, (req.user && req.user._permissions) || {});

    if (permissions.admin) {
      // Admins can do anything
      return filter(_true);
    }

    var matches = action.match(self.permissionPattern);
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
        // docs ever, and you have to have either
        // "edit" or "edit-events" to edit events
        return filter(_false);
      }
    }

    var strategy = self.strategies[(self.types[type] && self.types[type].strategy) || self.defaultStrategy];
    return filter(then(req, permissions, verb, type, object, strategy));
  };

  // Given a permission name, this method appends the user ID and
  // the user's group IDs to each one and returns the resulting
  // array. For instance, if the user's ID is xyz and the user
  // is in groups with IDs abc and def, and this method is invoked
  // for the permission name "edit", the return value will be:
  //
  // [ "edit-xyz", "edit-abc", "edit-def" ]
  //
  // Permissions with such names are stored in the .docPermissions
  // property of each doc.
  //
  // Permission names that imply "edit" are also included,
  // for instance "publish-xyz" is also good enough.
  //
  // Used internally to implement self.apos.permissions.criteria().

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
};
