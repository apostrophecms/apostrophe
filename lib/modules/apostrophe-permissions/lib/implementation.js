const _ = require('lodash');

module.exports = function(self, options) {

  self.generic = function(req, permissions, verb, type) {
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
  };

  self.specific = function(req, permissions, verb, type, object) {

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
  };

};
