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
const { createId } = require('@paralleldrive/cuid2');
const expressSession = require('express-session');

const loginAttemptsNamespace = '@apostrophecms/loginAttempt';
const loggedInCookieName = 'loggedIn';

module.exports = {
  cascades: [ 'requirements' ],
  options: {
    alias: 'login',
    placeholder: {
      username: 'apostrophe:enterUsername',
      password: 'apostrophe:enterPassword'
    },
    localLogin: true,
    passwordReset: false,
    passwordResetHours: 48,
    scene: 'apos',
    csrfExceptions: [
      'login'
    ],
    bearerTokens: true,
    throttle: {
      allowedAttempts: 3,
      perMinutes: 1,
      lockoutMinutes: 1
    }
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
    self.addToAdminBar();
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
            const cookie = req.session.cookie;
            await destroySession();
            // Session cookie expiration isn't automatic with `req.session.destroy`.
            // Fix that to reduce challenges for those attempting to implement custom
            // caching strategies at the edge
            // https://github.com/expressjs/session/issues/241
            const expireCookie = new expressSession.Cookie(cookie);
            expireCookie.expires = new Date(0);
            const name = self.apos.modules['@apostrophecms/express'].sessionOptions.name;
            req.res.header('set-cookie', expireCookie.serialize(name, 'deleted'));

            // TODO: get cookie name from config
            req.res.cookie(`${self.apos.shortName}.${loggedInCookieName}`, 'false');
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
        async requirementVerify(req) {
          const name = self.apos.launder.string(req.body.name);
          const loginNamespace = `${loginAttemptsNamespace}/${name}`;

          const { user } = await self.findIncompleteTokenAndUser(
            req,
            req.body.incompleteToken
          );

          if (!user) {
            throw self.apos.error('invalid');
          }

          const requirement = self.requirements[name];

          if (!requirement) {
            throw self.apos.error('notfound');
          }

          if (!requirement.verify) {
            throw self.apos.error('invalid', 'You must provide a verify method in your requirement');
          }

          const { cachedAttempts, reached } = await self
            .checkLoginAttempts(user.username, loginNamespace);

          if (reached) {
            throw self.apos.error('invalid', req.t('apostrophe:loginMaxAttemptsReached', {
              count: self.options.throttle.lockoutMinutes
            }));
          }

          try {

            await requirement.verify(req, req.body.value, user);

            const token = await self.bearerTokens.findOne({
              _id: self.apos.launder.string(req.body.incompleteToken),
              requirementsToVerify: { $exists: true },
              expires: {
                $gte: new Date()
              }
            });

            if (!token) {
              throw self.apos.error('notfound');
            }

            await self.bearerTokens.updateOne(token, {
              $pull: { requirementsToVerify: name }
            });

            await self.clearLoginAttempts(user.username, loginNamespace);

            return {};
          } catch (err) {
            await self.addLoginAttempt(
              user.username,
              cachedAttempts,
              loginNamespace
            );

            err.data = err.data || {};
            err.data.requirement = name;
            throw err;
          }
        },
        async context(req) {
          return self.getContext(req);
        },
        ...(self.isPasswordResetEnabled() ? {
          async resetRequest(req) {
            const wait = (t = 2000) => Promise.delay(t);
            const site = (req.headers.host || '').replace(/:\d+$/, '');
            const email = self.apos.launder.string(req.body.email);
            if (!email.length) {
              throw self.apos.error('invalid', req.t('apostrophe:loginResetEmailRequired'));
            }
            let user;
            // error not reported to browser for security reasons
            try {
              user = await self.getPasswordResetUser(req.body.email);
            } catch (e) {
              self.apos.util.error(e);
            }
            if (!user) {
              await wait();
              self.apos.util.error(
                `Reset password request error - the user ${email} doesn\`t exist.`
              );
              return;
            }
            if (!user.email) {
              await wait();
              self.apos.util.error(
                `Reset password request error - the user ${user.username} doesn\`t have an email.`
              );
              return;
            }
            const reset = self.apos.util.generateId();
            user.passwordReset = reset;
            user.passwordResetAt = new Date();
            await self.apos.user.update(req, user, { permissions: false });
            // Fix - missing host in the absoluteUrl results in a panic.
            let port = (req.headers.host || '').split(':')[1];
            if (!port || [ '80', '443' ].includes(port)) {
              port = '';
            } else {
              port = `:${port}`;
            }
            const parsed = new URL(
              req.absoluteUrl,
              self.apos.baseUrl
                ? undefined
                : `${req.protocol}://${req.hostname}${port}`
            );
            parsed.pathname = self.login();
            parsed.search = '?';
            parsed.searchParams.append('reset', reset);
            parsed.searchParams.append('email', user.email);
            try {
              await self.email(req, 'passwordResetEmail', {
                user,
                url: parsed.toString(),
                site
              }, {
                to: user.email,
                subject: req.t('apostrophe:passwordResetRequest', { site })
              });
            } catch (err) {
              self.apos.util.error(`Error while sending email to ${user.email}`, err);
            }
          },

          async reset(req) {
            const password = self.apos.launder.string(req.body.password);
            if (!password.length) {
              throw self.apos.error('invalid', req.t('apostrophe:loginResetPasswordRequired'));
            }
            let user;
            try {
              user = await self.getPasswordResetUser(
                req.body.email,
                // important, empty to string to avoid security problems
                req.body.reset || ''
              );

            } catch (e) {
              self.apos.util.error(e);
              throw self.apos.error('invalid', req.t('apostrophe:loginResetInvalid'));
            }

            user.passwordReset = null;
            user.passwordResetAt = new Date(0);
            user.password = password;
            await self.apos.user.update(req, user, { permissions: false });
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
        },
        async reset(req) {
          try {
            await self.getPasswordResetUser(
              req.query.email,
              // important, empty to string to avoid security problems
              req.query.reset || ''
            );

          } catch (e) {
            self.apos.util.error(e);
            throw self.apos.error('invalid', req.t('apostrophe:loginResetInvalid'));
          }
        }
      }
    };
  },
  methods(self) {
    return {

      // Implements the context route, which provides basic
      // information about the site being logged into and also
      // props for beforeSubmit requirements
      async getContext(req) {
        const aposPackage = require('../../../package.json');
        // For performance beforeSubmit requirement props all happen together here
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
          env: process.env.APOS_ENV_LABEL || self.options.environmentLabel || process.env.NODE_ENV || 'development',
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
      // powered by the [credentials](https://npmjs.org/package/credentials) module.

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
      // `attempts`,  `ip` and `requestId` are optional, sent for only logging needs. They won't
      // be available with passport.

      async verifyLogin(username, password, attempts = 0, ip, requestId) {
        const req = self.apos.task.getReq();
        const user = await self.apos.user.find(req, {
          $or: [
            { username },
            { email: username }
          ],
          disabled: { $ne: true }
        }).toObject();

        if (!user) {
          self.logInfo('incorrect-username', {
            username,
            ip,
            attempts: attempts + 1,
            requestId
          });
          await Promise.delay(1000);
          return false;
        }
        try {
          await self.apos.user.verifyPassword(user, password);
          self.logInfo('correct-password', {
            username,
            ip,
            attempts,
            requestId
          });
          return user;
        } catch (err) {
          if (err.name === 'invalid') {
            self.logInfo('incorrect-password', {
              username,
              ip,
              attempts: attempts + 1,
              requestId
            });
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

      isPasswordResetEnabled() {
        return self.options.localLogin && self.options.passwordReset;
      },

      getBrowserData(req) {
        return {
          schema: self.getSchema(),
          action: self.action,
          passwordResetEnabled: self.isPasswordResetEnabled(),
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
                propsRequired: !!requirement.props,
                askForConfirmation: requirement.askForConfirmation || false
              };
              return [ name, browserRequirement ];
            })
          )
        };
      },

      // Get a user by EITHER:
      // - username/email
      // - username/email AND reset token
      // `resetToken` can be `false` or `string`. Passing any other type
      // will be converted to string and used for searching the user.
      async getPasswordResetUser(usernameOrEmail, resetToken = false) {
        if (!self.isPasswordResetEnabled()) {
          return null;
        }
        const reset = self.apos.launder.string(resetToken);
        const email = self.apos.launder.string(usernameOrEmail);

        if (!email.length) {
          throw self.apos.error('invalid');
        }
        if (resetToken !== false && !reset.length) {
          throw self.apos.error('invalid');
        }
        const adminReq = self.apos.task.getReq();
        const criteriaOr = [
          { username: email },
          { email }
        ];
        const criteriaAnd = {};
        if (resetToken !== false) {
          criteriaAnd.passwordResetAt = {
            $gte: new Date(Date.now() - self.getPasswordResetLifetimeInMilliseconds())
          };
        }
        const user = await self.apos.user
          .find(adminReq, {
            $or: criteriaOr,
            ...criteriaAnd
          })
          .toObject();
        if (!user) {
          throw self.apos.error('notfound');
        }
        if (resetToken !== false) {
          await self.apos.user.verifySecret(
            user,
            'passwordReset',
            reset
          );
        }
        return user;
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
        const session = self.apos.launder.boolean(req.body.session);
        // Completing a previous incomplete login
        // (password was verified but post-password-verification
        // requirements were not supplied)
        const token = await self.bearerTokens.findOne({
          _id: self.apos.launder.string(req.body.incompleteToken),
          requirementsToVerify: {
            $exists: true
          },
          expires: {
            $gte: new Date()
          }
        });

        if (!token) {
          throw self.apos.error('notfound');
        }

        if (token.requirementsToVerify.length) {
          throw self.apos.error('forbidden', 'All requirements must be verified');
        }

        const user = await self.deserializeUser(token.userId);
        if (!user) {
          await self.bearerTokens.removeOne({
            _id: token.userId
          });
          throw self.apos.error('notfound');
        }

        if (session) {
          await self.bearerTokens.removeOne({
            _id: token.userId
          });
          await self.passportLogin(req, user);
          // No access to login attempts in the final phase.
          self.logInfo(req, 'complete', {
            username: user.username
          });
        } else {
          delete token.requirementsToVerify;
          self.bearerTokens.updateOne(token, {
            $unset: {
              requirementsToVerify: 1
            }
          });
          self.logInfo(req, 'complete', {
            username: user.username
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
          requirementsToVerify: {
            $exists: true,
            $ne: []
          },
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

      async verifyRequirements(req, requirements) {
        for (const [ name, requirement ] of Object.entries(requirements)) {
          try {
            await requirement.verify(req, req.body.requirements && req.body.requirements[name]);
          } catch (e) {
            e.data = e.data || {};
            e.data.requirement = name;
            throw e;
          }
        }
      },

      // Implementation detail of the login route. Log in the user, or if there are
      // `requirements` that require password verification occur first, return an incomplete token.
      async initialLogin(req) {
        const username = self.apos.launder.string(req.body.username);
        const password = self.apos.launder.string(req.body.password);

        if (!(username && password)) {
          throw self.apos.error('invalid', req.t('apostrophe:loginPageBothRequired'));
        }

        const { cachedAttempts, reached } = await self.checkLoginAttempts(username);
        const logAttempts = cachedAttempts ?? 0;

        if (reached) {
          throw self.apos.error('invalid', req.t('apostrophe:loginMaxAttemptsReached', {
            count: self.options.throttle.lockoutMinutes
          }));
        }

        try {
          // Initial login step
          const {
            earlyRequirements,
            onTimeRequirements,
            lateRequirements
          } = self.filterRequirements();
          await self.verifyRequirements(req, earlyRequirements);
          await self.verifyRequirements(req, onTimeRequirements);

          // send log information
          const user = await self.apos.login.verifyLogin(
            username,
            password,
            logAttempts,
            self.apos.structuredLog.getIp(req),
            self.apos.structuredLog.getRequestId(req)
          );
          if (!user) {
          // For security reasons we may not tell the user which case applies
            throw self.apos.error('invalid', req.t('apostrophe:loginPageBadCredentials'));
          }

          const requirementsToVerify = Object.keys(lateRequirements);
          if (requirementsToVerify.length) {
            const token = createId();

            await self.bearerTokens.insertOne({
              _id: token,
              userId: user._id,
              requirementsToVerify,
              // Default lifetime of 1 hour is generous to permit situations like
              // installing a TOTP app for the first time
              expires: new Date(new Date().getTime() + (self.options.incompleteLifetime || 60 * 60 * 1000))
            });

            await self.clearLoginAttempts(user.username);

            return {
              incompleteToken: token
            };
          }

          const session = self.apos.launder.boolean(req.body.session);
          if (session) {
            await self.passportLogin(req, user);
            await self.clearLoginAttempts(user.username);
            self.logInfo(req, 'complete', {
              username,
              attempts: logAttempts
            });
            return {};
          } else {
            const token = createId();
            await self.bearerTokens.insertOne({
              _id: token,
              userId: user._id,
              expires: new Date(new Date().getTime() + (self.options.bearerTokens.lifetime || (86400 * 7 * 2)) * 1000)
            });

            await self.clearLoginAttempts(user.username);
            self.logInfo(req, 'complete', {
              username,
              attempts: logAttempts
            });

            return {
              token
            };
          }
        } catch (err) {
          await self.addLoginAttempt(username, cachedAttempts);

          throw err;
        }
      },

      filterRequirements() {
        const requirements = Object.entries(self.requirements);

        return {
          earlyRequirements: Object.fromEntries(requirements.filter(([ , requirement ]) => requirement.phase === 'beforeSubmit')),
          onTimeRequirements: Object.fromEntries(requirements.filter(requirement => requirement.phase === 'uponSubmit')),
          lateRequirements: Object.fromEntries(requirements.filter(([ , requirement ]) => requirement.phase === 'afterPasswordVerified'))
        };
      },

      // Awaitable wrapper for req.login. An implementation detail of the login route
      async passportLogin(req, user) {
        const cookieName = `${self.apos.shortName}.${loggedInCookieName}`;
        if (req.cookies[cookieName] !== 'true') {
          req.res.cookie(cookieName, 'true');
        }
        const passportLogin = (user) => {
          return require('util').promisify(function(user, callback) {
            return req.login(user, callback);
          })(user);
        };
        await passportLogin(user);
      },

      async addLoginAttempt (
        username,
        attempts,
        namespace = loginAttemptsNamespace
      ) {
        if (typeof attempts !== 'number') {
          await self.apos.cache.set(namespace,
            username,
            1,
            self.options.throttle.perMinutes * 60
          );
        } else {
          await self.apos.cache.cacheCollection.updateOne(
            {
              namespace,
              key: username
            },
            {
              $inc: {
                value: 1
              }
            }
          );
        }
      },

      async checkLoginAttempts (username, namespace = loginAttemptsNamespace) {
        const cachedAttempts = await self.apos.cache.get(namespace, username);
        const { allowedAttempts } = self.options.throttle;

        if (!cachedAttempts || cachedAttempts < allowedAttempts) {
          return { cachedAttempts };
        }

        // When this is the first time we reach the limit
        // we set the lifetime only once with lockoutMinutes
        if (cachedAttempts === allowedAttempts) {
          await self.apos.cache.set(namespace,
            username,
            cachedAttempts + 1,
            self.options.throttle.lockoutMinutes * 60
          );
        }

        return {
          cachedAttempts,
          reached: true
        };
      },

      async clearLoginAttempts (username, namespace = loginAttemptsNamespace) {
        await self.apos.cache.delete(namespace, username);
      },

      addToAdminBar() {
        self.apos.adminBar.add(
          `${self.__meta.name}-logout`,
          'apostrophe:logOut',
          false,
          {
            user: true,
            last: true
          }
        );
      },

      getSchema() {
        return self.apos.user.schema
          .filter(({ name }) => [ 'username', 'password' ].includes(name))
          .map(field => ({
            name: field.name,
            label: field.label,
            placeholder: self.options.placeholder[field.name],
            type: field.type,
            required: true
          })
          );
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
              try {
                await self.emit('afterSessionLogin', req);
              } catch (e) {
                return callback(e);
              }
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
        middleware: (() => {
          // Wrap the passport middleware so that if the apikey or bearer token
          // middleware already supplied req.user, that wins (explicit wins over implicit)
          const passportSession = self.passport.session();
          return (req, res, next) => req.user ? next() : passportSession(req, res, next);
        })()
      },
      removeUserForDraftSharing: {
        before: '@apostrophecms/i18n',
        middleware(req, res, next) {
          // Remove user to hide the admin UI, in order to simulate a logged-out page view
          if (self.isShareDraftRequest(req)) {
            delete req.user;
          }
          return next();
        }
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
      },
      addLoggedInCookie: {
        before: '@apostrophecms/i18n',
        middleware(req, res, next) {
          // TODO: get cookie name from config
          const cookieName = `${self.apos.shortName}.${loggedInCookieName}`;
          if (req.user && req.cookies[cookieName] !== 'true') {
            res.cookie(cookieName, 'true');
          }
          return next();
        }
      }
    };
  }
};
