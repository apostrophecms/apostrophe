const fs = require('fs');
const path = require('path');
const humanname = require('humanname');
const { klona } = require('klona');
const { AuthTokenRefresh } = require('passport-oauth2-refresh');

module.exports = {
  bundle: {
    directory: 'modules',
    modules: getBundleModuleNames()
  },
  async init(self) {
    await self.enablePassportStrategies();
  },
  options: {
    i18n: {
      ns: 'aposPassportBridge'
    },
    create: undefined, // { role: 'guest' }
    retainAccessTokenInSession: false, // Legacy, incompatible with Passport 0.6
    retainAccessToken: false
  },
  methods(self) {
    return {
      async enablePassportStrategies() {
        self.refresh = new AuthTokenRefresh();
        self.specs = {};
        self.strategies = {};
        if (!self.apos.baseUrl) {
          throw new Error('@apostrophecms/passport-bridge: you must configure the top-level "baseUrl" option for apostrophe');
        }
        if (!Array.isArray(self.options.strategies)) {
          throw new Error('@apostrophecms/passport-bridge: you must configure the "strategies" option');
        }

        for (let spec of self.options.strategies) {
          spec = klona(spec);
          // Works with npm modules that export the strategy directly, npm modules
          // that export a Strategy property, and directly passing in a strategy property
          // in the spec
          const strategyModule = spec.module && await import(spec.module);

          const factory = spec.factory || ((...args) => {
            const Strategy = strategyModule
              ? (strategyModule.Strategy || strategyModule)
              : spec.Strategy;
            if (!Strategy) {
              throw new Error('@apostrophecms/passport-bridge: each strategy must have a "module" setting\n' +
                'giving the name of an npm module installed in your project such\n' +
                'as passport-oauth2, passport-oauth or a subclass with a compatible\n' +
                'interface, such as passport-gitlab2, passport-twitter, etc.\n\n' +
                'You may instead pass a "factory" async function that takes the configuration and\n' +
                'returns a strategy object.\n\nFinally, for bc, you may pass a strategy constructor as a\n' +
                'Strategy property.\n\nThe factory function is the most flexible option.'
              );
            }
            return new Strategy(...args);
          });

          // Are there strategies requiring no options? Probably not, but maybe...
          spec.options = spec.options || {};
          const scope = spec.options.scope || spec?.authenticate?.scope;
          spec.options.scope = spec?.authenticate?.scope;
          spec.authenticate = spec.authenticate || {};
          spec.authenticate.scope = spec.authenticate.scope || scope;

          // Must be a function that accepts self.findOrCreateUser and
          // returns an async function that calls self.findOrCreateUser with 5 parameters
          // (findOrCreateUser) =>
          //   async (req, accessToken, refreshToken, profile, callback) =>
          //     findOrCreateUser(req, accessToken, refreshToken, profile, callback)
          //
          // If there is no req, you can pass null instead
          // (findOrCreateUser) =>
          //   async (accessToken, refreshToken, profile, callback) =>
          //     findOrCreateUser(null, accessToken, refreshToken, profile, callback)
          //
          // You can also remap parameters
          // (findOrCreateUser) =>
          //   async (req, accessToken, refreshToken, extraParams, profile, callback) =>
          //     findOrCreateUser(req, accessToken, refreshToken, profile, callback)
          const { verify = (findOrCreateUser) => findOrCreateUser } = spec.options;

          if (!spec.name) {
            // It's hard to find the strategy name; it's not the same
            // as the npm name. And we need it to build the callback URL
            // sensibly. But we can do it by making a dummy strategy object now
            const dummy = await factory({
              callbackURL: 'https://dummy.localhost/test',
              passReqToCallback: true,
              ...spec.options
            }, verify(self.findOrCreateUser(spec)));
            spec.name = dummy.name;
          }
          spec.label = spec.label || spec.name;
          spec.options.callbackURL = self.getCallbackUrl(spec, true);
          self.specs[spec.name] = spec;
          const strategy = await factory({
            passReqToCallback: true,
            ...spec.options
          }, verify(self.findOrCreateUser(spec)));
          self.strategies[spec.name] = strategy;
          self.apos.login.passport.use(strategy);
          if (strategy._oauth2) {
            // This will only work with strategies that actually have an _oauth2 object
            self.refresh.use(self.strategies[spec.name]);
          }
        };
      },

      // Returns the oauth2 callback URL, which must match the route
      // established by `addCallbackRoute`. If `absolute` is true
      // then `baseUrl` and `apos.prefix` are prepended, otherwise
      // not (because `app.get` automatically prepends a prefix).
      // If the callback URL was preconfigured via spec.options.callbackURL
      // it is returned as-is when `absolute` is true, otherwise
      // the pathname is returned with any `apos.prefix` removed
      // to avoid adding it twice in `app.get` calls.
      getCallbackUrl(spec, absolute) {
        let url;
        if (spec.options && spec.options.callbackURL) {
          url = spec.options.callbackURL;
          if (absolute) {
            return url;
          }
          const parsed = new URL(url);
          url = parsed.pathname;
          if (self.apos.prefix) {
            // Remove the prefix if present, so that app.get doesn't
            // add it redundantly
            return url.replace(new RegExp('^' + self.apos.util.regExpQuote(self.apos.prefix)), '');
          }
          return parsed.pathname;
        }
        return (absolute ? (self.apos.baseUrl + self.apos.prefix) : '') + '/auth/' + spec.name + '/callback';
      },

      // Returns the URL you should link users to in order for them
      // to log in. If `absolute` is true then `baseUrl` and `apos.prefix`
      // are prepended, otherwise not (because `app.get` automatically prepends a prefix).
      getLoginUrl(spec, absolute) {
        return (absolute ? (self.apos.baseUrl + self.apos.prefix) : '') + '/auth/' + spec.name + '/login';
      },

      // Returns the URL used to confirm a connection to another service.
      // Since this is used in email `absolute` is usually `true`, however
      // it is also used to create routes.
      getConnectUrl(strategyName, token, absolute) {
        return (absolute ? (self.apos.baseUrl + self.apos.prefix) : '') + '/auth/' + strategyName + '/connect/' + token;
      },

      // Adds the login route
      // which will be `/auth/strategyname/login`, where the strategy name
      // depends on the passport module being used.
      //
      // Redirect users to this URL
      // to start the process of logging them in via each strategy
      addLoginRoute(spec) {
        self.apos.app.get(self.getLoginUrl(spec), (req, res, next) => {
          if (req.query.newLocale) {
            req.session.passportLocale = {
              oldLocale: req.query.oldLocale,
              newLocale: req.query.newLocale,
              oldAposDocId: req.query.oldAposDocId
            };
            return res.redirect(self.apos.url.build(req.url, {
              newLocale: null,
              oldLocale: null,
              oldAposDocId: null
            }));
          } else {
            return next();
          }
        }, self.apos.login.passport.authenticate(spec.name, spec.authenticate));
      },

      addConnectRoute(spec) {
        self.apos.app.get(self.getConnectUrl(spec.name, ':token'), async (req, res) => {
          const strategyName = spec.name;
          try {
            const token = req.params.token;
            if (!token.length) {
              self.apos.util.info('No token provided to connect route');
              return res.redirect(self.getFailureUrl(spec));
            }
            const safe = await self.apos.user.safe.findOne({
              [`connectionRequests.${strategyName}.token`]: token
            });
            if (!safe) {
              self.apos.util.info('Token not found for connect route');
              return res.redirect(self.getFailureUrl(spec));
            }
            const request = safe.connectionRequests[strategyName];
            if (request.expiresAt < Date.now()) {
              self.apos.util.info('Token expired for connect route');
              return res.redirect(self.getFailureUrl(spec));
            }
            const nonce = self.apos.util.generateId();
            await self.apos.user.safe.updateOne({
              _id: safe._id
            }, {
              $set: {
                [`connectionRequests.${strategyName}`]: {
                  nonce,
                  session: {
                    ...req.session
                  }
                }
              }
            });
            res.cookie('apos-connect', `${strategyName}:${nonce}`, {
              maxAge: 1000 * 60 * 60 * 24,
              httpOnly: true,
              secure: (req.protocol === 'https')
            });
            return res.redirect(self.getLoginUrl(spec));
          } catch (e) {
            self.apos.util.error(e);
            return res.redirect(self.getFailureUrl(spec));
          }
        });
      },

      // Adds the callback route associated with a strategy. oauth-based strategies and
      // certain others redirect here to complete the login handshake
      addCallbackRoute(spec) {
        self.apos.app.get(self.getCallbackUrl(spec, false),
          // middleware
          self.apos.login.passport.authenticate(
            spec.name,
            {
              ...spec.authenticate,
              failureRedirect: self.getFailureUrl(spec)
            }
          ),
          // The actual route reached after authentication redirects
          // appropriately, either to an explicitly requested location
          // or the home page
          (req, res) => {
            const redirect = req.session.passportRedirect || '/';
            delete req.session.passportRedirect;
            return res.rawRedirect(redirect);
          }
        );
      },

      addFailureRoute(spec) {
        self.apos.app.get(self.getFailureUrl(spec), function (req, res) {
          // Gets i18n'd in the template
          return self.sendPage(req, 'error', {
            spec,
            message: 'aposPassportBridge:rejected'
          });
        });
      },

      getFailureUrl(spec) {
        return '/auth/' + spec.name + '/error';
      },

      // Given a strategy spec from the configuration, return
      // an oauth passport callback function to find the user based
      // on the profile, creating them if appropriate.

      findOrCreateUser(spec) {
        return body;
        async function body(req, accessToken, refreshToken, profile, callback) {
          if (req !== null && !req?.res) {
            // req was not passed (strategy used does not support that), shift
            // parameters by one so they come in under the right names
            return body(null, req, accessToken, refreshToken, profile);
          }
          // Always use an admin req to find the user
          const adminReq = self.apos.task.getReq();
          let criteria = {};

          if (spec.accept) {
            if (!spec.accept(profile)) {
              self.logDebug('rejectedProfile', {
                strategyName: spec.name,
                profile
              });
              return callback(null, false);
            }
          }

          const connectingUserId = req && await self.getConnectingUserId(req, spec.name);
          if (connectingUserId) {
            criteria._id = connectingUserId;
          } else {
            const emails = self.getRelevantEmailsFromProfile(spec, profile);
            if (spec.emailDomain && (!emails.length)) {
              // Email domain filter is in effect and user has no emails or
              // only emails in the wrong domain
              self.logDebug('noPermittedEmailAddress', {
                strategyName: spec.name,
                requiredEmailDomain: spec.emailDomain,
                profile
              });
              return callback(null, false);
            }
            if (typeof (spec.match) === 'function') {
              criteria = spec.match(profile);
            } else {
              switch (spec.match || 'username') {
                case 'id':
                  if (!profile.id) {
                    self.apos.util.error('@apostrophecms/passport-bridge: profile has no id. You probably want to set the "match" option for this strategy to "username" or "email".');
                    return callback(null, false);
                  }
                  criteria[spec.name + 'Id'] = profile.id;
                  break;
                case 'username':
                  if (!profile.username) {
                    self.apos.util.error('@apostrophecms/passport-bridge: profile has no username. You probably want to set the "match" option for this strategy to "id" or "email".');
                    return callback(null, false);
                  }
                  criteria.username = self.apos.login.normalizeLoginName(
                    profile.username
                  );
                  break;
                case 'email':
                case 'emails':
                  if (!emails.length) {
                    // User has no email
                    self.logDebug('noEmailAndEmailIsId', {
                      strategyName: spec.name,
                      profile
                    });
                    return callback(null, false);
                  }
                  criteria.$or = emails.map(email => {
                    return {
                      email: self.apos.login.normalizeLoginName(email)
                    };
                  });
                  break;
                default:
                  return callback(new Error(`@apostrophecms/passport-bridge: ${spec.match} is not a supported value for the match property`));
              }
            }
          }
          criteria.disabled = { $ne: true };
          if ((!connectingUserId) && (spec.login === false)) {
            // Some strategies are only for connecting, not logging in
            self.logDebug('strategyNotForLogin', {
              strategyName: spec.name,
              profile
            });
            return callback(null, false);
          }
          try {
            let user;
            const foundUser = await self.apos.user.find(adminReq, criteria).toObject();
            if (foundUser) {
              self.logDebug('userFound', {
                strategyName: spec.name,
                profile,
                foundUser
              });
              user = foundUser;
            }
            if (!foundUser && self.options.create && !connectingUserId) {
              const createdUser = await self.createUser(spec, profile);
              self.logDebug('userCreated', {
                strategyName: spec.name,
                profile,
                createdUser
              });
              user = createdUser;
            }
            // Legacy, incompatible with Passport 0.6
            if (self.options.retainAccessTokenInSession && user && req) {
              req.session.accessToken = accessToken;
              req.session.refreshToken = refreshToken;
            }
            // Preferred, see documentation
            if (self.options.retainAccessToken && user) {
              await self.apos.user.safe.updateOne({
                _id: user._id
              }, {
                $set: {
                  [`tokens.${spec.name}.accessToken`]: accessToken,
                  [`tokens.${spec.name}.refreshToken`]: refreshToken
                }
              });
            }
            if (user) {
              await self.apos.doc.db.updateOne({
                _id: user._id
              }, {
                $set: {
                  [`${spec.name}Id`]: profile.id
                }
              });
            }
            if (!user) {
              self.logDebug('noUserFound', {
                strategyName: spec.name,
                profile
              });
            } else {
              self.logDebug('findOrCreateUserSuccessful', {
                strategyName: spec.name,
                profile,
                user
              });
            }
            return callback(null, user || false);
          } catch (err) {
            self.apos.util.error(err);
            return callback(err);
          }
        };
      },

      async getConnectingUserId(req, strategyName) {
        const info = await self.getConnectingInfo(req);
        if (strategyName && info?.strategyName !== strategyName) {
          return false;
        }
        return info && info._id;
      },

      async getConnectingSession(req, strategyName) {
        const info = await self.getConnectingInfo(req);
        if (strategyName && info?.strategyName !== strategyName) {
          return false;
        }
        return info && info.session;
      },

      async getConnectingInfo(req) {
        const cookie = req.cookies['apos-connect'];
        if (!cookie) {
          return null;
        }
        const [ strategyName, nonce ] = cookie.split(':');
        if (!(strategyName && nonce)) {
          return null;
        }
        const safe = await self.apos.user.safe.findOne({
          [`connectionRequests.${strategyName}.nonce`]: nonce
        });
        if (!safe) {
          return null;
        }
        if (safe.connectionRequests[strategyName].expiresAt < Date.now()) {
          return null;
        }
        return {
          _id: safe._id,
          session: safe.connectionRequests[strategyName].session,
          strategyName
        };
      },

      // Returns an array of email addresses found in the user's
      // profile, via profile.emails[n].value, profile.emails[n] (a string),
      // or profile.email. Passport strategies usually normalize
      // to the first of the three.
      getRelevantEmailsFromProfile(spec, profile) {
        let emails = [];
        if (Array.isArray(profile.emails) && profile.emails.length) {
          (profile.emails || []).forEach(email => {
            if (typeof (email) === 'string') {
              // maybe someone does this as simple strings...
              emails.push(email);
              // but google does it as objects with value properties
            } else if (email && email.value) {
              emails.push(email.value);
            }
          });
        } else if (profile.email) {
          emails.push(profile.email);
        }
        if (spec.emailDomain) {
          emails = emails.filter(email => {
            const endsWith = '@' + spec.emailDomain;
            return email.substr(email.length - endsWith.length) === endsWith;
          });
        }
        return emails;
      },

      // Create a new user based on a profile. This occurs only
      // if the "create" option is set and a user arrives who has
      // a valid passport profile but does not exist in the local database.
      async createUser(spec, profile) {
        const user = self.apos.user.newInstance();
        user.role = await self.userRole();
        user.username = self.apos.login.normalizeLoginName(profile.username);
        user[spec.name + 'Id'] = profile.id;
        const [ email ] = self.getRelevantEmailsFromProfile(spec, profile);
        if (email) {
          user.email = self.apos.login.normalizeLoginName(email);
        }
        // Try hard to come up with a title, as without a slug we'll get an error
        // at insert time
        user.title = profile.displayName || profile.username || email || '';
        user.username = user.username || user.email || self.apos.util.slugify(user.title);
        if (profile.name) {
          user.firstName = profile.name.givenName;
          if (profile.name.middleName) {
            user.firstName += ' ' + profile.name.middleName;
          }
          user.lastName = profile.name.familyName;
        } else if (profile.firstName || profile.lastName) {
          user.firstName = profile.firstName;
          user.lastName = profile.lastName;
        } else if (profile.displayName) {
          const parsedName = humanname.parse(profile.displayName);
          user.firstName = parsedName.firstName;
          user.lastName = parsedName.lastName;
        }
        const req = self.apos.task.getReq();
        if (spec.import) {
          // Allow for specialized import of more fields
          spec.import(profile, user);
        }
        await self.apos.user.insert(req, user);
        return user;
      },

      // Overridable method for determining the default role
      // of newly created users.
      async userRole() {
        return (self.options.create && self.options.create.role) || 'guest';
      }
    };
  },
  handlers(self) {
    return {
      '@apostrophecms/login:afterSessionLogin': {
        async restoreConnectionSession(req) {
          const session = await self.getConnectingSession(req);
          if (session) {
            for (const [ key, value ] of Object.entries(session)) {
              req.session[key] = value;
            }
          }
          req.res.clearCookie('apos-connect');
        },
        async redirectToNewLocale(req) {
          if (!req.session.passportLocale) {
            return;
          }
          const i18n = self.apos.i18n;
          const {
            oldLocale,
            newLocale,
            oldAposDocId
          } = req.session.passportLocale;
          delete req.session.passportLocale;
          const crossDomainSessionToken = self.apos.util.generateId();
          await self.apos.cache.set('@apostrophecms/i18n:cross-domain-sessions', crossDomainSessionToken, req.session, 60 * 60);
          let doc = await self.apos.doc.find(req, {
            aposDocId: oldAposDocId
          }).locale(`${oldLocale}:draft`).relationships(false).areas(false).toObject();
          if (doc && doc.aposDocId) {
            doc = await self.apos.doc.find(req, {
              aposDocId: doc.aposDocId
            }).locale(`${newLocale}:draft`).toObject();
          }
          let route;
          if (doc) {
            const action = self.apos.page.isPage(doc)
              ? self.apos.page.action
              : self.apos.doc.getManager(doc).action;
            route = `${action}/${doc._id}/locale/${newLocale}`;
          } else {
            // Fall back to home page, with appropriate prefix
            route = '/';
            if (i18n.locales[newLocale] && i18n.locales[newLocale].prefix) {
              route = i18n.locales[newLocale].prefix + '/';
            }
          }

          let url = self.apos.url.build(route, {
            aposLocale: req.oldLocale,
            aposCrossDomainSessionToken: crossDomainSessionToken
          });

          if (i18n.locales[newLocale] && i18n.locales[newLocale].hostname) {
            const oldLocale = req.locale;
            // Force use of correct hostname for new locale
            req.locale = newLocale;
            url = self.apos.page.getBaseUrl(req) + url;
            req.locale = oldLocale;
          }
          req.session.passportRedirect = url;
        }
      },
      'apostrophe:modulesRegistered': {
        addRoutes() {
          Object.values(self.specs).forEach(spec => {
            self.addLoginRoute(spec);
            self.addCallbackRoute(spec);
            self.addFailureRoute(spec);
            self.addConnectRoute(spec);
          });
        }
      }
    };
  },
  tasks(self) {
    return {
      listUrls: {
        usage: 'Run this task to list the login URLs for each registered strategy.\n' +
        'This is helpful when writing markup to invite users to log in.',
        task: () => {
          const specs = Object.values(self.specs);
          // eslint-disable-next-line no-console
          console.log('These are the login URLs you may wish to link users to:\n');
          specs.forEach(spec => {
            // eslint-disable-next-line no-console
            console.log(`${spec.label}: ${self.getLoginUrl(spec, true)}`);
          });
          // eslint-disable-next-line no-console
          console.log('\nThese are the callback URLs you may need to configure on sites:\n');
          specs.forEach(spec => {
            // eslint-disable-next-line no-console
            console.log(`${spec.label}: ${self.getCallbackUrl(spec, true)}`);
          });
        }
      }
    };
  },
  components(self) {
    return {
      loginLinks(req, data) {
        return {
          links: Object.values(self.specs).map(spec => {
            let href = self.getLoginUrl(spec, true);
            if (Object.keys(self.apos.i18n.locales).length > 1) {
              const context = req.data.piece || req.data.page;
              href = self.apos.url.build(href, {
                oldLocale: req.locale,
                newLocale: req.locale.replace(':draft', ':published'),
                oldAposDocId: (context && context.aposDocId)
              });
            }
            return {
              name: spec.name,
              label: spec.label,
              href
            };
          })
        };
      }
    };
  }
};

function getBundleModuleNames() {
  const source = path.join(__dirname, './modules/@apostrophecms');
  return fs
    .readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => `@apostrophecms/${dirent.name}`);
}
