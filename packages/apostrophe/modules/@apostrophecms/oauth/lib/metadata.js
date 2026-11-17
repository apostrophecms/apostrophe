// The authorization server's metadata (RFC 8414) and the shared parts of
// serving a metadata document.

// The one scope for now. The user's own permissions are the real limit
const SCOPE = 'content';

module.exports = (self) => {
  return {
    getScopes() {
      return [ SCOPE ];
    },

    // The site's `baseUrl` with the prefix: one stable URL, whatever
    // hostname a locale or the request uses
    getIssuer() {
      return `${self.apos.baseUrl}${self.apos.prefix || ''}`;
    },

    // The absolute URL of one of this server's endpoints: `authorize`,
    // `token`, `register` or `revoke`
    getEndpointUrl(name) {
      return `${self.getIssuer()}${self.getEndpointPath(name)}`;
    },

    // The site-relative path, without the prefix, as Express sees it
    getEndpointPath(name) {
      return `${self.action}/${name}`;
    },

    getAuthorizationServerMetadata() {
      return {
        issuer: self.getIssuer(),
        authorization_endpoint: self.getEndpointUrl('authorize'),
        token_endpoint: self.getEndpointUrl('token'),
        registration_endpoint: self.getEndpointUrl('register'),
        revocation_endpoint: self.getEndpointUrl('revoke'),
        scopes_supported: self.getScopes(),
        response_types_supported: [ 'code' ],
        response_modes_supported: [ 'query' ],
        grant_types_supported: [ 'authorization_code', 'refresh_token' ],
        // Public clients only: an AI tool can't keep a secret, so PKCE
        // proves who it is
        token_endpoint_auth_methods_supported: [ 'none' ],
        revocation_endpoint_auth_methods_supported: [ 'none' ],
        code_challenge_methods_supported: [ 'S256' ],
        // A client may use the URL of its metadata document as its client id
        client_id_metadata_document_supported: true
      };
    },

    // Metadata is public and read by browser-based clients too, so any
    // origin may read it. It changes only with the site's configuration
    sendMetadata(res, metadata) {
      self.allowAnyOrigin(res);
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(metadata);
    },

    // Clients send no cookies, so letting any origin read the answer lends
    // a cross-site request nothing
    allowAnyOrigin(res) {
      res.set('Access-Control-Allow-Origin', '*');
    },

    sendPreflight(req, res) {
      self.allowAnyOrigin(res);
      res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'MCP-Protocol-Version');
      res.set('Access-Control-Max-Age', '86400');
      return res.status(204).end();
    }
  };
};
