var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  self.permissionPattern = /^([^-]+)-(.*)$/;

  // Determines whether the active user "can" carry out the
  // action specified by "action". Returns true if the action
  // is permitted, false if not permitted.

  // This object emits a `can` event that provides an easy way to
  // extend permissions. The `can` event receives the request object, the
  // action, the object, and a `result` object with a `response` property
  // which is what will be returned by `can` if no changes are made.
  // To alter the result, just change `result.response`.
  //
  // Actions begin with a verb, followed by a hyphen and a
  // doc type name.
  //
  // If there is no third argument, the question is whether this user can
  // perform the action in question to create a new object.
  //
  // If there is a third argument, this method checks whether the user can
  // carry out the specified action on that particular object.
  //
  // The newObject argument is used instead if the object is a new one not
  // yet in the database. This is a backwards-compatible way to make it
  // possible to consider properties of the object to be created before
  // making a decision.

  self.can = function(req, action, object, newObject) {
    return self._check(req, action, 'can', true, false, object, newObject, function(req, permissions, verb, type, object, newObject, strategy) {
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
    var result = self._check(req, action, 'criteria', {}, { _id: '__iNeverMatch' }, undefined, undefined, function(req, permissions, verb, type, object, newObject, strategy) {
      return strategy.criteria(req, permissions, verb, type);
    });
    return result;
  };

  // Add a permission everyone gets in the generic case, even if
  // not logged in. It is useful to add edit-attachment, for instance, to
  // allow file uploads by anonymous users for apostrophe-moderator.
  //
  // View permissions are handled separately.
  //
  // You may pass multiple arguments, all are added as public permissions. If you
  // pass an array as an argument, all permissions in the array are added.

  self.addPublic = function(permission) {
    _.each(arguments, function(permission) {
      if (Array.isArray(permission)) {
        _.each(permission, function(permission) {
          self.publicPermissions[permission] = true;
        });
      } else {
        self.publicPermissions[permission] = true;
      }
    });
  };

  // Set all the public permissions at once. Pass an array of
  // actions, like this: [ 'edit-attachment' ]
  //
  // View permissions are handled separately.

  self.setPublic = function(permissions) {
    self.publicPermissions = {};
    _.each(permissions, function(permission) {
      self.publicPermissions[permission] = true;
    });
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

  self.permissions = [
    { value: 'guest', label: 'Guest' },
    { value: 'edit', label: 'Editor' },
    { value: 'admin', label: 'Admin: All' }
  ];

  // Register a new permission, so that it can be selected for
  // groups and so on. Call any time before `modulesReady`
  // (it's fine to call in your module's `afterConstruct`).
  //
  // The argument should be an object with `value` and `label` properties.
  // `value` is the permission name, such as `edit-attachment`.
  // `label` is a short label such as `Edit Attachment`.

  self.add = function(permission) {
    self.permissions.push(permission);
  };

  self._options = options;

  self.impliedBy = options.impliedBy || {
    view: [ 'submit', 'edit', 'publish', 'admin' ],
    submit: [ 'edit', 'publish', 'admin' ],
    publish: [ 'edit', 'admin' ],
    edit: [ 'publish', 'admin' ]
  };

  // Permissions that everyone has in the generic case. Typically empty
  // except on sites that allow anonymous uploads, submissions, etc.
  // view is handled as a special case

  self.publicPermissions = {};

  // Currently every type uses the doc strategy, which offers nuanced permissions
  self.types = {};
  self.defaultStrategy = options.defaultStrategy || 'doc';

  self._check = function(req, action, event, _true, _false, object, newObject, then) {
    if (!then) {
      // bc with one less argument
      then = newObject;
      newObject = null;
    }

    var matches = action.match(self.permissionPattern);
    var verb;
    var type;
    if (!matches) {
      // We sometimes check for just "admin" for instance
      verb = action;
      type = 'doc';
    } else {
      verb = matches[1];
      type = matches[2];
    }
    // If a specific object is provided and type is set to the generic 'doc', get
    // the effective type name of the object for permissions purposes. Otherwise,
    // make the same lookup based on the value of `type`.

    if ((type === 'doc') && object) {
      type = self.getEffectiveTypeName(object.type);
    } else {
      type = self.getEffectiveTypeName(type);
    }

    var permissions = {};
    _.extend(permissions, self.publicPermissions);
    _.extend(permissions, (req.user && req.user._permissions) || {});

    if (permissions.admin) {
      // Admins can do anything
      return filter(_true);
    }

    if (permissions['admin-' + type]) {
      // Admins of specific content types can do anything to them
      return filter(_true);
    }

    if (verb === 'edit') {
      if (!(permissions.edit || permissions['edit-' + type])) {
        if ((type === 'doc') && (event === 'criteria')) {
          // This is handled later in the criteria object created
          // by the strategy, because we don't know the true type yet
        } else {
          return filter(_false);
        }
      }
    }

    var strategy = self.strategies[(self.types[type] && self.types[type].strategy) || self.defaultStrategy];
    return filter(then(req, permissions, verb, type, object, newObject, strategy));

    function filter(response) {
      // Post an event allowing an opportunity to change the result by
      // modifying info.response
      var info = {
        response: response,
        object: object,
        newObject: newObject,
        verb: verb,
        type: type,
        _true: _true,
        _false: _false
      };
      self.apos.emit(event, req, action, object, info);
      return info.response;
    }

  };

  // Return the effective type name of a type name for permissions checks.
  // Normally this is the type name itself, however for pages it is
  // the generic `apostrophe-page`, because pages can change type.

  self.getEffectiveTypeName = function(type) {
    var manager = self.apos.docs.getManager(type);
    if (!manager) {
      // There is no rule against implementing permissions for types that
      // aren't doc types, so don't get grumpy, just check it as-is
      return type;
    }
    // TODO memoize this for perf, we need to look at doing that in general
    // but not until afterInit
    if (self.apos.instanceOf(manager, 'apostrophe-custom-pages')) {
      return 'apostrophe-page';
    }
    return type;
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

  // Return an array of permissions, as objects with `value` and `label`
  // properties. Suitable for creating a UI to select permissions for
  // a group, for instance. Do NOT call before `modulesReady` (hint:
  // patch your schema field in `modulesReady`).

  self.getChoices = function() {
    return self.permissions;
  };

};
