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

const Passport = require('passport').Passport;
const LocalStrategy = require('passport-local');
const Promise = require('bluebird');
const cuid = require('cuid');

module.exports = {
  cascades: [ 'requirements' ],
  options: {
    alias: 'login',
    localLogin: true,
    scene: 'apos',
    csrfExceptions: [
      'login'
    ],
    bearerTokens: true
  },
  async init(self) {
    self.passport = new Passport();
    self.enableSerializeUsers();
    self.enableDeserializeUsers();
    if (self.options.localLogin !== false) {
      self.enableLocalStrategy();
    }
    self.enableBrowserData();
    await self.enableBearerTokens();
  },
  handlers(self) {
    return {
      'apostrophe:modulesRegistered': {
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
  routes(self) {
    if (!self.options.localLogin) {
      return {};
    }
    return {
      get: {
        // Login page
        [self.login()]: async (req, res) => {
          if (req.user) {
            return res.redirect('/');
          }
          req.scene = 'apos';
          try {
            await self.sendPage(req, 'login', {});
          } catch (e) {
            self.apos.util.error(e);
            return res.status(500).send('error');
          }
        }
      }
    };
  },
  apiRoutes(self) {
    if (!self.options.localLogin) {
      return {};
    }
    return {
      post: {
        async login(req) {
          // Don't make verify functions worry about whether this object
          // is present, just the value of their own sub-property
          req.body.requirements = req.body.requirements || {};
          if (req.body.incompleteToken) {
            return self.finalizeIncompleteLogin(req);
          } else {
            return self.initialLogin(req);
          }
        },
        async logout(req) {
          if (!req.user) {
            throw self.apos.error('forbidden', req.t('apostrophe:logOutNotLoggedIn'));
          }
          if (req.token) {
            await self.bearerTokens.removeOne({
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
        // invokes the `props(req, user)` function for the requirement specified by
        // `body.name`. Invoked before displaying each `afterPasswordVerified`
        // requirement. The return value of the function, which should
        // be an object, is delivered as the API response
        async requirementProps(req) {
          const { user } = await self.findIncompleteTokenAndUser(req, req.body.incompleteToken);

          const name = self.apos.launder.string(req.body.name);

          const requirement = self.requirements[name];
          if (!requirement) {
            throw self.apos.error('notfound');
          }
          if (!requirement.props) {
            return {};
          }
          return requirement.props(req, user);
        },
        async context(req) {
          return self.getContext(req);
        },
        ...(self.options.passwordReset ? {
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
                subject: req.t('apostrophe:passwordResetRequest', { site })
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
        // For bc this route is still available via GET, however
        // it should be accessed via POST because the result
        // may differ by individual user session and should not
        // be cached
        async context(req) {
          return self.getContext(req);
        }
      }
    };
  },
  methods(self) {
    return {

      // Implements the context route, which provides basic
      // information about the site being logged into and also
      // props for beforeSubmit and afterSubmit requirements
      async getContext(req) {
        const aposPackage = require('../../../package.json');
        // For performance beforeSubmit / afterSubmit requirement props all happen together here
        const requirementProps = {};
        for (const [ name, requirement ] of Object.entries(self.requirements)) {
          if ((requirement.phase !== 'afterPasswordVerified') && requirement.props) {
            try {
              requirementProps[name] = await requirement.props(req);
            } catch (e) {
              if (e.body && e.body.data) {
                e.body.data.requirement = name;
              }
              throw e;
            }
          }
        }
        return {
          env: process.env.NODE_ENV || 'development',
          name: (process.env.npm_package_name && process.env.npm_package_name.replace(/-/g, ' ')) || 'Apostrophe',
          version: aposPackage.version || '3',
          requirementProps
        };
      },

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
            if (user) {
              user._viaSession = true;
            }
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
        const user = await self.apos.user.find(req, {
          _id: id,
          disabled: {
            $ne: true
          }
        }).toObject();
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
      // If the user's credentials are invalid, `false` is returned after a
      // 1000ms delay to discourage abuse. If another type of error occurs, it is thrown
      // normally.
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
          if (err.name === 'invalid') {
            await Promise.delay(1000);
            return false;
          } else {
            // Actual system error
            throw err;
          }
        }
      },

      getPasswordResetLifetimeInMilliseconds() {
        return 1000 * 60 * 60 * (self.options.passwordResetHours || 48);
      },

      getBrowserData(req) {
        return {
          action: self.action,
          ...(req.user ? {
            user: {
              _id: req.user._id,
              title: req.user.title,
              username: req.user.username,
              email: req.user.email
            }
          } : {}),
          requirements: Object.fromEntries(
            Object.entries(self.requirements).map(([ name, requirement ]) => {
              const browserRequirement = {
                phase: requirement.phase,
                propsRequired: !!requirement.props
              };
              return [ name, browserRequirement ];
            })
          )
        };
      },

      async checkForUserAndAlert() {
        const adminReq = self.apos.task.getReq();
        const user = await self.apos.user.find(adminReq, {}).relationships(false).limit(1).toObject();

        if (!user && !self.apos.options.test) {
          self.apos.util.warnDev('There are no users created for this installation of ApostropheCMS yet.');
        }
      },

      async enableBearerTokens() {
        self.bearerTokens = self.apos.db.collection('aposBearerTokens');
        await self.bearerTokens.createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
      },

      // Finalize an incomplete login based on the provided incompleteToken
      // and various `requirements` subproperties. Implementation detail of the login route
      async finalizeIncompleteLogin(req) {
        const { lateRequirements } = self.filterRequirements();
        const session = self.apos.launder.boolean(req.body.session);
        // Completing a previous incomplete login
        // (password was verified but post-password-verification
        // requirements were not supplied)
        const token = await self.bearerTokens.findOne({
          _id: self.apos.launder.string(req.body.incompleteToken),
          incomplete: true,
          expires: {
            $gte: new Date()
          }
        });
        if (!token) {
          throw self.apos.error('notfound');
        }
        const user = await self.deserializeUser(token.userId);
        if (!user) {
          await self.bearerTokens.removeOne({
            _id: token.userId
          });
          throw self.apos.error('notfound');
        }
        for (const [ name, requirement ] of Object.entries(lateRequirements)) {
          try {
            await requirement.verify(req, user);
          } catch (e) {
            e.data = e.data || {};
            e.data.requirement = name;
            throw e;
          }
        }
        if (session) {
          await self.bearerTokens.removeOne({
            _id: token.userId
          });
          await self.passportLogin(req, user);
        } else {
          delete token.incomplete;
          self.bearerTokens.updateOne(token, {
            $unset: {
              incomplete: 1
            }
          });
          return {
            token
          };
        }
      },

      // Implementation detail of the login route and the requirementProps mechanism for
      // custom login requirements. Given the string `token`, returns
      // `{ token, user }`. Throws an exception if the token is not found.
      // `token` is sanitized before passing to mongodb.
      async findIncompleteTokenAndUser(req, token) {
        token = await self.bearerTokens.findOne({
          _id: self.apos.launder.string(token),
          incomplete: true,
          expires: {
            $gte: new Date()
          }
        });
        if (!token) {
          throw self.apos.error('notfound');
        }
        const user = await self.deserializeUser(token.userId);
        if (!user) {
          await self.bearerTokens.removeOne({
            _id: token._id
          });
          throw self.apos.error('notfound');
        }
        return {
          token,
          user
        };
      },

      // Implementation detail of the login route. Log in the user, or if there are
      // `requirements` that require password verification occur first, return an incomplete token.
      async initialLogin(req) {
        // Initial login step
        const username = self.apos.launder.string(req.body.username);
        const password = self.apos.launder.string(req.body.password);
        if (!(username && password)) {
          throw self.apos.error('invalid', req.t('apostrophe:loginPageBothRequired'));
        }
        const { earlyRequirements, lateRequirements } = self.filterRequirements();
        for (const [ name, requirement ] of Object.entries(earlyRequirements)) {
          try {
            await requirement.verify(req);
          } catch (e) {
            e.data = e.data || {};
            e.data.requirement = name;
            throw e;
          }
        }
        const user = await self.apos.login.verifyLogin(username, password);
        if (!user) {
          // For security reasons we may not tell the user which case applies
          throw self.apos.error('invalid', req.t('apostrophe:loginPageBadCredentials'));
        }
        if (Object.keys(lateRequirements).length) {
          const token = cuid();
          await self.bearerTokens.insert({
            _id: token,
            userId: user._id,
            incomplete: true,
            // Default lifetime of 1 hour is generous to permit situations like
            // installing a TOTP app for the first time
            expires: new Date(new Date().getTime() + (self.options.incompleteLifetime || 60 * 60 * 1000))
          });
          return {
            incompleteToken: token
          };
        } else {
          const session = self.apos.launder.boolean(req.body.session);
          if (session) {
            await self.passportLogin(req, user);
          } else {
            const token = cuid();
            await self.bearerTokens.insert({
              _id: token,
              userId: user._id,
              expires: new Date(new Date().getTime() + (self.options.bearerTokens.lifetime || (86400 * 7 * 2)) * 1000)
            });
            return {
              token
            };
          }
        }
      },

      filterRequirements() {
        return {
          earlyRequirements: Object.fromEntries(Object.entries(self.requirements).filter(([ name, requirement ]) => requirement.phase !== 'afterPasswordVerified')),
          lateRequirements: Object.fromEntries(Object.entries(self.requirements).filter(([ name, requirement ]) => requirement.phase === 'afterPasswordVerified'))
        };
      },

      // Awaitable wrapper for req.login. An implementation detail of the login route
      async passportLogin(req, user) {
        const passportLogin = (user) => {
          return require('util').promisify(function(user, callback) {
            return req.login(user, callback);
          })(user);
        };
        await passportLogin(user);
      }
    };
  },

  middleware(self) {
    return {
      passportInitialize: {
        before: '@apostrophecms/i18n',
        middleware: self.passport.initialize()
      },
      passportExtendLogin: {
        before: '@apostrophecms/i18n',
        middleware(req, res, next) {
          const superLogin = req.login.bind(req);
          req.login = (user, ...args) => {
            let options, callback;
            // Support inconsistent calling conventions inside passport core
            if (typeof args[0] === 'function') {
              options = {};
              callback = args[0];
            } else {
              options = args[0];
              callback = args[1];
            }
            return superLogin(user, options, async (err) => {
              if (err) {
                return callback(err);
              }
              await self.emit('afterSessionLogin', req);
              // Make sure no handler removed req.user
              if (req.user) {
                // Mark the login timestamp. Middleware takes care of ensuring
                // that logins cannot be used to carry out actions prior
                // to this property being added
                req.session.loginAt = Date.now();
              }
              return callback(null);
            });
          };
          // Passport itself maintains this bc alias, while refusing
          // to actually decide which one is best in its own dev docs.
          // Both have to exist to avoid bugs when passport calls itself
          req.logIn = req.login;
          return next();
        }
      },
      passportSession: {
        before: '@apostrophecms/i18n',
        middleware: self.passport.session()
      },
      honorLoginInvalidBefore: {
        before: '@apostrophecms/i18n',
        middleware(req, res, next) {
          if (req.user && req.user._viaSession && req.user.loginInvalidBefore && ((!req.session.loginAt) || (req.session.loginAt < req.user.loginInvalidBefore))) {
            req.session.destroy();
            delete req.user;
          }
          return next();
        }
      },
      addUserToData: {
        before: '@apostrophecms/i18n',
        middleware(req, res, next) {
          // Add the `user` property to `req.data` when a user is logged in.
          if (req.user) {
            req.data.user = req.user;
            return next();
          } else {
            return next();
          }
        }
      }
    };
  }
};
