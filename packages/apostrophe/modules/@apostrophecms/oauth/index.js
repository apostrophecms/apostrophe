// This module provides `apos.oauth`, the site's OAuth 2.1 authorization
// server: an outside tool (an AI client such as Claude or ChatGPT) asks the
// user's approval here, then acts as that user with the tokens it issues.
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
// So far it serves the two metadata documents (S1), registers clients (S2,
// see lib/clients.js), and asks the user's approval at the authorize
// endpoint (S3, see lib/authorize.js). The token and revoke endpoints come
// in later slices (PRO-10455).

const bodyParser = require('body-parser');

// Client metadata and the approval form are small. The site's own limits
// are far larger, and the register endpoint is open to anyone
const BODY_LIMIT = '16kb';

module.exports = {
  options: {
    alias: 'oauth',
    // enabled: true turns the server on with no resource registered,
    //   false keeps it off. Unset, it's on once a resource registers.
    //
    // false for hosts that allow no outbound requests: clients then
    // register with DCR (see lib/cimd.js)
    clientMetadataDocuments: true
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
            await self.ensureClientsCollection();
            await self.ensureAuthorizeCollections();
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
      //   send the header Apostrophe's check wants.
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
                return self.sendOauthError(res, self.oauthError(
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
          if (req.path === self.getEndpointPath('authorize')) {
            req.csrfExempt = true;
            return self.formBodyParser(req, res, (err) => {
              if (err) {
                return res.status(err.status || 400).send({ name: 'invalid' });
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
            res.set('Cache-Control', 'no-store');
            return res.status(201).send(registration);
          } catch (e) {
            return self.sendOauthError(res, e);
          }
        }),
        // The approval page's form
        authorize: self.whenEnabled(self.withPageErrors(self.decide))
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

      validateOptions() {
        const { enabled, clientMetadataDocuments } = self.options;
        if ((enabled != null) && (typeof enabled !== 'boolean')) {
          throw new Error('The "@apostrophecms/oauth" module\'s enabled option must be a boolean.');
        }
        if (typeof clientMetadataDocuments !== 'boolean') {
          throw new Error('The "@apostrophecms/oauth" module\'s clientMetadataDocuments option must be a boolean.');
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

      sendOauthError(res, e) {
        res.set('Cache-Control', 'no-store');
        if (!e.oauth) {
          self.logError('oauth-error', e.message, { stack: e.stack });
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
      // logged, and the user sees a plain error page
      withPageErrors(route) {
        return async (req, res) => {
          try {
            return await route(req, res);
          } catch (e) {
            self.logError('oauth-page-error', e.message, { stack: e.stack });
            return self.sendAuthorizePage(req, res, 500, {
              error: req.t('apostrophe:oauthServerError')
            });
          }
        };
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
