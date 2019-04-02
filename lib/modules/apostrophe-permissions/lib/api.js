const _ = require('lodash');

module.exports = function(self, options) {

  self.permissionPattern = /^([^-]+)-(.*)$/;

  // Determines whether the active user can carry out the
  // action specified by "action". Returns true if the action
  // is permitted, false if not permitted. See also `criteria`
  // which is called instead when what we want is a MongoDB
  // criteria object that returns only documents on which we
  // can carry out `action`.

  // Actions begin with a verb, followed by a hyphen and a
  // doc type name or other identifier.
  //
  // If there is no third argument, the question is whether this user can
  // perform the action in question to create a new object.
  //
  // If there is a third argument, this method checks whether the user can
  // carry out the specified action on that particular object.
  //
  // The third object may be an object that has not yet been inserted
  // into the database.

  self.can = function(req, _action, object) {
    let { type, action } = self.parse(_action);
    const permissions = self.getPermissions(req);
    type = self.getEffectiveType(type, object);  
    const generalAnswer = self.checkGeneralCases(type, verb, permissions);
    if (generalAnswer !== undefined) {
      return generalAnswer;
    }
    if (!object) {
      return self.generic(req, permissions, verb, type);
    } else {
      return self.specific(req, permissions, verb, type, object);
    }
  };

  self.criteria = function(req, action) {

    let { type, action } = self.parse(action);
    const permissions = self.getPermissions(req);
    type = self.getEffectiveType(type, object);  
    const generalAnswer = self.checkGeneralCases(type, verb, permissions);

    if (generalAnswer !== undefined) {
      if (generalAnswer === true) {
        return {};
      } else {
        return { _id: 'thisIdWillNeverMatch' };
      }
    }

    const clauses = [];

    // view permissions have some niceties
    if (verb === 'view') {
      // Case #1: it is published and no login is required
      clauses.push({
        published: true,
        // Either does not exist or is the empty string
        loginRequired: { $in: [ null, '' ] }
      });

      if (req.user) {
        // Case #2: for logged-in users with the guest permission,
        // it's OK to show docs with loginRequired set to `loginRequired` but not `certainUsers`
        // (this is called "Login Required" on the front end)
        if (permissions.guest) {
          clauses.push({
            published: true,
            loginRequired: 'loginRequired'
          });
        }

        // Case #3: doc is restricted to certain people

        clauses.push({
          published: true,
          loginRequired: 'certainUsers',
          docPermissions: { $in: self.userPermissionNames(req.user, 'view') }
        });

        // Case #4: can edit the doc and is of a type we
        // still have edit privileges for
        clauses.push({
          docPermissions: {
            $in: self.userPermissionNames(req.user, 'edit')
          },
          type: {
            $in: getEditableTypes()
          }
        });
      }
    } else {
      // Not view permissions

      if (!req.user) {
        // We want to never match
        return { _id: '__iNeverMatch' };
      }
      // Case #4: we are only interested in people with a
      // specific permission.
      clauses.push({
        $or: [
          {
            docPermissions: {
              $in: self.userPermissionNames(req.user, verb)
            },
            type: {
              $in: getEditableTypes()
            }
          },
          {
            type: {
              $in: getAdminTypes()
            }
          }
        ]
      });
    }
    if (!clauses.length) {
      // Empty $or is an error in MongoDB 2.6
      return {};
    }
    return { $or: clauses };

    function getEditableTypes() {
      return getActionableTypes('getEditPermissionName');
    }

    function getAdminTypes() {
      return getActionableTypes('getAdminPermissionName');
    }

    function getActionableTypes(methodName) {
      // TODO we should cache this for the
      // lifetime of the req
      const types = [];
      _.each(self.apos.docs.managers, function(manager, type) {
        if (self.can(req, manager[methodName]())) {
          types.push(type);
        }
      });
      if (!types.length) {
        // $in will crash with an empty list
        types = [ '_iNeverMatch' ];
      }
      return types;
    }

  };

  self.parse = function(action) {
    const colonAt = action.indexOf(':');
    if (colonAt === -1) {
      return {
        action,
        type: 'doc'
      };
    }
    return {
      action: action.substr(0, colonAt - 1),
      type: action.substr(colonAt + 1)
    };
  };

  // If a specific object is provided and type is set to the generic 'doc',
  // get the effective type name of the object for permissions purposes.
  // Otherwise, make the same lookup based on the value of `type`.
  self.getEffectiveType = function(type, object) {
    if ((type === 'doc') && object) {
      return self.getEffectiveTypeName(object.type);
    } else {
      return self.getEffectiveTypeName(type);
    }
  };

  self.getPermissions = function(req) {
    const permissions = {};
    Object.assign(permissions, self.publicPermissions);
    Object.assign(permissions, (req.user && req.user._permissions) || {});
    return permissions;
  };

  // Check general cases that can be ruled in or out based solely
  // on the user's permissions, the type name, and the verb
  self.checkGeneralCases = function(type, verb, permissions) {
    if (permissions.admin) {
      // Sitewide admins can do anything
      return true;
    }
    if (permissions['admin-' + type]) {
      // Admins of specific content types can do anything to them
      return true;
    }
    if (verb === 'edit') {
      if (!(permissions.edit || permissions['edit-' + type])) {
        if ((type === 'doc') && (event === 'criteria')) {
          // This is handled later in the criteria object created
          // by the strategy, because we don't know the true type yet
        } else {
          return false;
        }
      }
    }    
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
    let { type, verb } = self.parse(action);
    const property = '_' + verb;
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

  // This array of permission names and labels is extended via the `add` method.
  // Pieces modules call it automatically.

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

  // Map of generic permissions implied by other generic permissions.

  self.impliedBy = options.impliedBy || {
    view: [ 'submit', 'edit', 'admin' ],
    submit: [ 'edit', 'publish', 'admin' ],
    edit: [ 'publish', 'admin' ]
  };

  // Permissions that everyone has in the generic case. Typically empty
  // except on sites that allow anonymous uploads, submissions, etc.
  // view is handled as a special case

  self.publicPermissions = {};

  // Return the effective type name of a type name for permissions checks.
  // Normally this is the type name itself, however for pages it is
  // the generic `apostrophe-page`, because pages can change type.

  self.getEffectiveTypeName = function(type) {
    const manager = self.apos.docs.getManager(type);
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
  // Permission names that imply "edit" are also included.
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
