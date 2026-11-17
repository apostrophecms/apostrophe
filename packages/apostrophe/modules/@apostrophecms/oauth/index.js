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
// So far (S1) it serves the two metadata documents. The endpoints they name
// (authorize, token, register, revoke) come in later slices (PRO-10455).

module.exports = {
  options: {
    alias: 'oauth'
    // enabled: true turns the server on with no resource registered,
    //   false keeps it off. Unset, it's on once a resource registers.
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
        validateSite() {
          self.validateBaseUrl();
          self.validatePrefix();
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
        })
      },
      // The CORS preflight a browser-based client (MCP Inspector, say) sends
      // before reading the metadata
      options: {
        '/.well-known/oauth-authorization-server': self.whenEnabled(self.sendPreflight),
        '/.well-known/oauth-protected-resource/*': self.whenEnabled(self.sendPreflight)
      }
    };
  },
  methods(self) {
    return {
      ...require('./lib/metadata')(self),
      ...require('./lib/resources')(self),

      validateOptions() {
        const { enabled } = self.options;
        if ((enabled != null) && (typeof enabled !== 'boolean')) {
          throw new Error('The "@apostrophecms/oauth" module\'s enabled option must be a boolean.');
        }
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
