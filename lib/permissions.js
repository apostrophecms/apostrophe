var _ = require('underscore');

/**
 * permissions
 * @augments Augments the apos object with methods, routes and
 * properties supporting the checking of permissions.
 */

module.exports = function(self) {
  // The apos.permissions method is used for access control. The permissions method invokes
  // its callback with null if the user may carry out the action, otherwise with a permissions
  // error string. Although this method is async permissions decisions should be made quickly.
  //
  // You can specify an alternate method via the `permissions` option, however the standard
  // approach works well for most purposes and the apos object emits a `permissions` event
  // that provides an easier way to extend permissions. The `permissions` event receives
  // the request object, the action, and a `result` object with a `response` property which is what
  // will be passed to the callback if no changes are made. To alter the result, just
  // change `result.response`. (This currently does require that you make a decision immediately,
  // without async.)
  //
  // The following actions exist so far in the core apostrophe and apostrophe-pages modules:
  //
  // `edit-page`, `view-page`, `edit-file`, `delete-file`
  //
  // If there is no third argument, the question is whether this user can *ever*
  // perform the action in question. This is used to decide whether the user sees
  // the pages dropdown menu, has access to the media library, etc.
  //
  // If there is a third argument, this method checks whether the user can
  // carry out the specified action on that particular object.
  //
  // Snippet subclasses add their own permissions:
  //
  // `edit-snippet`, `edit-blog`, `edit-event`, `edit-person`, `edit-group`
  //
  // These do not take a third argument. They are used to determine whether the user
  // should see the relevant dropdown menu at all. Since snippets are just a subclass
  // of pages, the `edit-page` permission is used to determine whether each one is
  // actually editable by this user.
  //
  // If a third argument is present for `edit-file` it will be a file object
  // (see the aposFiles collection), with an `ownerId` property set to the id of
  // req.user at the time the file was last edited.
  //
  // Responses from apos.permissions must match what would result from
  // `self.getPermissionsCriteria` and `self.addPermissionsToPages`. Those methods are
  // used to fetch many pages/snippets in bulk with the correct permissions.

  self.permissions = function(req, action, object, callback) {
    function filter(response) {
      // Post an event allowing an opportunity to change the result
      var result = { response: response };
      self.emit('permissions', req, action, result);
      return callback(result.response);
    }
    var userPermissions = (req.user && req.user.permissions) || {};
    if (userPermissions.admin) {
      // Admins can do anything
      return filter(null);
    } else if (action.match(/^view/)) {
      // We assume everyone can view things in the general case
      return filter(null);
    } else if (action.match(/\-page$/) && object) {
      // Separate method for page permissions on specific pages
      return self.pagePermissions(req, action, object, filter);
    } else if (action.match(/\-file$/) && object) {
      // Separate method for file permissions on specific files
      return self.filePermissions(req, action, object, filter);
    } else if (action.match(/^edit\-/) && (!object)) {
      // If you have the edit permission as a user, you are a potential editor of things and
      // should be permitted to see various dropdown menus. Note that we don't apply this
      // rule if a specific object was passed, in that case an event listener needs to step
      // up and make a more definitive determination
      if (userPermissions.edit) {
        return filter(null);
      }
      // Guests may edit files (that is, they may upload files, and edit their own
      // uploads). This allows them to edit their profile, contribute content for
      // moderation, etc.
      if (action === 'edit-file') {
        if (userPermissions.guest) {
          return filter(null);
        }
      }
    }
    return filter('Forbidden');
  };

  // Returns a MongoDB query object that will match pages the
  // user is permitted to view, based on their identity and the
  // permissions listed in the page. This object can be combined
  // with other criteria using $and. See also `self.pagePermissions` below
  // which must be compatible.

  self.getPermissionsCriteria = function(req, options) {
    if (!options) {
      options = {};
    }
    var editable = options.editable;
    // If they have the admin permission we're done
    if (req.user && req.user.permissions.admin) {
      return { };
    }

    var userPermissions = (req.user && req.user.permissions) || {};

    var clauses = [];

    var groupIds = (req.user && req.user.groupIds) ? req.user.groupIds : [];

    // If we are not specifically searching for pages we can edit,
    // allow for the various ways we can be allowed to view a page

    if (!editable) {
      // Case #1: it is published and no login is required
      clauses.push({
        published: true,
        loginRequired: { $exists: false }
      });

      if (req.user) {
        // Case #2: for logged-in users with the guest permission,
        // it's OK to show pages with loginRequired set to `loginRequired` but not `certainPeople`
        // (this is called "Login Required" on the front end)
        if (userPermissions.guest) {
          clauses.push({
            published: true,
            loginRequired: 'loginRequired'
          });
        }

        // Case #3: page is restricted to certain people, see if
        // we are on the list of people or the list of groups

        clauses.push({
          published: true,
          loginRequired: 'certainPeople',
          $or: [
            { viewGroupIds: { $in: groupIds } },
            { viewPersonIds: { $in: [ req.user._id ] } }
          ]
        });
      }
    }

    if (req.user) {
      // Case #4: we have edit privileges on the page. Note that
      // it need not be published
      clauses.push({
        $or: [
          { editGroupIds: { $in: groupIds } },
          { editPersonIds: { $in: [ req.user._id ] } }
        ]
      });
    }
    return { $or: clauses };
  };

  // This method determines whether we can carry out an action on a
  // particular page. It must be in sync with what `self.getPermissionsCriteria`
  // would return. This method should invoke its callback with null if the user may
  // carry out the action or with an error string if they may not. This method
  // is invoked by `apos.permissions` for actions that concern pages. It is
  // assumed that admins have already been given blanket permission before
  // it becomes necessary to call this method.

  self.pagePermissions = function(req, action, page, callback) {
    // In practice we only check two levels of permissions on pages right now:
    // permission to view and permission to edit. Reduce the requested action
    // to one of those

    var editable;
    if (action === 'view-page') {
      editable = false;
    } else {
      // Currently everything except viewing requires the edit permission
      editable = true;
    }

    var userPermissions = (req.user && req.user.permissions) || {};

    // If we are not specifically searching for pages we can edit,
    // allow for the various ways we can be allowed to view a page

    if (!editable) {
      // Case #1: it is published and no login is required

      if (page.published && (page.loginRequired === undefined)) {
        return callback(null);
      }

      if (req.user) {

        // Case #2: for users who have the viewLoginRequired permission,
        // it's OK to show pages with loginRequired set but not certainPeople
        // (this is called "loginRequired" on the front end)

        if (page.published && (page.loginRequired === 'loginRequired') && userPermissions.guest) {
          return callback(null);
        }

        // Case #3: page is restricted to certain people, see if
        // we are on the list of people or the list of groups

        if (page.published && (page.loginRequired === 'certainPeople')) {
          if (page.viewGroupIds && _.intersection(req.user.groupIds || [], page.viewGroupIds).length) {
            return callback(null);
          }
          if (page.viewPersonIds && _.contains(page.viewPersonIds, req.user._id)) {
            return callback(null);
          }
        }
      }
    }

    // Can we edit the page? (That's also good enough to view it.)

    if (req.user) {
      // Case #4: we have edit privileges on the page. Note that
      // it need not be published
      if (page.editGroupIds && _.intersection(req.user.groupIds || [], page.editGroupIds).length) {
        return callback(null);
      }
      if (page.editPersonIds && _.contains(page.editPersonIds, req.user._id)) {
        return callback(null);
      }
    }

    // No love
    return callback('Forbidden');
  };

  // Add a `._edit` property set to `true` to each page in the `pages` array that is editable by the
  // current user. Compatible with the way `apos.getPermissionsCriteria`
  // determines permissions.

  self.addPermissionsToPages = function(req, pages) {
    if (!req.user) {
      return;
    }
    _.each(pages, function(page) {
      if (req.user.permissions.admin) {
        page._edit = true;
      } else {
        if (page.editGroupIds && _.intersection(req.user.groupIds || [], page.editGroupIds).length) {
          page._edit = true;
        }
        if (page.editPersonIds && _.contains(page.editPersonIds, req.user._id)) {
          page._edit = true;
        }
      }
    });
  };
};
