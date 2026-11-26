// This module provides the site's OAuth 2.1 authorization
// server: an outside tool (an AI client such as Claude or ChatGPT) asks the
// user's approval here, then acts as that user with the tokens it issues.
//
// It has no alias (new core modules can't add one): reach it as
// `apos.modules['@apostrophecms/oauth']`.
//
// It's site-wide, not part of any one feature. A module that accepts its
// tokens is a "protected resource" (RFC 9728): it registers its route with
// `addResource`, and answers a request that has no valid token with
// `challenge`, which points the client at the resource's metadata and from
// there at this server. The MCP server is the first such module. Resources
// only check tokens; only this module issues them.
//
// Off unless a resource registers, or `enabled: true` is set. `enabled:
// false` keeps it off even then: `addResource` is ignored, and resources
// fall back to whatever else they accept. While it's on, the site's
// `baseUrl` is required, since the issuer must be one stable URL.
//
// It serves the two metadata documents, registers clients (see
// lib/clients.js), asks the user's approval at the authorize endpoint (see
// lib/authorize.js), and issues and revokes tokens (see lib/tokens.js).
// Resources check a token with `verifyAccessToken`. Users see and end their
// connections through the connections API (see lib/connections.js).

const bodyParser = require('body-parser');

// Client metadata, the approval form and token requests are small. The site's own limits
// are far larger, and the register endpoint is open to anyone
const BODY_LIMIT = '16kb';

module.exports = {
  options: {
    // enabled: true turns the server on with no resource registered,
    //   false keeps it off. Unset, it's on once a resource registers.
    //
    // false for hosts that allow no outbound requests: clients then
    // register with DCR (see lib/cimd.js)
    clientMetadataDocuments: true,
    // In seconds. How long an access token lasts. The tool gets a new one
    // without asking the user, so this only limits how long a token that
    // leaked unnoticed can be used. Keep it short
    accessTokenLifetime: 60 * 60,
    // In seconds. How long a connection lasts from the moment the user
    // approves it, however often the tool is used. After that the user must
    // approve again. This is the refresh token's lifetime
    connectionLifetime: 30 * 24 * 60 * 60
  },
  init(self) {
    self.validateOptions();
    // Path (site-relative, without the prefix) to the resource's options
    self.resources = new Map();
  },
  handlers(self) {
    return {
      'apostrophe:modulesRegistered': {
        // Every module's init has run, so every resource has registered
        async validateSite() {
          self.validateBaseUrl();
          self.validatePrefix();
          if (self.isEnabled()) {
            self.addConnectionsMenu();
            await self.ensureClientsCollection();
            await self.ensureAuthorizeCollections();
            await self.ensureTokensCollection();
            await self.ensureConnectionsCollection();
          }
        }
      },
      '@apostrophecms/user:afterDelete': {
        // Their tokens stop working anyway, since the user is gone. This
        // clears them, and the user's connections, without waiting for
        // them to expire
        async removeDeletedUserConnections(req, doc) {
          if (self.isEnabled()) {
            await self.removeUserConnections(doc._id);
          }
        }
      }
    };
  },
  middleware(self) {
    if (self.options.enabled === false) {
      return {};
    }
    return {
      // Before the express module's middleware, so that for the endpoints
      // posted to:
      //
      // - Apostrophe's CSRF check is skipped. The register endpoint takes no
      //   identity from a session, so there is nothing for a cross-site
      //   request to borrow. The approval form does, and is protected by its
      //   own token instead (see lib/authorize.js): a plain form post can't
      //   send the header Apostrophe's check wants. The token and revoke
      //   endpoints take no session either: a client proves itself with the
      //   code or the token it sends.
      // - The body is parsed with a small limit first. The express module's
      //   parsers then leave it alone.
      ownEndpoints: {
        before: '@apostrophecms/express',
        middleware(req, res, next) {
          if (req.method !== 'POST') {
            return next();
          }
          if (req.path === self.getEndpointPath('register')) {
            req.csrfExempt = true;
            return self.jsonBodyParser(req, res, (err) => {
              if (err) {
                return self.sendOauthError(req, res, self.oauthError(
                  'invalid_client_metadata',
                  (err.type === 'entity.too.large')
                    ? `The client metadata is larger than ${BODY_LIMIT}.`
                    : 'The client metadata is not valid JSON.',
                  err.status || 400
                ));
              }
              return next();
            });
          }
          if (
            (req.path === self.getEndpointPath('token')) ||
            (req.path === self.getEndpointPath('revoke'))
          ) {
            req.csrfExempt = true;
            return self.formBodyParser(req, res, (err) => {
              if (err) {
                return self.sendOauthError(req, res, self.oauthError(
                  'invalid_request',
                  (err.type === 'entity.too.large')
                    ? `The request is larger than ${BODY_LIMIT}.`
                    : 'The request body is not valid.',
                  err.status || 400
                ));
              }
              return next();
            });
          }
          if (req.path === self.getEndpointPath('authorize')) {
            req.csrfExempt = true;
            return self.formBodyParser(req, res, (err) => {
              if (err) {
                // The route shows the error page, which needs the
                // middleware that comes after this. The body counts as
                // parsed already, so the express module's parser skips it
                req.body = {};
                req.oauthFormError = err;
              }
              return next();
            });
          }
          return next();
        }
      }
    };
  },
  routes(self) {
    if (self.options.enabled === false) {
      return {};
    }
    // Resources register during other modules' init, which may come after
    // this module's routes are compiled, so the routes exist whenever the
    // server could be on and answer 404 while it's off
    return {
      get: {
        '/.well-known/oauth-authorization-server': self.whenEnabled(
          (req, res) => self.sendMetadata(res, self.getAuthorizationServerMetadata())
        ),
        // RFC 9728: the resource's path follows the well-known name
        '/.well-known/oauth-protected-resource/*': self.whenEnabled((req, res) => {
          const metadata = self.getResourceMetadata(`/${req.params[0]}`);
          if (!metadata) {
            return res.status(404).send({ name: 'notfound' });
          }
          return self.sendMetadata(res, metadata);
        }),
        authorize: self.whenEnabled(self.withPageErrors(self.authorize))
      },
      // The CORS preflight a browser-based client (MCP Inspector, say) sends
      // before reading the metadata
      options: {
        '/.well-known/oauth-authorization-server': self.whenEnabled(self.sendPreflight),
        '/.well-known/oauth-protected-resource/*': self.whenEnabled(self.sendPreflight)
      },
      // The endpoints are under /api/v1, where the express module's CORS
      // middleware already lets any origin call them and answers preflights
      post: {
        // DCR (RFC 7591)
        register: self.whenEnabled(async (req, res) => {
          try {
            const registration = await self.registerClient(req.body);
            self.logInfo(req, 'client-registered', {
              clientId: registration.client_id,
              clientName: registration.client_name,
              redirectUris: registration.redirect_uris
            });
            res.set('Cache-Control', 'no-store');
            return res.status(201).send(registration);
          } catch (e) {
            return self.sendOauthError(req, res, e);
          }
        }),
        // The approval page's form
        authorize: self.whenEnabled(self.withPageErrors(self.decide)),
        token: self.whenEnabled(self.withOauthErrors(self.token)),
        // RFC 7009
        revoke: self.whenEnabled(self.withOauthErrors(self.revoke))
      }
    };
  },
  apiRoutes(self) {
    if (self.options.enabled === false) {
      return {};
    }
    // The logged-in user's own connections, for their personal settings.
    // Ordinary API routes: a session and Apostrophe's CSRF check
    return {
      get: {
        async connections(req) {
          self.checkConnectionsRequest(req);
          return {
            connections: await self.getConnections(req.user._id)
          };
        }
      },
      delete: {
        async 'connections/:id'(req) {
          self.checkConnectionsRequest(req);
          // Another user's connection is "not found" too, so that nothing
          // is learned from trying
          if (!await self.disconnect(req, self.apos.launder.string(req.params.id))) {
            throw self.apos.error('notfound');
          }
          return {};
        }
      }
    };
  },
  methods(self) {
    return {
      ...require('./lib/metadata')(self),
      ...require('./lib/resources')(self),
      ...require('./lib/clients')(self),
      ...require('./lib/cimd')(self),
      ...require('./lib/authorize')(self),
      ...require('./lib/tokens')(self),
      ...require('./lib/connections')(self),

      validateOptions() {
        const { enabled, clientMetadataDocuments } = self.options;
        if ((enabled != null) && (typeof enabled !== 'boolean')) {
          throw new Error('The "@apostrophecms/oauth" module\'s enabled option must be a boolean.');
        }
        if (typeof clientMetadataDocuments !== 'boolean') {
          throw new Error('The "@apostrophecms/oauth" module\'s clientMetadataDocuments option must be a boolean.');
        }
        for (const name of [ 'accessTokenLifetime', 'connectionLifetime' ]) {
          const value = self.options[name];
          if (!Number.isInteger(value) || (value <= 0)) {
            throw new Error(`The "@apostrophecms/oauth" module's ${name} option must be a whole number of seconds, greater than 0.`);
          }
        }
        if (self.options.accessTokenLifetime > self.options.connectionLifetime) {
          throw new Error(
            'The "@apostrophecms/oauth" module\'s accessTokenLifetime option must not be longer ' +
            'than its connectionLifetime option.'
          );
        }
        self.jsonBodyParser = bodyParser.json({
          limit: BODY_LIMIT,
          // Any content type: a client may leave out the header
          type: () => true
        });
        self.formBodyParser = bodyParser.urlencoded({
          limit: BODY_LIMIT,
          extended: false
        });
      },

      // An error for a client, in the form RFC 6749 section 5.2 and RFC 7591
      // section 3.2.2 give: `{ error, error_description }`
      oauthError(error, description, status = 400) {
        const e = new Error(description);
        e.oauth = {
          error,
          error_description: description
        };
        e.status = status;
        return e;
      },

      sendOauthError(req, res, e) {
        res.set('Cache-Control', 'no-store');
        if (!e.oauth) {
          self.logError(req, 'oauth-error', e.message, { stack: e.stack });
          return res.status(500).send({ error: 'server_error' });
        }
        return res.status(e.status).send(e.oauth);
      },

      validateBaseUrl() {
        if (!self.isEnabled() || self.apos.baseUrl) {
          return;
        }
        throw new Error(
          `OAuth is on because ${self.getEnabledReason()}. It needs the site's baseUrl: set ` +
          'the top-level baseUrl option in app.js, or APOS_BASE_URL. To turn OAuth off ' +
          'instead, set enabled: false on the "@apostrophecms/oauth" module.'
        );
      },

      // Not supported yet: clients look for the metadata at the host's root
      // (`/.well-known/...`, RFC 8414 and 9728), outside the prefix, where a
      // proxy in front of a prefixed site may never send them
      validatePrefix() {
        if (!self.isEnabled() || !self.apos.prefix) {
          return;
        }
        throw new Error(
          `OAuth is on because ${self.getEnabledReason()}, but it doesn't support a site ` +
          `with a prefix ("${self.apos.prefix}") yet. To turn OAuth off, set enabled: false ` +
          'on the "@apostrophecms/oauth" module.'
        );
      },

      // For error messages: why the server is on
      getEnabledReason() {
        return self.options.enabled
          ? 'its enabled option is true'
          : `these routes accept its tokens: ${[ ...self.resources.keys() ].join(', ')}`;
      },

      isEnabled() {
        if (self.options.enabled != null) {
          return self.options.enabled;
        }
        return self.resources.size > 0;
      },

      // Wraps a route that answers with a page: an unexpected error is
      // logged, and the user sees the error page
      withPageErrors(route) {
        return async (req, res) => {
          try {
            return await route(req, res);
          } catch (e) {
            self.logError(req, 'oauth-page-error', e.message, { stack: e.stack });
            return self.sendErrorPage(req, res, 500, {
              reason: req.t('apostrophe:oauthServerError'),
              advice: 'site',
              // Unexpected, so it can't be promised
              nothingShared: false
            });
          }
        };
      },

      // "Connected tools" in the user's own menu, beside Log Out, where they
      // see and end their connections. Not in the Settings modal, which
      // exists only on projects that configure it and edits user fields
      addConnectionsMenu() {
        self.apos.adminBar.add(
          `${self.__meta.name}:connections`,
          'apostrophe:oauthConnections',
          false,
          { user: true }
        );
        self.apos.modal.add(
          `${self.__meta.name}:connections`,
          self.getComponentName('connectionsModal', 'AposOauthConnections'),
          // The module sends no browser data, so the API's path comes here
          { action: `${self.action}/connections` }
        );
      },

      // For the connections API: only while the server is on, and only
      // for a logged-in user, who sees their own connections only
      checkConnectionsRequest(req) {
        if (!self.isEnabled()) {
          throw self.apos.error('notfound');
        }
        if (!req.user) {
          throw self.apos.error('forbidden');
        }
      },

      // Wraps a route that answers a client with JSON: an error goes back
      // as `{ error, error_description }`
      withOauthErrors(route) {
        return async (req, res) => {
          try {
            return await route(req, res);
          } catch (e) {
            return self.sendOauthError(req, res, e);
          }
        };
      },

      // A value from the request, for a log entry: a string is cut to a
      // length a URL may have, so a request can't fill the log
      clipForLog(value) {
        return (typeof value === 'string') ? value.slice(0, 2000) : value;
      },

      // Wraps a route so it answers 404 while the server is off
      whenEnabled(route) {
        return (req, res) => {
          if (!self.isEnabled()) {
            return res.status(404).send({ name: 'notfound' });
          }
          return route(req, res);
        };
      }
    };
  }
};
