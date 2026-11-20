// The protocol layer: the MCP SDK's handler mounted on the module's route.
//
// The SDK does the protocol: the envelope, version negotiation,
// `server/discover`, the headers, and serving 2025-era clients statelessly
// from the same endpoint. This file fits it into Apostrophe's request
// pipeline:
//
// - Body: Apostrophe's JSON body parser has already read the stream by the
//   time the route runs, so the parsed body is handed to the SDK.
// - CSRF: the route is exempt (see the `ownRoute` middleware in index.js).
// - Origin: the SDK's handler does not check it; the route does, before the
//   SDK sees the request.
// - Identity: the bearer token alone, checked by the route (lib/auth.js).
// - The Apostrophe `req`: the SDK builds a server per request from a factory
//   that only sees a web-standard `Request` and the request's `authInfo`.
//   The adapter passes `req.auth` through as `authInfo`, so the route sets it
//   once the token checks out, with the `req` in its `extra` field.

const { createMcpHandler, McpServer } = require('@modelcontextprotocol/server');
const { toNodeHandler, originValidation } = require('@modelcontextprotocol/node');
const { version } = require('../../../../package.json');

const LOCALHOST = [ 'localhost', '127.0.0.1', '[::1]' ];

module.exports = (self) => {
  return {
    enableHttp() {
      self.validateOrigin = originValidation(self.getAllowedOrigins());
      const onerror = (error) => self.logError('mcp-error', error.message, {
        stack: error.stack
      });
      self.httpHandler = toNodeHandler(
        createMcpHandler(({ authInfo }) => self.createServer(authInfo.extra.req), {
          onerror
        }),
        { onerror }
      );
    },

    async handleHttp(req, res) {
      // The route is declared before the tool registry activates
      if (!self.apos.ai.toolsActive) {
        return res.status(404).send({ name: 'notfound' });
      }
      // Each answers the request itself on a refusal (403, 401)
      if (!self.validateOrigin(req, res) || !await self.authenticate(req, res)) {
        return;
      }
      // `_body` is body-parser's flag that it read and parsed the stream. With
      // no JSON content type it didn't, and the SDK reads the stream itself
      const parsedBody = req._body ? req.body : undefined;
      return self.httpHandler(req, res, parsedBody);
    },

    // Whether `req` is for the route. Express matches it with or without a
    // trailing slash
    isRoute(req) {
      return req.path.replace(/\/$/, '') === self.action;
    },

    // One server per request, as the SDK's handler asks. Named for the site,
    // so that a client connected to several sites can tell them apart
    createServer(req) {
      const server = new McpServer({
        name: self.apos.shortName,
        title: self.options.title || self.apos.shortName,
        version
      }, {
        instructions: self.apos.harness.getInstructions(req),
        // The list depends on the user's locale (titles), so no shared
        // caches
        cacheHints: { 'tools/list': { cacheScope: 'private' } }
      });
      self.registerTools(server, req);
      return server;
    },

    // Hostnames, port-agnostic, as the SDK's origin guard takes them
    getAllowedOrigins() {
      if (self.options.allowedOrigins) {
        return self.options.allowedOrigins;
      }
      if (self.apos.baseUrl) {
        return [ new URL(self.apos.baseUrl).hostname ];
      }
      return LOCALHOST;
    }
  };
};
