// The authorize endpoint (RFC 6749 section 4.1, with PKCE and the OAuth 2.1
// rules): the browser comes here from the client, the user logs in if
// needed, sees the approval page, and is sent back to the client with a
// one-time code, or with `access_denied`.
//
// Until the client and its redirect URI are known good, an error is shown
// to the user and nothing is sent anywhere (section 4.1.2.1): otherwise the
// endpoint would send people to any URL it's given. After that, errors go
// back to the client.
//
// The approval page posts back here. What it approves is the request the
// GET checked, kept server-side under a random id for the user who saw it:
// the form carries only that id, so the request can't be changed on the
// way. The id also stands in for a CSRF token, which a plain form post
// can't carry in the header Apostrophe's own check wants.

const crypto = require('node:crypto');

// Codes and pending approvals both expire after 10 minutes
const LIFETIME_MS = 10 * 60 * 1000;
// RFC 7636 section 4.1: 43 to 128 unreserved characters
const CODE_CHALLENGE = /^[A-Za-z0-9\-._~]{43,128}$/;

module.exports = (self) => {
  return {
    async ensureAuthorizeCollections() {
      self.pendingApprovals = self.apos.db.collection('aposOauthApprovals');
      await self.pendingApprovals.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 }
      );
      self.codes = self.apos.db.collection('aposOauthCodes');
      await self.codes.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    },

    // GET: checks the request, then sends the user to log in or shows the
    // approval page
    async authorize(req, res) {
      self.setPageHeaders(res);
      const query = self.getAuthorizeParams(req.query);

      // Errors shown to the user, sent nowhere
      let client;
      try {
        client = await self.getClient(query.client_id);
      } catch (e) {
        if (!e.oauth) {
          throw e;
        }
        self.logWarn(req, 'client-document-failed', {
          clientId: self.clipForLog(query.client_id),
          error: e.oauth.error_description,
          // The whole cause, which the page leaves out
          cause: e.cause && e.cause.message
        });
        return self.sendErrorPage(req, res, 400, {
          reason: req.t('apostrophe:oauthBadClientMetadata'),
          advice: 'tool',
          blocked: true,
          details: e.oauth
        });
      }
      if (!client) {
        self.logWarn(req, 'unknown-client', {
          clientId: self.clipForLog(query.client_id)
        });
        return self.sendErrorPage(req, res, 400, {
          reason: req.t('apostrophe:oauthUnknownClient'),
          advice: 'tool',
          blocked: true,
          details: {
            error: 'invalid_client',
            error_description: `No client with this client_id is known to this site: ${JSON.stringify(query.client_id ?? null)}.`
          }
        });
      }
      if (!self.matchesRedirectUri(client, query.redirect_uri)) {
        // Typical of a phishing attempt: a known tool's id, with an address
        // to send the user's code to
        self.logWarn(req, 'redirect-uri-mismatch', {
          clientId: client.clientId,
          clientName: client.metadata.client_name,
          redirectUri: self.clipForLog(query.redirect_uri)
        });
        return self.sendErrorPage(req, res, 400, {
          reason: req.t('apostrophe:oauthBadRedirectUri'),
          advice: 'tool',
          blocked: true,
          clientName: client.metadata.client_name,
          details: {
            error: 'invalid_request',
            error_description: `The redirect_uri is not one the client registered: ${JSON.stringify(query.redirect_uri ?? null)}.`
          }
        });
      }

      // Errors sent back to the client
      const request = {
        clientId: client.clientId,
        // For the log, when the user decides
        clientName: client.metadata.client_name || null,
        redirectUri: query.redirect_uri,
        state: query.state
      };
      let checked;
      try {
        checked = self.checkAuthorizeRequest(client, query);
      } catch (e) {
        if (!e.oauth) {
          throw e;
        }
        return self.redirectToClient(res, request, e.oauth);
      }
      Object.assign(request, checked);

      if (!req.user) {
        const loginUrl = self.apos.login.getLoginUrl();
        if (!loginUrl) {
          return self.sendErrorPage(req, res, 400, {
            reason: req.t('apostrophe:oauthNoLogin'),
            advice: 'site'
          });
        }
        return res.redirect(`${loginUrl}?returnTo=${encodeURIComponent(req.url)}`);
      }

      const approvalId = crypto.randomBytes(32).toString('base64url');
      await self.pendingApprovals.insertOne({
        _id: approvalId,
        userId: req.user._id,
        ...request,
        expiresAt: new Date(Date.now() + LIFETIME_MS)
      });
      return self.sendAuthorizePage(req, res, 200, {
        approvalId,
        clientName: client.metadata.client_name || null,
        // Who the client is, as far as can be told: the host its document
        // is served from (CIMD), and where it sends the user back to
        clientHost: (client.source === 'cimd') ? new URL(client.clientId).host : null,
        redirectTo: describeRedirect(request.redirectUri),
        resourceDescription: request.resource
          ? self.getResourceDescription(req, request.resource)
          : null,
        site: new URL(self.getIssuer()).host,
        user: {
          title: req.user.title,
          username: req.user.username
        }
      });
    },

    // POST: the user's decision on the approval page
    async decide(req, res) {
      self.setPageHeaders(res);
      // Too large, or not a form
      if (req.oauthFormError) {
        const status = (req.oauthFormError.status === 413) ? 413 : 400;
        return self.sendErrorPage(req, res, status, {
          reason: req.t('apostrophe:oauthBadForm'),
          advice: 'retry'
        });
      }
      if (!req.user) {
        return self.sendErrorPage(req, res, 401, {
          reason: req.t('apostrophe:oauthLoggedOut'),
          advice: 'retry'
        });
      }
      const approvalId = req.body && req.body.approval;
      // One use only, and only by the user who saw the page
      const request = (typeof approvalId === 'string') && await self.claimOnce(self.pendingApprovals, {
        _id: approvalId,
        userId: req.user._id,
        expiresAt: { $gt: new Date() }
      });
      if (!request) {
        // Also what a replayed or stolen form looks like
        self.logInfo(req, 'approval-expired-or-reused', {
          username: req.user.username
        });
        return self.sendErrorPage(req, res, 400, {
          reason: req.t('apostrophe:oauthExpired'),
          advice: 'retry'
        });
      }
      // `scopes`, not `scope`: the logger keeps `scope` for where an entry
      // came from, and leaves it out of the entry's data
      const decision = {
        username: req.user.username,
        clientId: request.clientId,
        clientName: request.clientName,
        resource: request.resource,
        scopes: request.scope
      };
      if (req.body.decision !== 'approve') {
        self.logInfo(req, 'declined', decision);
        return self.redirectToClient(res, request, {
          error: 'access_denied',
          error_description: 'The user declined.'
        });
      }
      const code = await self.createCode(req.user, request);
      self.logInfo(req, 'approved', decision);
      return self.redirectToClient(res, request, { code });
    },

    // The parameters the endpoint reads, each as a string or undefined. A
    // parameter sent twice is an error (RFC 6749 section 3.1), as is one
    // that qs turned into an object
    getAuthorizeParams(query) {
      const names = [
        'response_type', 'client_id', 'redirect_uri', 'scope', 'state',
        'code_challenge', 'code_challenge_method', 'resource'
      ];
      const params = { duplicated: [] };
      for (const name of names) {
        const value = query[name];
        if (value === undefined) {
          continue;
        }
        if (typeof value !== 'string') {
          params.duplicated.push(name);
          continue;
        }
        params[name] = value;
      }
      return params;
    },

    // Checks the rest of the request, for a client and redirect URI already
    // known good. Returns what an approval keeps, or throws an OAuth error
    checkAuthorizeRequest(client, query) {
      if (query.duplicated.length) {
        throw self.oauthError('invalid_request', `Sent more than once: ${query.duplicated.join(', ')}.`);
      }
      if (query.response_type !== 'code') {
        throw self.oauthError('unsupported_response_type', 'response_type must be "code".');
      }
      if (!query.code_challenge) {
        throw self.oauthError('invalid_request', 'code_challenge is required (PKCE).');
      }
      if (query.code_challenge_method !== 'S256') {
        throw self.oauthError('invalid_request', 'code_challenge_method must be "S256".');
      }
      if (!CODE_CHALLENGE.test(query.code_challenge)) {
        throw self.oauthError('invalid_request', 'code_challenge is not valid.');
      }
      const allowed = client.metadata.scope.split(' ');
      const scope = query.scope ? query.scope.split(' ').filter(Boolean) : allowed;
      if (!scope.length || scope.some(name => !allowed.includes(name))) {
        throw self.oauthError('invalid_scope', `scope may name only: ${allowed.join(', ')}.`);
      }
      // RFC 8707: the resource the token is for, which becomes its audience.
      // A token without one is accepted by no resource
      let resource = null;
      if (query.resource !== undefined) {
        resource = [ ...self.resources.keys() ]
          .map(path => self.getResourceUrl(path))
          .find(url => url === query.resource);
        if (!resource) {
          throw self.oauthError('invalid_target', 'resource is not a resource of this site.');
        }
      }
      return {
        scope: [ ...new Set(scope) ].join(' '),
        resource,
        codeChallenge: query.code_challenge
      };
    },

    // Issues a one-time code for an approved request. Only its hash is
    // stored. Returns the code
    async createCode(user, request) {
      const code = crypto.randomBytes(32).toString('base64url');
      await self.codes.insertOne({
        _id: self.hashSecret(code),
        userId: user._id,
        clientId: request.clientId,
        redirectUri: request.redirectUri,
        scope: request.scope,
        resource: request.resource,
        codeChallenge: request.codeChallenge,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + LIFETIME_MS)
      });
      return code;
    },

    // The document matching `filter`, deleted so that no other request can
    // have it, or null. Two requests may both find it, but only one can
    // delete it. Not `findOneAndDelete`, which the Postgres and SQLite
    // adapters don't have
    async claimOnce(collection, filter) {
      const doc = await collection.findOne(filter);
      if (!doc) {
        return null;
      }
      const { deletedCount } = await collection.deleteOne(filter);
      return (deletedCount === 1) ? doc : null;
    },

    hashSecret(secret) {
      return crypto.createHash('sha256').update(secret).digest('base64url');
    },

    // Sends the browser back to the client with `params`, plus `state` and
    // `iss` (RFC 9207: says which server answered, against mix-up attacks)
    redirectToClient(res, request, params) {
      const url = new URL(request.redirectUri);
      for (const [ name, value ] of Object.entries({
        ...params,
        ...(request.state !== undefined && { state: request.state }),
        iss: self.getIssuer()
      })) {
        url.searchParams.set(name, value);
      }
      return res.redirect(303, url.href);
    },

    // The page shown in place of the approval page when the request can't go
    // on. `reason` is one plain sentence on what happened. `advice` is what
    // to do next: 'tool' (the tool got the request wrong: try again, then
    // contact its developer), 'retry' (start again from the tool) or 'site'
    // (this site's problem: contact its administrator). `blocked` is for a
    // request stopped before anything was sent back to the tool. `details`
    // is the OAuth error, `{ error, error_description }`, for the tool's
    // developer: it's kept apart from the rest of the page, never shown as
    // the reason. `nothingShared` says nothing was connected or shared,
    // which is true unless the error is unexpected
    async sendErrorPage(req, res, status, {
      reason,
      advice,
      blocked = false,
      clientName = null,
      details = null,
      nothingShared = true
    }) {
      return self.sendAuthorizePage(req, res, status, {
        error: {
          reason,
          advice,
          blocked,
          clientName: clientName || null,
          details,
          nothingShared
        }
      });
    },

    // The approval page, or an error in its place
    async sendAuthorizePage(req, res, status, data) {
      const html = await self.render(req, 'authorize', {
        ...data,
        project: self.apos.login.getProjectHeader(),
        locale: req.locale,
        action: self.getEndpointPath('authorize')
      });
      return res.status(status).send(html);
    },

    // For the approval page and its errors: never framed by another site,
    // so it can't be overlaid to trick a click on Approve, never cached,
    // and its URL (with the request's state) never sent on as a referrer
    setPageHeaders(res) {
      res.set('X-Frame-Options', 'DENY');
      res.set('Content-Security-Policy', 'frame-ancestors \'none\'');
      res.set('Cache-Control', 'no-store');
      res.set('Referrer-Policy', 'no-referrer');
    }
  };
};

// "tool.example.com", or "an app on this computer" style descriptions for
// loopback and private-use scheme redirects
function describeRedirect(uri) {
  const url = new URL(uri);
  if ([ 'http:', 'https:' ].includes(url.protocol)) {
    return {
      host: url.host,
      local: [ '127.0.0.1', '[::1]', 'localhost' ].includes(url.hostname)
    };
  }
  return {
    host: url.protocol.replace(/:$/, ''),
    local: true
  };
}
