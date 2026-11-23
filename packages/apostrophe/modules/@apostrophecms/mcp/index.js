// This module provides `apos.mcp`, the site's MCP server: an outside AI
// tool (Claude, ChatGPT, an IDE) connects to it and works on the site's
// content with the harness's tools, through the `mcp` door. The outside tool
// brings its own model; this module never calls Apostrophe's AI.
//
// Off by default. Unless `enabled` is set it adds no routes. It serves one
// HTTP route, `self.action`, for both the current MCP spec (2026-07-28) and
// 2025-era clients, on the official TypeScript SDK.

module.exports = {
  options: {
    alias: 'mcp',
    enabled: false,
    // Seconds an MCP write's change log entries are kept; 0 keeps them for
    // good. 60 days by default (see lib/retention.js)
    changeLogExpireAfter: 60 * 24 * 60 * 60
    // allowedOrigins: the hostnames a browser-sent `Origin` header may name.
    //   Requests with no `Origin` (every non-browser client) always pass.
    //   Defaults to the hostname of `baseUrl`, or localhost when unset.
    // title: the server's display name in MCP clients. Defaults to the
    //   site's `shortName`, which is always the server's `name`.
  },
  init(self) {
    self.validateOptions();
    if (!self.options.enabled) {
      return;
    }
    self.devToken = self.getDevToken();
    self.enableHttp();
  },
  middleware(self) {
    if (!self.options.enabled) {
      return {};
    }
    return {
      // Before the express module's middleware, so that for the route:
      //
      // - Its bearer token check is skipped. It would refuse the route's
      //   tokens as unknown login tokens (see lib/auth.js).
      // - Its CSRF check is skipped. MCP clients send no cookies, so the
      //   cookie-based check would refuse every POST. The route's only
      //   identity is the `Authorization` header, which a browser never sends
      //   by itself, and it drops any session or cookie identity, so there is
      //   nothing for a cross-site request to borrow.
      //
      // `isRoute` decides both, as it does routing: with or without a query
      // string or a trailing slash, and nothing below the route's path.
      ownRoute: {
        before: '@apostrophecms/express',
        middleware(req, res, next) {
          if (self.isRoute(req)) {
            req.aposMcpBearerToken = true;
            req.csrfExempt = true;
          }
          return next();
        }
      }
    };
  },
  handlers(self) {
    if (!self.options.enabled) {
      return {};
    }
    return {
      'apostrophe:ready': {
        startSweeps() {
          self.startSweeps();
        }
      },
      'apostrophe:destroy': {
        stopSweeps() {
          self.stopSweeps();
        }
      }
    };
  },
  tasks(self) {
    return {
      // Also on a site with the server off, for the entries it left
      'expire-changes': {
        usage: 'Delete the MCP change log entries past changeLogExpireAfter, as the ' +
          'in-process sweep does.\n' +
          'Usage: node app @apostrophecms/mcp:expire-changes',
        async task() {
          const deleted = await self.expireChanges();
          // eslint-disable-next-line no-console
          console.log((deleted === null)
            ? 'Another process is sweeping; nothing done.'
            : `${deleted} change log entries deleted.`);
        }
      }
    };
  },
  routes(self) {
    if (!self.options.enabled) {
      return {};
    }
    // The 2025-era session operations (GET, DELETE) reach the SDK too, which
    // answers them itself
    const handler = (req, res) => self.handleHttp(req, res);
    return {
      post: { [self.action]: handler },
      get: { [self.action]: handler },
      delete: { [self.action]: handler }
    };
  },
  methods(self) {
    return {
      ...require('./lib/http')(self),
      ...require('./lib/auth')(self),
      ...require('./lib/tools')(self),
      ...require('./lib/retention')(self),

      validateOptions() {
        const {
          enabled, allowedOrigins, title, changeLogExpireAfter
        } = self.options;
        if (typeof enabled !== 'boolean') {
          throw new Error('The "@apostrophecms/mcp" module\'s enabled option must be a boolean.');
        }
        if (!(Number.isFinite(changeLogExpireAfter) && (changeLogExpireAfter >= 0))) {
          throw new Error('The "@apostrophecms/mcp" module\'s changeLogExpireAfter option must be a number of seconds, 0 or more.');
        }
        if ((allowedOrigins != null) && !(
          Array.isArray(allowedOrigins) &&
          allowedOrigins.every(name => (typeof name === 'string') && name.length)
        )) {
          throw new Error('The "@apostrophecms/mcp" module\'s allowedOrigins option must be an array of hostnames.');
        }
        if ((title != null) && !((typeof title === 'string') && title.length)) {
          throw new Error('The "@apostrophecms/mcp" module\'s title option must be a non-empty string.');
        }
      }
    };
  }
};
