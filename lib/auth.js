var _ = require('lodash');
var async = require('async');

/**
 * areas
 * @augments Augments the apos object with methods which provide
 * authentication-related services. See also apostrophe-site/index.js,
 * lib/appy.js, and appy itself. The methods here are being gradually
 * factored out of those places to facilitate reuse in non-appy-based
 * authentication modules like apostrophe-cas.
 * @see pages
 */

module.exports = function(self) {

  // Invokes finalCallback with the best URL to redirect
  // the user to. First respects the secondChanceLogin option, which
  // if true indicates that the user should be redirected to the page
  // they were trying to reach when they logged in, and then
  // the redirectAfterLogin option, a function which is
  // invoked with the request object and a callback and
  // must invoke its callback with the desired URL. If neither
  // is available, the callback is invoked with '/' to take the
  // user to the homepage.

  self.authRedirectAfterLogin = function(req, finalCallback) {
    var options = self.options;
    return async.series({
      secondChanceLogin: function(callback) {
        if (!options.secondChanceLogin) {
          return callback(null);
        }
        if (!req.cookies['aposAfterLogin']) {
          return callback(null);
        }
        var url = req.cookies['aposAfterLogin'];
        req.res.clearCookie('aposAfterLogin');
        return self.getPage(req, url.replace(/\?.*$/, ''), function(err, page, bestPage, remainder) {
          if (page || bestPage) {
            return finalCallback(url);
          }
          return callback(null);
        });
      },
      redirectAfterLogin: function(callback) {
        if (!options.redirectAfterLogin) {
          return callback(null);
        }
        if (options.redirectAfterLogin.length < 2) {
          return finalCallback(options.redirectAfterLogin(req.user));
        }
        return options.redirectAfterLogin(req, finalCallback);
      }
    }, function(err) {
      return finalCallback('/');
    });
  };

  // Return an object containing hardcoded user accounts,
  // based on options specified in app.js (i.e. adminPassword).

  self.authHardcodedUsers = function(options) {
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
    return users;
  };

  // Should be called on every access to join the user with
  // their groups and set up the permissions property of the
  // user object.
  //
  // If user is a string, it is considered to be the username of a user
  // object, which is fetched for you. If it is not a string, it
  // is assumed to be a user object that you have already loaded.
  //
  // If the user no longer exists or no longer has login
  // privileges, an error is reported to the callback.

  self.authAfterUnserialize = function(user, callback) {
    if (user.type !== 'person') {
      // No sneaky logging in as some other kind of document
      return new Error('invalid');
    }
    if ((!user.login) || (user.trash)) {
      return callback(new Error('Person has lost login privileges on this site'));
    } else {
      // Don't let this leak out even in hashed form
      delete user.password;
      return self.authAddGroupsAndPermissions(user, callback);
    }
  };

  // Add the user's groups and permissions, without the expense
  // of a full Apostrophe join. This needs to be very fast because
  // it happens on every access by a logged-in user.
  self.authAddGroupsAndPermissions = function(user, callback) {
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
