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
// `passwordReset`
//
// If set to `true`, the user is given the option to reset their password,
// provided they can receive a confirmation email. Not available if `localLogin` is `false`.
//
// `passwordResetHours`
//
// When `passwordReset` is `true`, this option controls how many hours
// a password reset request remains valid. If the confirmation email is not
// acted upon in time, the user must request a password reset again.
// The default is `48`.
//
// ## Notable properties of apos.modules['apostrophe-login']
//
// `passport`
//
// Apostrophe's instance of the [passport](https://npmjs.org/package/passport) npm module.
// You may access this object if you need to implement additional passport "strategies."
//
// ## callAll method: loginAfterLogin
//
// The method `loginAfterLogin` is invoked on **all modules that have one**. This method
// is a good place to set `req.redirect` to the URL of your choice. If no module sets
// `req.redirect`, the newly logged-in user is redirected to the home page. `loginAfterLogin`
// is invoked with `req` and may be an async function.

const Passport = require('passport').Passport;
const LocalStrategy = require('passport-local');
const _ = require('lodash');
const qs = require('qs');
const Promise = require('bluebird');

module.exports = {

  alias: 'login',

  afterConstruct: function(self, options) {
    self.enableSerializeUsers();
    self.enableDeserializeUsers();
    if (self.options.localLogin !== false) {
      self.enableLocalStrategy();
    }
    self.enableMiddleware();
    self.addRoutes();
    self.addAdminBarItems();
  },

  construct: function(self, options) {

    self.passport = new Passport();

    // Set the `serializeUser` method of `passport` to serialize the
    // user by storing their user ID in the session.

    self.enableSerializeUsers = function() {
      self.passport.serializeUser(function(user, done) {
        done(null, user._id);
      });
    };

    // Set the `deserializeUser` method of `passport`,
    // wrapping the `deserializeUser` method of this
    // module for use with passport's API.
    // See `deserializeUser`.

    self.enableDeserializeUsers = function() {
      self.passport.deserializeUser(function(id, cb) {
        self.deserializeUser(id).then(function(user) {
          return cb(null, user);
        }).catch(cb);
      });
    };

    // Given a user's `_id`, fetches that user via the login module
    // and, if the user is found, emits the `deserialize` event.
    // If no user is found, `null` is returned, otherwise the
    // user is returned.
    //
    // This method is passed to `passport.deserializeUser`,
    // wrapped to support its async implementation.
    // It is also useful when you wish to load a user exactly
    // as Passport would.

    self.deserializeUser = async function(id) {
      const req = self.apos.tasks.getReq();
      const user = await self.apos.users.find(req, { _id: id }).toObject();
      if (!user) {
        return null;
      }
      await self.emit('deserialize', user);
      return user;
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
    // However `admin-foo` for the specific type `foo` does NOT imply
    // any extra permissions beyond that in 3.x. If you want
    // `edit-attachments`, make sure you grant it to the
    // relevant group.

    self.on('deserialize', 'deserializePermissions', function(user) {
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
    });

    // Adds the "local strategy" (username/email and password login)
    // to Passport. Users are found via the `find` method of the
    // [apostrophe-users](../apostrophe-users/index.html) module.
    // Users with the `disabled` property set to true may not log in.
    // Passwords are verified via the `verifyPassword` method of
    // [apostrophe-users](../apostrophe-users/index.html), which is
    // powered by the [credential](https://npmjs.org/package/credential) module.

    self.enableLocalStrategy = function() {
      self.passport.use(new LocalStrategy(self.localStrategy));
    };

    // Local Strategy wrapper for self.verifyLogin to work nicely with
    // passport.
    self.localStrategy = async function(username, password, done) {
      try {
        const user = await self.verifyLogin(username, password);

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    };

    // Verify a login attempt. `username` can be either
    // the username or the email address (both are unique).
    //
    // If the user's login FAILS, the string
    // `'invalid'` is thrown as an exception
    // after a 1000ms delay to discourage abuse.
    //
    // If the user's login SUCCEEDS, the return value is
    // the `user` object.

    self.verifyLogin = async function(username, password) {
      const req = self.apos.tasks.getReq();
      const user = await self.apos.users.find(req, {
        $or: [
          { username: username },
          { email: username }
        ],
        disabled: { $ne: true }
      }).toObject();

      if (!user) {
        await Promise.delay(1000);
        return false;
      }
      try {
        await self.apos.users.verifyPassword(user, password);
        return user;
      } catch (err) {
        await Promise.delay(1000);
        throw 'invalid';
      }
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
            return res.redirect('/');
          }
          // Gets i18n'd in the template, also bc with what templates that tried to work
          // before certain fixes would expect (this is why we still pass a string and not
          // a flag, and why we call it `message`)
          return self.sendPage(req, 'login', {
            passwordReset: self.options.passwordReset,
            message: req.query.message ||
              (req.query.error &&
                req.__('your username or password was incorrect')) });
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

      if ((self.options.localLogin !== false) && self.options.passwordReset) {

        self.apos.app.get('/password-reset-request', function(req, res) {
          if (req.user) {
            // User is already logged in, redirect to home page
            return res.redirect('/');
          }
          req.scene = 'user';
          // Gets i18n'd in the template, also bc with what templates that tried to work
          // before certain fixes would expect (this is why we still pass a string and not
          // a flag, and why we call it `message`)
          return self.sendPage(req, 'passwordResetRequest', { message: req.query.error ? 'That is not a valid email address or username, or the user has no email address on record.' : undefined });
        });

        self.apos.app.post('/password-reset-request', async function(req, res) {
          let site = (req.headers['host'] || '').replace(/:\d+$/, '');
          let url;
          let username = self.apos.launder.string(req.body.username);
          let reset;
          if (!username.length) {
            return res.redirect('/password-reset-request?error=missing');
          }
          let clauses = [];
          clauses.push({ username: username });
          clauses.push({ email: username });
          let user;
          try {
            user = await self.apos.users.find(req, {
              $or: clauses
            }).permission(false).toObject();
            if (!user) {
              throw 'notfound';
            }
            if (!user.email) {
              throw 'noemail';
            }
            const reset = self.apos.utils.generateId();
            user.passwordReset = reset;
            user.passwordResetAt = new Date();
            await self.apos.users.update(req, user, { permissions: false });
          } catch (err) {
            self.apos.utils.error(err);
            return res.redirect('/password-reset-request?error=error');
          }
          let parsed = require('url').parse(req.absoluteUrl);
          parsed.pathname = '/password-reset';
          parsed.query = { reset: reset, email: user.email };
          delete parsed.search;
          url = require('url').format(parsed);
          try {
            await self.email(req, 'passwordResetEmail', { user: user, url: url, site: site }, {
              to: user.email,
              subject: res.__('Your request to reset your password on ' + site)
            });
          } catch (err) {
            self.apos.utils.error('password reset email not accepted for delivery: ' + user.email);
          }
          return res.redirect('/login?' + qs.stringify({ message: 'An email message has been sent to you with instructions to reset your password. Be sure to check your spam folder if you do not see it in the next few minutes.' }));
        });

        self.apos.app.get('/password-reset', async function(req, res) {
          try {
            const reset = self.apos.launder.string(req.query.reset);
            const email = self.apos.launder.string(req.query.email);
            if (!reset.length) {
              return res.redirect('/password-reset-request?error=missing');
            }
            req.scene = 'user';
            const adminReq = self.apos.tasks.getReq();
            const user = await self.apos.users.find(adminReq, {
              email: email,
              passwordResetAt: { $gte: new Date(Date.now() - self.getPasswordResetLifetimeInMilliseconds()) }
            }).toObject();
            if (!user) {
              throw 'notfound';
            }
            // Gets i18n'd in the template, also bc with what templates that tried to work
            // before certain fixes would expect (this is why we still pass a string and not
            // a flag, and why we call it `message`)
            return self.sendPage(req, 'passwordReset', { reset: reset, email: email });
          } catch (err) {
            self.apos.utils.error(err);
            return res.redirect('/login?message=' + req.__('That reset code was not found. It may have expired. Try resetting again.'));
          }
        });

        self.apos.app.post('/password-reset', async function(req, res) {
          const reset = self.apos.launder.string(req.body.reset);
          const email = self.apos.launder.string(req.body.email);
          const password = self.apos.launder.string(req.body.password);
          if ((!reset.length) || (!password.length)) {
            return res.redirect('/password-reset-request?error=missing');
          }
          const adminReq = self.apos.tasks.getReq();
          try {
            const user = await self.apos.users.find(adminReq, {
              email: email,
              passwordResetAt: { $gte: new Date(Date.now() - self.getPasswordResetLifetimeInMilliseconds()) }
            });
            if (!user) {
              throw 'notfound';
            }
            await self.apos.users.verifySecret(user, 'passwordReset', reset);
            return user;
          } catch (err) {
            self.apos.utils.error(err);
            return res.redirect('/password-reset-request?error=error');
          }
        });

        self.getPasswordResetLifetimeInMilliseconds = function() {
          return 1000 * 60 * 60 * (self.options.passwordResetHours || 48);
        };

      }

      self.apos.app.get('/logout', function(req, res) {
        // Completely destroy the session. req.logout only breaks
        // the association with the user. Our end users expect
        // a more secure logout that leaves no trace.
        return req.session.destroy(function(err) {
          if (err) {
            // Not much more we can do, but it will be apparent to the user
            // that they are still logged in
            self.apos.utils.error(err);
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

    // Add the logout admin bar item.

    self.addAdminBarItems = function() {
      self.apos.adminBar.add(self.__meta.name + '-logout', 'Log Out', null, { last: true, href: '/logout' });
    };

    // Invoked by passport after an authentication strategy succeeds
    // and the user has been logged in. Invokes `loginAfterLogin` on
    // any modules that have one and redirects to `req.redirect` or,
    // if it is not set, to `/`.

    self.afterLogin = async function(req, res) {
      try {
        await self.emit('after', req);
      } catch (e) {
        self.apos.utils.error(e);
        return res.redirect('/');
      }
      return res.redirect(req.redirect || '/');
    };

    self.on('apostrophe', 'modulesReady', function() {
      // So this property is hashed and the hash kept in the safe,
      // rather than ever being stored literally
      self.apos.users.addSecret('passwordReset');
    });

  }
};
