var _ = require('underscore');
var qs = require('qs');
// Needed for A1.5 bc implementation of authentication, normally
// we go through appy's passwordHash wrapper
var crypto = require('crypto');
var passwordHash = require('password-hash');
var async = require('async');

 /**
 * appy
 * @augments Augments the apos object with methods supporting the use of appy
 * to implement logins and permissions. THIS IS NOT APPY ITSELF, see the
 * appy module for that.
 */

module.exports = function(self) {
  // This method integrates Apostrophe user authentication with the appy module, which
  // provides a quick start for node apps.
  //
  // Pass the result of a call to this method as the `auth` option of appy to appy to allow people
  // (as managed via the "people" module) to log in as long as they have the "login" box checked.
  //
  // You must pass your instance of the `pages` module as the `pages` option so that the login
  // dialog can be presented.
  //
  // If the `adminPassword` option is set then an admin user is automatically provided
  // regardless of what is in the database, with the password set as specified.
  //
  // This is normally set up for you by the `apostrophe-site` module.

  self.appyAuth = function(options, user) {
    var users = {};
    if (options.adminPassword) {
      users.admin = {
        type: 'person',
        username: 'admin',
        password: options.adminPassword,
        firstName: 'Ad',
        lastName: 'Min',
        title: 'Admin',
        _id: 'admin',
        // Without this login is forbidden
        login: true,
        permissions: { admin: true }
      };
    }
    return {
      strategy: 'local',
      options: {
        users: users,
        // A user is just a snippet page with username and password properties.
        // (Yes, the password property is hashed and salted.)
        collection: 'aposPages',
        afterDeserializeUser: self.appyAfterDeserializeUser,
        // Render the login page
        template: options.loginPage,
        // Set the redirect for after login passing req.user from Appy l.~208
        redirect: function(req, callback) {
          if (options.redirect) {
            if (options.redirect.length === 1) {
              // bc
              return callback(options.redirect(req.user));
            }
            return options.redirect(req, callback);
          } else {
            // This feels like overkill, because we're checking in Appy as well.
            return callback('/');
          }
        },
        extraLoginCriteria: {
          // Must be an apostrophe-people person; this allows
          // other types of objects to have the same email property without
          // blocking logins via email
          type: 'person',
          login: true,
          trash: { $ne: true }
        },
        verify: function(password, hash) {
          if (typeof(hash) !== 'string') {
            // No hash exists yet for this user, so definitely don't
            // let them log in; don't crash trying to regexp match on
            // the hash if it is undefined
            return false;
          }
          if (hash.match(/^a15/)) {
            // bc with Apostrophe 1.5 hashed passwords. The salt is
            // implemented differently, it's just prepended to the
            // password before hashing. Whatever createHmac is doing
            // in the password-hash module, it's not that. Fortunately
            // it isn't hard to do directly
            var components = hash.split(/\$/);
            if (components.length !== 3) {
              return false;
            }
            // Allow for a variety of algorithms coming over from A1.5
            var hashType = components[0].substr(3);
            var salt = components[1];
            var hashed = components[2];
            try {
              var shasum = crypto.createHash(hashType);
              shasum.update(salt + password);
              var digest = shasum.digest('hex');
              return (digest === hashed);
            } catch (e) {
              console.log(e);
              return false;
            }
          } else {
            return passwordHash.verify(password, hash);
          }
        }
      }
    };
  };

  // Pass this function to appy as the `beforeSignin` option to check for login privileges,
  // then apply the user's permissions obtained via group membership before
  // completing the login process. Normally apostrophe-site does this for you.

  // TODO: migrate this code into the people module where it belongs for the most part

  self.appyBeforeSignin = function(user, callback) {
    if (user.type !== 'person') {
      // Whaaat the dickens this object is not even a person
      return callback('error');
    }
    if (!user.login) {
      return callback({ message: 'user does not have login privileges' });
    } else {
      return async.series({
        // A successful login clears any password reset URL, and also any
        // account confirmation URL
        deleteReset: function(callback) {
          if ((!user.resetPassword) && (!user.applyConfirm)) {
            return callback(null);
          }
          return self.pages.update({ _id: user._id }, { $unset: { resetPassword: 1, applyConfirm: 1 } }, callback);
        },
        joinGroups: function(callback) {
          return self._groupsAndPermissions(user, callback);
        }
      }, callback);
    }
  };

  self.appyAfterDeserializeUser = function(user, callback) {
    if ((!user.login) || (user.trash)) {
      return callback({ message: 'user has lost login privileges' });
    } else {
      return async.series({
        joinGroups: function(callback) {
          return self._groupsAndPermissions(user, callback);
        }
      }, callback);
    }
  };

  self._groupsAndPermissions = function(user, callback) {
    user.permissions = user.permissions || {};
    return self.pages.find({ type: 'group', _id: { $in: user.groupIds || [] } }).toArray(function(err, groups) {
      if (err) {
        console.log(err);
        return callback(err);
      }
      user._groups = groups;
      _.each(groups, function(group) {
        _.each(group.permissions || [], function(permission) {
          if (!_.contains(user.permissions, permission)) {
            user.permissions[permission] = true;
          }
        });
      });
      // The standard permissions are progressive
      if (user.permissions.admin) {
        user.permissions.edit = true;
      }
      if (user.permissions.edit) {
        user.permissions.guest = true;
      }
      // If you are admin- for any type of content, you need to be
      // at least guest to effectively attach media to your content,
      // and the edit permission also makes sense because it does not
      // immediately let you do anything, just makes it easier to see
      // you are a candidate to do things like edit pages if given
      // specific rights to them. Also simplifies outerLayout's logic
      if (_.some(user.permissions, function(val, key) {
        return key.match(/^admin\-/);
      })) {
        user.permissions.guest = true;
        user.permissions.edit = true;
      }
      return callback(null);
    });
  };
};
