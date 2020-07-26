const _ = require('lodash');
// This module manages the permissions of docs in Apostrophe.

let Promise = require('bluebird');

module.exports = {
  options: { alias: 'permission' },
  init(self, options) {
    self.permissionPattern = /^([^-]+)-(.*)$/;
    // This array of permission names and labels is extended via the `add` method.
    // Pieces modules call it automatically.
    self.permissions = [
      {
        value: 'guest',
        label: 'Guest'
      },
      {
        value: 'edit',
        label: 'Editor'
      },
      {
        value: 'admin',
        label: 'Admin: All'
      }
    ];
    // Map of generic permissions implied by other generic permissions.
    self.impliedBy = options.impliedBy || {
      view: [
        'submit',
        'edit',
        'admin'
      ],
      submit: [
        'edit',
        'publish',
        'admin'
      ],
      edit: [
        'publish',
        'admin'
      ]
    };
    // Permissions that everyone has in the generic case. Typically empty
    // except on sites that allow anonymous uploads, submissions, etc.
    // view is handled as a special case
    self.publicPermissions = {};
  },
  handlers(self, options) {
    return {
      'apostrophe:modulesReady': {
        addListTask() {
          return self.addTask('list', 'Usage: node app @apostrophecms/permission:list', function () {
            return Promise.try(function () {
              // eslint-disable-next-line no-console
              console.log(_.map(self.getChoices(), 'value').join('\n'));
            });
          });
        }
      }
    };
  },
  methods(self, options) {
    return {
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
      can(req, action, object) {
        let { verb, type } = self.parse(action);
        const permissions = self.getPermissions(req);
        type = self.getEffectiveType(type, object);
        const generalAnswer = self.checkGeneralCases(type, verb, permissions);
        if (generalAnswer !== undefined) {
          return generalAnswer;
        }
        if (verb === 'edit') {
          if (!(permissions.edit || permissions['edit-' + type])) {
            return false;
          }
        }
        if (!object) {
          return self.generic(req, permissions, verb, type);
        } else {
          return self.specific(req, permissions, verb, type, object);
        }
      },
      criteria(req, action) {
        let { type, verb } = self.parse(action);
        const permissions = self.getPermissions(req);
        type = self.getEffectiveType(type);
        const generalAnswer = self.checkGeneralCases(type, verb, permissions);
        if (generalAnswer !== undefined) {
          if (generalAnswer === true) {
            return {};
          } else {
            return { _id: 'thisIdWillNeverMatch' };
          }
        }
        if (verb === 'edit') {
          if (!(permissions.edit || permissions['edit-' + type])) {
            if (type === 'doc') {
            } else {
              return false;
            }
          }
        }
        const clauses = [];
        // view permissions have some niceties
        if (verb === 'view') {
          // Case #1: it is published and no login is required
          clauses.push({
            published: true,
            // Either does not exist or is the empty string
            loginRequired: {
              $in: [
                null,
                ''
              ]
            }
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
              docPermissions: { $in: self.userPermissionNames(req.user, 'edit') },
              type: { $in: getEditableTypes() }
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
                docPermissions: { $in: self.userPermissionNames(req.user, verb) },
                type: { $in: getEditableTypes() }
              },
              { type: { $in: getAdminTypes() } }
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
          let types = [];
          _.each(self.apos.doc.managers, function (manager, type) {
            if (self.can(req, manager[methodName]())) {
              types.push(type);
            }
          });
          if (!types.length) {
            // $in will crash with an empty list
            types = ['_iNeverMatch'];
          }
          return types;
        }
      },
      parse(action) {
        const dashAt = action.indexOf('-');
        if (dashAt === -1) {
          return {
            verb: action,
            type: 'doc'
          };
        }
        return {
          verb: action.substring(0, dashAt),
          type: action.substring(dashAt + 1)
        };
      },
      // If a specific object is provided and type is set to the generic 'doc',
      // get the effective type name of the object for permissions purposes.
      // Otherwise, make the same lookup based on the value of `type`.
      getEffectiveType(type, object) {
        if (type === 'doc' && object) {
          return self.getEffectiveTypeName(object.type);
        } else {
          return self.getEffectiveTypeName(type);
        }
      },
      getPermissions(req) {
        const permissions = {};
        Object.assign(permissions, self.publicPermissions);
        Object.assign(permissions, req.user && (req.user._permissions || {}));
        return permissions;
      },
      // Check general cases that can be ruled in or out based solely
      // on the user's permissions, the type name, and the verb
      checkGeneralCases(type, verb, permissions) {
        if (permissions.admin) {
          // Sitewide admins can do anything
          return true;
        }
        if (permissions['admin-' + type]) {
          // Admins of specific content types can do anything to them
          return true;
        }
        return undefined;
      },
      // Add a permission everyone gets in the generic case, even if
      // not logged in. It is useful to add edit-attachment, for instance, to
      // allow file uploads by anonymous users for @apostrophecms/moderator.
      //
      // View permissions are handled separately.
      //
      // You may pass multiple arguments, all are added as public permissions. If you
      // pass an array as an argument, all permissions in the array are added.
      addPublic(permission) {
        _.each(arguments, function (permission) {
          if (Array.isArray(permission)) {
            _.each(permission, function (permission) {
              self.publicPermissions[permission] = true;
            });
          } else {
            self.publicPermissions[permission] = true;
          }
        });
      },
      // Set all the public permissions at once. Pass an array of
      // actions, like this: [ 'edit-attachment' ]
      //
      // View permissions are handled separately.
      setPublic(permissions) {
        self.publicPermissions = {};
        _.each(permissions, function (permission) {
          self.publicPermissions[permission] = true;
        });
      },
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
      annotate(req, action, objects) {
        const parsed = self.parse(action);
        const verb = parsed.verb;
        const property = '_' + verb;
        _.each(objects, function (object) {
          if (self.can(req, action, object)) {
            object[property] = true;
          }
        });
      },
      // Returns a user ID which is unique for this logged-in user, or if the user
      // is not logged in, an ID based on their session which will continue to be
      // available for as long as their session lasts
      getEffectiveUserId(req) {
        return req.user && (req.user._id || 'anon-' + req.sessionID);
      },
      // Register a new permission, so that it can be selected for
      // groups and so on. Call any time before `modulesReady`
      // (it's fine to call in your module's `afterConstruct`).
      //
      // The argument should be an object with `value` and `label` properties.
      // `value` is the permission name, such as `edit-attachment`.
      // `label` is a short label such as `Edit Attachment`.
      add(permission) {
        self.permissions.push(permission);
      },
      // Return the effective type name of a type name for permissions checks.
      // Normally this is the type name itself, however for pages it is
      // the generic `@apostrophecms/page`, because pages can change type.
      getEffectiveTypeName(type) {
        const manager = self.apos.doc.getManager(type);
        if (!manager) {
          // There is no rule against implementing permissions for types that
          // aren't doc types, so don't get grumpy, just check it as-is
          return type;
        }
        // TODO memoize this for perf, we need to look at doing that in general
        // but not until afterInit
        if (self.apos.instanceOf(manager, '@apostrophecms/page-type')) {
          return '@apostrophecms/page';
        }
        return type;
      },
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
      // Used internally to implement self.apos.permission.criteria().
      userPermissionNames(user, names) {
        if (!user) {
          return [];
        }
        names = Array.isArray(names) ? names : [names];
        const groupIds = user && user.groupIds ? user.groupIds : [];
        _.each(names, function (name) {
          if (_.has(self.impliedBy, name)) {
            names = _.union(names, self.impliedBy[name]);
          }
        });
        const permissionNames = [];
        _.each(names, function (name) {
          _.each(groupIds, function (groupId) {
            permissionNames.push(name + '-' + groupId);
          });
          permissionNames.push(name + '-' + user._id);
        });
        return permissionNames;
      },
      // Return an array of permissions, as objects with `value` and `label`
      // properties. Suitable for creating a UI to select permissions for
      // a group, for instance. Do NOT call before `modulesReady` (hint:
      // patch your schema field in `modulesReady`).
      getChoices() {
        return self.permissions;
      },
      generic(req, permissions, verb, type) {
        if (verb === 'view') {
          return true;
        }
        if (permissions[verb]) {
          return true;
        }
        if (permissions[verb + '-' + type]) {
          return true;
        }
        if (_.find(self.impliedBy[verb] || [], function (implied) {
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
      specific(req, permissions, verb, type, object) {
        // view permissions have some niceties
        if (verb === 'view') {
          // Case #1: it is published and no login is required
          if (object.published && !object.loginRequired) {
            return true;
          }
          // Case #2: for logged-in users with the guest permission,
          // it's OK to show objects with loginRequired set to `loginRequired` but not `certainUsers`
          // (this is called "Login Required" on the front end)
          if (permissions.guest) {
            if (object.published && object.loginRequired === 'loginRequired') {
              return true;
            }
          }
          // Case #3: object is restricted to certain people
          if (req.user && object.published && object.loginRequired === 'certainUsers' && _.intersection(self.userPermissionNames(req.user, 'view'), object.docPermissions).length) {
            return true;
          }
          // Case #4: you can edit the object
          if (req.user && _.intersection(self.userPermissionNames(req.user, 'edit'), object.docPermissions).length) {
            return true;
          }
        } else {
          // Not view permissions
          // Case #6: we are only interested in people with a
          // specific permission.
          if (req.user && _.intersection(self.userPermissionNames(req.user, verb), object.docPermissions).length) {
            return true;
          }
        }
        return false;
      }
    };
  }
};
