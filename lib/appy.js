var _ = require('lodash');
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

  // Case insensitive email address match for login and related purposes. You can
  // override this to just return the `email` string as-is if you don't like the case insensitivity
  // or if indexing logins is more important to you (if the latter, you'll need to
  // add that ensureIndex call)

  self.emailMatch = function(email) {
    return new RegExp('^' + RegExp.quote(email) + '$', 'i');
  };

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
    return {
      strategy: 'local',
      options: {
        emailMatch: function(email) {
          // wrap it so it can still be overwritten
          return self.emailMatch(email);
        },
        users: self.authHardcodedUsers(options),
        // A user is just a snippet page with username and password properties.
        // (Yes, the password property is hashed and salted.)
        collection: 'aposPages',
        afterDeserializeUser: self.authAfterUnserialize,
        // Render the login page
        template: options.loginPage,
        // This is a bit of a hack. It's here because apos.partial needs to know
        // of req and res to be able to do i18n magic
        passReq: true,
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
    return async.series({
      // We just "unserialized" the user by loading their object,
      // so we should call the same method that we're using as
      // our deserializer for passport on later accesses
      afterUnserialize: function(callback) {
        return self.authAfterUnserialize(user, callback);
      },
      // A successful login clears any password reset URL, and also any
      // account confirmation URL
      deleteReset: function(callback) {
        if ((!user.resetPassword) && (!user.applyConfirm)) {
          return callback(null);
        }
        return self.pages.update({ _id: user._id }, { $unset: { resetPassword: 1, applyConfirm: 1 } }, callback);
      },
      lastLoginAt: function(callback) {
        return self.pages.update({ _id: user._id }, { $set: { lastLoginAt: new Date() } }, callback);
      },
      joinGroups: function(callback) {
        return self.authAddGroupsAndPermissions(user, callback);
      }
    }, callback);
  };

};
