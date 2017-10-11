// Enable users to log in via a login form on the site at `/login`.
//
// ## Options
//
// `localLogin`
//
// If explicitly set to `false`, the `/login` route does not exist,
// and it is not possible to log in via your username and password.
// This usually makes sense only in the presence of an alternative such as
// the `apostrophe-passport` module, which adds support for login via
// Google, Twitter, gitlab, etc.
//
// ## Notable properties of apos.modules['apostrophe-login']
//
// `passport`
//
// Apostrophe's instance of the [passport](https://npmjs.org/package/passport) npm module.
// You may access this object if you need to implement additional passport "strategies."
//
// ## Global method: loginAfterLogin
//
// The method `loginAfterLogin` is invoked on **all modules that have one**. This method
// is a good place to set `req.redirect` to the URL of your choice. If no module sets
// `req.redirect`, the newly logged-in user is redirected to the home page. `loginAfterLogin`
// is invoked with `req` and may also optionally take a callback.

var Passport = require('passport').Passport;
var LocalStrategy = require('passport-local');
var _ = require('lodash');


module.exports = {

  alias: 'login',

  afterConstruct: function(self) {
    self.enableSerializeUsers();
    self.enableDeserializeUsers();
    if (self.options.localLogin !== false) {
      self.enableLocalStrategy();
    }
    self.enableMiddleware();
    self.addRoutes();
    self.pushAssets();
    self.addAdminBarItems();
  },

  construct: function(self, options){

    self.passport = new Passport();

    // Set the `serializeUser` method of `passport` to serialize the
    // user by storing their user ID in the session.

    self.enableSerializeUsers = function() {
      self.passport.serializeUser(function(user, done) {
        done(null, user._id);
      });
    };

    // Set the `deserializeUser` method of `passport` to
    // deserialize the user by locating the appropriate
    // user via the [apostrophe-users](../apostrophe-users/index.html)
    // module. Then invokes the `loginDeserialize` method of
    // every module that has one, passing the `user` object. These
    // methods may optionally take a callback.

    self.enableDeserializeUsers = function() {
      self.passport.deserializeUser(self.deserializeUser);
    };
    
    // Given a user's `_id`, fetches that user via the login module
    // and, if the user is found, invokes the `loginDeserialize`
    // method of all modules that have one via `callAll`. 
    // Then invokes the callback with `(null, user)`.
    //
    // If the user is not found, invokes the callback with
    // `(null, null)` (NOTE: no error in the first argument).
    //
    // If another error occurs, it is passed as the first argument.
    //
    // This method is passed to `passport.deserializeUser`.
    // It is also useful when you wish to load a user exactly
    // as Passport would.
    
    self.deserializeUser = function(id, callback) {
      var req = self.apos.tasks.getReq();
      return self.apos.users.find(req, { _id: id }).toObject(function(err, user) {
        if (err) {
          return callback(err);
        }
        if (!user) {
          return callback(null, null);
        }
        return self.apos.callAll('loginDeserialize', user, function(err) {
          return callback(err, err ? null : user);
        });
      });
    };

    // On every request, immediately after the user has been fetched,
    // build the `user._permissions` object which has a simple
    // boolean property for each permission the user possesses.
    //
    // Permissions can be obtained either via the group or via the
    // user object itself, although there is currently no interface for
    // adding permissions directly to a user.
    //
    // `admin` implies `edit`, and `edit` implies `guest`. These
    // are populated accordingly.
    //
    // If you have `admin-` rights for any specific content types,
    // you are also granted `guest` and `edit` (create) permissions for other
    // types that are not restricted to admins only.

    self.loginDeserialize = function(user) {
      user._permissions = {};
      _.each(user._groups, function(group) {
        _.each(group.permissions || [], function(permission) {
          user._permissions[permission] = true;
        });
      });
      _.each(user.permissions || [], function(permission) {
        user._permissions[permission] = true;
      });
      // The standard permissions are progressive
      if (user._permissions.admin) {
        user._permissions.edit = true;
      }
      if (user._permissions.edit) { 
        user._permissions.guest = true;
      }
      
      // TODO: make this a deprecated default behavior (sigh)
      
      // If you are admin- for any type of content, you need to be
      // at least guest to effectively attach media to your content,
      // and the edit permission also makes sense because it does not
      // immediately let you do anything, just makes it easier to see
      // you are a candidate to do things like edit pages if given
      // specific rights to them. Also simplifies outerLayout's logic
      if (_.some(user._permissions, function(val, key) {
        return key.match(/^admin\-/);
      })) {
        user._permissions.guest = true;
        user._permissions.edit = true;
      }      
    };

    // Adds the "local strategy" (username/email and password login)
    // to Passport. Users are found via the `find` method of the
    // [apostrophe-users](../apostrophe-users/index.html) module.
    // Users with the `disabled` property set to true may not log in.
    // Passwords are verified via the `verifyPassword` method of
    // [apostrophe-users](../apostrophe-users/index.html), which is
    // powered by the [credential](https://npmjs.org/package/credential) module.

    self.enableLocalStrategy = function() {
      self.passport.use(new LocalStrategy(self.verifyLogin));
    };

    // Verify a login attempt. `username` can be either
    // the username or the email address (both are unique).
    //
    // If a system-level failure occurs, such that we don't
    // know if the user's login should have succeeded,
    // then the first argument to the callback is an error.
    //
    // If the user's login FAILS, the first argument is
    // is `null`, and the second argument is `false` (no user).
    //
    // If the user's login SUCCEEDS, the first argument
    // is `null` and the second argument is the user object.
    //
    // PLEASE NOTE THAT A USER FAILING TO LOG IN
    // **DOES NOT** REPORT AN ERROR as the first callback
    // argument. You MUST check the second argument.
    //
    // The convention is set this way for compatibility
    // with `passport`.    
     
    self.verifyLogin = function(username, password, callback) {
      var req = self.apos.tasks.getReq();
      return self.apos.users.find(req, {
        $or: [
          { username: username },
          { email: username }
        ],
        disabled: { $ne: true }
      }).toObject(function(err, user) {
        if (err) {
          return done(err);
        }
        if (!user) {
          return done(null, false);
        }
        return self.apos.users.verifyPassword(user, password, function(err) {
          if (err) {
            return callback(null, false);
          }
          return callback(err, user);
        });
      });
    };

    // Add Passport's initialize and session middleware.
    // Also add middleware to add the `req.data.user` property.
    // Now works via the expressMiddleware property, allowing
    // control of timing relative to other modules.
    
    self.enableMiddleware = function() {
      self.expressMiddleware = [
        self.passport.initialize(),
        self.passport.session(),
        self.addUserToData
      ];
    };

    // Add the `/login` route, both GET (show the form) and POST (submit the form).
    // Also add the `/logout` route.

    self.addRoutes = function() {
      if (self.options.localLogin !== false) {
        self.apos.app.get('/login', function(req, res) {
          if (req.user) {
            // User is already logged in, redirect to home page
            return res.redirect('/')
          }
          req.scene = 'user';
          // Gets i18n'd in the template, also bc with what templates that tried to work
          // before certain fixes would expect (this is why we still pass a string and not
          // a flag, and why we call it `message`)
          return self.sendPage(req, 'login', { message: req.query.error ? 'Your username or password was incorrect' : undefined });
        });
        self.apos.app.post('/login',
          self.passport.authenticate('local', {
            // failureFlash does not appear to work properly, let's just
            // use a query parameter
            failureRedirect: '/login?error=1'
          }),
          self.afterLogin
        );
      }
      self.apos.app.get('/logout', function(req, res) {
        // Completely destroy the session. req.logout only breaks
        // the association with the user. Our end users expect
        // a more secure logout that leaves no trace.
        return req.session.destroy(function(err) {
          if (err) {
            // Not much more we can do, but it will be apparent to the user
            // that they are still logged in
            console.error(err);
          }
          res.redirect('/');
        });
      });
    };

    // Add the `user` property to `req.data` when a user is logged in.

    self.addUserToData = function(req, res, next) {
      if (req.user) {
        req.data.user = req.user;
        return next();
      } else {
        return next();
      }
    };

    // Push the login stylesheet.

    self.pushAssets = function() {
      self.pushAsset('stylesheet', 'always', { when: 'always' });
    };

    // Add the logout admin bar item.

    self.addAdminBarItems = function() {
      self.apos.adminBar.add(self.__meta.name + '-logout', 'Log Out', null, { last: true, href: '/logout' });
    };
    
    // Invoked by passport after an authentication strategy succeeds
    // and the user has been logged in. Invokes `loginAfterLogin` on
    // any modules that have one and redirects to `req.redirect` or,
    // if it is not set, to `/`.

    self.afterLogin = function(req, res) {
      return self.apos.callAll('loginAfterLogin', req, function(err) {
        req.redirect = req.redirect || '/';
        return res.redirect(req.redirect);
      });
    };

  }
}
