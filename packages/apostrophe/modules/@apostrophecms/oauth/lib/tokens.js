// The token endpoint (RFC 6749 section 3.2, with the OAuth 2.1 rules) and the
// revocation endpoint (RFC 7009).
//
// A connection starts when a code is exchanged: it's a "grant", with its own
// id, and every token issued for it carries that id. An access token lasts an
// hour. A refresh token lasts 30 days and is replaced each time it's used.
// A code, or a refresh token, used a second time means someone else has a
// copy: the whole connection is revoked, whichever copy was used first
// (OAuth 2.1 sections 4.1.3 and 4.3.1).
//
// Tokens are random strings, and only their hashes are stored. A used code
// or a replaced refresh token is kept until it expires, so that its reuse
// can be recognized.
//
// "Only once" is enforced with an update whose filter says "not used yet":
// the database applies it to one request at most. Not `findOneAndUpdate`,
// which the Postgres adapter runs as a read and then a write.
//
// Parameters come in the request body only. One in the query string is
// refused, since a log entry includes the query string, and a code or a
// refresh token must never reach a log.

const crypto = require('node:crypto');

const ACCESS_TOKEN_SECONDS = 60 * 60;
const REFRESH_TOKEN_MS = 30 * 24 * 60 * 60 * 1000;
// RFC 7636 section 4.1: 43 to 128 unreserved characters
const CODE_VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;

module.exports = (self) => {
  return {
    async ensureTokensCollection() {
      self.tokens = self.apos.db.collection('aposOauthTokens');
      await self.tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      // To revoke a connection, and later to list or revoke a user's
      await self.tokens.createIndex({ grantId: 1 });
      await self.tokens.createIndex({ userId: 1 });
    },

    // POST: a code or a refresh token for new tokens
    async token(req, res) {
      self.setTokenHeaders(res);
      const params = self.getTokenParams(req, [
        'grant_type', 'client_id', 'code', 'code_verifier', 'redirect_uri',
        'refresh_token', 'resource', 'scope'
      ]);
      let tokens;
      if (params.grant_type === 'authorization_code') {
        tokens = await self.exchangeCode(req, params);
      } else if (params.grant_type === 'refresh_token') {
        tokens = await self.refreshTokens(req, params);
      } else {
        throw self.oauthError('unsupported_grant_type', 'grant_type must be "authorization_code" or "refresh_token".');
      }
      return res.send(tokens);
    },

    // POST: revokes the connection a token belongs to. Answers 200 whether
    // or not the token was known (RFC 7009 section 2.2)
    async revoke(req, res) {
      self.setTokenHeaders(res);
      const params = self.getTokenParams(req, [ 'token', 'token_type_hint', 'client_id' ]);
      if (!params.token) {
        throw self.oauthError('invalid_request', 'token is required.');
      }
      const doc = await self.tokens.findOne({ _id: self.hashSecret(params.token) });
      // Only the client the token was issued to may revoke it
      if (doc && (doc.clientId === params.client_id)) {
        await self.revokeGrant(doc.grantId);
        self.logInfo(req, 'token-revoked', {
          userId: doc.userId,
          clientId: doc.clientId
        });
      }
      return res.status(200).send({});
    },

    // The user an access token acts for, as `{ user, clientId, scope }`, or
    // null when the token is unknown, expired or revoked, isn't for
    // `resource`, or its user can no longer log in. For resources, which
    // check tokens but never issue them
    async verifyAccessToken(token, { resource } = {}) {
      if ((typeof token !== 'string') || !token.length) {
        return null;
      }
      const doc = await self.tokens.findOne({
        _id: self.hashSecret(token),
        type: 'access',
        // The TTL index removes expired tokens only every minute or so
        expiresAt: { $gt: new Date() }
      });
      if (!doc || (doc.resource !== resource)) {
        return null;
      }
      const user = await self.apos.login.deserializeUser(doc.userId);
      if (!user) {
        return null;
      }
      return {
        user,
        clientId: doc.clientId,
        scope: doc.scope
      };
    },

    async exchangeCode(req, params) {
      for (const name of [ 'code', 'code_verifier' ]) {
        if (!params[name]) {
          throw self.oauthError('invalid_request', `${name} is required.`);
        }
      }
      if (!CODE_VERIFIER.test(params.code_verifier)) {
        throw self.oauthError('invalid_request', 'code_verifier must be 43 to 128 unreserved characters.');
      }
      const codeHash = self.hashSecret(params.code);
      const grantId = crypto.randomBytes(16).toString('base64url');
      // Claimed once. A code that isn't right for this request is used up
      // all the same: it may have been stolen
      const { matchedCount } = await self.codes.updateOne({
        _id: codeHash,
        usedAt: null,
        expiresAt: { $gt: new Date() }
      }, {
        $set: {
          usedAt: new Date(),
          grantId
        }
      });
      const code = await self.codes.findOne({ _id: codeHash });
      if (matchedCount !== 1) {
        if (code && code.usedAt) {
          await self.revokeGrant(code.grantId);
          self.logWarn(req, 'code-reused', {
            userId: code.userId,
            clientId: code.clientId
          });
        }
        throw self.oauthError('invalid_grant', 'The code is not valid: it may have expired or been used already.');
      }
      if (code.clientId !== params.client_id) {
        throw self.oauthError('invalid_grant', 'The code was issued to another client.');
      }
      // Optional in OAuth 2.1, where PKCE does its job, but checked when sent
      const redirectUri = params.redirect_uri;
      if ((redirectUri !== undefined) && (redirectUri !== code.redirectUri)) {
        throw self.oauthError('invalid_grant', 'redirect_uri is not the one the code was issued for.');
      }
      if (!self.matchesCodeChallenge(params.code_verifier, code.codeChallenge)) {
        throw self.oauthError('invalid_grant', 'code_verifier does not match the code_challenge.');
      }
      self.checkTokenResource(params, code.resource);
      const user = await self.apos.login.deserializeUser(code.userId);
      if (!user) {
        throw self.oauthError('invalid_grant', 'The user who approved can no longer log in.');
      }
      const tokens = await self.issueTokens({
        grantId,
        userId: code.userId,
        clientId: code.clientId,
        resource: code.resource,
        scope: code.scope
      });
      self.logInfo(req, 'token-issued', {
        username: user.username,
        clientId: code.clientId,
        resource: code.resource,
        // Not `scope`, which the logger keeps for itself
        scopes: code.scope
      });
      return tokens;
    },

    async refreshTokens(req, params) {
      if (!params.refresh_token) {
        throw self.oauthError('invalid_request', 'refresh_token is required.');
      }
      const tokenHash = self.hashSecret(params.refresh_token);
      // Replaced once
      const { matchedCount } = await self.tokens.updateOne({
        _id: tokenHash,
        type: 'refresh',
        replacedAt: null,
        expiresAt: { $gt: new Date() }
      }, {
        $set: { replacedAt: new Date() }
      });
      const old = await self.tokens.findOne({
        _id: tokenHash,
        type: 'refresh'
      });
      if (matchedCount !== 1) {
        if (old && old.replacedAt) {
          await self.revokeGrant(old.grantId);
          self.logWarn(req, 'refresh-token-reused', {
            userId: old.userId,
            clientId: old.clientId
          });
        }
        throw self.oauthError('invalid_grant', 'The refresh token is not valid: it may have expired, been revoked or been used already.');
      }
      if (old.clientId !== params.client_id) {
        throw self.oauthError('invalid_grant', 'The refresh token was issued to another client.');
      }
      self.checkTokenResource(params, old.resource);
      // A narrower scope may be asked for, never a wider one
      let scope = old.scope;
      if (params.scope !== undefined) {
        const granted = old.scope.split(' ');
        const asked = params.scope.split(' ').filter(Boolean);
        if (!asked.length || asked.some(name => !granted.includes(name))) {
          throw self.oauthError('invalid_scope', `scope may name only: ${granted.join(', ')}.`);
        }
        scope = [ ...new Set(asked) ].join(' ');
      }
      const user = await self.apos.login.deserializeUser(old.userId);
      if (!user) {
        await self.revokeGrant(old.grantId);
        throw self.oauthError('invalid_grant', 'The user who approved can no longer log in.');
      }
      const tokens = await self.issueTokens({
        grantId: old.grantId,
        userId: old.userId,
        clientId: old.clientId,
        resource: old.resource,
        scope
      });
      self.logInfo(req, 'token-refreshed', {
        username: user.username,
        clientId: old.clientId
      });
      return tokens;
    },

    // An access token and a refresh token for the connection, and the
    // response that carries them (RFC 6749 section 5.1)
    async issueTokens({
      grantId, userId, clientId, resource, scope
    }) {
      const accessToken = crypto.randomBytes(32).toString('base64url');
      const refreshToken = crypto.randomBytes(32).toString('base64url');
      const now = Date.now();
      const common = {
        grantId,
        userId,
        clientId,
        resource,
        scope,
        createdAt: new Date(now)
      };
      await self.tokens.insertMany([
        {
          _id: self.hashSecret(accessToken),
          type: 'access',
          ...common,
          expiresAt: new Date(now + (ACCESS_TOKEN_SECONDS * 1000))
        },
        {
          _id: self.hashSecret(refreshToken),
          type: 'refresh',
          ...common,
          replacedAt: null,
          expiresAt: new Date(now + REFRESH_TOKEN_MS)
        }
      ]);
      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_SECONDS,
        refresh_token: refreshToken,
        scope
      };
    },

    // Every token of the connection, access and refresh alike
    async revokeGrant(grantId) {
      if (grantId) {
        await self.tokens.deleteMany({ grantId });
      }
    },

    // RFC 8707: a resource named in the token request must be the one the
    // user approved
    checkTokenResource(params, resource) {
      if ((params.resource !== undefined) && (params.resource !== resource)) {
        throw self.oauthError('invalid_target', 'resource is not the one the user approved.');
      }
    },

    // S256: the verifier's SHA-256, base64url-encoded, is the challenge
    matchesCodeChallenge(verifier, challenge) {
      const hash = crypto.createHash('sha256').update(verifier);
      const expected = Buffer.from(hash.digest('base64url'));
      const actual = Buffer.from(String(challenge));
      return (expected.length === actual.length) &&
        crypto.timingSafeEqual(expected, actual);
    },

    // The body parameters `names`, each as a string or undefined. A client
    // authenticates with `client_id` only: public clients have no secret
    getTokenParams(req, names) {
      if (Object.keys(req.query || {}).length) {
        throw self.oauthError('invalid_request', 'Parameters must be sent in the request body, not the URL.');
      }
      const body = req.body || {};
      if (body.client_secret || req.headers.authorization) {
        throw self.oauthError('invalid_client', 'Only public clients are supported: no client secret may be sent.', 401);
      }
      const params = {};
      for (const name of names) {
        const value = body[name];
        if (value === undefined) {
          continue;
        }
        if (typeof value !== 'string') {
          throw self.oauthError('invalid_request', `${name} must be sent once, as a string.`);
        }
        params[name] = value;
      }
      if (!params.client_id) {
        throw self.oauthError('invalid_request', 'client_id is required.');
      }
      return params;
    },

    // RFC 6749 section 5.1: no answer that carries a token may be cached
    setTokenHeaders(res) {
      res.set('Cache-Control', 'no-store');
      res.set('Pragma', 'no-cache');
    }
  };
};
