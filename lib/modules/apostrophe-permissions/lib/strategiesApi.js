var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  self.strategies = {

    // Currently used for everything

    doc: {

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

      specific: function(req, permissions, verb, type, object, newObject) {

        // view permissions have some niceties
        if (verb === 'view') {
          // Case #1: it is published and no login is required
          if (object.published && (!object.loginRequired)) {
            return true;
          }

          // Case #2: for logged-in users with the guest permission,
          // it's OK to show objects with loginRequired set to `loginRequired` but not `certainUsers`
          // (this is called "Login Required" on the front end)
          if (permissions.guest) {
            if (object.published && (object.loginRequired === 'loginRequired')) {
              return true;
            }
          }

          // Case #3: object is restricted to certain people
          if (req.user && object.published && (object.loginRequired === 'certainUsers') && _.intersection(self.userPermissionNames(req.user, 'view'), object.docPermissions).length) {
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
      },

      criteria: function(req, permissions, verb) {

        var clauses = [];

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
              $or: [
                {
                  docPermissions: {
                    $in: self.userPermissionNames(req.user, 'edit')
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
          var types = [];
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

      }
    }
  };

  // A simpler strategy, not currently used due to the decision to
  // create apostrophe-files and apostrophe-images as subclasses of pieces in 2.0

  _.extend(self.strategies, {
    owner: {
      generic: self.strategies.doc.generic,
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
};
