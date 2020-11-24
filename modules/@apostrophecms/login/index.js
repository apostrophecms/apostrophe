// Enable users to log in via a login form on the site at `/login`.
//
// ## Options
//
// `localLogin`
//
// If explicitly set to `false`, the `/login` route does not exist,
// and it is not possible to log in via your username and password.
// This usually makes sense only in the presence of an alternative such as
// the `@apostrophecms/passport` module, which adds support for login via
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
// `bearerTokens`
//
// If not explicitly set to `false`, apps may log in via the login route
// and receive a `token` as a response, which can then be presented as a
// bearer token. If set to `false`, only session-based logins are possible.
//
// May be set to an object with a `lifetime` property, in milliseconds.
// The default bearer token lifetime is 2 weeks.
//
// ## Notable properties of apos.modules['@apostrophecms/login']
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
const Promise = require('bluebird');
const cuid = require('cuid');

module.exports = {
  options: {
    alias: 'login',
    localLogin: true,
    scene: 'apos',
    csrfExceptions: [
      'login'
    ],
    bearerTokens: true
  },
  async init(self, options) {
    self.passport = new Passport();
    self.enableSerializeUsers();
    self.enableDeserializeUsers();
    if (self.options.localLogin !== false) {
      self.enableLocalStrategy();
    }
    self.enableBrowserData();
    await self.enableBearerTokens();
  },
  handlers(self, options) {
    return {
      'apostrophe:modulesReady': {
        addSecret() {
          // So this property is hashed and the hash kept in the safe,
          // rather than ever being stored literally
          self.apos.user.addSecret('passwordReset');
        },
        async checkForUser () {
          await self.checkForUserAndAlert();
        }
      }
    };
  },
  routes(self, options) {
    if (!options.localLogin) {
      return {};
    }
    return {
      get: {
        // Login page
        [self.login()]: async (req) => {
          if (req.user) {
            return req.res.redirect('/');
          }
          req.scene = 'apos';
          await self.sendPage(req, 'login', {});
        }
      }
    };
  },
  apiRoutes(self, options) {
    if (!options.localLogin) {
      return {};
    }
    return {
      post: {
        async login(req) {
          console.log('got into the login route');
          const username = self.apos.launder.string(req.body.username);
          const password = self.apos.launder.string(req.body.password);
          const session = self.apos.launder.boolean(req.body.session);
          if (!(username && password)) {
            throw self.apos.error('invalid');
          }
          const user = await self.apos.login.verifyLogin(username, password);
          if (!user) {
            throw self.apos.error('invalid');
          }
          if (session) {
            console.log('logging in with session');
            const passportLogin = (user) => {
              return require('util').promisify(function(user, callback) {
                return req.login(user, callback);
              })(user);
            };
            await passportLogin(user);
          } else {
            console.log('logging in with bearer token');
            const token = cuid();
            await self.bearerTokens.insert({
              _id: token,
              userId: user._id,
              expires: new Date(new Date().getTime() + (self.options.bearerTokens.lifetime || (86400 * 7 * 2)) * 1000)
            });
            console.log('returning result');
            return {
              token
            };
          }
        },
        async logout(req) {
          if (!req.user) {
            throw self.apos.error('forbidden');
          }
          if (req.token) {
            await self.bearerTokens.remove({
              userId: req.user._id,
              _id: req.token
            });
          }
          if (req.session) {
            const destroySession = () => {
              return require('util').promisify(function(callback) {
                // Be thorough, nothing in the session potentially related to the login should survive logout
                return req.session.destroy(callback);
              })();
            };
            await destroySession();
          }
        },
        ...(options.passwordReset ? {
          async resetRequest(req) {
            const site = (req.headers.host || '').replace(/:\d+$/, '');
            const username = self.apos.launder.string(req.body.username);
            if (!username.length) {
              throw self.apos.error('invalid');
            }
            const clauses = [];
            clauses.push({ username: username });
            clauses.push({ email: username });
            const user = await self.apos.user.find(req, { $or: clauses }).permission(false).toObject();
            if (!user) {
              throw self.apos.error('notfound');
            }
            if (!user.email) {
              throw self.apos.error('invalid');
            }
            const reset = self.apos.util.generateId();
            user.passwordReset = reset;
            user.passwordResetAt = new Date();
            await self.apos.user.update(req, user, { permissions: false });
            const parsed = new URL(req.absoluteUrl);
            parsed.pathname = '/password-reset';
            parsed.search = '?';
            parsed.searchParams.append('reset', reset);
            parsed.searchParams.append('email', user.email);
            try {
              await self.email(req, 'passwordResetEmail', {
                user: user,
                url: parsed.toString(),
                site: site
              }, {
                to: user.email,
                subject: req.__('Your request to reset your password on ' + site)
              });
            } catch (err) {
              throw self.apos.error('email');
            }
          },

          async reset(req) {
            const reset = self.apos.launder.string(req.body.reset);
            const email = self.apos.launder.string(req.body.email);
            const password = self.apos.launder.string(req.body.password);
            if (!reset.length || !password.length) {
              throw self.apos.error('invalid');
            }
            const adminReq = self.apos.task.getReq();
            const user = await self.apos.user.find(adminReq, {
              email: email,
              passwordResetAt: { $gte: new Date(Date.now() - self.getPasswordResetLifetimeInMilliseconds()) }
            });
            if (!user) {
              throw self.apos.error('notfound');
            }
            await self.apos.user.verifySecret(user, 'passwordReset', reset);
            return user;
          }
        } : {})
      },
      get: {
        context () {
          let aposPackage = {};
          try {
            aposPackage = require('../../../package.json');
          } catch (err) {
            self.apos.util.error(err);
          }

          return {
            env: process.env.NODE_ENV || 'development',
            name: (process.env.npm_package_name && process.env.npm_package_name.replace(/-/g, ' ')) || 'Apostrophe',
            version: aposPackage.version || '3'
          };
        }
      }
    };
  },
  methods(self, options) {
    return {

      // return the loginUrl option
      login(url) {
        return self.options.loginUrl ? self.options.loginUrl : '/login';
      },

      // Set the `serializeUser` method of `passport` to serialize the
      // user by storing their user ID in the session.

      enableSerializeUsers() {
        self.passport.serializeUser(function (user, done) {
          done(null, user._id);
        });
      },

      // Set the `deserializeUser` method of `passport`,
      // wrapping the `deserializeUser` method of this
      // module for use with passport's API.
      // See `deserializeUser`.

      enableDeserializeUsers() {
        self.passport.deserializeUser(function (id, cb) {
          self.deserializeUser(id).then(function (user) {
            return cb(null, user);
          }).catch(cb);
        });
      },

      // Given a user's `_id`, fetches that user via the login module
      // and, if the user is found, emits the `deserialize` event.
      // If no user is found, `null` is returned, otherwise the
      // user is returned.
      //
      // This method is passed to `passport.deserializeUser`,
      // wrapped to support its async implementation.
      // It is also useful when you wish to load a user exactly
      // as Passport would.

      async deserializeUser(id) {
        const req = self.apos.task.getReq();
        const user = await self.apos.user.find(req, { _id: id }).toObject();
        if (!user) {
          return null;
        }
        await self.emit('deserialize', user);
        return user;
      },

      // Adds the "local strategy" (username/email and password login)
      // to Passport. Users are found via the `find` method of the
      // [@apostrophecms/user](../@apostrophecms/user/index.html) module.
      // Users with the `disabled` property set to true may not log in.
      // Passwords are verified via the `verifyPassword` method of
      // [@apostrophecms/user](../@apostrophecms/user/index.html), which is
      // powered by the [credential](https://npmjs.org/package/credential) module.

      enableLocalStrategy() {
        self.passport.use(new LocalStrategy(self.localStrategy));
      },

      // Local Strategy wrapper for self.verifyLogin to work nicely with
      // passport.
      async localStrategy(username, password, done) {
        try {
          const user = await self.verifyLogin(username, password);

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },

      // Verify a login attempt. `username` can be either
      // the username or the email address (both are unique).
      //
      // If the user's login FAILS, `false` is returned after a 1000ms delay to
      // discourage abuse. In the case of an error, `'invalid'` is thrown as an
      // exception instead following the delay.
      //
      // If the user's login SUCCEEDS, the return value is
      // the `user` object.

      async verifyLogin(username, password) {
        const req = self.apos.task.getReq();
        const user = await self.apos.user.find(req, {
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
          await self.apos.user.verifyPassword(user, password);
          return user;
        } catch (err) {
          await Promise.delay(1000);
          throw self.apos.error('invalid');
        }
      },

      getPasswordResetLifetimeInMilliseconds() {
        return 1000 * 60 * 60 * (self.options.passwordResetHours || 48);
      },

      // Invoked by passport after an authentication strategy succeeds
      // and the user has been logged in. Invokes `loginAfterLogin` on
      // any modules that have one and redirects to `req.redirect` or,
      // if it is not set, to `/`.

      async afterLogin(req, res) {
        try {
          await self.emit('after', req);
        } catch (e) {
          self.apos.util.error(e);
          return res.redirect('/');
        }
        return res.redirect(req.redirect || '/');
      },

      getBrowserData(req) {
        return {
          action: self.action,
          ...(req.user ? {
            user: {
              _id: req.user._id,
              firstName: req.user.firstName,
              lastName: req.user.lastName,
              title: req.user.title,
              username: req.user.username,
              email: req.user.email
            }
          } : {})
        };
      },

      async checkForUserAndAlert() {
        const adminReq = self.apos.task.getReq();
        const user = await self.apos.user.find(adminReq, {}).limit(1).toObject();

        if (!user) {
          self.apos.util.warn('⚠️  There are no users created for this installation of ApostropheCMS yet.');
        }
      },

      async enableBearerTokens() {
        self.bearerTokens = self.apos.db.collection('aposBearerTokens');
        await self.bearerTokens.ensureIndex({ expires: 1 }, { expireAfterSeconds: 0 });
      }
    };
  },

  middleware(self, options) {
    return {
      passportInitialize: self.passport.initialize(),
      passportSession: self.passport.session(),
      // Add the `user` property to `req.data` when a user is logged in.
      addUserToData(req, res, next) {
        if (req.user) {
          req.data.user = req.user;
          return next();
        } else {
          return next();
        }
      }
    };
  }
};
