// Who an MCP request acts as. The bearer token is the only identity the
// route takes: the session cookie and API keys Apostrophe's own middleware
// may have read are dropped, so the CSRF exemption lends a cross-site request
// nothing.
//
// The route's tokens are not Apostrophe login tokens, so the express
// module's bearer token check skips this route (`req.aposMcpBearerToken`)
// and the route checks the token here.
//
// The token is read from the `Authorization` header only, never from
// `req.token`: express-bearer-token also takes it from the query string and
// the body, and from a cookie when a site configures one. The MCP spec
// forbids tokens in the query string, and a cookie is a credential the
// browser sends by itself, which the CSRF exemption must not lend anything
// to.
//
// The token is an access token of `@apostrophecms/oauth`, issued for this
// route. Outside production, the development token
// `APOS_MCP_DEV_TOKEN=<token>:<username>` works too. A request with no
// token, or any other token, gets the OAuth server's 401, which points the
// tool at the route's metadata and from there at the server.

const crypto = require('node:crypto');

const DEV_TOKEN_MIN_LENGTH = 16;

module.exports = (self) => {
  return {
    // Reads `APOS_MCP_DEV_TOKEN` once at startup: `{ token, username }`, or
    // null when it is unset or ignored
    getDevToken() {
      const value = process.env.APOS_MCP_DEV_TOKEN;
      if (!value) {
        return null;
      }
      if (process.env.NODE_ENV === 'production') {
        self.logWarn('mcp-dev-token-ignored', 'APOS_MCP_DEV_TOKEN is set but ignored in production.');
        return null;
      }
      const at = value.indexOf(':');
      const token = (at === -1) ? '' : value.slice(0, at);
      const username = (at === -1) ? '' : value.slice(at + 1);
      if ((token.length < DEV_TOKEN_MIN_LENGTH) || !username) {
        throw new Error(`APOS_MCP_DEV_TOKEN must be "<token>:<username>", with a token of at least ${DEV_TOKEN_MIN_LENGTH} characters.`);
      }
      self.logWarn('mcp-dev-token', `APOS_MCP_DEV_TOKEN is set: MCP requests carrying it act as "${username}". For development only.`);
      return {
        token,
        username
      };
    },

    // Sets `req.user` from the bearer token alone,
    // `req.aposMcpConnection`, the connection whose `seen` the request's
    // tool calls use (see lib/seen.js), and `req.aposMcpClient`, the tool
    // the change log records (`{ id, name }`). Returns false when it has
    // answered the request with a 401
    async authenticate(req, res) {
      req.user = null;
      req.aposMcpConnection = null;
      req.aposMcpClient = null;
      const token = self.getHeaderToken(req);
      if (!token) {
        // No error code when no credentials were sent (RFC 6750)
        self.getOauth().challenge(res, self.action);
        return false;
      }
      const identity = await self.verifyToken(token);
      if (!identity) {
        self.getOauth().challenge(res, self.action, { error: 'invalid_token' });
        return false;
      }
      req.user = identity.user;
      req.aposMcpConnection = identity.connection;
      req.aposMcpClient = {
        id: identity.clientId,
        name: identity.clientName
      };
      // Read by the SDK's adapter, which hands it to the server factory as
      // `authInfo` (see lib/http.js)
      req.auth = {
        token,
        clientId: identity.clientId,
        scopes: identity.scopes,
        extra: { req }
      };
      return true;
    },

    // `{ user, connection, clientId, clientName, scopes }` for a token this
    // route accepts, or null
    async verifyToken(token) {
      if (self.matchesDevToken(token)) {
        const user = await self.findDevUser();
        return user && {
          user,
          connection: 'dev',
          clientId: 'apos-mcp-dev-token',
          clientName: null,
          scopes: []
        };
      }
      if (!self.oauthResource) {
        return null;
      }
      const verified = await self.getOauth().verifyAccessToken(token, {
        resource: self.getOauth().getResourceUrl(self.action)
      });
      return verified && {
        user: verified.user,
        connection: verified.connectionId,
        clientId: verified.clientId,
        clientName: verified.clientName,
        // A space-separated list in OAuth (RFC 6749), an array for the SDK
        scopes: (verified.scope || '').split(' ').filter(Boolean)
      };
    },

    // The token of an `Authorization: Bearer <token>` header, or null. The
    // scheme is case-insensitive (RFC 7235)
    getHeaderToken(req) {
      const header = req.headers.authorization;
      const matches = (typeof header === 'string') && header.match(/^Bearer +(\S+)$/i);
      return matches ? matches[1] : null;
    },

    matchesDevToken(token) {
      if (!self.devToken) {
        return false;
      }
      // Hashed to equal lengths for the constant-time comparison
      const hash = (value) => crypto.createHash('sha256').update(value).digest();
      return crypto.timingSafeEqual(hash(token), hash(self.devToken.token));
    },

    // Looked up per request: the user may be created, renamed or disabled
    // after startup. Loaded the way a login session loads its user
    async findDevUser() {
      const { username } = self.devToken;
      const found = await self.apos.user
        .find(self.apos.task.getReq(), { username })
        .toObject();
      if (!found) {
        self.logError('mcp-dev-token-user', `APOS_MCP_DEV_TOKEN names the user "${username}", who does not exist.`);
        return null;
      }
      return self.apos.login.deserializeUser(found._id);
    }
  };
};
